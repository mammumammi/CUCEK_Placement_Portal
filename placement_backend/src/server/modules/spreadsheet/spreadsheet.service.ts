/**
 * @fileoverview Drive application spreadsheet service managing student applications,
 * live sheet rows, RBAC permissions, and coordinator verification.
 * @module server/modules/spreadsheet/spreadsheet.service
 */

import { eq, and } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { drives, studentProfiles, applications } from '@/core/db';
import type { DriveExtraField } from '@/core/db/schema/drives.schema';
import { PortalError } from '@/core/errors/portal-error';
import { evaluateEligibility } from '../drives/drives.service';
import type { ApplyDriveInput, PatchRowInput } from './spreadsheet.schema';

export interface SpreadsheetActor {
  id: string;
  role: string;
  branch: string | null;
}

export interface DriveRowTarget {
  studentUserId: string;
  branch: string | null;
  verified: boolean;
}

export interface DriveDeadlineTarget {
  deadline: string | Date;
}

export interface RowPermissions {
  canEditExtraData: boolean;
  canVerify: boolean;
  locked: boolean;
  reason: string | null;
}

export interface ValidateExtraDataOptions {
  allowPartial?: boolean;
}

/**
 * Pure function computing cell/row edit and verification permissions.
 *
 * Rules:
 * - A STUDENT can edit only their OWN row, only extraData, only before the deadline, and only while unverified.
 * - A BRANCH_COORDINATOR can edit and verify rows only of students in their own branch.
 * - The MAIN_COORDINATOR can edit and verify all rows.
 * - The deadline blocks STUDENTS only, since coordinators verify after the deadline.
 */
export function getRowPermissions(
  user: SpreadsheetActor,
  drive: DriveDeadlineTarget,
  row: DriveRowTarget,
  now: Date = new Date()
): RowPermissions {
  if (user.role === 'MAIN_COORDINATOR') {
    return {
      canEditExtraData: true,
      canVerify: true,
      locked: false,
      reason: null,
    };
  }

  if (user.role === 'BRANCH_COORDINATOR') {
    if (row.branch === user.branch) {
      return {
        canEditExtraData: true,
        canVerify: true,
        locked: false,
        reason: null,
      };
    }
    return {
      canEditExtraData: false,
      canVerify: false,
      locked: true,
      reason: 'Branch coordinator can only manage rows in their own branch',
    };
  }

  if (user.role === 'STUDENT') {
    // Students can NEVER verify rows
    if (user.id !== row.studentUserId) {
      return {
        canEditExtraData: false,
        canVerify: false,
        locked: true,
        reason: 'Students can only access their own row',
      };
    }

    const deadlineTime = new Date(drive.deadline).getTime();
    if (now.getTime() > deadlineTime) {
      return {
        canEditExtraData: false,
        canVerify: false,
        locked: true,
        reason: 'Application deadline has passed',
      };
    }

    if (row.verified) {
      return {
        canEditExtraData: false,
        canVerify: false,
        locked: true,
        reason: 'Row is verified and locked against student modifications',
      };
    }

    return {
      canEditExtraData: true,
      canVerify: false,
      locked: false,
      reason: null,
    };
  }

  return {
    canEditExtraData: false,
    canVerify: false,
    locked: true,
    reason: 'Unauthorized role',
  };
}

/**
 * Validates dynamic extraData values against a drive's configured extraFields.
 * Checks for unknown keys, required presence, number coercion/type, and dropdown options.
 */
export function validateExtraData(
  extraData: Record<string, unknown> | undefined,
  extraFields: DriveExtraField[] | null | undefined,
  options: ValidateExtraDataOptions = {}
): Record<string, unknown> {
  const data = extraData ?? {};
  const fields = extraFields ?? [];
  const allowedKeys = new Set(fields.map((f) => f.key));

  // 1. Reject unknown keys
  for (const key of Object.keys(data)) {
    if (!allowedKeys.has(key)) {
      throw new PortalError(
        'VALIDATION_ERROR',
        `Unknown extra field "${key}". Configured fields: ${Array.from(allowedKeys).join(', ') || 'none'}`,
        400
      );
    }
  }

  const result: Record<string, unknown> = {};

  // 2. Validate configured fields
  for (const field of fields) {
    const val = data[field.key];

    if (!options.allowPartial && field.required) {
      if (val === undefined || val === null || val === '') {
        throw new PortalError(
          'VALIDATION_ERROR',
          `Field "${field.label}" (${field.key}) is required`,
          400
        );
      }
    }

    if (val !== undefined && val !== null && val !== '') {
      if (field.type === 'number') {
        const num = Number(val);
        if (Number.isNaN(num) || typeof val === 'boolean') {
          throw new PortalError(
            'VALIDATION_ERROR',
            `Field "${field.label}" (${field.key}) must be a valid number`,
            400
          );
        }
        result[field.key] = num;
      } else if (field.type === 'dropdown') {
        const optionsList = field.options ?? [];
        if (!optionsList.includes(String(val))) {
          throw new PortalError(
            'VALIDATION_ERROR',
            `Invalid option "${val}" for dropdown "${field.label}". Allowed options: ${optionsList.join(', ')}`,
            400
          );
        }
        result[field.key] = String(val);
      } else {
        result[field.key] = String(val);
      }
    }
  }

  return result;
}

