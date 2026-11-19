/**
 * @fileoverview Student profile Express routes.
 * @module server/modules/profiles/profiles.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Db } from '@/core/db/client';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import {
  profileCorrectionSchema,
  createCorrectionRequestSchema,
  reviewCorrectionRequestSchema,
  completeProfileSchema,
} from './profiles.schema';
import {
  getMyProfile,
  completeStudentProfile,
  getProfileByStudentId,
  listProfiles,
  getDepartmentStats,
  correctStudentProfile,
  getStudentAuditLogs,
  createCorrectionRequest,
  listCorrectionRequests,
  reviewCorrectionRequest,
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

  // PATCH /api/profiles/me (STUDENT only: complete initial profile missing fields)
  router.patch(
    '/me',
    requireAuth,
    requireRoles('STUDENT'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = completeProfileSchema.parse(req.body);
        const profile = await completeStudentProfile(db, req.user!.id, input);
        res.status(200).json(profile);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/profiles/stats (Coordinators: department placement metrics and placed count)
  router.get(
    '/stats',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const branchQuery =
          typeof req.query.branch === 'string' ? req.query.branch : undefined;
        const stats = await getDepartmentStats(db, req.user!, branchQuery);
        res.status(200).json(stats);
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

  // POST /api/profiles/correction-requests (STUDENT only)
  router.post(
    '/correction-requests',
    requireAuth,
    requireRoles('STUDENT'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = createCorrectionRequestSchema.parse(req.body);
        const result = await createCorrectionRequest(
          db,
          {
            id: req.user!.id,
            role: req.user!.role,
            branch: req.user!.branch,
          },
          input
        );
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/profiles/correction-requests (All authenticated roles, scoped by service)
  router.get(
    '/correction-requests',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const results = await listCorrectionRequests(db, {
          id: req.user!.id,
          role: req.user!.role,
          branch: req.user!.branch,
        });
        res.status(200).json(results);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /api/profiles/correction-requests/:requestId/review (Coordinators only)
  router.patch(
    '/correction-requests/:requestId/review',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const requestId = Array.isArray(req.params.requestId)
          ? req.params.requestId[0]
          : req.params.requestId;
        const input = reviewCorrectionRequestSchema.parse(req.body);
        const result = await reviewCorrectionRequest(
          db,
          {
            id: req.user!.id,
            role: req.user!.role,
            branch: req.user!.branch,
          },
          requestId,
          input
        );
        res.status(200).json(result);
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
