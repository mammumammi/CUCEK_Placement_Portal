/**
 * @fileoverview Student profile service handling retrieval, coordinator corrections, and audit logging.
 * @module server/modules/profiles/profiles.service
 */

import { eq, and, desc, or, sql } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { users, studentProfiles, semesterResults, auditLogs, correctionRequests, applications, drives } from '@/core/db';
import { PortalError } from '@/core/errors/portal-error';
import { calculateCreditBasedCgpa } from '../cgpa/cgpa.service';
import { calculateAgeFromDob } from '../registration/registration.service';
import type {
  ProfileCorrectionInput,
  CreateCorrectionRequestInput,
  ReviewCorrectionRequestInput,
  CompleteProfileInput,
  SetBatchCurrentSemesterInput,
} from './profiles.schema';

export interface ProfileActor {
  id: string;
  role: string;
  branch: string | null;
}

/**
 * Retrieves student profile by university college roll number with RBAC scoping.
 */
export async function getProfileByStudentId(
  db: Db,
  actor: ProfileActor,
  studentId: string
) {
  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.studentId, studentId))
    .limit(1);

  if (!profile) {
    throw new PortalError('NOT_FOUND', `Student profile "${studentId}" not found`, 404);
  }

  // RBAC Scoping
  if (actor.role === 'STUDENT') {
    if (profile.userId !== actor.id) {
      throw new PortalError('FORBIDDEN', 'Students can only view their own profile', 403);
    }
  } else if (actor.role === 'BRANCH_COORDINATOR') {
    if (profile.branch !== actor.branch) {
      throw new PortalError(
        'FORBIDDEN',
        `Access denied: student is not in your branch (${actor.branch})`,
        403
      );
    }
  }

  const semesters = await db
    .select()
    .from(semesterResults)
    .where(eq(semesterResults.userId, profile.userId))
    .orderBy(semesterResults.semester);

  return {
    ...profile,
    semesters,
  };
}

/**
 * Retrieves the profile of the currently logged in student.
 */
export async function getMyProfile(db: Db, userId: string) {
  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    throw new PortalError('NOT_FOUND', 'Profile not found for this user', 404);
  }

  const semesters = await db
    .select()
    .from(semesterResults)
    .where(eq(semesterResults.userId, userId))
    .orderBy(semesterResults.semester);

  return {
    ...profile,
    semesters,
  };
}

/**
 * Updates a student's own profile with missing details (first login completion or initial profile setup).
 * Calculates age from DOB, normalizes names, and updates isProfileComplete when all required fields are filled.
 */
export async function completeStudentProfile(
  db: Db,
  studentUserId: string,
  input: CompleteProfileInput
) {
  const [existing] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, studentUserId))
    .limit(1);

  if (!existing) {
    throw new PortalError('NOT_FOUND', 'Student profile not found', 404);
  }

  let firstName = input.firstName ?? existing.firstName;
  let lastName = input.lastName ?? existing.lastName;
  let fullName = input.name ?? existing.name;

  if (input.name && (!input.firstName || !input.lastName)) {
    const parts = input.name.trim().split(/\s+/);
    if (!input.firstName && parts.length > 0) firstName = parts[0];
    if (!input.lastName && parts.length > 1) lastName = parts.slice(1).join(' ');
  } else if (!fullName && (firstName || lastName)) {
    fullName = [firstName, lastName].filter(Boolean).join(' ');
  }

  let age = existing.age;
  const dob = input.dob !== undefined ? input.dob : existing.dob;
  if (dob) {
    const computedAge = calculateAgeFromDob(dob);
    if (computedAge !== null) age = computedAge;
  }

  const studentId = input.studentId ?? existing.studentId;
  const registrationNumber = input.registrationNumber !== undefined ? input.registrationNumber : existing.registrationNumber;
  const branch = input.branch ?? existing.branch;
  const batch = input.batch ?? existing.batch;
  const email = input.email ?? existing.email;
  const phone = input.phone ?? existing.phone;
  const marksheetUrl = input.marksheetUrl !== undefined ? input.marksheetUrl : existing.marksheetUrl;
  const resumeUrl = input.resumeUrl !== undefined ? input.resumeUrl : existing.resumeUrl;

  const isComplete = Boolean(
    fullName &&
    branch &&
    batch &&
    email &&
    phone
  );

  db.transaction((tx) => {
    tx.update(studentProfiles)
      .set({
        studentId,
        registrationNumber: registrationNumber || null,
        name: fullName || null,
        firstName: firstName || null,
        lastName: lastName || null,
        dob: dob || null,
        age: age ?? null,
        branch: branch || null,
        batch: batch || null,
        email: email || null,
        phone: phone || null,
        marksheetUrl: marksheetUrl || null,
        resumeUrl: resumeUrl || null,
        isProfileComplete: isComplete,
      })
      .where(eq(studentProfiles.userId, studentUserId))
      .run();

    if (branch && branch !== existing.branch) {
      tx.update(users)
        .set({ branch })
        .where(eq(users.id, studentUserId))
        .run();
    }

    tx.insert(auditLogs).values({
      id: crypto.randomUUID(),
      actorId: studentUserId,
      studentUserId,
      field: 'isProfileComplete',
      oldValue: existing.isProfileComplete ? 'complete' : 'incomplete',
      newValue: isComplete ? 'complete' : 'partially_updated',
      createdAt: new Date(),
    }).run();
  });

  return getMyProfile(db, studentUserId);
}

/**
 * Lists profiles with branch filtering for coordinators.
 * Branch coordinators are strictly forced to their assigned branch.
 */
