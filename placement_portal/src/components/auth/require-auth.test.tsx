import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RequireAuth } from './require-auth';
import type { AuthUser } from '@/services/auth.service';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

let mockUser: AuthUser | null = null;
let mockLoading = false;

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('RequireAuth Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockLoading = false;
  });

  it('renders loading state when authentication is loading', () => {
    mockLoading = true;
    mockUser = null;

    render(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to /login when there is no authenticated user', () => {
    mockLoading = false;
    mockUser = null;

    render(
      <RequireAuth>
        <div>Protected Content</div>
      </RequireAuth>
    );

    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated and no specific roles are required', () => {
    mockLoading = false;
    mockUser = {
      id: 'student_1',
      username: '2022BCSE001',
      role: 'STUDENT',
      branch: 'CSE',
    };

    render(
      <RequireAuth>
        <div>Protected Student Content</div>
      </RequireAuth>
    );

    expect(screen.getByText('Protected Student Content')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects to /login when user role does not match required roles', () => {
    mockLoading = false;
    mockUser = {
      id: 'student_1',
      username: '2022BCSE001',
      role: 'STUDENT',
      branch: 'CSE',
    };

    render(
      <RequireAuth roles={['MAIN_COORDINATOR']}>
        <div>Admin Only Content</div>
      </RequireAuth>
    );

    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Admin Only Content')).not.toBeInTheDocument();
  });

  it('renders children when user role matches one of the allowed roles', () => {
    mockLoading = false;
    mockUser = {
      id: 'coord_1',
      username: 'cse_coord',
      role: 'BRANCH_COORDINATOR',
      branch: 'CSE',
    };

    render(
      <RequireAuth roles={['BRANCH_COORDINATOR', 'MAIN_COORDINATOR']}>
        <div>Coordinator Dashboard</div>
      </RequireAuth>
    );

    expect(screen.getByText('Coordinator Dashboard')).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

