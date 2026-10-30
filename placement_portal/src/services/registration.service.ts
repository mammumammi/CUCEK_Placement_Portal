/**
 * @fileoverview Frontend registration service for bulk student upload preview and commit.
 * @module services/registration.service
 */

import { apiClient } from '@/lib/api-client';

export interface PreviewRow {
  rowNumber: number;
  data: Record<string, unknown>;
  cgpa: number;
  errors: string[];
}

export interface RegistrationSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicatesInFile: number;
  duplicatesInDb: number;
}

export interface PreviewResponse {
  rows: PreviewRow[];
  summary: RegistrationSummary;
}

export interface CommitResponse {
  created: number;
  skipped: number;
}

/**
 * Uploads an Excel file to generate a validation preview without writing to the database.
 *
 * @param file - The .xlsx spreadsheet file to preview.
 * @returns Parsed rows with validation error lists and summary metrics.
 */
export async function previewBulkRegistration(file: File): Promise<PreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<PreviewResponse>('/registration/preview', formData, {
    headers: {
      // Explicitly override default application/json so browser/axios sets multipart/form-data with boundary
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Commits the bulk registration of students from an Excel file in a single database transaction.
 *
 * @param file - The .xlsx spreadsheet file to commit.
 * @param opts - Optional flags such as skipInvalid to ignore flawed rows.
 * @returns Count of created and skipped student records.
 */
export async function commitBulkRegistration(
  file: File,
  opts?: { skipInvalid?: boolean }
): Promise<CommitResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<CommitResponse>('/registration/commit', formData, {
    params: opts?.skipInvalid ? { skipInvalid: 'true' } : undefined,
    headers: {
      // Explicitly override default application/json so browser/axios sets multipart/form-data with boundary
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

