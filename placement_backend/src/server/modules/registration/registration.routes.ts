/**
 * @fileoverview Registration Express routes for preview and commit.
 * @module server/modules/registration/registration.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import type { Db } from '@/core/db/client';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { PortalError } from '@/core/errors/portal-error';
import {
  validateRegistrationSheet,
  commitRegistration,
} from './registration.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    const isXlsx =
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    if (isXlsx) {
      cb(null, true);
    } else {
      cb(new PortalError('VALIDATION_ERROR', 'Only .xlsx files are supported', 400));
    }
  },
});

/**
 * Creates the registration module router.
 *
 * @param db - The injected database instance.
 * @returns Configured Express Router mounted under /api/registration.
 */
export function createRegistrationRouter(db: Db): Router {
  const router = Router();

  // POST /api/registration/preview
  router.post(
    '/preview',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          throw new PortalError('VALIDATION_ERROR', 'File field "file" is required', 400);
        }

        const actor = {
          id: req.user!.id,
          role: req.user!.role,
          branch: req.user!.branch,
        };

        const { rows, summary } = await validateRegistrationSheet(
          db,
          actor,
          req.file.buffer
        );

        res.status(200).json({ rows, summary });
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/registration/commit
  router.post(
    '/commit',
    requireAuth,
    requireRoles('MAIN_COORDINATOR', 'BRANCH_COORDINATOR'),
    upload.single('file'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file) {
          throw new PortalError('VALIDATION_ERROR', 'File field "file" is required', 400);
        }

        const actor = {
          id: req.user!.id,
          role: req.user!.role,
          branch: req.user!.branch,
        };

        const skipInvalid = req.query.skipInvalid === 'true';

        const result = await commitRegistration(
          db,
          actor,
          req.file.buffer,
          skipInvalid
        );

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

