/**
 * @fileoverview CGPA calculation Express routes.
 * @module server/modules/cgpa/cgpa.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Db } from '@/core/db/client';
import { requireAuth } from '../auth/auth.middleware';
import { calculateCgpaSchema } from './cgpa.schema';
import { calculateCreditBasedCgpa } from './cgpa.service';
import { applyBacklogRule } from './backlog.service';

/**
 * Creates the CGPA module Express router.
 *
 * @param _db - Database instance.
 * @returns Configured Express Router mounted under /api/cgpa.
 */
export function createCgpaRouter(_db: Db): Router {
  const router = Router();

  // POST /api/cgpa/calculate
  router.post(
    '/calculate',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = calculateCgpaSchema.parse(req.body);
        const rawCgpa = calculateCreditBasedCgpa(input.semesters);
        const { cgpa } = applyBacklogRule(rawCgpa, input.activeBacklogs);

        res.status(200).json({
          cgpa,
          activeBacklogs: input.activeBacklogs,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

