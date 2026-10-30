/**
 * @fileoverview Express 5 Application Factory.
 * @module server/app
 */

import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import type { Db } from '@/core/db/client';
import { env } from '@/server/config/env';
import type { Options as RateLimitOptions } from 'express-rate-limit';
import { isPortalError } from '@/core/errors/portal-error';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createCgpaRouter } from './modules/cgpa/cgpa.routes';
import { createRegistrationRouter } from './modules/registration/registration.routes';
import { createProfilesRouter } from './modules/profiles/profiles.routes';
import { createDrivesRouter } from './modules/drives/drives.routes';
import { createSpreadsheetRouter } from './modules/spreadsheet/spreadsheet.routes';
import type { FileStorage } from './services/storage.service';

export interface AppOptions {
  authLimiter?: Partial<RateLimitOptions>;
  storage?: FileStorage;
}

/**
 * Creates and configures the Express 5 application instance.
 *
 * @param db - The injected Drizzle ORM database instance.
 * @param options - Optional application configuration overrides.
 * @returns Configured Express application without starting the listener.
 */
export function createApp(db: Db, options?: AppOptions): Express {
  const app = express();

  // 1. Core global middleware
  app.use(cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Attach db to app locals for convenient route access if needed
  app.locals.db = db;

  // 2. Health check route
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // 3. Mount domain module routers
  app.use('/api/auth', createAuthRouter(db, options?.authLimiter));
  app.use('/api/cgpa', createCgpaRouter(db));
  app.use('/api/registration', createRegistrationRouter(db));
  app.use('/api/profiles', createProfilesRouter(db));
  app.use('/api/drives', createDrivesRouter(db, options?.storage));
  app.use('/api/spreadsheet', createSpreadsheetRouter(db));

  // 4. JSON 404 Handler for unmatched routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  // 5. Centralized Error Middleware (Errors formatted as { error: { code, message } })
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (isPortalError(err)) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
      return;
    }

    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: err.errors.map((e) => e.message).join(', ') || 'Validation error',
        },
      });
      return;
    }

    // Generic unhandled exceptions
    const statusCode =
      typeof err === 'object' && err !== null && 'statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number'
        ? (err as { statusCode: number }).statusCode
        : 500;

    const message =
      env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err instanceof Error
        ? err.message
        : 'Internal server error';

    res.status(statusCode).json({
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  });

  return app;
}

