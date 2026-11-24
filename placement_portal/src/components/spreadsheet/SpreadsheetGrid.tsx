'use client';

/**
 * @fileoverview Drive application spreadsheet grid using @tanstack/react-table and Tailwind CSS.
 * Enforces server-provided row permissions, read-only core profile attributes, inline extra-field
 * editing, verification toggles, and individual row save handling with error reporting.
 *
 * @module components/spreadsheet/SpreadsheetGrid
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  useLegacyTable as useReactTable,
  getCoreRowModel,
  type LegacyColumnDef as ColumnDef,
} from '@tanstack/react-table/legacy';
import { flexRender } from '@tanstack/react-table';
import { Lock, FileSpreadsheet, Check, CheckCircle2, User, Search, Eye, ArrowDown, ShieldAlert } from 'lucide-react';
import { useOptionalAuth } from '@/context/auth-context';
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
  const auth = useOptionalAuth();
  const user = auth?.user ?? null;
  const [data, setData] = useState<SpreadsheetRow[]>(initialRows);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [savingRows, setSavingRows] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Selected cell coordinate and content for simulated Excel formula bar
  const [selectedCell, setSelectedCell] = useState<{
    coord: string;
    value: string;
    fieldLabel: string;
    studentId: string;
  } | null>(null);

  const myRowRef = useRef<HTMLTableRowElement | null>(null);

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
        header: 'A • Student ID',
        cell: ({ row }) => {
          const isMyRow = Boolean(
            (user?.role === 'STUDENT' && (row.original.studentUserId === user?.id || row.original.studentId === user?.username)) ||
            (row.original.permissions.canEditExtraData && !row.original.permissions.locked)
          );

          return (
            <div
              onClick={() => {
                setSelectedCell({
                  coord: `A${row.index + 1}`,
                  value: row.original.studentId,
                  fieldLabel: 'Student ID',
                  studentId: row.original.studentId,
                });
              }}
              className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded border border-gray-200 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-label="locked" />
              <input
                type="text"
                readOnly
                disabled
                value={row.original.studentId}
                className="bg-transparent text-gray-800 text-xs font-mono w-full focus:outline-none cursor-pointer"
              />
              {isMyRow && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  You
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'name',
        header: 'B • Name',
        cell: ({ row }) => (
          <div
            onClick={() => {
              setSelectedCell({
                coord: `B${row.index + 1}`,
                value: row.original.name,
                fieldLabel: 'Name',
                studentId: row.original.studentId,
              });
            }}
            className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded border border-gray-200 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-label="locked" />
            <input
              type="text"
              readOnly
              disabled
              value={row.original.name}
              className="bg-transparent text-gray-800 text-xs font-medium w-full focus:outline-none cursor-pointer"
            />
          </div>
        ),
      },
      {
        accessorKey: 'branch',
        header: 'C • Branch',
        cell: ({ row }) => (
          <div
            onClick={() => {
              setSelectedCell({
                coord: `C${row.index + 1}`,
                value: row.original.branch || 'N/A',
                fieldLabel: 'Branch',
                studentId: row.original.studentId,
              });
            }}
            className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded border border-gray-200 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-label="locked" />
            <input
              type="text"
              readOnly
              disabled
              value={row.original.branch || 'N/A'}
              className="bg-transparent text-gray-800 text-xs w-full focus:outline-none cursor-pointer"
            />
          </div>
        ),
      },
      {
        accessorKey: 'cgpa',
        header: 'D • CGPA',
        cell: ({ row }) => (
          <div
            onClick={() => {
              setSelectedCell({
                coord: `D${row.index + 1}`,
                value: String(row.original.cgpa),
                fieldLabel: 'CGPA',
                studentId: row.original.studentId,
              });
            }}
            className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded border border-gray-200 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-label="locked" />
            <input
              type="text"
              readOnly
              disabled
              value={
                typeof row.original.cgpa === 'number'
                  ? row.original.cgpa.toFixed(2)
                  : String(row.original.cgpa)
              }
              className="bg-transparent text-gray-800 text-xs font-semibold w-full focus:outline-none cursor-pointer"
            />
          </div>
        ),
      },
    ];

    // Dynamic extra-fields columns with Excel coordinate letters (E, F, G...)
    extraFields.forEach((field, fieldIdx) => {
      const colLetter = String.fromCharCode(69 + fieldIdx); // 69 is 'E'
      cols.push({
        id: `extra_${field.key}`,
        header: `${colLetter} • ${field.label}${field.required ? ' *' : ''}`,
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

          return (
            <div
              onClick={() => {
                setSelectedCell({
                  coord: `${colLetter}${row.index + 1}`,
                  value: String(currentVal ?? ''),
                  fieldLabel: field.label,
                  studentId,
                });
              }}
              className="w-full"
            >
              {field.type === 'dropdown' ? (
                <select
                  disabled={!canEdit || isSaving}
                  value={currentVal}
                  aria-label={field.label}
                  onChange={(e) =>
                    handleExtraDataChange(studentId, field.key, e.target.value)
                  }
                  className={`w-full text-xs px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none transition ${
                    canEdit
                      ? 'bg-white border-emerald-400 font-medium text-emerald-950 shadow-2xs'
                      : 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-500'
                  }`}
                  title={canEdit ? 'Edit your response' : 'Peer student field (Read-only)'}
                >
                  <option value="">Select {field.label}...</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === 'number' ? (
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
                  className={`w-full text-xs px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none transition ${
                    canEdit
                      ? 'bg-white border-emerald-400 font-medium text-emerald-950 shadow-2xs'
                      : 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-500'
                  }`}
                  title={canEdit ? 'Edit your response' : 'Peer student field (Read-only)'}
                />
              ) : (
                <input
                  type="text"
                  disabled={!canEdit || isSaving}
                  value={currentVal}
                  placeholder={field.label}
                  aria-label={field.label}
                  onChange={(e) =>
                    handleExtraDataChange(studentId, field.key, e.target.value)
                  }
                  className={`w-full text-xs px-2 py-1.5 border rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-none transition ${
                    canEdit
                      ? 'bg-white border-emerald-400 font-medium text-emerald-950 shadow-2xs'
                      : 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-500'
                  }`}
                  title={canEdit ? 'Edit your response' : 'Peer student field (Read-only)'}
                />
              )}
              {row.original.additionalDetails?.[field.key] !== undefined && currentVal !== '' && currentVal !== undefined && (
                <span className="text-[9px] font-semibold text-emerald-500 font-mono mt-0.5 block flex items-center gap-0.5">
                  ✨ Autofilled
                </span>
              )}
            </div>
          );
        },
      });
    });

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

        const isStudentRole = user?.role === 'STUDENT';
        const isMyRow = Boolean(
          (isStudentRole && (row.original.studentUserId === user?.id || row.original.studentId === user?.username)) ||
          (perms.canEditExtraData && !perms.locked)
        );

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

              {isStudentRole && !isMyRow ? (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed select-none"
                  title="Peer student row. You can only edit your own data."
                >
                  <Lock className="w-3 h-3 text-gray-400" />
                  Read-Only
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSave(row.original)}
                  disabled={!canSave}
                  className="px-3 py-1.5 text-xs font-bold rounded-md text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition duration-150 flex items-center gap-1.5 shadow-2xs"
                  title={canSave ? 'Save your changes to the live spreadsheet' : 'Make edits to enable save'}
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
              )}
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
    user,
  ]);

  const filteredData = useMemo(() => {
    if (!searchFilter.trim()) return tableData;
    const q = searchFilter.toLowerCase();
    return tableData.filter(
      (r) =>
        r.studentId.toLowerCase().includes(q) ||
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.branch && r.branch.toLowerCase().includes(q))
    );
  }, [tableData, searchFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const scrollToMyRow = () => {
    if (myRowRef.current) {
      myRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="w-full rounded-xl border border-neutral-300 shadow-md bg-white overflow-hidden">
      {/* Simulated Excel Ribbon Bar */}
      <div className="bg-[#107c41] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold select-none">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="h-4 w-4 text-emerald-200 shrink-0" />
          <span className="font-bold tracking-tight">Recruitment_Drive_Applications.xlsx</span>
          <span className="text-[10px] bg-emerald-800/80 text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-600 font-mono">
            AutoSave: ON
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {user?.role === 'STUDENT' && (
            <button
              type="button"
              onClick={scrollToMyRow}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white text-[#107c41] rounded-md text-[11px] font-bold hover:bg-emerald-50 transition shadow-2xs"
            >
              <ArrowDown className="h-3 w-3" />
              <span>Jump to My Row</span>
            </button>
          )}

          <div className="relative">
            <Search className="h-3 w-3 absolute left-2 top-2 text-emerald-700" />
            <input
              type="text"
              placeholder="Search student or branch..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-7 pr-2.5 py-1 text-[11px] rounded bg-white text-gray-900 placeholder-gray-400 focus:outline-none w-36 sm:w-48 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Simulated Excel Formula Bar */}
      <div className="bg-neutral-100 border-b border-neutral-300 px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-neutral-700 select-none">
        <div className="bg-white border border-neutral-300 px-2.5 py-0.5 rounded text-[11px] font-bold min-w-12 text-center text-neutral-800 shadow-2xs">
          {selectedCell ? selectedCell.coord : 'A1'}
        </div>
        <span className="text-neutral-400 font-bold italic">fx</span>
        <div className="flex-1 bg-white border border-neutral-300 px-3 py-0.5 rounded text-[11px] text-neutral-900 truncate shadow-2xs">
          {selectedCell ? (
            <span>
              <span className="text-neutral-400">{selectedCell.fieldLabel} [{selectedCell.studentId}]: </span>
              <span className="font-semibold">{selectedCell.value || '<empty>'}</span>
            </span>
          ) : (
            <span className="text-neutral-400 italic">Select any spreadsheet cell to inspect coordinate and value</span>
          )}
        </div>
      </div>

      {/* Spreadsheet Table Grid */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-neutral-100 border-b border-neutral-300 text-xs font-semibold text-neutral-600 select-none">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {/* Row Number Header Gutter */}
                <th className="w-10 px-2 py-2 text-center text-[10px] font-mono text-neutral-400 border-r border-neutral-300 bg-neutral-200/70">
                  #
                </th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 whitespace-nowrap tracking-wider border-r border-neutral-200 last:border-r-0"
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
          <tbody className="divide-y divide-neutral-200 text-xs font-mono">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-sm text-neutral-500 font-sans"
                >
                  {searchFilter
                    ? 'No candidates matched your search filter.'
                    : 'No applications registered for this recruitment drive yet.'}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, rowIdx) => {
                const isStudentRole = user?.role === 'STUDENT';
                const isMyRow = Boolean(
                  (isStudentRole && (row.original.studentUserId === user?.id || row.original.studentId === user?.username)) ||
                  (row.original.permissions.canEditExtraData && !row.original.permissions.locked)
                );

                return (
                  <tr
                    key={row.id}
                    ref={isMyRow ? myRowRef : undefined}
                    className={`transition-colors ${
                      isMyRow
                        ? 'bg-emerald-50/80 hover:bg-emerald-100/70 border-l-4 border-l-emerald-600'
                        : 'hover:bg-neutral-50/90'
                    }`}
                  >
                    {/* Row Index Number Gutter */}
                    <td className="w-10 px-2 py-2 text-center text-[11px] font-mono text-neutral-400 bg-neutral-100/80 border-r border-neutral-300 select-none">
                      {rowIdx + 1}
                    </td>

                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2 whitespace-nowrap border-r border-neutral-200 last:border-r-0"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Simulated Excel Bottom Sheet Tab Bar */}
      <div className="bg-neutral-100 border-t border-neutral-300 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600 select-none font-sans">
        <div className="flex items-center gap-1.5">
          <div className="bg-white px-3 py-1 rounded-t border-t-2 border-t-emerald-600 border-x border-neutral-300 font-semibold text-emerald-950 flex items-center gap-1.5 text-xs shadow-2xs">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Sheet1 - Applicants Roster ({filteredData.length})</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-mono">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Ready
          </span>
          <span>&bull;</span>
          <span>Zoom: 100%</span>
        </div>
      </div>
    </div>
  );
}

export default SpreadsheetGrid;
