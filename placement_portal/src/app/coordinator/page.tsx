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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL, getAuthUrl } from '@/lib/api-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ExcelJS from 'exceljs';
import gsap from 'gsap';
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
  Briefcase,
  Calendar,
  TrendingUp,
  Plus,
  FileText,
  ExternalLink,
  Eye,
  Filter,
  CheckCircle2,
  XCircle,
  Building2,
  Trash2,
  Bell,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { ShortlistModal } from '@/components/drives/ShortlistModal';
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
  getDepartmentStats,
  updateBatchCurrentSemester,
  updateStudentPlacementStatus,
  deleteStudent,
  type StudentProfileData,
  type CorrectionRequestData,
  type DepartmentStats,
} from '@/services/profiles.service';
import {
  listDrives,
  updateDriveExtraFields,
  getPublicPlacementStats,
  type DriveItem,
  type DriveExtraField,
  type PublicPlacementStats,
} from '@/services/drives.service';
import {
  getBranchCredits,
  updateBranchCredits,
  type BranchCreditItem,
} from '@/services/curriculum.service';
import { DepartmentPlacementPieChart } from '@/components/analytics/DepartmentPlacementPieChart';
import { PlacedStudentsManager } from '@/components/placements/PlacedStudentsManager';

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

  const [activeTab, setActiveTab] = useState<'upload' | 'placed' | 'requests' | 'students' | 'credits' | 'drives' | 'analytics'>('students');

  // Department Placement Metrics States
  const [departmentStats, setDepartmentStats] = useState<DepartmentStats | null>(null);
  const [isLoadingDeptStats, setIsLoadingDeptStats] = useState<boolean>(false);
  const [publicStats, setPublicStats] = useState<PublicPlacementStats | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Drives & Application Sheets States
  const [drivesList, setDrivesList] = useState<DriveItem[]>([]);
  const [isLoadingDrives, setIsLoadingDrives] = useState<boolean>(false);
  const [driveBranchFilter, setDriveBranchFilter] = useState<'mine' | 'all'>('mine');
  const [driveTimeFilter, setDriveTimeFilter] = useState<'all' | 'active' | 'previous'>('all');
  const [shortlistDrive, setShortlistDrive] = useState<DriveItem | null>(null);

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

  // Correction Requests & Applied Requests States
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequestData[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false);
  const [reviewRemarks, setReviewRemarks] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [requestActionMsg, setRequestActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'drives' | 'corrections'>('all');

  // Class Students States
  const [students, setStudents] = useState<StudentProfileData[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'placed' | 'unplaced' | 'backlogs' | 'zero_backlogs'>('all');
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<StudentProfileData | null>(null);

  // Batch Info Collection Field Modal States
  const [batchFieldModalDriveId, setBatchFieldModalDriveId] = useState<string | null>(null);
  const [newFieldKey, setNewFieldKey] = useState<string>('');
  const [newFieldLabel, setNewFieldLabel] = useState<string>('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'dropdown'>('text');
  const [newFieldOptions, setNewFieldOptions] = useState<string>('');
  const [newFieldRequired, setNewFieldRequired] = useState<boolean>(false);
  const [isSubmittingField, setIsSubmittingField] = useState<boolean>(false);
  const [batchFieldMsg, setBatchFieldMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Branch Curriculum Credits States
  const [branchCreditsList, setBranchCreditsList] = useState<BranchCreditItem[]>([]);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(false);
  const [isSavingCredits, setIsSavingCredits] = useState<boolean>(false);
  const [recalculateOnSave, setRecalculateOnSave] = useState<boolean>(true);
  const [creditsMsg, setCreditsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Batch Semester Configuration States (Junior Batches reached semester)
  const [batchSemesterBatch, setBatchSemesterBatch] = useState<string>('2028');
  const [batchSemesterBranch, setBatchSemesterBranch] = useState<string>('');
  const [batchSemesterReached, setBatchSemesterReached] = useState<number>(2);
  const [isSavingBatchSemester, setIsSavingBatchSemester] = useState<boolean>(false);
  const [batchSemesterMsg, setBatchSemesterMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveBatchSemester = async () => {
    setIsSavingBatchSemester(true);
    setBatchSemesterMsg(null);
    try {
      const res = await updateBatchCurrentSemester({
        branch: user?.role === 'MAIN_COORDINATOR' ? (batchSemesterBranch || undefined) : (user?.branch || undefined),
        batch: batchSemesterBatch === 'ALL' ? undefined : batchSemesterBatch,
        currentSemester: batchSemesterReached,
      });
      setBatchSemesterMsg({
        type: 'success',
        text: res.message || `Successfully set reached semester to S${batchSemesterReached}.`,
      });
      await fetchStudents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update reached semester';
      setBatchSemesterMsg({ type: 'error', text: msg });
    } finally {
      setIsSavingBatchSemester(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Fetch campus-wide public placement stats for pie chart
  const fetchPublicStats = useCallback(async () => {
    try {
      const data = await getPublicPlacementStats();
      setPublicStats(data);
    } catch {
      // Ignore initial fetch error
    }
  }, []);

  // Fetch department placement stats
  const fetchDeptStats = useCallback(async () => {
    setIsLoadingDeptStats(true);
    try {
      const data = await getDepartmentStats(user?.branch || undefined);
      setDepartmentStats(data);
    } catch {
      // Ignore initial fetch error
    } finally {
      setIsLoadingDeptStats(false);
    }
  }, [user?.branch]);

  // Fetch recruitment drives
  const fetchDrives = useCallback(async () => {
    setIsLoadingDrives(true);
    try {
      const data = await listDrives();
      setDrivesList(data);
    } catch {
      // Ignore initial fetch error
    } finally {
      setIsLoadingDrives(false);
    }
  }, []);

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

  const handleAddBatchFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchFieldModalDriveId) return;
    if (!newFieldKey.trim() || !newFieldLabel.trim()) {
      setBatchFieldMsg({ type: 'error', text: 'Field key and label are required.' });
      return;
    }

    setIsSubmittingField(true);
    setBatchFieldMsg(null);
    try {
      const optionsArray =
        newFieldType === 'dropdown'
          ? newFieldOptions
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined;

      const newFieldObj: DriveExtraField = {
        key: newFieldKey.trim().replace(/\s+/g, '_').toLowerCase(),
        label: newFieldLabel.trim(),
        type: newFieldType,
        options: optionsArray,
        required: newFieldRequired,
      };

      await updateDriveExtraFields(batchFieldModalDriveId, { newField: newFieldObj });
      setBatchFieldMsg({
        type: 'success',
        text: `Field "${newFieldLabel}" added! The column is now active in the ongoing spreadsheet.`,
      });
      await fetchDrives();
      setNewFieldKey('');
      setNewFieldLabel('');
      setNewFieldOptions('');
      setNewFieldRequired(false);
      setTimeout(() => {
        setBatchFieldModalDriveId(null);
        setBatchFieldMsg(null);
      }, 1500);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      setBatchFieldMsg({
        type: 'error',
        text: axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to add batch field.',
      });
    } finally {
      setIsSubmittingField(false);
    }
  };

  const [updatingStatusStudentId, setUpdatingStatusStudentId] = useState<string | null>(null);

  const handleUpdateStudentStatus = async (
    studentId: string,
    newStatus: 'UNPLACED' | 'GENERAL' | 'DREAM' | 'INTERNSHIP'
  ) => {
    try {
      setUpdatingStatusStudentId(studentId);
      await updateStudentPlacementStatus(studentId, newStatus);
      setStudents((prev) =>
        prev.map((st) =>
          st.studentId === studentId
            ? {
                ...st,
                placementStatus: newStatus,
                placement:
                  newStatus === 'UNPLACED'
                    ? { isPlaced: false, company: null, role: null, ctcLpa: null }
                    : {
                        ...(st.placement || { isPlaced: true, company: 'Recruitment Placement', role: null, ctcLpa: null }),
                        isPlaced: true,
                      },
              }
            : st
        )
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      alert(axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to update student placement status');
    } finally {
      setUpdatingStatusStudentId(null);
    }
  };

  const handleDeleteStudent = async (studentId: string, studentName?: string | null) => {
    const displayName = studentName || studentId;
    if (!window.confirm(`Are you sure you want to permanently delete student ${displayName} (${studentId})? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteStudent(studentId);
      setStudents((prev) => prev.filter((s) => s.studentId !== studentId));
      if (selectedStudentForModal?.studentId === studentId) {
        setSelectedStudentForModal(null);
      }
      alert(`Student ${displayName} deleted successfully.`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      alert(axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to delete student.');
    }
  };

  const handleExportAllStudents = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`${user?.branch || 'Class'}_Students`);

    sheet.columns = [
      { header: 'Student ID / Roll No', key: 'studentId', width: 20 },
      { header: 'Registration Number', key: 'registrationNumber', width: 22 },
      { header: 'Full Name', key: 'name', width: 24 },
      { header: 'First Name', key: 'firstName', width: 16 },
      { header: 'Last Name', key: 'lastName', width: 16 },
      { header: 'Date of Birth', key: 'dob', width: 15 },
      { header: 'Age', key: 'age', width: 10 },
      { header: 'Branch', key: 'branch', width: 12 },
      { header: 'Batch', key: 'batch', width: 12 },
      { header: 'Official Email', key: 'email', width: 28 },
      { header: 'Contact Phone', key: 'phone', width: 16 },
      { header: 'Active Backlogs', key: 'activeBacklogs', width: 14 },
      { header: 'CGPA', key: 'cgpa', width: 12 },
      { header: 'Percentage (%)', key: 'percentage', width: 14 },
      { header: 'Total Marks', key: 'totalMarks', width: 14 },
      { header: 'Max Marks', key: 'maxMarks', width: 14 },
      { header: 'Placement Status', key: 'placementStatus', width: 18 },
      { header: 'Company Placed', key: 'companyPlaced', width: 22 },
      { header: 'Package (LPA)', key: 'packageLpa', width: 15 },
      { header: 'Marksheet Drive Link', key: 'marksheetUrl', width: 35 },
      { header: 'Sem 1 SGPA', key: 's1Sgpa', width: 12 },
      { header: 'Sem 1 Marksheet Link', key: 's1Marksheet', width: 30 },
      { header: 'Sem 2 SGPA', key: 's2Sgpa', width: 12 },
      { header: 'Sem 2 Marksheet Link', key: 's2Marksheet', width: 30 },
      { header: 'Sem 3 SGPA', key: 's3Sgpa', width: 12 },
      { header: 'Sem 3 Marksheet Link', key: 's3Marksheet', width: 30 },
    ];

    for (const s of students) {
      const semMap: Record<number, { sgpa: number; marksheetUrl?: string | null }> = {};
      s.semesters?.forEach((sem) => {
        semMap[sem.semester] = { sgpa: sem.sgpa, marksheetUrl: sem.marksheetUrl };
      });

      sheet.addRow({
        studentId: s.studentId,
        registrationNumber: s.registrationNumber || '',
        name: s.name || '',
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        dob: s.dob || '',
        age: s.age ?? '',
        branch: s.branch || '',
        batch: s.batch || '',
        email: s.email || '',
        phone: s.phone || '',
        activeBacklogs: s.activeBacklogs,
        cgpa: s.cgpa,
        percentage: s.percentage ?? '',
        totalMarks: s.totalMarks ?? '',
        maxMarks: s.maxMarks ?? '',
        placementStatus: s.placementStatus || (s.placement?.isPlaced ? 'Placed' : 'Unplaced'),
        companyPlaced: s.placement?.company || '—',
        packageLpa: s.placement?.ctcLpa || '—',
        marksheetUrl: s.marksheetUrl || '',
        s1Sgpa: semMap[1]?.sgpa ?? '',
        s1Marksheet: semMap[1]?.marksheetUrl || s.s1MarksheetUrl || '',
        s2Sgpa: semMap[2]?.sgpa ?? '',
        s2Marksheet: semMap[2]?.marksheetUrl || s.s2MarksheetUrl || '',
        s3Sgpa: semMap[3]?.sgpa ?? '',
        s3Marksheet: semMap[3]?.marksheetUrl || s.s3MarksheetUrl || '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${user?.branch || 'Department'}_Students_Full_Roster.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
      void fetchDeptStats();
    } else if (activeTab === 'credits') {
      void fetchCredits();
    } else if (activeTab === 'drives') {
      void fetchDrives();
    } else if (activeTab === 'analytics') {
      void fetchPublicStats();
      void fetchDeptStats();
    } else if (activeTab === 'placed') {
      void fetchDeptStats();
      void fetchPublicStats();
    }
  }, [activeTab, fetchRequests, fetchStudents, fetchCredits, fetchDrives, fetchDeptStats, fetchPublicStats]);

  // Initial fetch for department stats, drives, students, public stats, and pending count badge
  useEffect(() => {
    void fetchDeptStats();
    void fetchRequests();
    void fetchDrives();
    void fetchStudents();
    void fetchPublicStats();
  }, [fetchDeptStats, fetchRequests, fetchDrives, fetchStudents, fetchPublicStats]);

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

  // --- Review Correction / Applied Request Handler ---
  const handleReview = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setReviewingId(requestId);
    setRequestActionMsg(null);
    const remarks = reviewRemarks[requestId] || '';

    try {
      await reviewCorrectionRequest(requestId, action, remarks);
      setRequestActionMsg({
        type: 'success',
        text: `Request successfully ${action === 'APPROVE' ? 'approved' : 'rejected'}.`,
      });
      await fetchRequests();
      await fetchStudents();
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
  const hasStudentIdentity = mappedFieldValues.has('studentId') || mappedFieldValues.has('registrationNumber');
  const missingRequiredFields = CANONICAL_FIELD_OPTIONS.filter(
    (field) => field.required && !(field.key === 'studentId' ? hasStudentIdentity : mappedFieldValues.has((field as { key: string }).key))
  );

  const pendingRequestsCount = correctionRequests.filter((r) => r.status === 'PENDING').length;

  const filteredStudents = students.filter((s) => {
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      const match =
        s.studentId.toLowerCase().includes(q) ||
        (s.registrationNumber && s.registrationNumber.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q));
      if (!match) return false;
    }

    if (studentFilter === 'placed') {
      return !!s.placement?.isPlaced;
    }
    if (studentFilter === 'unplaced') {
      return !s.placement?.isPlaced;
    }
    if (studentFilter === 'backlogs') {
      return (s.activeBacklogs || 0) > 0;
    }
    if (studentFilter === 'zero_backlogs') {
      return (s.activeBacklogs || 0) === 0;
    }
    return true;
  });

  return (
    <RequireAuth roles={['BRANCH_COORDINATOR']}>
      <div
        ref={containerRef}
        className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-white selection:text-black flex"
      >
        {/* ========================================================= */}
        {/* LEFT SIDEBAR NAVIGATION (Modern 2026 Layout)               */}
        {/* ========================================================= */}
        <aside className="w-64 border-r border-neutral-800/80 bg-[#0c0c0e] flex-col justify-between p-6 shrink-0 hidden lg:flex sticky top-0 h-screen z-40">
          <div className="space-y-8">
            {/* Identity & Department Badge */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-white font-mono font-bold text-sm shadow-inner">
                  {user?.branch || 'FAC'}
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#0c0c0e] animate-pulse" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white tracking-tight truncate leading-none">
                  {user?.branch || 'Department'} Portal
                </h2>
                <p className="text-[11px] text-neutral-400 font-medium mt-1 truncate">
                  Faculty &bull; Coordinator
                </p>
              </div>
            </div>

            {/* Nav tabs */}
            <nav className="space-y-1.5">
              {[
                { id: 'students', label: 'Class Students', icon: Users, badge: students.length },
                { id: 'placed', label: 'Record Placements', icon: Award, badge: departmentStats?.placedCount },
                { id: 'analytics', label: 'Pie Chart Analytics', icon: PieChartIcon },
                { id: 'drives', label: 'Recruitment Drives & Application Sheets', icon: Briefcase, badge: drivesList.length },
                { id: 'requests', label: 'Corrections & Applied Requests', icon: FileCheck2, badge: pendingRequestsCount },
                { id: 'upload', label: 'Upload Class Roster', icon: Upload },
                { id: 'credits', label: 'Curriculum Credits', icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                      isActive
                        ? 'bg-neutral-800/90 text-white shadow-xs border border-neutral-700/60'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          item.id === 'requests' && pendingRequestsCount > 0
                            ? 'bg-amber-400 text-black font-bold'
                            : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom */}
          <div className="space-y-4 pt-6 border-t border-neutral-800/80">
            <div className="p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-bold text-white">Department Faculty Active</span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Stream: <strong className="text-white">{user?.branch || 'CSE'}</strong> &bull; Batch 2026
              </p>
            </div>

            <div className="space-y-1 text-xs font-medium text-neutral-400">
              <Link
                href="/"
                className="flex items-center justify-between py-1 hover:text-white transition group"
              >
                <span>Public Placement Home</span>
                <span className="text-[10px] text-neutral-500 group-hover:text-white">↗</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-between py-1 text-red-400 hover:text-red-300 transition text-left"
              >
                <span>Sign Out</span>
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* MAIN BODY AREA                                            */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header Navbar */}
          <header className="h-16 border-b border-neutral-800/80 bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-xs font-medium text-neutral-300">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>{user?.branch || 'Department'} Faculty Portal &bull; Coordinator</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition border ${
                  pendingRequestsCount > 0
                    ? 'bg-amber-400 text-black font-bold border-amber-300 shadow-xs'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                }`}
                title="Pending Requests"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>
                  {pendingRequestsCount > 0
                    ? `${pendingRequestsCount} Pending Request${pendingRequestsCount === 1 ? '' : 's'}`
                    : '0 Notifications'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 text-xs font-bold transition shadow-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </header>

          {/* Department Placement Overview Banner */}
          <div className="p-4 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto space-y-8 flex-1">
            <div className="bg-[#101012] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-neutral-800">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 font-medium mb-3">
                    <Building2 className="h-3.5 w-3.5 text-white" />
                    <span>{user?.branch || 'Department'} Faculty Workspace</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {user?.branch || 'Department'} Department Dashboard
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                    Real-time placement records, student academic roster, ongoing spreadsheets, and interactive department placement analytics.
                  </p>
                </div>

                {/* Quick Metrics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl text-center">
                    <span className="text-[10px] text-neutral-400 block font-medium">Total Enrolled</span>
                    <span className="text-2xl font-black text-white font-mono mt-0.5 block">
                      {departmentStats?.totalStudents ?? students.length}
                    </span>
                    <span className="text-[10px] text-neutral-500">Registered Students</span>
                  </div>

                  <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl text-center">
                    <span className="text-[10px] text-neutral-400 block font-medium">Total Placed</span>
                    <span className="text-2xl font-black text-white font-mono mt-0.5 block">
                      {departmentStats?.placedCount ?? 0}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono font-bold">
                      {departmentStats?.placementRate ?? 0}% Placed
                    </span>
                  </div>

                  <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl text-center">
                    <span className="text-[10px] text-neutral-400 block font-medium">Highest Package</span>
                    <span className="text-xl font-black text-white font-mono mt-0.5 block">
                      {departmentStats?.highestPackage ? `${departmentStats.highestPackage} LPA` : '—'}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      Avg: {departmentStats?.averagePackage ? `${departmentStats.averagePackage} LPA` : '—'}
                    </span>
                  </div>

                  <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl text-center">
                    <span className="text-[10px] text-neutral-400 block font-medium">Active Drives</span>
                    <span className="text-2xl font-black text-white font-mono mt-0.5 block">
                      {departmentStats?.activeDrivesCount ?? drivesList.length}
                    </span>
                    <span className="text-[10px] text-neutral-500">Open Opportunities</span>
                  </div>
                </div>
              </div>

              {/* Mobile Tab Quick Switcher */}
              <div className="flex items-center gap-2 overflow-x-auto lg:hidden pt-2">
                {[
                  { id: 'students', label: 'Students' },
                  { id: 'placed', label: 'Placements' },
                  { id: 'analytics', label: 'Pie Chart' },
                  { id: 'drives', label: 'Drives' },
                  { id: 'requests', label: 'Requests' },
                  { id: 'upload', label: 'Upload' },
                  { id: 'credits', label: 'Credits' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                      activeTab === t.id
                        ? 'bg-white text-black'
                        : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB: RECORD PLACEMENTS & ROSTER */}
            {activeTab === 'placed' && (
              <PlacedStudentsManager
                userRole="BRANCH_COORDINATOR"
                userBranch={user?.branch || undefined}
                onStatsUpdated={() => {
                  void fetchDeptStats();
                  void fetchPublicStats();
                }}
              />
            )}

            {/* TAB: DEPARTMENT PLACEMENT SHARE PIE CHART */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <DepartmentPlacementPieChart
                  branchBreakdown={publicStats?.branchBreakdown || []}
                  totalStudents={departmentStats?.totalStudents ?? students.length}
                  totalPlaced={departmentStats?.placedCount ?? 0}
                  title={`${user?.branch || 'Department'} & Campus Placement Pie Chart`}
                  subtitle="Portion sizes represent number of placements per department across CSE, ECE, EEE, IT, CIVIL, MCA"
                />
              </div>
            )}
          {/* TAB 1: UPLOAD CLASS ROSTER */}
          {activeTab === 'upload' && (
            <div>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">
                  Upload {user?.branch} Class Roster
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
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
              <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs overflow-hidden mb-8">
                <div className="p-6 border-b border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-white" />
                      Select Excel File (.xlsx) for {user?.branch}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Expected columns: studentId, name, branch ({user?.branch}), batch, email, phone, activeBacklogs, s1Sgpa...
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-700 rounded-md text-xs font-semibold text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60 transition shadow-2xs"
                  >
                    <Download className="h-4 w-4 text-white" />
                    Download Sample Template
                  </button>
                </div>

                <div className="p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <label className="flex-1 w-full flex items-center justify-center px-6 py-4 border-2 border-dashed border-neutral-700 rounded-lg hover:border-blue-500 transition cursor-pointer bg-neutral-900/40">
                      <input
                        type="file"
                        accept=".xlsx"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                      <div className="flex items-center gap-3">
                        <Upload className="h-5 w-5 text-gray-400" />
                        <span className="text-sm font-medium text-neutral-300">
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
                <div className="bg-[#18181b] text-white rounded-xl shadow-xs border border-blue-100 p-6 mb-8 text-center">
                  <div className="inline-flex items-center justify-center p-3 bg-neutral-900 rounded-full text-white mb-3 animate-bounce">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    Analyzing Spreadsheet Structure & Mapping Columns...
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                    Scanning worksheet rows, skipping title banners, and binding headers to student canonical fields.
                  </p>
                </div>
              )}

              {/* Structure Analysis & Column Mapping Card */}
              {primarySheet && !isAnalyzing && (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs overflow-hidden mb-8">
                  <div className="p-6 border-b border-neutral-800 bg-neutral-900/60 border-b border-neutral-800">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-white" />
                          <h3 className="text-base font-semibold text-white">
                            Spreadsheet Structure & Column Mapping
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-200">
                            {primarySheet.sheetName}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1">
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 rounded-md text-xs font-medium text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60 transition"
                        >
                          <Settings className="h-3.5 w-3.5 text-neutral-400" />
                          Re-Analyze
                        </button>
                        <button
                          type="button"
                          onClick={handlePreview}
                          disabled={isPreviewing || isCommitting}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed transition shadow-2xs"
                        >
                          {isPreviewing ? 'Validating...' : 'Generate Preview'}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {missingRequiredFields.length > 0 ? (
                      <div className="mt-4 p-3.5 bg-amber-950/50 border border-amber-800/70 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-white">Auto-Generated Student ID Enabled: </span>
                          No <strong>Student ID / Reg No</strong> column was mapped in this sheet (added at the bottom below). You can still generate the preview — temporary login credentials will be created so students can log in, enter their official Roll No &amp; details, and get verified by you!
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 p-3.5 bg-neutral-900 border border-neutral-700 rounded-xl flex items-start gap-2.5 text-xs text-neutral-200">
                        <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-white">Flexible Registration: </span>
                          Missing fields (Name, Email, Phone, Batch, DOB) can be left unmapped—students will be prompted to fill them in automatically on their first login!
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    <div className="border border-neutral-800 rounded-lg overflow-x-auto">
                      <table className="min-w-full divide-y divide-neutral-800 text-xs">
                        <thead className="bg-neutral-900/60 font-semibold text-neutral-400">
                          <tr>
                            <th className="px-4 py-3 text-left">Uploaded Excel Header</th>
                            <th className="px-4 py-3 text-left">Mapped Canonical Field</th>
                            <th className="px-4 py-3 text-left">Match Source</th>
                            <th className="px-4 py-3 text-left">Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800 bg-[#101012]">
                          {primarySheet.headers.map((header) => {
                            const match = primarySheet.mapping[header];
                            const currentMappedVal = columnMapping[header] || '';

                            return (
                              <tr key={header} className="hover:bg-neutral-900/60">
                                <td className="px-4 py-3 font-semibold text-white font-mono">
                                  {header}
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={currentMappedVal}
                                    onChange={(e) => handleMappingChange(header, e.target.value)}
                                    className="w-full max-w-xs border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-[#18181b] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
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
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/70">
                                      Exact Match
                                    </span>
                                  ) : match?.source === 'pattern' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-neutral-800 text-neutral-200 border border-neutral-700">
                                      Pattern Match
                                    </span>
                                  ) : match?.source === 'ai' ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-950/70 text-purple-300 border border-purple-800/70">
                                      AI Suggested
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                                      Unmatched
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-neutral-400 font-mono">
                                  {match ? `${Math.round(match.confidence * 100)}%` : '—'}
                                </td>
                              </tr>
                            );
                          })}
                          {missingRequiredFields.map((missingField) => (
                            <tr key={`missing-${missingField.key}`} className="bg-amber-950/20 border-t border-amber-800/40">
                              <td className="px-4 py-3 font-mono text-amber-300 italic">
                                (Not in Excel Sheet)
                              </td>
                              <td className="px-4 py-3 font-semibold text-white">
                                {missingField.label} *
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/70">
                                  Auto-Generated on Import
                                </span>
                              </td>
                              <td className="px-4 py-3 text-neutral-400 font-mono text-[11px]">
                                Student enters on login
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Results Card */}
              {previewData && (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs overflow-hidden space-y-6 p-6">
                  <div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          Validation Summary
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Verified against branch scoping ({user?.branch}) and database uniqueness.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setPreviewData(null)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 rounded-md text-xs font-medium text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60 transition"
                      >
                        <Settings className="h-3.5 w-3.5 text-neutral-400" />
                        Adjust Column Mapping
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800">
                        <span className="text-xs text-neutral-400 block">Total Rows</span>
                        <span className="text-lg font-bold text-white">{previewData.summary.total}</span>
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

                  <div className="border border-neutral-800 rounded-lg overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-800 text-xs">
                      <thead className="bg-neutral-900/60 font-semibold text-neutral-400">
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
                      <tbody className="divide-y divide-neutral-800 bg-[#101012]">
                        {previewData.rows.map((r) => {
                          const isValid = r.errors.length === 0;
                          return (
                            <tr key={r.rowNumber} className={isValid ? 'hover:bg-neutral-900/60' : 'bg-red-50/50'}>
                              <td className="px-3 py-2 font-mono text-neutral-400">#{r.rowNumber}</td>
                              <td className="px-3 py-2 font-mono font-bold text-white">{String(r.data.studentId || '')}</td>
                              <td className="px-3 py-2 text-neutral-200">{String(r.data.name || '')}</td>
                              <td className="px-3 py-2 text-neutral-300">{String(r.data.branch || '')}</td>
                              <td className="px-3 py-2 text-neutral-400">{String(r.data.email || '')}</td>
                              <td className="px-3 py-2 text-neutral-300 font-semibold">{String(r.data.activeBacklogs ?? '0')}</td>
                              <td className="px-3 py-2 font-bold text-white">{r.cgpa.toFixed(2)}</td>
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

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-800">
                    {previewData.summary.invalid > 0 ? (
                      <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={skipInvalid}
                          onChange={(e) => setSkipInvalid(e.target.checked)}
                          className="rounded-sm border-neutral-700 text-white focus:ring-blue-500 h-4 w-4"
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

          {/* TAB 2: CORRECTIONS / APPLIED REQUESTS */}
          {activeTab === 'requests' && (
            <div>
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Student Applied Requests &amp; Corrections
                  </h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Review recruitment drive applications and data correction requests from students in {user?.branch}. Approving a drive application verifies the candidate in the live recruitment spreadsheet.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={fetchRequests}
                    disabled={isLoadingRequests}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 rounded-md text-xs font-medium text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60 transition shadow-2xs self-start sm:self-auto"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-neutral-400 ${isLoadingRequests ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Notification Banner when pending requests exist */}
              {pendingRequestsCount > 0 && (
                <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
                  <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5">
                    <Bell className="h-5 w-5 animate-bounce" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold">
                        {pendingRequestsCount} Pending Request{pendingRequestsCount === 1 ? '' : 's'} Requiring Coordinator Attention
                      </h3>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                        Action Required
                      </span>
                    </div>
                    <p className="text-xs text-amber-800 mt-1">
                      Students in {user?.branch} have submitted placement drive applications or profile data correction requests. Review the entries below to verify candidates or approve corrections.
                    </p>
                  </div>
                </div>
              )}

              {/* Request Type & Status Filter Tabs */}
              <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-3.5">
                <button
                  type="button"
                  onClick={() => setRequestFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    requestFilter === 'all'
                      ? 'bg-white text-black font-bold shadow-2xs'
                      : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  All Requests ({correctionRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRequestFilter('pending')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    requestFilter === 'pending'
                      ? 'bg-amber-400 text-black font-bold shadow-2xs'
                      : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  Pending Review ({pendingRequestsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRequestFilter('drives')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    requestFilter === 'drives'
                      ? 'bg-white text-black font-bold shadow-2xs'
                      : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  Drive Applications ({
                    correctionRequests.filter(
                      (r) => (r.requestedChanges as Record<string, unknown>)?.type === 'DRIVE_APPLICATION'
                    ).length
                  })
                </button>
                <button
                  type="button"
                  onClick={() => setRequestFilter('corrections')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    requestFilter === 'corrections'
                      ? 'bg-white text-black font-bold shadow-2xs'
                      : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:bg-neutral-800 hover:text-white'
                  }`}
                >
                  Data Corrections ({
                    correctionRequests.filter(
                      (r) => (r.requestedChanges as Record<string, unknown>)?.type !== 'DRIVE_APPLICATION'
                    ).length
                  })
                </button>
              </div>

              {requestActionMsg && (
                <div
                  role="status"
                  className={`mb-6 rounded-xl p-4 border flex items-start gap-3 ${
                    requestActionMsg.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-800/70 text-emerald-200'
                      : 'bg-red-950/60 border-red-800/70 text-red-200'
                  }`}
                >
                  {requestActionMsg.type === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="text-sm font-medium">{requestActionMsg.text}</div>
                </div>
              )}

              {isLoadingRequests ? (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-8 text-center text-sm text-neutral-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-white mb-2" />
                  Loading requests...
                </div>
              ) : correctionRequests.length === 0 ? (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-12 text-center">
                  <FileCheck2 className="h-10 w-10 text-neutral-500 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-white">No Applied Requests or Corrections</h3>
                  <p className="mt-1 text-xs text-neutral-400">
                    There are no pending or past drive applications or data correction requests from students in {user?.branch}.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {correctionRequests
                    .filter((req) => {
                      const isDrive = (req.requestedChanges as Record<string, unknown>)?.type === 'DRIVE_APPLICATION';
                      if (requestFilter === 'pending') return req.status === 'PENDING';
                      if (requestFilter === 'drives') return isDrive;
                      if (requestFilter === 'corrections') return !isDrive;
                      return true;
                    })
                    .map((req) => {
                      const isPending = req.status === 'PENDING';
                      const isApproved = req.status === 'APPROVED';
                      const isRejected = req.status === 'REJECTED';
                      const changes = req.requestedChanges as Record<string, unknown>;
                      const isDrive = changes?.type === 'DRIVE_APPLICATION';

                      return (
                        <div
                          key={req.id}
                          className={`bg-[#101012] rounded-2xl shadow-xs border overflow-hidden transition ${
                            isPending ? 'border-amber-700/70 ring-1 ring-amber-500/20' : 'border-neutral-800'
                          }`}
                        >
                          <div className="p-5 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                              {/* Request Type Badge */}
                              {isDrive ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white text-black border border-white whitespace-nowrap">
                                  <Briefcase className="h-3.5 w-3.5" />
                                  Drive Application
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-800 text-neutral-200 border border-neutral-700 whitespace-nowrap">
                                  <FileText className="h-3.5 w-3.5" />
                                  Profile Correction
                                </span>
                              )}

                              <span className="font-mono font-bold text-sm text-white">
                                {req.studentId}
                              </span>
                              {req.registrationNumber && (
                                <span className="font-mono text-xs text-neutral-400">
                                  ({req.registrationNumber})
                                </span>
                              )}
                              <span className="text-sm font-semibold text-neutral-200">
                                {req.studentName || 'Student'}
                              </span>
                              <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 font-medium">
                                {req.branch}
                              </span>
                            </div>

                            <div className="flex items-center gap-2.5">
                              {isPending && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/70 text-amber-300 border border-amber-800/70 whitespace-nowrap">
                                  <Clock className="h-3 w-3" /> Pending Review
                                </span>
                              )}
                              {isApproved && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-800/70 whitespace-nowrap">
                                  <Check className="h-3 w-3" /> Approved &amp; Verified
                                </span>
                              )}
                              {isRejected && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-950/70 text-red-300 border border-red-800/70 whitespace-nowrap">
                                  <X className="h-3 w-3" /> Rejected
                                </span>
                              )}
                              <span className="text-xs text-neutral-400 font-mono">
                                {new Date(req.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="p-5 space-y-4">
                            {/* Card Content: Drive Application Specific */}
                            {isDrive ? (
                              <div className="p-4 bg-neutral-900/70 rounded-xl border border-neutral-800 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div>
                                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                                      <Building2 className="h-4 w-4 text-neutral-300" />
                                      {String(changes.company || 'Company')}
                                    </h4>
                                    <p className="text-xs text-neutral-300 mt-1">
                                      Role: <strong className="text-white">{String(changes.role || 'Software Engineer')}</strong> &bull; Tier:{' '}
                                      <strong className="text-white">{String(changes.packageCategory || 'General')}</strong> &bull; Package:{' '}
                                      <strong className="font-mono text-emerald-400 font-bold">
                                        {changes.ctcLpa ? `${changes.ctcLpa} LPA` : 'Standard'}
                                      </strong>
                                    </p>
                                  </div>

                                  {typeof changes.driveId === 'string' && (
                                    <Link
                                      href={`/drives/${String(changes.driveId)}`}
                                      target="_blank"
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 transition shadow-2xs self-start sm:self-auto whitespace-nowrap"
                                    >
                                      <FileSpreadsheet className="h-3.5 w-3.5" />
                                      Open Application Sheet
                                      <ExternalLink className="h-3 w-3 opacity-70 ml-0.5" />
                                    </Link>
                                  )}
                                </div>

                                <div className="text-xs text-neutral-300 bg-[#09090b] p-3.5 rounded-xl border border-neutral-800">
                                  <span className="font-bold block text-white mb-1">Application Summary:</span>
                                  {req.reason}
                                </div>
                              </div>
                            ) : (
                              /* Card Content: Profile Data Correction Specific */
                              <div>
                                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                                  Requested Profile Field Changes:
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {Object.entries(changes).map(([k, v]) => (
                                    <div
                                      key={k}
                                      className="p-2.5 bg-neutral-900/60 rounded-lg border border-neutral-800 text-xs"
                                    >
                                      <span className="text-neutral-400 block font-medium capitalize">
                                        {k.replace(/([A-Z])/g, ' $1')}
                                      </span>
                                      <span className="text-white font-mono font-bold mt-0.5 block">
                                        {String(v)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="bg-neutral-900/60 p-3 rounded-lg border border-neutral-800 text-xs mt-3">
                                  <span className="font-semibold text-neutral-300 block mb-0.5">
                                    Student Reason:
                                  </span>
                                  <p className="text-neutral-400">{req.reason}</p>
                                </div>
                              </div>
                            )}

                            {req.reviewerRemarks && (
                              <div className="text-xs text-neutral-300 bg-neutral-900/80 p-3 rounded-xl border border-neutral-800">
                                <span className="font-semibold text-white">Coordinator Remarks: </span>
                                {req.reviewerRemarks}
                              </div>
                            )}

                            {isPending && (
                              <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                                <input
                                  type="text"
                                  placeholder={
                                    isDrive
                                      ? 'Optional reviewer remarks (e.g. Verified eligibility and marksheets)...'
                                      : 'Optional reviewer remarks (e.g. Verified with marksheet)...'
                                  }
                                  value={reviewRemarks[req.id] || ''}
                                  onChange={(e) =>
                                    setReviewRemarks((prev) => ({ ...prev, [req.id]: e.target.value }))
                                  }
                                  className="flex-1 text-xs border border-neutral-700 rounded-xl px-3.5 py-2.5 bg-[#18181b] text-white placeholder:text-neutral-500 font-medium focus:outline-hidden focus:border-white"
                                />

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleReview(req.id, 'APPROVE')}
                                    disabled={reviewingId === req.id}
                                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 transition shadow-2xs whitespace-nowrap"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    {isDrive ? 'Verify & Approve Application' : 'Approve & Update Record'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReview(req.id, 'REJECT')}
                                    disabled={reviewingId === req.id}
                                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-300 bg-red-950/60 hover:bg-red-900/60 border border-red-800/70 disabled:bg-neutral-800 disabled:text-neutral-500 transition shadow-2xs whitespace-nowrap"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    {isDrive ? 'Reject Application' : 'Reject'}
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
              {/* Batch Semester Progress & Junior Batches Configuration */}
              <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Clock className="h-4 w-4 text-white" />
                      <span>Batch Semester Progress &amp; Junior Batches Configuration</span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Configure the currently reached semester for junior batches (e.g. Batch 2028 in S2). Future semesters are marked as &quot;Yet to reach&quot; across student records.
                    </p>
                  </div>
                </div>

                {batchSemesterMsg && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-medium ${
                      batchSemesterMsg.type === 'success'
                        ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                        : 'bg-red-950/60 border-red-800 text-red-300'
                    }`}
                  >
                    {batchSemesterMsg.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {user?.role === 'MAIN_COORDINATOR' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                        Branch
                      </label>
                      <select
                        value={batchSemesterBranch}
                        onChange={(e) => setBatchSemesterBranch(e.target.value)}
                        className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white"
                      >
                        <option value="">All Branches</option>
                        {['CSE', 'ECE', 'EEE', 'IT', 'CIVIL', 'MCA'].map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Target Batch
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2028 or ALL"
                      value={batchSemesterBatch}
                      onChange={(e) => setBatchSemesterBatch(e.target.value)}
                      className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-300 mb-1">
                      Reached Semester
                    </label>
                    <select
                      value={batchSemesterReached}
                      onChange={(e) => setBatchSemesterReached(Number(e.target.value))}
                      className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white font-mono"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s}>
                          Semester {s} {s <= 2 ? '(Junior Batch)' : s <= 6 ? '(Mid-Term)' : '(Final Year)'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleSaveBatchSemester}
                      disabled={isSavingBatchSemester}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-black hover:bg-neutral-200 font-bold rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{isSavingBatchSemester ? 'Updating...' : 'Set Reached Semester'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {user?.branch} Class Students Directory
                  </h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Live profile directory and comprehensive academic records of all registered students in {user?.branch}.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search ID, name, email..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-9 pr-3 py-1.5 text-xs border border-neutral-700 rounded-lg bg-[#18181b] text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-52 sm:w-60"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-gray-400" />
                    <select
                      value={studentFilter}
                      onChange={(e) =>
                        setStudentFilter(
                          e.target.value as 'all' | 'placed' | 'unplaced' | 'backlogs' | 'zero_backlogs'
                        )
                      }
                      className="text-xs border border-neutral-700 rounded-lg px-2.5 py-1.5 bg-[#18181b] text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Students ({students.length})</option>
                      <option value="placed">
                        Placed Only ({students.filter((s) => s.placement?.isPlaced).length})
                      </option>
                      <option value="unplaced">
                        Unplaced Only ({students.filter((s) => !s.placement?.isPlaced).length})
                      </option>
                      <option value="zero_backlogs">Zero Backlogs</option>
                      <option value="backlogs">Active Backlogs</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportAllStudents}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-md text-xs font-semibold transition shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                    Export All (.xlsx)
                  </button>

                  <button
                    type="button"
                    onClick={fetchStudents}
                    disabled={isLoadingStudents}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 rounded-md text-xs font-medium text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60 transition shadow-2xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-neutral-400 ${isLoadingStudents ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {isLoadingStudents ? (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-8 text-center text-sm text-neutral-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-white mb-2" />
                  Loading students...
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-12 text-center">
                  <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-white">No Students Found</h3>
                  <p className="mt-1 text-xs text-neutral-400">
                    {students.length === 0
                      ? `No students have been registered in ${user?.branch} yet. Upload an Excel roster to create accounts.`
                      : 'No students matched your search and filter criteria.'}
                  </p>
                </div>
              ) : (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-neutral-800 text-xs">
                      <thead className="bg-neutral-900/60 font-semibold text-neutral-400">
                        <tr>
                          <th className="px-3.5 py-3 text-left">Roll No</th>
                          <th className="px-3.5 py-3 text-left">Reg No</th>
                          <th className="px-3.5 py-3 text-left">Student Name</th>
                          <th className="px-3.5 py-3 text-left">DOB / Age</th>
                          <th className="px-3.5 py-3 text-left">Batch</th>
                          <th className="px-3.5 py-3 text-left">Contact Info</th>
                          <th className="px-3.5 py-3 text-left">Backlogs</th>
                          <th className="px-3.5 py-3 text-left">CGPA</th>
                          <th className="px-3.5 py-3 text-left">Percentage</th>
                          <th className="px-3.5 py-3 text-left">Total Marks</th>
                          <th className="px-3.5 py-3 text-left">Placement Status</th>
                          <th className="px-3.5 py-3 text-left">Marksheet</th>
                          <th className="px-3.5 py-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800 bg-[#101012]">
                        {filteredStudents.map((s) => (
                          <tr key={s.studentId} className="hover:bg-neutral-900/60/80 transition">
                            <td className="px-3.5 py-3 font-mono font-bold text-white">
                              {s.studentId}
                            </td>
                            <td className="px-3.5 py-3 font-mono text-neutral-300">
                              {s.registrationNumber || '—'}
                            </td>
                            <td className="px-3.5 py-3 text-white font-medium">
                              <div>{s.name || '—'}</div>
                              {(s.firstName || s.lastName) && (
                                <div className="text-[11px] text-gray-400">
                                  {[s.firstName, s.lastName].filter(Boolean).join(' ')}
                                </div>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-neutral-400 whitespace-nowrap">
                              <div>{s.dob || '—'}</div>
                              {s.age !== null && s.age !== undefined && (
                                <span className="text-[10px] text-gray-400 font-medium">{s.age} yrs</span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-neutral-400 font-medium">
                              {s.batch || '—'}
                            </td>
                            <td className="px-3.5 py-3 text-neutral-400 font-mono text-[11px]">
                              <div className="truncate max-w-[150px]" title={s.email || ''}>{s.email || '—'}</div>
                              <div className="text-gray-400">{s.phone || '—'}</div>
                            </td>
                            <td className="px-3.5 py-3">
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
                            <td className="px-3.5 py-3 font-bold text-white text-sm font-mono">
                              {s.cgpa.toFixed(2)}
                            </td>
                            <td className="px-3.5 py-3 font-bold text-emerald-700 font-mono">
                              {typeof s.percentage === 'number'
                                ? `${s.percentage.toFixed(1)}%`
                                : s.cgpa > 0
                                ? `${(s.cgpa * 9.5).toFixed(1)}%`
                                : '—'}
                            </td>
                            <td className="px-3.5 py-3 text-neutral-300 font-mono whitespace-nowrap">
                              {typeof s.totalMarks === 'number'
                                ? `${s.totalMarks}${s.maxMarks ? ` / ${s.maxMarks}` : ''}`
                                : '—'}
                            </td>
                            <td className="px-3.5 py-3">
                              <div className="space-y-1.5 min-w-[130px]">
                                {s.placementStatus === 'DREAM' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-black border border-white">
                                    ★ Dream Placed
                                  </span>
                                ) : s.placementStatus === 'INTERNSHIP' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-200 text-black border border-neutral-300">
                                    ⏳ Internship Placed
                                  </span>
                                ) : s.placementStatus === 'GENERAL' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-white border border-neutral-700">
                                    💼 General Placed
                                  </span>
                                ) : s.placement?.isPlaced ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700">
                                    <Check className="h-3 w-3" /> Placed
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
                                    Unplaced
                                  </span>
                                )}

                                {s.placement?.company && (
                                  <div className="font-semibold text-white text-[11px] truncate max-w-[130px]" title={s.placement.company || undefined}>
                                    {s.placement.company}
                                  </div>
                                )}

                                {s.placement?.ctcLpa && (
                                  <div className="text-[10px] font-mono text-emerald-400 font-bold">
                                    {s.placement.ctcLpa} LPA
                                  </div>
                                )}

                                <select
                                  value={s.placementStatus || (s.placement?.isPlaced ? 'GENERAL' : 'UNPLACED')}
                                  disabled={updatingStatusStudentId === s.studentId}
                                  onChange={(e) =>
                                    handleUpdateStudentStatus(
                                      s.studentId,
                                      e.target.value as 'UNPLACED' | 'GENERAL' | 'DREAM' | 'INTERNSHIP'
                                    )
                                  }
                                  className="block w-full text-[10px] font-semibold bg-[#18181b] text-neutral-300 border border-neutral-700 rounded-md px-1.5 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-white cursor-pointer"
                                  title="Override or update student placement tier status"
                                >
                                  <option value="UNPLACED">Set: Unplaced</option>
                                  <option value="GENERAL">Set: General (&lt; 7 LPA)</option>
                                  <option value="DREAM">Set: Dream (≥ 7 LPA)</option>
                                  <option value="INTERNSHIP">Set: Internship</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-3.5 py-3">
                              {s.marksheetUrl ? (
                                <a
                                  href={s.marksheetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-white bg-neutral-900 hover:bg-neutral-800 border border-blue-200 transition whitespace-nowrap"
                                >
                                  Drive Link 📄
                                </a>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudentForModal(s)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition"
                                >
                                  <Eye className="h-3 w-3 text-neutral-400" />
                                  Full Record
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudent(s.studentId, s.name)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-red-400 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 transition"
                                  title="Delete student record"
                                >
                                  <Trash2 className="h-3 w-3 text-red-400" />
                                </button>
                              </div>
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
                  <h2 className="text-2xl font-bold text-white">
                    {user?.branch || 'CSE'} Curriculum Semester Credits
                  </h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Define official credit weightings per semester for {user?.branch || 'CSE'}. If credits are omitted in student rosters, these defaults are used to compute CGPAs automatically.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchCredits}
                  disabled={isLoadingCredits}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 rounded-md text-xs font-medium text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60 transition shadow-2xs self-start sm:self-auto"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-neutral-400 ${isLoadingCredits ? 'animate-spin' : ''}`} />
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
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-8 text-center text-sm text-neutral-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-white mb-2" />
                  Loading branch curriculum credits...
                </div>
              ) : (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {branchCreditsList.map((item, idx) => (
                      <div
                        key={item.semester}
                        className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:bg-[#18181b] text-white hover:border-blue-300 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-white text-sm">
                            Semester {item.semester}
                          </span>
                          <span className="text-[11px] font-mono text-gray-400">
                            Sem {item.semester}
                          </span>
                        </div>
                        <label className="block text-xs text-neutral-400 mb-1 font-medium">
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
                          className="w-full border border-neutral-700 rounded-lg px-3 py-1.5 bg-[#18181b] text-white text-sm font-mono font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300">
                      <input
                        type="checkbox"
                        checked={recalculateOnSave}
                        onChange={(e) => setRecalculateOnSave(e.target.checked)}
                        className="rounded border-neutral-700 text-white focus:ring-blue-500 h-4 w-4"
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

          {/* TAB 5: RECRUITMENT DRIVES & LIVE APPLICATION SHEETS */}
          {activeTab === 'drives' && (
            <div>
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Recruitment Drives &amp; Live Application Sheets
                  </h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Access ongoing recruitment spreadsheets, inspect candidate applications in real time, and configure batch survey fields for {user?.branch || 'your branch'} students.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="flex items-center bg-[#18181b] text-white border border-neutral-700 rounded-xl p-1 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setDriveBranchFilter('mine')}
                      className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap shrink-0 ${
                        driveBranchFilter === 'mine'
                          ? 'bg-white text-black font-bold shadow-2xs'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      My Branch ({user?.branch || 'CSE'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDriveBranchFilter('all')}
                      className={`px-3.5 py-1.5 rounded-lg transition whitespace-nowrap shrink-0 ${
                        driveBranchFilter === 'all'
                          ? 'bg-white text-black font-bold shadow-2xs'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      All College Drives ({drivesList.length})
                    </button>
                  </div>

                  {/* Active vs Previous Drives Filter */}
                  <div className="flex items-center bg-[#18181b] text-white border border-neutral-700 rounded-xl p-1 text-xs font-medium">
                    {(['all', 'active', 'previous'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDriveTimeFilter(t)}
                        className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap shrink-0 capitalize ${
                          driveTimeFilter === t
                            ? 'bg-white text-black font-bold shadow-2xs'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {t === 'previous' ? 'Previous Drives' : t}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={fetchDrives}
                    disabled={isLoadingDrives}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-neutral-700 rounded-xl text-xs font-medium text-neutral-200 bg-[#18181b] hover:bg-neutral-800 transition shadow-2xs whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-neutral-400 ${isLoadingDrives ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {isLoadingDrives && drivesList.length === 0 ? (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-8 text-center text-sm text-neutral-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-white mb-2" />
                  Loading drives...
                </div>
              ) : drivesList.length === 0 ? (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-12 text-center">
                  <Briefcase className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-sm font-bold text-white">No Recruitment Drives Active</h3>
                  <p className="mt-1 text-xs text-neutral-400">
                    There are no published placement drives right now. The Main Placement Coordinator will post upcoming opportunities here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {drivesList
                    .filter((d) => {
                      if (driveBranchFilter === 'mine' && !d.eligibleBranches.includes(user?.branch || 'CSE')) {
                        return false;
                      }
                      const isPrev = Boolean(d.isPrevious || !d.open);
                      if (driveTimeFilter === 'active' && isPrev) return false;
                      if (driveTimeFilter === 'previous' && !isPrev) return false;
                      return true;
                    })
                    .map((d) => {
                      const isEligible = d.eligibleBranches.includes(user?.branch || 'CSE');
                      const extraCount = d.extraFields ? d.extraFields.length : 0;

                      return (
                        <div
                          key={d.id}
                          className="bg-[#18181b] text-white rounded-2xl border border-neutral-800 p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="min-w-0 flex-1 pr-1">
                                <h3 className="font-bold text-white text-base truncate" title={d.company}>{d.company}</h3>
                                {d.role && <p className="text-xs text-neutral-400 truncate" title={d.role}>{d.role}</p>}
                              </div>
                              <span className="shrink-0 whitespace-nowrap px-3.5 py-1 rounded-full text-xs font-bold bg-white text-black border border-white text-center shadow-xs tracking-wide min-w-[76px]">
                                {d.packageCategory === 'DREAM'
                                  ? 'Dream'
                                  : d.packageCategory === 'INTERNSHIP'
                                  ? 'Internship'
                                  : 'General'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs bg-neutral-900/60 p-3 rounded-xl border border-neutral-800 mb-3">
                              <div>
                                <span className="text-neutral-400 block text-[10px]">Package CTC:</span>
                                <span className="font-bold text-emerald-400 font-mono text-sm">
                                  {d.ctcLpa !== null ? `${d.ctcLpa} LPA` : 'As per policy'}
                                </span>
                              </div>
                              <div>
                                <span className="text-neutral-400 block text-[10px]">Min CGPA:</span>
                                <span className="font-bold text-white">
                                  {d.minCgpa > 0 ? d.minCgpa : 'None'}
                                </span>
                              </div>
                              <div>
                                <span className="text-neutral-400 block text-[10px]">Backlogs / Supply:</span>
                                <span
                                  className={`font-semibold ${
                                    d.allowBacklogs ? 'text-amber-400' : 'text-emerald-400'
                                  }`}
                                >
                                  {d.allowBacklogs ? `Allowed (≤ ${d.maxActiveBacklogs})` : 'Zero Only'}
                                </span>
                              </div>
                              <div>
                                <span className="text-neutral-400 block text-[10px]">Total Rounds:</span>
                                <span className="font-semibold text-white">{d.totalRounds}</span>
                              </div>
                            </div>

                            <div className="space-y-1.5 text-xs text-neutral-400 mb-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-neutral-400">Eligible:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {d.eligibleBranches.map((b) => (
                                    <span
                                      key={b}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${
                                        b === user?.branch
                                          ? 'bg-white text-black'
                                          : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                                      }`}
                                    >
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="text-[11px] text-neutral-400">
                                Deadline: {new Date(d.deadline).toLocaleString()}
                              </div>
                            </div>

                            {/* Selected / Placed Candidates */}
                            {d.placedCandidates && d.placedCandidates.length > 0 && (
                              <div className="mb-4 p-2.5 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-1.5">
                                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Award className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Selected / Placed ({d.placedCandidates.length})</span>
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {d.placedCandidates.map((pc) => (
                                    <span
                                      key={pc.userId}
                                      className="px-2 py-0.5 rounded-full bg-black text-white border border-emerald-700/60 text-[10px] font-semibold whitespace-nowrap"
                                    >
                                      {pc.name || pc.studentId}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Batch Info Fields Pill */}
                            {extraCount > 0 ? (
                              <div className="mb-4 p-2.5 bg-neutral-900/70 border border-neutral-800 rounded-xl">
                                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block mb-1.5">
                                  {extraCount} Batch Info Field{extraCount === 1 ? '' : 's'} Active:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {d.extraFields?.map((f) => (
                                    <span
                                      key={f.key}
                                      className="px-2.5 py-0.5 rounded-full bg-black text-white border border-neutral-700 text-[10px] font-semibold whitespace-nowrap"
                                    >
                                      {f.label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="mb-4 text-[11px] text-neutral-500 italic">
                                No custom batch questions added yet.
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-3 border-t border-neutral-800 space-y-2">
                            <Link
                              href={`/drives/${d.id}`}
                              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 transition shadow-2xs"
                            >
                              <FileSpreadsheet className="h-4 w-4" />
                              Open Application Sheet
                              <ExternalLink className="h-3 w-3 opacity-70 ml-0.5" />
                            </Link>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setBatchFieldModalDriveId(d.id);
                                  setBatchFieldMsg(null);
                                }}
                                className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-[11px] font-semibold text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition whitespace-nowrap"
                              >
                                <Plus className="h-3.5 w-3.5 text-white" />
                                Add Batch Field
                              </button>

                              <a
                                href={getAuthUrl(`/drives/${d.id}/export`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-[11px] font-semibold text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition whitespace-nowrap"
                                title="Download standard report with verified candidates and branch summary"
                              >
                                <Download className="h-3 w-3 text-neutral-400" />
                                Export Excel
                              </a>

                              <button
                                type="button"
                                onClick={() => setShortlistDrive(d)}
                                className="col-span-2 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-bold text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition whitespace-nowrap"
                              >
                                <Bell className="h-3.5 w-3.5 text-amber-400" />
                                Shortlist PDF &amp; Notify Students
                              </button>

                              <a
                                href={getAuthUrl(`/drives/${d.id}/export?format=company`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="col-span-2 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/70 transition whitespace-nowrap"
                                title="Download candidates formatted exactly according to the company's required Excel schema"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                                Company Format (.xlsx)
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}
          </div>
        </div>

        {/* BATCH INFO COLLECTION MODAL */}
        {batchFieldModalDriveId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-[#101012] rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-800 text-white">
              <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-neutral-800 text-white rounded-lg">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Add Batch Info Collection Field</h3>
                    <p className="text-xs text-neutral-400">Collect custom questions/answers from applicants in the spreadsheet</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBatchFieldModalDriveId(null);
                    setBatchFieldMsg(null);
                  }}
                  className="text-gray-400 hover:text-neutral-400 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddBatchFieldSubmit} className="p-6 space-y-4">
                {batchFieldMsg && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                      batchFieldMsg.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                  >
                    {batchFieldMsg.type === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <span>{batchFieldMsg.text}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-200 mb-1">
                    Question / Field Label <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GitHub Profile Link, Preferred Location, LeetCode Score"
                    value={newFieldLabel}
                    onChange={(e) => {
                      setNewFieldLabel(e.target.value);
                      if (!newFieldKey || newFieldKey === newFieldLabel.toLowerCase().replace(/[^a-z0-9]/g, '_')) {
                        setNewFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '_'));
                      }
                    }}
                    className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-200 mb-1">
                    Column Key (Identifier) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. github_link"
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">Unique identifier used as the spreadsheet column key.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-200 mb-1">Input Type</label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value as 'text' | 'number' | 'dropdown')}
                      className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    >
                      <option value="text">Text (Single / Multi-line)</option>
                      <option value="number">Numeric</option>
                      <option value="dropdown">Dropdown Options</option>
                    </select>
                  </div>

                  <div className="flex items-center pt-5">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-300">
                      <input
                        type="checkbox"
                        checked={newFieldRequired}
                        onChange={(e) => setNewFieldRequired(e.target.checked)}
                        className="rounded border-neutral-700 text-white focus:ring-blue-500 h-4 w-4"
                      />
                      Mandatory Field
                    </label>
                  </div>
                </div>

                {newFieldType === 'dropdown' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-200 mb-1">
                      Dropdown Options (Comma-separated) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bangalore, Hyderabad, Pune, Remote"
                      value={newFieldOptions}
                      onChange={(e) => setNewFieldOptions(e.target.value)}
                      className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                )}

                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                  💡 This question will immediately appear as a new column in the drive&apos;s live spreadsheet and students will be prompted to fill it upon applying.
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      setBatchFieldModalDriveId(null);
                      setBatchFieldMsg(null);
                    }}
                    className="px-4 py-2 border border-neutral-700 rounded-lg text-xs font-medium text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingField}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:bg-gray-300 shadow-sm"
                  >
                    {isSubmittingField ? 'Adding Column...' : 'Add Column to Sheet'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SHORTLIST PDF & NOTIFICATION MODAL */}
        {shortlistDrive && (
          <ShortlistModal
            drive={shortlistDrive}
            onClose={() => setShortlistDrive(null)}
            onCompleted={() => {
              void fetchDrives();
            }}
          />
        )}

        {/* FULL STUDENT PROFILE MODAL */}
        {selectedStudentForModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-[#101012] rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-neutral-800 text-white max-h-[90vh] flex flex-col">
              <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-neutral-800 text-white rounded-xl font-mono font-bold text-sm">
                    {selectedStudentForModal.studentId}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {selectedStudentForModal.name || 'Student Profile'}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Reg No: {selectedStudentForModal.registrationNumber || '—'} &bull; Branch: {selectedStudentForModal.branch} ({selectedStudentForModal.batch || 'Batch'})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudentForModal(null)}
                  className="text-gray-400 hover:text-neutral-400 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Placement Status Card */}
                {selectedStudentForModal.placement?.isPlaced ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Placed
                      </span>
                      <h4 className="text-base font-bold text-emerald-950 mt-1">
                        {selectedStudentForModal.placement.company}
                      </h4>
                      <p className="text-xs text-emerald-800">
                        {selectedStudentForModal.placement.role || 'Software Engineer'} &bull; Package:{' '}
                        <span className="font-mono font-bold">{selectedStudentForModal.placement.ctcLpa} LPA</span>
                      </p>
                    </div>
                    <Award className="h-10 w-10 text-emerald-500 opacity-80" />
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-400 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-gray-400" />
                    <span>Currently unplaced. Eligible for active recruitment drives.</span>
                  </div>
                )}

                {/* Academic Details Grid */}
                <div>
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">Personal &amp; Contact Details</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
                    <div>
                      <span className="text-gray-400 block">First Name:</span>
                      <span className="font-semibold text-white">{selectedStudentForModal.firstName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Last Name:</span>
                      <span className="font-semibold text-white">{selectedStudentForModal.lastName || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">DOB / Age:</span>
                      <span className="font-semibold text-white">
                        {selectedStudentForModal.dob || '—'} {selectedStudentForModal.age ? `(${selectedStudentForModal.age} yrs)` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Email:</span>
                      <span className="font-semibold text-white font-mono text-[11px] break-all">{selectedStudentForModal.email || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Phone:</span>
                      <span className="font-semibold text-white">{selectedStudentForModal.phone || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Marksheet Drive Link:</span>
                      {selectedStudentForModal.marksheetUrl ? (
                        <a
                          href={selectedStudentForModal.marksheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-white hover:underline inline-flex items-center gap-1"
                        >
                          View Link <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Academic Performance */}
                <div>
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">Academic Performance</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
                    <div>
                      <span className="text-gray-400 block">Cumulative CGPA:</span>
                      <span className="text-base font-bold text-white font-mono">{selectedStudentForModal.cgpa.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Equivalent Percentage:</span>
                      <span className="text-base font-bold text-emerald-700 font-mono">
                        {typeof selectedStudentForModal.percentage === 'number'
                          ? `${selectedStudentForModal.percentage.toFixed(1)}%`
                          : `${(selectedStudentForModal.cgpa * 9.5).toFixed(1)}%`}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Total Marks:</span>
                      <span className="text-sm font-semibold text-white font-mono">
                        {selectedStudentForModal.totalMarks
                          ? `${selectedStudentForModal.totalMarks}${selectedStudentForModal.maxMarks ? ` / ${selectedStudentForModal.maxMarks}` : ''}`
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Active Backlogs:</span>
                      <span
                        className={`inline-block font-bold px-2 py-0.5 rounded-full text-xs ${
                          selectedStudentForModal.activeBacklogs === 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {selectedStudentForModal.activeBacklogs} Backlogs
                      </span>
                    </div>
                  </div>
                </div>

                {/* Semester-wise Records S1 to S8 */}
                <div>
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                    Semester-Wise Academic Records (Semesters 1 to 8)
                  </h4>
                  <div className="border border-neutral-800 rounded-xl overflow-hidden">
                    <table className="min-w-full divide-y divide-neutral-800 text-xs">
                      <thead className="bg-neutral-900/60 text-neutral-400 font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left">Semester</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">SGPA</th>
                          <th className="px-3 py-2 text-left">Credits</th>
                          <th className="px-3 py-2 text-left">Marksheet Drive Link</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800 bg-[#101012]">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((semNum) => {
                          const reached = semNum <= (selectedStudentForModal.currentSemester ?? 8);
                          const sem = selectedStudentForModal.semesters?.find((s) => s.semester === semNum);
                          return (
                            <tr key={semNum} className={!reached ? 'opacity-60 bg-neutral-950/40' : ''}>
                              <td className="px-3 py-2 font-bold text-white">Semester {semNum}</td>
                              <td className="px-3 py-2">
                                {!reached ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-900 text-neutral-400 border border-neutral-800">
                                    ⏳ Yet to reach (Junior Batch)
                                  </span>
                                ) : sem ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                    Completed
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-neutral-500 font-mono">Not Uploaded</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono font-bold text-white">
                                {reached && sem ? sem.sgpa.toFixed(2) : '—'}
                              </td>
                              <td className="px-3 py-2 font-mono text-neutral-400">
                                {reached && sem ? sem.credits : '—'}
                              </td>
                              <td className="px-3 py-2">
                                {reached && sem?.marksheetUrl ? (
                                  <a
                                    href={sem.marksheetUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-white hover:underline font-medium text-[11px]"
                                  >
                                    Sem {semNum} Marksheet <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Additional Dynamic Profile Details */}
                {selectedStudentForModal.additionalDetails &&
                  Object.keys(selectedStudentForModal.additionalDetails).length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                        Saved Candidate Dynamic Details (Autofill Data)
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
                        {Object.entries(selectedStudentForModal.additionalDetails).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-neutral-400 block capitalize">
                              {key.replace(/([A-Z])/g, ' $1')}:
                            </span>
                            <span className="font-semibold text-white">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForModal(null)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-neutral-200 rounded-lg text-xs font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
