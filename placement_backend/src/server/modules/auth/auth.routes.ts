/**
 * @fileoverview Authentication Express routes.
 * @module server/modules/auth/auth.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Options } from 'express-rate-limit';
import type { Db } from '@/core/db/client';
import {
  loginSchema,
  changePasswordSchema,
  createCoordinatorSchema,
} from './auth.schema';
import {
  login,
  getMe,
  changePassword,
  createCoordinator,
} from './auth.service';
import {
  requireAuth,
  requireRoles,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from './auth.middleware';
import { createLoginLimiter } from './limiter';

/**
 * Creates the auth module Express router.
 *
 * @param db - The database instance injected into services.
 * @param limiterOptions - Optional rate limiter options override for tests.
 * @returns Configured Express Router.
 */
export function createAuthRouter(
  db: Db,
  limiterOptions?: Partial<Options>
): Router {
  const router = Router();
  const loginLimiter = createLoginLimiter(limiterOptions);

  // POST /api/auth/login
  router.post(
    '/login',
    loginLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = loginSchema.parse(req.body);
        const { user, token } = await login(db, input);

        res.cookie(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
        res.status(200).json({ user });
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/auth/logout
  router.post(
    '/logout',
    (_req: Request, res: Response) => {
      res.clearCookie(SESSION_COOKIE_NAME, {
        ...SESSION_COOKIE_OPTIONS,
        maxAge: undefined,
      });
      res.status(200).json({ message: 'Logged out successfully' });
    }
  );

  // GET /api/auth/me
  router.get(
    '/me',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = await getMe(db, req.user!.id);
        res.status(200).json({ user });
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/auth/change-password
  router.post(
    '/change-password',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = changePasswordSchema.parse(req.body);
        await changePassword(db, req.user!.id, input);
        res.status(200).json({ message: 'Password changed successfully' });
      } catch (err) {
        next(err);
      }
    }
  );

  // POST /api/auth/coordinators (MAIN_COORDINATOR only)
  router.post(
    '/coordinators',
    requireAuth,
    requireRoles('MAIN_COORDINATOR'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = createCoordinatorSchema.parse(req.body);
        const user = await createCoordinator(db, input);
        res.status(201).json({ user });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