/**
 * Handles student recruitment drive application submission.
 * Enforces future deadline, eligibility criteria, and blocks duplicate applications with 409.
 */
export async function applyToDrive(
  db: Db,
  actor: SpreadsheetActor,
  driveId: string,
  input: ApplyDriveInput
) {
  if (actor.role !== 'STUDENT') {
    throw new PortalError('FORBIDDEN', 'Only students can apply to placement drives', 403);
  }

  const [drive] = await db
    .select()
    .from(drives)
    .where(eq(drives.id, driveId))
    .limit(1);

  if (!drive) {
    throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
  }

  // 1. Check deadline
  if (new Date(drive.deadline).getTime() <= Date.now()) {
    throw new PortalError('DEADLINE_PASSED', 'Drive application deadline has passed', 403);
  }

  // 2. Fetch student profile
  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, actor.id))
    .limit(1);

  if (!profile) {
    throw new PortalError('NOT_FOUND', 'Student academic profile not found', 404);
  }

  // 3. Evaluate eligibility
  const eligibility = evaluateEligibility(profile, drive);
  if (!eligibility.eligible) {
    throw new PortalError(
      'INELIGIBLE',
      `Student is not eligible to apply: ${eligibility.reasons.join('; ')}`,
      403
    );
  }

  // 4. Check duplicate application
  const [existing] = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.driveId, drive.id),
        eq(applications.studentUserId, actor.id)
      )
    )
    .limit(1);

  if (existing) {
    throw new PortalError('CONFLICT', 'You have already applied to this drive', 409);
  }

  // 5. Validate extraData if provided (allow partial on initial apply)
  const validatedExtraData = validateExtraData(input.extraData, drive.extraFields, {
    allowPartial: true,
  });

  const applicationId = crypto.randomUUID();
  await db.insert(applications).values({
    id: applicationId,
    driveId: drive.id,
    studentUserId: actor.id,
    extraData: validatedExtraData,
    verified: false,
    createdAt: new Date(),
  });

  return {
    applicationId,
    driveId: drive.id,
    status: 'APPLIED',
  };
}

/**
 * Retrieves spreadsheet rows for a drive with RBAC scoping and computed row permissions.
 */
export async function getDriveSpreadsheetRows(
  db: Db,
  actor: SpreadsheetActor,
  driveId: string
) {
  const [drive] = await db
    .select()
    .from(drives)
    .where(eq(drives.id, driveId))
    .limit(1);

  if (!drive) {
    throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
  }

  // Query applications joined with studentProfiles
  const baseQuery = db
    .select({
      applicationId: applications.id,
      driveId: applications.driveId,
      studentUserId: applications.studentUserId,
      extraData: applications.extraData,
      verified: applications.verified,
      verifiedBy: applications.verifiedBy,
      placed: applications.placed,
      appliedAt: applications.createdAt,
      studentId: studentProfiles.studentId,
      name: studentProfiles.name,
      branch: studentProfiles.branch,
      batch: studentProfiles.batch,
      email: studentProfiles.email,
      phone: studentProfiles.phone,
      activeBacklogs: studentProfiles.activeBacklogs,
      cgpa: studentProfiles.cgpa,
      resumeUrl: studentProfiles.resumeUrl,
    })
    .from(applications)
    .innerJoin(studentProfiles, eq(applications.studentUserId, studentProfiles.userId));

  let rows;
  if (actor.role === 'STUDENT') {
    rows = await baseQuery.where(
      and(
        eq(applications.driveId, driveId),
        eq(applications.studentUserId, actor.id)
      )
    );
  } else if (actor.role === 'BRANCH_COORDINATOR') {
    rows = await baseQuery.where(
      and(
        eq(applications.driveId, driveId),
        eq(studentProfiles.branch, actor.branch!)
      )
    );
  } else {
    // MAIN_COORDINATOR: all rows
    rows = await baseQuery.where(eq(applications.driveId, driveId));
  }

  const now = new Date();
  return rows.map((r) => {
    const permissions = getRowPermissions(
      actor,
      drive,
      {
        studentUserId: r.studentUserId,
        branch: r.branch,
        verified: r.verified,
      },
      now
    );

    return {
      ...r,
      permissions,
    };
  });
}

