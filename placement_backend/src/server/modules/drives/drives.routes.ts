/**
 * @fileoverview Recruitment drives Express routes.
 * @module server/modules/drives/drives.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type { Db } from '@/core/db/client';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { PortalError } from '@/core/errors/portal-error';
import { eq } from 'drizzle-orm';
import { drives } from '@/core/db';
import { defaultStorage } from '@/server/services/storage.service';
import type { FileStorage } from '@/server/services/storage.service';
import { createDriveSchema, updateRoundSchema } from './drives.schema';
import {
  createDrive,
  listDrives,
  getDriveById,
  getDriveJdFile,
  updateApplicationRound,
  getDriveStats,
} from './drives.service';
import { buildDriveExportWorkbook } from './export.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      cb(null, true);
    } else {
      cb(
        new PortalError(
          'VALIDATION_ERROR',
          'Only PDF files are supported for Job Description (JD)',
          400
        )
      );
    }
  },
});

/**
 * Creates the drives module Express router.
 *
 * @param db - The injected database instance.
 * @param storage - Optional FileStorage implementation (defaults to LocalDiskStorage).
 * @returns Configured Express Router mounted under /api/drives.
 */
export function createDrivesRouter(
  db: Db,
  storage: FileStorage = defaultStorage
): Router {
  const router = Router();

  // POST /api/drives (MAIN_COORDINATOR, multipart JD PDF upload)
  router.post(
    '/',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    (req: Request, res: Response, next: NextFunction) => {
      upload.any()(req, res, (err: unknown) => {
        if (err) {
          if (
            typeof err === 'object' &&
            err !== null &&
            'code' in err &&
            (err as { code: unknown }).code === 'LIMIT_FILE_SIZE'
          ) {
            return next(
              new PortalError(
                'VALIDATION_ERROR',
                'File size exceeds maximum limit of 10MB',
                400
              )
            );
          }
          return next(err);
        }
        next();
      });
    },
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = createDriveSchema.parse(req.body);
        const uploadedFile =
          req.file ??
          (Array.isArray(req.files) && req.files.length > 0
            ? (req.files[0] as Express.Multer.File)
            : undefined);

        const created = await createDrive(
          db,
          storage,
          req.user!,
          input,
          uploadedFile
        );

        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives (All authenticated roles; includes open, and eligible+reasons for students)
  router.get(
    '/',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const drivesList = await listDrives(db, req.user!);
        res.status(200).json(drivesList);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/:driveId/jd (Download JD PDF)
  router.get(
    '/:driveId/jd',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const { drive, file } = await getDriveJdFile(db, storage, driveId);

        const safeCompany = drive.company.replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader('Content-Type', file.contentType || 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${safeCompany}_JD.pdf"`
        );
        res.status(200).send(file.data);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/:driveId/stats (Coordinators; branch coordinators see only own branch)
  router.get(
    '/:driveId/stats',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const stats = await getDriveStats(db, driveId, req.user!);
        res.status(200).json(stats);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/:driveId/export (Generate Excel report: verified candidates + summary)
  router.get(
    '/:driveId/export',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const [drive] = await db
          .select()
          .from(drives)
          .where(eq(drives.id, driveId))
          .limit(1);

        if (!drive) {
          throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
        }

        const workbook = await buildDriveExportWorkbook(db, driveId, req.user!);
        const buffer = await workbook.xlsx.writeBuffer();

        const safeCompany = drive.company.replace(/[^a-zA-Z0-9_-]/g, '_');
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${safeCompany}_Candidates.xlsx"`
        );
        res.status(200).send(Buffer.from(buffer));
      } catch (err) {
        next(err);
      }
    }
  );

  // PATCH /api/drives/:driveId/applications/:studentId/rounds (Coordinators only; branch scoped)
  router.patch(
    '/:driveId/applications/:studentId/rounds',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;
        const studentId = Array.isArray(req.params.studentId)
          ? req.params.studentId[0]
          : req.params.studentId;

        const body = updateRoundSchema.parse(req.body);
        const result = await updateApplicationRound(
          db,
          req.user!,
          driveId,
          studentId,
          body
        );

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/drives/:driveId (Single drive details with open and eligible status)
  router.get(
    '/:driveId',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = Array.isArray(req.params.driveId)
          ? req.params.driveId[0]
          : req.params.driveId;

        const drive = await getDriveById(db, req.user!, driveId);
        res.status(200).json(drive);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

