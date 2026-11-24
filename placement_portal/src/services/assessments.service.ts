/**
 * @fileoverview Frontend client service for Mock Online Assessment (OA) rounds and web data analytics.
 * @module services/assessments.service
 */

import { apiClient } from '@/lib/api-client';

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
  starterCode: {
    javascript: string;
    python: string;
    java: string;
    cpp: string;
  };
  sampleTestCases: TestCaseItem[];
  hiddenTestCases: TestCaseItem[];
  optimalComplexity?: {
    time: string;
    space: string;
  };
}

export interface MockMCQQuestion {
  id: string;
  questionNumber: number;
  category: 'QUANTITATIVE_APTITUDE' | 'LOGICAL_REASONING' | 'CORE_CS' | 'COMPANY_STACK';
  question: string;
  options: [string, string, string, string];
  correctOptionIndex?: number;
  explanation?: string;
}

export interface DataProvenanceSource {
  name: string;
  type?: string;
  sampleCount?: number;
  recordsSampled?: number;
  sourceUrl?: string;
  url?: string;
  lastCrawled: string;
  reliabilityScore: number;
}

export interface DataProvenanceRecord {
  collectedAt?: string;
  corpusVolume?: number;
  totalRecordsMined?: number;
  sources: DataProvenanceSource[];
  crawlerNodes: string[];
  pipelineSteps?: string[];
  pipelineArchitecture?: string[];
  verificationConfidence?: number;
  confidenceScore?: number;
  harvestMethod?: string;
  multiAgentMetadata?: {
    researchAgentModel?: string;
    synthesisAgentModel?: string;
    totalCodingGenerated?: number;
    totalMcqsGenerated?: number;
    mockPdfAttached?: boolean;
  };
  multiAgentDetails?: {
    researchAgent: string;
    synthesisAgent: string;
    generatedAt: string;
    pdfSourceIncluded: boolean;
  };
}

export interface OAAnalyticsInsights {
  overview: string;
  difficultyTrend: { easy: number; medium: number; hard: number };
  frequentTopics: string[];
  companyOAPattern: string;
  recentYearsAnalyzed: string[];
}

export interface MockAssessmentData {
  id: string;
  driveId: string | null;
  company: string;
  role: string | null;
  title: string;
  durationMinutes: number;
  totalQuestions: number;
  topicDistribution: Record<string, number | string>;
  analyticsInsights: OAAnalyticsInsights;
  questions: MockOAQuestion[];
  mcqQuestions?: MockMCQQuestion[];
  dataProvenance?: DataProvenanceRecord;
  mockTestPdfUrls?: string[];
  createdAt: string;
}

export interface RunCodePayload {
  language: 'javascript' | 'python' | 'java' | 'cpp';
  code: string;
  questionId?: string;
  customInput?: string;
  testCases?: TestCaseItem[];
}

export interface RunCodeResultItem {
  testCaseIndex: number;
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  runtimeMs: number;
  error?: string;
  status: 'PASSED' | 'FAILED' | 'TIMEOUT' | 'ERROR';
}

export interface CloudExecutionTelemetry {
  cloudProvider: string;
  region: string;
  containerId: string;
  vCpuAllocation: string;
  memoryLimitMb: number;
  memoryUsedMb: number;
  executionTimeMs: number;
  cloudStatus: 'ACTIVE_ISOLATED';
  orchestrationType: string;
}

export interface CohortDistributionPoint {
  runtimeMs: number;
  density: number;
  label: string;
}

export interface BigDataAssessmentAnalytics {
  datasetMetadata: {
    totalSubmissionsAnalyzed: number;
    archivesCovered: string[];
    yearsSpan: string;
    normalizedTelemetrySizeMb: number;
    samplingMethod: string;
  };
  cohortRuntimeDistribution: {
    medianRuntimeMs: number;
    p90RuntimeMs: number;
    tleRatePercentage: number;
    bellCurvePoints: CohortDistributionPoint[];
  };
  predictiveHiringModel: {
    shortlistProbability: number;
    interviewClearanceRate: number;
    companyHiringBar: 'TOP_TIER_ELITE' | 'HIGH' | 'MODERATE';
    recommendedFocusAreas: string[];
  };
  historicalTopicWeightage: Record<string, number>;
  complexityDistribution: {
    optimalTimeComplexity: string;
    optimalSpaceComplexity: string;
    linearOrLogarithmicRate: number;
    quadraticOrHigherRate: number;
  };
}

