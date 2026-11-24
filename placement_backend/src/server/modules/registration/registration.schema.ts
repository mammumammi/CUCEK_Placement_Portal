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
  rollno: 'studentId',
  'roll no': 'studentId',
  'roll number': 'studentId',
  registrationnumber: 'registrationNumber',
  'registration number': 'registrationNumber',
  regno: 'registrationNumber',
  'reg no': 'registrationNumber',
  'register number': 'registrationNumber',
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

export const REQUIRED_COLUMNS = ['studentId'];

/**
 * Zod validation schema for a single parsed student row.
 * Enforces non-empty strings, valid email, 10-digit phone, sgpa 0-10, credits > 0, activeBacklogs integer >= 0.
 */
export const studentRowSchema = z
  .object({
    studentId: z.coerce.string().trim().optional().nullable(),
    registrationNumber: z.coerce.string().trim().optional().nullable(),
    name: z.string().trim().optional().nullable(),
    firstName: z.string().trim().optional().nullable(),
    lastName: z.string().trim().optional().nullable(),
    dob: z.string().trim().optional().nullable(),
    age: z.coerce.number().int().min(0, 'Age must be >= 0').max(120, 'Age must be <= 120').optional().nullable(),
    branch: z.string().trim().optional().nullable(),
    batch: z.coerce.string().trim().optional().nullable(),
    email: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || z.string().email().safeParse(val).success,
        { message: 'Invalid email address' }
      ),
    phone: z.coerce
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (val) => !val || /^\d{10}$/.test(val),
        { message: 'Phone must be a valid 10-digit number' }
      ),
    activeBacklogs: z.coerce
      .number({ invalid_type_error: 'Active backlogs must be an integer' })
      .int('Active backlogs must be an integer')
      .min(0, 'Active backlogs must be >= 0')
      .default(0),
    totalMarks: z.coerce.number().min(0).optional(),
    maxMarks: z.coerce.number().min(0).optional(),
    percentage: z.coerce.number().min(0).max(100).optional(),
    marksheetUrl: z.string().trim().optional(),
    s1MarksheetUrl: z.string().trim().optional(),
    s2MarksheetUrl: z.string().trim().optional(),
    s3MarksheetUrl: z.string().trim().optional(),
    s4MarksheetUrl: z.string().trim().optional(),
    s5MarksheetUrl: z.string().trim().optional(),
    s6MarksheetUrl: z.string().trim().optional(),
    s7MarksheetUrl: z.string().trim().optional(),
    s8MarksheetUrl: z.string().trim().optional(),
    currentSemester: z.coerce.number().int().min(1).max(8).optional().nullable(),
    fatherName: z.string().trim().optional().nullable(),
    motherName: z.string().trim().optional().nullable(),
    tenthPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
    twelfthPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
    panNumber: z.string().trim().optional().nullable(),
    aadhaarNumber: z.string().trim().optional().nullable(),
    githubUrl: z.string().trim().optional().nullable(),
    linkedInUrl: z.string().trim().optional().nullable(),
    address: z.string().trim().optional().nullable(),
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
    s7Sgpa: z.coerce
      .number()
      .min(0, 'SGPA must be >= 0')
      .max(10, 'SGPA must be <= 10')
      .optional()
      .nullable(),
    s7Credits: z.coerce
      .number()
      .int('Credits must be an integer')
      .min(1, 'Credits must be > 0')
      .optional()
      .nullable(),
    s8Sgpa: z.coerce
      .number()
      .min(0, 'SGPA must be >= 0')
      .max(10, 'SGPA must be <= 10')
      .optional()
      .nullable(),
    s8Credits: z.coerce
      .number()
      .int('Credits must be an integer')
      .min(1, 'Credits must be > 0')
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    // Either studentId or registrationNumber must be provided
    if (!data.studentId && !data.registrationNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either Student ID or Registration Number must be provided',
        path: ['studentId'],
      });
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

