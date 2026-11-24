/**
 * @fileoverview Database schema for Online Assessment (OA) mock coding rounds,
 * questions generated from previous years web data, and student test submissions.
 * @module core/db/schema/assessments
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users } from './users.schema';
import { drives } from './drives.schema';

export interface TestCaseItem {
  input: string;
  expectedOutput: string;
  explanation?: string;
  isHidden?: boolean;
}

export interface MockOAQuestion {
  id: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  topic: string;
  description: string;
  constraints: string[];
  inputFormat: string;
  outputFormat: string;
  starterCode: Record<string, string>;
  sampleTestCases: TestCaseItem[];
  hiddenTestCases: TestCaseItem[];
  optimalComplexity?: {
    time: string;
    space: string;
  };
}

export interface OAAnalyticsInsights {
  overview: string;
  difficultyTrend: { easy: number; medium: number; hard: number };
  frequentTopics: string[];
  companyOAPattern: string;
  recentYearsAnalyzed: string[];
}

/**
 * Mock Online Assessment (OA) rounds generated from big data web analytics of previous years' questions.
 */
export const mockAssessments = sqliteTable(
  'mock_assessments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    driveId: text('driveId').references(() => drives.id, { onDelete: 'cascade' }),
    company: text('company').notNull(),
    role: text('role'),
    title: text('title').notNull(),
    durationMinutes: integer('durationMinutes').notNull().default(60),
    totalQuestions: integer('totalQuestions').notNull().default(2),
    topicDistribution: text('topicDistribution', { mode: 'json' })
      .$type<Record<string, number | string>>()
      .default({}),
    analyticsInsights: text('analyticsInsights', { mode: 'json' })
      .$type<OAAnalyticsInsights>()
      .default({
        overview: '',
        difficultyTrend: { easy: 30, medium: 50, hard: 20 },
        frequentTopics: [],
        companyOAPattern: '',
        recentYearsAnalyzed: ['2023', '2024', '2025'],
      }),
    questions: text('questions', { mode: 'json' })
      .$type<MockOAQuestion[]>()
      .default([]),
    createdAt: integer('createdAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('mock_assessments_drive_id_idx').on(table.driveId),
    index('mock_assessments_company_idx').on(table.company),
  ]
);

export type MockAssessment = InferSelectModel<typeof mockAssessments>;
export type NewMockAssessment = InferInsertModel<typeof mockAssessments>;

export interface QuestionSubmissionResult {
  code: string;
  language: string;
  status: 'PASSED' | 'PARTIAL' | 'FAILED';
  passedTestCases: number;
  totalTestCases: number;
  results: Array<{
    testCaseIndex: number;
    passed: boolean;
    actualOutput?: string;
    expectedOutput?: string;
    runtimeMs?: number;
    error?: string;
  }>;
}

export interface SubmissionFeedback {
  summary: string;
  strengths: string[];
  areasForImprovement: string[];
  percentileEstimate: number;
}

/**
 * Student mock assessment submissions with score, execution outputs, and performance feedback.
 */
export const mockSubmissions = sqliteTable(
  'mock_submissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    assessmentId: text('assessmentId')
      .notNull()
      .references(() => mockAssessments.id, { onDelete: 'cascade' }),
    studentUserId: text('studentUserId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    driveId: text('driveId'),
    score: real('score').notNull().default(0),
    totalQuestions: integer('totalQuestions').notNull().default(0),
    passedQuestions: integer('passedQuestions').notNull().default(0),
    timeSpentSeconds: integer('timeSpentSeconds').notNull().default(0),
    answers: text('answers', { mode: 'json' })
      .$type<Record<string, QuestionSubmissionResult>>()
      .default({}),
    feedback: text('feedback', { mode: 'json' })
      .$type<SubmissionFeedback>()
      .default({
        summary: '',
        strengths: [],
        areasForImprovement: [],
        percentileEstimate: 50,
      }),
    submittedAt: integer('submittedAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('mock_submissions_assessment_id_idx').on(table.assessmentId),
    index('mock_submissions_student_user_id_idx').on(table.studentUserId),
  ]
);

export type MockSubmission = InferSelectModel<typeof mockSubmissions>;
export type NewMockSubmission = InferInsertModel<typeof mockSubmissions>;
