/**
 * @fileoverview JWT signing and verification using jose (HS256, 8h expiry).
 * @module server/modules/auth/token
 */

import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/server/config/env';
import type { UserRole } from '@/core/types/roles';

/**
 * Payload carried by the session JWT.
 */
export interface AuthTokenPayload {
  sub: string;
  role: UserRole;
  branch: string | null;
}

const secretKey = new TextEncoder().encode(env.JWT_SECRET);

/**
 * Signs a JWT token with HS256 algorithm and 8-hour expiration.
 *
 * @param payload - Authenticated user claims {sub, role, branch}.
 * @returns Serialized JWT string.
 */
export async function signToken(payload: AuthTokenPayload): Promise<string> {
  return new SignJWT({
    role: payload.role,
    branch: payload.branch,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secretKey);
}

/**
 * Verifies and decodes a JWT token using the configured secret key.
 *
 * @param token - Serialized JWT string.
 * @returns Verified AuthTokenPayload.
 */
export async function verifyToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ['HS256'],
  });

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Invalid token: missing subject');
  }

  return {
    sub: payload.sub,
    role: payload.role as UserRole,
    branch: (payload.branch as string | null) ?? null,
  };
}

