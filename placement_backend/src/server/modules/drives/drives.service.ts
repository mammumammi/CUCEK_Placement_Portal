/**
 * @fileoverview Placement drives domain service handling creation, retrieval, and eligibility evaluation.
 * @module server/modules/drives/drives.service
 */

import { eq, and, desc, sql } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { drives, studentProfiles, applications, applicationRounds } from '@/core/db';
import { PortalError } from '@/core/errors/portal-error';
import type { FileStorage } from '@/server/services/storage.service';
import type { CreateDriveInput, UpdateRoundInput, UpdateDriveDetailsInput } from './drives.schema';
import { notifyEligibleStudentsForDrive } from './mail.service';

export interface DriveActor {
  id: string;
  role: string;
  branch: string | null;
}

export interface ProfileEligibilityInput {
  branch?: string | null;
  cgpa: number;
  activeBacklogs: number;
  placementStatus?: 'UNPLACED' | 'GENERAL' | 'DREAM' | 'INTERNSHIP' | string | null;
  placedCategories?: Array<'GENERAL' | 'DREAM' | 'INTERNSHIP' | string>;
}

export interface DriveEligibilityCriteria {
  eligibleBranches: string[];
  minCgpa: number;
  maxActiveBacklogs: number;
  packageCategory?: 'GENERAL' | 'DREAM' | 'INTERNSHIP' | string | null;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/**
 * Pure function evaluating student eligibility against a recruitment drive's criteria.
 *
 * Rules:
 * 1. Branch in eligibleBranches
 * 2. CGPA >= minCgpa
 * 3. Active backlogs <= maxActiveBacklogs
 * 4. Placement Tier Policy:
 *    - Placed in DREAM: cannot apply for ANY further companies
 *    - Placed in GENERAL: cannot apply for other GENERAL companies
 *    - Placed in INTERNSHIP: cannot apply for other INTERNSHIP companies
 *
 * @param profile - Student academic details or null/undefined.
 * @param drive - Drive eligibility thresholds and allowed branches.
 * @returns Result object containing `eligible` boolean and array of failure `reasons`.
 */
export function evaluateEligibility(
  profile: ProfileEligibilityInput | null | undefined,
  drive: DriveEligibilityCriteria
): EligibilityResult {
  const reasons: string[] = [];

  if (!profile) {
    return {
      eligible: false,
      reasons: ['Student profile not registered or found'],
    };
  }

  // 1. Branch Check: branch in eligibleBranches
  if (!profile.branch || !drive.eligibleBranches.includes(profile.branch)) {
    reasons.push(
      `Branch "${profile.branch ?? 'Unknown'}" is not eligible. Eligible branches: ${drive.eligibleBranches.join(', ')}`
    );
  }

  // 2. CGPA Check: cgpa >= minCgpa
  if (profile.cgpa < drive.minCgpa) {
    reasons.push(
      `CGPA (${profile.cgpa}) is below minimum requirement (${drive.minCgpa})`
    );
  }

  // 3. Active Backlogs Check: activeBacklogs <= maxActiveBacklogs
  if (profile.activeBacklogs > drive.maxActiveBacklogs) {
    reasons.push(
      `Active backlogs (${profile.activeBacklogs}) exceed maximum allowed (${drive.maxActiveBacklogs})`
    );
  }

  // 4. Placement Tier Policy Enforcement
  const status = (profile.placementStatus || 'UNPLACED').toUpperCase();
  const placedOffers = (profile.placedCategories || []).map((c) => String(c).toUpperCase());
  const driveCategory = (drive.packageCategory || 'GENERAL').toUpperCase();

  const isDreamPlaced = status === 'DREAM' || placedOffers.includes('DREAM');
  const isGeneralPlaced = status === 'GENERAL' || placedOffers.includes('GENERAL');
  const isInternshipPlaced = status === 'INTERNSHIP' || placedOffers.includes('INTERNSHIP');

  if (isDreamPlaced) {
    reasons.push(
      'Students placed in a Dream category offer (≥ 7 LPA) have achieved maximum placement tier and cannot apply for further drives'
    );
  } else {
    if (isGeneralPlaced && driveCategory === 'GENERAL') {
      reasons.push(
        'Students placed in a General category offer cannot apply for another General category drive'
      );
    }
    if (isInternshipPlaced && driveCategory === 'INTERNSHIP') {
      reasons.push(
        'Students who have secured an Internship offer cannot apply for other Internship drives'
      );
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

/**
 * Creates a new placement drive, persists the optional JD PDF to file storage,
 * and records the drive in the database.
 */
export async function createDrive(
  db: Db,
  storage: FileStorage,
  actor: DriveActor,
  input: CreateDriveInput,
  fileOrFiles?:
    | { originalname: string; buffer: Buffer; mimetype: string; fieldname?: string }
    | Array<{ originalname: string; buffer: Buffer; mimetype: string; fieldname?: string }>
) {
  if (actor.role !== 'MAIN_COORDINATOR') {
    throw new PortalError('FORBIDDEN', 'Only main coordinators can create recruitment drives', 403);
  }

  const filesList: Array<{ originalname: string; buffer: Buffer; mimetype: string; fieldname?: string }> = [];
  if (Array.isArray(fileOrFiles)) {
    filesList.push(...fileOrFiles);
  } else if (fileOrFiles) {
    filesList.push(fileOrFiles);
  }

  const jdFileUrls: string[] = [];
  const mockTestPdfUrls: string[] = Array.isArray(input.mockTestPdfUrls) ? [...input.mockTestPdfUrls] : [];

  for (const f of filesList) {
    const saved = await storage.save(f.originalname, f.buffer, f.mimetype);
    if (
      f.fieldname === 'mockTestFiles' ||
      f.fieldname === 'mockTestFile' ||
      f.originalname.toLowerCase().includes('mock') ||
      f.originalname.toLowerCase().includes('test-paper')
    ) {
      if (!mockTestPdfUrls.includes(saved.url)) {
        mockTestPdfUrls.push(saved.url);
      }
    } else {
      jdFileUrls.push(saved.url);
    }
  }

  if (Array.isArray(input.jdFileUrls)) {
    for (const u of input.jdFileUrls) {
      if (u && !jdFileUrls.includes(u)) {
        jdFileUrls.push(u);
      }
    }
  }

  const jdFileUrl = jdFileUrls.length > 0 ? jdFileUrls[0] : null;

  const driveId = crypto.randomUUID();
  const allowBacklogs = Boolean(input.allowBacklogs || input.maxActiveBacklogs > 0);
  const maxActiveBacklogs = allowBacklogs ? (input.maxActiveBacklogs > 0 ? input.maxActiveBacklogs : 2) : 0;

  // Auto-register any custom questionnaire fields defined in company format
  const mergedExtraFields = [...(input.extraFields ?? [])];
  if (Array.isArray(input.companyFormat)) {
    for (const col of input.companyFormat) {
      if (col.sourceField === '__custom_field__') {
        const fieldKey = (col.customKey || col.companyHeader).trim().replace(/[^a-zA-Z0-9_]/g, '_');
        if (!mergedExtraFields.some((f) => f.key === fieldKey)) {
          mergedExtraFields.push({
            key: fieldKey,
            label: col.companyHeader,
            type: 'text',
            required: false,
          });
        }
      }
    }
  }

  const newDrive = {
    id: driveId,
    company: input.company,
    role: input.role ?? null,
    description: input.description ?? null,
    packageCategory: input.packageCategory ?? 'GENERAL',
    ctcLpa: input.ctcLpa ?? null,
    youtubeUrl: input.youtubeUrl ?? null,
    jdFileUrl,
    jdFileUrls,
    mockTestPdfUrls,
    companyFormat: input.companyFormat ?? [],
    deadline: new Date(input.deadline).toISOString(),
    eligibleBranches: input.eligibleBranches,
    minCgpa: input.minCgpa,
    maxActiveBacklogs,
    allowBacklogs,
    extraFields: mergedExtraFields,
    totalRounds: input.totalRounds,
    createdBy: actor.id,
    createdAt: new Date(),
  };

  await db.insert(drives).values(newDrive);

  let notification = null;
  if (input.notifyEligible) {
    try {
      notification = await notifyEligibleStudentsForDrive(db, driveId);
    } catch {
      // Ignore notification failures during creation
    }
  }

  return {
    ...newDrive,
    open: true,
    notification,
  };
}

/**
 * Lists all recruitment drives.
 * Each drive includes `open` boolean, and for students includes `eligible` and `reasons`.
 */
export async function listDrives(db: Db, actor: DriveActor) {
  const allDrives = await db
    .select()
    .from(drives)
    .orderBy(desc(drives.createdAt));

  let studentProfile: ProfileEligibilityInput | null = null;
  let appliedDriveIds = new Set<string>();
  if (actor.role === 'STUDENT') {
    const [profile] = await db
      .select({
        branch: studentProfiles.branch,
        cgpa: studentProfiles.cgpa,
        activeBacklogs: studentProfiles.activeBacklogs,
        placementStatus: studentProfiles.placementStatus,
      })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, actor.id))
      .limit(1);

    const placedApps = await db
      .select({
        packageCategory: drives.packageCategory,
      })
      .from(applications)
      .innerJoin(drives, eq(applications.driveId, drives.id))
      .where(and(eq(applications.studentUserId, actor.id), eq(applications.placed, true)));

    const studentApps = await db
      .select({ driveId: applications.driveId })
      .from(applications)
      .where(eq(applications.studentUserId, actor.id));

    appliedDriveIds = new Set(studentApps.map((a) => a.driveId));

    studentProfile = profile
      ? {
          branch: profile.branch,
          cgpa: profile.cgpa,
          activeBacklogs: profile.activeBacklogs,
          placementStatus: profile.placementStatus,
          placedCategories: placedApps.map((p) => p.packageCategory || 'GENERAL'),
        }
      : null;
  }

  return allDrives.map((d) => {
    const isOpen = new Date(d.deadline).getTime() > Date.now();

    if (actor.role === 'STUDENT') {
      const eligibility = evaluateEligibility(studentProfile, {
        eligibleBranches: d.eligibleBranches,
        minCgpa: d.minCgpa,
        maxActiveBacklogs: d.maxActiveBacklogs,
        packageCategory: d.packageCategory,
      });

      return {
        ...d,
        open: isOpen,
        eligible: eligibility.eligible,
        reasons: eligibility.reasons,
        userApplied: appliedDriveIds.has(d.id),
      };
    }

    return {
      ...d,
      open: isOpen,
    };
  });
}

/**
 * Retrieves a single drive by ID with open status and student eligibility evaluation.
 */
export async function getDriveById(
  db: Db,
  actor: DriveActor,
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

  const isOpen = new Date(drive.deadline).getTime() > Date.now();

  if (actor.role === 'STUDENT') {
    const [profile] = await db
      .select({
        branch: studentProfiles.branch,
        cgpa: studentProfiles.cgpa,
        activeBacklogs: studentProfiles.activeBacklogs,
        placementStatus: studentProfiles.placementStatus,
      })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, actor.id))
      .limit(1);

    const placedApps = await db
      .select({
        packageCategory: drives.packageCategory,
      })
      .from(applications)
      .innerJoin(drives, eq(applications.driveId, drives.id))
      .where(and(eq(applications.studentUserId, actor.id), eq(applications.placed, true)));

    const [userApp] = await db
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.driveId, drive.id),
          eq(applications.studentUserId, actor.id)
        )
      )
      .limit(1);

    const studentProfile = profile
      ? {
          branch: profile.branch,
          cgpa: profile.cgpa,
          activeBacklogs: profile.activeBacklogs,
          placementStatus: profile.placementStatus,
          placedCategories: placedApps.map((p) => p.packageCategory || 'GENERAL'),
        }
      : null;

    const eligibility = evaluateEligibility(studentProfile, {
      eligibleBranches: drive.eligibleBranches,
      minCgpa: drive.minCgpa,
      maxActiveBacklogs: drive.maxActiveBacklogs,
      packageCategory: drive.packageCategory,
    });

    return {
      ...drive,
      open: isOpen,
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      userApplied: Boolean(userApp),
    };
  }

  return {
    ...drive,
    open: isOpen,
  };
}

