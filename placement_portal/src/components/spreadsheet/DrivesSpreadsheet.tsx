'use client';

/**
 * @fileoverview Container component for drive application spreadsheets.
 * Fetches scoped rows, displays cutoff deadline alert banner, and renders the interactive SpreadsheetGrid.
 *
 * @module components/spreadsheet/DrivesSpreadsheet
 */

import React, { useEffect, useState, useCallback } from 'react';
import { DeadlineBanner } from './DeadlineBanner';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import type {
  SpreadsheetRow,
  DriveExtraField,
} from '@/services/spreadsheet.service';
import { spreadsheetService } from '@/services/spreadsheet.service';

export interface DrivesSpreadsheetProps {
  driveId: string;
  deadline?: string;
  extraFields?: DriveExtraField[];
  initialRows?: SpreadsheetRow[];
}

export function DrivesSpreadsheet({
  driveId,
  deadline,
  extraFields = [],
  initialRows,
}: DrivesSpreadsheetProps) {
  const [rows, setRows] = useState<SpreadsheetRow[]>(initialRows || []);
  const [loading, setLoading] = useState<boolean>(!initialRows);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedRows = await spreadsheetService.getRows(driveId);
      setRows(fetchedRows);
    } catch (err: unknown) {
      const axiosError = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      const message =
        axiosError.response?.data?.error?.message ||
        axiosError.response?.data?.message ||
        axiosError.message ||
        'Failed to load spreadsheet rows';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [driveId]);

  useEffect(() => {
    if (!initialRows) {
      loadRows();
    }
  }, [loadRows, initialRows]);

  return (
    <div className="w-full space-y-4">
      {deadline && <DeadlineBanner deadline={deadline} />}

      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center py-12"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <span className="sr-only">Loading spreadsheet...</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 border border-red-200 text-sm text-red-700 font-medium flex items-center justify-between"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={loadRows}
            className="text-indigo-600 underline font-semibold text-xs hover:text-indigo-800"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <SpreadsheetGrid
          rows={rows}
          driveId={driveId}
          extraFields={extraFields}
          onRowUpdated={(updatedRow) => {
            setRows((prev) =>
              prev.map((r) =>
                r.studentId === updatedRow.studentId ? updatedRow : r
              )
            );
          }}
        />
      )}
    </div>
  );
}

export default DrivesSpreadsheet;