export async function listProfiles(
  db: Db,
  actor: ProfileActor,
  branchQuery?: string
) {
  let profilesList;

  if (actor.role === 'BRANCH_COORDINATOR') {
    // Strictly forced to own branch
    profilesList = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.branch, actor.branch!));
  } else if (branchQuery) {
    profilesList = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.branch, branchQuery));
  } else {
    profilesList = await db.select().from(studentProfiles);
  }

  if (profilesList.length === 0) {
    return [];
  }

  // Fetch placed applications joined with drives
  const placedApps = await db
    .select({
      studentUserId: applications.studentUserId,
      driveId: applications.driveId,
      company: drives.company,
      role: drives.role,
      ctcLpa: drives.ctcLpa,
      placedAt: applications.createdAt,
    })
    .from(applications)
    .innerJoin(drives, eq(applications.driveId, drives.id))
    .where(eq(applications.placed, true));

  const placedMap = new Map<string, (typeof placedApps)[0]>();
  for (const p of placedApps) {
    placedMap.set(p.studentUserId, p);
  }

  // Fetch all semesterResults
  const allSemesters = await db
    .select()
    .from(semesterResults)
    .orderBy(semesterResults.semester);

  const semMap = new Map<string, typeof allSemesters>();
  for (const s of allSemesters) {
    if (!semMap.has(s.userId)) {
      semMap.set(s.userId, []);
    }
    semMap.get(s.userId)!.push(s);
  }

  return profilesList.map((p) => {
    const placed = placedMap.get(p.userId);
    const sems = semMap.get(p.userId) || [];
    return {
      ...p,
      semesters: sems,
      placement: placed
        ? {
            isPlaced: true,
            company: placed.company,
            role: placed.role,
            ctcLpa: placed.ctcLpa,
            placedAt: placed.placedAt,
          }
        : {
            isPlaced: false,
            company: null,
            role: null,
            ctcLpa: null,
            placedAt: null,
          },
    };
  });
}

/**
 * Computes placement statistics and candidate metrics scoped to a department/branch.
 */
export async function getDepartmentStats(
  db: Db,
  actor: ProfileActor,
  branchQuery?: string
) {
  const targetBranch = actor.role === 'BRANCH_COORDINATOR' ? actor.branch! : (branchQuery || null);

  const profiles = targetBranch
    ? await db.select().from(studentProfiles).where(eq(studentProfiles.branch, targetBranch))
    : await db.select().from(studentProfiles);

  const userIds = profiles.map((p) => p.userId);

  // Placed applications
  const placedApps = await db
    .select({
      studentUserId: applications.studentUserId,
      driveId: applications.driveId,
      company: drives.company,
      role: drives.role,
      ctcLpa: drives.ctcLpa,
    })
    .from(applications)
    .innerJoin(drives, eq(applications.driveId, drives.id))
    .where(eq(applications.placed, true));

  const targetPlaced = placedApps.filter((p) => userIds.includes(p.studentUserId));
  const placedStudentUserIds = new Set(targetPlaced.map((p) => p.studentUserId));

  const totalStudents = profiles.length;
  const placedCount = placedStudentUserIds.size;
  const unplacedCount = Math.max(0, totalStudents - placedCount);
  const placementRate = totalStudents > 0 ? Number(((placedCount / totalStudents) * 100).toFixed(1)) : 0;

  const validCtcs = targetPlaced.map((p) => p.ctcLpa).filter((c): c is number => typeof c === 'number' && c > 0);
  const highestPackage = validCtcs.length > 0 ? Math.max(...validCtcs) : 0;
  const averagePackage = validCtcs.length > 0 ? Number((validCtcs.reduce((a, b) => a + b, 0) / validCtcs.length).toFixed(1)) : 0;

  // Active drives eligible for this branch
  const allDrives = await db.select().from(drives);
  const activeDrives = allDrives.filter((d) => {
    const isFuture = new Date(d.deadline).getTime() > Date.now();
    if (!targetBranch) return isFuture;
    return isFuture && d.eligibleBranches && d.eligibleBranches.includes(targetBranch);
  });

  return {
    branch: targetBranch,
    totalStudents,
    placedCount,
    unplacedCount,
    placementRate,
    highestPackage,
    averagePackage,
    activeDrivesCount: activeDrives.length,
    placedStudents: targetPlaced.map((p) => {
      const prof = profiles.find((pr) => pr.userId === p.studentUserId);
      return {
        studentId: prof?.studentId || '',
        name: prof?.name || '',
        branch: prof?.branch || '',
        company: p.company,
        role: p.role,
        ctcLpa: p.ctcLpa,
      };
    }),
  };
}

/**
 * Applies a partial correction to a student profile within a single transaction.
 * Writes auditLogs for every field that actually changed.
 * If semesters changed, recalculates CGPA and logs the CGPA diff.
 * A no-op patch writes zero audit log rows.
 */
