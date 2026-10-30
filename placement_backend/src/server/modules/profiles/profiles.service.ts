/**
 * @fileoverview Student profile service handling retrieval, coordinator corrections, and audit logging.
 * @module server/modules/profiles/profiles.service
 */

import { eq, and, desc } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { users, studentProfiles, semesterResults, auditLogs } from '@/core/db';
import { PortalError } from '@/core/errors/portal-error';
import { calculateCreditBasedCgpa } from '../cgpa/cgpa.service';
import type { ProfileCorrectionInput } from './profiles.schema';

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
 * Lists profiles with branch filtering for coordinators.
 * Branch coordinators are strictly forced to their assigned branch.
 */
export async function listProfiles(
  db: Db,
  actor: ProfileActor,
  branchQuery?: string
) {
  if (actor.role === 'BRANCH_COORDINATOR') {
    // Strictly forced to own branch
    return db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.branch, actor.branch!));
  }

  if (branchQuery) {
    return db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.branch, branchQuery));
  }

  return db.select().from(studentProfiles);
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
  ];

  const profileUpdates: Partial<typeof studentProfiles.$inferInsert> = {};
  const auditEntries: (typeof auditLogs.$inferInsert)[] = [];

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

