'use client';

/**
 * @fileoverview Drive application and spreadsheet workspace page.
 * Accessible to students to review drive eligibility, submit applications, and fill spreadsheet fields,
 * and to coordinators to monitor applications and candidates.
 *
 * @module app/drives/[driveId]/page
 */

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Calendar,
  Briefcase,
  Award,
  AlertTriangle,
  CheckCircle,
  FileText,
  ArrowLeft,
  Users,
  Send,
  Download,
  Info,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { RequireAuth } from '@/components/auth/require-auth';
import { DrivesSpreadsheet } from '@/components/spreadsheet/DrivesSpreadsheet';
import { getDriveById, type DriveItem } from '@/services/drives.service';
import { applyToDrive } from '@/services/spreadsheet.service';

interface DrivePageProps {
  params: Promise<{ driveId: string }>;
}

export default function DriveApplicationPage({ params }: DrivePageProps) {
  const resolvedParams = use(params);
  const driveId = resolvedParams.driveId;

  const router = useRouter();
  const { user } = useAuth();

  const [drive, setDrive] = useState<DriveItem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const fetchDrive = React.useCallback(async () => {
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
        response?: { data?: { error?: { message?: string }; message?: string } };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.error?.message ||
        axiosErr.response?.data?.message ||
        axiosErr.message ||
        'Failed to submit drive application';
      setApplyError(message);
    } finally {
      setApplyLoading(false);
    }
  };

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'DREAM':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            ★ Dream (≥ 7 LPA)
          </span>
        );
      case 'INTERNSHIP':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
            ⏳ Internship
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            💼 General (&lt; 7 LPA)
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
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top Navbar */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link
                href={dashboardHref}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
              <div className="h-5 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                <span className="font-bold text-gray-900 text-sm">
                  {drive ? `${drive.company} Recruitment Drive` : 'Recruitment Drive'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Signed in as</span>
              <span className="text-xs font-mono font-semibold px-2 py-1 rounded-md bg-gray-100 text-gray-800">
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
              <p className="text-sm text-gray-500 font-medium">Loading placement drive details...</p>
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
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-linear-to-r from-gray-50 to-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className="text-2xl font-black text-gray-900">{drive.company}</span>
                      {getCategoryBadge(drive.packageCategory)}
                      {!drive.open && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300">
                          Closed
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                      {drive.role && (
                        <div className="flex items-center gap-1.5 font-medium text-gray-800">
                          <Briefcase className="h-4 w-4 text-gray-500" />
                          <span>{drive.role}</span>
                        </div>
                      )}
                      {drive.ctcLpa !== null && (
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                          <Award className="h-4 w-4 text-emerald-600" />
                          <span>{drive.ctcLpa} LPA Package</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>Deadline: {new Date(drive.deadline).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {drive.jdFileUrl && (
                      <a
                        href={`http://localhost:4000/api/drives/${drive.id}/jd`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition shadow-2xs"
                      >
                        <Download className="h-4 w-4 text-gray-500" />
                        Download JD PDF
                      </a>
                    )}

                    {user?.role === 'STUDENT' && drive.open && (
                      <div>
                        {drive.userApplied ? (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            Applied
                          </span>
                        ) : drive.eligible === false ? (
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Not Eligible
                            </span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleApply}
                            disabled={applyLoading}
                            className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-bold transition shadow-xs"
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
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white text-xs border-b border-gray-100">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Eligible Departments</span>
                    <span className="text-gray-900 font-bold mt-1 block">
                      {drive.eligibleBranches && drive.eligibleBranches.length > 0
                        ? drive.eligibleBranches.join(', ')
                        : 'All Branches'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Minimum Cutoff CGPA</span>
                    <span className="text-indigo-700 font-bold mt-1 block">
                      {drive.minCgpa > 0 ? `${drive.minCgpa} CGPA` : 'No Cutoff (0.0)'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Backlog / Supply Policy</span>
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

                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-gray-500 block font-medium">Selection Rounds</span>
                    <span className="text-gray-900 font-bold mt-1 block">
                      {drive.totalRounds} {drive.totalRounds === 1 ? 'Round' : 'Rounds'}
                    </span>
                  </div>
                </div>

                {drive.description && (
                  <div className="p-6 bg-white text-xs text-gray-700 border-b border-gray-100">
                    <h4 className="font-bold text-gray-900 mb-1">Job Summary & Description:</h4>
                    <p className="whitespace-pre-line leading-relaxed text-gray-600">
                      {drive.description}
                    </p>
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

              {/* Interactive Drive Spreadsheet Section */}
              <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-indigo-600" />
                      Drive Application Spreadsheet & Candidate Responses
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
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