export interface RunCodeResponse {
  results: RunCodeResultItem[];
  cloudTelemetry?: CloudExecutionTelemetry;
  allPassed: boolean;
  totalCount: number;
  passedCount: number;
}

export interface SubmitAnswersPayload {
  timeSpentSeconds: number;
  answers?: Record<
    string,
    {
      language: 'javascript' | 'python' | 'java' | 'cpp';
      code: string;
    }
  >;
  mcqAnswers?: Record<string, number>;
}

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

export interface MockSubmissionData {
  id: string;
  assessmentId: string;
  studentUserId: string;
  driveId: string | null;
  score: number;
  mcqScore?: number;
  codingScore?: number;
  totalQuestions: number;
  passedQuestions: number;
  totalMcqs?: number;
  passedMcqs?: number;
  timeSpentSeconds: number;
  answers: Record<string, QuestionSubmissionResult>;
  mcqAnswers?: Record<string, number>;
  feedback: SubmissionFeedback;
  submittedAt: string;
}

/**
 * Retrieves the simulated mock OA for a recruitment drive (auto-synthesizes if missing).
 */
export async function getDriveMockOA(driveId: string): Promise<MockAssessmentData> {
  const response = await apiClient.get<{ assessment: MockAssessmentData }>(
    `/assessments/drive/${driveId}`
  );
  return response.data.assessment;
}

/**
 * Triggers re-analysis of internet archives to generate a fresh company OA simulation.
 */
export async function generateDriveMockOA(
  driveId: string,
  force = true
): Promise<MockAssessmentData> {
  const response = await apiClient.post<{ assessment: MockAssessmentData }>(
    `/assessments/drive/${driveId}/generate`,
    { force }
  );
  return response.data.assessment;
}

/**
 * Executes student code in a sandboxed runner against sample test cases.
 */
export async function runCode(
  assessmentId: string,
  payload: RunCodePayload
): Promise<RunCodeResponse> {
  const response = await apiClient.post<RunCodeResponse>(
    `/assessments/${assessmentId}/run`,
    payload
  );
  return response.data;
}

/**
 * Evaluates candidate code against hidden boundary test cases and computes score/feedback.
 */
export async function submitMockAssessment(
  assessmentId: string,
  payload: SubmitAnswersPayload
): Promise<MockSubmissionData> {
  const response = await apiClient.post<{ submission: MockSubmissionData }>(
    `/assessments/${assessmentId}/submit`,
    payload
  );
  return response.data.submission;
}

/**
 * Retrieves Big Data cohort benchmarks and predictive hiring models for the assessment.
 */
export async function getBigDataAssessmentAnalytics(
  assessmentId: string
): Promise<BigDataAssessmentAnalytics> {
  const response = await apiClient.get<{ analytics: BigDataAssessmentAnalytics }>(
    `/assessments/${assessmentId}/big-data-analytics`
  );
  return response.data.analytics;
}

/**
 * Retrieves past mock assessment attempts for the authenticated student.
 */
export async function getMySubmissions(
  assessmentId: string
): Promise<MockSubmissionData[]> {
  const response = await apiClient.get<{ submissions: MockSubmissionData[] }>(
    `/assessments/${assessmentId}/submissions/me`
  );
  return response.data.submissions;
}

/**
 * Uploads a reference mock test PDF for a recruitment drive to guide multi-agent OA synthesis.
 */
export async function uploadMockTestPdf(
  driveId: string,
  file: File
): Promise<{ success: boolean; driveId: string; mockTestPdfUrls: string[]; message?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<{
    success: boolean;
    driveId: string;
    mockTestPdfUrls: string[];
    message?: string;
  }>(`/drives/${driveId}/mock-test-pdf`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}