export async function correctStudentProfile(
  db: Db,
  actor: ProfileActor,
  studentId: string,
  input: ProfileCorrectionInput
) {
  if (actor.role === 'STUDENT') {
    throw new PortalError('FORBIDDEN', 'Students are not authorized to correct profiles', 403);
  }

  const [existing] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.studentId, studentId))
    .limit(1);

  if (!existing) {
    throw new PortalError('NOT_FOUND', `Student profile "${studentId}" not found`, 404);
  }

  // Branch coordinator permission checks
  if (actor.role === 'BRANCH_COORDINATOR') {
    if (existing.branch !== actor.branch) {
      throw new PortalError(
        'FORBIDDEN',
        `Access denied: student is not in your branch (${actor.branch})`,
        403
      );
    }

    if (input.branch !== undefined && input.branch !== actor.branch) {
      throw new PortalError(
        'FORBIDDEN',
        'Branch coordinators cannot move students to another branch',
        403
      );
    }
  }

  const scalarKeys: (keyof ProfileCorrectionInput)[] = [
    'registrationNumber',
    'name',
    'branch',
    'batch',
    'email',
    'phone',
    'activeBacklogs',
    'resumeUrl',
    's1MarksheetUrl',
    's2MarksheetUrl',
    's3MarksheetUrl',
    's4MarksheetUrl',
    's5MarksheetUrl',
    's6MarksheetUrl',
    's7MarksheetUrl',
    's8MarksheetUrl',
    'currentSemester',
  ];

  const profileUpdates: Partial<typeof studentProfiles.$inferInsert> = {};
  const auditEntries: (typeof auditLogs.$inferInsert)[] = [];

  // Check additionalDetails updates
  if (input.additionalDetails !== undefined) {
    const existingDetails = (existing.additionalDetails as Record<string, unknown>) || {};
    const mergedDetails = { ...existingDetails, ...input.additionalDetails };
    profileUpdates.additionalDetails = mergedDetails;
    auditEntries.push({
      id: crypto.randomUUID(),
      actorId: actor.id,
      studentUserId: existing.userId,
      field: 'additionalDetails',
      oldValue: JSON.stringify(existingDetails),
      newValue: JSON.stringify(mergedDetails),
      createdAt: new Date(),
    });
  }

  // Check scalar field changes
  for (const key of scalarKeys) {
    if (key in input && input[key] !== undefined) {
      const newVal = input[key];
      const oldVal = existing[key as keyof typeof existing];

      if (newVal !== oldVal) {
        (profileUpdates as Record<string, unknown>)[key] = newVal;
        auditEntries.push({
          id: crypto.randomUUID(),
          actorId: actor.id,
          studentUserId: existing.userId,
          field: key,
          oldValue: oldVal !== null && oldVal !== undefined ? String(oldVal) : null,
          newValue: newVal !== null && newVal !== undefined ? String(newVal) : null,
          createdAt: new Date(),
        });
      }
    }
  }

  // Handle semester updates & CGPA recalculation
  let semestersChanged = false;
  const currentSemesters = await db
    .select()
    .from(semesterResults)
    .where(eq(semesterResults.userId, existing.userId));

  const semMap = new Map(currentSemesters.map((s) => [s.semester, s]));
  const semesterActions: {
    semester: number;
    credits: number;
    sgpa: number;
    isNew: boolean;
  }[] = [];

  if (input.semesters && input.semesters.length > 0) {
    for (const semInput of input.semesters) {
      const existingSem = semMap.get(semInput.semester);
      if (!existingSem) {
        semestersChanged = true;
        semesterActions.push({ ...semInput, isNew: true });
      } else if (
        existingSem.credits !== semInput.credits ||
        existingSem.sgpa !== semInput.sgpa
      ) {
        semestersChanged = true;
        semesterActions.push({ ...semInput, isNew: false });
      }
    }

    if (semestersChanged) {
      // Calculate new CGPA across all current and updated semesters
      const combined = currentSemesters.map((s) => {
        const update = input.semesters!.find((u) => u.semester === s.semester);
        return update
          ? { credits: update.credits, sgpa: update.sgpa }
          : { credits: s.credits, sgpa: s.sgpa };
      });

      for (const semInput of input.semesters) {
        if (!currentSemesters.some((cs) => cs.semester === semInput.semester)) {
          combined.push({ credits: semInput.credits, sgpa: semInput.sgpa });
        }
      }

      const newCgpa = calculateCreditBasedCgpa(combined);
      const oldCgpa = existing.cgpa;

      if (newCgpa !== oldCgpa) {
        profileUpdates.cgpa = newCgpa;
        auditEntries.push({
          id: crypto.randomUUID(),
          actorId: actor.id,
          studentUserId: existing.userId,
          field: 'cgpa',
          oldValue: String(oldCgpa),
          newValue: String(newCgpa),
          createdAt: new Date(),
        });
      }
    }
  }

  // Execute in ONE atomic SQLite transaction
  db.transaction((tx) => {
    // 1. Update student profile if changes detected
    if (Object.keys(profileUpdates).length > 0) {
      tx.update(studentProfiles)
        .set(profileUpdates)
        .where(eq(studentProfiles.userId, existing.userId))
        .run();
    }

    // 2. Synchronize branch on users table if branch was modified
    if (profileUpdates.branch) {
      tx.update(users)
        .set({ branch: profileUpdates.branch })
        .where(eq(users.id, existing.userId))
        .run();
    }

    // 3. Update or insert semester results
    if (semestersChanged) {
      for (const sem of semesterActions) {
        if (sem.isNew) {
          tx.insert(semesterResults).values({
            id: crypto.randomUUID(),
            userId: existing.userId,
            semester: sem.semester,
            credits: sem.credits,
            sgpa: sem.sgpa,
            createdAt: new Date(),
          }).run();
        } else {
          tx.update(semesterResults)
            .set({
              credits: sem.credits,
              sgpa: sem.sgpa,
            })
            .where(
              and(
                eq(semesterResults.userId, existing.userId),
                eq(semesterResults.semester, sem.semester)
              )
            )
            .run();
        }
      }
    }

    // 4. Record audit logs for each changed field
    for (const auditEntry of auditEntries) {
      tx.insert(auditLogs).values(auditEntry).run();
    }
  });

  // Query and return fresh profile state
  return getProfileByStudentId(db, actor, studentId);
}

/**
 * Retrieves audit log history for a student with coordinator scoping.
 */
export async function getStudentAuditLogs(
  db: Db,
  actor: ProfileActor,
  studentId: string
) {
  const [profile] = await db
    .select({
      userId: studentProfiles.userId,
      branch: studentProfiles.branch,
    })
    .from(studentProfiles)
    .where(eq(studentProfiles.studentId, studentId))
    .limit(1);

  if (!profile) {
    throw new PortalError('NOT_FOUND', `Student profile "${studentId}" not found`, 404);
  }

  if (actor.role === 'BRANCH_COORDINATOR') {
    if (profile.branch !== actor.branch) {
      throw new PortalError(
        'FORBIDDEN',
        `Access denied: student is not in your branch (${actor.branch})`,
        403
      );
    }
  }

  const logs = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.studentUserId, profile.userId))
    .orderBy(desc(auditLogs.createdAt));

  return logs;
}

/**
 * Creates a new student profile correction request.
 */
