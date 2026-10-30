/**
 * @fileoverview Zod validation schemas for drive application spreadsheets.
 * @module server/modules/spreadsheet/spreadsheet.schema
 */

import { z } from 'zod';

/**
 * Schema for initial application submission via POST /api/spreadsheet/drives/:driveId/apply.
 */
export const applyDriveSchema = z
  .object({
    extraData: z.record(z.unknown()).optional().default({}),
  })
  .strict();

export type ApplyDriveInput = z.infer<typeof applyDriveSchema>;

/**
 * Strict whitelist schema for row updates via PATCH /api/spreadsheet/drives/:driveId/rows/:studentId.
 * Rejects any profile columns (such as name, cgpa, branch) with a 400 error.
 */
export const patchRowSchema = z
  .object({
    extraData: z.record(z.unknown()).optional(),
    verified: z.boolean().optional(),
  })
  .strict();

export type PatchRowInput = z.infer<typeof patchRowSchema>;

