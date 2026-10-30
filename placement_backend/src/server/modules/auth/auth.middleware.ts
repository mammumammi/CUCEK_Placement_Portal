/**
 * @fileoverview Authentication and authorization middlewares.
 * @module server/modules/auth/auth.middleware
 */

import type { Request, Response, NextFunction, CookieOptions } from 'express';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@/core/types/roles';
import { verifyToken } from './token';
import { users } from '@/core/db/schema/users.schema';
import type { Db } from '@/core/db/client';
import { env } from '@/server/config/env';

export const SESSION_COOKIE_NAME = 'session';

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  maxAge: 8 * 60 * 60 * 1000, // 8 hours in ms
  path: '/',
};

/**
 * Authenticated user object attached to req.user.
 */
export interface AuthUser {
  id: string;
  role: UserRole;
  branch: string | null;
}

// Augment Express Request interface with typed user property
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Middleware enforcing session authentication via httpOnly cookie.
 * Verifies JWT token, queries user record in database, and attaches req.user.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (!token) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
    return;
  }

  try {
    const payload = await verifyToken(token);
    const db = req.app.locals.db as Db;

    const [user] = await db
      .select({
        id: users.id,
        role: users.role,
        branch: users.branch,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User no longer exists',
        },
      });
      return;
    }

    req.user = {
      id: user.id,
      role: user.role,
      branch: user.branch,
    };

    next();
  } catch {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session',
      },
    });
  }
}

/**
 * Middleware restricting access to specified RBAC roles.
 *
 * @param roles - Authorized UserRole list.
 */
export function requireRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
        },
      });
      return;
    }

    next();
  };
}

