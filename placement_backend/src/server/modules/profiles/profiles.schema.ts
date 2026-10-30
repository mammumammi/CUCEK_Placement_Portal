/**
 * @fileoverview Zod validation schemas for profile corrections.
 * @module server/modules/profiles/profiles.schema
 */

import { z } from 'zod';

export const semesterUpdateSchema = z.object({
  semester: z.coerce.number().int().min(1, 'Semester must be between 1 and 6').max(6, 'Semester must be between 1 and 6'),
  credits: z.coerce.number().int().min(0, 'Credits must be non-negative'),
  sgpa: z.coerce.number().min(0, 'SGPA must be at least 0').max(10, 'SGPA cannot exceed 10'),
});

export type SemesterUpdateInput = z.infer<typeof semesterUpdateSchema>;

/**
 * Whitelist schema for student profile corrections.
 * Uses .strict() to reject any unknown or unrecognized fields with a 400 error.
 */
export const profileCorrectionSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').optional(),
    branch: z.string().trim().min(1, 'Branch cannot be empty').optional(),
    batch: z.string().trim().min(1, 'Batch cannot be empty').optional(),
    email: z.string().trim().email('Invalid email address').optional(),
    phone: z.string().trim().regex(/^\d{10}$/, 'Phone must be a valid 10-digit number').optional(),
    activeBacklogs: z.coerce.number().int('Active backlogs must be an integer').min(0, 'Active backlogs must be >= 0').optional(),
    resumeUrl: z.string().trim().optional().nullable(),
    s1MarksheetUrl: z.string().trim().optional().nullable(),
    s2MarksheetUrl: z.string().trim().optional().nullable(),
    s3MarksheetUrl: z.string().trim().optional().nullable(),
    s4MarksheetUrl: z.string().trim().optional().nullable(),
    s5MarksheetUrl: z.string().trim().optional().nullable(),
    s6MarksheetUrl: z.string().trim().optional().nullable(),
    semesters: z.array(semesterUpdateSchema).optional(),
  })
  .strict();

export type ProfileCorrectionInput = z.infer<typeof profileCorrectionSchema>;