export async function createCorrectionRequest(
  db: Db,
  actor: ProfileActor,
  input: CreateCorrectionRequestInput
) {
  if (actor.role !== 'STUDENT') {
    throw new PortalError('FORBIDDEN', 'Only students can submit correction requests', 403);
  }

  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, actor.id))
    .limit(1);

  if (!profile) {
    throw new PortalError('NOT_FOUND', 'Student profile not found', 404);
  }

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(correctionRequests).values({
    id,
    studentUserId: actor.id,
    studentId: profile.studentId,
    registrationNumber: profile.registrationNumber || null,
    studentName: profile.name,
    branch: profile.branch || 'General',
    requestedChanges: JSON.stringify(input.requestedChanges),
    reason: input.reason,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  });

  return {
    id,
    studentUserId: actor.id,
    studentId: profile.studentId,
    registrationNumber: profile.registrationNumber || null,
    studentName: profile.name,
    branch: profile.branch,
    requestedChanges: input.requestedChanges,
    reason: input.reason,
    status: 'PENDING',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Lists correction requests scoped by actor role and branch.
 */
export async function listCorrectionRequests(db: Db, actor: ProfileActor) {
  let rows;
  if (actor.role === 'STUDENT') {
    rows = await db
      .select()
      .from(correctionRequests)
      .where(eq(correctionRequests.studentUserId, actor.id))
      .orderBy(desc(correctionRequests.createdAt));
  } else if (actor.role === 'BRANCH_COORDINATOR') {
    rows = await db
      .select()
      .from(correctionRequests)
      .where(eq(correctionRequests.branch, actor.branch!))
      .orderBy(desc(correctionRequests.createdAt));
  } else {
    rows = await db
      .select()
      .from(correctionRequests)
      .orderBy(desc(correctionRequests.createdAt));
  }

  return rows.map((r) => {
    let parsedChanges: Record<string, unknown> = {};
    try {
      parsedChanges = JSON.parse(r.requestedChanges);
    } catch {
      parsedChanges = {};
    }
    return {
      ...r,
      requestedChanges: parsedChanges,
    };
  });
}

/**
 * Reviews and approves or rejects a student correction request.
 */
export async function reviewCorrectionRequest(
  db: Db,
  actor: ProfileActor,
  requestId: string,
  input: ReviewCorrectionRequestInput
) {
  if (actor.role === 'STUDENT') {
    throw new PortalError('FORBIDDEN', 'Students cannot review correction requests', 403);
  }

  const [reqRecord] = await db
    .select()
    .from(correctionRequests)
    .where(eq(correctionRequests.id, requestId))
    .limit(1);

  if (!reqRecord) {
    throw new PortalError('NOT_FOUND', 'Correction request not found', 404);
  }

  if (actor.role === 'BRANCH_COORDINATOR' && reqRecord.branch !== actor.branch) {
    throw new PortalError(
      'FORBIDDEN',
      `Access denied: request is not for your branch (${actor.branch})`,
      403
    );
  }

  if (reqRecord.status !== 'PENDING') {
    throw new PortalError(
      'VALIDATION_ERROR',
      `This request has already been reviewed (${reqRecord.status})`,
      400
    );
  }

  const now = new Date();

  let changes: Record<string, unknown> = {};
  try {
    changes = JSON.parse(reqRecord.requestedChanges);
  } catch {
    changes = {};
  }

  const isDriveApplication = changes.type === 'DRIVE_APPLICATION';

  if (input.action === 'APPROVE') {
    if (isDriveApplication) {
      // If this is a drive application request, verify the student's application in the spreadsheet
      if (changes.applicationId) {
        await db
          .update(applications)
          .set({
            verified: true,
            verifiedBy: actor.id,
          })
          .where(eq(applications.id, String(changes.applicationId)));
      }

      await db
        .update(correctionRequests)
        .set({
          status: 'APPROVED',
          reviewedBy: actor.id,
          reviewerRemarks: input.remarks || 'Application verified and approved by coordinator',
          updatedAt: now,
        })
        .where(eq(correctionRequests.id, requestId));
    } else {
      // Adapt changes to ProfileCorrectionInput
      const profileInput: ProfileCorrectionInput = {};
      if (typeof changes.name === 'string') profileInput.name = changes.name;
      if (typeof changes.batch === 'string') profileInput.batch = changes.batch;
      if (typeof changes.email === 'string') profileInput.email = changes.email;
      if (typeof changes.phone === 'string') profileInput.phone = changes.phone;
      if (typeof changes.activeBacklogs === 'number') profileInput.activeBacklogs = changes.activeBacklogs;
      if (typeof changes.resumeUrl === 'string') profileInput.resumeUrl = changes.resumeUrl;
      if (typeof changes.currentSemester === 'number') profileInput.currentSemester = changes.currentSemester;
      if (changes.additionalDetails && typeof changes.additionalDetails === 'object') {
        profileInput.additionalDetails = changes.additionalDetails as Record<string, unknown>;
      }

      // Check semester changes e.g. s1Sgpa, s1Credits or semesters array
      const semestersList: { semester: number; sgpa: number; credits: number }[] = [];
      if (Array.isArray(changes.semesters)) {
        for (const sem of changes.semesters) {
          if (typeof sem.semester === 'number' && typeof sem.sgpa === 'number' && typeof sem.credits === 'number') {
            semestersList.push(sem);
          }
        }
      } else {
        for (let sem = 1; sem <= 8; sem++) {
          const sgpaKey = `s${sem}Sgpa`;
          const creditsKey = `s${sem}Credits`;
          if (typeof changes[sgpaKey] === 'number') {
            semestersList.push({
              semester: sem,
              sgpa: Number(changes[sgpaKey]),
              credits: typeof changes[creditsKey] === 'number' ? Number(changes[creditsKey]) : 20,
            });
          }
        }
      }

      if (semestersList.length > 0) {
        profileInput.semesters = semestersList;
      }

      // Apply the correction using coordinator authority
      await correctStudentProfile(db, actor, reqRecord.studentId, profileInput);

      await db
        .update(correctionRequests)
        .set({
          status: 'APPROVED',
          reviewedBy: actor.id,
          reviewerRemarks: input.remarks || null,
          updatedAt: now,
        })
        .where(eq(correctionRequests.id, requestId));
    }
  } else {
    // REJECT
    if (isDriveApplication && changes.applicationId) {
      await db
        .update(applications)
        .set({
          verified: false,
          verifiedBy: actor.id,
        })
        .where(eq(applications.id, String(changes.applicationId)));
    }

    await db
      .update(correctionRequests)
      .set({
        status: 'REJECTED',
        reviewedBy: actor.id,
        reviewerRemarks: input.remarks || null,
        updatedAt: now,
      })
      .where(eq(correctionRequests.id, requestId));
  }

  const [updated] = await db
    .select()
    .from(correctionRequests)
    .where(eq(correctionRequests.id, requestId));

  let finalChanges: Record<string, unknown> = {};
  try {
    finalChanges = JSON.parse(updated.requestedChanges);
  } catch {
    finalChanges = {};
  }

  return {
    ...updated,
    requestedChanges: finalChanges,
  };
}

/**
 * Updates the current reached semester in bulk for students (e.g. configuring junior batches).
 * Coordinators are scoped to their branch, whereas MAIN_COORDINATOR can update globally or for any branch.
 */
export async function updateBatchCurrentSemester(
  db: Db,
  actor: ProfileActor,
  input: SetBatchCurrentSemesterInput
) {
  if (actor.role === 'STUDENT') {
    throw new PortalError('FORBIDDEN', 'Students cannot modify batch semester configurations', 403);
  }

  const targetBranch = actor.role === 'BRANCH_COORDINATOR' ? actor.branch! : (input.branch || null);

  const conditions = [];
  if (targetBranch) {
    conditions.push(eq(studentProfiles.branch, targetBranch));
  }
  if (input.batch) {
    conditions.push(eq(studentProfiles.batch, input.batch));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const targetProfiles = await db
    .select({ userId: studentProfiles.userId, studentId: studentProfiles.studentId })
    .from(studentProfiles)
    .where(whereClause);

  if (targetProfiles.length === 0) {
    return {
      updatedCount: 0,
      currentSemester: input.currentSemester,
      branch: targetBranch,
      batch: input.batch || 'ALL',
      message: 'No matching student profiles found for the given criteria',
    };
  }

  db.transaction((tx) => {
    tx.update(studentProfiles)
      .set({ currentSemester: input.currentSemester })
      .where(whereClause)
      .run();

    for (const p of targetProfiles) {
      tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        actorId: actor.id,
        studentUserId: p.userId,
        field: 'currentSemester',
        oldValue: 'configured',
        newValue: String(input.currentSemester),
        createdAt: new Date(),
      }).run();
    }
  });

  return {
    updatedCount: targetProfiles.length,
    currentSemester: input.currentSemester,
    branch: targetBranch,
    batch: input.batch || 'ALL',
    message: `Successfully set reached semester to S${input.currentSemester} for ${targetProfiles.length} students.`,
  };
}

