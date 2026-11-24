'use client';

/**
 * @fileoverview Placed Students Management Component.
 * Enables Branch Coordinators and Super Coordinators (Main Admins) to:
 * 1. View live roster of placed students with real-time CTC and package analytics.
 * 2. Record placements manually per student.
 * 3. Batch upload placed students via validated Excel spreadsheets (.xlsx).
 * 4. Download a pre-formatted Excel template for placements.
 * 5. Unmark/delete placement records with instant sync to pie charts and department stats.
 *
 * @module components/placements/PlacedStudentsManager
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ExcelJS from 'exceljs';
import {
  Award,
  Briefcase,
  Upload,
  Download,
  Plus,
  Search,
  Trash2,
  Building2,
  CheckCircle,
  AlertTriangle,
  X,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  DollarSign,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  listPlacedStudents,
  recordPlacedStudentManual,
  previewPlacedStudentsExcel,
  commitPlacedStudentsBatch,
  unmarkPlacedStudent,
  type PlacedStudentRecord,
  type RecordPlacedStudentPayload,
  type BatchPreviewPlacedResponse,
} from '@/services/profiles.service';

const ALL_BRANCHES = ['ALL', 'CSE', 'ECE', 'EEE', 'IT', 'CIVIL', 'MCA'] as const;

interface PlacedStudentsManagerProps {
  userRole: 'MAIN_COORDINATOR' | 'BRANCH_COORDINATOR';
  userBranch?: string;
  onStatsUpdated?: () => void;
}

export function PlacedStudentsManager({
  userRole,
  userBranch,
  onStatsUpdated,
}: PlacedStudentsManagerProps) {
  // Roster state
  const [placedList, setPlacedList] = useState<PlacedStudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(
    userRole === 'BRANCH_COORDINATOR' && userBranch ? userBranch : 'ALL'
  );

  // Notifications
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Manual Entry Modal
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualForm, setManualForm] = useState<{
    studentId: string;
    company: string;
    role: string;
    ctcLpa: string;
    packageCategory: 'GENERAL' | 'DREAM' | 'INTERNSHIP';
  }>({
    studentId: '',
    company: '',
    role: '',
    ctcLpa: '',
    packageCategory: 'GENERAL',
  });
  const [manualError, setManualError] = useState<string | null>(null);

  // Batch Excel Upload Modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<BatchPreviewPlacedResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [batchCommitting, setBatchCommitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete / Unmark Confirmation Modal
  const [unmarkTarget, setUnmarkTarget] = useState<PlacedStudentRecord | null>(null);
  const [unmarking, setUnmarking] = useState(false);

  // Load placed students
  const fetchPlacedStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const branchParam =
        userRole === 'BRANCH_COORDINATOR'
          ? userBranch
          : selectedBranchFilter !== 'ALL'
          ? selectedBranchFilter
          : undefined;

      const data = await listPlacedStudents(branchParam);
      setPlacedList(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load placed students.');
    } finally {
      setLoading(false);
    }
  }, [userRole, userBranch, selectedBranchFilter]);

  useEffect(() => {
    void fetchPlacedStudents();
  }, [fetchPlacedStudents]);

  // Auto-dismiss feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Analytics KPIs computed from the loaded roster
  const metrics = useMemo(() => {
    const total = placedList.length;
    if (total === 0) {
      return { total: 0, highest: 0, average: 0, dreamCount: 0 };
    }
    const packages = placedList
      .map((p) => p.ctcLpa)
      .filter((p): p is number => typeof p === 'number' && p > 0);
    const highest = packages.length > 0 ? Math.max(...packages) : 0;
    const average =
      packages.length > 0
        ? +(packages.reduce((acc, curr) => acc + curr, 0) / packages.length).toFixed(2)
        : 0;
    const dreamCount = placedList.filter(
      (p) => p.packageCategory === 'DREAM' || (p.ctcLpa !== null && p.ctcLpa >= 10)
    ).length;
    return { total, highest, average, dreamCount };
  }, [placedList]);

  // Search Filtered Roster
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return placedList;
    const q = searchQuery.toLowerCase();
    return placedList.filter(
      (p) =>
        p.studentId.toLowerCase().includes(q) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        p.company.toLowerCase().includes(q) ||
        (p.role && p.role.toLowerCase().includes(q)) ||
        (p.branch && p.branch.toLowerCase().includes(q))
    );
  }, [placedList, searchQuery]);

  // 1. Download Pre-Formatted Excel Sample Template
  const handleDownloadTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Placed_Students');

      sheet.columns = [
        { header: 'Student ID / Roll No', key: 'studentId', width: 22 },
        { header: 'Company Name', key: 'company', width: 26 },
        { header: 'CTC (LPA)', key: 'ctcLpa', width: 14 },
        { header: 'Role / Designation', key: 'role', width: 24 },
        { header: 'Category (GENERAL / DREAM / INTERNSHIP)', key: 'packageCategory', width: 34 },
      ];

      // Sample mock data rows
      sheet.addRow({
        studentId: '2022BCSE001',
        company: 'Google',
        ctcLpa: 28.5,
        role: 'Software Development Engineer',
        packageCategory: 'DREAM',
      });
      sheet.addRow({
        studentId: '2022BCSE002',
        company: 'Microsoft',
        ctcLpa: 22.0,
        role: 'Software Engineer',
        packageCategory: 'DREAM',
      });
      sheet.addRow({
        studentId: '2022BECE005',
        company: 'Tata Consultancy Services (TCS)',
        ctcLpa: 7.0,
        role: 'Digital Systems Trainee',
        packageCategory: 'GENERAL',
      });

      // Style header row
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A1A1E' },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'placed_students_batch_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: 'Could not generate template: ' + (err?.message || 'Unknown error'),
      });
    }
  };

  // 2. Manual Entry Submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);

    const sId = manualForm.studentId.trim().toUpperCase();
    const comp = manualForm.company.trim();

    if (!sId) {
      setManualError('Student ID is required.');
      return;
    }
    if (!comp) {
      setManualError('Company Name is required.');
      return;
    }

    const ctc = manualForm.ctcLpa ? parseFloat(manualForm.ctcLpa) : null;
    if (ctc !== null && (isNaN(ctc) || ctc < 0)) {
      setManualError('CTC in LPA must be a non-negative number.');
      return;
    }

    try {
      setManualSubmitting(true);
      const res = await recordPlacedStudentManual({
        studentId: sId,
        company: comp,
        role: manualForm.role.trim() || undefined,
        ctcLpa: ctc,
        packageCategory: manualForm.packageCategory,
      });

      setFeedback({
        type: 'success',
        message: res.message || `Successfully recorded placement for ${sId} at ${comp}!`,
      });

      setManualModalOpen(false);
      setManualForm({
        studentId: '',
        company: '',
        role: '',
        ctcLpa: '',
        packageCategory: 'GENERAL',
      });

      void fetchPlacedStudents();
      onStatsUpdated?.();
    } catch (err: any) {
      setManualError(
        err?.response?.data?.message || err?.message || 'Failed to record student placement.'
      );
    } finally {
      setManualSubmitting(false);
    }
  };

  // 3. Batch Excel Upload - File Selection & Preview Call
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBatchFile(file);
    setPreviewError(null);
    setPreviewData(null);
    setPreviewLoading(true);

    try {
      const res = await previewPlacedStudentsExcel(file);
      setPreviewData(res);
    } catch (err: any) {
      setPreviewError(
        err?.response?.data?.message || err?.message || 'Failed to parse Excel sheet.'
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  // 4. Batch Excel Upload - Atomic Commit
  const handleBatchCommit = async () => {
    if (!previewData || previewData.validCount === 0) return;

    try {
      setBatchCommitting(true);
      const validRecords: RecordPlacedStudentPayload[] = previewData.rows
        .filter((r) => r.valid)
        .map((r) => ({
          studentId: r.studentId,
          company: r.company,
          role: r.role || undefined,
          ctcLpa: r.ctcLpa ?? null,
          packageCategory: r.packageCategory,
        }));

      const res = await commitPlacedStudentsBatch(validRecords);

      setFeedback({
        type: 'success',
        message: res.message || `Successfully committed ${res.committedCount} placed records!`,
      });

      setUploadModalOpen(false);
      setBatchFile(null);
      setPreviewData(null);

      void fetchPlacedStudents();
      onStatsUpdated?.();
    } catch (err: any) {
      setPreviewError(
        err?.response?.data?.message || err?.message || 'Batch placement commit failed.'
      );
    } finally {
      setBatchCommitting(false);
    }
  };

  // 5. Unmark Placement
  const handleUnmarkConfirm = async () => {
    if (!unmarkTarget) return;

    try {
      setUnmarking(true);
      const res = await unmarkPlacedStudent(unmarkTarget.studentUserId, unmarkTarget.driveId);
      setFeedback({
        type: 'success',
        message: res.message || `Removed placement status for ${unmarkTarget.studentId}.`,
      });
      setUnmarkTarget(null);
      void fetchPlacedStudents();
      onStatsUpdated?.();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message:
          err?.response?.data?.message || err?.message || 'Failed to remove placement record.',
      });
    } finally {
      setUnmarking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      {feedback && (
        <div
          role="alert"
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between shadow-lg transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-red-950/80 border-red-800 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-neutral-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header and KPI Summary Card */}
      <div className="bg-[#101012] border border-neutral-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-white text-black font-bold">
                <Award className="h-5 w-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Placed Students Roster &amp; Data Entry
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400">
              Record placed candidates individually or via batch Excel spreadsheet uploads.
              Automatically syncs with department statistics, pie charts, and final exports.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 transition"
              title="Download pre-formatted Excel template"
            >
              <Download className="h-3.5 w-3.5 text-neutral-400" />
              <span>Sample Template</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setBatchFile(null);
                setPreviewData(null);
                setPreviewError(null);
                setUploadModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-900 text-neutral-200 hover:text-white border border-neutral-700 hover:border-neutral-500 transition"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>Batch Excel Upload</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setManualError(null);
                setManualModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 transition shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Add Placed Student</span>
            </button>
          </div>
        </div>

        {/* 4 Top KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
          <div className="bg-[#141416] border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium">Total Placed</span>
              <Award className="h-4 w-4 text-white" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white">{metrics.total}</span>
              <span className="text-[11px] font-mono text-neutral-500">candidates</span>
            </div>
          </div>

          <div className="bg-[#141416] border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium">Highest Package</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white">
                {metrics.highest > 0 ? `${metrics.highest}` : '0'}
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">LPA</span>
            </div>
          </div>

          <div className="bg-[#141416] border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium">Average Package</span>
              <TrendingUp className="h-4 w-4 text-sky-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white">
                {metrics.average > 0 ? `${metrics.average}` : '0'}
              </span>
              <span className="text-xs font-mono text-sky-400 font-bold">LPA</span>
            </div>
          </div>

          <div className="bg-[#141416] border border-neutral-800/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium">Dream Offers</span>
              <Sparkles className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white">
                {metrics.dreamCount}
              </span>
              <span className="text-[11px] font-mono text-amber-400/90">&ge; 10 LPA / Dream</span>
            </div>
          </div>
        </div>
      </div>

      {/* Roster Controls: Search & Branch Filter */}
      <div className="bg-[#101012] border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Branch Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {userRole === 'MAIN_COORDINATOR' ? (
              ALL_BRANCHES.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setSelectedBranchFilter(b)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                    selectedBranchFilter === b
                      ? 'bg-white text-black shadow-xs'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {b}
                </button>
              ))
            ) : (
              <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-neutral-900 border border-neutral-800 text-white flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Branch: {userBranch || 'Department'}
              </span>
            )}
          </div>

          {/* Search Bar & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-3 top-3 text-neutral-500" />
              <input
                type="text"
                placeholder="Search student, company, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#141416] border border-neutral-800 focus:border-white focus:outline-none rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-neutral-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => void fetchPlacedStudents()}
              disabled={loading}
              className="p-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition"
              title="Refresh roster"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table of Placed Students */}
        <div className="overflow-x-auto rounded-2xl border border-neutral-800/80 bg-[#0c0c0e]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#141416] border-b border-neutral-800 text-neutral-400 select-none font-sans font-bold">
              <tr>
                <th className="w-12 px-3 py-3 text-center text-neutral-500">#</th>
                <th className="px-4 py-3">Student Details</th>
                <th className="px-4 py-3">Branch &amp; Batch</th>
                <th className="px-4 py-3">Company &amp; Role</th>
                <th className="px-4 py-3">CTC (LPA)</th>
                <th className="px-4 py-3">Package Tier</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {loading && placedList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-neutral-500 font-sans">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-white" />
                      <span>Loading placed students roster...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-red-400 font-sans">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-6 w-6 text-red-500" />
                      <span>{error}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-neutral-500 font-sans">
                    <div className="flex flex-col items-center gap-2">
                      <Briefcase className="h-8 w-8 text-neutral-600" />
                      <p className="text-sm font-semibold text-neutral-400">
                        {searchQuery
                          ? 'No placed students match your search criteria.'
                          : 'No placed students recorded yet for this selection.'}
                      </p>
                      <p className="text-xs text-neutral-600">
                        Click &quot;Add Placed Student&quot; or upload an Excel sheet to record placements.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((student, idx) => (
                  <tr
                    key={`${student.studentUserId}-${student.driveId}`}
                    className="hover:bg-neutral-900/40 transition group"
                  >
                    <td className="w-12 px-3 py-3 text-center text-neutral-600 select-none">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <div className="flex items-center gap-2">
                        <strong className="text-white font-mono font-bold text-xs">
                          {student.studentId}
                        </strong>
                      </div>
                      <p className="text-[11px] text-neutral-400">{student.name || 'Student'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold text-[11px]">
                        {student.branch || '—'}
                      </span>
                      <span className="text-[11px] text-neutral-500 ml-2">
                        {student.batch ? `Batch ${student.batch}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans">
                      <div className="font-bold text-white text-xs">{student.company}</div>
                      <div className="text-[11px] text-neutral-400">{student.role || '—'}</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-white text-xs">
                      {student.ctcLpa !== null ? (
                        <span className="text-emerald-400 font-mono">{student.ctcLpa} LPA</span>
                      ) : (
                        <span className="text-neutral-500 font-normal">Undisclosed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      {student.packageCategory === 'DREAM' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-black shadow-xs">
                          Dream
                        </span>
                      ) : student.packageCategory === 'INTERNSHIP' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                          Internship
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-neutral-400 border border-neutral-800">
                          General
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setUnmarkTarget(student)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-neutral-400 hover:text-red-300 hover:bg-red-950/40 border border-transparent hover:border-red-900/50 transition"
                        title="Unmark as placed"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Unmark</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Manual Placement Entry */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#121214] border border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-white text-black font-bold">
                  <Award className="h-4 w-4" />
                </span>
                <h3 className="font-bold text-base sm:text-lg text-white">Record Placed Student</h3>
              </div>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {manualError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{manualError}</span>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1.5">
                  Student ID / Roll No <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2022BCSE001"
                  value={manualForm.studentId}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, studentId: e.target.value.toUpperCase() })
                  }
                  className="w-full bg-[#18181b] border border-neutral-700 focus:border-white focus:outline-none rounded-xl px-3.5 py-2.5 text-white font-mono text-xs uppercase"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1.5">
                  Company Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Google, Microsoft, Infosys"
                  value={manualForm.company}
                  onChange={(e) => setManualForm({ ...manualForm, company: e.target.value })}
                  className="w-full bg-[#18181b] border border-neutral-700 focus:border-white focus:outline-none rounded-xl px-3.5 py-2.5 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1.5">
                  Role / Designation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineer, Analyst"
                  value={manualForm.role}
                  onChange={(e) => setManualForm({ ...manualForm, role: e.target.value })}
                  className="w-full bg-[#18181b] border border-neutral-700 focus:border-white focus:outline-none rounded-xl px-3.5 py-2.5 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1.5">
                    CTC in LPA
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 14.5"
                    value={manualForm.ctcLpa}
                    onChange={(e) => setManualForm({ ...manualForm, ctcLpa: e.target.value })}
                    className="w-full bg-[#18181b] border border-neutral-700 focus:border-white focus:outline-none rounded-xl px-3.5 py-2.5 text-white font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1.5">
                    Package Category
                  </label>
                  <select
                    value={manualForm.packageCategory}
                    onChange={(e) =>
                      setManualForm({
                        ...manualForm,
                        packageCategory: e.target.value as any,
                      })
                    }
                    className="w-full bg-[#18181b] border border-neutral-700 focus:border-white focus:outline-none rounded-xl px-3 py-2.5 text-white text-xs"
                  >
                    <option value="GENERAL">General</option>
                    <option value="DREAM">Dream (&ge;10 LPA)</option>
                    <option value="INTERNSHIP">Internship</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs transition shadow-xs flex items-center gap-2"
                >
                  {manualSubmitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Record Placement</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Batch Excel Upload */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#121214] border border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-white text-black font-bold">
                  <FileSpreadsheet className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white">
                    Batch Placed Students Upload (.xlsx)
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Upload an Excel spreadsheet with candidate roll numbers and company details.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Template hint */}
            <div className="flex items-center justify-between p-3.5 bg-[#161619] border border-neutral-800 rounded-2xl text-xs text-neutral-300">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-neutral-400 shrink-0" />
                <span>Need the official column headers?</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-white hover:underline font-bold text-xs inline-flex items-center gap-1"
              >
                <Download className="h-3 w-3" />
                <span>Download Sample Sheet</span>
              </button>
            </div>

            {/* Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-700 hover:border-neutral-500 bg-[#161619] rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
            >
              <Upload className="h-8 w-8 text-neutral-400 group-hover:text-white transition" />
              <div className="text-xs font-semibold text-white">
                {batchFile ? batchFile.name : 'Click or drag & drop .xlsx placement sheet here'}
              </div>
              <p className="text-[11px] text-neutral-500">
                Supports Microsoft Excel (.xlsx, .xls) up to 10MB
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Preview Loading */}
            {previewLoading && (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-xs text-neutral-400">
                <RefreshCw className="h-5 w-5 animate-spin text-white" />
                <span>Validating candidate roll numbers against registered profiles...</span>
              </div>
            )}

            {/* Preview Error */}
            {previewError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{previewError}</span>
              </div>
            )}

            {/* Preview Data & Validation Summary */}
            {previewData && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2.5 text-center font-mono text-xs">
                  <div className="p-3 bg-[#18181b] border border-neutral-800 rounded-xl">
                    <span className="text-neutral-400 block text-[10px]">Total Parsed</span>
                    <strong className="text-white text-base">{previewData.totalRows}</strong>
                  </div>
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl">
                    <span className="text-emerald-400 block text-[10px]">Valid &amp; Ready</span>
                    <strong className="text-emerald-300 text-base">{previewData.validCount}</strong>
                  </div>
                  <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl">
                    <span className="text-red-400 block text-[10px]">Invalid / Errors</span>
                    <strong className="text-red-300 text-base">{previewData.invalidCount}</strong>
                  </div>
                </div>

                {/* Preview Table */}
                <div className="max-h-60 overflow-y-auto rounded-xl border border-neutral-800 bg-[#0c0c0e]">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#141416] border-b border-neutral-800 text-neutral-400 sticky top-0 text-[11px] font-sans">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Student ID</th>
                        <th className="px-3 py-2">Name &amp; Branch</th>
                        <th className="px-3 py-2">Company</th>
                        <th className="px-3 py-2">CTC</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900">
                      {previewData.rows.map((row) => (
                        <tr
                          key={row.rowNumber}
                          className={row.valid ? 'hover:bg-neutral-900/40' : 'bg-red-950/20'}
                        >
                          <td className="px-3 py-2 text-neutral-500">{row.rowNumber}</td>
                          <td className="px-3 py-2 font-bold text-white">{row.studentId}</td>
                          <td className="px-3 py-2 text-neutral-300 font-sans text-[11px]">
                            {row.name ? (
                              <span>
                                {row.name}{' '}
                                <span className="text-neutral-500 font-mono">({row.branch})</span>
                              </span>
                            ) : (
                              <span className="text-neutral-500">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-white font-sans text-[11px]">
                            {row.company}
                          </td>
                          <td className="px-3 py-2 text-emerald-400">
                            {row.ctcLpa !== null && row.ctcLpa !== undefined
                              ? `${row.ctcLpa} LPA`
                              : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {row.valid ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                <CheckCircle className="h-3 w-3" /> Valid
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400"
                                title={row.error}
                              >
                                <AlertTriangle className="h-3 w-3" /> {row.error || 'Invalid'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Commit Action */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-neutral-400">
                    {previewData.validCount} candidate placement(s) ready to be recorded.
                  </span>
                  <button
                    type="button"
                    onClick={handleBatchCommit}
                    disabled={batchCommitting || previewData.validCount === 0}
                    className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-bold text-xs transition shadow-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    {batchCommitting ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Committing...</span>
                      </>
                    ) : (
                      <>
                        <span>Commit Valid Placements ({previewData.validCount})</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: Unmark Confirmation */}
      {unmarkTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#121214] border border-neutral-800 rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-2.5 text-red-400">
              <span className="p-2 rounded-xl bg-red-950/60 border border-red-800/80">
                <Trash2 className="h-5 w-5" />
              </span>
              <h3 className="font-bold text-base text-white">Unmark Placement Status</h3>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed font-sans">
              Are you sure you want to remove placement status for candidate{' '}
              <strong className="text-white font-mono">{unmarkTarget.studentId}</strong> (
              {unmarkTarget.name || 'Student'}) at{' '}
              <strong className="text-white">{unmarkTarget.company}</strong>?
            </p>
            <p className="text-[11px] text-neutral-500 font-sans">
              This will update the department placement rate and remove this record from the active
              roster.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setUnmarkTarget(null)}
                className="px-4 py-2 rounded-xl text-neutral-400 hover:text-white font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnmarkConfirm}
                disabled={unmarking}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition shadow-xs flex items-center gap-2"
              >
                {unmarking ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Yes, Unmark</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
