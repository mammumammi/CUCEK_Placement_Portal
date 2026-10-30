/**
 * @fileoverview Authentication service handling login, session creation, password changes, and coordinator registration.
 * @module server/modules/auth/auth.service
 */

import { eq } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { users } from '@/core/db/schema/users.schema';
import type { UserRole } from '@/core/types/roles';
import { hashPassword, verifyPassword } from './password';
import { signToken } from './token';
import { PortalError } from '@/core/errors/portal-error';
import type {
  LoginInput,
  ChangePasswordInput,
  CreateCoordinatorInput,
} from './auth.schema';

/**
 * Sanitized user entity guaranteed to exclude credentials.
 */
export interface SafeUser {
  id: string;
  username: string;
  role: UserRole;
  branch: string | null;
  createdAt: Date;
}

/**
 * Authenticates a user by credentials and generates a signed session token.
 * Uses uniform error messaging for missing users and invalid passwords.
 */
export async function login(
  db: Db,
  input: LoginInput
): Promise<{ user: SafeUser; token: string }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);

  if (!user) {
    throw new PortalError('UNAUTHORIZED', 'Invalid username or password', 401);
  }

  const isPasswordValid = await verifyPassword(
    input.password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new PortalError('UNAUTHORIZED', 'Invalid username or password', 401);
  }

  const token = await signToken({
    sub: user.id,
    role: user.role,
    branch: user.branch,
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      branch: user.branch,
      createdAt: user.createdAt,
    },
    token,
  };
}

/**
 * Retrieves the currently authenticated user's profile.
 */
export async function getMe(db: Db, userId: string): Promise<SafeUser> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new PortalError('NOT_FOUND', 'User not found', 404);
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    branch: user.branch,
    createdAt: user.createdAt,
  };
}

/**
 * Updates a user's password after verifying their existing password.
 */
export async function changePassword(
  db: Db,
  userId: string,
  input: ChangePasswordInput
): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new PortalError('NOT_FOUND', 'User not found', 404);
  }

  const isCurrentValid = await verifyPassword(
    input.currentPassword,
    user.passwordHash
  );

  if (!isCurrentValid) {
    throw new PortalError('UNAUTHORIZED', 'Current password is incorrect', 401);
  }

  const newHash = await hashPassword(input.newPassword);

  await db
    .update(users)
    .set({ passwordHash: newHash })
    .where(eq(users.id, userId));
}

/**
 * Creates a new BRANCH_COORDINATOR account.
 * Only callable by MAIN_COORDINATOR.
 */
export async function createCoordinator(
  db: Db,
  input: CreateCoordinatorInput
): Promise<SafeUser> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.username, input.username))
    .limit(1);

  if (existing) {
    throw new PortalError('VALIDATION_ERROR', 'Username is already taken', 400);
  }

  const passwordHash = await hashPassword(input.password);
  const newUser = {
    id: crypto.randomUUID(),
    username: input.username,
    passwordHash,
    role: 'BRANCH_COORDINATOR' as const,
    branch: input.branch,
    createdAt: new Date(),
  };

  await db.insert(users).values(newUser);

  return {
    id: newUser.id,
    username: newUser.username,
    role: newUser.role,
    branch: newUser.branch,
    createdAt: newUser.createdAt,
  };
}

