/**
 * @fileoverview Unit and integration tests for Mock Online Assessment (OA) synthesis and execution.
 * @module server/modules/assessments/assessments.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@/server/app';
import { createTestDb } from '@/test/test-db';
import { createUser, loginAs } from '@/test/seed';
import { drives } from '@/core/db';
import type { Db } from '@/core/db/client';
import { evaluateCodeAgainstTestCases } from './code-runner';
import { generateDriveMockOA, getDriveMockOA } from './assessments.service';

describe('Online Assessment (OA) Sandbox & Big Data Simulation', () => {
  let db: Db;
  let app: Express;

  let mainCoordinator: { id: string; role: 'MAIN_COORDINATOR'; branch: string | null };
  let studentUser: { id: string; role: 'STUDENT'; branch: string | null };
  let studentCookie: string;
  let testDriveId: string;

  beforeEach(async () => {
    db = createTestDb();
    app = createApp(db);

    mainCoordinator = (await createUser(db, {
      username: 'main_admin',
      role: 'MAIN_COORDINATOR',
      branch: null,
    })) as typeof mainCoordinator;

    studentUser = (await createUser(db, {
      username: 'student_test',
      role: 'STUDENT',
      branch: 'CSE',
    })) as typeof studentUser;

    studentCookie = await loginAs(app, studentUser);

    testDriveId = 'drive-google-test-001';
    await db.insert(drives).values({
      id: testDriveId,
      company: 'Google',
      role: 'Software Engineer - University Graduate',
      minCgpa: 7.5,
      maxActiveBacklogs: 0,
      eligibleBranches: ['CSE', 'ECE'],
      deadline: new Date(Date.now() + 86400000 * 7).toISOString(),
      description: 'Role involves distributed systems, network load balancing, and graph routing algorithms.',
      createdBy: mainCoordinator.id,
    });
  });

  describe('Sandboxed Code Execution & Cloud MicroVM Telemetry', () => {
    it('executes JavaScript code and passes matching test cases', async () => {
      const code = `
        function solution(...nums) {
          return nums.reduce((a, b) => a + b, 0);
        }
      `;

      const testCases = [
        { input: '[1, 2, 3]', expectedOutput: '6' },
        { input: '[10, -5, 5]', expectedOutput: '10' },
      ];

      const { results, cloudTelemetry } = await evaluateCodeAgainstTestCases('javascript', code, testCases);
      expect(results).toHaveLength(2);
      expect(results[0].passed).toBe(true);
      expect(results[0].actualOutput).toBe('6');
      expect(results[1].passed).toBe(true);
      expect(results[1].actualOutput).toBe('10');
      expect(cloudTelemetry.cloudStatus).toBe('ACTIVE_ISOLATED');
      expect(cloudTelemetry.memoryLimitMb).toBe(128);
    });

    it('detects failing test case in JavaScript when output differs', async () => {
      const code = `
        function solution(input) {
          return "wrong";
        }
      `;

      const testCases = [
        { input: '[1, 2]', expectedOutput: '3' },
      ];

      const { results } = await evaluateCodeAgainstTestCases('javascript', code, testCases);
      expect(results[0].passed).toBe(false);
      expect(results[0].actualOutput).toBe('wrong');
      expect(results[0].expectedOutput).toBe('3');
    });

    it('handles JavaScript runtime exceptions gracefully without crashing', async () => {
      const code = `
        function solution(input) {
          throw new Error('Explosion');
        }
      `;

      const testCases = [
        { input: 'test', expectedOutput: 'test' },
      ];

      const { results } = await evaluateCodeAgainstTestCases('javascript', code, testCases);
      expect(results[0].passed).toBe(false);
      expect(results[0].error).toContain('Explosion');
    });

    it('executes Python 3 code correctly and matches test case outputs', async () => {
      const code = `
def solution(*args):
    return max(args)
`;

      const testCases = [
        { input: '[4, 19, 2, 10]', expectedOutput: '19' },
      ];

      const { results } = await evaluateCodeAgainstTestCases('python', code, testCases);
      expect(results[0].passed).toBe(true);
      expect(results[0].actualOutput).toBe('19');
    });

    it('executes Java code correctly using single-file runner without Unexpected identifier error', async () => {
      const code = `
class Solution {
    public String solution(String s, int k) {
        return s.substring(k);
    }
}
`;

      const testCases = [
        { input: '["cbacdcbc", 2]', expectedOutput: 'acdcbc' },
      ];

      const { results, cloudTelemetry } = await evaluateCodeAgainstTestCases('java', code, testCases);
      expect(results[0].passed).toBe(true);
      expect(results[0].actualOutput).toBe('acdcbc');
      expect(cloudTelemetry.containerId).toBeTruthy();
    });
  });

  describe('Big Data Synthesis & Assessment Service', () => {
    it('synthesizes company-specific mock OA with web analytics and questions', async () => {
      const assessment = await generateDriveMockOA(db, testDriveId);

      expect(assessment).toBeDefined();
      expect(assessment.driveId).toBe(testDriveId);
      expect(assessment.company).toBe('Google');
      expect(assessment.durationMinutes).toBe(60);
      expect(assessment.totalQuestions).toBe(2);
      expect(assessment.questions).toBeDefined();
      expect(assessment.questions?.length).toBe(2);

      // Verify question structure
      const q1 = assessment.questions![0];
      expect(q1.title).toBeTruthy();
      expect(q1.description).toBeTruthy();
      expect(q1.sampleTestCases.length).toBeGreaterThan(0);
      expect(q1.hiddenTestCases.length).toBeGreaterThan(0);
      expect(q1.starterCode.python).toContain('def solution');
      expect(q1.starterCode.javascript).toContain('function solution');

      // Verify Big Data analytics metadata
      expect(assessment.analyticsInsights).toBeDefined();
      expect(assessment.analyticsInsights?.companyOAPattern).toContain('Google');
      expect(assessment.analyticsInsights?.frequentTopics.length).toBeGreaterThan(0);
      expect(Object.keys(assessment.topicDistribution || {}).length).toBeGreaterThan(0);
    });

    it('caches generated assessment and reuses it on subsequent calls', async () => {
      const first = await generateDriveMockOA(db, testDriveId);
      const second = await getDriveMockOA(db, testDriveId);

      expect(second).toBeDefined();
      expect(second?.id).toBe(first.id);
    });
  });

  describe('Assessment API Routes (/api/assessments)', () => {
    it('retrieves mock OA via GET /api/assessments/drive/:driveId', async () => {
      const res = await request(app)
        .get(`/api/assessments/drive/${testDriveId}`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.assessment).toBeDefined();
      expect(res.body.assessment.company).toBe('Google');
      expect(res.body.assessment.questions).toHaveLength(2);
    });

    it('executes sample code via POST /api/assessments/:assessmentId/run and returns Cloud Telemetry', async () => {
      const assessment = await generateDriveMockOA(db, testDriveId);
      const q1 = assessment.questions![0];

      const runPayload = {
        language: 'javascript',
        code: `
          function solution(input) {
            return "dummy";
          }
        `,
        questionId: q1.id,
      };

      const res = await request(app)
        .post(`/api/assessments/${assessment.id}/run`)
        .set('Cookie', studentCookie)
        .send(runPayload);

      expect(res.status).toBe(200);
      expect(res.body.results).toBeDefined();
      expect(res.body.cloudTelemetry).toBeDefined();
      expect(res.body.cloudTelemetry.cloudStatus).toBe('ACTIVE_ISOLATED');
      expect(res.body.totalCount).toBe(q1.sampleTestCases.length);
    });

    it('fetches big data analytics via GET /api/assessments/:assessmentId/big-data-analytics', async () => {
      const assessment = await generateDriveMockOA(db, testDriveId);

      const res = await request(app)
        .get(`/api/assessments/${assessment.id}/big-data-analytics`)
        .set('Cookie', studentCookie);

      expect(res.status).toBe(200);
      expect(res.body.analytics).toBeDefined();
      expect(res.body.analytics.datasetMetadata.totalSubmissionsAnalyzed).toBeGreaterThan(40000);
      expect(res.body.analytics.cohortRuntimeDistribution.bellCurvePoints.length).toBeGreaterThan(0);
      expect(res.body.analytics.predictiveHiringModel.shortlistProbability).toBeGreaterThan(0);
    });

    it('submits assessment answers, grades against hidden test cases, and returns feedback report', async () => {
      const assessment = await generateDriveMockOA(db, testDriveId);
      const q1 = assessment.questions![0];
      const q2 = assessment.questions![1];

      const submitPayload = {
        timeSpentSeconds: 1200,
        answers: {
          [q1.id]: {
            language: 'javascript',
            code: 'function solution(input) { return "test"; }',
          },
          [q2.id]: {
            language: 'javascript',
            code: 'function solution(input) { return "test"; }',
          },
        },
      };

      const res = await request(app)
        .post(`/api/assessments/${assessment.id}/submit`)
        .set('Cookie', studentCookie)
        .send(submitPayload);

      expect(res.status).toBe(201);
      expect(res.body.submission).toBeDefined();
      expect(res.body.submission.score).toBeDefined();
      expect(res.body.submission.totalQuestions).toBe(2);
      expect(res.body.submission.feedback).toBeDefined();
      expect(res.body.submission.feedback.percentileEstimate).toBeGreaterThanOrEqual(15);

      // Verify retrieval of past submissions
      const mySubmissionsRes = await request(app)
        .get(`/api/assessments/${assessment.id}/submissions/me`)
        .set('Cookie', studentCookie);

      expect(mySubmissionsRes.status).toBe(200);
      expect(mySubmissionsRes.body.submissions).toHaveLength(1);
      expect(mySubmissionsRes.body.submissions[0].id).toBe(res.body.submission.id);
    });
  });
});
