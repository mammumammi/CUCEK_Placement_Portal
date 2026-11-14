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

export interface DriveItem {
  id: string;
  company: string;
  role: string | null;
  description: string | null;
  packageCategory: PackageCategory;
  ctcLpa: number | null;
  jdFileUrl: string | null;
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
  eligible?: boolean;
  reasons?: string[];
  userApplied?: boolean;
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
}

export interface NotificationRecipient {
  email: string;
  name: string;
  studentId: string;
  branch: string;
  cgpa: number;
  activeBacklogs: number;
  applicationLink: string;
}

export interface NotificationResult {
  driveId: string;
  driveTitle: string;
  totalEligible: number;
  sentCount: number;
  recipients: NotificationRecipient[];
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
 * Analyzes and summarizes a Job Description (PDF file or raw text) using Gemini AI with deterministic fallback.
 */
export async function summarizeJd(params: { file?: File; text?: string }): Promise<JdSummaryResult> {
  const formData = new FormData();
  if (params.file) {
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

