/**
 * @fileoverview Zod validation schemas for mock assessment generation, code execution, and submission.
 * @module server/modules/assessments/assessments.schema
 */

import { z } from 'zod';

export const runCodeSchema = z.object({
  language: z.enum(['javascript', 'python', 'java', 'cpp']),
  code: z.string().trim().min(1, 'Code cannot be empty'),
  questionId: z.string().optional(),
  customInput: z.string().optional(),
  testCases: z
    .array(
      z.object({
        input: z.string(),
        expectedOutput: z.string(),
        explanation: z.string().optional(),
      })
    )
    .optional(),
});

export type RunCodeInput = z.infer<typeof runCodeSchema>;

export const submitAssessmentSchema = z.object({
  timeSpentSeconds: z.coerce.number().int().min(0).default(0),
  answers: z.record(
    z.string(),
    z.object({
      code: z.string(),
      language: z.enum(['javascript', 'python', 'java', 'cpp']),
    })
  ),
});

export type SubmitAssessmentInput = z.infer<typeof submitAssessmentSchema>;

export const generateAssessmentSchema = z.object({
  force: z.boolean().optional().default(false),
});

export type GenerateAssessmentInput = z.infer<typeof generateAssessmentSchema>;