/**
 * Updates extraData or verification status on a drive application row.
 * Prevents modifications to core student profile columns and verifies field-level constraints.
 */
export async function patchDriveRow(
  db: Db,
  actor: SpreadsheetActor,
  driveId: string,
  studentId: string,
  body: PatchRowInput
) {
  // 1. Students are strictly forbidden from modifying verification status
  if (actor.role === 'STUDENT' && body.verified !== undefined) {
    throw new PortalError(
      'FORBIDDEN',
      'Students are not authorized to verify or unverify application rows',
      403
    );
  }

  const [drive] = await db
    .select()
    .from(drives)
    .where(eq(drives.id, driveId))
    .limit(1);

  if (!drive) {
    throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
  }

  // 2. Resolve student profile by university college roll number
  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.studentId, studentId))
    .limit(1);

  if (!profile) {
    throw new PortalError('NOT_FOUND', `Student profile "${studentId}" not found`, 404);
  }

  // 3. Resolve student application
  const [app] = await db
    .select()
    .from(applications)
    .where(
      and(
        eq(applications.driveId, drive.id),
        eq(applications.studentUserId, profile.userId)
      )
    )
    .limit(1);

  if (!app) {
    throw new PortalError(
      'NOT_FOUND',
      `Application for student "${studentId}" not found on drive "${driveId}"`,
      404
    );
  }

  // 4. Compute permissions and validate access
  const permissions = getRowPermissions(
    actor,
    drive,
    {
      studentUserId: app.studentUserId,
      branch: profile.branch,
      verified: app.verified,
    },
    new Date()
  );

  if (actor.role === 'STUDENT') {
    if (actor.id !== app.studentUserId) {
      throw new PortalError('FORBIDDEN', 'Students can only edit their own application row', 403);
    }
    if (new Date(drive.deadline).getTime() < Date.now()) {
      throw new PortalError('DEADLINE_PASSED', 'Application deadline has passed', 403);
    }
    if (app.verified) {
      throw new PortalError(
        'ROW_LOCKED',
        'Row is verified and locked against student modifications',
        403
      );
    }
  } else if (actor.role === 'BRANCH_COORDINATOR') {
    if (profile.branch !== actor.branch) {
      throw new PortalError(
        'FORBIDDEN',
        'Branch coordinators can only manage rows in their own branch',
        403
      );
    }
  }

  // 5. Validate extraData if provided
  let updatedExtraData = app.extraData;
  if (body.extraData !== undefined) {
    if (!permissions.canEditExtraData) {
      throw new PortalError('FORBIDDEN', permissions.reason ?? 'Cannot edit extra data', 403);
    }
    // Check unknown keys in the incoming payload first
    validateExtraData(body.extraData, drive.extraFields, { allowPartial: true });

    // Merge incoming extraData with existing
    const merged = {
      ...(app.extraData ?? {}),
      ...body.extraData,
    };
    // Validate merged extraData against type and option constraints
    updatedExtraData = validateExtraData(merged, drive.extraFields, { allowPartial: false });
  }

  // 6. Validate verification update if provided
  if (body.verified !== undefined) {
    if (!permissions.canVerify) {
      throw new PortalError('FORBIDDEN', permissions.reason ?? 'Cannot verify row', 403);
    }
  }

  // 7. Commit changes to applications table
  const updatePayload: Partial<typeof applications.$inferInsert> = {};
  if (body.extraData !== undefined) {
    updatePayload.extraData = updatedExtraData;
  }
  if (body.verified !== undefined) {
    updatePayload.verified = body.verified;
    updatePayload.verifiedBy = body.verified ? actor.id : null;
  }

  if (Object.keys(updatePayload).length > 0) {
    await db
      .update(applications)
      .set(updatePayload)
      .where(eq(applications.id, app.id));
  }

  // 8. Return fresh row state with updated permissions
  const [updatedApp] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, app.id))
    .limit(1);

  const updatedPermissions = getRowPermissions(
    actor,
    drive,
    {
      studentUserId: updatedApp.studentUserId,
      branch: profile.branch,
      verified: updatedApp.verified,
    },
    new Date()
  );

  return {
    applicationId: updatedApp.id,
    driveId: updatedApp.driveId,
    studentUserId: updatedApp.studentUserId,
    studentId: profile.studentId,
    name: profile.name,
    branch: profile.branch,
    batch: profile.batch,
    email: profile.email,
    phone: profile.phone,
    activeBacklogs: profile.activeBacklogs,
    cgpa: profile.cgpa,
    extraData: updatedApp.extraData,
    verified: updatedApp.verified,
    verifiedBy: updatedApp.verifiedBy,
    placed: updatedApp.placed,
    permissions: updatedPermissions,
  };
}
