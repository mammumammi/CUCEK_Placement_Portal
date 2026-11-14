/**
 * @fileoverview CGPA calculation Express routes.
 * @module server/modules/cgpa/cgpa.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Db } from '@/core/db/client';
import { requireAuth } from '../auth/auth.middleware';
import { calculateCgpaSchema, setBranchCreditsSchema } from './cgpa.schema';
import { calculateCreditBasedCgpa } from './cgpa.service';
import { applyBacklogRule } from './backlog.service';
import { getBranchCredits, setBranchCredits } from './branch-credits.service';
import { PortalError } from '@/core/errors/portal-error';

/**
 * Creates the CGPA module Express router.
 *
 * @param db - Database instance.
 * @returns Configured Express Router mounted under /api/cgpa.
 */
export function createCgpaRouter(db: Db): Router {
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

  // GET /api/cgpa/branch-credits
  router.get(
    '/branch-credits',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = req.user!;
        let branch = req.query.branch as string | undefined;

        if (actor.role === 'BRANCH_COORDINATOR') {
          if (!actor.branch) {
            throw new PortalError('FORBIDDEN', 'Branch Coordinator has no assigned branch');
          }
          if (branch && branch.toUpperCase() !== actor.branch.toUpperCase()) {
            throw new PortalError(
              'FORBIDDEN',
              `Branch Coordinator for ${actor.branch} cannot access credits for branch ${branch}`
            );
          }
          branch = actor.branch;
        } else if (actor.role === 'STUDENT') {
          branch = actor.branch || undefined;
        }

        const credits = await getBranchCredits(db, branch);
        res.status(200).json({
          branch: branch?.toUpperCase() || null,
          credits,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // PUT /api/cgpa/branch-credits
  router.put(
    '/branch-credits',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const actor = req.user!;
        if (actor.role === 'STUDENT') {
          throw new PortalError('FORBIDDEN', 'Students cannot modify curriculum credits');
        }

        const input = setBranchCreditsSchema.parse(req.body);

        if (actor.role === 'BRANCH_COORDINATOR') {
          if (!actor.branch || input.branch.toUpperCase() !== actor.branch.toUpperCase()) {
            throw new PortalError(
              'FORBIDDEN',
              `Branch Coordinator for "${actor.branch || 'unknown'}" cannot modify curriculum credits for branch "${input.branch}"`
            );
          }
        }

        const updated = await setBranchCredits(
          db,
          input.branch,
          input.credits,
          input.recalculateStudents
        );

        res.status(200).json({
          branch: input.branch.toUpperCase(),
          credits: updated,
          recalculated: input.recalculateStudents,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

