'use client';

/**
 * @fileoverview Main Coordinator (Admin) Dashboard.
 * Provides bulk student Excel registration with validation preview, CGPA calculation,
 * atomic commit, and sample template downloading.
 *
 * @module app/admin/page
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import ExcelJS from 'exceljs';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Download,
  LogOut,
  User,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { RequireAuth } from '@/components/auth/require-auth';
import {
  previewBulkRegistration,
  commitBulkRegistration,
  type PreviewResponse,
  type CommitResponse,
} from '@/services/registration.service';

export default function AdminPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [skipInvalid, setSkipInvalid] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setCommitResult(null);
    setPreviewData(null);
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setError('Please select an Excel (.xlsx) file.');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');

    sheet.columns = [
      { header: 'studentId', key: 'studentId', width: 16 },
      { header: 'name', key: 'name', width: 22 },
      { header: 'branch', key: 'branch', width: 12 },
      { header: 'batch', key: 'batch', width: 10 },
      { header: 'email', key: 'email', width: 26 },
      { header: 'phone', key: 'phone', width: 16 },
      { header: 'activeBacklogs', key: 'activeBacklogs', width: 14 },
      { header: 's1Sgpa', key: 's1Sgpa', width: 10 },
      { header: 's1Credits', key: 's1Credits', width: 10 },
      { header: 's2Sgpa', key: 's2Sgpa', width: 10 },
      { header: 's2Credits', key: 's2Credits', width: 10 },
    ];

    sheet.addRow({
      studentId: '2022BCSE010',
      name: 'Rohan Gupta',
      branch: 'CSE',
      batch: '2026',
      email: 'rohan.gupta@college.edu',
      phone: '9876500001',
      activeBacklogs: 0,
      s1Sgpa: 8.5,
      s1Credits: 20,
      s2Sgpa: 8.7,
      s2Credits: 22,
    });

    sheet.addRow({
      studentId: '2022BCSE011',
      name: 'Sneha Patel',
      branch: 'CSE',
      batch: '2026',
      email: 'sneha.patel@college.edu',
      phone: '9876500002',
      activeBacklogs: 0,
      s1Sgpa: 9.1,
      s1Credits: 20,
      s2Sgpa: 9.3,
      s2Credits: 22,
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_student_registration_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setError('Please select an Excel file first.');
      return;
    }

    setIsPreviewing(true);
    setError(null);
    setCommitResult(null);

    try {
      const data = await previewBulkRegistration(selectedFile);
      setPreviewData(data);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.error?.message ||
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Failed to generate preview';
      setError(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!selectedFile) {
      setError('Please select an Excel file first.');
      return;
    }

    setIsCommitting(true);
    setError(null);

    try {
      const res = await commitBulkRegistration(selectedFile, { skipInvalid });
      setCommitResult(res);
      setPreviewData(null);
      setSelectedFile(null);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.error?.message ||
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Failed to commit student registration';
      setError(message);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <RequireAuth roles={['MAIN_COORDINATOR']}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Navbar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  Placement Portal
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  Main Coordinator (Admin)
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <User className="h-4 w-4 text-gray-400" />
                <span className="font-medium">{user?.username}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
              >
                <LogOut className="h-3.5 w-3.5 text-gray-500" />
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
          {/* Header Info Banner */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Bulk Student Registration
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Upload an Excel (.xlsx) roster to automatically create user accounts and academic profiles.
              Each student’s <strong>Registration Number / Student ID</strong> is set as their default password.
            </p>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 flex items-start gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm font-medium text-red-800">{error}</div>
            </div>
          )}

          {commitResult && (
            <div
              role="status"
              className="mb-6 rounded-lg bg-emerald-50 p-4 border border-emerald-200 flex items-start gap-3"
            >
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900">
                  Registration Successful!
                </h3>
                <p className="mt-1 text-sm text-emerald-800">
                  Created <strong>{commitResult.created}</strong> student accounts
                  {commitResult.skipped > 0 && ` (skipped ${commitResult.skipped} invalid rows)`}.
                </p>
                <p className="mt-2 text-xs text-emerald-700 bg-emerald-100/60 p-2 rounded">
                  🔑 <strong>Default Passwords:</strong> Students can immediately log in using their <strong>Student ID</strong> as both username and password.
                </p>
              </div>
            </div>
          )}

          {/* Card: Upload & Action Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                  Select Excel File (.xlsx)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Expected columns: studentId, name, branch, batch, email, phone, activeBacklogs, s1Sgpa, s1Credits...
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-xs"
              >
                <Download className="h-4 w-4 text-indigo-600" />
                Download Sample Template
              </button>
            </div>

            <div className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <label className="flex-1 w-full flex items-center justify-center px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 transition cursor-pointer bg-gray-50/50">
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-3">
                    <Upload className="h-5 w-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                      {selectedFile ? selectedFile.name : 'Choose Excel file (.xlsx) or drag & drop'}
                    </span>
                  </div>
                </label>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handlePreview}
                    disabled={!selectedFile || isPreviewing || isCommitting}
                    className="flex-1 sm:flex-initial inline-flex justify-center items-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                  >
                    {isPreviewing ? 'Analyzing...' : 'Preview Sheet'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Preview Results */}
          {previewData && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden space-y-6 p-6">
              {/* Summary Metrics */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  Validation Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-xs text-gray-500 block">Total Rows</span>
                    <span className="text-lg font-bold text-gray-900">
                      {previewData.summary.total}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <span className="text-xs text-emerald-600 block">Valid Rows</span>
                    <span className="text-lg font-bold text-emerald-700">
                      {previewData.summary.valid}
                    </span>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <span className="text-xs text-red-600 block">Invalid Rows</span>
                    <span className="text-lg font-bold text-red-700">
                      {previewData.summary.invalid}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-xs text-amber-600 block">Duplicates in File</span>
                    <span className="text-lg font-bold text-amber-700">
                      {previewData.summary.duplicatesInFile}
                    </span>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <span className="text-xs text-purple-600 block">Duplicates in DB</span>
                    <span className="text-lg font-bold text-purple-700">
                      {previewData.summary.duplicatesInDb}
                    </span>
                  </div>
                </div>
              </div>

              {/* Parsed Rows Table */}
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 font-semibold text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Row</th>
                      <th className="px-3 py-2 text-left">Student ID</th>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Branch</th>
                      <th className="px-3 py-2 text-left">Email</th>
                      <th className="px-3 py-2 text-left">Backlogs</th>
                      <th className="px-3 py-2 text-left">CGPA</th>
                      <th className="px-3 py-2 text-left">Status / Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {previewData.rows.map((r) => {
                      const isValid = r.errors.length === 0;
                      return (
                        <tr
                          key={r.rowNumber}
                          className={isValid ? 'hover:bg-gray-50' : 'bg-red-50/50'}
                        >
                          <td className="px-3 py-2 font-mono text-gray-500">
                            #{r.rowNumber}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-gray-900">
                            {String(r.data.studentId || '')}
                          </td>
                          <td className="px-3 py-2 text-gray-800">
                            {String(r.data.name || '')}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {String(r.data.branch || '')}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {String(r.data.email || '')}
                          </td>
                          <td className="px-3 py-2 text-gray-700 font-semibold">
                            {String(r.data.activeBacklogs ?? '0')}
                          </td>
                          <td className="px-3 py-2 font-bold text-indigo-700">
                            {r.cgpa.toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {isValid ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                Ready
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                {r.errors.map((e, idx) => (
                                  <span
                                    key={idx}
                                    className="block text-[11px] text-red-700 font-medium"
                                  >
                                    • {e}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Commit Action Footer */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
                {previewData.summary.invalid > 0 ? (
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipInvalid}
                      onChange={(e) => setSkipInvalid(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>Skip invalid rows and commit only valid records</span>
                  </label>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    All rows passed validation and are ready to commit.
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={
                    isCommitting ||
                    (previewData.summary.valid === 0) ||
                    (previewData.summary.invalid > 0 && !skipInvalid)
                  }
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                >
                  <Users className="h-4 w-4" />
                  {isCommitting
                    ? 'Creating Student Accounts...'
                    : `Commit & Create (${previewData.summary.valid} Students)`}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </RequireAuth>
  );
}
