/**
 * @fileoverview Branch semester credits curriculum service.
 * Allows branch coordinators and main coordinators to configure default credits per semester per branch.
 * @module server/modules/cgpa/branch-credits.service
 */

import { eq, and, sql } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { branchCredits, users, semesterResults, studentProfiles } from '@/core/db';
import { calculateCreditBasedCgpa } from './cgpa.service';
import { PortalError } from '@/core/errors/portal-error';

export interface SemesterCreditConfig {
  semester: number;
  credits: number;
}

export interface BranchCreditRecord {
  branch: string;
  semester: number;
  credits: number;
}

const DEFAULT_SEMESTER_CREDITS: readonly SemesterCreditConfig[] = [
  { semester: 1, credits: 20 },
  { semester: 2, credits: 22 },
  { semester: 3, credits: 24 },
  { semester: 4, credits: 22 },
  { semester: 5, credits: 20 },
  { semester: 6, credits: 18 },
  { semester: 7, credits: 16 },
  { semester: 8, credits: 16 },
];

/**
 * Returns configured credits for a specific branch.
 * If no custom credits have been configured for the branch, returns the standard curriculum defaults.
 */
export async function getBranchCredits(
  db: Db,
  branch?: string
): Promise<BranchCreditRecord[]> {
  if (branch) {
    const normalizedBranch = branch.trim().toUpperCase();
    const records = await db
      .select({
        branch: branchCredits.branch,
        semester: branchCredits.semester,
        credits: branchCredits.credits,
      })
      .from(branchCredits)
      .where(eq(branchCredits.branch, normalizedBranch))
      .orderBy(branchCredits.semester);

    if (records.length === 0) {
      return DEFAULT_SEMESTER_CREDITS.map((d) => ({
        branch: normalizedBranch,
        semester: d.semester,
        credits: d.credits,
      }));
    }

    // Fill in any missing semesters up to 8 with defaults
    const recordMap = new Map(records.map((r) => [r.semester, r.credits]));
    return DEFAULT_SEMESTER_CREDITS.map((d) => ({
      branch: normalizedBranch,
      semester: d.semester,
      credits: recordMap.has(d.semester) ? recordMap.get(d.semester)! : d.credits,
    }));
  }

  // If no branch specified (centralised query for admin)
  const allRecords = await db
    .select({
      branch: branchCredits.branch,
      semester: branchCredits.semester,
      credits: branchCredits.credits,
    })
    .from(branchCredits)
    .orderBy(branchCredits.branch, branchCredits.semester);

  return allRecords;
}

/**
 * Returns a fast Map lookup of semester number -> credits for a given branch.
 */
export async function getBranchCreditsMap(
  db: Db,
  branch: string
): Promise<Map<number, number>> {
  const records = await getBranchCredits(db, branch);
  const map = new Map<number, number>();
  for (const r of records) {
    map.set(r.semester, r.credits);
  }
  return map;
}

/**
 * Sets or updates credits per semester for a specific branch.
 * Can optionally recalculate CGPA for all students in that branch.
 */
export async function setBranchCredits(
  db: Db,
  branch: string,
  configs: SemesterCreditConfig[],
  recalculateStudents = false
): Promise<BranchCreditRecord[]> {
  const normalizedBranch = branch.trim().toUpperCase();

  if (!normalizedBranch) {
    throw new PortalError('VALIDATION_ERROR', 'Branch name is required');
  }

  // Save each semester credit config
  for (const cfg of configs) {
    if (cfg.semester < 1 || cfg.semester > 8) {
      throw new PortalError('VALIDATION_ERROR', `Invalid semester: ${cfg.semester}. Must be between 1 and 8.`);
    }
    if (cfg.credits < 0 || isNaN(cfg.credits)) {
      throw new PortalError('VALIDATION_ERROR', `Invalid credits: ${cfg.credits}. Must be >= 0.`);
    }

    const [existing] = await db
      .select()
      .from(branchCredits)
      .where(
        and(
          eq(branchCredits.branch, normalizedBranch),
          eq(branchCredits.semester, cfg.semester)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(branchCredits)
        .set({
          credits: cfg.credits,
          updatedAt: new Date(),
        })
        .where(eq(branchCredits.id, existing.id));
    } else {
      await db.insert(branchCredits).values({
        id: crypto.randomUUID(),
        branch: normalizedBranch,
        semester: cfg.semester,
        credits: cfg.credits,
        updatedAt: new Date(),
      });
    }
  }

  // Optional: recalculate CGPA for all existing students in this branch
  if (recalculateStudents) {
    await recalculateBranchStudentsCgpa(db, normalizedBranch);
  }

  return getBranchCredits(db, normalizedBranch);
}

/**
 * Recalculates CGPA for all students belonging to a branch using the newly set credits.
 */
export async function recalculateBranchStudentsCgpa(
  db: Db,
  branch: string
): Promise<number> {
  const normalizedBranch = branch.trim().toUpperCase();
  const branchCreditMap = await getBranchCreditsMap(db, normalizedBranch);

  // Find all student user IDs in this branch
  const branchStudents = await db
    .select({
      id: users.id,
    })
    .from(users)
    .where(
      and(
        eq(users.role, 'STUDENT'),
        eq(users.branch, normalizedBranch)
      )
    );

  let updatedCount = 0;

  for (const student of branchStudents) {
    // Read all semester results
    const sems = await db
      .select()
      .from(semesterResults)
      .where(eq(semesterResults.userId, student.id));

    if (sems.length === 0) continue;

    // Update semester results credits to match the branch curriculum
    for (const sem of sems) {
      const curriculumCredit = branchCreditMap.get(sem.semester) ?? sem.credits;
      if (curriculumCredit !== sem.credits) {
        await db
          .update(semesterResults)
          .set({ credits: curriculumCredit })
          .where(eq(semesterResults.id, sem.id));
      }
    }

    // Recalculate CGPA
    const updatedSems = await db
      .select({
        credits: semesterResults.credits,
        sgpa: semesterResults.sgpa,
      })
      .from(semesterResults)
      .where(eq(semesterResults.userId, student.id));

    const newCgpa = calculateCreditBasedCgpa(updatedSems);
    await db
      .update(studentProfiles)
      .set({ cgpa: newCgpa })
      .where(eq(studentProfiles.userId, student.id));

    updatedCount++;
  }

  return updatedCount;
}

