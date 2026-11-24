/**
 * @fileoverview Student profile service handling retrieval, coordinator corrections, and audit logging.
 * @module server/modules/profiles/profiles.service
 */

import { eq, and, desc } from 'drizzle-orm';
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

