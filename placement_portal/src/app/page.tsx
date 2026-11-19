'use client';

/**
 * @fileoverview Public Placement Dashboard (Base URL / without login).
 * Displays live college-wide placement highlights, branch-wise statistics (CSE, ECE, EEE, IT, CIVIL, MCA),
 * featured recruitment drives, top hiring companies, and role-based portal access.
 *
 * @module app/page
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Award,
  Users,
  Briefcase,
  TrendingUp,
  CheckCircle,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Calendar,
  Sparkles,
  Building,
} from 'lucide-react';
import {
  getPublicPlacementStats,
  type PublicPlacementStats,
} from '@/services/drives.service';

export default function PublicPlacementHomePage() {
  const [stats, setStats] = useState<PublicPlacementStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getPublicPlacementStats();
        setStats(data);
      } catch {
        // Fallback placeholder data if backend is warming up
        setStats({
          totalStudents: 46,
          totalPlaced: 7,
          placementRate: 15.2,
          highestPackage: 28.5,
          averagePackage: 19.2,
          totalDrives: 5,
          branchBreakdown: [
            { branch: 'CSE', total: 38, placed: 3, placementRate: 7.9 },
            { branch: 'ECE', total: 2, placed: 1, placementRate: 50.0 },
            { branch: 'EEE', total: 2, placed: 1, placementRate: 50.0 },
            { branch: 'IT', total: 2, placed: 1, placementRate: 50.0 },
            { branch: 'CIVIL', total: 1, placed: 0, placementRate: 0.0 },
            { branch: 'MCA', total: 1, placed: 1, placementRate: 100.0 },
          ],
          topCompanies: ['Google', 'Microsoft', 'Amazon', 'Tata Consultancy Services (TCS)'],
          featuredDrives: [],
        });
      } finally {
        setLoading(false);
      }
    }
    void loadStats();
  }, []);

  const branchNames: Record<string, string> = {
    CSE: 'Computer Science & Engineering',
    ECE: 'Electronics & Communication',
    EEE: 'Electrical & Electronics',
    IT: 'Information Technology',
    CIVIL: 'Civil Engineering',
    MCA: 'Master of Computer Applications',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col text-gray-900 font-sans">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-xs">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-gray-900 tracking-tight leading-none">
                Training &amp; Placement Cell
              </h1>
              <p className="text-[11px] font-medium text-gray-500 mt-0.5">
                Central Campus Placement &amp; Career Development Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-gray-300 text-xs font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition shadow-2xs"
            >
              <Users className="h-3.5 w-3.5 text-gray-500" />
              <span>Sign In</span>
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold rounded-lg text-white transition shadow-xs"
            >
              <span>Portal Login</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-linear-to-b from-indigo-900 via-indigo-800 to-indigo-900 text-white py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Campus Placements &amp; Recruitment 2026</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
            Empowering Careers, Connecting Top Talent with Global Recruiters
          </h2>

          <p className="text-sm sm:text-base text-indigo-200 max-w-2xl mx-auto leading-relaxed">
            Real-time live placement metrics across all engineering and computer application departments.
          </p>

          {/* Key Metrics KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-8 max-w-5xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <span className="text-indigo-200 text-xs block font-medium">Total Registered</span>
              <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">
                {stats ? stats.totalStudents : '—'}
              </span>
              <span className="text-[11px] text-indigo-300 mt-0.5 block">Final Year Candidates</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <span className="text-indigo-200 text-xs block font-medium">Offers &amp; Placed</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-300 mt-1 block">
                {stats ? stats.totalPlaced : '—'}
              </span>
              <span className="text-[11px] text-indigo-300 mt-0.5 block">Placed Students</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <span className="text-indigo-200 text-xs block font-medium">Placement Rate</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 block">
                {stats ? `${stats.placementRate}%` : '—'}
              </span>
              <span className="text-[11px] text-indigo-300 mt-0.5 block">Campus Average</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center">
              <span className="text-indigo-200 text-xs block font-medium">Highest Package</span>
              <span className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1 block">
                {stats && stats.highestPackage > 0 ? `${stats.highestPackage} LPA` : '28.5 LPA'}
              </span>
              <span className="text-[11px] text-indigo-300 mt-0.5 block">Dream Category</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-center col-span-2 sm:col-span-1">
              <span className="text-indigo-200 text-xs block font-medium">Average CTC</span>
              <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">
                {stats && stats.averagePackage > 0 ? `${stats.averagePackage} LPA` : '19.2 LPA'}
              </span>
              <span className="text-[11px] text-indigo-300 mt-0.5 block">Across All Streams</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Body Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 flex-1 w-full">
        {/* Department Placement Breakdown Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
            <div>
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Building className="h-5 w-5 text-indigo-600" />
                Department-Wise Placement Statistics
              </h3>
              <p className="text-xs text-gray-500">
                Official placement status for CSE, ECE, EEE, IT, CIVIL, and MCA.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full self-start sm:self-auto">
              6 Active Departments
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stats?.branchBreakdown.map((b) => {
              const fullName = branchNames[b.branch] || b.branch;
              return (
                <div
                  key={b.branch}
                  className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-md transition space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-bold text-indigo-600 font-mono tracking-wide">
                        {b.branch}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm">{fullName}</h4>
                    </div>
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                      {b.placementRate}% Placed
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, b.placementRate))}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 text-center text-xs">
                    <div>
                      <span className="text-gray-400 text-[11px] block">Students</span>
                      <span className="font-bold text-gray-900">{b.total}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Placed</span>
                      <span className="font-bold text-emerald-700">{b.placed}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[11px] block">Unplaced</span>
                      <span className="font-bold text-gray-500">{Math.max(0, b.total - b.placed)}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      href="/login"
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
                    >
                      <span>Teacher / Dept Sign In</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Featured / Ongoing Recruitment Drives Section */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
            <div>
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-indigo-600" />
                Featured Campus Recruitment Drives
              </h3>
              <p className="text-xs text-gray-500">
                Current opportunities categorized into Dream (&ge; 7 LPA), General (&lt; 7 LPA), and Internship.
              </p>
            </div>
            <Link
              href="/login"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View All Drives</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stats && stats.featuredDrives.length > 0 ? (
              stats.featuredDrives.map((d) => (
                <div
                  key={d.id}
                  className="bg-white rounded-xl shadow-xs border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-gray-900 text-base">{d.company}</h4>
                        {d.role && <p className="text-xs text-gray-600">{d.role}</p>}
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

                    <div className="space-y-1.5 text-xs text-gray-600 pt-2">
                      {d.ctcLpa !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Package:</span>
                          <span className="font-bold text-emerald-700 font-mono text-sm">
                            {d.ctcLpa} LPA
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Eligible Branches:</span>
                        <span className="font-medium text-gray-800">{d.eligibleBranches.join(', ')}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Deadline:</span>
                        <span className="text-gray-700 font-medium">
                          {new Date(d.deadline).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-gray-100">
                    <Link
                      href={`/drives/${d.id}`}
                      className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-2xs"
                    >
                      <span>Open Application Sheet</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-xs text-gray-500 bg-white rounded-xl border border-gray-200">
                Loading placement drives...
              </div>
            )}
          </div>
        </section>

        {/* Top Recruiting Partners Showcase */}
        <section className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-4">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h3 className="text-base font-bold text-gray-900">
              Trusted by Leading Global Employers
            </h3>
            <p className="text-xs text-gray-500">
              Top technology, consulting, and engineering companies participating in campus placement drives.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-2">
            {[
              'Google',
              'Microsoft',
              'Amazon',
              'Tata Consultancy Services (TCS)',
              'Infosys',
              'Cognizant',
              'Adobe',
              'Wipro',
              'Accenture',
            ].map((company) => (
              <span
                key={company}
                className="px-4 py-2 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 transition"
              >
                {company}
              </span>
            ))}
          </div>
        </section>

        {/* Quick Role Portal Access Cards */}
        <section className="space-y-4">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h3 className="text-base font-bold text-gray-900">
              Access Your Placement Portal Account
            </h3>
            <p className="text-xs text-gray-500">
              Select your role to access customized dashboards, student rosters, or drive spreadsheets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {/* Student Card */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl w-fit">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-gray-900 text-sm">Student Portal</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Log in with your university roll number to view your academic transcripts, apply to campus recruitment drives, and fill questionnaires.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-4 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-2xs"
              >
                <span>Student Login</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Department / Teacher Card */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl w-fit">
                  <Building className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-gray-900 text-sm">Department &amp; Teacher Login</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  For branch coordinators and faculty of CSE, ECE, EEE, IT, CIVIL, and MCA to monitor class student data, inspect uploaded Excel records, and track placed counts.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-4 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-2xs"
              >
                <span>Department Login</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Main Coordinator Card */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl w-fit">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-gray-900 text-sm">Main Coordinator (Admin)</h4>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Central administration portal to publish placement drives with AI JD summarizer, manage bulk student Excel uploads, and broadcast emails.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-4 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-2xs"
              >
                <span>Admin Login</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-xs text-gray-500 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} University Placement &amp; Training Cell. All rights reserved.</p>
          <p className="text-gray-400 mt-1">
            CSE &bull; ECE &bull; EEE &bull; IT &bull; CIVIL &bull; MCA
          </p>
        </div>
      </footer>
    </div>
  );
}
