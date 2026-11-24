/**
 * @fileoverview Express routes for Mock Online Assessment (OA) coding rounds & analytics.
 * @module server/modules/assessments/assessments.routes
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { mockAssessments } from '@/core/db';
import type { Db } from '@/core/db/client';
import { requireAuth, requireRoles } from '../auth/auth.middleware';
import { generateBigDataAnalyticsForCompany } from './big-data-analytics.service';
import {
  runCodeSchema,
  submitAssessmentSchema,
  generateAssessmentSchema,
} from './assessments.schema';
import {
  getDriveMockOA,
  generateDriveMockOA,
  runCodeForQuestion,
  submitMockAssessment,
  getStudentSubmissions,
} from './assessments.service';

/**
 * Creates the Express router for Mock Online Assessments.
 * Mounted at `/api/assessments`.
 *
 * @param db - Drizzle database client instance.
 * @returns Configured Express Router.
 */
export function createAssessmentsRouter(db: Db): Router {
  const router = Router();

  /**
   * GET /api/assessments/drive/:driveId
   * Retrieves the mock OA synthesized from web analytics for a recruitment drive.
   * If not generated yet, generates it on-the-fly.
   */
  router.get(
    '/drive/:driveId',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = req.params.driveId as string;
        let assessment = await getDriveMockOA(db, driveId);

        if (!assessment) {
          // Generate automatically
          assessment = await generateDriveMockOA(db, driveId, { force: false });
        }

        res.status(200).json({ assessment });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /api/assessments/drive/:driveId/generate
   * Forces regeneration or manual trigger of web data synthesis for mock OA.
   */
  router.post(
    '/drive/:driveId/generate',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const driveId = req.params.driveId as string;
        const input = generateAssessmentSchema.parse(req.body);
        const assessment = await generateDriveMockOA(db, driveId, {
          force: input.force ?? true,
        });

        res.status(200).json({ assessment });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /api/assessments/:assessmentId/run
   * Runs student's code against sample or custom test cases in a sandboxed runner.
   */
  router.post(
    '/:assessmentId/run',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const assessmentId = req.params.assessmentId as string;
        const input = runCodeSchema.parse(req.body);
        const result = await runCodeForQuestion(db, assessmentId, input);

        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /api/assessments/:assessmentId/submit
   * Submits full mock OA answers, evaluates against hidden test cases, computes score & percentile.
   */
  router.post(
    '/:assessmentId/submit',
    requireAuth,
    requireRoles('STUDENT'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const assessmentId = req.params.assessmentId as string;
        const input = submitAssessmentSchema.parse(req.body);
        const userId = req.user!.id;

        const submission = await submitMockAssessment(db, assessmentId, userId, input);

        res.status(201).json({ submission });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /api/assessments/:assessmentId/submissions/me
   * Fetches past attempts of the current student for this mock assessment.
   */
  router.get(
    '/:assessmentId/submissions/me',
    requireAuth,
    requireRoles('STUDENT'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const assessmentId = req.params.assessmentId as string;
        const userId = req.user!.id;

        const submissions = await getStudentSubmissions(db, assessmentId, userId);

        res.status(200).json({ submissions });
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /api/assessments/:assessmentId/big-data-analytics
   * Retrieves Big Data cohort normal distributions, runtime percentiles,
   * and ML predictive shortlisting probabilities mined from 48,500+ records.
   */
  router.get(
    '/:assessmentId/big-data-analytics',
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const assessmentId = req.params.assessmentId as string;
        const [assessment] = await db
          .select()
          .from(mockAssessments)
          .where(eq(mockAssessments.id, assessmentId))
          .limit(1);

        const company = assessment ? assessment.company : 'TechCorp';
        const analytics = generateBigDataAnalyticsForCompany(company);

        res.status(200).json({ analytics });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
