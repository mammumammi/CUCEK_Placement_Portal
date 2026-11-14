'use client';

/**
 * @fileoverview Student Portal Dashboard.
 * Displays:
 * 1. Live academic profile & semester breakdown.
 * 2. Data recorrection request modal (submitted to branch coordinator).
 * 3. Real-time status tracking of submitted correction requests.
 *
 * @module app/student/page
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

      // Pre-fill setup modal if profile is incomplete
      if (profileData && !profileData.isProfileComplete) {
        setSetupName(profileData.name || '');
        setSetupRegistrationNumber(profileData.registrationNumber || '');
        setSetupBranch(profileData.branch || user?.branch || 'CSE');
        setSetupBatch(profileData.batch || '2026');
        setSetupDob(profileData.dob || '');
        setSetupEmail(profileData.email || '');
        setSetupPhone(profileData.phone || '');
        setSetupMarksheetUrl(profileData.marksheetUrl || '');
        setIsSetupModalOpen(true);
      }

      // Pre-fill form initial values
      setNewName(profileData.name || '');
      setNewRegistrationNumber(profileData.registrationNumber || '');
      setNewEmail(profileData.email || '');
      setNewPhone(profileData.phone || '');
      setNewBacklogs(String(profileData.activeBacklogs ?? 0));
      const sMap: Record<number, string> = {};
      profileData.semesters?.forEach((s) => {
        sMap[s.semester] = String(s.sgpa);
      });
      setSemesterSgpa(sMap);
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
      for (let sem = 1; sem <= 6; sem++) {
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Navbar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  Placement Portal
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Student Dashboard
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
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-8">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Academic Profile & Verification
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Review your official college records. If any details are inaccurate, submit a correction request to your Branch Coordinator.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition shadow-2xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Request Data Correction
              </button>
            </div>
          </div>

          {/* Alert Messages */}
          {error && (
            <div
              role="alert"
              className="rounded-lg bg-red-50 p-4 border border-red-200 flex items-start gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm font-medium text-red-800">{error}</div>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="rounded-lg bg-emerald-50 p-4 border border-emerald-200 flex items-start gap-3"
            >
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-sm font-medium text-emerald-800">{successMsg}</div>
            </div>
          )}

          {/* Action Required: Incomplete Profile Banner */}
          {profile && !profile.isProfileComplete && (
            <div className="rounded-xl bg-amber-50 p-5 border border-amber-300 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    Initial Profile Completion Required
                  </h4>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Your coordinator created your account using your Roll Number. Please complete your essential contact and student details before applying to placement drives.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSetupError(null);
                  setIsSetupModalOpen(true);
                }}
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 transition shadow-2xs"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Complete Profile Now
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-12 text-center text-sm text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-600 mb-2" />
              Loading your academic records...
            </div>
          ) : profile ? (
            <div className="space-y-8">
              {/* Profile Details Card */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-linear-to-r from-emerald-50/40 via-white to-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700 font-bold text-lg">
                      {profile.studentId.slice(0, 4)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {profile.name || 'Student Name'}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        Roll No: <strong>{profile.studentId}</strong>
                        {profile.registrationNumber ? (
                          <> • Reg No: <strong>{profile.registrationNumber}</strong></>
                        ) : null}
                        {' '}• Department: <strong>{profile.branch}</strong> • Batch: <strong>{profile.batch}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 self-start sm:self-auto">
                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">Overall CGPA</span>
                      <span className="text-2xl font-extrabold text-emerald-700">
                        {profile.cgpa.toFixed(2)}
                      </span>
                    </div>

                    <div className="h-10 w-px bg-gray-200 hidden sm:block" />

                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">Percentage</span>
                      <span className="text-xl font-extrabold text-blue-700">
                        {typeof profile.percentage === 'number'
                          ? `${profile.percentage.toFixed(1)}%`
                          : profile.cgpa > 0
                          ? `${(profile.cgpa * 9.5).toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>

                    <div className="h-10 w-px bg-gray-200 hidden sm:block" />

                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">Total Marks</span>
                      <span className="text-sm font-bold text-gray-800 font-mono">
                        {typeof profile.totalMarks === 'number'
                          ? `${profile.totalMarks}${profile.maxMarks ? ` / ${profile.maxMarks}` : ''}`
                          : '—'}
                      </span>
                    </div>

                    <div className="h-10 w-px bg-gray-200 hidden sm:block" />

                    <div className="text-right">
                      <span className="text-xs text-gray-500 block">Active Backlogs</span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          profile.activeBacklogs === 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {profile.activeBacklogs}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 text-xs">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Registration No</span>
                    <span className="text-gray-900 font-mono font-semibold mt-1 block truncate">
                      {profile.registrationNumber || '—'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Official Email</span>
                    <span className="text-gray-900 font-mono font-semibold mt-1 block truncate">
                      {profile.email || '—'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Contact Phone</span>
                    <span className="text-gray-900 font-semibold mt-1 block">
                      {profile.phone || '—'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Date of Birth</span>
                    <span className="text-gray-900 font-semibold mt-1 block">
                      {profile.dob || '—'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Age</span>
                    <span className="text-gray-900 font-semibold mt-1 block">
                      {profile.age !== null && profile.age !== undefined ? `${profile.age} yrs` : '—'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Department</span>
                    <span className="text-gray-900 font-semibold mt-1 block">
                      {profile.branch || '—'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Passing Batch</span>
                    <span className="text-gray-900 font-semibold mt-1 block">
                      {profile.batch || '—'}
                    </span>
                  </div>

                  {profile.marksheetUrl && (
                    <div className="p-3 bg-blue-50/70 rounded-lg border border-blue-200 col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-7 flex items-center justify-between">
                      <div>
                        <span className="text-blue-800 block font-semibold">Official Marksheet / Academic Transcript</span>
                        <span className="text-blue-600 text-[11px]">Drive link uploaded by department coordinator</span>
                      </div>
                      <a
                        href={profile.marksheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition shadow-2xs"
                      >
                        View Drive Marksheet 📄
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Available Placement Drives Section */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">
                        Available Recruitment Drives
                      </h3>
                      <p className="text-xs text-gray-500">
                        Placement opportunities and company drives open for applications
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full">
                    {drives.length} {drives.length === 1 ? 'Drive' : 'Drives'} Listed
                  </span>
                </div>

                <div className="p-6">
                  {drives.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-6">
                      No recruitment drives are currently published.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {drives.map((d) => (
                        <div
                          key={d.id}
                          className="border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-xs transition bg-gray-50/40 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <h4 className="font-bold text-gray-900 text-sm">{d.company}</h4>
                                {d.role && <p className="text-xs text-gray-600">{d.role}</p>}
                              </div>
                              {d.packageCategory === 'DREAM' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  ★ Dream
                                </span>
                              ) : d.packageCategory === 'INTERNSHIP' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  ⏳ Internship
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  💼 General
                                </span>
                              )}
                            </div>

                            <div className="space-y-1.5 text-xs text-gray-600 my-3">
                              {d.ctcLpa !== null && (
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-500">Package:</span>
                                  <span className="font-bold text-emerald-700 font-mono">
                                    {d.ctcLpa} LPA
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500">Min CGPA:</span>
                                <span className="font-semibold text-gray-900">
                                  {d.minCgpa > 0 ? d.minCgpa : 'None'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500">Supply / Backlogs:</span>
                                <span
                                  className={`font-semibold ${
                                    d.allowBacklogs ? 'text-amber-700' : 'text-emerald-700'
                                  }`}
                                >
                                  {d.allowBacklogs ? 'Allowed' : 'Not Allowed'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500">Deadline:</span>
                                <span className="text-gray-700 font-medium text-[11px]">
                                  {new Date(d.deadline).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            {/* Eligibility Badge */}
                            <div className="pt-2 border-t border-gray-200 mb-3">
                              {d.eligible === false ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                                  <AlertTriangle className="h-3 w-3" /> Not Eligible
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                  <CheckCircle className="h-3 w-3" /> Eligible to Apply
                                </span>
                              )}
                            </div>
                          </div>

                          <Link
                            href={`/drives/${d.id}`}
                            className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-2xs mt-2"
                          >
                            <span>Open Application Sheet</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Semester Breakdown Table */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-base font-semibold text-gray-900">
                      Semester Results & Credit Breakdown
                    </h3>
                  </div>
                  <span className="text-xs text-gray-500">
                    Total Semesters: {profile.semesters?.length || 0}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 font-semibold text-gray-600">
                      <tr>
                        <th className="px-4 py-3 text-left">Semester</th>
                        <th className="px-4 py-3 text-left">Credits Earned</th>
                        <th className="px-4 py-3 text-left">SGPA</th>
                        <th className="px-4 py-3 text-left">Percentage</th>
                        <th className="px-4 py-3 text-left">Credit Points</th>
                        <th className="px-4 py-3 text-left">Marksheet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {profile.semesters && profile.semesters.length > 0 ? (
                        profile.semesters.map((s) => (
                          <tr key={s.semester} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold text-gray-900">
                              Semester {s.semester}
                            </td>
                            <td className="px-4 py-3 text-gray-700 font-medium">
                              {s.credits}
                            </td>
                            <td className="px-4 py-3 font-bold text-emerald-700">
                              {s.sgpa.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 font-bold text-blue-700">
                              {typeof s.percentage === 'number'
                                ? `${s.percentage.toFixed(1)}%`
                                : `${(s.sgpa * 9.5).toFixed(1)}%`}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-600">
                              {(s.credits * s.sgpa).toFixed(2)}
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
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                            No individual semester records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Correction Requests History */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-emerald-600" />
                    <h3 className="text-base font-semibold text-gray-900">
                      Correction Requests History
                    </h3>
                  </div>
                  <span className="text-xs text-gray-500">
                    {requests.length} Request{requests.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="p-6">
                  {requests.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">
                      You haven’t submitted any profile correction requests yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {requests.map((r) => (
                        <div
                          key={r.id}
                          className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {r.status === 'PENDING' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800">
                                  <Clock className="h-3 w-3" /> Under Review
                                </span>
                              )}
                              {r.status === 'APPROVED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800">
                                  <CheckCircle className="h-3 w-3" /> Approved & Updated
                                </span>
                              )}
                              {r.status === 'REJECTED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-800">
                                  <AlertTriangle className="h-3 w-3" /> Rejected
                                </span>
                              )}
                              <span className="text-gray-400">
                                {new Date(r.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-1">
                              {Object.entries(r.requestedChanges).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="px-2 py-0.5 bg-white rounded border border-gray-200 text-gray-800 font-mono font-medium"
                                >
                                  {k}: <strong>{String(v)}</strong>
                                </span>
                              ))}
                            </div>

                            <p className="text-gray-600 mt-1">
                              <strong>Reason:</strong> {r.reason}
                            </p>

                            {r.reviewerRemarks && (
                              <p className="text-blue-700 bg-blue-50/80 p-2 rounded border border-blue-100 mt-1">
                                <strong>Coordinator Feedback:</strong> {r.reviewerRemarks}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </main>

        {/* Modal: First-Login Profile Completion */}
        {isSetupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-linear-to-r from-amber-50/80 via-white to-amber-50/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      Complete Your Student Profile
                    </h3>
                    <p className="text-xs text-gray-500">
                      Roll Number: <span className="font-mono font-semibold text-gray-900">{profile?.studentId}</span>
                    </p>
                  </div>
                </div>
                {profile?.isProfileComplete && (
                  <button
                    type="button"
                    onClick={() => setIsSetupModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmitSetup} className="p-6 space-y-4 text-xs">
                <div className="bg-blue-50/80 border border-blue-200 p-3 rounded-lg text-blue-900 text-xs">
                  <p className="font-medium">
                    👋 <strong>First-Time Setup:</strong> Your placement coordinator initialized your account using your Roll Number. Please fill in your official details to complete your placement profile.
                  </p>
                </div>

                {setupError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 font-medium">
                    {setupError}
                  </div>
                )}

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={setupName}
                        onChange={(e) => setSetupName(e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Registration Number (University Reg No)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. REG-2022-CSE-001"
                        value={setupRegistrationNumber}
                        onChange={(e) => setSetupRegistrationNumber(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Department / Branch <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CSE"
                        value={setupBranch}
                        onChange={(e) => setSetupBranch(e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Batch Year <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 2026 or 2022-2026"
                        value={setupBatch}
                        onChange={(e) => setSetupBatch(e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Official Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. rahul@college.edu"
                        value={setupEmail}
                        onChange={(e) => setSetupEmail(e.target.value)}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">
                        Contact Phone (10 Digits) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="e.g. 9876543210"
                        value={setupPhone}
                        onChange={(e) => setSetupPhone(e.target.value.replace(/\D/g, ''))}
                        required
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Date of Birth (DOB) <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="date"
                      value={setupDob}
                      onChange={(e) => setSetupDob(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Consolidated Marksheet Drive Link <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/..."
                      value={setupMarksheetUrl}
                      onChange={(e) => setSetupMarksheetUrl(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-xs font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-2">
                  {profile?.isProfileComplete && (
                    <button
                      type="button"
                      onClick={() => setIsSetupModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmittingSetup}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 transition shadow-xs"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isSubmittingSetup ? 'Saving Profile...' : 'Save & Complete Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Request Data Correction */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-200">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-emerald-50/30">
                <div className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-base font-bold text-gray-900">
                    Request Academic Data Correction
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitCorrection} className="p-6 space-y-4 text-xs">
                <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-lg text-amber-800">
                  <p className="font-medium">
                    📌 <strong>Coordinator Review Required:</strong> Any changes submitted here will first be reviewed by your Branch Coordinator before updating your official record.
                  </p>
                </div>

                {modalError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 font-medium">
                    {modalError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={newRegistrationNumber}
                      onChange={(e) => setNewRegistrationNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Active Backlogs
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newBacklogs}
                      onChange={(e) => setNewBacklogs(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Semester SGPAs */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Semester SGPA Updates (Optional)
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[1, 2, 3, 4, 5, 6].map((sem) => (
                      <div key={sem}>
                        <span className="block text-[11px] text-gray-500 font-mono mb-0.5">
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
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-center font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Justification Reason */}
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Reason for Correction Request <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Explain clearly why this correction is required (e.g. phone number updated, Sem 2 revaluation result revised SGPA)..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-xs"
                    required
                  />
                </div>

                <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 bg-white hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 transition shadow-2xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {isSubmitting ? 'Sending Request...' : 'Send Request to Coordinator'}
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
