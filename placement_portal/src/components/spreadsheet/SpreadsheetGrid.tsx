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
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black rounded-lg border border-neutral-800 hover:border-neutral-700 cursor-pointer transition"
            >
              <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" aria-label="locked" />
              <input
                type="text"
                readOnly
                disabled
                value={row.original.studentId}
                className="bg-transparent text-white text-xs font-mono font-medium w-full focus:outline-none cursor-pointer"
              />
              {isMyRow && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-black border border-white shadow-xs">
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black rounded-lg border border-neutral-800 hover:border-neutral-700 cursor-pointer transition"
          >
            <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" aria-label="locked" />
            <input
              type="text"
              readOnly
              disabled
              value={row.original.name}
              className="bg-transparent text-white text-xs font-medium w-full focus:outline-none cursor-pointer"
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black rounded-lg border border-neutral-800 hover:border-neutral-700 cursor-pointer transition"
          >
            <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" aria-label="locked" />
            <input
              type="text"
              readOnly
              disabled
              value={row.original.branch || 'N/A'}
              className="bg-transparent text-white text-xs font-medium w-full focus:outline-none cursor-pointer"
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
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black rounded-lg border border-neutral-800 hover:border-neutral-700 cursor-pointer transition"
          >
            <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" aria-label="locked" />
            <input
              type="text"
              readOnly
              disabled
              value={
                typeof row.original.cgpa === 'number'
                  ? row.original.cgpa.toFixed(2)
                  : String(row.original.cgpa)
              }
              className="bg-transparent text-white text-xs font-bold w-full focus:outline-none cursor-pointer"
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
                  className={`w-full text-xs px-2.5 py-1.5 border rounded-lg focus:ring-1 focus:ring-white focus:outline-none transition ${
                    canEdit
                      ? 'bg-black border-neutral-700 hover:border-neutral-500 text-white font-medium shadow-xs'
                      : 'bg-black border-neutral-800/80 cursor-not-allowed text-neutral-400'
                  }`}
                  title={canEdit ? 'Edit your response' : 'Peer student field (Read-only)'}
                >
                  <option value="" className="bg-black text-neutral-400">Select {field.label}...</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt} className="bg-black text-white">
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
                  className={`w-full text-xs px-2.5 py-1.5 border rounded-lg focus:ring-1 focus:ring-white focus:outline-none transition ${
                    canEdit
                      ? 'bg-black border-neutral-700 hover:border-neutral-500 text-white font-medium placeholder-neutral-500 shadow-xs'
                      : 'bg-black border-neutral-800/80 cursor-not-allowed text-neutral-400 placeholder-neutral-600'
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
                  className={`w-full text-xs px-2.5 py-1.5 border rounded-lg focus:ring-1 focus:ring-white focus:outline-none transition ${
                    canEdit
                      ? 'bg-black border-neutral-700 hover:border-neutral-500 text-white font-medium placeholder-neutral-500 shadow-xs'
                      : 'bg-black border-neutral-800/80 cursor-not-allowed text-neutral-400 placeholder-neutral-600'
                  }`}
                  title={canEdit ? 'Edit your response' : 'Peer student field (Read-only)'}
                />
              )}
              {row.original.additionalDetails?.[field.key] !== undefined && currentVal !== '' && currentVal !== undefined && (
                <span className="text-[10px] font-semibold text-emerald-400 font-mono mt-1 flex items-center gap-1">
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
                <label className="inline-flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    aria-label="Verified"
                    checked={Boolean(isVerified)}
                    disabled={isSaving}
                    onChange={(e) =>
                      handleVerifiedChange(studentId, e.target.checked)
                    }
                    className="rounded border-neutral-700 bg-black text-emerald-500 focus:ring-white h-4 w-4"
                  />
                  <span className="text-white font-medium">Verified</span>
                </label>
              )}

              {isStudentRole && !isMyRow ? (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-black text-neutral-400 border border-neutral-800 cursor-not-allowed select-none"
                  title="Peer student row. You can only edit your own data."
                >
                  <Lock className="w-3 h-3 text-neutral-500" />
                  Read-Only
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSave(row.original)}
                  disabled={!canSave}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg text-black bg-white hover:bg-neutral-200 disabled:bg-black disabled:text-neutral-500 disabled:border-neutral-800 disabled:cursor-not-allowed border border-white transition duration-150 flex items-center gap-1.5 shadow-xs"
                  title={canSave ? 'Save your changes to the live spreadsheet' : 'Make edits to enable save'}
                >
                  {isSaving ? (
                    <>
                      <svg
                        className="animate-spin h-3.5 w-3.5 text-black"
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
                className="text-xs text-red-400 font-medium"
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
    <div className="w-full rounded-2xl border border-neutral-800 shadow-2xl bg-black overflow-hidden">
      {/* Simulated Excel Ribbon Bar */}
      <div className="bg-black border-b border-neutral-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold select-none">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded-md bg-neutral-900 border border-neutral-800">
            <FileSpreadsheet className="h-4 w-4 text-white shrink-0" />
          </div>
          <span className="font-bold tracking-tight text-white">Recruitment_Drive_Applications.xlsx</span>
          <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded-full border border-neutral-700 font-mono font-semibold">
            AutoSave: ON
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {user?.role === 'STUDENT' && (
            <button
              type="button"
              onClick={scrollToMyRow}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-black rounded-lg text-[11px] font-bold hover:bg-neutral-200 transition shadow-xs"
            >
              <ArrowDown className="h-3 w-3" />
              <span>Jump to My Row</span>
            </button>
          )}

          <div className="relative">
            <Search className="h-3 w-3 absolute left-2.5 top-2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search student or branch..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-2.5 py-1 text-xs rounded-lg bg-black border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white w-36 sm:w-48 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Simulated Excel Formula Bar */}
      <div className="bg-black border-b border-neutral-800 px-3 py-1.5 flex items-center gap-2 text-xs font-mono text-neutral-300 select-none">
        <div className="bg-black border border-neutral-700 px-2.5 py-0.5 rounded text-[11px] font-bold min-w-12 text-center text-white shadow-inner">
          {selectedCell ? selectedCell.coord : 'A1'}
        </div>
        <span className="text-neutral-500 font-bold italic px-0.5">fx</span>
        <div className="flex-1 bg-black border border-neutral-700 px-3 py-0.5 rounded text-[11px] text-white truncate shadow-inner">
          {selectedCell ? (
            <span>
              <span className="text-neutral-400">{selectedCell.fieldLabel} [{selectedCell.studentId}]: </span>
              <span className="font-semibold text-white">{selectedCell.value || '<empty>'}</span>
            </span>
          ) : (
            <span className="text-neutral-500 italic">Select any spreadsheet cell to inspect coordinate and value</span>
          )}
        </div>
      </div>

      {/* Spreadsheet Table Grid */}
      <div className="w-full overflow-x-auto bg-black">
        <table className="w-full text-left border-collapse bg-black">
          <thead className="bg-[#0c0c0e] border-b border-neutral-800 text-xs font-semibold text-neutral-300 select-none">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {/* Row Number Header Gutter */}
                <th className="w-10 px-2 py-2 text-center text-[10px] font-mono text-neutral-500 border-r border-neutral-800 bg-[#0c0c0e]">
                  #
                </th>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-2.5 whitespace-nowrap tracking-wider border-r border-neutral-800 last:border-r-0 text-white font-bold"
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
          <tbody className="divide-y divide-neutral-800/80 text-xs font-mono bg-black">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-sm text-neutral-400 font-sans"
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
                        ? 'bg-neutral-900/90 hover:bg-neutral-800/80 border-l-4 border-l-white ring-1 ring-white/10'
                        : 'bg-black hover:bg-neutral-900/50'
                    }`}
                  >
                    {/* Row Index Number Gutter */}
                    <td className="w-10 px-2 py-2 text-center text-[11px] font-mono text-neutral-500 bg-[#0c0c0e] border-r border-neutral-800 select-none">
                      {rowIdx + 1}
                    </td>

                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2 whitespace-nowrap border-r border-neutral-800 last:border-r-0 text-white"
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
      <div className="bg-[#0c0c0e] border-t border-neutral-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400 select-none font-sans">
        <div className="flex items-center gap-1.5">
          <div className="bg-black px-3.5 py-1.5 rounded-t-lg border-t-2 border-t-white border-x border-neutral-800 font-bold text-white flex items-center gap-2 text-xs shadow-md">
            <FileSpreadsheet className="h-3.5 w-3.5 text-white" />
            <span>Sheet1 - Applicants Roster ({filteredData.length})</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-neutral-300 font-medium">Ready</span>
          </span>
          <span className="text-neutral-600">&bull;</span>
          <span>Zoom: 100%</span>
        </div>
      </div>
    </div>
  );
}

export default SpreadsheetGrid;
