/**
 * @fileoverview Zod validation schemas for authentication module.
 * @module server/modules/auth/auth.schema
 */

import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const createCoordinatorSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  branch: z.string().min(1, 'Branch is required'),
});

export type CreateCoordinatorInput = z.infer<typeof createCoordinatorSchema>;

