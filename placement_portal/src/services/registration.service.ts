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

export interface HeaderMappingDetail {
  field: string | null;
  confidence: number;
  source: 'exact' | 'pattern' | 'ai';
}

export interface SheetAnalysisDetail {
  sheetName: string;
  headerRow: number;
  headers: string[];
  rowCount: number;
  mapping: Record<string, HeaderMappingDetail>;
  missingRequired: string[];
}

export interface AnalyzeResponse {
  sheets: SheetAnalysisDetail[];
}

/**
 * Analyzes an uploaded Excel file structure, detecting header row and mapping columns.
 *
 * @param file - The .xlsx spreadsheet file to analyze.
 * @returns Sheet analysis including detected header row, headers, and mapping predictions.
 */
export async function analyzeBulkRegistration(file: File): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<AnalyzeResponse>('/registration/analyze', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

/**
 * Uploads an Excel file to generate a validation preview without writing to the database.
 *
 * @param file - The .xlsx spreadsheet file to preview.
 * @param mapping - Optional column-to-canonical field mapping overrides.
 * @returns Parsed rows with validation error lists and summary metrics.
 */
export async function previewBulkRegistration(
  file: File,
  mapping?: Record<string, string>
): Promise<PreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (mapping) {
    formData.append('mapping', JSON.stringify(mapping));
  }

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
 * @param opts - Optional flags such as skipInvalid and column mapping overrides.
 * @returns Count of created and skipped student records.
 */
export async function commitBulkRegistration(
  file: File,
  opts?: { skipInvalid?: boolean; mapping?: Record<string, string> }
): Promise<CommitResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (opts?.mapping) {
    formData.append('mapping', JSON.stringify(opts.mapping));
  }

  const response = await apiClient.post<CommitResponse>('/registration/commit', formData, {
    params: opts?.skipInvalid ? { skipInvalid: 'true' } : undefined,
    headers: {
      // Explicitly override default application/json so browser/axios sets multipart/form-data with boundary
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

