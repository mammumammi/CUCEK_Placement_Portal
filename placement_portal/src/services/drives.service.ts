/**
 * @fileoverview Frontend service for recruitment drives, JD AI summarization, and candidate notifications.
 * @module services/drives.service
 */

import { apiClient } from '@/lib/api-client';

export type PackageCategory = 'GENERAL' | 'DREAM' | 'INTERNSHIP';

export interface DriveExtraField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'dropdown';
  options?: string[];
  required: boolean;
}

export interface CompanyFormatColumn {
  companyHeader: string;
  sourceField: string;
  customValue?: string;
  customKey?: string;
}

export interface ParsedCompanyTemplate {
  headers: string[];
  suggestedColumns: CompanyFormatColumn[];
}

export interface DriveItem {
  id: string;
  company: string;
  role: string | null;
  description: string | null;
  packageCategory: PackageCategory;
  ctcLpa: number | null;
  youtubeUrl?: string | null;
  registrationLink?: string | null;
  jdFileUrl: string | null;
  jdFileUrls?: string[];
  mockTestPdfUrls?: string[];
  codingEnabled?: boolean;
  companyFormat?: CompanyFormatColumn[];
  deadline: string;
  eligibleBranches: string[];
  minCgpa: number;
  maxActiveBacklogs: number;
  allowBacklogs: boolean;
  extraFields: DriveExtraField[];
  totalRounds: number;
  createdBy: string;
  createdAt: string;
  open: boolean;
  isPrevious?: boolean;
  placedCandidates?: {
    userId: string;
    studentId: string;
    name: string | null;
    branch: string | null;
  }[];
  eligible?: boolean;
  reasons?: string[];
  userApplied?: boolean;
}

export interface MatchedShortlistStudent {
  userId: string;
  studentId: string;
  name: string;
  branch: string;
  email: string | null;
  matchSource: 'ROLL_NO' | 'REG_NO' | 'EMAIL' | 'NAME';
}

export interface JdSummaryResult {
  company: string;
  role: string;
  summary: string;
  packageCategory: PackageCategory;
  ctcLpa: number | null;
  minCgpa: number;
  allowBacklogs: boolean;
  maxActiveBacklogs: number;
  eligibleBranches: string[];
  youtubeUrl?: string | null;
}

export interface BranchPlacementStat {
  branch: string;
  total: number;
  placed: number;
  placementRate: number;
}

export interface PublicFeaturedDrive {
  id: string;
  company: string;
  role: string | null;
  packageCategory: PackageCategory;
  ctcLpa: number | null;
  deadline: string;
  eligibleBranches: string[];
  open: boolean;
}

export interface PublicPlacementStats {
  totalStudents: number;
  totalPlaced: number;
  placementRate: number;
  highestPackage: number;
  averagePackage: number;
  totalDrives: number;
  branchBreakdown: BranchPlacementStat[];
  topCompanies: string[];
  featuredDrives: PublicFeaturedDrive[];
}

export interface NotificationRecipient {
  userId?: string;
  email: string;
  name: string;
  studentId: string;
  branch: string;
  cgpa: number;
  activeBacklogs: number;
  applicationLink: string;
}

export interface NotificationResult {
  driveId?: string;
  driveTitle?: string;
  totalEligible?: number;
  sentCount?: number;
  recipients?: NotificationRecipient[];
  count?: number;
  drive?: {
    id: string;
    company: string;
    role: string | null;
    packageCategory: string | null;
    ctcLpa: number | null;
    sheetLink: string;
  };
}

export interface DriveStats {
  driveId: string;
  company: string;
  totalApplications: number;
  verifiedApplications: number;
  pendingApplications: number;
  placedCount: number;
  totalRounds: number;
}

/**
 * Lists all recruitment drives accessible to the current user.
 */
export async function listDrives(): Promise<DriveItem[]> {
  const response = await apiClient.get<DriveItem[]>('/drives');
  return response.data;
}

/**
 * Retrieves a single drive's detailed metadata and eligibility status.
 */
export async function getDriveById(driveId: string): Promise<DriveItem> {
  const response = await apiClient.get<DriveItem>(`/drives/${driveId}`);
  return response.data;
}

/**
 * Creates a new placement drive, optionally uploading JD PDF and triggering email notification.
 */