/**
 * Updates an existing drive's details such as YouTube video URL, role, category, and criteria.
 */
export async function updateDriveDetails(
  db: Db,
  actor: DriveActor,
  driveId: string,
  input: UpdateDriveDetailsInput
) {
  if (actor.role !== 'MAIN_COORDINATOR' && actor.role !== 'BRANCH_COORDINATOR') {
    throw new PortalError('FORBIDDEN', 'Only placement coordinators can update drive details', 403);
  }

  const [existing] = await db.select().from(drives).where(eq(drives.id, driveId)).limit(1);
  if (!existing) {
    throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
  }

  const updates: Partial<typeof drives.$inferInsert> = {};
  if (input.company !== undefined) updates.company = input.company;
  if (input.role !== undefined) updates.role = input.role;
  if (input.description !== undefined) updates.description = input.description;
  if (input.packageCategory !== undefined) updates.packageCategory = input.packageCategory;
  if (input.ctcLpa !== undefined) updates.ctcLpa = input.ctcLpa;
  if (input.youtubeUrl !== undefined) updates.youtubeUrl = input.youtubeUrl;
  if (input.deadline !== undefined) updates.deadline = new Date(input.deadline).toISOString();
  if (input.eligibleBranches !== undefined) updates.eligibleBranches = input.eligibleBranches;
  if (input.minCgpa !== undefined) updates.minCgpa = input.minCgpa;
  if (input.maxActiveBacklogs !== undefined) updates.maxActiveBacklogs = input.maxActiveBacklogs;
  if (input.allowBacklogs !== undefined) updates.allowBacklogs = input.allowBacklogs;

  await db.update(drives).set(updates).where(eq(drives.id, driveId));

  const [updated] = await db.select().from(drives).where(eq(drives.id, driveId)).limit(1);
  return updated;
}

