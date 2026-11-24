'use client';

/**
 * @fileoverview Drive application and spreadsheet workspace page.
 * Accessible to students to review drive eligibility, submit applications, and fill spreadsheet fields,
 * and to coordinators to monitor applications and candidates.
 *
 * @module app/drives/[driveId]/page
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Building2,
  Calendar,
  Briefcase,
  Award,
  AlertTriangle,
  CheckCircle,
  FileText,
  ArrowLeft,
  Send,
  Download,
  Info,
  Code2,
  Sparkles,
  Video,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { DrivesSpreadsheet } from '@/components/spreadsheet/DrivesSpreadsheet';
import { getDriveById, getYouTubeEmbedUrl, type DriveItem } from '@/services/drives.service';
import { applyToDrive } from '@/services/spreadsheet.service';

interface DrivePageProps {
  params?: Promise<{ driveId: string }>;
}

function DriveApplicationContent({ params }: DrivePageProps) {
  const routeParams = useParams();
  const routeDriveId =
    typeof routeParams?.driveId === 'string'
      ? routeParams.driveId
      : Array.isArray(routeParams?.driveId)
      ? routeParams.driveId[0]
      : undefined;

  const [propDriveId, setPropDriveId] = useState<string | undefined>(() => {
    if (params && !('then' in (params as any)) && 'driveId' in (params as any)) {
      return (params as any).driveId;
    }
    return undefined;
  });

  useEffect(() => {
    if (params && 'then' in params && typeof (params as Promise<{ driveId: string }>).then === 'function') {
      (params as Promise<{ driveId: string }>)
        .then((resolved) => {
          if (resolved?.driveId) {
            setPropDriveId(resolved.driveId);
          }
        })
        .catch(() => {});
    }
  }, [params]);

  const driveId = routeDriveId || propDriveId || '';

  const { user } = useAuth();

  const [drive, setDrive] = useState<DriveItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const fetchDrive = useCallback(async () => {
    if (!driveId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDriveById(driveId);
      setDrive(data);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.error?.message ||
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Failed to load drive details';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [driveId]);

  useEffect(() => {
    void fetchDrive();
  }, [fetchDrive]);

  const handleApply = async () => {
    setApplyLoading(true);
    setApplyError(null);
    setApplySuccess(null);
    try {
      await applyToDrive(driveId, {});
      setApplySuccess('Successfully registered for this recruitment drive!');
      await fetchDrive();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { status?: number; data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.error?.message ||
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Failed to submit drive application';

      if (
        message.includes('do not have permission') ||
        (axiosErr.response?.status === 403 && user?.role !== 'STUDENT')
      ) {
        setApplyError(
          `You cannot apply because your active session belongs to an administrator/coordinator account (${user?.role || 'Staff'}). Only registered students can apply for recruitment drives. Please log in with a student account or open an Incognito window.`
        );
      } else {
        setApplyError(message);
      }
    } finally {
      setApplyLoading(false);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'DREAM':
        return (
          <span className="shrink-0 whitespace-nowrap inline-flex items-center justify-center px-4 py-1 rounded-full text-xs font-bold bg-white text-black border border-white shadow-xs">
            Dream (≥ 7 LPA)
          </span>
        );
      case 'INTERNSHIP':
        return (
          <span className="shrink-0 whitespace-nowrap inline-flex items-center justify-center px-4 py-1 rounded-full text-xs font-bold bg-white text-black border border-white shadow-xs">
            Internship
          </span>
        );
      default:
        return (
          <span className="shrink-0 whitespace-nowrap inline-flex items-center justify-center px-4 py-1 rounded-full text-xs font-bold bg-white text-black border border-white shadow-xs">
            General (&lt; 7 LPA)
          </span>
        );
    }
  };

  const dashboardHref =
    user?.role === 'MAIN_COORDINATOR'
      ? '/admin'
      : user?.role === 'BRANCH_COORDINATOR'
      ? '/coordinator'
      : '/student';

  return (
    <RequireAuth roles={['STUDENT', 'BRANCH_COORDINATOR', 'MAIN_COORDINATOR']}>
      <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-[#101012] selection:text-black flex flex-col">
        {/* Top Navbar */}
        <header className="bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-neutral-800 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href={dashboardHref}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 px-3 py-1.5 rounded-lg transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
              <div className="h-5 w-px bg-neutral-700" />
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-white" />
                <span className="font-bold text-white text-sm">
                  {drive ? `${drive.company} Recruitment Drive` : 'Recruitment Drive'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">Signed in as</span>
              <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-700 text-white shadow-xs">
                {user?.username} ({user?.role})
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mb-3" />
              <p className="text-sm text-neutral-400 font-medium">Loading placement drive details...</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-red-600 mx-auto" />
              <h3 className="text-base font-bold text-red-900">Failed to Load Drive</h3>
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={fetchDrive}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-lg transition"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && drive && (
            <>
              {/* Drive Details Header Card */}
              <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white overflow-hidden">
                <div className="p-6 border-b border-neutral-800 bg-neutral-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className="text-2xl font-black text-white">{drive.company}</span>
                      {getCategoryBadge(drive.packageCategory)}
                      {!drive.open && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-neutral-400 border border-neutral-700">
                          Closed
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400">
                      {drive.role && (
                        <div className="flex items-center gap-1.5 font-medium text-neutral-200">
                          <Briefcase className="h-4 w-4 text-neutral-400" />
                          <span>{drive.role}</span>
                        </div>
                      )}
                      {drive.ctcLpa !== null && (
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                          <Award className="h-4 w-4 text-emerald-600" />
                          <span>{drive.ctcLpa} LPA Package</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-neutral-400">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>Deadline: {new Date(drive.deadline).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/drives/${drive.id}/mock-oa`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-neutral-700 hover:border-neutral-500 rounded-lg text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition shadow-2xs"
                    >
                      <Code2 className="h-4 w-4 text-emerald-400" />
                      Practice Mock OA
                    </Link>

                    {drive.jdFileUrl && (
                      <a
                        href={`http://localhost:4000/api/drives/${drive.id}/jd`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-neutral-700 rounded-lg text-xs font-semibold text-neutral-300 bg-[#101012] hover:bg-neutral-900/60 transition shadow-2xs"
                      >
                        <Download className="h-4 w-4 text-neutral-400" />
                        Download JD PDF
                      </a>
                    )}

                    {user && user.role !== 'STUDENT' && (
                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 text-neutral-300 border border-neutral-700 rounded-lg text-xs font-semibold">
                        <Info className="h-4 w-4 text-neutral-400" />
                        <span>{user.role === 'MAIN_COORDINATOR' ? 'Super Admin Mode' : 'Coordinator Mode'}</span>
                      </span>
                    )}

                    {user?.role === 'STUDENT' && drive.open && (
                      <div>
                        {drive.userApplied ? (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white border border-neutral-700 rounded-lg text-xs font-bold">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            Applied
                          </span>
                        ) : drive.eligible === false ? (
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-950/40 text-red-300 border border-red-800/60">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Not Eligible
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleApply}
                            disabled={applyLoading}
                            className="inline-flex items-center gap-1.5 px-5 py-2 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black font-bold rounded-lg text-xs font-bold transition shadow-xs"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {applyLoading ? 'Submitting Application...' : 'Apply Now'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Eligibility Criteria & Details Ribbon */}
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-[#101012] text-xs border-b border-neutral-800/80">
                  <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block font-medium">Eligible Departments</span>
                    <span className="text-white font-bold mt-1 block">
                      {drive.eligibleBranches && drive.eligibleBranches.length > 0
                        ? drive.eligibleBranches.join(', ')
                        : 'All Branches'}
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block font-medium">Minimum Cutoff CGPA</span>
                    <span className="text-indigo-700 font-bold mt-1 block">
                      {drive.minCgpa > 0 ? `${drive.minCgpa} CGPA` : 'No Cutoff (0.0)'}
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block font-medium">Backlog / Supply Policy</span>
                    <span
                      className={`font-bold mt-1 block ${
                        drive.allowBacklogs ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {drive.allowBacklogs
                        ? `Allowed (Up to ${drive.maxActiveBacklogs || 2} backlogs)`
                        : 'Zero Backlogs Only (No Supply)'}
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-800">
                    <span className="text-neutral-400 block font-medium">Selection Rounds</span>
                    <span className="text-white font-bold mt-1 block">
                      {drive.totalRounds} {drive.totalRounds === 1 ? 'Round' : 'Rounds'}
                    </span>
                  </div>
                </div>

                {drive.description && (
                  <div className="p-6 bg-[#101012] text-xs text-neutral-300 border-b border-neutral-800/80">
                    <h4 className="font-bold text-white mb-1">Job Summary & Description:</h4>
                    <p className="whitespace-pre-line leading-relaxed text-neutral-400">
                      {drive.description}
                    </p>
                  </div>
                )}

                {/* YouTube Interview Preparation & Company Overview Video */}
                {drive.youtubeUrl && getYouTubeEmbedUrl(drive.youtubeUrl) && (
                  <div className="p-6 bg-[#101012] border-b border-neutral-800/80 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-neutral-900 border border-neutral-700 text-white">
                          <Video className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">
                            Company Overview &amp; Interview Preparation Video
                          </h4>
                          <p className="text-xs text-neutral-400">
                            Curated preparation resource and interview insights for {drive.company}
                          </p>
                        </div>
                      </div>
                      <a
                        href={drive.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition w-fit"
                      >
                        <span>Watch on YouTube</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>

                    <div className="aspect-video max-w-3xl w-full rounded-2xl overflow-hidden border border-neutral-800 bg-black shadow-lg">
                      <iframe
                        src={getYouTubeEmbedUrl(drive.youtubeUrl)!}
                        title={`${drive.company} Interview Preparation Video`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                  </div>
                )}

                {/* Feedback Messages */}
                {applySuccess && (
                  <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2 text-xs font-semibold text-emerald-800">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{applySuccess} You can now update your details in the spreadsheet below.</span>
                  </div>
                )}

                {applyError && (
                  <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-2 text-xs font-semibold text-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    <span>{applyError}</span>
                  </div>
                )}

                {user?.role === 'STUDENT' && drive.reasons && drive.reasons.length > 0 && (
                  <div className="p-4 bg-amber-50 border-b border-amber-200 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
                      <Info className="h-4 w-4 text-amber-700" />
                      <span>Eligibility Criteria Breakdown:</span>
                    </div>
                    <ul className="list-disc list-inside text-amber-800 space-y-0.5">
                      {drive.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Big Data Analytics Mock OA Banner */}
              <div className="p-6 bg-gradient-to-r from-neutral-900/90 via-[#101012] to-[#141416] border border-neutral-800 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800/80">
                      <Sparkles className="h-3 w-3" />
                      Big Data Web Analytics
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">2022–2025 Archive Synthesis</span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Simulated Online Assessment (OA) Coding Round
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-xl leading-relaxed">
                    Practice questions synthesized from real previous years coding tests asked by {drive.company} across LeetCode Discuss, GeeksforGeeks, and campus interview archives, with authentic time limits and sandboxed test execution.
                  </p>
                </div>
                <Link
                  href={`/drives/${drive.id}/mock-oa`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white hover:bg-neutral-200 text-black font-bold text-xs rounded-xl transition shrink-0 shadow-sm"
                >
                  <Code2 className="h-4 w-4" />
                  <span>Launch {drive.company} Mock OA</span>
                </Link>
              </div>

              {/* Interactive Drive Spreadsheet Section */}
              <div className="bg-[#101012] rounded-3xl border border-neutral-800 text-white p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <FileText className="h-5 w-5 text-white" />
                      Drive Application Spreadsheet & Candidate Responses
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {user?.role === 'STUDENT'
                        ? 'Verify your details and fill any required questionnaire fields for this drive.'
                        : 'Review applicants, verify profile credentials, and update round status.'}
                    </p>
                  </div>
                </div>

                <DrivesSpreadsheet
                  driveId={drive.id}
                  deadline={drive.deadline}
                  extraFields={drive.extraFields}
                />
              </div>
            </>
          )}
        </main>
      </div>
    </RequireAuth>
  );
}

export default function DriveApplicationPage(props: DrivePageProps) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center text-neutral-400 font-mono text-xs">
          Loading application workspace...
        </div>
      }
    >
      <DriveApplicationContent {...props} />
    </React.Suspense>
  );
}

