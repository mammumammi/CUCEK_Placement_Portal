import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/api-client';
import { getBranchCredits, updateBranchCredits } from './curriculum.service';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('Curriculum Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getBranchCredits calls GET /cgpa/branch-credits with branch query', async () => {
    const mockData = {
      branch: 'CSE',
      credits: [{ branch: 'CSE', semester: 1, credits: 24 }],
    };
    (apiClient.get as any).mockResolvedValueOnce({ data: mockData });

    const result = await getBranchCredits('CSE');
    expect(apiClient.get).toHaveBeenCalledWith('/cgpa/branch-credits?branch=CSE');
    expect(result).toEqual(mockData);
  });

  it('updateBranchCredits calls PUT /cgpa/branch-credits with payload', async () => {
    const mockData = {
      branch: 'CSE',
      credits: [{ branch: 'CSE', semester: 1, credits: 24 }],
      recalculated: true,
    };
    (apiClient.put as any).mockResolvedValueOnce({ data: mockData });

    const result = await updateBranchCredits(
      'CSE',
      [{ semester: 1, credits: 24 }],
      true
    );

    expect(apiClient.put).toHaveBeenCalledWith('/cgpa/branch-credits', {
      branch: 'CSE',
      credits: [{ semester: 1, credits: 24 }],
      recalculateStudents: true,
    });
    expect(result).toEqual(mockData);
  });
});

