/**
 * @fileoverview CGPA calculation and database synchronization service.
 * @module server/modules/cgpa/cgpa.service
 */

import { eq } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { semesterResults, studentProfiles } from '@/core/db';
import { PortalError } from '@/core/errors/portal-error';

export interface SemesterCreditInput {
  credits: number;
  sgpa: number;
}

/**
 * Calculates credit-weighted Cumulative Grade Point Average (CGPA).
 *
 * Formula: CGPA = Σ(credits × sgpa) / Σ(credits), rounded to 2 decimals.
 *
 * @param semesters - Array of semester records containing credits and SGPA.
 * @returns Weighted CGPA rounded to 2 decimal places, or 0 if empty/zero credits.
 * @throws PortalError with code VALIDATION_ERROR if credits < 0 or sgpa outside 0-10.
 */
export function calculateCreditBasedCgpa(
  semesters: readonly SemesterCreditInput[]
): number {
  if (!semesters || semesters.length === 0) {
    return 0;
  }

  let totalCreditPoints = 0;
  let totalCredits = 0;

  for (const sem of semesters) {
    if (
      sem.credits < 0 ||
      sem.sgpa < 0 ||
      sem.sgpa > 10 ||
      Number.isNaN(sem.credits) ||
      Number.isNaN(sem.sgpa)
    ) {
      throw new PortalError(
        'VALIDATION_ERROR',
        `Invalid semester data: credits (${sem.credits}) must be >= 0 and SGPA (${sem.sgpa}) must be between 0 and 10`
      );
    }

    totalCreditPoints += sem.credits * sem.sgpa;
    totalCredits += sem.credits;
  }

  if (totalCredits === 0) {
    return 0;
  }

  const rawCgpa = totalCreditPoints / totalCredits;
  return Math.round((rawCgpa + Number.EPSILON) * 100) / 100;
}

/**
 * Reads all stored semester results for a student, recalculates their credit-based CGPA,
 * updates the student_profiles table, and returns the newly computed CGPA.
 *
 * @param db - The database instance.
 * @param userId - Unique student user identifier.
 * @returns The newly computed and stored CGPA.
 */
export async function recalculateAndStoreCgpa(
  db: Db,
  userId: string
): Promise<number> {
  const records = await db
    .select({
      credits: semesterResults.credits,
      sgpa: semesterResults.sgpa,
    })
    .from(semesterResults)
    .where(eq(semesterResults.userId, userId));

  const cgpa = calculateCreditBasedCgpa(records);

  await db
    .update(studentProfiles)
    .set({ cgpa })
    .where(eq(studentProfiles.userId, userId));

  return cgpa;
}

