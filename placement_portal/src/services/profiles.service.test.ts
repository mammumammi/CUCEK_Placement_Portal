import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMyProfile,
  listProfiles,
  getProfileByStudentId,
  createCorrectionRequest,
  listCorrectionRequests,
  reviewCorrectionRequest,
} from './profiles.service';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('Profiles Service (Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMyProfile', () => {
    it('calls GET /profiles/me and returns profile', async () => {
      const mockProfile = {
        userId: 'u1',
        studentId: '2022BCSE001',
        name: 'Aditya Sharma',
        branch: 'CSE',
        batch: '2026',
        email: 'aditya@college.edu',
        phone: '9876543210',
        activeBacklogs: 0,
        cgpa: 8.75,
        semesters: [{ semester: 1, credits: 20, sgpa: 8.5 }],
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockProfile });

      const res = await getMyProfile();
      expect(apiClient.get).toHaveBeenCalledWith('/profiles/me');
      expect(res).toEqual(mockProfile);
    });
  });

  describe('listProfiles', () => {
    it('calls GET /profiles with optional branch query', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] });

      await listProfiles('CSE');
      expect(apiClient.get).toHaveBeenCalledWith('/profiles', {
        params: { branch: 'CSE' },
      });
    });
  });

  describe('createCorrectionRequest', () => {
    it('calls POST /profiles/correction-requests with payload', async () => {
      const mockReq = {
        id: 'r1',
        studentUserId: 'u1',
        studentId: '2022BCSE001',
        studentName: 'Aditya',
        branch: 'CSE',
        requestedChanges: { phone: '9876500000' },
        reason: 'New SIM',
        status: 'PENDING' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockReq });

      const res = await createCorrectionRequest({
        requestedChanges: { phone: '9876500000' },
        reason: 'New SIM',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/profiles/correction-requests', {
        requestedChanges: { phone: '9876500000' },
        reason: 'New SIM',
      });
      expect(res).toEqual(mockReq);
    });
  });

  describe('reviewCorrectionRequest', () => {
    it('calls PATCH /profiles/correction-requests/:id/review with action and remarks', async () => {
      const mockApproved = {
        id: 'r1',
        status: 'APPROVED' as const,
      };

      vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockApproved });

      const res = await reviewCorrectionRequest('r1', 'APPROVE', 'Verified');
      expect(apiClient.patch).toHaveBeenCalledWith(
        '/profiles/correction-requests/r1/review',
        { action: 'APPROVE', remarks: 'Verified' }
      );
      expect(res).toEqual(mockApproved);
    });
  });
});

