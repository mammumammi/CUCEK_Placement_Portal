'use client';

/**
 * @fileoverview Main Coordinator (Admin) Dashboard.
 * Provides bulk student Excel registration with validation preview, CGPA calculation,
 * atomic commit, and sample template downloading.
 *
 * @module app/admin/page
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { DepartmentPlacementPieChart } from '@/components/analytics/DepartmentPlacementPieChart';
import { PlacedStudentsManager } from '@/components/placements/PlacedStudentsManager';
import Link from 'next/link';
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
  PieChart as PieChartIcon,
  Sparkles,
  ArrowRight,
  Layers,
  Settings,
  HelpCircle,
  Award,
  Check,
  RefreshCw,
  Building,
  Briefcase,
  Mail,
  FileText,
  Send,
  ExternalLink,
  Calendar,
  Building2,
  X,
  ChevronRight,
  Plus,
  Trash2,
  UploadCloud,
  Video,
  Bell,
  Search,
  Filter,
  Eye,
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
  getBranchCredits,
  updateBranchCredits,
  type BranchCreditItem,
} from '@/services/curriculum.service';
import {
  listDrives,
  createDrive,
  summarizeJd,
  notifyEligibleStudents,
  updateDriveExtraFields,
  parseCompanyTemplate,
  getStatsTemplateStatus,
  uploadStatsReferenceTemplate,
  deleteStatsReferenceTemplate,
  getStatsTemplateDownloadUrl,
  getComprehensiveStatisticsExportUrl,
  getPublicPlacementStats,
  uploadMockTestPdf,
  updateDriveDetails,
  deleteDrive,
  getYouTubeEmbedUrl,
  type CompanyFormatColumn,
  type DriveItem,
  type DriveExtraField,
  type JdSummaryResult,
  type NotificationResult,
  type StatsTemplateStatus,
  type PublicPlacementStats,
} from '@/services/drives.service';
import {
  listProfiles,
  deleteStudent,
  deleteBatchStudents,
  updateStudentPlacementStatus,
  type StudentProfileData,
} from '@/services/profiles.service';

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

const ALL_BRANCHES = ['CSE', 'ECE', 'EEE', 'IT', 'CIVIL', 'MCA'] as const;

export default function AdminPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [adminTab, setAdminTab] = useState<'students' | 'upload' | 'placed' | 'curriculum' | 'drives' | 'stats-export' | 'analytics'>('students');
  const setActiveTabSafe = (t: string) => setAdminTab(t as any);
  const containerRef = useRef<HTMLDivElement>(null);

  // Student Directory & Batch Management State
  const [studentsList, setStudentsList] = useState<StudentProfileData[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'all' | 'placed' | 'unplaced' | 'backlogs' | 'zero_backlogs'>('all');
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<StudentProfileData | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState<string | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState<boolean>(false);

  // Comprehensive Placement Statistics & Reference Template State
  const [statsTemplateStatus, setStatsTemplateStatus] = useState<StatsTemplateStatus | null>(null);
  const [isLoadingStatsTemplate, setIsLoadingStatsTemplate] = useState<boolean>(false);
  const [refTemplateFile, setRefTemplateFile] = useState<File | null>(null);
  const [isUploadingRefTemplate, setIsUploadingRefTemplate] = useState<boolean>(false);
  const [refTemplateMsg, setRefTemplateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [liveStatsSummary, setLiveStatsSummary] = useState<PublicPlacementStats | null>(null);
  const [isDownloadingStatsExcel, setIsDownloadingStatsExcel] = useState<boolean>(false);

  // Placement Drives & JD Summarizer State
  const [drivesList, setDrivesList] = useState<DriveItem[]>([]);
  const [driveTimeFilter, setDriveTimeFilter] = useState<'all' | 'active' | 'previous'>('all');
  const [shortlistDrive, setShortlistDrive] = useState<DriveItem | null>(null);
  const [isLoadingDrives, setIsLoadingDrives] = useState<boolean>(false);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [jdFiles, setJdFiles] = useState<File[]>([]);
  const [jdRawText, setJdRawText] = useState<string>('');
  const [isSummarizingJd, setIsSummarizingJd] = useState<boolean>(false);
  const [jdSummary, setJdSummary] = useState<JdSummaryResult | null>(null);
  const [jdSummaryMsg, setJdSummaryMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Company-Specific Excel Format State
  const [companyFormatColumns, setCompanyFormatColumns] = useState<CompanyFormatColumn[]>([]);
  const [isParsingTemplate, setIsParsingTemplate] = useState<boolean>(false);
  const [templateUploadMsg, setTemplateUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Drive Form States
  const [driveCompany, setDriveCompany] = useState<string>('');
  const [driveRole, setDriveRole] = useState<string>('');
  const [driveDescription, setDriveDescription] = useState<string>('');
  const [drivePackageCategory, setDrivePackageCategory] = useState<'GENERAL' | 'DREAM' | 'INTERNSHIP'>('GENERAL');
  const [driveCtcLpa, setDriveCtcLpa] = useState<string>('');
  const [driveYoutubeUrl, setDriveYoutubeUrl] = useState<string>('');
  const [driveApplicationMode, setDriveApplicationMode] = useState<'excel' | 'link'>('excel');
  const [driveRegistrationLink, setDriveRegistrationLink] = useState<string>('');
  const [editingYoutubeDriveId, setEditingYoutubeDriveId] = useState<string | null>(null);
  const [editingYoutubeUrl, setEditingYoutubeUrl] = useState<string>('');
  const [isUpdatingYoutube, setIsUpdatingYoutube] = useState<boolean>(false);
  const [driveMinCgpa, setDriveMinCgpa] = useState<string>('6.5');
  const [driveAllowBacklogs, setDriveAllowBacklogs] = useState<boolean>(false);
  const [driveMaxActiveBacklogs, setDriveMaxActiveBacklogs] = useState<string>('0');
  const [driveCodingEnabled, setDriveCodingEnabled] = useState<boolean>(true);
  const [driveEligibleBranches, setDriveEligibleBranches] = useState<string[]>([...ALL_BRANCHES]);
  const [driveDeadline, setDriveDeadline] = useState<string>('');

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setDriveDeadline(d.toISOString().slice(0, 16));
  }, []);
  const [driveTotalRounds, setDriveTotalRounds] = useState<string>('2');
  const [driveNotifyEligible, setDriveNotifyEligible] = useState<boolean>(true);
  const [isCreatingDrive, setIsCreatingDrive] = useState<boolean>(false);
  const [driveMsg, setDriveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Email Notification Modal & Action State
  const [notificationModalData, setNotificationModalData] = useState<NotificationResult | null>(null);
  const [isNotifyingDriveId, setIsNotifyingDriveId] = useState<string | null>(null);

  // Centralised Branch Curriculum Credits State
  const [selectedBranch, setSelectedBranch] = useState<string>('CSE');
  const [branchCreditsList, setBranchCreditsList] = useState<BranchCreditItem[]>([]);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(false);
  const [isSavingCredits, setIsSavingCredits] = useState<boolean>(false);
  const [recalculateOnSave, setRecalculateOnSave] = useState<boolean>(true);
  const [creditsMsg, setCreditsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTargetBranch, setUploadTargetBranch] = useState<string>('CSE');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisData, setAnalysisData] = useState<AnalyzeResponse | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [skipInvalid, setSkipInvalid] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Batch Info Collection Field States
  const [batchFieldModalDriveId, setBatchFieldModalDriveId] = useState<string | null>(null);
  const [newFieldKey, setNewFieldKey] = useState<string>('');
  const [newFieldLabel, setNewFieldLabel] = useState<string>('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'dropdown'>('text');
  const [newFieldOptions, setNewFieldOptions] = useState<string>('');
  const [newFieldRequired, setNewFieldRequired] = useState<boolean>(false);
  const [isSubmittingField, setIsSubmittingField] = useState<boolean>(false);
  const [batchFieldMsg, setBatchFieldMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mock Test Reference PDF State (Multi-Agent Engine)
  const [mockTestFiles, setMockTestFiles] = useState<File[]>([]);
  const [mockPdfModalOpen, setMockPdfModalOpen] = useState<boolean>(false);
  const [selectedDriveForMockPdf, setSelectedDriveForMockPdf] = useState<string | null>(null);
  const [directMockFile, setDirectMockFile] = useState<File | null>(null);
  const [isUploadingDirectMockPdf, setIsUploadingDirectMockPdf] = useState<boolean>(false);
  const [mockPdfUploadMsg, setMockPdfUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const fetchDrivesList = React.useCallback(async () => {
    setIsLoadingDrives(true);
    try {
      const data = await listDrives();
      setDrivesList(data);
    } catch {
      // ignore
    } finally {
      setIsLoadingDrives(false);
    }
  }, []);

  const fetchStatsTemplateStatus = React.useCallback(async () => {
    setIsLoadingStatsTemplate(true);
    try {
      const [tplStatus, liveStats] = await Promise.all([
        getStatsTemplateStatus().catch(() => ({ hasTemplate: false })),
        getPublicPlacementStats().catch(() => null),
      ]);
      setStatsTemplateStatus(tplStatus);
      setLiveStatsSummary(liveStats);
    } catch {
      setStatsTemplateStatus({ hasTemplate: false });
    } finally {
      setIsLoadingStatsTemplate(false);
    }
  }, []);

  React.useEffect(() => {
    if (adminTab === 'stats-export' || adminTab === 'analytics' || adminTab === 'placed') {
      void fetchStatsTemplateStatus();
    }
  }, [adminTab, fetchStatsTemplateStatus]);

  const handleUploadRefTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refTemplateFile) {
      setRefTemplateMsg({ type: 'error', text: 'Please select an Excel file (.xlsx or .xls)' });
      return;
    }
    setIsUploadingRefTemplate(true);
    setRefTemplateMsg(null);
    try {
      const result = await uploadStatsReferenceTemplate(refTemplateFile);
      setRefTemplateMsg({ type: 'success', text: result.message });
      setRefTemplateFile(null);
      await fetchStatsTemplateStatus();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      const message =
        axiosErr.response?.data?.error?.message ||
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Failed to upload reference template';
      setRefTemplateMsg({ type: 'error', text: message });
    } finally {
      setIsUploadingRefTemplate(false);
    }
  };

  const handleDeleteRefTemplate = async () => {
    if (!confirm('Are you sure you want to reset the reference template? You will be prompted to upload one again.')) return;
    try {
      await deleteStatsReferenceTemplate();
      setRefTemplateMsg({ type: 'success', text: 'Reference template cleared successfully' });
      await fetchStatsTemplateStatus();
    } catch (err: unknown) {
      const axiosErr = err as { message?: string };
      setRefTemplateMsg({ type: 'error', text: axiosErr.message || 'Failed to clear template' });
    }
  };

  const fetchAllStudents = useCallback(async () => {
    setIsLoadingStudents(true);
    try {
      const data = await listProfiles();
      setStudentsList(data);
    } catch (err: unknown) {
      console.error('Failed to load student directory:', err);
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  React.useEffect(() => {
    if (adminTab === 'students') {
      void fetchAllStudents();
    }
  }, [adminTab, fetchAllStudents]);

  const handleDeleteSingleStudent = async (studentId: string, studentName?: string | null) => {
    const displayName = studentName || studentId;
    if (!window.confirm(`Are you sure you want to permanently delete student "${displayName}" (${studentId})? This will delete their user credentials, academic records, and applications.`)) {
      return;
    }

    try {
      setIsDeletingStudent(studentId);
      await deleteStudent(studentId);
      setStudentsList((prev) => prev.filter((s) => s.studentId !== studentId));
      if (selectedStudentForModal?.studentId === studentId) {
        setSelectedStudentForModal(null);
      }
      alert(`Student ${displayName} deleted successfully.`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      alert(axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to delete student.');
    } finally {
      setIsDeletingStudent(null);
    }
  };

  const handleDeleteBatch = async (branch?: string, batch?: string) => {
    const branchLabel = branch && branch !== 'ALL' ? `branch "${branch}"` : 'all branches';
    const batchLabel = batch && batch !== 'ALL' ? `batch "${batch}"` : 'all batches';
    const confirmPrompt = `⚠️ DANGER: Are you sure you want to delete all student records for ${branchLabel} and ${batchLabel}? This action will permanently remove their accounts, profiles, and exam data.`;

    if (!window.confirm(confirmPrompt)) return;
    if (!window.confirm('Please confirm one more time: Do you want to proceed with this batch deletion?')) return;

    try {
      setIsDeletingBatch(true);
      const res = await deleteBatchStudents({
        branch: branch && branch !== 'ALL' ? branch : undefined,
        batch: batch && batch !== 'ALL' ? batch : undefined,
      });
      alert(res.message);
      await fetchAllStudents();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      alert(axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to delete batch records.');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  React.useEffect(() => {
    if (adminTab === 'drives') {
      void fetchDrivesList();
    }
  }, [adminTab, fetchDrivesList]);

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
      await fetchDrivesList();
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

  const handleJdFilesAdded = (files: FileList | null) => {
    if (!files) return;
    const added: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf') {
        added.push(f);
      }
    }
    if (added.length > 0) {
      setJdFiles((prev) => [...prev, ...added]);
      if (!jdFile) setJdFile(added[0]);
      setJdSummaryMsg(null);
    }
  };

  const handleRemoveJdFile = (index: number) => {
    setJdFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setJdFile(next.length > 0 ? next[0] : null);
      return next;
    });
  };

  const handleUploadCompanyTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setIsParsingTemplate(true);
    setTemplateUploadMsg(null);
    try {
      const res = await parseCompanyTemplate(file);
      setCompanyFormatColumns(res.suggestedColumns);
      setTemplateUploadMsg({
        type: 'success',
        text: `Company Excel template "${file.name}" analyzed! Auto-detected ${res.headers.length} required columns and suggested default mappings.`,
      });
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      setTemplateUploadMsg({
        type: 'error',
        text: axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to parse company template.',
      });
    } finally {
      setIsParsingTemplate(false);
      e.target.value = '';
    }
  };

  const handleAddCompanyColumn = () => {
    setCompanyFormatColumns((prev) => [
      ...prev,
      { companyHeader: `Column ${prev.length + 1}`, sourceField: '__null__', customValue: '', customKey: '' },
    ]);
  };

  const handleUpdateCompanyColumn = (index: number, key: keyof CompanyFormatColumn, val: string) => {
    setCompanyFormatColumns((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: val } : c))
    );
  };

  const handleRemoveCompanyColumn = (index: number) => {
    setCompanyFormatColumns((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSummarizeJd = async () => {
    const allFiles = jdFiles.length > 0 ? jdFiles : (jdFile ? [jdFile] : []);
    if (allFiles.length === 0 && !jdRawText.trim()) {
      setJdSummaryMsg({ type: 'error', text: 'Please upload at least one JD PDF file or paste text content.' });
      return;
    }

    setIsSummarizingJd(true);
    setJdSummaryMsg(null);
    try {
      const res = await summarizeJd({
        files: allFiles.length > 0 ? allFiles : undefined,
        text: jdRawText.trim() ? jdRawText.trim() : undefined,
      });
      setJdSummary(res);
      setDriveCompany(res.company);
      setDriveRole(res.role);
      setDriveDescription(res.summary);
      setDrivePackageCategory(res.packageCategory);
      setDriveCtcLpa(res.ctcLpa !== null ? String(res.ctcLpa) : '');
      if (res.youtubeUrl) {
        setDriveYoutubeUrl(res.youtubeUrl);
      }
      setDriveMinCgpa(String(res.minCgpa || 0));
      setDriveAllowBacklogs(res.allowBacklogs);
      setDriveMaxActiveBacklogs(String(res.maxActiveBacklogs || 0));
      if (res.eligibleBranches && res.eligibleBranches.length > 0) {
        setDriveEligibleBranches(res.eligibleBranches);
      }
      setJdSummaryMsg({
        type: 'success',
        text: `Analysis complete! Extracted details synthesized across ${allFiles.length > 0 ? `${allFiles.length} uploaded document(s)` : 'text'}. Categorized as ${res.packageCategory} (${res.packageCategory === 'DREAM' ? '≥ 7 LPA' : res.packageCategory === 'INTERNSHIP' ? 'Internship' : '< 7 LPA'}). Form fields auto-populated below.`,
      });
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      setJdSummaryMsg({
        type: 'error',
        text: axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to summarize JD with AI.',
      });
    } finally {
      setIsSummarizingJd(false);
    }
  };

  const handleCreateDriveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveCompany.trim()) {
      setDriveMsg({ type: 'error', text: 'Company name is required.' });
      return;
    }
    if (driveEligibleBranches.length === 0) {
      setDriveMsg({ type: 'error', text: 'Please select at least one eligible branch.' });
      return;
    }
    if (!driveDeadline) {
      setDriveMsg({ type: 'error', text: 'Deadline is required.' });
      return;
    }
    if (driveApplicationMode === 'link' && !driveRegistrationLink.trim()) {
      setDriveMsg({
        type: 'error',
        text: 'Please enter the company registration link URL or switch to Excel Sheet Format.',
      });
      return;
    }

    setIsCreatingDrive(true);
    setDriveMsg(null);

    try {
      const formData = new FormData();
      formData.append('company', driveCompany.trim());
      if (driveRole.trim()) formData.append('role', driveRole.trim());
      if (driveDescription.trim()) formData.append('description', driveDescription.trim());
      formData.append('packageCategory', drivePackageCategory);
      if (driveCtcLpa.trim()) formData.append('ctcLpa', driveCtcLpa.trim());
      if (driveYoutubeUrl.trim()) formData.append('youtubeUrl', driveYoutubeUrl.trim());
      formData.append('minCgpa', driveMinCgpa.trim() || '0');
      formData.append('allowBacklogs', String(driveAllowBacklogs));
      formData.append('maxActiveBacklogs', driveAllowBacklogs ? (driveMaxActiveBacklogs.trim() || '2') : '0');
      formData.append('codingEnabled', String(driveCodingEnabled));
      formData.append('eligibleBranches', JSON.stringify(driveEligibleBranches));
      formData.append('deadline', new Date(driveDeadline).toISOString());
      formData.append('totalRounds', driveTotalRounds.trim() || '1');
      formData.append('notifyEligible', 'false');

      const allFiles = jdFiles.length > 0 ? jdFiles : (jdFile ? [jdFile] : []);
      if (allFiles.length > 0) {
        allFiles.forEach((file) => {
          formData.append('files', file);
        });
        formData.append('file', allFiles[0]);
      }

      if (driveApplicationMode === 'excel' && companyFormatColumns.length > 0) {
        formData.append('companyFormat', JSON.stringify(companyFormatColumns));
      }
      if (driveApplicationMode === 'link' && driveRegistrationLink.trim()) {
        formData.append('registrationLink', driveRegistrationLink.trim());
      }

      if (mockTestFiles.length > 0) {
        mockTestFiles.forEach((file) => {
          formData.append('mockTestFiles', file);
        });
      }

      const res = await createDrive(formData);
      setDriveMsg({
        type: 'success',
        text: `Drive for ${res.company} created successfully!`,
      });

      // Reset form fields
      setDriveCompany('');
      setDriveRole('');
      setDriveDescription('');
      setDriveCtcLpa('');
      setJdFile(null);
      setJdFiles([]);
      setMockTestFiles([]);
      setCompanyFormatColumns([]);
      setDriveRegistrationLink('');
      setDriveApplicationMode('excel');
      setJdRawText('');
      setJdSummary(null);

      await fetchDrivesList();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      setDriveMsg({
        type: 'error',
        text: axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to create placement drive.',
      });
    } finally {
      setIsCreatingDrive(false);
    }
  };

  const handleUploadDirectMockPdf = async () => {
    if (!selectedDriveForMockPdf || !directMockFile) return;
    try {
      setIsUploadingDirectMockPdf(true);
      setMockPdfUploadMsg(null);
      const res = await uploadMockTestPdf(selectedDriveForMockPdf, directMockFile);
      setMockPdfUploadMsg({
        type: 'success',
        text: res.message || 'Mock test PDF uploaded and multi-agent synthesis triggered successfully!',
      });
      setDirectMockFile(null);
      await fetchDrivesList();
      setTimeout(() => {
        setMockPdfModalOpen(false);
        setMockPdfUploadMsg(null);
      }, 1500);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err instanceof Error ? err.message : 'Upload failed');
      setMockPdfUploadMsg({ type: 'error', text: msg });
    } finally {
      setIsUploadingDirectMockPdf(false);
    }
  };

  const handleNotifyDrive = async (driveId: string) => {
    setIsNotifyingDriveId(driveId);
    try {
      const result = await notifyEligibleStudents(driveId);
      setNotificationModalData(result);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      alert(axiosErr.response?.data?.error?.message || 'Failed to dispatch email notifications.');
    } finally {
      setIsNotifyingDriveId(null);
    }
  };

  const handleSaveYoutubeUrl = async () => {
    if (!editingYoutubeDriveId) return;
    try {
      setIsUpdatingYoutube(true);
      await updateDriveDetails(editingYoutubeDriveId, {
        youtubeUrl: editingYoutubeUrl.trim() || null,
      });
      setDrivesList((prev) =>
        prev.map((d) =>
          d.id === editingYoutubeDriveId
            ? { ...d, youtubeUrl: editingYoutubeUrl.trim() || null }
            : d
        )
      );
      setEditingYoutubeDriveId(null);
    } catch (err: any) {
      alert('Failed to update YouTube video URL: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsUpdatingYoutube(false);
    }
  };

  const handleDeleteDrive = async (driveId: string, company: string, role?: string | null) => {
    const driveTitle = `${company}${role ? ` (${role})` : ''}`;
    if (!window.confirm(`Are you sure you want to take down and permanently delete the recruitment drive for "${driveTitle}"? This will remove all student applications, shortlisted records, and mock assessments associated with this drive.`)) {
      return;
    }

    try {
      await deleteDrive(driveId);
      setDrivesList((prev) => prev.filter((d) => d.id !== driveId));
      alert(`Recruitment drive for ${driveTitle} has been deleted successfully.`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string }; message?: string } }; message?: string };
      alert(axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to delete recruitment drive.');
    }
  };

  const fetchBranchCredits = React.useCallback(async (branchName: string) => {
    setIsLoadingCredits(true);
    setCreditsMsg(null);
    try {
      const data = await getBranchCredits(branchName);
      setBranchCreditsList(data.credits);
    } catch {
      setCreditsMsg({ type: 'error', text: `Failed to load curriculum credits for branch ${branchName}.` });
    } finally {
      setIsLoadingCredits(false);
    }
  }, []);

  React.useEffect(() => {
    if (adminTab === 'curriculum') {
      void fetchBranchCredits(selectedBranch);
    }
  }, [adminTab, selectedBranch, fetchBranchCredits]);

  const handleSaveCredits = async () => {
    setIsSavingCredits(true);
    setCreditsMsg(null);
    try {
      const configs = branchCreditsList.map((c) => ({
        semester: c.semester,
        credits: Number(c.credits) || 0,
      }));
      const res = await updateBranchCredits(selectedBranch, configs, recalculateOnSave);
      setBranchCreditsList(res.credits);
      setCreditsMsg({
        type: 'success',
        text: recalculateOnSave
          ? `Branch credits updated centrally and student CGPAs recalculated for ${selectedBranch}!`
          : `Branch credits updated centrally for ${selectedBranch}!`,
      });
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      setCreditsMsg({
        type: 'error',
        text: axiosErr.response?.data?.error?.message || axiosErr.response?.data?.message || 'Failed to save branch credits.',
      });
    } finally {
      setIsSavingCredits(false);
    }
  };

  const runAnalysis = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);
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
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setCommitResult(null);
    setPreviewData(null);
    setAnalysisData(null);
    setColumnMapping({});
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        setError('Please select an Excel (.xlsx) file.');
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
      { header: 'Sem 1 SGPA', key: 's1Sgpa', width: 12 },
      { header: 'Credits Sem 1', key: 's1Credits', width: 14 },
      { header: 'Sem 2 SGPA', key: 's2Sgpa', width: 12 },
      { header: 'Credits Sem 2', key: 's2Credits', width: 14 },
    ];

    sheet.addRow({
      studentId: '2022BCSE010',
      registrationNumber: 'REG-2022-CSE-010',
      name: 'Rohan Gupta',
      firstName: 'Rohan',
      lastName: 'Gupta',
      dob: '2004-04-15',
      age: 22,
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
      firstName: 'Sneha',
      lastName: 'Patel',
      dob: '2004-09-22',
      age: 22,
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

  const handleUploadBranchChange = async (branch: string) => {
    setUploadTargetBranch(branch);
    if (selectedFile && previewData) {
      setIsPreviewing(true);
      setError(null);
      try {
        const data = await previewBulkRegistration(selectedFile, columnMapping, branch);
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
          'Failed to update preview for selected department';
        setError(message);
      } finally {
        setIsPreviewing(false);
      }
    }
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
      const data = await previewBulkRegistration(selectedFile, columnMapping, uploadTargetBranch);
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
      const res = await commitBulkRegistration(selectedFile, {
        skipInvalid,
        mapping: columnMapping,
        branch: uploadTargetBranch,
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
      setError(message);
    } finally {
      setIsCommitting(false);
    }
  };

  const primarySheet = analysisData?.sheets?.[0];
  const mappedFieldValues = new Set(Object.values(columnMapping));
  const hasStudentIdentity = mappedFieldValues.has('studentId') || mappedFieldValues.has('registrationNumber');
  const missingRequiredFields = CANONICAL_FIELD_OPTIONS.filter(
    (field) => field.required && !(field.key === 'studentId' ? hasStudentIdentity : mappedFieldValues.has((field as { key: string }).key))
  );

  return (
    <RequireAuth roles={['MAIN_COORDINATOR']}>
      <div
        ref={containerRef}
        className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-[#18181b] text-white selection:text-black flex"
      >
        {/* ========================================================= */}
        {/* LEFT SIDEBAR NAVIGATION (Modern 2026 Admin Layout)        */}
        {/* ========================================================= */}
        <aside className="w-64 border-r border-neutral-800/80 bg-[#0c0c0e] flex-col justify-between p-6 shrink-0 hidden lg:flex sticky top-0 h-screen z-40">
          <div className="space-y-8">
            {/* Identity & Admin Badge */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-white font-mono font-bold text-sm shadow-inner">
                  ADM
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#0c0c0e] animate-pulse" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white tracking-tight truncate leading-none">
                  Super Admin
                </h2>
                <p className="text-[11px] text-neutral-400 font-medium mt-1 truncate">
                  Main Coordinator 2026
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1.5">
              {[
                { id: 'students', label: 'All Students Directory', icon: Users, badge: studentsList.length },
                { id: 'upload', label: 'Bulk Student Upload', icon: Upload },
                { id: 'placed', label: 'Record Placements', icon: Award },
                { id: 'analytics', label: 'Pie Chart Analytics', icon: PieChartIcon },
                { id: 'curriculum', label: 'Curriculum Credits', icon: Layers },
                { id: 'drives', label: 'Drives & AI Summarizer', icon: Briefcase, badge: drivesList.length },
                { id: 'stats-export', label: 'Placement Statistics Excel', icon: FileSpreadsheet },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = adminTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTabSafe(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                      isActive
                        ? 'bg-neutral-800/90 text-white shadow-xs border border-neutral-700/60'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Cohort Info */}
          <div className="space-y-4 pt-6 border-t border-neutral-800/80">
            <div className="p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-bold text-white">Central Admin OS</span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Batch 2026 &amp; Junior 2028 active across 6 branches.
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
                <span className="w-1.5 h-1.5 rounded-full bg-[#18181b] text-white animate-pulse" />
                <span>Central Placement Cell &bull; Super Admin Console</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 text-xs font-bold transition shadow-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </header>

          {/* Main Content Area */}
          <div className="p-4 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto space-y-8 flex-1">
            {/* TAB: ALL REGISTERED STUDENTS DIRECTORY */}
            {adminTab === 'students' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Users className="h-6 w-6 text-white" />
                      All College Students Directory &amp; Batch Management
                    </h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      View, search, filter, and manage student credentials and academic records across all branches (CSE, ECE, EEE, IT, CIVIL, MCA).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchAllStudents}
                      disabled={isLoadingStudents}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 text-neutral-400 ${isLoadingStudents ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTabSafe('upload')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-black bg-white hover:bg-neutral-200 transition"
                    >
                      <Upload className="h-3.5 w-3.5 text-black" />
                      Bulk Upload Excel
                    </button>
                  </div>
                </div>

                {/* Batch Action & Filtering Bar */}
                <div className="p-4 bg-neutral-900/60 rounded-2xl border border-neutral-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {/* Search & Branch/Status filters */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-2.5 text-neutral-400" />
                        <input
                          type="text"
                          placeholder="Search ID, Name, Roll No, Email..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="pl-9 pr-3 py-1.5 text-xs border border-neutral-700 rounded-lg bg-[#18181b] text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-white w-56 sm:w-64"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400 font-medium">Branch:</span>
                        <select
                          value={selectedBranchFilter}
                          onChange={(e) => setSelectedBranchFilter(e.target.value)}
                          className="border border-neutral-700 rounded-lg px-2.5 py-1.5 bg-[#18181b] text-white text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-white"
                        >
                          <option value="ALL">All Branches</option>
                          {ALL_BRANCHES.map((b) => (
                            <option key={b} value={b}>{b}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400 font-medium">Batch:</span>
                        <select
                          value={selectedBatchFilter}
                          onChange={(e) => setSelectedBatchFilter(e.target.value)}
                          className="border border-neutral-700 rounded-lg px-2.5 py-1.5 bg-[#18181b] text-white text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-white"
                        >
                          <option value="ALL">All Batches</option>
                          {Array.from(new Set(studentsList.map((s) => s.batch).filter(Boolean))).map((batch) => (
                            <option key={String(batch)} value={String(batch)}>Batch {String(batch)}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-400 font-medium">Status:</span>
                        <select
                          value={statusFilter}
                          onChange={(e) => setStatusFilter(e.target.value as any)}
                          className="border border-neutral-700 rounded-lg px-2.5 py-1.5 bg-[#18181b] text-white text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-white"
                        >
                          <option value="all">All Statuses</option>
                          <option value="placed">Placed Only</option>
                          <option value="unplaced">Unplaced Only</option>
                          <option value="backlogs">With Active Backlogs</option>
                          <option value="zero_backlogs">Zero Backlogs</option>
                        </select>
                      </div>
                    </div>

                    {/* Batch Danger Action: Delete Batch */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteBatch(selectedBranchFilter, selectedBatchFilter)}
                        disabled={isDeletingBatch || studentsList.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/70 transition disabled:opacity-40"
                        title="Delete all student records matching currently selected branch and batch filter"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        <span>
                          {isDeletingBatch
                            ? 'Deleting Batch...'
                            : `Delete Filtered Batch (${
                                selectedBranchFilter === 'ALL' && selectedBatchFilter === 'ALL'
                                  ? 'All Uploads'
                                  : `${selectedBranchFilter !== 'ALL' ? selectedBranchFilter : ''} ${selectedBatchFilter !== 'ALL' ? selectedBatchFilter : ''}`.trim()
                              })`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Students Table */}
                <div className="bg-[#101012] border border-neutral-800 rounded-2xl overflow-hidden shadow-xs">
                  {isLoadingStudents ? (
                    <div className="p-12 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
                      <span>Loading university student directory...</span>
                    </div>
                  ) : (
                    (() => {
                      const filtered = studentsList.filter((s) => {
                        if (selectedBranchFilter !== 'ALL' && s.branch?.toUpperCase() !== selectedBranchFilter.toUpperCase()) {
                          return false;
                        }
                        if (selectedBatchFilter !== 'ALL' && s.batch !== selectedBatchFilter) {
                          return false;
                        }
                        if (statusFilter === 'placed' && !s.placement?.isPlaced && s.placementStatus === 'UNPLACED') {
                          return false;
                        }
                        if (statusFilter === 'unplaced' && (s.placement?.isPlaced || (s.placementStatus && s.placementStatus !== 'UNPLACED'))) {
                          return false;
                        }
                        if (statusFilter === 'backlogs' && s.activeBacklogs === 0) {
                          return false;
                        }
                        if (statusFilter === 'zero_backlogs' && s.activeBacklogs > 0) {
                          return false;
                        }
                        if (studentSearch.trim()) {
                          const q = studentSearch.trim().toLowerCase();
                          const matches =
                            s.studentId.toLowerCase().includes(q) ||
                            (s.name && s.name.toLowerCase().includes(q)) ||
                            (s.registrationNumber && s.registrationNumber.toLowerCase().includes(q)) ||
                            (s.email && s.email.toLowerCase().includes(q)) ||
                            (s.branch && s.branch.toLowerCase().includes(q));
                          if (!matches) return false;
                        }
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="p-12 text-center text-xs text-neutral-400">
                            No student records found matching the specified filters.
                          </div>
                        );
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs divide-y divide-neutral-800">
                            <thead className="bg-[#141416] text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">
                              <tr>
                                <th className="px-3.5 py-3 text-left">Student ID</th>
                                <th className="px-3.5 py-3 text-left">Branch</th>
                                <th className="px-3.5 py-3 text-left">Name</th>
                                <th className="px-3.5 py-3 text-left">Batch</th>
                                <th className="px-3.5 py-3 text-left">Email / Contact</th>
                                <th className="px-3.5 py-3 text-left">CGPA</th>
                                <th className="px-3.5 py-3 text-left">Backlogs</th>
                                <th className="px-3.5 py-3 text-left">Status</th>
                                <th className="px-3.5 py-3 text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800 bg-[#101012]">
                              {filtered.map((s) => (
                                <tr key={s.studentId} className="hover:bg-neutral-900/60 transition">
                                  <td className="px-3.5 py-3 font-mono font-bold text-white">
                                    <div>{s.studentId}</div>
                                    {s.registrationNumber && (
                                      <div className="text-[10px] text-neutral-400 font-normal">
                                        Reg: {s.registrationNumber}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3.5 py-3">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-900 border border-neutral-700 text-neutral-200">
                                      {s.branch || '—'}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-3 text-white font-medium">
                                    <div>{s.name || '—'}</div>
                                    {(s.firstName || s.lastName) && (
                                      <div className="text-[10px] text-neutral-400">
                                        {[s.firstName, s.lastName].filter(Boolean).join(' ')}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3.5 py-3 text-neutral-400 font-medium whitespace-nowrap">
                                    {s.batch || '—'}
                                  </td>
                                  <td className="px-3.5 py-3 text-neutral-400 font-mono text-[11px]">
                                    <div className="truncate max-w-[150px]" title={s.email || ''}>{s.email || '—'}</div>
                                    <div className="text-neutral-500 text-[10px]">{s.phone || '—'}</div>
                                  </td>
                                  <td className="px-3.5 py-3 font-bold text-white text-sm font-mono">
                                    {s.cgpa ? s.cgpa.toFixed(2) : '0.00'}
                                  </td>
                                  <td className="px-3.5 py-3">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        s.activeBacklogs === 0
                                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80'
                                          : 'bg-rose-950/60 text-rose-400 border border-rose-800/80'
                                      }`}
                                    >
                                      {s.activeBacklogs}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-3">
                                    {s.placementStatus === 'DREAM' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-black border border-white">
                                        ★ Dream
                                      </span>
                                    ) : s.placementStatus === 'INTERNSHIP' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-200 text-black border border-neutral-300">
                                        ⏳ Internship
                                      </span>
                                    ) : s.placementStatus === 'GENERAL' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-white border border-neutral-700">
                                        💼 General
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
                                        onClick={() => handleDeleteSingleStudent(s.studentId, s.name)}
                                        disabled={isDeletingStudent === s.studentId}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-rose-400 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 transition disabled:opacity-50"
                                        title="Delete student record"
                                      >
                                        <Trash2 className="h-3 w-3 text-rose-400" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()
                  )}
                </div>

                {/* Modal for Full Record Inspection */}
                {selectedStudentForModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-[#18181b] border border-neutral-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                        <div className="flex items-center gap-2">
                          <User className="h-5 w-5 text-white" />
                          <h3 className="text-sm font-bold text-white">
                            Student Profile Record — {selectedStudentForModal.studentId}
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForModal(null)}
                          className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-900/60 p-4 rounded-xl border border-neutral-800">
                        <div>
                          <span className="text-neutral-500 block">Full Name:</span>
                          <span className="font-semibold text-white">{selectedStudentForModal.name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Registration Number:</span>
                          <span className="font-semibold text-white">{selectedStudentForModal.registrationNumber || '—'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Branch / Dept:</span>
                          <span className="font-semibold text-white">{selectedStudentForModal.branch || '—'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Batch / Class:</span>
                          <span className="font-semibold text-white">{selectedStudentForModal.batch || '—'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Email:</span>
                          <span className="font-semibold text-white break-all">{selectedStudentForModal.email || '—'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Phone:</span>
                          <span className="font-semibold text-white">{selectedStudentForModal.phone || '—'}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">CGPA:</span>
                          <span className="font-bold text-emerald-400 text-sm">{selectedStudentForModal.cgpa.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Active Backlogs:</span>
                          <span className="font-bold text-white">{selectedStudentForModal.activeBacklogs}</span>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForModal(null)}
                          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-semibold rounded-lg text-xs"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const sid = selectedStudentForModal.studentId;
                            const sname = selectedStudentForModal.name;
                            setSelectedStudentForModal(null);
                            handleDeleteSingleStudent(sid, sname);
                          }}
                          className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/70 text-rose-300 font-semibold rounded-lg text-xs flex items-center gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Student Record
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: PLACED STUDENTS RECORDING & ROSTER */}
            {adminTab === 'placed' && (
              <PlacedStudentsManager
                userRole="MAIN_COORDINATOR"
                onStatsUpdated={() => {
                  void fetchStatsTemplateStatus();
                }}
              />
            )}

            {/* TAB: DEPARTMENT PLACEMENT PIE CHART */}
            {adminTab === 'analytics' && (
              <div className="space-y-6">
                <DepartmentPlacementPieChart
                  branchBreakdown={liveStatsSummary?.branchBreakdown || []}
                  totalStudents={liveStatsSummary?.totalStudents}
                  totalPlaced={liveStatsSummary?.totalPlaced}
                  title="Campus Department Placement Share (Pie Chart)"
                  subtitle="Each slice represents the number of placed students per department across CSE, ECE, EEE, IT, CIVIL, MCA"
                />
              </div>
            )}
          {adminTab === 'upload' && (
            <div>
              {/* Header Info Banner */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white">
                  Bulk Student Registration
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Upload an Excel (.xlsx) roster to automatically create user accounts and academic profiles across departments.
                  Each student’s <strong>Registration Number / Student ID</strong> is set as their default password.
                </p>
              </div>

          {/* Feedback Messages */}
          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg bg-red-950/40 p-4 border border-red-800/60 flex items-start gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm font-medium text-red-300">{error}</div>
            </div>
          )}

          {commitResult && (
            <div
              role="status"
              className="mb-6 rounded-lg bg-emerald-950/40 p-4 border border-emerald-800/60 flex items-start gap-3"
            >
              <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-emerald-300">
                  Registration Successful!
                </h3>
                <p className="mt-1 text-sm text-emerald-300">
                  Created <strong>{commitResult.created}</strong> student accounts
                  {commitResult.skipped > 0 && ` (skipped ${commitResult.skipped} invalid rows)`}.
                </p>
                <p className="mt-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 p-2 rounded">
                  🔑 <strong>Default Passwords:</strong> Students can immediately log in using their <strong>Student ID</strong> as both username and password.
                </p>
              </div>
            </div>
          )}

          {/* Target Department Selection */}
          <div className="bg-[#18181b] rounded-xl shadow-sm border border-neutral-800 p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-indigo-400" />
                  Target Department / Branch for Upload
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Choose which department this student batch belongs to. All students uploaded in this file will be registered under the selected department.
                </p>
              </div>
              <div className="text-xs font-medium text-neutral-400 bg-neutral-900 px-3 py-1.5 rounded-md border border-neutral-800 self-start md:self-auto">
                Current Target:{' '}
                <span className="font-bold text-indigo-400">
                  {uploadTargetBranch === 'AUTO'
                    ? 'Auto-detect from Sheet'
                    : uploadTargetBranch}
                </span>
              </div>
            </div>

            {/* Department Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { code: 'CSE', name: 'Computer Science' },
                { code: 'ECE', name: 'Electronics & Comm.' },
                { code: 'EEE', name: 'Electrical & Electronics' },
                { code: 'IT', name: 'Information Tech.' },
                { code: 'CIVIL', name: 'Civil Engineering' },
                { code: 'MCA', name: 'Master of Comp. Apps' },
                { code: 'AUTO', name: 'Auto-Detect / Multi-Dept' },
              ].map((dept) => {
                const isSelected = uploadTargetBranch === dept.code;
                return (
                  <button
                    key={dept.code}
                    type="button"
                    onClick={() => handleUploadBranchChange(dept.code)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                        : 'bg-[#101012] text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:text-white'
                    }`}
                  >
                    <span className="font-bold">{dept.code}</span>
                    <span className="text-[10px] opacity-75 font-normal">({dept.name})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card: Upload & Action Bar */}
          <div className="bg-[#18181b] text-white rounded-xl shadow-sm border border-neutral-800 overflow-hidden mb-8">
            <div className="p-6 border-b border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-white" />
                  Select Excel File (.xlsx)
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Expected columns: studentId, name, branch, batch, email, phone, activeBacklogs, s1Sgpa, s1Credits...
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-neutral-700 rounded-md text-xs font-semibold text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60 transition shadow-xs"
              >
                <Download className="h-4 w-4 text-white" />
                Download Sample Template
              </button>
            </div>

            <div className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <label className="flex-1 w-full flex items-center justify-center px-6 py-4 border-2 border-dashed border-neutral-700 rounded-lg hover:border-indigo-500 transition cursor-pointer bg-neutral-900/40">
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
                    className="flex-1 sm:flex-initial inline-flex justify-center items-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
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
            <div className="bg-[#18181b] text-white rounded-xl shadow-sm border border-indigo-100 p-6 mb-8 text-center">
              <div className="inline-flex items-center justify-center p-3 bg-neutral-900 rounded-full text-white mb-3 animate-bounce">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-white">
                Analyzing Spreadsheet Structure & Mapping Columns...
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
                Scanning worksheet rows for headers, skipping title banners, and binding column names to student profile fields.
              </p>
            </div>
          )}

          {/* Card: Structure Analysis & Column Mapping */}
          {primarySheet && !isAnalyzing && (
            <div className="bg-[#18181b] text-white rounded-xl shadow-sm border border-neutral-800 overflow-hidden mb-8">
              <div className="p-6 border-b border-neutral-800 bg-neutral-900/60 border-b border-neutral-800">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-white" />
                      <h3 className="text-base font-semibold text-white">
                        Spreadsheet Structure & Column Mapping
                      </h3>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-neutral-200">
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
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed transition shadow-xs"
                    >
                      {isPreviewing ? 'Validating...' : 'Generate Preview'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Missing required info banner */}
                {missingRequiredFields.length > 0 ? (
                  <div className="mt-4 p-3.5 bg-amber-950/50 border border-amber-800/70 rounded-xl flex items-start gap-2.5 text-xs text-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white">Auto-Generated Student ID Enabled: </span>
                      No <strong>Student ID / Reg No</strong> column was mapped in this sheet (added at the bottom below). You can still generate the preview — temporary login credentials will be created so students can log in, enter their official Roll No &amp; details, and get verified by coordinators!
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

              {/* Mapping Table */}
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
                                className="w-full max-w-xs border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-[#18181b] focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

          {/* Card: Preview Results */}
          {previewData && (
            <div className="bg-[#18181b] text-white rounded-xl shadow-sm border border-neutral-800 overflow-hidden space-y-6 p-6">
              {/* Summary Metrics */}
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      Validation Summary
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Verified against canonical rules and existing database profiles.
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
                    <span className="text-lg font-bold text-white">
                      {previewData.summary.total}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-950/30 rounded-lg border border-emerald-800/50">
                    <span className="text-xs text-emerald-400 block">Valid Rows</span>
                    <span className="text-lg font-bold text-emerald-300">
                      {previewData.summary.valid}
                    </span>
                  </div>
                  <div className="p-3 bg-red-950/30 rounded-lg border border-red-800/50">
                    <span className="text-xs text-red-400 block">Invalid Rows</span>
                    <span className="text-lg font-bold text-red-300">
                      {previewData.summary.invalid}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-950/30 rounded-lg border border-amber-800/50">
                    <span className="text-xs text-amber-400 block">Duplicates in File</span>
                    <span className="text-lg font-bold text-amber-300">
                      {previewData.summary.duplicatesInFile}
                    </span>
                  </div>
                  <div className="p-3 bg-purple-950/30 rounded-lg border border-purple-800/50">
                    <span className="text-xs text-purple-400 block">Duplicates in DB</span>
                    <span className="text-lg font-bold text-purple-300">
                      {previewData.summary.duplicatesInDb}
                    </span>
                  </div>
                </div>
              </div>

              {/* Parsed Rows Table */}
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
                        <tr
                          key={r.rowNumber}
                          className={isValid ? 'hover:bg-neutral-900/60' : 'bg-red-950/20'}
                        >
                          <td className="px-3 py-2 font-mono text-neutral-400">
                            #{r.rowNumber}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-white">
                            {String(r.data.studentId || '')}
                          </td>
                          <td className="px-3 py-2 text-neutral-200">
                            {String(r.data.name || '')}
                          </td>
                          <td className="px-3 py-2 text-neutral-300">
                            {String(r.data.branch || '')}
                          </td>
                          <td className="px-3 py-2 text-neutral-400">
                            {String(r.data.email || '')}
                          </td>
                          <td className="px-3 py-2 text-neutral-300 font-semibold">
                            {String(r.data.activeBacklogs ?? '0')}
                          </td>
                          <td className="px-3 py-2 font-bold text-white">
                            {r.cgpa.toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            {isValid ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                Ready
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                {r.errors.map((e, idx) => (
                                  <span
                                    key={idx}
                                    className="block text-[11px] text-red-400 font-medium"
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-800">
                {previewData.summary.invalid > 0 ? (
                  <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipInvalid}
                      onChange={(e) => setSkipInvalid(e.target.checked)}
                      className="rounded border-neutral-700 text-white focus:ring-indigo-500 h-4 w-4"
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
          </div>
        )}

          {/* TAB 2: Centralised Branch Curriculum Credits */}
          {adminTab === 'curriculum' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Centralised Branch Curriculum & Credits
                  </h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Configure and test semester credit allocations for any branch centrally.
                    Student CGPAs are dynamically computed using these branch curriculum weights.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-300">Target Branch:</span>
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value.toUpperCase())}
                      className="border border-neutral-700 rounded-lg px-3 py-1.5 bg-[#18181b] text-white text-xs font-bold text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                    >
                      {['CSE', 'ECE', 'MECH', 'CIVIL', 'IT', 'EE', 'AIDS'].map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => fetchBranchCredits(selectedBranch)}
                    disabled={isLoadingCredits}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 rounded-md text-xs font-medium text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60 transition shadow-2xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 text-neutral-400 ${isLoadingCredits ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
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
                  Loading curriculum credits for {selectedBranch}...
                </div>
              ) : (
                <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-6 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-white" />
                      <h3 className="text-base font-bold text-white">
                        {selectedBranch} Department Semester Credits
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-neutral-400">
                      Standard Curriculum: Sem 1 - 8
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {branchCreditsList.map((item, idx) => (
                      <div
                        key={item.semester}
                        className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 hover:bg-[#18181b] text-white hover:border-indigo-300 transition"
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
                          className="w-full border border-neutral-700 rounded-lg px-3 py-1.5 bg-[#18181b] text-white text-sm font-mono font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                        className="rounded border-neutral-700 text-white focus:ring-indigo-500 h-4 w-4"
                      />
                      <span>
                        <strong>Recalculate {selectedBranch} Student CGPAs:</strong> Dynamically update all registered students in {selectedBranch} with new weights.
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={handleSaveCredits}
                      disabled={isSavingCredits}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 transition shadow-xs"
                    >
                      <Check className="h-4 w-4" />
                      {isSavingCredits ? 'Saving Centrally...' : `Save ${selectedBranch} Curriculum Credits`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {adminTab === 'drives' && (
            <div className="space-y-8">
              {/* Header Info Banner */}
              <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Briefcase className="h-6 w-6 text-white" />
                    Placement Drives &amp; Job Description (JD) AI Summarizer
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1 max-w-3xl">
                    Upload recruitment JD PDFs or paste raw text. The Gemini AI engine automatically categorizes compensation packages into <strong>General (&lt; 7 LPA)</strong>, <strong>Dream (≥ 7 LPA)</strong>, and <strong>Internship</strong>, extracts CGPA &amp; supply/backlog rules, and publishes live application spreadsheets for eligible students.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchDrivesList}
                  disabled={isLoadingDrives}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 rounded-lg text-xs font-semibold text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60 transition shadow-2xs self-start md:self-auto shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-neutral-400 ${isLoadingDrives ? 'animate-spin' : ''}`} />
                  Refresh Drives
                </button>
              </div>

              {/* Main Two-Column Workflow */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Column 1: AI JD Extractor & Form (7 Cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Step 1: AI Job Description Extractor */}
                  <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-5 w-5 text-white" />
                      <h3 className="text-sm font-bold text-white">
                        Step 1: Upload Job Description &amp; Related PDFs (Multiple Allowed)
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-400 mb-4">
                      Upload one or more PDFs (JD, guidelines, assessment syllabus, company brochure) or paste text. Our AI synthesizes all documents into eligibility rules and auto-fills the form.
                    </p>

                    <div className="space-y-4">
                      {/* Multi-PDF Upload File Box */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-neutral-200">
                            Recruitment &amp; JD PDF Documents
                          </label>
                          <span className="text-[11px] font-semibold text-white">
                            {jdFiles.length} file{jdFiles.length === 1 ? '' : 's'} selected
                          </span>
                        </div>
                        <div className="border-2 border-dashed border-neutral-700 rounded-xl p-4 text-center hover:border-indigo-400 transition bg-neutral-900/40">
                          <input
                            type="file"
                            multiple
                            accept=".pdf,application/pdf"
                            onChange={(e) => {
                              handleJdFilesAdded(e.target.files);
                              e.target.value = '';
                            }}
                            className="hidden"
                            id="jd-pdf-upload"
                          />
                          <label
                            htmlFor="jd-pdf-upload"
                            className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                          >
                            <div className="p-2 bg-neutral-900 text-white rounded-lg">
                              <UploadCloud className="h-6 w-6" />
                            </div>
                            <span className="text-xs font-bold text-white hover:text-white">
                              Click to browse or drag &amp; drop PDF documents
                            </span>
                            <span className="text-[11px] text-neutral-400">
                              Upload JD PDF, candidate guidelines, test syllabus (Up to 10MB each)
                            </span>
                          </label>
                        </div>

                        {/* List of uploaded PDF documents */}
                        {jdFiles.length > 0 && (
                          <div className="mt-2.5 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                            {jdFiles.map((f, idx) => (
                              <div
                                key={`${f.name}-${idx}`}
                                className="flex items-center justify-between px-3 py-2 bg-neutral-900/60 border border-indigo-100 rounded-lg text-xs"
                              >
                                <div className="flex items-center gap-2 overflow-hidden pr-2">
                                  <FileText className="h-4 w-4 text-white shrink-0" />
                                  <span className="font-medium text-white truncate" title={f.name}>
                                    {f.name}
                                  </span>
                                  <span className="text-[10px] text-neutral-400 shrink-0">
                                    ({(f.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveJdFile(idx)}
                                  className="p-1 text-gray-400 hover:text-red-600 rounded transition shrink-0"
                                  title="Remove document"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Optional JD Text Box */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-300 mb-1">
                          Or Paste Additional Notes / Text Content
                        </label>
                        <textarea
                          rows={3}
                          value={jdRawText}
                          onChange={(e) => {
                            setJdRawText(e.target.value);
                            setJdSummaryMsg(null);
                          }}
                          placeholder="Paste additional job description text here (e.g. eligibility requirements, CTC package, role details)..."
                          className="w-full border border-neutral-700 rounded-xl px-3.5 py-2.5 bg-[#18181b] text-white text-xs placeholder:text-neutral-500 focus:border-white focus:outline-hidden"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSummarizeJd}
                        disabled={isSummarizingJd || (jdFiles.length === 0 && !jdFile && !jdRawText.trim())}
                        className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 disabled:bg-neutral-900 disabled:text-neutral-500 disabled:border-neutral-800 border border-white transition shadow-xs"
                      >
                        <Sparkles className={`h-4 w-4 ${isSummarizingJd ? 'animate-spin' : ''}`} />
                        {isSummarizingJd ? 'Synthesizing Documents with Gemini AI...' : `Analyze ${jdFiles.length > 1 ? `${jdFiles.length} Documents` : 'JD'} & Auto-Fill Form`}
                      </button>

                      {/* AI Extraction Feedback Banner */}
                      {jdSummaryMsg && (
                        <div
                          className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                            jdSummaryMsg.type === 'success'
                              ? 'bg-emerald-950/60 border-emerald-800/70 text-emerald-200'
                              : 'bg-red-950/60 border-red-800/70 text-red-200'
                          }`}
                        >
                          {jdSummaryMsg.type === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <span>{jdSummaryMsg.text}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Recruitment Drive Configuration Form */}
                  <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="h-5 w-5 text-white" />
                      <h3 className="text-sm font-bold text-white">
                        Step 2: Review Drive Details &amp; Eligibility Criteria
                      </h3>
                    </div>

                    <form onSubmit={handleCreateDriveSubmit} className="space-y-4">
                      {/* Company & Role */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-200 mb-1">
                            Company Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={driveCompany}
                            onChange={(e) => setDriveCompany(e.target.value)}
                            placeholder="e.g. Google, Microsoft, Infosys"
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-200 mb-1">
                            Job Role / Designation
                          </label>
                          <input
                            type="text"
                            value={driveRole}
                            onChange={(e) => setDriveRole(e.target.value)}
                            placeholder="e.g. Software Engineer, Analyst"
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* Internship Opportunity Quick Toggle */}
                      <div className="flex items-center justify-between p-3.5 bg-neutral-900/80 rounded-xl border border-neutral-800">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-black border border-white tracking-wide shadow-xs">
                            Internship
                          </span>
                          <div>
                            <span className="text-xs font-bold text-white block">Internship Opportunity</span>
                            <span className="text-[11px] text-neutral-400 block">
                              Toggle if this drive is an internship / stipend role rather than full-time
                            </span>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={drivePackageCategory === 'INTERNSHIP'}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDrivePackageCategory('INTERNSHIP');
                              } else {
                                const num = parseFloat(driveCtcLpa);
                                setDrivePackageCategory(!isNaN(num) && num >= 7 ? 'DREAM' : 'GENERAL');
                              }
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white peer-checked:after:bg-black"></div>
                        </label>
                      </div>

                      {/* Package Category & CTC LPA */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-200 mb-1">
                            Package Category <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={drivePackageCategory}
                            onChange={(e) => {
                              const cat = e.target.value as 'GENERAL' | 'DREAM' | 'INTERNSHIP';
                              setDrivePackageCategory(cat);
                            }}
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          >
                            <option value="GENERAL">💼 General (&lt; 7 LPA)</option>
                            <option value="DREAM">★ Dream (≥ 7 LPA)</option>
                            <option value="INTERNSHIP">⏳ Internship / Stipend</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-200 mb-1">
                            {drivePackageCategory === 'INTERNSHIP' ? 'Stipend / Package (in LPA)' : 'Package CTC (in LPA)'}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={driveCtcLpa}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDriveCtcLpa(val);
                              const num = parseFloat(val);
                              if (!isNaN(num) && drivePackageCategory !== 'INTERNSHIP') {
                                if (num >= 7) {
                                  setDrivePackageCategory('DREAM');
                                } else {
                                  setDrivePackageCategory('GENERAL');
                                }
                              }
                            }}
                            placeholder="e.g. 12.5"
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-semibold font-mono placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* YouTube Video URL Field */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
                            <Video className="h-4 w-4 text-white" />
                            <span>YouTube Video (Company &amp; Interview Prep)</span>
                          </label>
                          {driveYoutubeUrl && (
                            <a
                              href={driveYoutubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-medium text-neutral-300 hover:text-white underline flex items-center gap-1"
                            >
                              <span>Preview link</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <input
                          type="url"
                          value={driveYoutubeUrl}
                          onChange={(e) => setDriveYoutubeUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/... (Auto-populated by AI)"
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-mono placeholder:text-neutral-500 focus:ring-2 focus:ring-white focus:outline-hidden"
                        />
                        <p className="text-[11px] text-neutral-500 mt-1">
                          AI automatically populates company overview or interview preparation video, or you can paste a custom YouTube link.
                        </p>
                      </div>

                      {/* Cutoff CGPA & Backlog / Supply Policy */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-200 mb-1">
                            Minimum CGPA Cutoff
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="10"
                            value={driveMinCgpa}
                            onChange={(e) => setDriveMinCgpa(e.target.value)}
                            placeholder="e.g. 7.0 (0 for no cutoff)"
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-200 mb-1">
                            Selection Rounds Count
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={driveTotalRounds}
                            onChange={(e) => setDriveTotalRounds(e.target.value)}
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
                      </div>

                      {/* Supply / Backlogs Policy Toggle */}
                      <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-200">
                          <input
                            type="checkbox"
                            checked={driveAllowBacklogs}
                            onChange={(e) => setDriveAllowBacklogs(e.target.checked)}
                            className="rounded border-neutral-700 text-white focus:ring-indigo-500 h-4 w-4"
                          />
                          <span>Allow candidates with active backlogs / supply</span>
                        </label>

                        {driveAllowBacklogs && (
                          <div className="pt-2 border-t border-neutral-800 flex items-center gap-3">
                            <span className="text-xs text-neutral-400 font-medium">
                              Maximum Allowed Active Backlogs:
                            </span>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={driveMaxActiveBacklogs}
                              onChange={(e) => setDriveMaxActiveBacklogs(e.target.value)}
                              className="w-20 border border-neutral-700 rounded-md px-2 py-1 bg-[#18181b] text-white text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            />
                          </div>
                        )}
                      </div>

                      {/* Mock OA Coding Questions Toggle */}
                      <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-200">
                          <input
                            type="checkbox"
                            checked={driveCodingEnabled}
                            onChange={(e) => setDriveCodingEnabled(e.target.checked)}
                            className="rounded border-neutral-700 text-white focus:ring-indigo-500 h-4 w-4"
                          />
                          <span>Include Coding Questions in Mock OA Assessment</span>
                        </label>
                        <p className="text-[11px] text-neutral-400 mt-1 pl-6">
                          Uncheck if this recruitment drive only conducts aptitude/technical MCQs with no live coding round.
                        </p>
                      </div>

                      {/* Eligible Departments / Branches Multi-Select */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-semibold text-neutral-200">
                            Eligible Branches / Departments <span className="text-red-500">*</span>
                          </label>
                          <div className="flex items-center gap-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setDriveEligibleBranches([...ALL_BRANCHES])}
                              className="text-white hover:text-neutral-200 font-semibold underline"
                            >
                              Select All
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => setDriveEligibleBranches([])}
                              className="text-neutral-400 hover:text-neutral-300 underline"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {ALL_BRANCHES.map((b) => {
                            const isSelected = driveEligibleBranches.includes(b);
                            return (
                              <button
                                key={b}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setDriveEligibleBranches(driveEligibleBranches.filter((x) => x !== b));
                                  } else {
                                    setDriveEligibleBranches([...driveEligibleBranches, b]);
                                  }
                                }}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition border ${
                                  isSelected
                                    ? 'bg-white text-black font-bold border-white shadow-2xs'
                                    : 'bg-white text-neutral-300 border-neutral-700 hover:bg-neutral-900/60'
                                }`}
                              >
                                {b}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Application Deadline */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-200 mb-1">
                          Application Deadline <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={driveDeadline}
                          onChange={(e) => setDriveDeadline(e.target.value)}
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      {/* Job Description / Summary */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-200 mb-1">
                          Job Summary &amp; Overview
                        </label>
                        <textarea
                          rows={3}
                          value={driveDescription}
                          onChange={(e) => setDriveDescription(e.target.value)}
                          placeholder="Summary of responsibilities, requirements, and candidate expectations..."
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      {/* Candidate Registration Method: Excel Sheet Format OR Direct Registration Link */}
                      <div className="p-4 bg-[#121215] rounded-xl border border-neutral-800 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-bold text-white">
                              Candidate Registration Format
                            </h4>
                            <p className="text-[11px] text-neutral-400">
                              Choose whether to configure a company Excel sheet format or provide a direct company registration link.
                            </p>
                          </div>
                          <div className="inline-flex rounded-lg border border-neutral-800 bg-[#09090b] p-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setDriveApplicationMode('excel')}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
                                driveApplicationMode === 'excel'
                                  ? 'bg-white text-black shadow-xs'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                              Excel Sheet Format
                            </button>
                            <button
                              type="button"
                              onClick={() => setDriveApplicationMode('link')}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
                                driveApplicationMode === 'link'
                                  ? 'bg-white text-black shadow-xs'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Registration Link
                            </button>
                          </div>
                        </div>

                        {driveApplicationMode === 'link' ? (
                          <div className="space-y-2 pt-1">
                            <label className="block text-[11px] font-semibold text-neutral-300">
                              Company Registration Portal URL <span className="text-red-400">*</span>
                            </label>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="url"
                                value={driveRegistrationLink}
                                onChange={(e) => setDriveRegistrationLink(e.target.value)}
                                placeholder="https://careers.company.com/campus-apply/..."
                                className="flex-1 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white bg-[#18181b] placeholder:text-neutral-500 focus:ring-2 focus:ring-white/30 focus:outline-hidden"
                              />
                              {driveRegistrationLink.trim() && (
                                <a
                                  href={driveRegistrationLink.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition whitespace-nowrap"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Test Link
                                </a>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-400">
                              Eligible students will see a direct &quot;Register on Company Portal&quot; button on their dashboard and drive page.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 pt-1">
                              <div className="flex items-start gap-2">
                                <FileSpreadsheet className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                                <div>
                                  <h4 className="text-xs font-bold text-white">
                                    Company Required Excel Sheet Format (Optional)
                                  </h4>
                                  <p className="text-[11px] text-neutral-400">
                                    Specify or upload the custom column headers required by the company for exporting candidate data.
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <input
                                  type="file"
                                  id="company-template-upload"
                                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                  onChange={handleUploadCompanyTemplate}
                                  className="hidden"
                                />
                                <label
                                  htmlFor="company-template-upload"
                                  className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition ${
                                    isParsingTemplate ? 'opacity-50 pointer-events-none' : ''
                                  }`}
                                >
                                  <UploadCloud className="h-3.5 w-3.5" />
                                  {isParsingTemplate ? 'Analyzing Template...' : 'Upload Template (.xlsx)'}
                                </label>
                                <button
                                  type="button"
                                  onClick={handleAddCompanyColumn}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Add Column
                                </button>
                              </div>
                            </div>

                        {templateUploadMsg && (
                          <div
                            className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                              templateUploadMsg.type === 'success'
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                                : 'bg-red-950/60 text-red-300 border border-red-800/60'
                            }`}
                          >
                            {templateUploadMsg.type === 'success' ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                            )}
                            <span>{templateUploadMsg.text}</span>
                          </div>
                        )}

                        {companyFormatColumns.length === 0 ? (
                          <div className="py-3 px-4 text-center border border-dashed border-neutral-700 rounded-lg text-xs text-neutral-400 bg-[#18181b]">
                            No custom company columns specified. You can upload the company&apos;s template (.xlsx) or click &quot;Add Column&quot; to configure required headers. If none specified, standard canonical columns will be used.
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-neutral-800 rounded-lg bg-[#18181b] text-white">
                            <table className="w-full text-xs divide-y divide-neutral-800">
                              <thead className="bg-neutral-900 text-neutral-300 font-semibold text-left">
                                <tr>
                                  <th className="px-3 py-2 w-10">#</th>
                                  <th className="px-3 py-2">Company Header (Required in Export)</th>
                                  <th className="px-3 py-2">System Field Mapping</th>
                                  <th className="px-3 py-2 text-right w-16">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-neutral-800">
                                {companyFormatColumns.map((col, idx) => (
                                  <tr key={idx} className="hover:bg-neutral-900/40">
                                    <td className="px-3 py-2 text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="text"
                                        value={col.companyHeader}
                                        onChange={(e) => handleUpdateCompanyColumn(idx, 'companyHeader', e.target.value)}
                                        placeholder="e.g. Candidate Full Name, Reg No"
                                        className="w-full border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-black font-medium bg-[#18181b] text-white focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="space-y-1.5">
                                        <select
                                          value={col.sourceField}
                                          onChange={(e) => handleUpdateCompanyColumn(idx, 'sourceField', e.target.value)}
                                          className="w-full border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-white font-medium bg-[#18181b] focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                                        >
                                          <optgroup label="Special Values & Actions">
                                            <option value="__null__">-- Leave Blank / Null / Empty --</option>
                                            <option value="__to_be_filled__">-- To Be Filled Later --</option>
                                            <option value="__custom_value__">Custom Static Value (Constant Text)</option>
                                            <option value="__custom_field__">Custom Questionnaire Field (Ask Student)</option>
                                          </optgroup>
                                          <optgroup label="Core Student Profile Fields">
                                            <option value="studentId">Roll Number / Student ID</option>
                                            <option value="registrationNumber">Registration Number / USN</option>
                                            <option value="name">Candidate Full Name</option>
                                            <option value="firstName">First Name</option>
                                            <option value="lastName">Last Name</option>
                                            <option value="branch">Branch / Department</option>
                                            <option value="batch">Graduation Batch</option>
                                            <option value="cgpa">Current CGPA</option>
                                            <option value="activeBacklogs">Active Backlogs / Arrears</option>
                                            <option value="email">College / Student Email</option>
                                            <option value="phone">Contact Number / Mobile</option>
                                            <option value="tenthPercentage">10th / SSC Marks (%)</option>
                                            <option value="twelfthPercentage">12th / HSC Marks (%)</option>
                                            <option value="percentage">Aggregate Percentage (%)</option>
                                            <option value="dob">Date of Birth</option>
                                            <option value="age">Age</option>
                                            <option value="gender">Gender</option>
                                            <option value="resumeUrl">Resume / CV Link</option>
                                            <option value="placed">Placement Status (YES/NO)</option>
                                            <option value="verified">Coordinator Verified (YES/NO)</option>
                                          </optgroup>
                                          <optgroup label="Extended Background & KYC Fields">
                                            <option value="fatherName">Father's Name</option>
                                            <option value="motherName">Mother's Name</option>
                                            <option value="panNumber">PAN Card Number</option>
                                            <option value="aadhaarNumber">Aadhaar Number</option>
                                            <option value="githubUrl">GitHub Profile URL</option>
                                            <option value="linkedInUrl">LinkedIn Profile URL</option>
                                            <option value="address">Permanent / Current Address</option>
                                            <option value="currentSemester">Current Semester</option>
                                          </optgroup>
                                          <optgroup label="Semester SGPA (S1 - S8)">
                                            <option value="s1Sgpa">Semester 1 SGPA</option>
                                            <option value="s2Sgpa">Semester 2 SGPA</option>
                                            <option value="s3Sgpa">Semester 3 SGPA</option>
                                            <option value="s4Sgpa">Semester 4 SGPA</option>
                                            <option value="s5Sgpa">Semester 5 SGPA</option>
                                            <option value="s6Sgpa">Semester 6 SGPA</option>
                                            <option value="s7Sgpa">Semester 7 SGPA</option>
                                            <option value="s8Sgpa">Semester 8 SGPA</option>
                                          </optgroup>
                                        </select>

                                        {/* Custom Static Text Input */}
                                        {col.sourceField === '__custom_value__' && (
                                          <input
                                            type="text"
                                            value={col.customValue || ''}
                                            onChange={(e) => handleUpdateCompanyColumn(idx, 'customValue', e.target.value)}
                                            placeholder="Enter static constant value (e.g. 'Bengaluru', 'Trainee', 'Yes')"
                                            className="w-full border border-neutral-700 rounded-md px-2.5 py-1 text-[11px] text-white bg-neutral-900 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                                          />
                                        )}

                                        {/* Custom Questionnaire Key Input */}
                                        {col.sourceField === '__custom_field__' && (
                                          <input
                                            type="text"
                                            value={col.customKey || ''}
                                            onChange={(e) => handleUpdateCompanyColumn(idx, 'customKey', e.target.value)}
                                            placeholder="Field key for students to fill (e.g. 'preferredLocation', 'tShirtSize')"
                                            className="w-full border border-neutral-700 rounded-md px-2.5 py-1 text-[11px] text-white bg-neutral-900 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                                          />
                                        )}

                                        {/* Optional Placeholder for To Be Filled */}
                                        {col.sourceField === '__to_be_filled__' && (
                                          <input
                                            type="text"
                                            value={col.customValue || ''}
                                            onChange={(e) => handleUpdateCompanyColumn(idx, 'customValue', e.target.value)}
                                            placeholder="Custom placeholder (default: 'To be filled')"
                                            className="w-full border border-neutral-700 rounded-md px-2.5 py-1 text-[11px] text-neutral-400 bg-neutral-900 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                                          />
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCompanyColumn(idx)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 rounded transition"
                                        title="Remove column"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                          </>
                        )}
                      </div>

                      {/* Mock Test Reference PDF (Multi-Agent OA Engine) */}
                      <div className="p-4 bg-neutral-900/60 rounded-xl border border-neutral-800 space-y-3">
                        <div className="flex items-start gap-2.5">
                          <FileText className="h-5 w-5 text-white mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-white">
                                Mock Test Reference PDF (Optional)
                              </h4>
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-neutral-300 font-mono">
                                Multi-Agent Engine
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-0.5">
                              Upload past question papers or test patterns (.pdf). The Multi-Agent synthesis agent will cross-reference this with web-mined data to generate 5 coding questions and 30 MCQs.
                            </p>
                          </div>
                        </div>

                        <div className="border border-dashed border-neutral-700 rounded-lg p-3 text-center bg-[#09090b]">
                          <input
                            type="file"
                            id="mock-test-pdf-upload"
                            accept=".pdf,application/pdf"
                            multiple
                            onChange={(e) => {
                              if (e.target.files) {
                                const files = Array.from(e.target.files);
                                setMockTestFiles((prev) => [...prev, ...files]);
                              }
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor="mock-test-pdf-upload"
                            className="cursor-pointer inline-flex items-center gap-2 text-xs font-semibold text-neutral-300 hover:text-white"
                          >
                            <UploadCloud className="h-4 w-4 text-white" />
                            <span>Select Mock Test PDF file(s)</span>
                          </label>
                        </div>

                        {mockTestFiles.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {mockTestFiles.map((file, idx) => (
                              <div
                                key={`${file.name}-${idx}`}
                                className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-xs"
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <FileText className="h-3.5 w-3.5 text-white shrink-0" />
                                  <span className="truncate text-neutral-200">{file.name}</span>
                                  <span className="text-[10px] text-neutral-400 font-mono">
                                    ({(file.size / 1024).toFixed(1)} KB)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setMockTestFiles((prev) => prev.filter((_, i) => i !== idx))}
                                  className="text-neutral-400 hover:text-rose-400"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {driveMsg && (
                        <div
                          className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                            driveMsg.type === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-red-50 border-red-200 text-red-800'
                          }`}
                        >
                          {driveMsg.type === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <span>{driveMsg.text}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isCreatingDrive}
                        className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 disabled:bg-neutral-900 disabled:text-neutral-500 disabled:border-neutral-800 border border-white transition shadow-sm"
                      >
                        <Briefcase className="h-4 w-4" />
                        {isCreatingDrive ? 'Publishing Placement Drive...' : 'Publish Placement Drive & Launch Spreadsheet'}
                      </button>
                    </form>
                  </div>
                </div>

                {/* Column 2: Published Placement Drives (5 Cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white shadow-xs p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Building className="h-5 w-5 text-white" />
                        <h3 className="text-sm font-bold text-white">
                          Published Recruitment Drives
                        </h3>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-full whitespace-nowrap shrink-0">
                        {drivesList.length} Listed
                      </span>
                    </div>

                    {/* All / Active / Previous Drives Filter */}
                    <div className="flex items-center gap-1.5 bg-[#18181b] border border-neutral-800 rounded-xl p-1 mb-4 text-xs font-medium">
                      {(['all', 'active', 'previous'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setDriveTimeFilter(t)}
                          className={`flex-1 px-2.5 py-1.5 rounded-lg transition whitespace-nowrap capitalize ${
                            driveTimeFilter === t
                              ? 'bg-white text-black font-bold shadow-2xs'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                        >
                          {t === 'previous' ? 'Previous Drives' : t}
                        </button>
                      ))}
                    </div>

                    {isLoadingDrives && drivesList.length === 0 ? (
                      <div className="py-12 text-center text-xs text-neutral-400">
                        <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin mx-auto mb-2" />
                        Loading published drives...
                      </div>
                    ) : drivesList.length === 0 ? (
                      <div className="py-12 text-center text-xs text-neutral-400">
                        No placement drives published yet. Create your first drive using the form.
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[800px] overflow-y-auto pr-1">
                        {drivesList
                          .filter((d) => {
                            const isPrev = Boolean(d.isPrevious || !d.open);
                            if (driveTimeFilter === 'active') return !isPrev;
                            if (driveTimeFilter === 'previous') return isPrev;
                            return true;
                          })
                          .map((d) => (
                          <div
                            key={d.id}
                            className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-[#18181b] text-white hover:border-neutral-600 transition shadow-2xs space-y-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 pr-1">
                                <h4 className="font-bold text-white text-sm truncate" title={d.company}>{d.company}</h4>
                                {d.role && <p className="text-xs text-neutral-400 mt-0.5 truncate" title={d.role}>{d.role}</p>}
                              </div>
                              <span className="shrink-0 whitespace-nowrap px-3.5 py-1 rounded-full text-xs font-bold bg-white text-black border border-white text-center shadow-xs tracking-wide min-w-[76px]">
                                {d.packageCategory === 'DREAM'
                                  ? 'Dream'
                                  : d.packageCategory === 'INTERNSHIP'
                                  ? 'Internship'
                                  : 'General'}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400 bg-[#18181b] text-white p-3 rounded-lg border border-neutral-800">
                              <div>
                                <span className="text-neutral-500 block">Package:</span>
                                <span className="font-bold text-emerald-400 font-mono">
                                  {d.ctcLpa !== null ? `${d.ctcLpa} LPA` : 'As per policy'}
                                </span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block">Min CGPA:</span>
                                <span className="font-semibold text-white">
                                  {d.minCgpa > 0 ? d.minCgpa : 'None'}
                                </span>
                              </div>
                              <div>
                                <span className="text-neutral-500 block">Backlogs / Supply:</span>
                                <span className={`font-semibold ${d.allowBacklogs ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {d.allowBacklogs ? `Allowed (≤ ${d.maxActiveBacklogs})` : 'Zero Only'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400 block">Rounds:</span>
                                <span className="font-semibold text-white">
                                  {d.totalRounds} Round{d.totalRounds === 1 ? '' : 's'}
                                </span>
                              </div>
                            </div>

                            <div className="text-[11px] text-neutral-400">
                              <span className="font-medium text-neutral-300">Eligible: </span>
                              {d.eligibleBranches.join(', ')}
                            </div>

                            <div className="text-[11px] text-gray-400">
                              Deadline: {new Date(d.deadline).toLocaleString()}
                            </div>

                            {d.mockTestPdfUrls && d.mockTestPdfUrls.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/10 text-neutral-200 border border-white/20">
                                  <FileText className="h-3 w-3 text-white" />
                                  Mock PDF Attached ({d.mockTestPdfUrls.length})
                                </span>
                              </div>
                            )}

                            {d.youtubeUrl && (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={d.youtubeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-red-950/60 text-red-300 border border-red-800/80 hover:bg-red-900/60 transition"
                                  title="View attached YouTube company / interview preparation video"
                                >
                                  <Video className="h-3 w-3 text-red-400" />
                                  <span>YouTube Video Attached</span>
                                  <ExternalLink className="h-2.5 w-2.5 text-red-400" />
                                </a>
                              </div>
                            )}

                            {/* Selected / Placed Candidates in this Drive */}
                            {d.placedCandidates && d.placedCandidates.length > 0 && (
                              <div className="p-2.5 bg-emerald-950/30 border border-emerald-800/60 rounded-xl space-y-1.5">
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

                            {/* Action Buttons */}
                            <div className="pt-2 border-t border-neutral-800 flex flex-wrap items-center gap-2">
                              <Link
                                href={`/drives/${d.id}`}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-black bg-white hover:bg-neutral-200 transition shadow-2xs whitespace-nowrap"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Open Application Sheet
                              </Link>

                              <button
                                type="button"
                                onClick={() => setShortlistDrive(d)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition whitespace-nowrap"
                                title="Upload shortlisted candidates PDF and notify students"
                              >
                                <Bell className="h-3.5 w-3.5 text-amber-400" />
                                Shortlist PDF
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingYoutubeDriveId(d.id);
                                  setEditingYoutubeUrl(d.youtubeUrl || '');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition"
                                title="Edit or attach YouTube preparation video link"
                              >
                                <Video className="h-3.5 w-3.5 text-white" />
                                {d.youtubeUrl ? 'Change Video' : 'Add Video'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDriveForMockPdf(d.id);
                                  setMockPdfModalOpen(true);
                                  setMockPdfUploadMsg(null);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition"
                                title="Upload reference mock test PDF for multi-agent synthesis"
                              >
                                <UploadCloud className="h-3.5 w-3.5 text-white" />
                                Upload Mock PDF
                              </button>

                              <Link
                                href={`/drives/${d.id}/mock-oa`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition"
                                title="Preview AI Multi-Agent Mock OA Simulation"
                              >
                                <Sparkles className="h-3.5 w-3.5 text-white" />
                                Mock OA
                              </Link>

                              <button
                                type="button"
                                onClick={() => {
                                  setBatchFieldModalDriveId(d.id);
                                  setBatchFieldMsg(null);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition whitespace-nowrap"
                              >
                                <Plus className="h-3.5 w-3.5 text-white" />
                                Add Batch Field
                              </button>

                              <a
                                href={`http://localhost:4000/api/drives/${d.id}/export`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition whitespace-nowrap"
                                title="Download standard report with consolidated candidates and branch funnel"
                              >
                                <Download className="h-3.5 w-3.5 text-neutral-400" />
                                Export Excel
                              </a>

                              <a
                                href={`http://localhost:4000/api/drives/${d.id}/export?format=company`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/70 transition whitespace-nowrap"
                                title="Download candidates formatted exactly according to the company's required Excel schema"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                                Company Format (.xlsx)
                              </a>

                              {d.registrationLink && (
                                <a
                                  href={d.registrationLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-300 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800/70 transition whitespace-nowrap"
                                  title="Open external company registration link"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
                                  Registration Link
                                </a>
                              )}

                              {/* Take Down / Delete Drive Button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteDrive(d.id, d.company, d.role)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 transition whitespace-nowrap ml-auto"
                                title="Take down / permanently delete this recruitment drive"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                <span>Take Down Drive</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Batch Info Collection Modal */}
              {batchFieldModalDriveId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                  <div className="bg-[#18181b] text-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-800">
                    <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-100 text-white rounded-lg">
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
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                        <p className="mt-1 text-[11px] text-gray-400">Unique identifier used as the spreadsheet column key.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-200 mb-1">Input Type</label>
                          <select
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value as 'text' | 'number' | 'dropdown')}
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                              className="rounded border-neutral-700 text-white focus:ring-indigo-500 h-4 w-4"
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
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                          className="px-5 py-2 bg-[#18181b] text-white font-bold rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:bg-gray-300 shadow-sm"
                        >
                          {isSubmittingField ? 'Adding Column...' : 'Add Column to Sheet'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Mock Test Reference PDF Upload Modal */}
              {mockPdfModalOpen && selectedDriveForMockPdf && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
                  <div className="bg-[#121214] text-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-800 animate-in zoom-in-95 duration-150">
                    <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-neutral-800 text-white rounded-lg">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Upload Mock Test Reference PDF</h3>
                          <p className="text-xs text-neutral-400">Attach company past papers or test syllabus</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMockPdfModalOpen(false);
                          setDirectMockFile(null);
                          setMockPdfUploadMsg(null);
                        }}
                        className="text-neutral-400 hover:text-white p-1"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4 text-xs">
                      <p className="text-neutral-400 leading-relaxed">
                        Upload a past question paper or model test PDF. The Multi-Agent synthesis pipeline will automatically ingest this document, cross-reference it with crawled web archives, and regenerate 5 coding questions and 30 MCQs for this drive.
                      </p>

                      <div className="border border-dashed border-neutral-700 rounded-xl p-4 text-center bg-[#09090b]">
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          id="direct-mock-pdf-upload"
                          onChange={(e) => setDirectMockFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <label
                          htmlFor="direct-mock-pdf-upload"
                          className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                        >
                          <UploadCloud className="h-6 w-6 text-white" />
                          <span className="font-semibold text-white">
                            {directMockFile ? directMockFile.name : 'Choose Reference PDF File'}
                          </span>
                          <span className="text-[11px] text-neutral-500 font-mono">
                            {directMockFile
                              ? `${(directMockFile.size / 1024).toFixed(1)} KB selected`
                              : 'PDF files up to 15MB'}
                          </span>
                        </label>
                      </div>

                      {mockPdfUploadMsg && (
                        <div
                          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                            mockPdfUploadMsg.type === 'success'
                              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                              : 'bg-rose-950/60 border-rose-800 text-rose-300'
                          }`}
                        >
                          {mockPdfUploadMsg.type === 'success' ? (
                            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                          )}
                          <span>{mockPdfUploadMsg.text}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                        <button
                          type="button"
                          onClick={() => {
                            setMockPdfModalOpen(false);
                            setDirectMockFile(null);
                            setMockPdfUploadMsg(null);
                          }}
                          className="px-4 py-2 border border-neutral-800 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!directMockFile || isUploadingDirectMockPdf}
                          onClick={handleUploadDirectMockPdf}
                          className="px-5 py-2 bg-white text-black font-bold rounded-lg text-xs hover:bg-neutral-200 disabled:opacity-50 transition"
                        >
                          {isUploadingDirectMockPdf ? 'Uploading & Synthesizing...' : 'Upload & Re-synthesize'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit YouTube Video Modal */}
              {editingYoutubeDriveId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                  <div className="bg-[#121214] text-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-800">
                    <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-neutral-900 border border-neutral-700 rounded-lg text-white">
                          <Video className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">Edit YouTube Video Link</h3>
                          <p className="text-xs text-neutral-400">
                            {drivesList.find((d) => d.id === editingYoutubeDriveId)?.company} • Placement Drive
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingYoutubeDriveId(null);
                          setEditingYoutubeUrl('');
                        }}
                        className="text-neutral-400 hover:text-white p-1"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-300 mb-1">
                          YouTube Video URL
                        </label>
                        <input
                          type="url"
                          value={editingYoutubeUrl}
                          onChange={(e) => setEditingYoutubeUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-xs font-mono placeholder:text-neutral-500 focus:ring-2 focus:ring-white focus:outline-hidden"
                        />
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Provide a company overview, tech stack walkthrough, or past interview questions video. Leave blank to remove.
                        </p>
                      </div>

                      {editingYoutubeUrl.trim() && getYouTubeEmbedUrl(editingYoutubeUrl.trim()) && (
                        <div className="aspect-video w-full rounded-xl overflow-hidden border border-neutral-800 bg-black">
                          <iframe
                            src={getYouTubeEmbedUrl(editingYoutubeUrl.trim())!}
                            title="YouTube video preview"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingYoutubeDriveId(null);
                            setEditingYoutubeUrl('');
                          }}
                          className="px-4 py-2 border border-neutral-800 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isUpdatingYoutube}
                          onClick={handleSaveYoutubeUrl}
                          className="px-5 py-2 bg-white text-black font-bold rounded-lg text-xs hover:bg-neutral-200 disabled:opacity-50 transition"
                        >
                          {isUpdatingYoutube ? 'Saving...' : 'Save YouTube Link'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: COMPREHENSIVE PLACEMENT & DEPARTMENT STATISTICS EXCEL GENERATOR */}
          {/* ========================================================================= */}
          {adminTab === 'stats-export' && (
            <div className="space-y-8">
              {/* Header Info Banner */}
              <div className="bg-[#18181b] text-white p-6 rounded-2xl border border-neutral-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="h-6 w-6 text-white" />
                    University Placement &amp; Department Statistics Excel Generator
                  </h2>
                  <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
                    Generate an institution-wide, multi-sheet Excel workbook consisting of an executive Main Sheet
                    and individual department dossiers (CSE, ECE, EEE, IT, CIVIL, MCA) with live student rosters and package analytics.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href="http://localhost:4000/api/drives/statistics/export-excel"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Statistics Excel (.xlsx)</span>
                  </a>
                </div>
              </div>

              {/* Department Placement Share Interactive Pie Chart */}
              <DepartmentPlacementPieChart
                branchBreakdown={liveStatsSummary?.branchBreakdown || []}
                totalStudents={liveStatsSummary?.totalStudents}
                totalPlaced={liveStatsSummary?.totalPlaced}
                title="Department-wise Placement Distribution (Pie Chart)"
                subtitle="Portion sizes represent number of placements per department across CSE, ECE, EEE, IT, CIVIL, MCA"
              />

              {/* Reference Template Setup Banner (Asked for the first time if not uploaded) */}
              <div className="bg-[#18181b] text-white rounded-2xl border border-neutral-800 p-6 shadow-xs space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-white" />
                      Reference Statistics Template Configuration
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Upload your preferred reference Excel format to guide the multi-sheet structure and layout.
                    </p>
                  </div>

                  {statsTemplateStatus?.hasTemplate && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Active Template Configured
                    </span>
                  )}
                </div>

                {isLoadingStatsTemplate ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-xs text-neutral-400">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Checking template configuration...</span>
                  </div>
                ) : !statsTemplateStatus?.hasTemplate ? (
                  /* FIRST TIME PROMPT: Ask user to upload reference Excel sheet */
                  <div className="bg-amber-50/80 border-2 border-dashed border-amber-300 rounded-xl p-6 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 bg-amber-100 rounded-lg text-amber-800 shrink-0 mt-0.5">
                        <UploadCloud className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-amber-950">
                          ⚡ First-Time Setup Required: Upload Reference Excel Sheet (.xlsx)
                        </h4>
                        <p className="text-xs text-amber-800 leading-relaxed">
                          No reference format has been uploaded yet. Please upload your college&apos;s reference placement statistics Excel sheet.
                          The system will inspect your preferred worksheets, columns, and styling, and use it as the structural reference when generating reports.
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleUploadRefTemplate} className="space-y-4 pt-2">
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(e) => setRefTemplateFile(e.target.files?.[0] || null)}
                          className="w-full text-xs text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 border border-amber-300 rounded-lg bg-[#18181b] text-white p-1"
                        />
                        <button
                          type="submit"
                          disabled={!refTemplateFile || isUploadingRefTemplate}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-700 hover:bg-amber-800 disabled:bg-gray-300 text-white rounded-lg text-xs font-bold transition shadow-xs shrink-0"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          <span>{isUploadingRefTemplate ? 'Analyzing Template...' : 'Upload Reference Sheet'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-amber-700 font-medium">
                        <span>💡 Tip:</span>
                        <span>
                          Don&apos;t have your reference sheet right now? You can still download reports immediately using our default university comprehensive format.
                        </span>
                      </div>
                    </form>
                  </div>
                ) : (
                  /* ACTIVE TEMPLATE DETAILS CARD */
                  <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
                      <div>
                        <div className="text-xs text-neutral-400 font-medium">Current Active Template</div>
                        <div className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
                          <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                          <span>{statsTemplateStatus.filename}</span>
                          <span className="text-neutral-400 font-normal text-xs">
                            ({Math.round((statsTemplateStatus.sizeBytes || 0) / 1024)} KB)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href="http://localhost:4000/api/drives/statistics/download-template"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-700 rounded-lg text-xs font-semibold text-neutral-200 bg-neutral-900 hover:bg-neutral-800 transition shadow-2xs"
                        >
                          <Download className="h-3.5 w-3.5 text-neutral-400" />
                          <span>Download Template</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleDeleteRefTemplate}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-800/60 rounded-lg text-xs font-semibold text-rose-400 bg-rose-950/40 hover:bg-rose-900/60 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Reset Template</span>
                        </button>
                      </div>
                    </div>

                    {statsTemplateStatus.sheetNames && statsTemplateStatus.sheetNames.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-neutral-300 block mb-2">
                          Detected Worksheets in Reference:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {statsTemplateStatus.sheetNames.map((sheet, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-md text-xs font-mono bg-neutral-800 border border-neutral-700 text-neutral-200 shadow-2xs"
                            >
                              📄 {sheet}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Replace Form */}
                    <div className="pt-2 border-t border-neutral-800">
                      <details className="text-xs text-neutral-400">
                        <summary className="cursor-pointer font-semibold text-white hover:text-neutral-200">
                          Click here to replace / upload a different reference Excel sheet
                        </summary>
                        <form onSubmit={handleUploadRefTemplate} className="mt-3 flex flex-col sm:flex-row items-center gap-3">
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => setRefTemplateFile(e.target.files?.[0] || null)}
                            className="w-full text-xs text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-neutral-900 file:text-white hover:file:bg-indigo-100 border border-neutral-300 rounded-lg bg-[#18181b] text-white p-1"
                          />
                          <button
                            type="submit"
                            disabled={!refTemplateFile || isUploadingRefTemplate}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-xs font-bold transition shrink-0"
                          >
                            <Upload className="h-3.5 w-3.5" />
                            <span>{isUploadingRefTemplate ? 'Replacing...' : 'Replace Template'}</span>
                          </button>
                        </form>
                      </details>
                    </div>
                  </div>
                )}

                {refTemplateMsg && (
                  <div
                    className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                      refTemplateMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    {refTemplateMsg.type === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    )}
                    <span>{refTemplateMsg.text}</span>
                  </div>
                )}
              </div>

              {/* Live Preview Metrics & Department Breakdown */}
              <div className="bg-[#18181b] text-white rounded-2xl border border-neutral-800 p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="h-5 w-5 text-white" />
                    Live University Placement Statistics Overview
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Real-time metrics that will be calculated and populated in the exported Excel dossier.
                  </p>
                </div>

                {liveStatsSummary ? (
                  <div className="space-y-6">
                    {/* KPI Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                        <span className="text-[11px] font-semibold text-neutral-400 block uppercase">Total Enrolled</span>
                        <span className="text-xl font-extrabold text-white mt-1 block">
                          {liveStatsSummary.totalStudents}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60">
                        <span className="text-[11px] font-semibold text-emerald-400 block uppercase">Placed Students</span>
                        <span className="text-xl font-extrabold text-white mt-1 block font-mono">
                          {liveStatsSummary.totalPlaced}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800">
                        <span className="text-[11px] font-semibold text-neutral-400 block uppercase">Placement %</span>
                        <span className="text-xl font-extrabold text-white mt-1 block font-mono">
                          {liveStatsSummary.placementRate}%
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                        <span className="text-[11px] font-semibold text-neutral-400 block uppercase">Average Package</span>
                        <span className="text-xl font-extrabold text-white mt-1 block font-mono">
                          {liveStatsSummary.averagePackage ? `${liveStatsSummary.averagePackage} LPA` : 'N/A'}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60">
                        <span className="text-[11px] font-semibold text-amber-400 block uppercase">Highest Package</span>
                        <span className="text-xl font-extrabold text-white mt-1 block font-mono">
                          {liveStatsSummary.highestPackage ? `${liveStatsSummary.highestPackage} LPA` : 'N/A'}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/60">
                        <span className="text-[11px] font-semibold text-purple-400 block uppercase">Active Drives</span>
                        <span className="text-xl font-extrabold text-white mt-1 block font-mono">
                          {liveStatsSummary.totalDrives}
                        </span>
                      </div>
                    </div>

                    {/* Department Breakdown Cards */}
                    <div>
                      <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-3">
                        Department-wise Breakdown (All 6 Branches):
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {liveStatsSummary.branchBreakdown.map((b) => (
                          <div
                            key={b.branch}
                            className="p-3.5 rounded-xl border border-neutral-800 bg-[#18181b] text-white hover:border-indigo-400 transition shadow-2xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm text-white">{b.branch}</span>
                              <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-neutral-900 text-white border border-indigo-100">
                                {b.placementRate}%
                              </span>
                            </div>
                            <div className="text-[11px] text-neutral-400 flex justify-between">
                              <span>Placed:</span>
                              <span className="font-bold text-neutral-200">{b.placed} / {b.total}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-neutral-400">
                    Loading live overview statistics...
                  </div>
                )}
              </div>

              {/* What's Inside the Generated Excel Dossier */}
              <div className="bg-neutral-900 text-white rounded-2xl p-6 border border-neutral-800 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                    Structure of Generated Statistics Excel Workbook (.xlsx)
                  </h3>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    7 Dedicated Worksheets
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-neutral-800/80 border border-neutral-700 space-y-2">
                    <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
                      <span>📄 Sheet 1: Placement Statistics (Main Executive Summary)</span>
                    </div>
                    <ul className="list-disc list-inside text-neutral-300 space-y-1 pl-1">
                      <li>Executive KPI Performance matrix (Enrolled, Eligible, Placed, Placement %, CTC distribution)</li>
                      <li>Department Comparative Analysis table with totals and average benchmarks</li>
                      <li>Corporate Recruitment Drives summary (Company, designation, CTC, applicant conversion rates)</li>
                      <li>Formula injection neutralization and professional formatting with auto-fit columns</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-neutral-800/80 border border-neutral-700 space-y-2">
                    <div className="font-bold text-indigo-400 text-sm flex items-center gap-1.5">
                      <span>📄 Sheets 2–7: Department Dossiers (CSE, ECE, EEE, IT, CIVIL, MCA)</span>
                    </div>
                    <ul className="list-disc list-inside text-neutral-300 space-y-1 pl-1">
                      <li>Department-level KPI banners (Strength, Placed Count, Dept Placement %, Avg &amp; Max CTC)</li>
                      <li>Full Candidate Placement Roster: Roll No, Name, Reg No, CGPA, Backlogs, Placed Company, Role</li>
                      <li>Package tier categorization (Dream Offers &ge; 7 LPA, General, Paid Internships)</li>
                      <li>Highlighting placed students and coordinator verification status</li>
                    </ul>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <a
                    href="http://localhost:4000/api/drives/statistics/export-excel"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-extrabold rounded-xl text-xs transition shadow-md"
                  >
                    <Download className="h-4 w-4 text-neutral-950" />
                    <span>Generate &amp; Download Complete Statistics Workbook</span>
                  </a>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* SHORTLIST PDF & NOTIFICATION MODAL */}
        {shortlistDrive && (
          <ShortlistModal
            drive={shortlistDrive}
            onClose={() => setShortlistDrive(null)}
            onCompleted={() => {
              void fetchDrivesList();
            }}
          />
        )}
      </div>
    </RequireAuth>
  );
}

