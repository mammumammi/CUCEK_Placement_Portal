/**
 * @fileoverview Frontend service for branch curriculum and semester credits configuration.
 * @module services/curriculum.service
 */

import { apiClient } from '@/lib/api-client';

export interface BranchCreditItem {
  branch: string;
  semester: number;
  credits: number;
}

export interface GetBranchCreditsResponse {
  branch: string | null;
  credits: BranchCreditItem[];
}

export interface SetBranchCreditsResponse {
  branch: string;
  credits: BranchCreditItem[];
  recalculated?: boolean;
}

/**
 * Fetches configured semester credits for a branch.
 * If branch is omitted, returns all configured branches (centralised admin access).
 */
export async function getBranchCredits(
  branch?: string
): Promise<GetBranchCreditsResponse> {
  const query = branch ? `?branch=${encodeURIComponent(branch)}` : '';
  const response = await apiClient.get<GetBranchCreditsResponse>(
    `/cgpa/branch-credits${query}`
  );
  return response.data;
}

/**
 * Updates semester credits for a branch.
 * Optionally recalculates CGPA for all students in that branch.
 */
export async function updateBranchCredits(
  branch: string,
  credits: { semester: number; credits: number }[],
  recalculateStudents = false
): Promise<SetBranchCreditsResponse> {
  const response = await apiClient.put<SetBranchCreditsResponse>(
    '/cgpa/branch-credits',
    {
      branch,
      credits,
      recalculateStudents,
    }
  );
  return response.data;
}