/**
 * Retrieves the Job Description (JD) file for a drive from storage.
 */
export async function getDriveJdFile(
  db: Db,
  storage: FileStorage,
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

  if (!drive.jdFileUrl) {
    throw new PortalError(
      'NOT_FOUND',
      'No Job Description (JD) file uploaded for this drive',
      404
    );
  }

  const file = await storage.get(drive.jdFileUrl);
  if (!file) {
    throw new PortalError('NOT_FOUND', 'JD file could not be found in storage', 404);
  }

  return {
    drive,
    file,
  };
}

/**
 * Updates application round outcomes and placement status with round progression enforcement.
 * Round N can only be SHORTLISTED if Round N-1 was SHORTLISTED.
 */
export async function updateApplicationRound(
  db: Db,
  actor: DriveActor,
  driveId: string,
  studentId: string,
  input: UpdateRoundInput
) {
  if (actor.role !== 'MAIN_COORDINATOR' && actor.role !== 'BRANCH_COORDINATOR') {
    throw new PortalError('FORBIDDEN', 'Only coordinators can update application rounds', 403);
  }

  const [drive] = await db
    .select()
    .from(drives)
    .where(eq(drives.id, driveId))
    .limit(1);

  if (!drive) {
    throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
  }

  // Find student profile by college roll number
  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.studentId, studentId))
    .limit(1);

  if (!profile) {
    throw new PortalError('NOT_FOUND', `Student profile "${studentId}" not found`, 404);
  }

  // Branch coordinator scoping
  if (actor.role === 'BRANCH_COORDINATOR') {
    if (profile.branch !== actor.branch) {
      throw new PortalError(
        'FORBIDDEN',
        'Branch coordinators can only manage applications in their own branch',
        403
      );
    }
  }

  // Find application
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
      `Application for student "${studentId}" on drive "${driveId}" not found`,
      404
    );
  }

  // 1. Handle round progression update if provided
  if (input.roundNumber !== undefined && input.result !== undefined) {
    if (input.roundNumber > drive.totalRounds) {
      throw new PortalError(
        'VALIDATION_ERROR',
        `roundNumber (${input.roundNumber}) cannot exceed total rounds (${drive.totalRounds})`,
        400
      );
    }

    // Progression rule: Round N can only be SHORTLISTED if round N-1 was SHORTLISTED
    if (input.result === 'SHORTLISTED' && input.roundNumber > 1) {
      const [prevRound] = await db
        .select()
        .from(applicationRounds)
        .where(
          and(
            eq(applicationRounds.applicationId, app.id),
            eq(applicationRounds.roundNumber, input.roundNumber - 1)
          )
        )
        .limit(1);

      if (!prevRound || prevRound.result !== 'SHORTLISTED') {
        throw new PortalError(
          'VALIDATION_ERROR',
          `Cannot shortlist round ${input.roundNumber} unless round ${input.roundNumber - 1} was SHORTLISTED`,
          400
        );
      }
    }

    // Upsert round record
    const [existingRound] = await db
      .select()
      .from(applicationRounds)
      .where(
        and(
          eq(applicationRounds.applicationId, app.id),
          eq(applicationRounds.roundNumber, input.roundNumber)
        )
      )
      .limit(1);

    if (existingRound) {
      await db
        .update(applicationRounds)
        .set({ result: input.result })
        .where(eq(applicationRounds.id, existingRound.id));
    } else {
      await db.insert(applicationRounds).values({
        id: crypto.randomUUID(),
        applicationId: app.id,
        roundNumber: input.roundNumber,
        result: input.result,
        createdAt: new Date(),
      });
    }
  }

  // 2. Handle placement status update if provided
  if (input.placed !== undefined) {
    await db
      .update(applications)
      .set({ placed: input.placed })
      .where(eq(applications.id, app.id));
  }

  // Fetch updated application rounds
  const rounds = await db
    .select()
    .from(applicationRounds)
    .where(eq(applicationRounds.applicationId, app.id))
    .orderBy(applicationRounds.roundNumber);

  const [updatedApp] = await db
    .select()
    .from(applications)
    .where(eq(applications.id, app.id))
    .limit(1);

  return {
    applicationId: app.id,
    studentId,
    placed: updatedApp.placed,
    rounds,
  };
}

