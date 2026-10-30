/**
 * @fileoverview Zod validation schemas for recruitment drives.
 * @module server/modules/drives/drives.schema
 */

import { z } from 'zod';

/**
 * Validation schema for dynamic form fields configured on a drive.
 */
export const driveExtraFieldSchema = z.object({
  key: z.string().trim().min(1, 'Extra field key is required'),
  label: z.string().trim().min(1, 'Extra field label is required'),
  type: z.enum(['text', 'number', 'dropdown'], {
    errorMap: () => ({ message: 'Field type must be text, number, or dropdown' }),
  }),
  options: z.array(z.string().trim().min(1)).optional(),
  required: z.coerce.boolean().optional().default(false),
});

export type DriveExtraFieldInput = z.infer<typeof driveExtraFieldSchema>;

/**
 * Schema for creating a recruitment drive via POST /api/drives.
 * Supports multipart form string serialization and coercions.
 */
export const createDriveSchema = z.object({
  company: z.string().trim().min(1, 'Company name is required'),
  description: z.string().trim().optional().nullable(),
  deadline: z
    .string()
    .trim()
    .min(1, 'Deadline is required')
    .refine(
      (val) => !Number.isNaN(new Date(val).getTime()),
      { message: 'Deadline must be a valid ISO datetime string' }
    )
    .refine(
      (val) => new Date(val).getTime() > Date.now(),
      { message: 'Deadline must be in the future' }
    ),
  eligibleBranches: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return val.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }
    return val;
  }, z.array(z.string().trim().min(1, 'Branch code cannot be empty')).min(1, 'At least one eligible branch is required')),
  minCgpa: z.coerce
    .number()
    .min(0, 'minCgpa must be at least 0')
    .max(10, 'minCgpa cannot exceed 10')
    .default(0.0),
  maxActiveBacklogs: z.coerce
    .number()
    .int('maxActiveBacklogs must be an integer')
    .min(0, 'maxActiveBacklogs cannot be negative')
    .default(0),
  totalRounds: z.coerce
    .number()
    .int('totalRounds must be an integer')
    .min(1, 'totalRounds must be at least 1')
    .default(1),
  extraFields: z.preprocess((val) => {
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return val;
      }
    }
    if (val === undefined || val === null || val === '') return [];
    return val;
  }, z.array(driveExtraFieldSchema).optional().default([])),
});

export type CreateDriveInput = z.infer<typeof createDriveSchema>;

/**
 * Schema for updating an application's round outcome or placement status.
 * Body can specify { roundNumber, result: 'SHORTLISTED' | 'REJECTED' } or { placed: boolean }.
 */
export const updateRoundSchema = z
  .object({
    roundNumber: z.coerce.number().int().min(1, 'roundNumber must be >= 1').optional(),
    result: z.enum(['SHORTLISTED', 'REJECTED']).optional(),
    placed: z.boolean().optional(),
  })
  .refine(
    (data) =>
      (data.roundNumber !== undefined && data.result !== undefined) ||
      data.placed !== undefined,
    {
      message: 'Must provide either (roundNumber and result) or placed status',
    }
  );

export type UpdateRoundInput = z.infer<typeof updateRoundSchema>;

