/**
 * @fileoverview Authentication client service interacting with backend auth endpoints.
 * @module services/auth.service
 */

import { apiClient } from '@/lib/api-client';
import type { UserRole } from '@/core/types/roles';

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  branch: string | null;
}

export interface LoginResponse {
  user: AuthUser;
}

export interface GetMeResponse {
  user: AuthUser;
}

/**
 * Authenticates user credentials via POST /auth/login.
 *
 * @param username - User account username or college roll number.
 * @param password - Plaintext password.
 * @returns Authenticated user profile.
 */
export async function login(
  username: string,
  password: string
): Promise<AuthUser> {
  const response = await apiClient.post<LoginResponse>('/auth/login', {
    username,
    password,
  });
  return response.data.user;
}

/**
 * Destroys current session via POST /auth/logout.
 */
export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

/**
 * Fetches current authenticated user via GET /auth/me.
 * Returns null if unauthenticated or session has expired.
 *
 * @returns Authenticated user profile or null.
 */
export async function getMe(): Promise<AuthUser | null> {
  try {
    const response = await apiClient.get<GetMeResponse>('/auth/me');
    return response.data.user;
  } catch {
    return null;
  }
}

export const authService = {
  login,
  logout,
  getMe,
};