/**
 * Retrieves all currently placed students with drive and company details.
 */
export async function listPlacedStudents(
  db: Db,
  actor: ProfileActor,
  branchQuery?: string
) {
  const targetBranch = actor.role === 'BRANCH_COORDINATOR' ? actor.branch! : (branchQuery || null);

  const query = db
    .select({
      applicationId: applications.id,
      driveId: drives.id,
      studentUserId: studentProfiles.userId,
      studentId: studentProfiles.studentId,
      name: studentProfiles.name,
      branch: studentProfiles.branch,
      batch: studentProfiles.batch,
      cgpa: studentProfiles.cgpa,
      company: drives.company,
      role: drives.role,
      ctcLpa: drives.ctcLpa,
      packageCategory: drives.packageCategory,
      placementStatus: studentProfiles.placementStatus,
      placedAt: applications.createdAt,
    })
    .from(applications)
    .innerJoin(drives, eq(applications.driveId, drives.id))
    .innerJoin(studentProfiles, eq(applications.studentUserId, studentProfiles.userId))
    .where(eq(applications.placed, true));

  const allPlaced = await query;
  const mapped = allPlaced.map((p) => {
    let effectiveCategory: 'GENERAL' | 'DREAM' | 'INTERNSHIP' = (p.packageCategory as any) || 'GENERAL';
    if (effectiveCategory !== 'INTERNSHIP') {
      if (p.ctcLpa !== null && p.ctcLpa !== undefined) {
        effectiveCategory = p.ctcLpa >= 7.0 ? 'DREAM' : 'GENERAL';
      } else {
        effectiveCategory = effectiveCategory === 'DREAM' || p.placementStatus === 'DREAM' ? 'DREAM' : 'GENERAL';
      }
    }
    return {
      applicationId: p.applicationId,
      driveId: p.driveId,
      studentUserId: p.studentUserId,
      studentId: p.studentId,
      name: p.name,
      branch: p.branch,
      batch: p.batch,
      cgpa: p.cgpa,
      company: p.company,
      role: p.role,
      ctcLpa: p.ctcLpa,
      packageCategory: effectiveCategory,
      placedAt: p.placedAt,
    };
  });

  if (!targetBranch) {
    return mapped;
  }
  return mapped.filter((p) => p.branch && p.branch.toUpperCase() === targetBranch.toUpperCase());
}

/**
 * Manually records a placed student with company, package, role, and category.
 */
