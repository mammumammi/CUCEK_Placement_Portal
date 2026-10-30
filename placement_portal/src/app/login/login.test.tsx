import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import LoginPage from './page';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockLogin = vi.fn();
let mockLoading = false;

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    login: mockLogin,
    loading: mockLoading,
    user: null,
    logout: vi.fn(),
  }),
}));

describe('LoginPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoading = false;
  });

  it('renders login form with username, password fields and submit button', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /placement portal/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username or roll number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows the server error message when login fails', async () => {
    mockLogin.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: 'Invalid username or password',
          },
        },
      },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username or roll number/i), {
      target: { value: 'invalid_user' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong_pass' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Invalid username or password');
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('redirects STUDENT to /student on successful authentication', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'student_1',
      username: '2022BCSE001',
      role: 'STUDENT',
      branch: 'CSE',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username or roll number/i), {
      target: { value: '2022BCSE001' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Password@123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('2022BCSE001', 'Password@123');
      expect(mockPush).toHaveBeenCalledWith('/student');
    });
  });

  it('redirects BRANCH_COORDINATOR to /coordinator on successful authentication', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'coord_1',
      username: 'cse_coordinator',
      role: 'BRANCH_COORDINATOR',
      branch: 'CSE',
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username or roll number/i), {
      target: { value: 'cse_coordinator' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Coord@123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/coordinator');
    });
  });

  it('redirects MAIN_COORDINATOR to /admin on successful authentication', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'main_1',
      username: 'main_admin',
      role: 'MAIN_COORDINATOR',
      branch: null,
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/username or roll number/i), {
      target: { value: 'main_admin' },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'Admin@123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/admin');
    });
  });
});

