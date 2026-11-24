import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

import { apiClient } from '@/lib/api-client';
import {
  getDriveMockOA,
  generateDriveMockOA,
  runCode,
  submitMockAssessment,
  getMySubmissions,
  getBigDataAssessmentAnalytics,
} from './assessments.service';

describe('Assessments Service', () => {
  it('calls getDriveMockOA with drive ID', async () => {
    const mockData = { id: 'a1', company: 'Google', questions: [] };
    (apiClient.get as any).mockResolvedValueOnce({ data: { assessment: mockData } });

    const result = await getDriveMockOA('d123');
    expect(apiClient.get).toHaveBeenCalledWith('/assessments/drive/d123');
    expect(result).toEqual(mockData);
  });

  it('calls generateDriveMockOA with force flag', async () => {
    const mockData = { id: 'a2', company: 'Amazon', questions: [] };
    (apiClient.post as any).mockResolvedValueOnce({ data: { assessment: mockData } });

    const result = await generateDriveMockOA('d123', true);
    expect(apiClient.post).toHaveBeenCalledWith('/assessments/drive/d123/generate', {
      force: true,
    });
    expect(result).toEqual(mockData);
  });

  it('calls runCode with code execution payload', async () => {
    const runResult = {
      results: [{ passed: true, actualOutput: '5', expectedOutput: '5' }],
      allPassed: true,
      totalCount: 1,
      passedCount: 1,
    };
    (apiClient.post as any).mockResolvedValueOnce({ data: runResult });

    const payload = {
      language: 'javascript' as const,
      code: 'function solution() { return 5; }',
      questionId: 'q1',
    };

    const result = await runCode('a1', payload);
    expect(apiClient.post).toHaveBeenCalledWith('/assessments/a1/run', payload);
    expect(result).toEqual(runResult);
  });

  it('calls submitMockAssessment with answers and time spent', async () => {
    const submissionResult = {
      id: 'sub1',
      score: 100,
      totalQuestions: 2,
      passedQuestions: 2,
    };
    (apiClient.post as any).mockResolvedValueOnce({
      data: { submission: submissionResult },
    });

    const payload = {
      timeSpentSeconds: 1500,
      answers: {
        q1: { language: 'python' as const, code: 'def solution(): return 1' },
      },
    };

    const result = await submitMockAssessment('a1', payload);
    expect(apiClient.post).toHaveBeenCalledWith('/assessments/a1/submit', payload);
    expect(result).toEqual(submissionResult);
  });

  it('calls getMySubmissions to fetch past attempts', async () => {
    const subs = [{ id: 'sub1', score: 90 }];
    (apiClient.get as any).mockResolvedValueOnce({ data: { submissions: subs } });

    const result = await getMySubmissions('a1');
    expect(apiClient.get).toHaveBeenCalledWith('/assessments/a1/submissions/me');
    expect(result).toEqual(subs);
  });

  it('calls getBigDataAssessmentAnalytics with assessment ID', async () => {
    const mockAnalytics = {
      datasetMetadata: { totalSubmissionsAnalyzed: 48500 },
      predictiveHiringModel: { shortlistProbability: 85 },
    };
    (apiClient.get as any).mockResolvedValueOnce({ data: { analytics: mockAnalytics } });

    const result = await getBigDataAssessmentAnalytics('a1');
    expect(apiClient.get).toHaveBeenCalledWith('/assessments/a1/big-data-analytics');
    expect(result).toEqual(mockAnalytics);
  });
});