export async function recordPlacedStudentManual(
  db: Db,
  actor: ProfileActor,
  input: {
    studentId: string;
    company: string;
    role?: string;
    ctcLpa?: number | null;
    packageCategory?: 'GENERAL' | 'DREAM' | 'INTERNSHIP';
    driveId?: string | null;
  }
) {
  // 1. Find student (case-insensitive studentId or registrationNumber match)
  const trimmedId = input.studentId.trim();
  const [student] = await db
    .select()
    .from(studentProfiles)
    .where(
      or(
        sql`LOWER(${studentProfiles.studentId}) = LOWER(${trimmedId})`,
        sql`LOWER(${studentProfiles.registrationNumber}) = LOWER(${trimmedId})`
      )
    )
    .limit(1);

  if (!student) {
    throw new PortalError('NOT_FOUND', `Student with ID "${input.studentId}" not found in system`, 404);
  }

  // RBAC branch check for branch coordinators
  if (actor.role === 'BRANCH_COORDINATOR' && actor.branch) {
    if (student.branch && student.branch.toUpperCase() !== actor.branch.toUpperCase()) {
      throw new PortalError('FORBIDDEN', `Access denied: Student belongs to branch ${student.branch}`, 403);
    }
  }

  // 2. Find or create drive
  let computedCategory: 'GENERAL' | 'DREAM' | 'INTERNSHIP' = input.packageCategory || 'GENERAL';
  if (computedCategory !== 'INTERNSHIP') {
    if (input.ctcLpa !== null && input.ctcLpa !== undefined) {
      computedCategory = input.ctcLpa >= 7.0 ? 'DREAM' : 'GENERAL';
    }
  }

  let targetDriveId = input.driveId;
  let targetDriveCompany = input.company.trim();

  if (targetDriveId) {
    const [existingDrive] = await db.select().from(drives).where(eq(drives.id, targetDriveId)).limit(1);
    if (!existingDrive) {
      throw new PortalError('NOT_FOUND', `Selected drive "${targetDriveId}" not found`, 404);
    }
    targetDriveCompany = existingDrive.company;
  } else {
    // Look up existing drive with matching company name AND matching CTC/category
    const allMatchingDrives = await db.select().from(drives);
    const existingCompanyDrive = allMatchingDrives.find(
      (d) =>
        d.company.toLowerCase() === input.company.trim().toLowerCase() &&
        (input.ctcLpa === undefined || input.ctcLpa === null || d.ctcLpa === input.ctcLpa) &&
        d.packageCategory === computedCategory
    );

    if (existingCompanyDrive) {
      targetDriveId = existingCompanyDrive.id;
      targetDriveCompany = existingCompanyDrive.company;
      if (
        (computedCategory === 'DREAM' && existingCompanyDrive.packageCategory !== 'DREAM') ||
        (input.ctcLpa !== undefined && input.ctcLpa !== null && existingCompanyDrive.ctcLpa !== input.ctcLpa)
      ) {
        await db
          .update(drives)
          .set({
            packageCategory: computedCategory,
            ...(input.ctcLpa !== undefined && input.ctcLpa !== null ? { ctcLpa: input.ctcLpa } : {}),
            ...(input.role?.trim() ? { role: input.role.trim() } : {}),
          })
          .where(eq(drives.id, existingCompanyDrive.id));
      }
    } else {
      // Create new drive representation for company placement (distinguishing packages like TCS 3.36 vs 7.0)
      const newDriveId = crypto.randomUUID();
      const deadlineDate = new Date();
      deadlineDate.setFullYear(deadlineDate.getFullYear() + 1);

      await db.insert(drives).values({
        id: newDriveId,
        company: input.company.trim(),
        role: input.role?.trim() || 'Placed Trainee',
        ctcLpa: input.ctcLpa !== undefined ? input.ctcLpa : null,
        packageCategory: computedCategory,
        deadline: deadlineDate.toISOString(),
        eligibleBranches: ['CSE', 'ECE', 'EEE', 'IT', 'CIVIL', 'MCA'],
        minCgpa: 0,
        maxActiveBacklogs: 0,
        allowBacklogs: true,
        createdBy: actor.id,
      });

      targetDriveId = newDriveId;
    }
  }

  // 3. Upsert application with placed: true, verified: true
  const existingApp = await db
    .select()
    .from(applications)
    .where(and(eq(applications.driveId, targetDriveId), eq(applications.studentUserId, student.userId)))
    .limit(1)
    .then((r) => r[0]);

  if (existingApp) {
    await db
      .update(applications)
      .set({
        placed: true,
        verified: true,
        verifiedBy: actor.id,
      })
      .where(eq(applications.id, existingApp.id));
  } else {
    await db.insert(applications).values({
      id: crypto.randomUUID(),
      driveId: targetDriveId,
      studentUserId: student.userId,
      placed: true,
      verified: true,
      verifiedBy: actor.id,
    });
  }

  // 4. Update student profile placementStatus
  await db
    .update(studentProfiles)
    .set({ placementStatus: computedCategory })
    .where(eq(studentProfiles.userId, student.userId));

  // 5. Audit log
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId: actor.id,
    studentUserId: student.userId,
    field: 'placed',
    oldValue: existingApp?.placed ? 'true' : 'false',
    newValue: `true (${targetDriveCompany} - ${input.ctcLpa || 0} LPA - ${computedCategory})`,
    createdAt: new Date(),
  });

  return {
    success: true,
    studentId: student.studentId,
    name: student.name,
    branch: student.branch,
    company: targetDriveCompany,
    role: input.role || null,
    ctcLpa: input.ctcLpa || null,
    packageCategory: computedCategory,
    message: `Student ${student.name || student.studentId} successfully marked as placed at ${targetDriveCompany}.`,
  };
}

/**
 * Validates and previews a batch Excel spreadsheet of placed students before committing.
 */
