'use client';

/**
 * @fileoverview Branch Coordinator Dashboard.
 * Provides:
 * 1. Class roster bulk Excel upload & automated student credential creation.
 * 2. Student data correction request review (Approve / Reject).
 * 3. Class students directory and academic tracking.
 *
 * @module app/coordinator/page
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Building,
  Sparkles,
  ArrowRight,
  Settings,
  Check,
  X,
  Clock,
  RefreshCw,
  Search,
  FileCheck2,
  ListFilter,
  Award,
  Sliders,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { RequireAuth } from '@/components/auth/require-auth';
import {
  analyzeBulkRegistration,
  previewBulkRegistration,
  commitBulkRegistration,
  type AnalyzeResponse,
  type PreviewResponse,
  type CommitResponse,
} from '@/services/registration.service';
import {
  listProfiles,
  listCorrectionRequests,
  reviewCorrectionRequest,
  type StudentProfileData,
  type CorrectionRequestData,
} from '@/services/profiles.service';
import {
  getBranchCredits,
  updateBranchCredits,
  type BranchCreditItem,
} from '@/services/curriculum.service';

const CANONICAL_FIELD_OPTIONS = [
  { key: 'studentId', label: 'Student ID / Roll No', required: true },
  { key: 'registrationNumber', label: 'Registration Number', required: false },
  { key: 'name', label: 'Full Name', required: false },
  { key: 'firstName', label: 'First Name', required: false },
  { key: 'lastName', label: 'Last Name', required: false },
  { key: 'dob', label: 'Date of Birth (DOB)', required: false },
  { key: 'age', label: 'Age', required: false },
  { key: 'branch', label: 'Branch / Dept', required: false },
  { key: 'batch', label: 'Batch / Year', required: false },
  { key: 'email', label: 'Official Email', required: false },
  { key: 'phone', label: 'Contact Phone', required: false },
  { key: 'activeBacklogs', label: 'Active Backlogs', required: false },
  { key: 'totalMarks', label: 'Total Marks', required: false },
  { key: 'maxMarks', label: 'Max Marks', required: false },
  { key: 'percentage', label: 'Percentage (%)', required: false },
  { key: 'marksheetUrl', label: 'Marksheet Drive Link', required: false },
  { key: 's1Sgpa', label: 'Semester 1 SGPA', required: false },
  { key: 's1Credits', label: 'Semester 1 Credits', required: false },
  { key: 's1MarksheetUrl', label: 'Sem 1 Marksheet Link', required: false },
  { key: 's2Sgpa', label: 'Semester 2 SGPA', required: false },
  { key: 's2Credits', label: 'Semester 2 Credits', required: false },
  { key: 's2MarksheetUrl', label: 'Sem 2 Marksheet Link', required: false },
  { key: 's3Sgpa', label: 'Semester 3 SGPA', required: false },
  { key: 's3Credits', label: 'Semester 3 Credits', required: false },
  { key: 's3MarksheetUrl', label: 'Sem 3 Marksheet Link', required: false },
  { key: 's4Sgpa', label: 'Semester 4 SGPA', required: false },
  { key: 's4Credits', label: 'Semester 4 Credits', required: false },
  { key: 's4MarksheetUrl', label: 'Sem 4 Marksheet Link', required: false },
  { key: 's5Sgpa', label: 'Semester 5 SGPA', required: false },
  { key: 's5Credits', label: 'Semester 5 Credits', required: false },
  { key: 's5MarksheetUrl', label: 'Sem 5 Marksheet Link', required: false },
  { key: 's6Sgpa', label: 'Semester 6 SGPA', required: false },
  { key: 's6Credits', label: 'Semester 6 Credits', required: false },
  { key: 's6MarksheetUrl', label: 'Sem 6 Marksheet Link', required: false },
] as const;

export default function CoordinatorPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<'upload' | 'requests' | 'students' | 'credits'>('upload');

  // Roster Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<AnalyzeResponse | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [skipInvalid, setSkipInvalid] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Correction Requests States
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequestData[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false);
  const [reviewRemarks, setReviewRemarks] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [requestActionMsg, setRequestActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Class Students States
  const [students, setStudents] = useState<StudentProfileData[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>('');

  // Branch Curriculum Credits States
  const [branchCreditsList, setBranchCreditsList] = useState<BranchCreditItem[]>([]);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(false);
  const [isSavingCredits, setIsSavingCredits] = useState<boolean>(false);
  const [recalculateOnSave, setRecalculateOnSave] = useState<boolean>(true);
  const [creditsMsg, setCreditsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Fetch correction requests for this branch
  const fetchRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const data = await listCorrectionRequests();
      setCorrectionRequests(data);
    } catch {
      // Ignore initial fetch error
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  // Fetch students for this branch
  const fetchStudents = useCallback(async () => {
    setIsLoadingStudents(true);
    try {
      const data = await listProfiles();
      setStudents(data);
    } catch {
      // Ignore initial fetch error
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  // Fetch curriculum credits for this branch
  const fetchCredits = useCallback(async () => {
    setIsLoadingCredits(true);
    setCreditsMsg(null);
    try {
      const data = await getBranchCredits(user?.branch || 'CSE');
      setBranchCreditsList(data.credits);
    } catch {
      setCreditsMsg({ type: 'error', text: 'Failed to load branch curriculum credits.' });
    } finally {
      setIsLoadingCredits(false);
    }
  }, [user?.branch]);

  const handleSaveCredits = async () => {
    setIsSavingCredits(true);
    setCreditsMsg(null);
    try {
      const configs = branchCreditsList.map((c) => ({
        semester: c.semester,
        credits: Number(c.credits) || 0,
      }));
      const res = await updateBranchCredits(user?.branch || 'CSE', configs, recalculateOnSave);
      setBranchCreditsList(res.credits);
      setCreditsMsg({
        type: 'success',
        text: recalculateOnSave
          ? `Branch credits updated and CGPA recalculated for all ${user?.branch || 'CSE'} students!`
          : `Branch credits updated successfully for ${user?.branch || 'CSE'}!`,
      });
      if (recalculateOnSave) {
        void fetchStudents();
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      setCreditsMsg({
        type: 'error',
        text: axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to save curriculum credits.',
      });
    } finally {
      setIsSavingCredits(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'requests') {
      void fetchRequests();
    } else if (activeTab === 'students') {
      void fetchStudents();
    } else if (activeTab === 'credits') {
      void fetchCredits();
    }
  }, [activeTab, fetchRequests, fetchStudents, fetchCredits]);

  // Initial fetch for pending count badge
  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // --- Roster Upload Handlers ---
  const runAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    setUploadError(null);
    setAnalysisData(null);
    setColumnMapping({});
    setPreviewData(null);
    setCommitResult(null);

    try {
      const res = await analyzeBulkRegistration(file);
      setAnalysisData(res);
      if (res.sheets && res.sheets.length > 0) {
        const primary = res.sheets[0];
        const initialMapping: Record<string, string> = {};
        for (const [header, match] of Object.entries(primary.mapping)) {
          if (match.field) {
            initialMapping[header] = match.field;
          }
        }
        setColumnMapping(initialMapping);
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.error?.message ||
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Failed to analyze spreadsheet structure';
      setUploadError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setCommitResult(null);
    setPreviewData(null);
    setAnalysisData(null);
    setColumnMapping({});
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setUploadError('Please select an Excel (.xlsx) file.');
        return;
      }
      setSelectedFile(file);
      void runAnalysis(file);
    }
  };

  const handleMappingChange = (header: string, canonicalField: string) => {
    setColumnMapping((prev) => {
      const next = { ...prev };
      if (!canonicalField) {
        delete next[header];
      } else {
        next[header] = canonicalField;
      }
      return next;
    });
  };

  const handleDownloadTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');

    sheet.columns = [
      { header: 'Student ID / Roll No', key: 'studentId', width: 20 },
      { header: 'Registration Number', key: 'registrationNumber', width: 22 },
      { header: 'Full Name', key: 'name', width: 22 },
      { header: 'First Name', key: 'firstName', width: 15 },
      { header: 'Last Name', key: 'lastName', width: 15 },
      { header: 'Date of Birth', key: 'dob', width: 15 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Department', key: 'branch', width: 14 },
      { header: 'Batch', key: 'batch', width: 12 },
      { header: 'Email ID', key: 'email', width: 26 },
      { header: 'Contact Number', key: 'phone', width: 16 },
      { header: 'Active Backlogs', key: 'activeBacklogs', width: 14 },
      { header: 'Total Marks', key: 'totalMarks', width: 14 },
      { header: 'Max Marks', key: 'maxMarks', width: 14 },
      { header: 'Percentage', key: 'percentage', width: 14 },
      { header: 'Marksheet Drive Link', key: 'marksheetUrl', width: 32 },
      { header: 'Sem 1 SGPA', key: 's1Sgpa', width: 12 },
      { header: 'Credits Sem 1', key: 's1Credits', width: 14 },
      { header: 'Sem 1 Marksheet Link', key: 's1MarksheetUrl', width: 32 },
      { header: 'Sem 2 SGPA', key: 's2Sgpa', width: 12 },
      { header: 'Credits Sem 2', key: 's2Credits', width: 14 },
      { header: 'Sem 2 Marksheet Link', key: 's2MarksheetUrl', width: 32 },
    ];

    const branchName = user?.branch || 'CSE';

    sheet.addRow({
      studentId: `2022B${branchName}010`,
      registrationNumber: `REG-2022-${branchName}-010`,
      name: 'Rohan Gupta',
      firstName: 'Rohan',
      lastName: 'Gupta',
      dob: '2004-04-15',
      age: 22,
      branch: branchName,
      batch: '2026',
      email: 'rohan.gupta@college.edu',
      phone: '9876500001',
      activeBacklogs: 0,
      totalMarks: 5160,
      maxMarks: 6000,
      percentage: 86.0,
      marksheetUrl: 'https://drive.google.com/file/d/1RohanConsolidatedMarksheet/view',
      s1Sgpa: 8.5,
      s1Credits: 20,
      s1MarksheetUrl: 'https://drive.google.com/file/d/1RohanSem1Marksheet/view',
      s2Sgpa: 8.7,
      s2Credits: 22,
      s2MarksheetUrl: 'https://drive.google.com/file/d/1RohanSem2Marksheet/view',
    });

    sheet.addRow({
      studentId: `2022B${branchName}011`,
      name: 'Sneha Patel',
      firstName: 'Sneha',
      lastName: 'Patel',
      dob: '2004-09-22',
      age: 22,
      branch: branchName,
      batch: '2026',
      email: 'sneha.patel@college.edu',
      phone: '9876500002',
      activeBacklogs: 0,
      totalMarks: 5520,
      maxMarks: 6000,
      percentage: 92.0,
      marksheetUrl: 'https://drive.google.com/file/d/1SnehaConsolidatedMarksheet/view',
      s1Sgpa: 9.1,
      s1Credits: 20,
      s1MarksheetUrl: 'https://drive.google.com/file/d/1SnehaSem1Marksheet/view',
      s2Sgpa: 9.3,
      s2Credits: 22,
      s2MarksheetUrl: 'https://drive.google.com/file/d/1SnehaSem2Marksheet/view',
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${branchName}_student_registration_template.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setUploadError('Please select an Excel file first.');
      return;
    }

    setIsPreviewing(true);
    setUploadError(null);
    setCommitResult(null);

    try {
      const data = await previewBulkRegistration(selectedFile, columnMapping);
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
      setUploadError(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!selectedFile) {
      setUploadError('Please select an Excel file first.');
      return;
    }

    setIsCommitting(true);
    setUploadError(null);

    try {
      const res = await commitBulkRegistration(selectedFile, {
        skipInvalid,
        mapping: columnMapping,
      });
      setCommitResult(res);
      setPreviewData(null);
      setAnalysisData(null);
      setColumnMapping({});
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
      setUploadError(message);
    } finally {
      setIsCommitting(false);
    }
  };

  // --- Review Correction Request Handler ---
  const handleReview = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setReviewingId(requestId);
    setRequestActionMsg(null);
    const remarks = reviewRemarks[requestId] || '';

    try {
      await reviewCorrectionRequest(requestId, action, remarks);
      setRequestActionMsg({
        type: 'success',
        text: `Request successfully ${action === 'APPROVE' ? 'approved and student profile updated' : 'rejected'}.`,
      });
      await fetchRequests();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.error?.message ||
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Failed to process review';
      setRequestActionMsg({ type: 'error', text: message });
    } finally {
      setReviewingId(null);
    }
  };

  const primarySheet = analysisData?.sheets?.[0];
  const mappedFieldValues = new Set(Object.values(columnMapping));
  const missingRequiredFields = CANONICAL_FIELD_OPTIONS.filter(
    (field) => field.required && !mappedFieldValues.has(field.key)
  );

  const pendingRequestsCount = correctionRequests.filter((r) => r.status === 'PENDING').length;

  const filteredStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      s.studentId.toLowerCase().includes(q) ||
      (s.registrationNumber && s.registrationNumber.toLowerCase().includes(q)) ||
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  return (
    <RequireAuth roles={['BRANCH_COORDINATOR']}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Navbar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <Building className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  Placement Portal
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  Branch Coordinator ({user?.branch || 'General'})
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

        {/* Tab Navigation Bar */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-8">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition ${
                activeTab === 'upload'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Upload className="h-4 w-4" />
              Upload Class Roster
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('requests')}
              className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition ${
                activeTab === 'requests'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileCheck2 className="h-4 w-4" />
              Correction Requests
              {pendingRequestsCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                  {pendingRequestsCount} Pending
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition ${
                activeTab === 'students'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4" />
              Class Students ({students.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('credits')}
              className={`py-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition ${
                activeTab === 'credits'
                  ? 'border-blue-600 text-blue-600 font-semibold'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Award className="h-4 w-4" />
              Curriculum Credits
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
          {/* TAB 1: UPLOAD CLASS ROSTER */}
          {activeTab === 'upload' && (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  Upload {user?.branch} Class Roster
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Upload an Excel (.xlsx) roster of your class students to automatically create their accounts.
                  Each student’s <strong>Registration Number / Student ID</strong> is set as their default password.
                </p>
              </div>

              {/* Feedback Messages */}
              {uploadError && (
                <div
                  role="alert"
                  className="mb-6 rounded-lg bg-red-50 p-4 border border-red-200 flex items-start gap-3"
                >
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-sm font-medium text-red-800">{uploadError}</div>
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

              {/* Upload Card */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden mb-8">
                <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                      Select Excel File (.xlsx) for {user?.branch}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Expected columns: studentId, name, branch ({user?.branch}), batch, email, phone, activeBacklogs, s1Sgpa...
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-2xs"
                  >
                    <Download className="h-4 w-4 text-blue-600" />
                    Download Sample Template
                  </button>
                </div>

                <div className="p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <label className="flex-1 w-full flex items-center justify-center px-6 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition cursor-pointer bg-gray-50/50">
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
                        disabled={!selectedFile || isAnalyzing || isPreviewing || isCommitting}
                        className="flex-1 sm:flex-initial inline-flex justify-center items-center px-4 py-3 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                      >
                        {isAnalyzing
                          ? 'Analyzing Structure...'
                          : isPreviewing
                          ? 'Validating Data...'
                          : 'Analyze & Preview'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Analyzing Progress Banner */}
              {isAnalyzing && (
                <div className="bg-white rounded-xl shadow-xs border border-blue-100 p-6 mb-8 text-center">
                  <div className="inline-flex items-center justify-center p-3 bg-blue-50 rounded-full text-blue-600 mb-3 animate-bounce">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    Analyzing Spreadsheet Structure & Mapping Columns...
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                    Scanning worksheet rows, skipping title banners, and binding headers to student canonical fields.
                  </p>
                </div>
              )}

              {/* Structure Analysis & Column Mapping Card */}
              {primarySheet && !isAnalyzing && (
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden mb-8">
                  <div className="p-6 border-b border-gray-200 bg-linear-to-r from-blue-50/40 via-white to-white">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-blue-600" />
                          <h3 className="text-base font-semibold text-gray-900">
                            Spreadsheet Structure & Column Mapping
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            {primarySheet.sheetName}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Header row detected at <strong>Row {primarySheet.headerRow}</strong>
                          {primarySheet.headerRow > 1 && ` (${primarySheet.headerRow - 1} title / banner rows skipped)`}
                          {' • '}
                          <strong>{Math.max(0, primarySheet.rowCount - primarySheet.headerRow)}</strong> candidate student records.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => selectedFile && runAnalysis(selectedFile)}
                          disabled={isAnalyzing || isPreviewing}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                        >
                          <Settings className="h-3.5 w-3.5 text-gray-500" />
                          Re-Analyze
                        </button>
                        <button
                          type="button"
                          onClick={handlePreview}
                          disabled={isPreviewing || isCommitting || missingRequiredFields.length > 0}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-2xs"
                        >
                          {isPreviewing ? 'Validating...' : 'Generate Preview'}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {missingRequiredFields.length > 0 ? (
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Missing Student ID Column: </span>
                          Please map the <strong>Student ID / Reg No</strong> column before generating the preview.
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs text-blue-800">
                        <CheckCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Flexible Registration: </span>
                          Missing fields (Name, Email, Phone, Batch, DOB) can be left unmapped—students will be prompted to fill them in automatically on their first login!
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="border border-gray-200 rounded-lg overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 font-semibold text-gray-600">
                          <tr>
                            <th className="px-4 py-3 text-left">Uploaded Excel Header</th>
                            <th className="px-4 py-3 text-left">Mapped Canonical Field</th>
                            <th className="px-4 py-3 text-left">Match Source</th>
                            <th className="px-4 py-3 text-left">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {primarySheet.headers.map((header) => {
                            const match = primarySheet.mapping[header];
                            const currentMappedVal = columnMapping[header] || '';

                            return (
                              <tr key={header} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-semibold text-gray-900 font-mono">
                                  {header}
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={currentMappedVal}
                                    onChange={(e) => handleMappingChange(header, e.target.value)}
                                    className="w-full max-w-xs border border-gray-300 rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="">-- Ignore Column --</option>
                                    <optgroup label="Required Canonical Fields">
                                      {CANONICAL_FIELD_OPTIONS.filter((f) => f.required).map((f) => (
                                        <option key={f.key} value={f.key}>
                                          {f.label} *
                                        </option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="Optional Canonical Fields">
                                      {CANONICAL_FIELD_OPTIONS.filter((f) => !f.required).map((f) => (
                                        <option key={f.key} value={f.key}>
                                          {f.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>
                                </td>
                                <td className="px-4 py-3">
                                  {match?.source === 'exact' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                      Exact Match
                                    </span>
                                  ) : match?.source === 'pattern' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
                                      Pattern Match
                                    </span>
                                  ) : match?.source === 'ai' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800">
                                      AI Suggested
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
                                      Unmatched
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-gray-500 font-mono">
                                  {match ? `${Math.round(match.confidence * 100)}%` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Results Card */}
              {previewData && (
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden space-y-6 p-6">
                  <div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">
                          Validation Summary
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Verified against branch scoping ({user?.branch}) and database uniqueness.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPreviewData(null)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                      >
                        <Settings className="h-3.5 w-3.5 text-gray-500" />
                        Adjust Column Mapping
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <span className="text-xs text-gray-500 block">Total Rows</span>
                        <span className="text-lg font-bold text-gray-900">{previewData.summary.total}</span>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                        <span className="text-xs text-emerald-600 block">Valid Rows</span>
                        <span className="text-lg font-bold text-emerald-700">{previewData.summary.valid}</span>
                      </div>
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                        <span className="text-xs text-red-600 block">Invalid Rows</span>
                        <span className="text-lg font-bold text-red-700">{previewData.summary.invalid}</span>
                      </div>
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <span className="text-xs text-amber-600 block">Duplicates in File</span>
                        <span className="text-lg font-bold text-amber-700">{previewData.summary.duplicatesInFile}</span>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <span className="text-xs text-purple-600 block">Duplicates in DB</span>
                        <span className="text-lg font-bold text-purple-700">{previewData.summary.duplicatesInDb}</span>
                      </div>
                    </div>
                  </div>

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
                            <tr key={r.rowNumber} className={isValid ? 'hover:bg-gray-50' : 'bg-red-50/50'}>
                              <td className="px-3 py-2 font-mono text-gray-500">#{r.rowNumber}</td>
                              <td className="px-3 py-2 font-mono font-bold text-gray-900">{String(r.data.studentId || '')}</td>
                              <td className="px-3 py-2 text-gray-800">{String(r.data.name || '')}</td>
                              <td className="px-3 py-2 text-gray-700">{String(r.data.branch || '')}</td>
                              <td className="px-3 py-2 text-gray-600">{String(r.data.email || '')}</td>
                              <td className="px-3 py-2 text-gray-700 font-semibold">{String(r.data.activeBacklogs ?? '0')}</td>
                              <td className="px-3 py-2 font-bold text-blue-700">{r.cgpa.toFixed(2)}</td>
                              <td className="px-3 py-2">
                                {isValid ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                    Ready
                                  </span>
                                ) : (
                                  <div className="space-y-0.5">
                                    {r.errors.map((e, idx) => (
                                      <span key={idx} className="block text-[11px] text-red-700 font-medium">
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

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
                    {previewData.summary.invalid > 0 ? (
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipInvalid}
                          onChange={(e) => setSkipInvalid(e.target.checked)}
                          className="rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
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
                        previewData.summary.valid === 0 ||
                        (previewData.summary.invalid > 0 && !skipInvalid)
                      }
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg shadow-xs text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                    >
                      <Users className="h-4 w-4" />
                      {isCommitting
                        ? 'Creating Student Accounts...'
                        : `Commit & Create (${previewData.summary.valid} Students)`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CORRECTION REQUESTS */}
          {activeTab === 'requests' && (
            <div>
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Student Data Correction Requests
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Review and approve changes requested by students of your branch. Approved changes immediately update the official student records.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchRequests}
                  disabled={isLoadingRequests}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition shadow-2xs self-start sm:self-auto"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-gray-500 ${isLoadingRequests ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {requestActionMsg && (
                <div
                  role="status"
                  className={`mb-6 rounded-lg p-4 border flex items-start gap-3 ${
                    requestActionMsg.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {requestActionMsg.type === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm font-medium">{requestActionMsg.text}</div>
                </div>
              )}

              {isLoadingRequests ? (
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-8 text-center text-sm text-gray-500">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-blue-600 mb-2" />
                  Loading correction requests...
                </div>
              ) : correctionRequests.length === 0 ? (
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-12 text-center">
                  <FileCheck2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-gray-900">No Correction Requests</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    There are no pending or past correction requests from students of {user?.branch}.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {correctionRequests.map((req) => {
                    const isPending = req.status === 'PENDING';
                    const isApproved = req.status === 'APPROVED';
                    const isRejected = req.status === 'REJECTED';

                    return (
                      <div
                        key={req.id}
                        className={`bg-white rounded-xl shadow-xs border overflow-hidden transition ${
                          isPending ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-200'
                        }`}
                      >
                        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-sm text-gray-900">
                              {req.studentId}
                            </span>
                            <span className="text-sm font-semibold text-gray-700">
                              {req.studentName || 'Student'}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                              {req.branch}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                <Clock className="h-3 w-3" /> Pending Review
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                <Check className="h-3 w-3" /> Approved
                              </span>
                            )}
                            {isRejected && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                <X className="h-3 w-3" /> Rejected
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="p-5 space-y-4">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                              Requested Field Changes:
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {Object.entries(req.requestedChanges).map(([k, v]) => (
                                <div
                                  key={k}
                                  className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs"
                                >
                                  <span className="text-gray-500 block font-medium capitalize">
                                    {k.replace(/([A-Z])/g, ' $1')}
                                  </span>
                                  <span className="text-gray-900 font-mono font-bold mt-0.5 block">
                                    {String(v)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="bg-gray-50/70 p-3 rounded-lg border border-gray-200 text-xs">
                            <span className="font-semibold text-gray-700 block mb-0.5">
                              Student Reason:
                            </span>
                            <p className="text-gray-600">{req.reason}</p>
                          </div>

                          {req.reviewerRemarks && (
                            <div className="text-xs text-gray-600 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
                              <span className="font-semibold text-blue-900">Coordinator Remarks: </span>
                              {req.reviewerRemarks}
                            </div>
                          )}

                          {isPending && (
                            <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                              <input
                                type="text"
                                placeholder="Optional reviewer remarks (e.g. Verified with marksheet)..."
                                value={reviewRemarks[req.id] || ''}
                                onChange={(e) =>
                                  setReviewRemarks((prev) => ({ ...prev, [req.id]: e.target.value }))
                                }
                                className="flex-1 text-xs border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                              />

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleReview(req.id, 'APPROVE')}
                                  disabled={reviewingId === req.id}
                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 transition shadow-2xs"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Approve & Update Record
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReview(req.id, 'REJECT')}
                                  disabled={reviewingId === req.id}
                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 disabled:bg-gray-100 transition shadow-2xs"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Reject
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLASS STUDENTS DIRECTORY */}
          {activeTab === 'students' && (
            <div>
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {user?.branch} Class Students Directory
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Live profile directory and academic records of all registered students in {user?.branch}.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search ID, name, email..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-60"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={fetchStudents}
                    disabled={isLoadingStudents}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition shadow-2xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-gray-500 ${isLoadingStudents ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {isLoadingStudents ? (
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-8 text-center text-sm text-gray-500">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-blue-600 mb-2" />
                  Loading students...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-12 text-center">
                  <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-gray-900">No Students Found</h3>
                  <p className="mt-1 text-xs text-gray-500">
                    {students.length === 0
                      ? `No students have been registered in ${user?.branch} yet. Upload an Excel roster to create accounts.`
                      : 'No students matched your search criteria.'}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 font-semibold text-gray-600">
                        <tr>
                          <th className="px-4 py-3 text-left">Roll No</th>
                          <th className="px-4 py-3 text-left">Reg No</th>
                          <th className="px-4 py-3 text-left">Name</th>
                          <th className="px-4 py-3 text-left">Batch</th>
                          <th className="px-4 py-3 text-left">Email</th>
                          <th className="px-4 py-3 text-left">Phone</th>
                          <th className="px-4 py-3 text-left">Backlogs</th>
                          <th className="px-4 py-3 text-left">CGPA</th>
                          <th className="px-4 py-3 text-left">Percentage</th>
                          <th className="px-4 py-3 text-left">Total Marks</th>
                          <th className="px-4 py-3 text-left">Marksheet</th>
                          <th className="px-4 py-3 text-left">Profile Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredStudents.map((s) => (
                          <tr key={s.studentId} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono font-bold text-gray-900">
                              {s.studentId}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-700">
                              {s.registrationNumber || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-800 font-medium">
                              {s.name || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {s.batch || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 font-mono text-[11px]">
                              {s.email || '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {s.phone || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  s.activeBacklogs === 0
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {s.activeBacklogs}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-blue-700 text-sm">
                              {s.cgpa.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 font-bold text-emerald-700">
                              {typeof s.percentage === 'number'
                                ? `${s.percentage.toFixed(1)}%`
                                : s.cgpa > 0
                                ? `${(s.cgpa * 9.5).toFixed(1)}%`
                                : '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-mono">
                              {typeof s.totalMarks === 'number'
                                ? `${s.totalMarks}${s.maxMarks ? ` / ${s.maxMarks}` : ''}`
                                : '—'}
                            </td>
                            <td className="px-4 py-3">
                              {s.marksheetUrl ? (
                                <a
                                  href={s.marksheetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
                                >
                                  Drive Link 📄
                                </a>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {s.isProfileComplete ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                  <Check className="h-3 w-3" /> Complete
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                                  <Clock className="h-3 w-3" /> Pending Student
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Curriculum Credits */}
          {activeTab === 'credits' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {user?.branch || 'CSE'} Curriculum Semester Credits
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Define official credit weightings per semester for {user?.branch || 'CSE'}. If credits are omitted in student rosters, these defaults are used to compute CGPAs automatically.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchCredits}
                  disabled={isLoadingCredits}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition shadow-2xs self-start sm:self-auto"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-gray-500 ${isLoadingCredits ? 'animate-spin' : ''}`} />
                  Reset to Current
                </button>
              </div>

              {creditsMsg && (
                <div
                  className={`p-4 rounded-xl border text-sm font-medium ${
                    creditsMsg.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {creditsMsg.text}
                </div>
              )}

              {isLoadingCredits ? (
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-8 text-center text-sm text-gray-500">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-blue-600 mb-2" />
                  Loading branch curriculum credits...
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {branchCreditsList.map((item, idx) => (
                      <div
                        key={item.semester}
                        className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-white hover:border-blue-300 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-gray-900 text-sm">
                            Semester {item.semester}
                          </span>
                          <span className="text-[11px] font-mono text-gray-400">
                            Sem {item.semester}
                          </span>
                        </div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">
                          Credits
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={item.credits}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const updated = [...branchCreditsList];
                            updated[idx] = { ...item, credits: isNaN(val) ? 0 : val };
                            setBranchCreditsList(updated);
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-sm font-mono font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={recalculateOnSave}
                        onChange={(e) => setRecalculateOnSave(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>
                        <strong>Recalculate Class CGPAs:</strong> Automatically update all registered {user?.branch || 'CSE'} students with new credit weights upon saving.
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={handleSaveCredits}
                      disabled={isSavingCredits}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 transition shadow-xs self-end sm:self-auto"
                    >
                      <Check className="h-4 w-4" />
                      {isSavingCredits ? 'Saving Credits...' : 'Save Curriculum Credits'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </RequireAuth>
  );
}
