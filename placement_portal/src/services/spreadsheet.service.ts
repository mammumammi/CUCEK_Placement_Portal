/**
 * @fileoverview Client service for drive application spreadsheets, applicant rows, and inline cell editing.
 * @module services/spreadsheet.service
 */

import { apiClient } from '@/lib/api-client';

export interface RowPermissions {
  canEditExtraData: boolean;
  canVerify: boolean;
  locked: boolean;
  reason: string | null;
}

export interface DriveExtraField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'dropdown';
  options?: string[];
  required: boolean;
}

export interface SpreadsheetRow {
  applicationId: string;
  driveId: string;
  studentUserId: string;
  extraData: Record<string, any>;
  verified: boolean;
  verifiedBy: string | null;
  placed: boolean;
  appliedAt: string | Date;
  studentId: string;
  name: string;
  branch: string | null;
  batch: string;
  email: string;
  phone: string;
  activeBacklogs: number;
  cgpa: number;
  resumeUrl: string | null;
  permissions: RowPermissions;
}

export interface SaveRowPayload {
  extraData?: Record<string, any>;
  verified?: boolean;
}

export interface ApplyToDrivePayload {
  extraData?: Record<string, any>;
}

export interface ApplyResponse {
  applicationId: string;
  driveId: string;
  status: string;
}

/**
 * Fetches all spreadsheet application rows for a recruitment drive scoped to current user's role.
 *
 * @param driveId - Unique drive UUID.
 * @returns Array of candidate application rows including RBAC permissions.
 */
export async function getRows(driveId: string): Promise<SpreadsheetRow[]> {
  const response = await apiClient.get<SpreadsheetRow[]>(
    `/spreadsheet/drives/${driveId}/rows`
  );
  return response.data;
}

/**
 * Submits a candidate application to a recruitment drive.
 *
 * @param driveId - Unique drive UUID.
 * @param payload - Optional initial extra data answers.
 * @returns Application creation receipt.
 */
export async function applyToDrive(
  driveId: string,
  payload: ApplyToDrivePayload = {}
): Promise<ApplyResponse> {
  const response = await apiClient.post<ApplyResponse>(
    `/spreadsheet/drives/${driveId}/apply`,
    payload
  );
  return response.data;
}

/**
 * Persists inline row modifications (extraData fields or verification status).
 *
 * @param driveId - Unique drive UUID.
 * @param studentId - Candidate college ID.
 * @param payload - Updated extraData and/or verified boolean flag.
 * @returns Updated candidate application row.
 */
export async function saveRowUpdate(
  driveId: string,
  studentId: string,
  payload: SaveRowPayload
): Promise<SpreadsheetRow> {
  const response = await apiClient.patch<SpreadsheetRow>(
    `/spreadsheet/drives/${driveId}/rows/${studentId}`,
    payload
  );
  return response.data;
}

export const spreadsheetService = {
  getRows,
  applyToDrive,
  saveRowUpdate,
};