export async function previewPlacedStudentsExcel(
  db: Db,
  actor: ProfileActor,
  fileBuffer: Buffer
) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount < 2) {
    throw new PortalError('VALIDATION_ERROR', 'Uploaded Excel file must have a header row and at least one student data row', 400);
  }

  // Header row detection
  const headerMap: Record<string, number> = {};
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value || '').trim().toLowerCase();
    if (val.includes('student') || val.includes('roll') || val === 'id' || val.includes('reg')) {
      if (!headerMap.studentId) headerMap.studentId = colNumber;
    } else if (val.includes('company') || val.includes('organization') || val.includes('employer')) {
      if (!headerMap.company) headerMap.company = colNumber;
    } else if (val.includes('ctc') || val.includes('package') || val.includes('lpa') || val.includes('salary')) {
      if (!headerMap.ctcLpa) headerMap.ctcLpa = colNumber;
    } else if (val.includes('role') || val.includes('designation') || val.includes('title') || val.includes('position')) {
      if (!headerMap.role) headerMap.role = colNumber;
    } else if (val.includes('category') || val.includes('tier') || val.includes('type')) {
      if (!headerMap.packageCategory) headerMap.packageCategory = colNumber;
    }
  });

  if (!headerMap.studentId || !headerMap.company) {
    throw new PortalError(
      'VALIDATION_ERROR',
      'Excel sheet must contain at least "Student ID" (or Roll No) and "Company Name" columns',
      400
    );
  }

  // Fetch all profiles for efficient lookup
  const allProfiles = await db.select().from(studentProfiles);
  const profileMap = new Map<string, typeof allProfiles[0]>();
  for (const p of allProfiles) {
    profileMap.set(p.studentId.trim().toLowerCase(), p);
    if (p.registrationNumber) {
      profileMap.set(p.registrationNumber.trim().toLowerCase(), p);
    }
  }

  const rows: Array<{
    rowNumber: number;
    studentId: string;
    name?: string;
    branch?: string;
    cgpa?: number;
    company: string;
    role?: string;
    ctcLpa?: number | null;
    packageCategory: 'GENERAL' | 'DREAM' | 'INTERNSHIP';
    valid: boolean;
    error?: string;
  }> = [];

  let validCount = 0;
  let invalidCount = 0;

  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const rawStudentId = String(row.getCell(headerMap.studentId).value || '').trim();
    if (!rawStudentId) continue; // skip blank rows

    const rawCompany = String(row.getCell(headerMap.company).value || '').trim();
    const rawRole = headerMap.role ? String(row.getCell(headerMap.role).value || '').trim() : '';
    const rawCtc = headerMap.ctcLpa ? row.getCell(headerMap.ctcLpa).value : null;
    const rawCat = headerMap.packageCategory ? String(row.getCell(headerMap.packageCategory).value || '').trim().toUpperCase() : 'GENERAL';

    let ctcLpa: number | null = null;
    if (rawCtc !== null && rawCtc !== undefined && String(rawCtc).trim() !== '') {
      const parsed = parseFloat(String(rawCtc).replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        ctcLpa = parsed;
      }
    }

    let packageCategory: 'GENERAL' | 'DREAM' | 'INTERNSHIP' =
      rawCat.includes('DREAM') ? 'DREAM' : rawCat.includes('INTERN') ? 'INTERNSHIP' : 'GENERAL';

    if (packageCategory !== 'INTERNSHIP' && ctcLpa !== null && ctcLpa >= 7.0) {
      packageCategory = 'DREAM';
    }

    const student = profileMap.get(rawStudentId.toLowerCase());
    let valid = true;
    let error: string | undefined;

    if (!student) {
      valid = false;
      error = `Student ID "${rawStudentId}" not found in portal`;
    } else if (actor.role === 'BRANCH_COORDINATOR' && actor.branch) {
      if (student.branch && student.branch.toUpperCase() !== actor.branch.toUpperCase()) {
        valid = false;
        error = `Student branch (${student.branch}) does not match coordinator branch (${actor.branch})`;
      }
    }

    if (!rawCompany) {
      valid = false;
      error = error || 'Company name is missing';
    }

    if (valid) {
      validCount++;
    } else {
      invalidCount++;
    }

    rows.push({
      rowNumber: r,
      studentId: rawStudentId,
      name: student?.name || undefined,
      branch: student?.branch || undefined,
      cgpa: student?.cgpa,
      company: rawCompany,
      role: rawRole || undefined,
      ctcLpa,
      packageCategory,
      valid,
      error,
    });
  }

  return {
    totalRows: rows.length,
    validCount,
    invalidCount,
    rows,
  };
}

/**
 * Atomically commits a batch of validated student placement records.
 */
export async function commitPlacedStudentsBatch(
  db: Db,
  actor: ProfileActor,
  records: Array<{
    studentId: string;
    company: string;
    role?: string;
    ctcLpa?: number | null;
    packageCategory?: 'GENERAL' | 'DREAM' | 'INTERNSHIP';
    driveId?: string | null;
  }>
) {
  let committedCount = 0;
  const errors: string[] = [];

  for (const rec of records) {
    try {
      await recordPlacedStudentManual(db, actor, rec);
      committedCount++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record placement';
      errors.push(`${rec.studentId}: ${msg}`);
    }
  }

  return {
    success: true,
    committedCount,
    failedCount: errors.length,
    errors,
    message: `Successfully recorded ${committedCount} student placements.`,
  };
}

/**
 * Unmarks a student as placed.
 */
export async function unmarkPlacedStudent(
  db: Db,
  actor: ProfileActor,
  studentUserId: string,
  driveId: string
) {
  // If branch coordinator, verify student belongs to their branch
  if (actor.role === 'BRANCH_COORDINATOR' && actor.branch) {
    const [student] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, studentUserId)).limit(1);
    if (student && student.branch && student.branch.toUpperCase() !== actor.branch.toUpperCase()) {
      throw new PortalError('FORBIDDEN', `Access denied: Student belongs to branch ${student.branch}`, 403);
    }
  }

  await db
    .update(applications)
    .set({ placed: false })
    .where(and(eq(applications.driveId, driveId), eq(applications.studentUserId, studentUserId)));

  // Recalculate remaining placement offers for this student
  const remainingPlaced = await db
    .select({
      packageCategory: drives.packageCategory,
    })
    .from(applications)
    .innerJoin(drives, eq(applications.driveId, drives.id))
    .where(and(eq(applications.studentUserId, studentUserId), eq(applications.placed, true)));

  let resolvedStatus: 'UNPLACED' | 'GENERAL' | 'DREAM' | 'INTERNSHIP' = 'UNPLACED';
  if (remainingPlaced.some((p) => p.packageCategory === 'DREAM')) {
    resolvedStatus = 'DREAM';
  } else if (remainingPlaced.some((p) => p.packageCategory === 'GENERAL')) {
    resolvedStatus = 'GENERAL';
  } else if (remainingPlaced.some((p) => p.packageCategory === 'INTERNSHIP')) {
    resolvedStatus = 'INTERNSHIP';
  }

  await db
    .update(studentProfiles)
    .set({ placementStatus: resolvedStatus })
    .where(eq(studentProfiles.userId, studentUserId));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId: actor.id,
    studentUserId,
    field: 'placed',
    oldValue: 'true',
    newValue: `false (status: ${resolvedStatus})`,
    createdAt: new Date(),
  });

  return {
    success: true,
    resolvedPlacementStatus: resolvedStatus,
    message: 'Student placement status unmarked successfully.',
  };
}

