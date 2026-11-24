import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import DriveApplicationPage from './page';
import * as drivesService from '@/services/drives.service';

const mockPush = vi.fn();
let mockParams: Record<string, string> = { driveId: 'test-drive-1' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useParams: () => mockParams,
}));

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1', username: 'student1', role: 'STUDENT' },
    loading: false,
    logout: vi.fn(),
  }),
}));

vi.mock('@/components/auth/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/spreadsheet/DrivesSpreadsheet', () => ({
  DrivesSpreadsheet: () => <div data-testid="mock-spreadsheet">Spreadsheet Content</div>,
}));

describe('DriveApplicationPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { driveId: 'test-drive-1' };
  });

  it('renders drive details and spreadsheet when loaded via useParams', async () => {
    vi.spyOn(drivesService, 'getDriveById').mockResolvedValueOnce({
      id: 'test-drive-1',
      company: 'Google',
      role: 'Software Engineer',
      description: 'Building world-class software',
      packageCategory: 'DREAM',
      ctcLpa: 25,
      jdFileUrl: null,
      deadline: '2026-12-31T23:59:59.000Z',
      eligibleBranches: ['CSE', 'IT'],
      minCgpa: 7.5,
      maxActiveBacklogs: 0,
      allowBacklogs: false,
      extraFields: [],
      totalRounds: 3,
      createdBy: 'admin-1',
      createdAt: '2026-11-01T00:00:00.000Z',
      open: true,
      eligible: true,
      userApplied: false,
    });

    render(<DriveApplicationPage />);

    expect(screen.getByText(/loading placement drive details/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Google Recruitment Drive/i)).toBeInTheDocument();
      expect(screen.getByText(/25 LPA Package/i)).toBeInTheDocument();
      expect(screen.getByText(/Dream/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /apply now/i })).toBeInTheDocument();
      expect(screen.getByTestId('mock-spreadsheet')).toBeInTheDocument();
    });
  });

  it('handles plain object params or promise params without throwing', async () => {
    vi.spyOn(drivesService, 'getDriveById').mockResolvedValueOnce({
      id: 'prop-drive-2',
      company: 'Microsoft',
      role: 'SWE',
      description: null,
      packageCategory: 'GENERAL',
      ctcLpa: 6.5,
      jdFileUrl: null,
      deadline: '2026-12-31T23:59:59.000Z',
      eligibleBranches: ['CSE'],
      minCgpa: 6.0,
      maxActiveBacklogs: 1,
      allowBacklogs: true,
      extraFields: [],
      totalRounds: 2,
      createdBy: 'admin-1',
      createdAt: '2026-11-01T00:00:00.000Z',
      open: true,
      eligible: true,
      userApplied: true,
    });

    render(<DriveApplicationPage params={Promise.resolve({ driveId: 'prop-drive-2' })} />);

    await waitFor(() => {
      expect(screen.getByText(/Microsoft Recruitment Drive/i)).toBeInTheDocument();
      expect(screen.getByText(/6.5 LPA Package/i)).toBeInTheDocument();
      expect(screen.getByText(/Applied/i)).toBeInTheDocument();
    });
  });
});
