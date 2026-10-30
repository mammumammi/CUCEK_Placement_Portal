/**
 * @fileoverview Zod schemas and column configuration for bulk student registration.
 * @module server/modules/registration/registration.schema
 */

import { z } from 'zod';
import {
  CANONICAL_FIELDS,
  REQUIRED_CANONICAL_KEYS,
} from './mapping/canonical-fields';

/**
 * Expected columns map: dynamically built from canonical field keys and synonyms
 * to ensure CANONICAL_FIELDS is the single source of truth.
 */
export const COLUMN_MAP: Record<string, string> = {
  studentid: 'studentId',
  'student id': 'studentId',
  name: 'name',
  'student name': 'name',
  branch: 'branch',
  department: 'branch',
  batch: 'batch',
  email: 'email',
  'email address': 'email',
  phone: 'phone',
  'phone number': 'phone',
  activebacklogs: 'activeBacklogs',
  'active backlogs': 'activeBacklogs',
  backlogs: 'activeBacklogs',
  ...Object.fromEntries(
    CANONICAL_FIELDS.map((f) => [f.key.toLowerCase(), f.key])
  ),
};

export const REQUIRED_COLUMNS = REQUIRED_CANONICAL_KEYS;

/**
 * Zod validation schema for a single parsed student row.
 * Enforces non-empty strings, valid email, 10-digit phone, sgpa 0-10, credits > 0, activeBacklogs integer >= 0.
 */
export const studentRowSchema = z
  .object({
    studentId: z
      .string({ required_error: 'Student ID is required' })
      .trim()
      .min(1, 'Student ID cannot be empty'),
    name: z
      .string({ required_error: 'Name is required' })
      .trim()
      .min(1, 'Name cannot be empty'),
    branch: z
      .string({ required_error: 'Branch is required' })
      .trim()
      .min(1, 'Branch cannot be empty'),
    batch: z
      .string({ required_error: 'Batch is required' })
      .trim()
      .min(1, 'Batch cannot be empty'),
    email: z
      .string({ required_error: 'Email is required' })
      .trim()
      .email('Invalid email address'),
    phone: z
      .string({ required_error: 'Phone is required' })
      .trim()
      .regex(/^\d{10}$/, 'Phone must be a valid 10-digit number'),
    activeBacklogs: z.coerce
      .number({ invalid_type_error: 'Active backlogs must be an integer' })
      .int('Active backlogs must be an integer')
      .min(0, 'Active backlogs must be >= 0'),
    s1Sgpa: z.coerce
      .number()
      .min(0, 'SGPA must be >= 0')
      .max(10, 'SGPA must be <= 10')
      .optional()
      .nullable(),
    s1Credits: z.coerce
      .number()
      .int('Credits must be an integer')
      .min(1, 'Credits must be > 0')
      .optional()
      .nullable(),
    s2Sgpa: z.coerce
      .number()
      .min(0, 'SGPA must be >= 0')
      .max(10, 'SGPA must be <= 10')
      .optional()
      .nullable(),
    s2Credits: z.coerce
      .number()
      .int('Credits must be an integer')
      .min(1, 'Credits must be > 0')
      .optional()
      .nullable(),
    s3Sgpa: z.coerce
      .number()
      .min(0, 'SGPA must be >= 0')
      .max(10, 'SGPA must be <= 10')
      .optional()
      .nullable(),
    s3Credits: z.coerce
      .number()
      .int('Credits must be an integer')
      .min(1, 'Credits must be > 0')
      .optional()
      .nullable(),
    s4Sgpa: z.coerce
      .number()
      .min(0, 'SGPA must be >= 0')
      .max(10, 'SGPA must be <= 10')
      .optional()
      .nullable(),
    s4Credits: z.coerce
      .number()
      .int('Credits must be an integer')
      .min(1, 'Credits must be > 0')
      .optional()
      .nullable(),
    s5Sgpa: z.coerce
      .number()
      .min(0, 'SGPA must be >= 0')
      .max(10, 'SGPA must be <= 10')
      .optional()
      .nullable(),
    s5Credits: z.coerce
      .number()
      .int('Credits must be an integer')
      .min(1, 'Credits must be > 0')
      .optional()
      .nullable(),
    s6Sgpa: z.coerce
      .number()
      .min(0, 'SGPA must be >= 0')
      .max(10, 'SGPA must be <= 10')
      .optional()
      .nullable(),
    s6Credits: z.coerce
      .number()
      .int('Credits must be an integer')
      .min(1, 'Credits must be > 0')
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    // A semester's sgpa and credits must both be present or both blank
    for (let sem = 1; sem <= 6; sem++) {
      const sgpaKey = `s${sem}Sgpa` as keyof typeof data;
      const creditsKey = `s${sem}Credits` as keyof typeof data;
      const hasSgpa = data[sgpaKey] !== undefined && data[sgpaKey] !== null;
      const hasCredits =
        data[creditsKey] !== undefined && data[creditsKey] !== null;

      if ((hasSgpa && !hasCredits) || (!hasSgpa && hasCredits)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Semester ${sem} SGPA and credits must both be present or both blank`,
          path: [hasSgpa ? creditsKey : sgpaKey],
        });
      }
    }
  });

export type StudentRowData = z.infer<typeof studentRowSchema>;

export interface ParsedRowResult {
  rowNumber: number;
  data: Record<string, unknown>;
  cgpa: number;
  errors: string[];
}

export interface RegistrationSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicatesInFile: number;
  duplicatesInDb: number;
}

export interface PreviewResponse {
  rows: ParsedRowResult[];
  summary: RegistrationSummary;
}

export interface CommitResponse {
  created: number;
  skipped: number;
}

