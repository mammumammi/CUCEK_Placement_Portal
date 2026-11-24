'use client';

/**
 * @fileoverview Main Coordinator (Admin) Dashboard.
 * Provides bulk student Excel registration with validation preview, CGPA calculation,
 * atomic commit, and sample template downloading.
 *
 * @module app/admin/page
 */

import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { DepartmentPlacementPieChart } from '@/components/analytics/DepartmentPlacementPieChart';
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
  type CompanyFormatColumn,
  type DriveItem,
  type DriveExtraField,
  type JdSummaryResult,
  type NotificationResult,
  type StatsTemplateStatus,
  type PublicPlacementStats,
} from '@/services/drives.service';

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

  const [adminTab, setAdminTab] = useState<'upload' | 'curriculum' | 'drives' | 'stats-export' | 'analytics'>('upload');
  const setActiveTabSafe = (t: string) => setAdminTab(t as any);
  const containerRef = useRef<HTMLDivElement>(null);

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
  const [driveMinCgpa, setDriveMinCgpa] = useState<string>('6.5');
  const [driveAllowBacklogs, setDriveAllowBacklogs] = useState<boolean>(false);
  const [driveMaxActiveBacklogs, setDriveMaxActiveBacklogs] = useState<string>('0');
  const [driveEligibleBranches, setDriveEligibleBranches] = useState<string[]>([...ALL_BRANCHES]);
  const [driveDeadline, setDriveDeadline] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
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
    if (adminTab === 'stats-export') {
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

    setIsCreatingDrive(true);
    setDriveMsg(null);

    try {
      const formData = new FormData();
      formData.append('company', driveCompany.trim());
      if (driveRole.trim()) formData.append('role', driveRole.trim());
      if (driveDescription.trim()) formData.append('description', driveDescription.trim());
      formData.append('packageCategory', drivePackageCategory);
      if (driveCtcLpa.trim()) formData.append('ctcLpa', driveCtcLpa.trim());
      formData.append('minCgpa', driveMinCgpa.trim() || '0');
      formData.append('allowBacklogs', String(driveAllowBacklogs));
      formData.append('maxActiveBacklogs', driveAllowBacklogs ? (driveMaxActiveBacklogs.trim() || '2') : '0');
      formData.append('eligibleBranches', JSON.stringify(driveEligibleBranches));
      formData.append('deadline', new Date(driveDeadline).toISOString());
      formData.append('totalRounds', driveTotalRounds.trim() || '1');
      formData.append('notifyEligible', String(driveNotifyEligible));

      const allFiles = jdFiles.length > 0 ? jdFiles : (jdFile ? [jdFile] : []);
      if (allFiles.length > 0) {
        allFiles.forEach((file) => {
          formData.append('files', file);
        });
        formData.append('file', allFiles[0]);
      }

      if (companyFormatColumns.length > 0) {
        formData.append('companyFormat', JSON.stringify(companyFormatColumns));
      }

      const res = await createDrive(formData);
      setDriveMsg({
        type: 'success',
        text: `Drive for ${res.company} created successfully!`,
      });

      if (res.notification) {
        setNotificationModalData(res.notification);
      }

      // Reset form fields
      setDriveCompany('');
      setDriveRole('');
      setDriveDescription('');
      setDriveCtcLpa('');
      setJdFile(null);
      setJdFiles([]);
      setCompanyFormatColumns([]);
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

  const handlePreview = async () => {
    if (!selectedFile) {
      setError('Please select an Excel file first.');
      return;
    }

    setIsPreviewing(true);
    setError(null);
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
  const missingRequiredFields = CANONICAL_FIELD_OPTIONS.filter(
    (field) => field.required && !mappedFieldValues.has(field.key)
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
                { id: 'upload', label: 'Bulk Student Upload', icon: Upload },
                { id: 'analytics', label: 'Pie Chart Analytics', icon: PieChartIcon },
                { id: 'curriculum', label: 'Curriculum Credits', icon: Award },
                { id: 'drives', label: 'Drives & AI Summarizer', icon: Briefcase },
                { id: 'stats-export', label: 'Placement Statistics Excel', icon: FileSpreadsheet },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = adminTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTabSafe(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                      isActive
                        ? 'bg-neutral-800/90 text-white shadow-xs border border-neutral-700/60'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                    <span>{item.label}</span>
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
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#18181b] text-white text-black hover:bg-neutral-200 text-xs font-bold transition shadow-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </header>

          {/* Main Content Area */}
          <div className="p-4 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto space-y-8 flex-1">
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
                      disabled={isPreviewing || isCommitting || missingRequiredFields.length > 0}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-xs"
                    >
                      {isPreviewing ? 'Validating...' : 'Generate Preview'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Missing required warning */}
                {missingRequiredFields.length > 0 ? (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Missing Student ID Column: </span>
                      Please map the <strong>Student ID / Reg No</strong> column before previewing.
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
                                className="w-full max-w-xs border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-[#18181b] text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-neutral-400">
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
                          className={isValid ? 'hover:bg-neutral-900/60' : 'bg-red-50/50'}
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
                    Upload recruitment JD PDFs or paste raw text. The Gemini AI engine automatically categorizes compensation packages into <strong>General (&lt; 7 LPA)</strong>, <strong>Dream (≥ 7 LPA)</strong>, and <strong>Internship</strong>, extracts CGPA &amp; supply/backlog rules, and dispatches automated invitation emails with direct spreadsheet links to all eligible students.
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
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSummarizeJd}
                        disabled={isSummarizingJd || (jdFiles.length === 0 && !jdFile && !jdRawText.trim())}
                        className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 transition shadow-xs"
                      >
                        <Sparkles className={`h-4 w-4 ${isSummarizingJd ? 'animate-spin' : ''}`} />
                        {isSummarizingJd ? 'Synthesizing Documents with Gemini AI...' : `Analyze ${jdFiles.length > 1 ? `${jdFiles.length} Documents` : 'JD'} & Auto-Fill Form`}
                      </button>

                      {/* AI Extraction Feedback Banner */}
                      {jdSummaryMsg && (
                        <div
                          className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                            jdSummaryMsg.type === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-red-50 border-red-200 text-red-800'
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
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-medium placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
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
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          >
                            <option value="GENERAL">💼 General (&lt; 7 LPA)</option>
                            <option value="DREAM">★ Dream (≥ 7 LPA)</option>
                            <option value="INTERNSHIP">⏳ Internship / Stipend</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-200 mb-1">
                            Package CTC (in LPA)
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
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-semibold font-mono placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                          />
                        </div>
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
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                              className="w-20 border border-neutral-700 rounded-md px-2 py-1 bg-[#18181b] text-white text-black text-xs font-mono font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            />
                          </div>
                        )}
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
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                      </div>

                      {/* Company Required Excel Sheet Format */}
                      <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
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
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-300 bg-[#18181b] text-white hover:bg-gray-100 border border-neutral-700 transition"
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
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-red-50 text-red-800 border border-red-200'
                            }`}
                          >
                            {templateUploadMsg.type === 'success' ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                            )}
                            <span>{templateUploadMsg.text}</span>
                          </div>
                        )}

                        {companyFormatColumns.length === 0 ? (
                          <div className="py-3 px-4 text-center border border-dashed border-neutral-700 rounded-lg text-xs text-neutral-400 bg-[#18181b] text-white">
                            No custom company columns specified. You can upload the company&apos;s template (.xlsx) or click &quot;Add Column&quot; to configure required headers. If none specified, standard canonical columns will be used.
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-neutral-800 rounded-lg bg-[#18181b] text-white">
                            <table className="w-full text-xs divide-y divide-neutral-800">
                              <thead className="bg-gray-100 text-neutral-300 font-semibold text-left">
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
                      </div>

                      {/* Broadcast Email Option */}
                      <div className="p-3 bg-neutral-900/70 rounded-lg border border-indigo-100 flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id="drive-notify-email"
                          checked={driveNotifyEligible}
                          onChange={(e) => setDriveNotifyEligible(e.target.checked)}
                          className="rounded border-neutral-700 text-white focus:ring-indigo-500 h-4 w-4 mt-0.5"
                        />
                        <label
                          htmlFor="drive-notify-email"
                          className="cursor-pointer text-xs text-indigo-950 leading-relaxed font-medium"
                        >
                          <strong>Broadcast invitation email to all eligible students:</strong> Automatically filters students by branch, CGPA, and supply criteria and sends them the application sheet link.
                        </label>
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
                        className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 transition shadow-sm"
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
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Building className="h-5 w-5 text-white" />
                        <h3 className="text-sm font-bold text-white">
                          Published Recruitment Drives
                        </h3>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-0.5 bg-gray-100 text-neutral-300 rounded-full">
                        {drivesList.length} Listed
                      </span>
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
                        {drivesList.map((d) => (
                          <div
                            key={d.id}
                            className="p-4 rounded-xl border border-neutral-800 bg-neutral-900/60/60 hover:bg-[#18181b] text-white hover:border-indigo-300 transition shadow-2xs space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-bold text-white text-sm">{d.company}</h4>
                                {d.role && <p className="text-xs text-neutral-400">{d.role}</p>}
                              </div>
                              {d.packageCategory === 'DREAM' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  ★ Dream
                                </span>
                              ) : d.packageCategory === 'INTERNSHIP' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
                                  ⏳ Internship
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                                  💼 General
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400 bg-[#18181b] text-white p-2.5 rounded-lg border border-gray-100">
                              <div>
                                <span className="text-gray-400 block">Package:</span>
                                <span className="font-bold text-emerald-700 font-mono">
                                  {d.ctcLpa !== null ? `${d.ctcLpa} LPA` : 'As per policy'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400 block">Min CGPA:</span>
                                <span className="font-semibold text-white">
                                  {d.minCgpa > 0 ? d.minCgpa : 'None'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400 block">Backlogs / Supply:</span>
                                <span className={`font-semibold ${d.allowBacklogs ? 'text-amber-700' : 'text-emerald-700'}`}>
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

                            {/* Action Buttons */}
                            <div className="pt-2 border-t border-neutral-800 flex flex-wrap items-center gap-2">
                              <Link
                                href={`/drives/${d.id}`}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-2xs"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Open Application Sheet
                              </Link>

                              <button
                                type="button"
                                onClick={() => {
                                  setBatchFieldModalDriveId(d.id);
                                  setBatchFieldMsg(null);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-300 bg-gray-100 hover:bg-gray-200 border border-neutral-700 transition"
                              >
                                <Plus className="h-3.5 w-3.5 text-white" />
                                Add Batch Field
                              </button>

                              <button
                                type="button"
                                onClick={() => handleNotifyDrive(d.id)}
                                disabled={isNotifyingDriveId === d.id}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-neutral-900 hover:bg-indigo-100 border border-indigo-200 transition"
                              >
                                <Mail className={`h-3.5 w-3.5 ${isNotifyingDriveId === d.id ? 'animate-spin' : ''}`} />
                                {isNotifyingDriveId === d.id ? 'Sending...' : 'Broadcast Email'}
                              </button>

                              <a
                                href={`http://localhost:4000/api/drives/${d.id}/export`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-300 bg-[#18181b] text-white hover:bg-neutral-900/60 border border-neutral-800 transition"
                                title="Download standard report with consolidated candidates and branch funnel"
                              >
                                <Download className="h-3.5 w-3.5 text-neutral-400" />
                                Export Excel
                              </a>

                              <a
                                href={`http://localhost:4000/api/drives/${d.id}/export?format=company`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                                title="Download candidates formatted exactly according to the company's required Excel schema"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                                Company Format (.xlsx)
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Email Notification Broadcast Modal */}
              {notificationModalData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
                  <div className="bg-[#18181b] text-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-neutral-800">
                    <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-linear-to-r from-indigo-50 via-white to-indigo-50/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 text-white rounded-xl">
                          <Mail className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white">
                            Broadcast Announcement Email Delivered
                          </h3>
                          <p className="text-xs text-neutral-400">
                            {notificationModalData.driveTitle}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotificationModalData(null)}
                        className="text-gray-400 hover:text-neutral-400 p-1 rounded-md"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4 text-xs">
                      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-emerald-900 flex items-center justify-between">
                        <div>
                          <span className="font-bold block text-sm">
                            {notificationModalData.sentCount} Invitations Dispatched
                          </span>
                          <span className="text-xs text-emerald-700">
                            Delivered to all {notificationModalData.totalEligible} eligible students matching the drive criteria.
                          </span>
                        </div>
                        <span className="font-mono text-xs font-bold px-2.5 py-1 bg-emerald-200/60 text-emerald-800 rounded-lg">
                          100% Success
                        </span>
                      </div>

                      <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800">
                        <span className="text-neutral-400 block font-medium">Application Sheet Link Sent in Email:</span>
                        <a
                          href={`http://localhost:3000/drives/${notificationModalData.driveId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white font-mono font-bold hover:underline mt-1 block truncate"
                        >
                          http://localhost:3000/drives/{notificationModalData.driveId}
                        </a>
                      </div>

                      <div>
                        <h4 className="font-bold text-white mb-2">
                          Notified Eligible Candidates ({notificationModalData.recipients.length}):
                        </h4>
                        <div className="max-h-60 overflow-y-auto border border-neutral-800 rounded-lg">
                          <table className="min-w-full divide-y divide-neutral-800 text-xs">
                            <thead className="bg-neutral-900/60 text-neutral-400 font-semibold sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left">Student Name</th>
                                <th className="px-3 py-2 text-left">Roll Number</th>
                                <th className="px-3 py-2 text-left">Branch</th>
                                <th className="px-3 py-2 text-left">CGPA</th>
                                <th className="px-3 py-2 text-left">Email Address</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800 bg-[#101012]">
                              {notificationModalData.recipients.map((r) => (
                                <tr key={r.studentId} className="hover:bg-neutral-900/60">
                                  <td className="px-3 py-2 font-medium text-white">{r.name}</td>
                                  <td className="px-3 py-2 font-mono text-neutral-400">{r.studentId}</td>
                                  <td className="px-3 py-2 font-bold text-white">{r.branch}</td>
                                  <td className="px-3 py-2 font-bold text-emerald-700">{r.cgpa.toFixed(2)}</td>
                                  <td className="px-3 py-2 font-mono text-neutral-400">{r.email}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setNotificationModalData(null)}
                          className="px-5 py-2 bg-[#18181b] text-white hover:bg-neutral-200 text-black font-bold font-semibold rounded-lg text-xs transition"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                          className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-mono font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                        <p className="mt-1 text-[11px] text-gray-400">Unique identifier used as the spreadsheet column key.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-200 mb-1">Input Type</label>
                          <select
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value as 'text' | 'number' | 'dropdown')}
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                            className="w-full border border-neutral-700 rounded-lg px-3 py-2 bg-[#18181b] text-white text-black text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
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
                          className="px-5 py-2 bg-[#18181b] text-white text-black font-bold rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:bg-gray-300 shadow-sm"
                        >
                          {isSubmittingField ? 'Adding Column...' : 'Add Column to Sheet'}
                        </button>
                      </div>
                    </form>
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
                  <h2 className="text-xl font-bold text-gray-950 flex items-center gap-2">
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
                  <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-4">
                      <div>
                        <div className="text-xs text-neutral-500 font-medium">Current Active Template</div>
                        <div className="text-sm font-bold text-neutral-900 flex items-center gap-2 mt-0.5">
                          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
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
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 rounded-lg text-xs font-semibold text-neutral-700 bg-[#18181b] text-white hover:bg-neutral-100 transition shadow-2xs"
                        >
                          <Download className="h-3.5 w-3.5 text-neutral-500" />
                          <span>Download Template</span>
                        </a>
                        <button
                          type="button"
                          onClick={handleDeleteRefTemplate}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-xs font-semibold text-red-600 bg-[#18181b] text-white hover:bg-red-50 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Reset Template</span>
                        </button>
                      </div>
                    </div>

                    {statsTemplateStatus.sheetNames && statsTemplateStatus.sheetNames.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-neutral-700 block mb-2">
                          Detected Worksheets in Reference:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {statsTemplateStatus.sheetNames.map((sheet, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 rounded-md text-xs font-mono bg-[#18181b] text-white border border-neutral-200 text-neutral-800 shadow-2xs"
                            >
                              📄 {sheet}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Replace Form */}
                    <div className="pt-2 border-t border-neutral-200">
                      <details className="text-xs text-neutral-600">
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
                        <span className="text-xl font-extrabold text-gray-950 mt-1 block">
                          {liveStatsSummary.totalStudents}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                        <span className="text-[11px] font-semibold text-emerald-700 block uppercase">Placed Students</span>
                        <span className="text-xl font-extrabold text-emerald-900 mt-1 block">
                          {liveStatsSummary.totalPlaced}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-neutral-900 border border-indigo-200">
                        <span className="text-[11px] font-semibold text-white block uppercase">Placement %</span>
                        <span className="text-xl font-extrabold text-indigo-900 mt-1 block">
                          {liveStatsSummary.placementRate}%
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                        <span className="text-[11px] font-semibold text-neutral-400 block uppercase">Average Package</span>
                        <span className="text-xl font-extrabold text-gray-950 mt-1 block">
                          {liveStatsSummary.averagePackage ? `${liveStatsSummary.averagePackage} LPA` : 'N/A'}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <span className="text-[11px] font-semibold text-amber-700 block uppercase">Highest Package</span>
                        <span className="text-xl font-extrabold text-amber-900 mt-1 block">
                          {liveStatsSummary.highestPackage ? `${liveStatsSummary.highestPackage} LPA` : 'N/A'}
                        </span>
                      </div>

                      <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                        <span className="text-[11px] font-semibold text-purple-700 block uppercase">Active Drives</span>
                        <span className="text-xl font-extrabold text-purple-900 mt-1 block">
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
      </div>
    </RequireAuth>
  );
}

