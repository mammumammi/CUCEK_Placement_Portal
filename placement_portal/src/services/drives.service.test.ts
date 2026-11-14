import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/api-client';
import {
  listDrives,
  getDriveById,
  createDrive,
  summarizeJd,
  notifyEligibleStudents,
  getDriveStats,
} from './drives.service';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Drives Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listDrives calls GET /drives', async () => {
    const mockDrives = [
      {
        id: 'drive-1',
        company: 'Google',
        role: 'SDE',
        packageCategory: 'DREAM',
        ctcLpa: 24,
        open: true,
      },
    ];
    (apiClient.get as any).mockResolvedValueOnce({ data: mockDrives });

    const result = await listDrives();
    expect(apiClient.get).toHaveBeenCalledWith('/drives');
    expect(result).toEqual(mockDrives);
  });

  it('getDriveById calls GET /drives/:id', async () => {
    const mockDrive = {
      id: 'drive-123',
      company: 'Microsoft',
      role: 'SWE',
      packageCategory: 'DREAM',
    };
    (apiClient.get as any).mockResolvedValueOnce({ data: mockDrive });

    const result = await getDriveById('drive-123');
    expect(apiClient.get).toHaveBeenCalledWith('/drives/drive-123');
    expect(result).toEqual(mockDrive);
  });

  it('createDrive calls POST /drives with multipart headers', async () => {
    const formData = new FormData();
    formData.append('company', 'Amazon');
    const mockCreated = { id: 'drive-456', company: 'Amazon' };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockCreated });

    const result = await createDrive(formData);
    expect(apiClient.post).toHaveBeenCalledWith('/drives', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    expect(result).toEqual(mockCreated);
  });

  it('summarizeJd calls POST /drives/summarize-jd with form data', async () => {
    const mockSummary = {
      company: 'Adobe',
      role: 'MTS-1',
      packageCategory: 'DREAM',
      ctcLpa: 16.5,
      minCgpa: 7.5,
      allowBacklogs: false,
      maxActiveBacklogs: 0,
      eligibleBranches: ['CSE', 'IT'],
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockSummary });

    const result = await summarizeJd({ text: 'Sample JD content' });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/drives/summarize-jd',
      expect.any(FormData),
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    expect(result).toEqual(mockSummary);
  });

  it('notifyEligibleStudents calls POST /drives/:id/notify', async () => {
    const mockResult = {
      driveId: 'drive-1',
      driveTitle: 'Google SDE',
      totalEligible: 25,
      sentCount: 25,
      recipients: [],
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: mockResult });

    const result = await notifyEligibleStudents('drive-1', 'http://localhost:3000');
    expect(apiClient.post).toHaveBeenCalledWith('/drives/drive-1/notify', {
      baseUrl: 'http://localhost:3000',
    });
    expect(result).toEqual(mockResult);
  });

  it('getDriveStats calls GET /drives/:id/stats', async () => {
    const mockStats = {
      driveId: 'drive-1',
      company: 'Google',
      totalApplications: 40,
      verifiedApplications: 35,
      pendingApplications: 5,
      placedCount: 8,
      totalRounds: 3,
    };
    (apiClient.get as any).mockResolvedValueOnce({ data: mockStats });

    const result = await getDriveStats('drive-1');
    expect(apiClient.get).toHaveBeenCalledWith('/drives/drive-1/stats');
    expect(result).toEqual(mockStats);
  });
});

