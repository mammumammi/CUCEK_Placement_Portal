'use client';

/**
 * @fileoverview Drive application spreadsheet grid using @tanstack/react-table and Tailwind CSS.
 * Enforces server-provided row permissions, read-only core profile attributes, inline extra-field
 * editing, verification toggles, and individual row save handling with error reporting.
 *
 * @module components/spreadsheet/SpreadsheetGrid
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  useLegacyTable as useReactTable,
  getCoreRowModel,
  type LegacyColumnDef as ColumnDef,
} from '@tanstack/react-table/legacy';
import { flexRender } from '@tanstack/react-table';
import { Lock } from 'lucide-react';
import type {
  SpreadsheetRow,
  DriveExtraField,
  SaveRowPayload,
} from '@/services/spreadsheet.service';
import { saveRowUpdate } from '@/services/spreadsheet.service';

export interface SpreadsheetGridProps {
  rows: SpreadsheetRow[];
  driveId: string;
  extraFields?: DriveExtraField[];
  onSaveRow?: (
    driveId: string,
    studentId: string,
    payload: SaveRowPayload
  ) => Promise<SpreadsheetRow | void>;
  onRowUpdated?: (updatedRow: SpreadsheetRow) => void;
}

interface RowDraft {
  extraData: Record<string, any>;
  verified: boolean;
}

export function SpreadsheetGrid({
  rows: initialRows,
  driveId,
  extraFields = [],
  onSaveRow,
  onRowUpdated,
}: SpreadsheetGridProps) {
  const [data, setData] = useState<SpreadsheetRow[]>(initialRows);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  // Sync state if initialRows changes
  useEffect(() => {
    setData(initialRows);
    const initialDrafts: Record<string, RowDraft> = {};
    for (const r of initialRows) {
      initialDrafts[r.studentId] = {
        extraData: { ...(r.extraData || {}) },
        verified: r.verified,
      };
    }
    setDrafts(initialDrafts);
  }, [initialRows]);

  // Derive reactive table data so TanStack Table recomputes rows upon drafts, save state, or errors
  const tableData = useMemo(() => {
    return data.map((row) => {
      const draft = drafts[row.studentId];
      return {
        ...row,
        extraData: draft ? draft.extraData : row.extraData,
        verified: draft ? draft.verified : row.verified,
      };
    });
  }, [data, drafts, savingRows, serverErrors]);

  const handleExtraDataChange = useCallback(
    (studentId: string, fieldKey: string, value: any) => {
      setDrafts((prev) => {
        const current = prev[studentId] || { extraData: {}, verified: false };
        return {
          ...prev,
          [studentId]: {
            ...current,
            extraData: {
              ...current.extraData,
              [fieldKey]: value,
            },
          },
        };
      });
      // Clear server error upon new edits
      setServerErrors((prev) => {
        if (!prev[studentId]) return prev;
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    },
    []
  );

  const handleVerifiedChange = useCallback(
    (studentId: string, verified: boolean) => {
      setDrafts((prev) => {
        const current = prev[studentId] || { extraData: {}, verified: false };
        return {
          ...prev,
          [studentId]: {
            ...current,
            verified,
          },
        };
      });
      // Clear server error upon new edits
      setServerErrors((prev) => {
        if (!prev[studentId]) return prev;
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    },
    []
  );

  const isRowEdited = useCallback(
    (row: SpreadsheetRow): boolean => {
      const draft = drafts[row.studentId];
      if (!draft) return false;

      // Find original baseline row in unmutated data
      const originalRow =
        data.find((r) => r.studentId === row.studentId) || row;

      if (
        row.permissions.canVerify &&
        draft.verified !== originalRow.verified
      ) {
        return true;
      }

      if (row.permissions.canEditExtraData) {
        const originalExtra = originalRow.extraData || {};
        const draftExtra = draft.extraData || {};
        const keys = Array.from(
          new Set([...Object.keys(originalExtra), ...Object.keys(draftExtra)])
        );

        for (const k of keys) {
          const v1 = originalExtra[k] ?? '';
          const v2 = draftExtra[k] ?? '';
          if (String(v1) !== String(v2)) {
            return true;
          }
        }
      }

      return false;
    },
    [drafts, data]
  );

  const handleSave = useCallback(
    async (row: SpreadsheetRow) => {
      const draft = drafts[row.studentId];
      if (!draft) return;

      setSavingRows((prev) => ({ ...prev, [row.studentId]: true }));
      setServerErrors((prev) => {
        const next = { ...prev };
        delete next[row.studentId];
        return next;
      });

      const payload: SaveRowPayload = {};
      if (row.permissions.canEditExtraData) {
        payload.extraData = draft.extraData;
      }
      if (row.permissions.canVerify) {
        payload.verified = draft.verified;
      }

      try {
        const result = onSaveRow
          ? await onSaveRow(driveId, row.studentId, payload)
          : await saveRowUpdate(driveId, row.studentId, payload);

        const updatedRow: SpreadsheetRow = result
          ? (result as SpreadsheetRow)
          : {
              ...row,
              extraData: payload.extraData ?? row.extraData,
              verified: payload.verified ?? row.verified,
            };

        // Update local row record
        setData((prev) =>
          prev.map((r) => (r.studentId === row.studentId ? updatedRow : r))
        );

        // Reset draft baseline
        setDrafts((prev) => ({
          ...prev,
          [row.studentId]: {
            extraData: { ...(updatedRow.extraData || {}) },
            verified: updatedRow.verified,
          },
        }));

        onRowUpdated?.(updatedRow);
      } catch (err: unknown) {
        const axiosError = err as {
          response?: {
            data?: { error?: { message?: string }; message?: string };
          };
          message?: string;
        };
        const message =
          axiosError.response?.data?.error?.message ||
          axiosError.response?.data?.message ||
          axiosError.message ||
          'Failed to save row changes';

        setServerErrors((prev) => ({ ...prev, [row.studentId]: message }));
      } finally {
        setSavingRows((prev) => ({ ...prev, [row.studentId]: false }));
      }
    },
    [drafts, driveId, onSaveRow, onRowUpdated]
  );

  const columns = useMemo<ColumnDef<SpreadsheetRow>[]>(() => {
    const cols: ColumnDef<SpreadsheetRow>[] = [
      {
        accessorKey: 'studentId',
        header: 'Student ID',
        cell: ({ row }) => (
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded border border-gray-200">
            <Lock
              className="w-3.5 h-3.5 text-gray-400 shrink-0"
              aria-label="locked"
            />
            <input
              type="text"
              readOnly
              disabled
              value={row.original.studentId}
              className="bg-transparent text-gray-700 text-xs font-mono w-full focus:outline-none cursor-not-allowed"
            />
          </div>
        ),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded border border-gray-200">
            <Lock
              className="w-3.5 h-3.5 text-gray-400 shrink-0"
              aria-label="locked"
            />
            <input
              type="text"
              readOnly
              disabled
              value={row.original.name}
              className="bg-transparent text-gray-700 text-xs w-full focus:outline-none cursor-not-allowed"
            />
          </div>
        ),
      },
      {
        accessorKey: 'branch',
        header: 'Branch',
        cell: ({ row }) => (
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded border border-gray-200">
            <Lock
              className="w-3.5 h-3.5 text-gray-400 shrink-0"
              aria-label="locked"
            />
            <input
              type="text"
              readOnly
              disabled
              value={row.original.branch || 'N/A'}
              className="bg-transparent text-gray-700 text-xs w-full focus:outline-none cursor-not-allowed"
            />
          </div>
        ),
      },
      {
        accessorKey: 'cgpa',
        header: 'CGPA',
        cell: ({ row }) => (
          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded border border-gray-200">
            <Lock
              className="w-3.5 h-3.5 text-gray-400 shrink-0"
              aria-label="locked"
            />
            <input
              type="text"
              readOnly
              disabled
              value={
                typeof row.original.cgpa === 'number'
                  ? row.original.cgpa.toFixed(2)
                  : String(row.original.cgpa)
              }
              className="bg-transparent text-gray-700 text-xs font-semibold w-full focus:outline-none cursor-not-allowed"
            />
          </div>
        ),
      },
    ];

    // Dynamic extra-fields columns
    for (const field of extraFields) {
      cols.push({
        id: `extra_${field.key}`,
        header: `${field.label}${field.required ? ' *' : ''}`,
        cell: ({ row }) => {
          const studentId = row.original.studentId;
          const canEdit =
            row.original.permissions.canEditExtraData &&
            !row.original.permissions.locked;
          const isSaving = Boolean(savingRows[studentId]);
          const currentVal =
            drafts[studentId]?.extraData?.[field.key] ??
            row.original.extraData?.[field.key] ??
            '';

          if (field.type === 'dropdown') {
            return (
              <select
                disabled={!canEdit || isSaving}
                value={currentVal}
                aria-label={field.label}
                onChange={(e) =>
                  handleExtraDataChange(studentId, field.key, e.target.value)
                }
                className={`w-full text-xs px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                  canEdit
                    ? 'bg-white border-gray-300'
                    : 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-500'
                }`}
              >
                <option value="">Select {field.label}...</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            );
          }

          if (field.type === 'number') {
            return (
              <input
                type="number"
                disabled={!canEdit || isSaving}
                value={currentVal}
                placeholder={field.label}
                aria-label={field.label}
                onChange={(e) => {
                  const val =
                    e.target.value === '' ? '' : Number(e.target.value);
                  handleExtraDataChange(studentId, field.key, val);
                }}
                className={`w-full text-xs px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                  canEdit
                    ? 'bg-white border-gray-300'
                    : 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-500'
                }`}
              />
            );
          }

          // text default
          return (
            <input
              type="text"
              disabled={!canEdit || isSaving}
              value={currentVal}
              placeholder={field.label}
              aria-label={field.label}
              onChange={(e) =>
                handleExtraDataChange(studentId, field.key, e.target.value)
              }
              className={`w-full text-xs px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                canEdit
                  ? 'bg-white border-gray-300'
                  : 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-500'
              }`}
            />
          );
        },
      });
    }

    // Actions & Verification column
    cols.push({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const studentId = row.original.studentId;
        const perms = row.original.permissions;
        const isSaving = Boolean(savingRows[studentId]);
        const serverError = serverErrors[studentId];
        const draft = drafts[studentId];
        const isVerified = draft?.verified ?? row.original.verified;
        const edited = isRowEdited(row.original);
        const permitted =
          (perms.canEditExtraData || perms.canVerify) && !perms.locked;
        const canSave = edited && permitted && !isSaving;

        return (
          <div className="flex flex-col gap-1.5 items-start">
            <div className="flex items-center gap-3">
              {perms.canVerify && (
                <label className="inline-flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    aria-label="Verified"
                    checked={Boolean(isVerified)}
                    disabled={isSaving}
                    onChange={(e) =>
                      handleVerifiedChange(studentId, e.target.checked)
                    }
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <span>Verified</span>
                </label>
              )}

              <button
                type="button"
                onClick={() => handleSave(row.original)}
                disabled={!canSave}
                className="px-3 py-1.5 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <svg
                      className="animate-spin h-3.5 w-3.5 text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  'Save Row'
                )}
              </button>
            </div>

            {serverError && (
              <div
                role="alert"
                className="text-xs text-red-600 font-medium"
              >
                {serverError}
              </div>
            )}
          </div>
        );
      },
    });

    return cols;
  }, [
    extraFields,
    drafts,
    savingRows,
    serverErrors,
    handleExtraDataChange,
    handleVerifiedChange,
    handleSave,
    isRowEdited,
  ]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 shadow-sm bg-white">
      <table className="w-full text-left border-collapse">
        <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-medium text-gray-500">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 whitespace-nowrap tracking-wider"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-200 text-sm">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-gray-500"
              >
                No applications registered for this drive yet.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50/75 transition-colors"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-2.5 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default SpreadsheetGrid;
