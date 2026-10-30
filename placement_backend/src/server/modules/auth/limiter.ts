/**
 * @fileoverview Login rate limiter factory using express-rate-limit.
 * @module server/modules/auth/limiter
 */

import rateLimit from 'express-rate-limit';
import type { Options } from 'express-rate-limit';
import type { Request, Response } from 'express';

/**
 * Creates an Express rate limiter for login attempts.
 * Defaults to 5 failed attempts per 15 minutes per IP+username combination.
 *
 * @param customOptions - Injectable options for testing or custom thresholds.
 * @returns Configured rate limit middleware.
 */
export function createLoginLimiter(customOptions?: Partial<Options>) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      const username =
        typeof req.body?.username === 'string'
          ? req.body.username.trim().toLowerCase()
          : '';
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      return `${ip}_${username}`;
    },
    handler: (_req: Request, res: Response, _next, options) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message:
            typeof options.message === 'string'
              ? options.message
              : 'Too many failed login attempts. Please try again later.',
        },
      });
    },
    ...customOptions,
  });
}

