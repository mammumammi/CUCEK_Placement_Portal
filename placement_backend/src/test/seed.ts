/**
 * @fileoverview Test database seeding and authentication utilities.
 * @module test/seed
 */

import type { Express } from 'express';
import { users } from '@/core/db/schema/users.schema';
import type { Db } from '@/core/db/client';
import type { UserRole } from '@/core/types/roles';
import { signToken } from '@/server/modules/auth/token';
import { SESSION_COOKIE_NAME } from '@/server/modules/auth/auth.middleware';

/**
 * Input parameters for seeding a user record.
 */
export interface CreateUserInput {
  id?: string;
  username?: string;
  passwordHash?: string;
  role?: UserRole;
  branch?: string | null;
  createdAt?: Date;
}

/**
 * Seeds a user record into the database for testing.
 *
 * @param db - The test database instance.
 * @param input - Optional partial user attributes.
 * @returns The created user entity.
 */
export async function createUser(
  db: Db,
  input: CreateUserInput = {}
) {
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const newUser = {
    id: input.id ?? `usr_${randomSuffix}`,
    username: input.username ?? `user_${randomSuffix}`,
    passwordHash: input.passwordHash ?? '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
    role: input.role ?? 'STUDENT',
    branch: input.branch !== undefined ? input.branch : 'CSE',
    createdAt: input.createdAt ?? new Date(),
  };

  await db.insert(users).values(newUser);
  return newUser;
}

/**
 * Authenticates as a specified user and returns the cookie header string for Supertest.
 *
 * @param _app - Express application instance (provided for API parity).
 * @param user - Target user identity to simulate login for.
 * @returns Cookie header string (e.g. "session=<jwt>").
 */
export async function loginAs(
  _app: Express,
  user: { id: string; role: UserRole; branch?: string | null }
): Promise<string> {
  const token = await signToken({
    sub: user.id,
    role: user.role,
    branch: user.branch ?? null,
  });

  return `${SESSION_COOKIE_NAME}=${token}`;
}