export async function createDrive(formData: FormData): Promise<DriveItem & { notification?: NotificationResult | null }> {
  const response = await apiClient.post<DriveItem & { notification?: NotificationResult | null }>(
    '/drives',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

/**
 * Analyzes and summarizes one or multiple Job Description PDF files or raw text using Gemini AI with deterministic fallback.
 */
export async function summarizeJd(params: {
  files?: File[];
  file?: File;
  text?: string;
}): Promise<JdSummaryResult> {
  const formData = new FormData();
  if (params.files && params.files.length > 0) {
    params.files.forEach((f) => formData.append('files', f));
  } else if (params.file) {
    formData.append('file', params.file);
  }
  if (params.text) {
    formData.append('text', params.text);
  }

  const response = await apiClient.post<JdSummaryResult>(
    '/drives/summarize-jd',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

/**
 * Uploads a company required Excel template (.xlsx) to extract its header row and auto-suggest column mappings.
 */
export async function parseCompanyTemplate(file: File): Promise<ParsedCompanyTemplate> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ParsedCompanyTemplate>(
    '/drives/parse-company-template',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

/**
 * Downloads candidate reports in standard format or company required schema.
 */
export async function downloadDriveExport(
  driveId: string,
  options?: { format?: 'default' | 'company'; companyName?: string }
): Promise<void> {
  const isCompany = options?.format === 'company';
  const url = isCompany ? `/drives/${driveId}/export-company` : `/drives/${driveId}/export`;
  const response = await apiClient.get(url, { responseType: 'blob' });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  const safeCompany = (options?.companyName || 'Drive').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = isCompany
    ? `${safeCompany}_Company_Format_Candidates.xlsx`
    : `${safeCompany}_Candidates.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

/**
 * Dispatches announcement emails to all eligible students containing the application sheet link.
 */
export async function notifyEligibleStudents(
  driveId: string,
  baseUrl?: string
): Promise<NotificationResult> {
  const response = await apiClient.post<NotificationResult>(
    `/drives/${driveId}/notify`,
    { baseUrl }
  );
  return response.data;
}

/**
 * Retrieves candidate statistics and funnel metrics for a recruitment drive.
 */
export async function getDriveStats(driveId: string): Promise<DriveStats> {
  const response = await apiClient.get<DriveStats>(`/drives/${driveId}/stats`);
  return response.data;
}

/**
 * Retrieves public placement highlights and department breakdown for the public homepage.
 */
export async function getPublicPlacementStats(): Promise<PublicPlacementStats> {
  const response = await apiClient.get<PublicPlacementStats>('/drives/public-stats');
  return response.data;
}

/**
 * Appends or replaces dynamic questionnaire fields to collect additional info as a batch from applicants.
 */
export async function updateDriveExtraFields(
  driveId: string,
  payload: { extraFields?: DriveExtraField[]; newField?: DriveExtraField }
): Promise<{ driveId: string; extraFields: DriveExtraField[] }> {
  const response = await apiClient.patch<{ driveId: string; extraFields: DriveExtraField[] }>(
    `/drives/${driveId}/extra-fields`,
    payload
  );
  return response.data;
}

export interface StatsTemplateStatus {
  hasTemplate: boolean;
  filename?: string;
  uploadedAt?: string;
  sheetNames?: string[];
  sizeBytes?: number;
}

/**
 * Checks whether the Super Admin has uploaded a reference statistics Excel template.
 */
export async function getStatsTemplateStatus(): Promise<StatsTemplateStatus> {
  const response = await apiClient.get<StatsTemplateStatus>('/drives/statistics/template-status');
  return response.data;
}

/**
 * Uploads a reference Excel template (.xlsx) for placement and department statistics generation.
 */
export async function uploadStatsReferenceTemplate(
  file: File
): Promise<{ success: boolean; message: string; filename: string; sheetNames: string[] }> {
  const formData = new FormData();
  formData.append('template', file);

  const response = await apiClient.post<{
    success: boolean;
    message: string;
    filename: string;
    sheetNames: string[];
  }>('/drives/statistics/template', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Resets / deletes the active reference statistics template.
 */
export async function deleteStatsReferenceTemplate(): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>('/drives/statistics/template');
  return response.data;
}

/**
 * Returns direct URL for downloading the current reference template.
 */
export function getStatsTemplateDownloadUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  return `${base}/drives/statistics/download-template`;
}

/**
 * Returns direct URL for downloading the generated comprehensive placement statistics Excel.
 */
export function getComprehensiveStatisticsExportUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  return `${base}/drives/statistics/export-excel`;
}

/**
 * Updates an existing drive's details such as YouTube URL, role, category, and criteria.
 */
export async function updateDriveDetails(
  driveId: string,
  payload: {
    company?: string;
    role?: string;
    description?: string;
    packageCategory?: PackageCategory;
    ctcLpa?: number | null;
    youtubeUrl?: string | null;
    registrationLink?: string | null;
    codingEnabled?: boolean;
  }
): Promise<DriveItem> {
  const response = await apiClient.patch<DriveItem>(`/drives/${driveId}/details`, payload);
  return response.data;
}

/**
 * Permanently deletes / takes down a recruitment drive.
 * Super Admin (MAIN_COORDINATOR) only.
 */
export async function deleteDrive(
  driveId: string
): Promise<{ success: boolean; deletedDriveId: string; company: string; role?: string | null; message: string }> {
  const response = await apiClient.delete<{
    success: boolean;
    deletedDriveId: string;
    company: string;
    role?: string | null;
    message: string;
  }>(`/drives/${driveId}`);
  return response.data;
}

/**
 * Helper to convert various YouTube URL formats (standard, shorts, youtu.be, embed)
 * into a standard responsive embed URL.
 */
export function getYouTubeEmbedUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const regExp = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regExp);
  return match && match[1] ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export { uploadMockTestPdf } from './assessments.service';

/**
 * Uploads a shortlisted candidate PDF (or text) for a drive and matches students from the database.
 */
export async function parseShortlistPdf(
  driveId: string,
  params: { file?: File; rawText?: string }
): Promise<{
  matchedStudents: MatchedShortlistStudent[];
  extractedPreview: string;
}> {
  const formData = new FormData();
  if (params.file) {
    formData.append('file', params.file);
  }
  if (params.rawText) {
    formData.append('rawText', params.rawText);
  }
  const response = await apiClient.post<{
    matchedStudents: MatchedShortlistStudent[];
    extractedPreview: string;
  }>(`/drives/${driveId}/shortlist/parse-pdf`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Confirms shortlisted students for a drive round/interview and dispatches in-app portal notifications.
 */
export async function notifyShortlistedStudents(
  driveId: string,
  payload: {
    studentUserIds: string[];
    roundNumber: number;
    roundName?: string;
    markAsPlaced?: boolean;
  }
): Promise<{
  success: boolean;
  notifiedCount: number;
  roundLabel: string;
  message: string;
}> {
  const response = await apiClient.post<{
    success: boolean;
    notifiedCount: number;
    roundLabel: string;
    message: string;
  }>(`/drives/${driveId}/shortlist/notify`, payload);
  return response.data;
}


