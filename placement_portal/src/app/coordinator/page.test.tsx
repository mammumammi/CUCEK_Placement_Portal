import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import CoordinatorPage from './page';
import * as profilesService from '@/services/profiles.service';
import * as drivesService from '@/services/drives.service';

const mockPush = vi.fn();
const mockLogout = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'coord-cse', username: 'cse_coord', role: 'BRANCH_COORDINATOR', branch: 'CSE' },
    loading: false,
    logout: mockLogout,
  }),
}));

vi.mock('@/components/auth/require-auth', () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('CoordinatorPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the department placement overview banner and class students directory with all fields', async () => {
    vi.spyOn(profilesService, 'getDepartmentStats').mockResolvedValueOnce({
      branch: 'CSE',
      totalStudents: 45,
      placedCount: 38,
      unplacedCount: 7,
      placementRate: 84.4,
      highestPackage: 28.5,
      averagePackage: 14.2,
      activeDrivesCount: 5,
      placedStudents: [
        {
          studentId: 'CSE001',
          name: 'Alice Johnson',
          branch: 'CSE',
          company: 'Google',
          role: 'SWE',
          ctcLpa: 28.5,
          placedAt: '2026-10-01',
        },
      ],
    });

    vi.spyOn(profilesService, 'listProfiles').mockResolvedValueOnce([
      {
        userId: 'user-alice',
        studentId: 'CSE001',
        registrationNumber: 'REG-2022-CSE-001',
        name: 'Alice Johnson',
        firstName: 'Alice',
        lastName: 'Johnson',
        dob: '2002-05-15',
        age: 22,
        branch: 'CSE',
        batch: '2022-2026',
        email: 'alice.johnson@college.edu',
        phone: '9876543210',
        activeBacklogs: 0,
        cgpa: 9.25,
        percentage: 87.8,
        totalMarks: 4500,
        maxMarks: 5000,
        marksheetUrl: 'https://drive.google.com/marksheet-alice',
        isProfileComplete: true,
        placement: {
          isPlaced: true,
          company: 'Google',
          role: 'SWE',
          ctcLpa: 28.5,
          placedAt: '2026-10-01',
        },
      },
    ]);

    vi.spyOn(drivesService, 'listDrives').mockResolvedValueOnce([
      {
        id: 'drive-google',
        company: 'Google',
        role: 'SWE',
        description: 'Building software',
        packageCategory: 'DREAM',
        ctcLpa: 28.5,
        jdFileUrl: null,
        deadline: '2026-12-31T23:59:59.000Z',
        eligibleBranches: ['CSE', 'IT'],
        minCgpa: 8.0,
        allowBacklogs: false,
        maxActiveBacklogs: 0,
        totalRounds: 3,
        createdBy: 'user-admin',
        open: true,
        createdAt: '2026-10-01T00:00:00.000Z',
        extraFields: [{ key: 'github_link', label: 'GitHub Profile URL', type: 'text', required: true }],
      },
    ]);

    render(<CoordinatorPage />);

    // 1. Check Department Overview Banner
    await waitFor(() => {
      expect(screen.getByText(/CSE Department Dashboard/i)).toBeInTheDocument();
      expect(screen.getByText('84.4% Placed')).toBeInTheDocument();
      expect(screen.getAllByText('28.5 LPA').length).toBeGreaterThanOrEqual(1);
    });

    // 2. Check Students Table has rendered all fields
    await waitFor(() => {
      expect(screen.getByText('CSE001')).toBeInTheDocument();
      expect(screen.getByText('REG-2022-CSE-001')).toBeInTheDocument();
      expect(screen.getAllByText('Alice Johnson').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('2002-05-15')).toBeInTheDocument();
      expect(screen.getByText('22 yrs')).toBeInTheDocument();
      expect(screen.getByText('9.25')).toBeInTheDocument();
      expect(screen.getByText('87.8%')).toBeInTheDocument();
      expect(screen.getByText('4500 / 5000')).toBeInTheDocument();
      expect(screen.getByText('Drive Link 📄')).toBeInTheDocument();
      expect(screen.getByText('Full Record')).toBeInTheDocument();
    });

    // 3. Switch to Drives & Application Sheets tab
    const drivesTabButton = screen.getByRole('button', {
      name: /Recruitment Drives & Application Sheets/i,
    });
    fireEvent.click(drivesTabButton);

    await waitFor(() => {
      expect(screen.getByText(/Recruitment Drives & Live Application Sheets/i)).toBeInTheDocument();
      expect(screen.getByText(/Open Application Sheet/i)).toBeInTheDocument();
      expect(screen.getByText(/Add Batch Field/i)).toBeInTheDocument();
    });
  });

  it('renders notification badge and applied drive requests in Corrections & Applied Requests tab', async () => {
    vi.spyOn(profilesService, 'getDepartmentStats').mockResolvedValueOnce({
      branch: 'CSE',
      totalStudents: 1,
      placedCount: 0,
      unplacedCount: 1,
      placementRate: 0,
      highestPackage: 0,
      averagePackage: 0,
      activeDrivesCount: 1,
      placedStudents: [],
    });

    vi.spyOn(profilesService, 'listProfiles').mockResolvedValueOnce([]);
    vi.spyOn(drivesService, 'listDrives').mockResolvedValueOnce([]);

    vi.spyOn(profilesService, 'listCorrectionRequests').mockResolvedValue([
      {
        id: 'req-drive-1',
        studentUserId: 'user-alice',
        studentId: 'CSE001',
        registrationNumber: 'REG-2022-CSE-001',
        studentName: 'Alice Johnson',
        branch: 'CSE',
        status: 'PENDING',
        reason: 'Drive Application: Student applied for Google (SWE) - Package: 28.5 LPA',
        requestedChanges: {
          type: 'DRIVE_APPLICATION',
          applicationId: 'app-1',
          driveId: 'drive-google',
          company: 'Google',
          role: 'SWE',
          packageCategory: 'DREAM',
          ctcLpa: 28.5,
        },
        createdAt: '2026-11-19T00:00:00.000Z',
        updatedAt: '2026-11-19T00:00:00.000Z',
      },
    ]);

    const reviewSpy = vi.spyOn(profilesService, 'reviewCorrectionRequest').mockResolvedValueOnce({
      id: 'req-drive-1',
      studentUserId: 'user-alice',
      studentId: 'CSE001',
      studentName: 'Alice Johnson',
      branch: 'CSE',
      status: 'APPROVED',
      reason: 'Drive Application: Student applied for Google (SWE)',
      requestedChanges: { type: 'DRIVE_APPLICATION' },
      createdAt: '2026-11-19T00:00:00.000Z',
      updatedAt: '2026-11-19T00:00:00.000Z',
    });

    render(<CoordinatorPage />);

    // 1. Notification bell should show 1 Pending Request
    await waitFor(() => {
      expect(screen.getByText('1 Pending Request')).toBeInTheDocument();
    });

    // 2. Click the Corrections & Applied Requests tab
    const requestsTab = screen.getByRole('button', {
      name: /Corrections & Applied Requests/i,
    });
    fireEvent.click(requestsTab);

    // 3. Check that the notification banner and drive application request card appear
    await waitFor(() => {
      expect(screen.getByText(/Student Applied Requests & Corrections/i)).toBeInTheDocument();
      expect(screen.getByText(/1 Pending Request Requiring Coordinator Attention/i)).toBeInTheDocument();
      expect(screen.getByText('Drive Application')).toBeInTheDocument();
      expect(screen.getByText('Verify & Approve Application')).toBeInTheDocument();
    });

    // 4. Click Verify & Approve Application
    const approveBtn = screen.getByText('Verify & Approve Application');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(reviewSpy).toHaveBeenCalledWith('req-drive-1', 'APPROVE', '');
    });
  });
});