export interface BranchDriveStats {
  branch: string;
  applied: number;
  shortlistedByRound: number[];
  placed: number;
}

export interface DriveStatsResult {
  branches: BranchDriveStats[];
  totals: {
    applied: number;
    shortlistedByRound: number[];
    placed: number;
  };
}

/**
 * Computes drive funnel statistics (applied, shortlisted per round, placed) per branch plus totals,
 * computed via SQL GROUP BY aggregations.
 */
export async function getDriveStats(
  db: Db,
  driveId: string,
  scope?: { role?: string; branch?: string | null }
): Promise<DriveStatsResult> {
  const [drive] = await db
    .select()
    .from(drives)
    .where(eq(drives.id, driveId))
    .limit(1);

  if (!drive) {
    throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
  }

  // 1. Group applications by branch: applied count and placed count
  const branchAppQuery = db
    .select({
      branch: studentProfiles.branch,
      applied: sql<number>`count(${applications.id})`.mapWith(Number),
      placed: sql<number>`sum(case when ${applications.placed} = 1 then 1 else 0 end)`.mapWith(Number),
    })
    .from(applications)
    .innerJoin(studentProfiles, eq(applications.studentUserId, studentProfiles.userId))
    .where(
      and(
        eq(applications.driveId, driveId),
        scope?.role === 'BRANCH_COORDINATOR' && scope.branch
          ? eq(studentProfiles.branch, scope.branch)
          : undefined
      )
    )
    .groupBy(studentProfiles.branch);

  const branchApps = await branchAppQuery;

  // 2. Group shortlisted rounds by branch and roundNumber
  const roundShortlistQuery = db
    .select({
      branch: studentProfiles.branch,
      roundNumber: applicationRounds.roundNumber,
      shortlistedCount: sql<number>`count(${applicationRounds.id})`.mapWith(Number),
    })
    .from(applicationRounds)
    .innerJoin(applications, eq(applicationRounds.applicationId, applications.id))
    .innerJoin(studentProfiles, eq(applications.studentUserId, studentProfiles.userId))
    .where(
      and(
        eq(applications.driveId, driveId),
        eq(applicationRounds.result, 'SHORTLISTED'),
        scope?.role === 'BRANCH_COORDINATOR' && scope.branch
          ? eq(studentProfiles.branch, scope.branch)
          : undefined
      )
    )
    .groupBy(studentProfiles.branch, applicationRounds.roundNumber);

  const roundShortlists = await roundShortlistQuery;

  // 3. Assemble per-branch metrics
  const branchesMap = new Map<string, BranchDriveStats>();

  for (const b of branchApps) {
    const branchName = b.branch ?? 'Unknown';
    branchesMap.set(branchName, {
      branch: branchName,
      applied: b.applied,
      shortlistedByRound: new Array(drive.totalRounds).fill(0),
      placed: b.placed,
    });
  }

  for (const rs of roundShortlists) {
    const branchName = rs.branch ?? 'Unknown';
    let branchStat = branchesMap.get(branchName);
    if (!branchStat) {
      branchStat = {
        branch: branchName,
        applied: 0,
        shortlistedByRound: new Array(drive.totalRounds).fill(0),
        placed: 0,
      };
      branchesMap.set(branchName, branchStat);
    }
    if (rs.roundNumber >= 1 && rs.roundNumber <= drive.totalRounds) {
      branchStat.shortlistedByRound[rs.roundNumber - 1] = rs.shortlistedCount;
    }
  }

  // Handle branch coordinator whose branch has no applicants yet
  if (scope?.role === 'BRANCH_COORDINATOR' && scope.branch && !branchesMap.has(scope.branch)) {
    branchesMap.set(scope.branch, {
      branch: scope.branch,
      applied: 0,
      shortlistedByRound: new Array(drive.totalRounds).fill(0),
      placed: 0,
    });
  }

  const branches = Array.from(branchesMap.values()).sort((a, b) => a.branch.localeCompare(b.branch));

  // 4. Compute totals
  const totals = {
    applied: 0,
    shortlistedByRound: new Array(drive.totalRounds).fill(0),
    placed: 0,
  };

  for (const b of branches) {
    totals.applied += b.applied;
    totals.placed += b.placed;
    for (let r = 0; r < drive.totalRounds; r++) {
      totals.shortlistedByRound[r] += b.shortlistedByRound[r];
    }
  }

  return {
    branches,
    totals,
  };
}

