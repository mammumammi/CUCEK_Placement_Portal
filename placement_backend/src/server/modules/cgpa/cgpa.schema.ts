/**
 * @fileoverview Zod validation schemas for CGPA calculations.
 * @module server/modules/cgpa/cgpa.schema
 */

import { z } from 'zod';

export const semesterRecordSchema = z.object({
  semester: z.coerce.number().int().min(1, 'Semester must be at least 1').max(8, 'Semester cannot exceed 8'),
  credits: z.coerce.number().min(0, 'Credits must be non-negative'),
  sgpa: z.coerce.number().min(0, 'SGPA must be at least 0').max(10, 'SGPA cannot exceed 10'),
});

export const calculateCgpaSchema = z.object({
  semesters: z.array(semesterRecordSchema),
  activeBacklogs: z.coerce.number().int().min(0).optional().default(0),
});

export type SemesterRecordInput = z.infer<typeof semesterRecordSchema>;
export type CalculateCgpaInput = z.infer<typeof calculateCgpaSchema>;

export const setBranchCreditsSchema = z.object({
  branch: z.string().min(1, 'Branch name is required'),
  credits: z.array(
    z.object({
      semester: z.coerce.number().int().min(1, 'Semester must be between 1 and 8').max(8, 'Semester must be between 1 and 8'),
      credits: z.coerce.number().int('Credits must be an integer').min(0, 'Credits must be >= 0'),
    })
  ).min(1, 'At least one semester credit configuration is required'),
  recalculateStudents: z.boolean().optional().default(false),
});

export type SetBranchCreditsInput = z.infer<typeof setBranchCreditsSchema>;


