/**
 * @fileoverview Student profile Express routes.
 * @module server/modules/profiles/profiles.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import multer from 'multer';
import type { Db } from '@/core/db/client';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import {
  profileCorrectionSchema,
  createCorrectionRequestSchema,
  reviewCorrectionRequestSchema,
  completeProfileSchema,
  setBatchCurrentSemesterSchema,
  createPlacedStudentManualSchema,
  commitPlacedStudentsBatchSchema,
} from './profiles.schema';
import {
  listStudentNotifications,
  markNotificationRead,
} from '../drives/shortlist.service';
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
  updateBatchCurrentSemester,
  listPlacedStudents,
  recordPlacedStudentManual,
  previewPlacedStudentsExcel,
  commitPlacedStudentsBatch,
  unmarkPlacedStudent,
  updateStudentPlacementStatus,
  deleteStudentRecord,
  deleteBatchStudents,
} from './profiles.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

  // GET /api/profiles/me/notifications (STUDENT only: retrieve shortlist & round notifications)
  router.get(
    '/me/notifications',
    requireAuth,
    requireRoles('STUDENT'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const notifications = await listStudentNotifications(db, req.user!.id);
        res.status(200).json(notifications);
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /api/profiles/me/notifications/:notificationId/read (STUDENT only)
  router.patch(
    '/me/notifications/:notificationId/read',
    requireAuth,
    requireRoles('STUDENT'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await markNotificationRead(
          db,
          req.user!.id,
          String(req.params.notificationId)
        );
        res.status(200).json(result);
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

  // PATCH /api/profiles/batch-current-semester (Coordinators configure reached semester for junior batches)
  router.patch(
    '/batch-current-semester',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = setBatchCurrentSemesterSchema.parse(req.body);
        const result = await updateBatchCurrentSemester(db, req.user!, input);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/profiles/placed-students (Coordinators: list all placed students with company & role)
  router.get(
    '/placed-students',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const branchQuery =
          typeof req.query.branch === 'string' ? req.query.branch : undefined;
        const placed = await listPlacedStudents(db, req.user!, branchQuery);
        res.status(200).json(placed);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/profiles/placed-students/manual (Coordinators: manually mark a student as placed)
  router.post(
    '/placed-students/manual',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = createPlacedStudentManualSchema.parse(req.body);
        const result = await recordPlacedStudentManual(db, req.user!, input);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/profiles/placed-students/batch-preview (Coordinators: upload Excel for preview & validation)
  router.post(
    '/placed-students/batch-preview',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file || !req.file.buffer) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Excel file (.xlsx or .xls) is required',
            },
          });
          return;
        }
        const preview = await previewPlacedStudentsExcel(db, req.user!, req.file.buffer);
        res.status(200).json(preview);
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/profiles/placed-students/batch-commit (Coordinators: commit validated placements)
  router.post(
    '/placed-students/batch-commit',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = commitPlacedStudentsBatchSchema.parse(req.body);
        const result = await commitPlacedStudentsBatch(db, req.user!, input.records);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/profiles/placed-students/:studentUserId/:driveId (Coordinators: unmark placement)
  router.delete(
    '/placed-students/:studentUserId/:driveId',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const studentUserId = Array.isArray(req.params.studentUserId)
          ? req.params.studentUserId[0]
          : req.params.studentUserId;
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const result = await unmarkPlacedStudent(db, req.user!, studentUserId, driveId);
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

  // PATCH /api/profiles/:studentId/placement-status (Coordinators only, branch scoped)
  router.patch(
    '/:studentId/placement-status',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const studentId = Array.isArray(req.params.studentId)
          ? req.params.studentId[0]
          : req.params.studentId;
        const schema = z.object({
          placementStatus: z.enum(['UNPLACED', 'GENERAL', 'DREAM', 'INTERNSHIP']),
        });
        const { placementStatus } = schema.parse(req.body);
        const result = await updateStudentPlacementStatus(
          db,
          req.user!,
          studentId,
          placementStatus
        );
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/profiles/batch-delete (Coordinators: delete batch of uploaded students)
  router.delete(
    '/batch-delete',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const branch = typeof req.query.branch === 'string' ? req.query.branch : undefined;
        const batch = typeof req.query.batch === 'string' ? req.query.batch : undefined;
        const createdAt = req.query.createdAt ? Number(req.query.createdAt) : undefined;
        const result = await deleteBatchStudents(db, req.user!, { branch, batch, createdAt });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // DELETE /api/profiles/:studentId (Coordinators: delete student record)
  router.delete(
    '/:studentId',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const studentId = Array.isArray(req.params.studentId)
          ? req.params.studentId[0]
          : req.params.studentId;
        const result = await deleteStudentRecord(db, req.user!, studentId);
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
