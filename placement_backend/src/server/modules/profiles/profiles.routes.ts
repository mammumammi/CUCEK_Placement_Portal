/**
 * @fileoverview Student profile Express routes.
 * @module server/modules/profiles/profiles.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Db } from '@/core/db/client';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { profileCorrectionSchema } from './profiles.schema';
import {
  getMyProfile,
  getProfileByStudentId,
  listProfiles,
  correctStudentProfile,
  getStudentAuditLogs,
} from './profiles.service';

/**
 * Creates the profiles module Express router.
 *
 * @param db - The injected database instance.
 * @returns Configured Express Router mounted under /api/profiles.
 */
export function createProfilesRouter(db: Db): Router {
  const router = Router();

  // GET /api/profiles/me (STUDENT only)
  router.get(
    '/me',
    requireAuth,
    requireRoles('STUDENT'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const profile = await getMyProfile(db, req.user!.id);
        res.status(200).json(profile);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/profiles (Coordinators only, branch query filter)
  router.get(
    '/',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const branchQuery =
          typeof req.query.branch === 'string' ? req.query.branch : undefined;
        const profiles = await listProfiles(db, req.user!, branchQuery);
        res.status(200).json(profiles);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/profiles/:studentId (Student: own only; Branch coordinator: own branch; Main: any)
  router.get(
    '/:studentId',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const studentId = Array.isArray(req.params.studentId)
          ? req.params.studentId[0]
          : req.params.studentId;
        const profile = await getProfileByStudentId(
          db,
          req.user!,
          studentId
        );
        res.status(200).json(profile);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /api/profiles/:studentId/correct (Coordinators only, branch scoped)
  router.patch(
    '/:studentId/correct',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const studentId = Array.isArray(req.params.studentId)
          ? req.params.studentId[0]
          : req.params.studentId;
        const input = profileCorrectionSchema.parse(req.body);
        const updatedProfile = await correctStudentProfile(
          db,
          req.user!,
          studentId,
          input
        );
        res.status(200).json(updatedProfile);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/profiles/:studentId/audit-logs (Coordinators only, branch scoped)
  router.get(
    '/:studentId/audit-logs',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const studentId = Array.isArray(req.params.studentId)
          ? req.params.studentId[0]
          : req.params.studentId;
        const logs = await getStudentAuditLogs(
          db,
          req.user!,
          studentId
        );
        res.status(200).json(logs);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