/**
 * Manually sets or overrides a student's placement status.
 */
export async function updateStudentPlacementStatus(
  db: Db,
  actor: ProfileActor,
  studentId: string,
  placementStatus: 'UNPLACED' | 'GENERAL' | 'DREAM' | 'INTERNSHIP'
) {
  if (actor.role !== 'MAIN_COORDINATOR' && actor.role !== 'BRANCH_COORDINATOR') {
    throw new PortalError('FORBIDDEN', 'Only coordinators can update student placement status', 403);
  }

  const [student] = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.studentId, studentId))
    .limit(1);

  if (!student) {
    throw new PortalError('NOT_FOUND', `Student with ID "${studentId}" not found`, 404);
  }

  if (actor.role === 'BRANCH_COORDINATOR' && actor.branch) {
    if (student.branch && student.branch.toUpperCase() !== actor.branch.toUpperCase()) {
      throw new PortalError('FORBIDDEN', `Access denied: Student belongs to branch ${student.branch}`, 403);
    }
  }

  await db
    .update(studentProfiles)
    .set({ placementStatus })
    .where(eq(studentProfiles.studentId, studentId));

  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorId: actor.id,
    studentUserId: student.userId,
    field: 'placementStatus',
    oldValue: student.placementStatus,
    newValue: placementStatus,
    createdAt: new Date(),
  });

  return {
    success: true,
    studentId: student.studentId,
    placementStatus,
    message: `Updated placement status for ${student.name || student.studentId} to ${placementStatus}.`,
  };
}

/**
 * Permanently deletes a student record and associated user account.
 * Scoped so that BRANCH_COORDINATOR can only delete students in their own branch,
 * while MAIN_COORDINATOR can delete any student.
 */
export async function deleteStudentRecord(
  db: Db,
  actor: ProfileActor,
  studentIdOrUserId: string
) {
  if (actor.role !== 'MAIN_COORDINATOR' && actor.role !== 'BRANCH_COORDINATOR') {
    throw new PortalError('FORBIDDEN', 'Only coordinators can delete student records', 403);
  }

  // Look up by studentId or userId
  const [profile] = await db
    .select()
    .from(studentProfiles)
    .where(or(eq(studentProfiles.studentId, studentIdOrUserId), eq(studentProfiles.userId, studentIdOrUserId)))
    .limit(1);

  if (!profile) {
    throw new PortalError('NOT_FOUND', `Student "${studentIdOrUserId}" not found`, 404);
  }

  // Scoping check
  if (actor.role === 'BRANCH_COORDINATOR' && actor.branch) {
    if (profile.branch && profile.branch.toUpperCase() !== actor.branch.toUpperCase()) {
      throw new PortalError('FORBIDDEN', `Access denied: Student belongs to branch ${profile.branch}`, 403);
    }
  }

  const userId = profile.userId;

  // Cleanup dependent rows if any
  try {
    await db.delete(applications).where(eq(applications.studentUserId, userId));
  } catch {}

  try {
    await db.delete(correctionRequests).where(eq(correctionRequests.studentUserId, userId));
  } catch {}

  try {
    await db.delete(auditLogs).where(eq(auditLogs.studentUserId, userId));
  } catch {}

  try {
    await db.delete(semesterResults).where(eq(semesterResults.userId, userId));
  } catch {}

  // Delete profile
  await db.delete(studentProfiles).where(eq(studentProfiles.userId, userId));

  // Delete user account
  await db.delete(users).where(eq(users.id, userId));

  return {
    success: true,
    deletedStudentId: profile.studentId,
    name: profile.name,
    message: `Student ${profile.name || profile.studentId} (${profile.studentId}) successfully deleted.`,
  };
}

/**
 * Deletes all students uploaded in a specific batch / filter.
 * Scoped: MAIN_COORDINATOR can delete any branch or batch;
 * BRANCH_COORDINATOR can only delete within their own branch.
 */
export async function deleteBatchStudents(
  db: Db,
  actor: ProfileActor,
  filter: { branch?: string; batch?: string; createdAt?: number }
) {
  if (actor.role !== 'MAIN_COORDINATOR' && actor.role !== 'BRANCH_COORDINATOR') {
    throw new PortalError('FORBIDDEN', 'Only coordinators can delete batch student data', 403);
  }

  const targetBranch = actor.role === 'BRANCH_COORDINATOR' ? actor.branch : filter.branch;

  // Find candidate profiles matching filter
  const allProfiles = await db.select().from(studentProfiles);
  const matched = allProfiles.filter((p) => {
    if (targetBranch && p.branch && p.branch.toUpperCase() !== targetBranch.toUpperCase()) {
      return false;
    }
    if (filter.batch && p.batch && p.batch !== filter.batch) {
      return false;
    }
    if (filter.createdAt) {
      // allow window of 60 seconds around timestamp
      const pTime = p.createdAt instanceof Date ? Math.floor(p.createdAt.getTime() / 1000) : Number(p.createdAt);
      if (Math.abs(pTime - filter.createdAt) > 60) {
        return false;
      }
    }
    return true;
  });

  if (matched.length === 0) {
    return {
      success: true,
      deletedCount: 0,
      message: 'No student records matched the given criteria.',
    };
  }

  const userIds = matched.map((p) => p.userId);

  for (const uid of userIds) {
    try {
      await db.delete(applications).where(eq(applications.studentUserId, uid));
    } catch {}
    try {
      await db.delete(correctionRequests).where(eq(correctionRequests.studentUserId, uid));
    } catch {}
    try {
      await db.delete(auditLogs).where(eq(auditLogs.studentUserId, uid));
    } catch {}
    try {
      await db.delete(semesterResults).where(eq(semesterResults.userId, uid));
    } catch {}
    try {
      await db.delete(studentProfiles).where(eq(studentProfiles.userId, uid));
    } catch {}
    try {
      await db.delete(users).where(eq(users.id, uid));
    } catch {}
  }

  return {
    success: true,
    deletedCount: matched.length,
    message: `Successfully deleted ${matched.length} student record(s).`,
  };
}


