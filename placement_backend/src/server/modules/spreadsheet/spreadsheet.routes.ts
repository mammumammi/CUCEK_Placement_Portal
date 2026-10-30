/**
 * @fileoverview Express routes for drive application spreadsheets.
 * @module server/modules/spreadsheet/spreadsheet.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Db } from '@/core/db/client';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { applyDriveSchema, patchRowSchema } from './spreadsheet.schema';
import {
  applyToDrive,
  getDriveSpreadsheetRows,
  patchDriveRow,
} from './spreadsheet.service';

/**
 * Creates the spreadsheet module Express router.
 *
 * @param db - The injected database instance.
 * @returns Configured Express Router mounted under /api/spreadsheet.
 */
export function createSpreadsheetRouter(db: Db): Router {
  const router = Router();

  // POST /api/spreadsheet/drives/:driveId/apply (STUDENT only)
  router.post(
    '/drives/:driveId/apply',
    requireAuth,
    requireRoles('STUDENT'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;
        const input = applyDriveSchema.parse(req.body);

        const result = await applyToDrive(db, req.user!, driveId, input);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/spreadsheet/drives/:driveId/rows (All authenticated roles; scoped rows + permissions)
  router.get(
    '/drives/:driveId/rows',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const rows = await getDriveSpreadsheetRows(db, req.user!, driveId);
        res.status(200).json(rows);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /api/spreadsheet/drives/:driveId/rows/:studentId
  router.patch(
    '/drives/:driveId/rows/:studentId',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;
        const studentId = Array.isArray(req.params.studentId)
          ? req.params.studentId[0]
          : req.params.studentId;

        const body = patchRowSchema.parse(req.body);
        const updated = await patchDriveRow(
          db,
          req.user!,
          driveId,
          studentId,
          body
        );

        res.status(200).json(updated);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

