import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, logout, getMe, authService } from './auth.service';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('Auth Service', () => {
  const mockUser = {
    id: 'user_123',
    username: '2022BCSE001',
    role: 'STUDENT' as const,
    branch: 'CSE',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('calls POST /auth/login with credentials and returns user', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { user: mockUser },
      });

      const user = await login('2022BCSE001', 'Password@123');

      expect(apiClient.post).toHaveBeenCalledWith('/auth/login', {
        username: '2022BCSE001',
        password: 'Password@123',
      });
      expect(user).toEqual(mockUser);
    });

    it('propagates error when login fails', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(
        new Error('Invalid username or password')
      );

      await expect(login('wrong_user', 'bad_pass')).rejects.toThrow(
        'Invalid username or password'
      );
    });
  });

  describe('logout', () => {
    it('calls POST /auth/logout', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { message: 'Logged out successfully' },
      });

      await logout();

      expect(apiClient.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('propagates error when logout fails', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(
        new Error('Network error')
      );

      await expect(logout()).rejects.toThrow('Network error');
    });
  });

  describe('getMe', () => {
    it('calls GET /auth/me and returns user when authenticated', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { user: mockUser },
      });

      const user = await getMe();

      expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(user).toEqual(mockUser);
    });

    it('returns null when unauthenticated or GET /auth/me throws', async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce({
        response: { status: 401, data: { message: 'Unauthorized' } },
      });

      const user = await getMe();

      expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
      expect(user).toBeNull();
    });
  });

  describe('authService export object', () => {
    it('exposes login, logout, and getMe', () => {
      expect(authService.login).toBe(login);
      expect(authService.logout).toBe(logout);
      expect(authService.getMe).toBe(getMe);
    });
  });
});
