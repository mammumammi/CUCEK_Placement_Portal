'use client';

/**
 * @fileoverview Container component for drive application spreadsheets.
 * Fetches scoped rows, displays cutoff deadline alert banner, and renders the interactive SpreadsheetGrid.
 *
 * @module components/spreadsheet/DrivesSpreadsheet
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { DeadlineBanner } from './DeadlineBanner';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { useOptionalAuth } from '@/context/auth-context';
import { RefreshCw, Users, ShieldCheck, Activity } from 'lucide-react';
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
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const [rows, setRows] = useState<SpreadsheetRow[]>(initialRows || []);
  const [loading, setLoading] = useState<boolean>(!initialRows);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [error, setError] = useState<string | null>(null);

  const isInitialLoad = useRef(true);

  const loadRows = useCallback(
    async (showLoadingSpinner = true) => {
      if (showLoadingSpinner) setLoading(true);
      else setIsSyncing(true);
      setError(null);
      try {
        const fetchedRows = await spreadsheetService.getRows(driveId);
        setRows(fetchedRows);
        setLastSyncTime(new Date().toLocaleTimeString());
      } catch (err: unknown) {
        if (showLoadingSpinner) {
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
        }
      } finally {
        if (showLoadingSpinner) setLoading(false);
        else setIsSyncing(false);
      }
    },
    [driveId]
  );

  useEffect(() => {
    if (!initialRows && isInitialLoad.current) {
      isInitialLoad.current = false;
      void loadRows(true);
    }
  }, [loadRows, initialRows]);

  // Real-time polling simulation: background sync every 4000ms
  useEffect(() => {
    const pollInterval = setInterval(() => {
      void loadRows(false);
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [loadRows]);

  return (
    <div className="w-full space-y-3">
      {deadline && <DeadlineBanner deadline={deadline} />}

      {/* Real-time Collaboration & Permissions Indicator Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-300">
        <div className="flex items-center gap-2.5">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div>
            <span className="font-semibold text-white">Realtime Excel Simulation:</span>{' '}
            <span className="text-neutral-400">
              {user?.role === 'STUDENT'
                ? 'All applicants are visible in real-time. You can only edit your own row.'
                : 'Live multi-user candidate roster active.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-neutral-400 font-mono text-[11px]">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>Synced: {lastSyncTime}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadRows(false)}
            disabled={isSyncing}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-[11px] font-medium transition disabled:opacity-50"
            title="Force immediate spreadsheet synchronization"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {loading && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-center py-12"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
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
            onClick={() => void loadRows(true)}
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

