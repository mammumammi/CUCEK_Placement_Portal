'use client';

/**
 * @fileoverview Student Portal Dashboard (Modern 2026 Black & White GSAP Theme).
 * Displays:
 * 1. Live academic profile & semester breakdown.
 * 2. Data recorrection request modal (submitted to branch coordinator).
 * 3. Real-time status tracking of submitted correction requests.
 * 4. Active placement drives & simulated excel spreadsheet links.
 * 5. First-time profile setup modal.
 *
 * @module app/student/page
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import {
  LogOut,
  User,
  GraduationCap,
  Edit3,
  CheckCircle,
  AlertTriangle,
  Clock,
  X,
  RefreshCw,
  Award,
  BookOpen,
  Send,
  Sparkles,
  Building2,
  ExternalLink,
  Briefcase,
  FileText,
  ArrowRight,
  ShieldCheck,
  LayoutDashboard,
  Layers,
  Code2,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { RequireAuth } from '@/components/auth/require-auth';
import {
  getMyProfile,
  completeMyProfile,
  createCorrectionRequest,
  listCorrectionRequests,
  type StudentProfileData,
  type CorrectionRequestData,
} from '@/services/profiles.service';
import { listDrives, type DriveItem } from '@/services/drives.service';

export default function StudentPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [requests, setRequests] = useState<CorrectionRequestData[]>([]);
  const [drives, setDrives] = useState<DriveItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'drives' | 'semesters' | 'requests'>('profile');

  // Correction Request Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Initial First-Login Profile Setup Modal State
  const [isSetupModalOpen, setIsSetupModalOpen] = useState<boolean>(false);
  const [isSubmittingSetup, setIsSubmittingSetup] = useState<boolean>(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupName, setSetupName] = useState<string>('');
  const [setupRegistrationNumber, setSetupRegistrationNumber] = useState<string>('');
  const [setupBranch, setSetupBranch] = useState<string>('');
  const [setupBatch, setSetupBatch] = useState<string>('');
  const [setupDob, setSetupDob] = useState<string>('');
  const [setupEmail, setSetupEmail] = useState<string>('');
  const [setupPhone, setSetupPhone] = useState<string>('');
  const [setupMarksheetUrl, setSetupMarksheetUrl] = useState<string>('');

  // Correction Form Fields
  const [newName, setNewName] = useState<string>('');
  const [newRegistrationNumber, setNewRegistrationNumber] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPhone, setNewPhone] = useState<string>('');
  const [newBacklogs, setNewBacklogs] = useState<string>('');
  const [semesterSgpa, setSemesterSgpa] = useState<Record<number, string>>({});
  const [reason, setReason] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [profileData, requestsData, drivesData] = await Promise.all([
        getMyProfile(),
        listCorrectionRequests(),
        listDrives().catch(() => []),
      ]);
      setProfile(profileData);
      setRequests(requestsData);
      setDrives(drivesData);

      // Pre-populate correction fields from existing profile
      if (profileData) {
        setNewName(profileData.name || '');
        setNewRegistrationNumber(profileData.registrationNumber || '');
        setNewEmail(profileData.email || '');
        setNewPhone(profileData.phone || '');
        setNewBacklogs(String(profileData.activeBacklogs || 0));

        // If profile is incomplete, prompt initial setup modal
        if (!profileData.isProfileComplete) {
          setSetupName(profileData.name || '');
          setSetupRegistrationNumber(profileData.registrationNumber || '');
          setSetupBranch(profileData.branch || '');
          setSetupBatch(profileData.batch || '');
          setSetupDob(profileData.dob || '');
          setSetupEmail(profileData.email || '');
          setSetupPhone(profileData.phone || '');
          setSetupMarksheetUrl(profileData.marksheetUrl || '');
          setIsSetupModalOpen(true);
        }
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
        'Failed to load student profile';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // GSAP animation
  useEffect(() => {
    if (!isLoading && containerRef.current) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          '.gsap-student-card',
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: 'power2.out' }
        );
      }, containerRef);
      return () => ctx.revert();
    }
  }, [isLoading]);

  const handleSubmitSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);
    setIsSubmittingSetup(true);

    if (!setupName.trim()) {
      setSetupError('Full Name is required.');
      setIsSubmittingSetup(false);
      return;
    }
    if (!setupEmail.trim()) {
      setSetupError('Email is required.');
      setIsSubmittingSetup(false);
      return;
    }
    if (!/^\d{10}$/.test(setupPhone.trim())) {
      setSetupError('Phone must be a valid 10-digit number.');
      setIsSubmittingSetup(false);
      return;
    }
    if (!setupBatch.trim()) {
      setSetupError('Batch year is required.');
      setIsSubmittingSetup(false);
      return;
    }

    try {
      const updated = await completeMyProfile({
        name: setupName.trim(),
        registrationNumber: setupRegistrationNumber.trim() || undefined,
        email: setupEmail.trim(),
        phone: setupPhone.trim(),
        batch: setupBatch.trim(),
        branch: setupBranch.trim(),
        dob: setupDob.trim() || undefined,
        marksheetUrl: setupMarksheetUrl.trim() || undefined,
      });
      setProfile(updated);
      setIsSetupModalOpen(false);
      setSuccessMsg('Your profile has been completed successfully! Welcome to the Placement Portal.');
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.error?.message ||
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Failed to save profile';
      setSetupError(message);
    } finally {
      setIsSubmittingSetup(false);
    }
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setModalError('Please provide a reason explaining the requested change.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const requestedChanges: Record<string, unknown> = {};

      if (newName.trim() && newName.trim() !== (profile?.name || '')) {
        requestedChanges.name = newName.trim();
      }
      if (newRegistrationNumber.trim() && newRegistrationNumber.trim() !== (profile?.registrationNumber || '')) {
        requestedChanges.registrationNumber = newRegistrationNumber.trim();
      }
      if (newEmail.trim() && newEmail.trim() !== (profile?.email || '')) {
        requestedChanges.email = newEmail.trim();
      }
      if (newPhone.trim() && newPhone.trim() !== (profile?.phone || '')) {
        requestedChanges.phone = newPhone.trim();
      }
      if (newBacklogs.trim() && Number(newBacklogs) !== profile?.activeBacklogs) {
        requestedChanges.activeBacklogs = Number(newBacklogs);
      }

      // Check semester SGPAs
      for (let sem = 1; sem <= 8; sem++) {
        const val = semesterSgpa[sem];
        if (val !== undefined && val !== '') {
          const num = parseFloat(val);
          const oldSem = profile?.semesters?.find((s) => s.semester === sem);
          if (oldSem && num !== oldSem.sgpa) {
            requestedChanges[`s${sem}Sgpa`] = num;
          }
        }
      }

      if (Object.keys(requestedChanges).length === 0) {
        setModalError('Please modify at least one field to request a correction.');
        setIsSubmitting(false);
        return;
      }

      await createCorrectionRequest({
        requestedChanges,
        reason: reason.trim(),
      });

      setIsModalOpen(false);
      setReason('');
      setSuccessMsg('Your correction request has been sent to your Branch Coordinator for review.');
      await loadData();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.error?.message ||
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Failed to submit correction request';
      setModalError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RequireAuth roles={['STUDENT']}>
      <div
        ref={containerRef}
        className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-white selection:text-black flex"
      >
        {/* ========================================================= */}
        {/* LEFT SIDEBAR NAVIGATION (Modern 2026 Layout)               */}
        {/* ========================================================= */}
        <aside className="w-64 border-r border-neutral-800/80 bg-[#0c0c0e] flex-col justify-between p-6 shrink-0 hidden lg:flex sticky top-0 h-screen z-40">
          <div className="space-y-8">
            {/* Student Avatar & Identity */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-white font-mono font-bold text-sm shadow-inner">
                  {profile?.studentId ? profile.studentId.slice(-4) : 'STU'}
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-[#0c0c0e] animate-pulse" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-white tracking-tight truncate leading-none">
                  {profile?.name || user?.username || 'Student'}
                </h2>
                <p className="text-[11px] text-neutral-400 font-mono mt-1 truncate">
                  {profile?.studentId || 'Candidate'}
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="space-y-1.5">
              {[
                { id: 'profile', label: 'Academic Profile', icon: GraduationCap },
                { id: 'drives', label: 'Active Placement Drives', icon: Briefcase },
                { id: 'semesters', label: 'Semester Results', icon: Award },
                { id: 'requests', label: 'Correction History', icon: Clock },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id as 'profile' | 'drives' | 'semesters' | 'requests');
                      const el = document.getElementById(item.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
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

          {/* Bottom Actions & Outbound Links */}
          <div className="space-y-4 pt-6 border-t border-neutral-800/80">
            <div className="p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] font-bold text-white">Student Portal Active</span>
              </div>
              <p className="text-[10px] text-neutral-400">
                Department: {profile?.branch || 'General'} &bull; Batch: {profile?.batch || '2026'}
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
        {/* MAIN CONTENT AREA                                         */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header Navbar */}
          <header className="h-16 border-b border-neutral-800/80 bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-xs font-medium text-neutral-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Student Dashboard &bull; {profile?.branch || 'Stream'}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-white transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh Data</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-bold transition shadow-xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Request Correction</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition lg:hidden"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Main Scrollable Body */}
          <main className="p-4 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto space-y-10 flex-1">
            {/* Alert Messages */}
            {error && (
              <div
                role="alert"
                className="rounded-2xl bg-red-950/40 p-4 border border-red-800/60 flex items-start gap-3 text-xs text-red-300"
              >
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="font-medium">{error}</div>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="rounded-2xl bg-emerald-950/40 p-4 border border-emerald-800/60 flex items-start gap-3 text-xs text-emerald-300"
              >
                <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="font-medium">{successMsg}</div>
              </div>
            )}

            {/* Incomplete Profile Setup Banner */}
            {profile && !profile.isProfileComplete && (
              <div className="gsap-student-card rounded-3xl bg-[#141417] p-6 border border-amber-600/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Initial Profile Setup Required
                    </h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Your coordinator created your account via roll number. Please complete your official email and contact details to enable direct drive applications.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSetupError(null);
                    setIsSetupModalOpen(true);
                  }}
                  className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-black bg-white hover:bg-neutral-200 transition shadow-sm"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Complete Profile Now</span>
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="bg-[#101012] border border-neutral-800 rounded-3xl p-16 text-center text-xs text-neutral-400 space-y-3">
                <RefreshCw className="h-7 w-7 animate-spin mx-auto text-white mb-2" />
                <p className="font-semibold text-white">Loading your academic profile...</p>
                <p className="text-neutral-500">Retrieving official semester scores, credits, and active drives</p>
              </div>
            ) : profile ? (
              <div className="space-y-10">
                {/* ========================================================= */}
                {/* 1. ACADEMIC PROFILE & KPI HERO CARD                       */}
                {/* ========================================================= */}
                <section id="profile" className="gsap-student-card space-y-4">
                  <div className="bg-[#101012] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
                    {/* Header Banner */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-800">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-white font-mono font-bold text-xl shadow-inner">
                          {profile.studentId.slice(-3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl sm:text-2xl font-black text-white">
                              {profile.name || 'Candidate Name'}
                            </h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
                              {profile.branch}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 font-mono mt-1">
                            Roll No: <strong className="text-white">{profile.studentId}</strong>
                            {profile.registrationNumber ? (
                              <> &bull; Reg No: <strong className="text-white">{profile.registrationNumber}</strong></>
                            ) : null}
                            {' '}&bull; Batch: <strong className="text-white">{profile.batch}</strong>
                          </p>
                        </div>
                      </div>

                      {/* Top Metric Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 self-stretch md:self-auto">
                        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-2xl text-center">
                          <span className="text-[10px] text-neutral-400 block font-medium">Cumulative CGPA</span>
                          <span className="text-2xl font-black text-white font-mono mt-0.5 block">
                            {profile.cgpa.toFixed(2)}
                          </span>
                        </div>

                        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-2xl text-center">
                          <span className="text-[10px] text-neutral-400 block font-medium">Percentage</span>
                          <span className="text-2xl font-black text-zinc-300 font-mono mt-0.5 block">
                            {typeof profile.percentage === 'number'
                              ? `${profile.percentage.toFixed(1)}%`
                              : profile.cgpa > 0
                              ? `${(profile.cgpa * 9.5).toFixed(1)}%`
                              : '—'}
                          </span>
                        </div>

                        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-2xl text-center">
                          <span className="text-[10px] text-neutral-400 block font-medium">Total Credits</span>
                          <span className="text-2xl font-black text-white font-mono mt-0.5 block">
                            {profile.semesters && profile.semesters.length > 0
                              ? profile.semesters.reduce((acc, s) => acc + (s.credits || 0), 0)
                              : '—'}
                          </span>
                        </div>

                        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-2xl text-center">
                          <span className="text-[10px] text-neutral-400 block font-medium">Active Backlogs</span>
                          <span
                            className={`text-2xl font-black font-mono mt-0.5 block ${
                              profile.activeBacklogs === 0 ? 'text-white' : 'text-red-400'
                            }`}
                          >
                            {profile.activeBacklogs}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Detailed Data Fields Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                      <div className="p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                        <span className="text-[11px] text-neutral-500 block">Registration No</span>
                        <span className="font-mono font-semibold text-white mt-1 block truncate">
                          {profile.registrationNumber || '—'}
                        </span>
                      </div>

                      <div className="p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                        <span className="text-[11px] text-neutral-500 block">Official Email</span>
                        <span className="font-mono font-semibold text-white mt-1 block truncate">
                          {profile.email || '—'}
                        </span>
                      </div>

                      <div className="p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                        <span className="text-[11px] text-neutral-500 block">Contact Phone</span>
                        <span className="font-mono font-semibold text-white mt-1 block">
                          {profile.phone || '—'}
                        </span>
                      </div>

                      <div className="p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                        <span className="text-[11px] text-neutral-500 block">Date of Birth</span>
                        <span className="font-semibold text-white mt-1 block">
                          {profile.dob || '—'}
                        </span>
                      </div>

                      <div className="p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                        <span className="text-[11px] text-neutral-500 block">Department</span>
                        <span className="font-semibold text-white mt-1 block">
                          {profile.branch}
                        </span>
                      </div>

                      <div className="p-3.5 bg-neutral-900/60 border border-neutral-800 rounded-2xl">
                        <span className="text-[11px] text-neutral-500 block">Passing Batch</span>
                        <span className="font-semibold text-white mt-1 block">
                          {profile.batch}
                        </span>
                      </div>
                    </div>

                    {/* Marksheet Link Bar */}
                    {profile.marksheetUrl && (
                      <div className="p-4 bg-neutral-900/80 border border-neutral-800 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-white block font-bold text-xs">Official Academic Marksheet</span>
                          <span className="text-neutral-400 text-[11px]">Drive link uploaded by department coordinator</span>
                        </div>
                        <a
                          href={profile.marksheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-black bg-white hover:bg-neutral-200 transition"
                        >
                          <span>View Official Marksheet</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </section>

                {/* ========================================================= */}
                {/* 2. ACTIVE RECRUITMENT DRIVES SECTION                       */}
                {/* ========================================================= */}
                <section id="drives" className="gsap-student-card space-y-4">
                  <div className="bg-[#101012] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-white" />
                          <span>Active Recruitment Drives</span>
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Open placement opportunities with simulated real-time excel application sheets
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold px-3 py-1 bg-neutral-900 border border-neutral-700 text-neutral-300 rounded-full">
                        {drives.length} Available
                      </span>
                    </div>

                    {drives.length === 0 ? (
                      <p className="text-xs text-neutral-400 text-center py-8">
                        No recruitment drives are currently published for your department.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {drives.map((d) => (
                          <div
                            key={d.id}
                            className="bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition group"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-bold text-white text-base leading-tight">{d.company}</h4>
                                  {d.role && <p className="text-xs text-neutral-400 mt-0.5">{d.role}</p>}
                                </div>
                                {d.packageCategory === 'DREAM' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-black border border-white">
                                    ★ Dream
                                  </span>
                                ) : d.packageCategory === 'INTERNSHIP' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                                    ⏳ Internship
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-white border border-neutral-700">
                                    💼 General
                                  </span>
                                )}
                              </div>

                              <div className="space-y-1.5 text-xs text-neutral-400 font-mono">
                                {d.ctcLpa !== null && (
                                  <div className="flex items-center justify-between">
                                    <span>CTC Package:</span>
                                    <strong className="text-white">{d.ctcLpa} LPA</strong>
                                  </div>
                                )}
                                <div className="flex items-center justify-between">
                                  <span>Cutoff CGPA:</span>
                                  <span className="text-neutral-300">{d.minCgpa > 0 ? d.minCgpa : 'None'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Backlogs Allowed:</span>
                                  <span className={d.allowBacklogs ? 'text-amber-300' : 'text-emerald-400'}>
                                    {d.allowBacklogs ? 'Yes' : 'No'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span>Deadline:</span>
                                  <span className="text-neutral-300">{new Date(d.deadline).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 pt-1">
                              <Link
                                href={`/drives/${d.id}`}
                                className="inline-flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 transition shadow-xs"
                              >
                                <span>Open Simulated Sheet</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Link>
                              <Link
                                href={`/drives/${d.id}/mock-oa`}
                                className="inline-flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 hover:border-neutral-500 transition"
                              >
                                <Code2 className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Practice Past Years OA</span>
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* ========================================================= */}
                {/* 3. SEMESTER BREAKDOWN RESULTS TABLE                       */}
                {/* ========================================================= */}
                <section id="semesters" className="gsap-student-card space-y-4">
                  <div className="bg-[#101012] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Award className="h-4 w-4 text-white" />
                          <span>Semester Results &amp; Credit Breakdown</span>
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Verified semester-by-semester SGPA records and academic credit weighting
                        </p>
                      </div>
                      <span className="text-xs text-neutral-400 font-mono">
                        {profile.semesters?.length || 0} Semesters Recorded
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Semester</th>
                            <th className="py-3 px-4">Credits Earned</th>
                            <th className="py-3 px-4">SGPA</th>
                            <th className="py-3 px-4">Percentage</th>
                            <th className="py-3 px-4">Credit Points</th>
                            <th className="py-3 px-4 text-right">Marksheet</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/60 font-mono">
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((semNum) => {
                            const reached = semNum <= (profile.currentSemester ?? 8);
                            const s = profile.semesters?.find((item) => item.semester === semNum);

                            if (!reached) {
                              return (
                                <tr key={semNum} className="opacity-60 bg-neutral-950/40">
                                  <td className="py-3 px-4 font-bold text-neutral-400">
                                    Semester {semNum}
                                  </td>
                                  <td className="py-3 px-4 text-neutral-600">—</td>
                                  <td className="py-3 px-4 text-neutral-600">—</td>
                                  <td className="py-3 px-4 text-neutral-600">—</td>
                                  <td className="py-3 px-4 text-neutral-600">—</td>
                                  <td className="py-3 px-4 text-right">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-900 text-neutral-400 border border-neutral-800">
                                      ⏳ Yet to reach (Junior Batch)
                                    </span>
                                  </td>
                                </tr>
                              );
                            }

                            if (s) {
                              return (
                                <tr key={semNum} className="hover:bg-neutral-900/50 transition">
                                  <td className="py-3 px-4 font-bold text-white">
                                    Semester {s.semester}
                                  </td>
                                  <td className="py-3 px-4 text-neutral-300">
                                    {s.credits}
                                  </td>
                                  <td className="py-3 px-4 font-bold text-white">
                                    {s.sgpa.toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-neutral-400">
                                    {typeof s.percentage === 'number'
                                      ? `${s.percentage.toFixed(1)}%`
                                      : `${(s.sgpa * 9.5).toFixed(1)}%`}
                                  </td>
                                  <td className="py-3 px-4 text-neutral-400">
                                    {(s.credits * s.sgpa).toFixed(2)}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    {s.marksheetUrl ? (
                                      <a
                                        href={s.marksheetUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition"
                                      >
                                        <span>Link</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    ) : (
                                      <span className="text-neutral-600">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={semNum} className="hover:bg-neutral-900/30 transition text-neutral-500">
                                <td className="py-3 px-4 font-bold text-neutral-300">
                                  Semester {semNum}
                                </td>
                                <td className="py-3 px-4 text-neutral-600">—</td>
                                <td className="py-3 px-4 text-neutral-600">—</td>
                                <td className="py-3 px-4 text-neutral-600">—</td>
                                <td className="py-3 px-4 text-neutral-600">—</td>
                                <td className="py-3 px-4 text-right">
                                  <span className="text-[10px] text-neutral-500 font-mono">Not Uploaded</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                {/* ========================================================= */}
                {/* 4. APPLIED REQUESTS & CORRECTIONS HISTORY                 */}
                {/* ========================================================= */}
                <section id="requests" className="gsap-student-card space-y-4">
                  <div className="bg-[#101012] border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <Clock className="h-4 w-4 text-white" />
                          <span>Applied Requests &amp; Corrections Queue</span>
                        </h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          Real-time status tracking for drive submissions and data recorrections
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold px-3 py-1 bg-neutral-900 border border-neutral-700 text-neutral-300 rounded-full">
                        {requests.length} Total
                      </span>
                    </div>

                    {requests.length === 0 ? (
                      <p className="text-xs text-neutral-400 text-center py-6">
                        You have not submitted any drive applications or profile correction requests yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {requests.map((r) => {
                          const changes = r.requestedChanges as Record<string, unknown>;
                          const isDrive = changes?.type === 'DRIVE_APPLICATION';

                          return (
                            <div
                              key={r.id}
                              className="p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs transition"
                            >
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {isDrive ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-black">
                                      <Briefcase className="h-3 w-3" /> Drive Application
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 border border-neutral-700 text-white">
                                      <FileText className="h-3 w-3" /> Profile Correction
                                    </span>
                                  )}

                                  {r.status === 'PENDING' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
                                      <Clock className="h-3 w-3" /> Under Review
                                    </span>
                                  )}
                                  {r.status === 'APPROVED' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                                      <CheckCircle className="h-3 w-3" /> Verified &amp; Approved
                                    </span>
                                  )}
                                  {r.status === 'REJECTED' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-950/60 text-red-300 border border-red-800/60">
                                      <AlertTriangle className="h-3 w-3" /> Rejected
                                    </span>
                                  )}
                                  <span className="text-neutral-500 font-mono text-[11px]">
                                    {new Date(r.createdAt).toLocaleDateString()}
                                  </span>
                                </div>

                                {isDrive ? (
                                  <div className="pt-1">
                                    <div className="font-bold text-white text-sm">
                                      {String(changes.company || 'Company')} {changes.role ? `- ${String(changes.role)}` : ''}
                                    </div>
                                    <div className="text-xs text-neutral-400 mt-0.5">
                                      Package: <strong className="text-white">{changes.ctcLpa ? `${changes.ctcLpa} LPA` : 'Standard'}</strong> &bull; Status: Candidate application submitted.
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2 pt-1">
                                    {Object.entries(changes).map(([k, v]) => (
                                      <span
                                        key={k}
                                        className="px-2 py-0.5 bg-neutral-900 rounded border border-neutral-700 text-neutral-200 font-mono text-[11px]"
                                      >
                                        {k}: <strong className="text-white">{String(v)}</strong>
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <p className="text-neutral-400 mt-1">
                                  <strong className="text-neutral-300">Reason:</strong> {r.reason}
                                </p>

                                {r.reviewerRemarks && (
                                  <p className="text-neutral-300 bg-neutral-900/90 p-2 rounded-xl border border-neutral-700 mt-1">
                                    <strong className="text-white">Coordinator Feedback:</strong> {r.reviewerRemarks}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              </div>
            ) : null}
          </main>
        </div>

        {/* ========================================================= */}
        {/* MODAL: FIRST-LOGIN PROFILE SETUP                          */}
        {/* ========================================================= */}
        {isSetupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#101012] rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-800 text-white">
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-neutral-900 border border-neutral-700 text-white rounded-xl">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Complete Your Student Profile
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Roll Number: <span className="font-mono text-white font-semibold">{profile?.studentId}</span>
                    </p>
                  </div>
                </div>
                {profile?.isProfileComplete && (
                  <button
                    type="button"
                    onClick={() => setIsSetupModalOpen(false)}
                    className="text-neutral-400 hover:text-white p-1 rounded-md"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmitSetup} className="p-6 space-y-4 text-xs">
                <div className="bg-neutral-900 border border-neutral-800 p-3.5 rounded-xl text-neutral-300 text-xs">
                  👋 <strong>First-Time Verification:</strong> Your coordinator imported your account using your Roll Number. Please confirm your contact details to begin applying for placement drives.
                </div>

                {setupError && (
                  <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 font-medium">
                    {setupError}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-300 mb-1">
                        Full Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={setupName}
                        onChange={(e) => setSetupName(e.target.value)}
                        required
                        className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-300 mb-1">
                        Registration Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. REG-2022-CSE-001"
                        value={setupRegistrationNumber}
                        onChange={(e) => setSetupRegistrationNumber(e.target.value)}
                        className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 font-mono focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-300 mb-1">
                        Department / Branch <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CSE"
                        value={setupBranch}
                        onChange={(e) => setSetupBranch(e.target.value)}
                        required
                        className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-300 mb-1">
                        Batch Year <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2026"
                        value={setupBatch}
                        onChange={(e) => setSetupBatch(e.target.value)}
                        required
                        className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-neutral-300 mb-1">
                        Official Email <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. student@college.edu"
                        value={setupEmail}
                        onChange={(e) => setSetupEmail(e.target.value)}
                        required
                        className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-neutral-300 mb-1">
                        Phone (10 Digits) <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="9876543210"
                        value={setupPhone}
                        onChange={(e) => setSetupPhone(e.target.value.replace(/\D/g, ''))}
                        required
                        className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 font-mono focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 mb-1">
                      Consolidated Marksheet Drive Link
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/..."
                      value={setupMarksheetUrl}
                      onChange={(e) => setSetupMarksheetUrl(e.target.value)}
                      className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 font-mono focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-800 flex items-center justify-end gap-2">
                  {profile?.isProfileComplete && (
                    <button
                      type="button"
                      onClick={() => setIsSetupModalOpen(false)}
                      className="px-4 py-2 border border-neutral-700 rounded-full font-semibold text-neutral-300 hover:text-white transition"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmittingSetup}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full font-bold text-black bg-white hover:bg-neutral-200 disabled:opacity-50 transition shadow-xs"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{isSubmittingSetup ? 'Saving Profile...' : 'Save & Verify Profile'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: REQUEST DATA CORRECTION                            */}
        {/* ========================================================= */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-[#101012] rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-800 text-white">
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Edit3 className="h-5 w-5 text-white" />
                  <h3 className="text-base font-bold text-white">
                    Request Academic Data Correction
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-md"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitCorrection} className="p-6 space-y-4 text-xs">
                <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-xl text-neutral-300">
                  📌 <strong>Review Notice:</strong> Corrections will be routed to your Branch Coordinator for official verification before updating college records.
                </div>

                {modalError && (
                  <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 font-medium">
                    {modalError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-neutral-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={newRegistrationNumber}
                      onChange={(e) => setNewRegistrationNumber(e.target.value)}
                      className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-neutral-300 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-neutral-300 mb-1">
                      Active Backlogs Count
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newBacklogs}
                      onChange={(e) => setNewBacklogs(e.target.value)}
                      className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                    />
                  </div>
                </div>

                {/* Semester SGPAs */}
                <div>
                  <label className="block font-semibold text-neutral-300 mb-1">
                    Semester SGPA Updates (Optional)
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                      <div key={sem}>
                        <span className="block text-[11px] text-neutral-400 font-mono mb-0.5 text-center">
                          Sem {sem}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          placeholder="SGPA"
                          value={semesterSgpa[sem] || ''}
                          onChange={(e) =>
                            setSemesterSgpa((prev) => ({ ...prev, [sem]: e.target.value }))
                          }
                          className="w-full bg-[#18181b] border border-neutral-700 rounded-xl px-2 py-1.5 text-center font-mono text-xs text-white focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="block font-semibold text-neutral-300 mb-1">
                    Reason for Correction Request <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide details explaining the change..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full bg-[#18181b] border border-neutral-700 rounded-xl p-2.5 text-xs text-white focus:outline-hidden focus:border-white focus:ring-1 focus:ring-white"
                    required
                  />
                </div>

                <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-neutral-700 rounded-full font-semibold text-neutral-300 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full font-bold text-black bg-white hover:bg-neutral-200 disabled:opacity-50 transition shadow-xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{isSubmitting ? 'Submitting...' : 'Send to Coordinator'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RequireAuth>
  );
}
