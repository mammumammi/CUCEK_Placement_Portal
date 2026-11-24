/**
 * @fileoverview Zod validation schemas for profile corrections.
 * @module server/modules/profiles/profiles.schema
 */

import { z } from 'zod';

export const semesterUpdateSchema = z.object({
  semester: z.coerce.number().int().min(1, 'Semester must be between 1 and 8').max(8, 'Semester must be between 1 and 8'),
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
    studentId: z.string().trim().min(1).optional(),
    registrationNumber: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1, 'Name cannot be empty').optional(),
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    dob: z.string().trim().min(1).optional(),
    age: z.coerce.number().int().min(0).max(120).optional(),
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
    s7MarksheetUrl: z.string().trim().optional().nullable(),
    s8MarksheetUrl: z.string().trim().optional().nullable(),
    currentSemester: z.coerce.number().int().min(1).max(8).optional().nullable(),
    additionalDetails: z.record(z.string(), z.unknown()).optional(),
    semesters: z.array(semesterUpdateSchema).optional(),
  })
  .strict();

export type ProfileCorrectionInput = z.infer<typeof profileCorrectionSchema>;

export const setBatchCurrentSemesterSchema = z.object({
  branch: z.string().trim().optional(),
  batch: z.string().trim().optional(),
  currentSemester: z.coerce.number().int().min(1, 'Current semester must be between 1 and 8').max(8, 'Current semester must be between 1 and 8'),
});

export type SetBatchCurrentSemesterInput = z.infer<typeof setBatchCurrentSemesterSchema>;

export const createCorrectionRequestSchema = z.object({
  requestedChanges: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters long'),
});

export type CreateCorrectionRequestInput = z.infer<typeof createCorrectionRequestSchema>;

export const reviewCorrectionRequestSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  remarks: z.string().trim().optional(),
});

export type ReviewCorrectionRequestInput = z.infer<typeof reviewCorrectionRequestSchema>;

/**
 * Validation schema for students completing their initial missing profile fields.
 */
export const completeProfileSchema = z
  .object({
    studentId: z.string().trim().min(1).optional(),
    registrationNumber: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1, 'Name cannot be empty').optional(),
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    dob: z.string().trim().optional(),
    branch: z.string().trim().min(1, 'Branch cannot be empty').optional(),
    batch: z.string().trim().min(1, 'Batch cannot be empty').optional(),
    email: z.string().trim().email('Invalid email address').optional(),
    phone: z.string().trim().regex(/^\d{10}$/, 'Phone must be a valid 10-digit number').optional(),
    marksheetUrl: z.string().trim().optional().nullable(),
    resumeUrl: z.string().trim().optional().nullable(),
  })
  .strict();

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;


