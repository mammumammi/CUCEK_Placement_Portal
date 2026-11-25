'use client';

/**
 * @fileoverview Modern 2026 Public Placement Dashboard (Black & White Theme).
 * Inspired by modern Awwwards/Webflow minimalist dark portfolios and dashboards.
 * Features:
 * - GSAP entrance and stagger animations
 * - Interactive SVG Pie/Donut Chart & circular progress rings (Expense Categories style)
 * - Compensation CTC wave curves & placement trends
 * - Enterprise Cloud Computing & Big Data Placement Stack showcase
 * - Multi-Department statistics (CSE, ECE, EEE, IT, CIVIL, MCA)
 * - Live recruitment drives with package categorization
 * - Batch 2026 & Batch 2028 dual cohort support with quick role portals
 *
 * @module app/page
 */

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import {
  Briefcase,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Building,
  PieChart as PieChartIcon,
  Database,
  Cpu,
  CloudLightning,
  Search,
  Bell,
  Activity,
  BarChart3,
  Server,
  Network,
  Code2,
} from 'lucide-react';
import {
  getPublicPlacementStats,
  type PublicPlacementStats,
} from '@/services/drives.service';
import { DepartmentPlacementPieChart } from '@/components/analytics/DepartmentPlacementPieChart';

export default function PublicPlacementHomePage() {
  const [stats, setStats] = useState<PublicPlacementStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'departments' | 'drives' | 'cloud'>('overview');
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getPublicPlacementStats();
        setStats(data);
      } catch {
        // Fallback state if backend is unreachable
        setStats({
          totalStudents: 0,
          totalPlaced: 0,
          placementRate: 0,
          highestPackage: 0,
          averagePackage: 0,
          totalDrives: 0,
          branchBreakdown: [
            { branch: 'CSE', total: 0, placed: 0, placementRate: 0 },
            { branch: 'ECE', total: 0, placed: 0, placementRate: 0 },
            { branch: 'EEE', total: 0, placed: 0, placementRate: 0 },
            { branch: 'IT', total: 0, placed: 0, placementRate: 0 },
            { branch: 'CIVIL', total: 0, placed: 0, placementRate: 0 },
            { branch: 'MCA', total: 0, placed: 0, placementRate: 0 },
          ],
          topCompanies: [],
          featuredDrives: [],
        });
      } finally {
        setLoading(false);
      }
    }
    void loadStats();
  }, []);

  // GSAP Animations on Mount & Stats Load
  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero headline entrance
      gsap.fromTo(
        '.gsap-hero-title',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }
      );

      gsap.fromTo(
        '.gsap-hero-desc',
        { opacity: 0, y: 20 },
        { opacity: 0.8, y: 0, duration: 0.9, delay: 0.15, ease: 'power3.out' }
      );

      // KPI Metric Cards stagger
      gsap.fromTo(
        '.gsap-metric-card',
        { opacity: 0, y: 25 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, delay: 0.25, ease: 'power2.out' }
      );

      // Donut / Pie Chart entrance
      gsap.fromTo(
        '.gsap-chart-reveal',
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.9, delay: 0.4, ease: 'power2.out' }
      );

      // Circular ring items stagger
      gsap.fromTo(
        '.gsap-ring-item',
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.6, stagger: 0.06, delay: 0.5, ease: 'back.out(1.5)' }
      );

      // Stack capability cards stagger
      gsap.fromTo(
        '.gsap-stack-card',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.07, delay: 0.6, ease: 'power2.out' }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [loading]);

  const branchNames: Record<string, string> = {
    CSE: 'Computer Science & Engineering',
    ECE: 'Electronics & Communication',
    EEE: 'Electrical & Electronics',
    IT: 'Information Technology',
    CIVIL: 'Civil Engineering',
    MCA: 'Master of Computer Applications',
  };

  // Pie / Donut Chart Data Calculation
  const totalPlaced = stats?.totalPlaced || 12;
  const dreamCount = Math.round(totalPlaced * 0.45);
  const generalCount = Math.round(totalPlaced * 0.40);
  const internCount = Math.max(1, totalPlaced - dreamCount - generalCount);

  const pieCategories = [
    {
      id: 'dream',
      label: 'Dream Tier (≥ 7 LPA)',
      count: dreamCount,
      percentage: Math.round((dreamCount / totalPlaced) * 100),
      color: '#ffffff', // Pure white
      strokeColor: '#ffffff',
      dashoffset: 0,
    },
    {
      id: 'general',
      label: 'General Tier (< 7 LPA)',
      count: generalCount,
      percentage: Math.round((generalCount / totalPlaced) * 100),
      color: '#a1a1aa', // Zinc-400
      strokeColor: '#71717a',
      dashoffset: 40,
    },
    {
      id: 'internship',
      label: 'Internship & PPO',
      count: internCount,
      percentage: Math.round((internCount / totalPlaced) * 100),
      color: '#52525b', // Zinc-600
      strokeColor: '#3f3f46',
      dashoffset: 75,
    },
  ];

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased selection:bg-white selection:text-black flex"
    >
      {/* ------------------------------------------------------------- */}
      {/* LEFT SIDEBAR NAVIGATION (Modern 2026 Template Layout)          */}
      {/* ------------------------------------------------------------- */}
      <aside className="w-64 border-r border-neutral-800/80 bg-[#0c0c0e] flex-col justify-between p-6 shrink-0 hidden lg:flex sticky top-0 h-screen z-40">
        <div className="space-y-8">
          {/* Brand & Season Profile Avatar */}
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-white font-mono font-black text-[11px] tracking-tight shadow-inner">
                CUCEK
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full ring-2 ring-[#0c0c0e] animate-pulse" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white tracking-tight leading-snug">
                CUCEK Placement Portal
              </h2>
              <p className="text-[10px] text-neutral-400 font-medium mt-0.5 leading-tight">
                Cochin University College of Engineering Kuttanad
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboardIcon },
              { id: 'analytics', label: 'Pie Chart Analytics', icon: PieChartIcon },
              { id: 'drives', label: 'Recruitment Drives', icon: Briefcase },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id as 'overview' | 'analytics' | 'departments' | 'drives' | 'cloud');
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

        {/* Bottom Dual-Cohort Status & Outbound Links (from Image 1) */}
        <div className="space-y-4 pt-6 border-t border-neutral-800/80">
          <div className="p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-[11px] font-bold text-white">Dual Batch Season Active</span>
            </div>
            <p className="text-[10px] text-neutral-400">
              Batch 2026 Final Year &amp; Batch 2028 Junior Portals open.
            </p>
          </div>

          <div className="space-y-1 text-xs font-medium text-neutral-400">
            <Link
              href="/login"
              className="flex items-center justify-between py-1 hover:text-white transition group"
            >
              <span>Admin Portal</span>
              <span className="text-[10px] text-neutral-500 group-hover:text-white">↗</span>
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-between py-1 hover:text-white transition group"
            >
              <span>Junior Coord 2028</span>
              <span className="text-[10px] text-neutral-500 group-hover:text-white">↗</span>
            </Link>
            <Link
              href="/login"
              className="flex items-center justify-between py-1 hover:text-white transition group"
            >
              <span>Student Login</span>
              <span className="text-[10px] text-neutral-500 group-hover:text-white">↗</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT AREA                                             */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Navbar */}
        <header className="h-16 border-b border-neutral-800/80 bg-[#09090b]/80 backdrop-blur-xl sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-xs font-medium text-neutral-300">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>Placement Season 2026 &bull; Batch 2028 Live</span>
            </div>
          </div>

          {/* Right Top Actions (Image 1 & Image 3) */}
          <div className="flex items-center gap-3">
            {/* Search Pill */}
            <div className="relative hidden md:block">
              <Search className="h-3.5 w-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                readOnly
                placeholder="Search drives, departments, criteria..."
                className="bg-neutral-900/90 border border-neutral-800 rounded-full pl-8 pr-4 py-1.5 text-xs text-neutral-300 placeholder:text-neutral-500 w-64 focus:outline-hidden"
              />
            </div>

            {/* Notification Bell */}
            <div className="relative p-2 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white transition cursor-pointer">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </div>

            {/* Sleek Pill Login Button (matching Image 1 "Get In Touch") */}
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-bold transition shadow-xs"
            >
              <span>Portal Login</span>
              <ArrowRight className="h-3.5 w-3.5 text-black" />
            </Link>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10 max-w-7xl w-full mx-auto space-y-12">
          {/* ========================================================= */}
          {/* 1. HERO SECTION                                           */}
          {/* ========================================================= */}
          <section id="overview" className="space-y-6 scroll-mt-20">
            <div className="bg-[#101012] border border-neutral-800 rounded-3xl p-6 sm:p-10 lg:p-12 relative overflow-hidden">
              {/* Subtle ambient light gradient */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-radial from-neutral-700/10 via-transparent to-transparent pointer-events-none" />

              <div className="max-w-3xl space-y-5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-700 text-xs text-neutral-300 font-medium whitespace-nowrap">
                  <Sparkles className="h-3.5 w-3.5 text-white shrink-0" />
                  <span>Cochin University College of Engineering Kuttanad (CUCEK)</span>
                </div>

                <h1 className="gsap-hero-title text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.12]">
                  CUCEK Placement Portal — Connecting Top Talent with Global Giants.
                </h1>

                <p className="gsap-hero-desc text-sm sm:text-base text-neutral-400 max-w-2xl leading-relaxed">
                  Official Training &amp; Placement Portal of Cochin University College of Engineering Kuttanad with automated AI Job Description extraction,
                  real-time spreadsheet orchestration, and live placement analytics.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black hover:bg-neutral-200 text-xs font-bold transition shadow-sm"
                  >
                    <span>Enter Recruitment Portal</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                  <a
                    href="#analytics"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-white transition"
                  >
                    <PieChartIcon className="h-4 w-4 text-neutral-400" />
                    <span>View Pie Chart Analytics</span>
                  </a>

                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-neutral-400 hover:text-white transition"
                  >
                    <span>Junior Coordinators (Batch 2028) &rarr;</span>
                  </Link>
                </div>
              </div>

              {/* Live Metric KPI Cards (5 Pillars) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 pt-10">
                <div className="gsap-metric-card bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 text-left">
                  <span className="text-neutral-400 text-xs block font-medium">Total Registered</span>
                  <span className="text-2xl sm:text-3xl font-black text-white mt-1 block font-mono">
                    {stats ? stats.totalStudents : '48'}
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">Final Year Candidates</span>
                </div>

                <div className="gsap-metric-card bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 text-left">
                  <span className="text-neutral-400 text-xs block font-medium">Offers &amp; Placed</span>
                  <span className="text-2xl sm:text-3xl font-black text-white mt-1 block font-mono">
                    {stats ? stats.totalPlaced : '12'}
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">Placed Students</span>
                </div>

                <div className="gsap-metric-card bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 text-left">
                  <span className="text-neutral-400 text-xs block font-medium">Placement Rate</span>
                  <span className="text-2xl sm:text-3xl font-black text-white mt-1 block font-mono">
                    {stats ? `${stats.placementRate}%` : '0%'}
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">Campus Average</span>
                </div>

                <div className="gsap-metric-card bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 text-left">
                  <span className="text-neutral-400 text-xs block font-medium">Highest Package</span>
                  <span className="text-2xl sm:text-3xl font-black text-white mt-1 block font-mono">
                    {stats && stats.highestPackage > 0 ? `${stats.highestPackage} LPA` : '0 LPA'}
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">Dream Category</span>
                </div>

                <div className="gsap-metric-card bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 text-left col-span-2 sm:col-span-1">
                  <span className="text-neutral-400 text-xs block font-medium">Average CTC</span>
                  <span className="text-2xl sm:text-3xl font-black text-white mt-1 block font-mono">
                    {stats && stats.averagePackage > 0 ? `${stats.averagePackage} LPA` : '0 LPA'}
                  </span>
                  <span className="text-[11px] text-neutral-500 mt-0.5 block">Across All Streams</span>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================================= */}
          {/* 2. DEPARTMENT PLACEMENT PIE CHART ANALYTICS               */}
          {/* ========================================================= */}
          <section id="analytics" className="space-y-5 scroll-mt-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-white shrink-0" />
                  <span>Placement &amp; Department Distribution Analytics</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Color-coded interactive department breakdown across CSE, ECE, EEE, IT, CIVIL, and MCA with live legends.
                </p>
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs font-semibold px-3.5 py-1.5 bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-full self-start sm:self-auto">
                Real-Time 2026 Engine
              </span>
            </div>

            <div className="gsap-chart-reveal">
              <DepartmentPlacementPieChart
                branchBreakdown={stats?.branchBreakdown || []}
                totalStudents={stats?.totalStudents}
                totalPlaced={stats?.totalPlaced}
                title="Department Placement Distribution (Interactive Pie Chart)"
                subtitle="Distinct color-coded slices and legends for each department across CSE, ECE, EEE, IT, CIVIL, and MCA"
              />
            </div>
          </section>

          {/* ========================================================= */}
          {/* 3. FEATURED RECRUITMENT DRIVES                            */}
          {/* ========================================================= */}
          <section id="drives" className="space-y-5 scroll-mt-20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-white" />
                  Featured Campus Recruitment Drives
                </h3>
                <p className="text-xs text-neutral-400">
                  Current opportunities categorized into Dream (&ge; 7 LPA), General (&lt; 7 LPA), and Internship.
                </p>
              </div>
              <Link
                href="/login"
                className="text-xs font-bold text-white hover:underline flex items-center gap-1"
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
                    className="p-6 rounded-3xl bg-[#101012] border border-neutral-800 hover:border-neutral-700 transition flex flex-col justify-between space-y-4 shadow-lg shadow-black/30"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 pr-1">
                          <h4 className="font-bold text-white text-base truncate" title={d.company}>{d.company}</h4>
                          {d.role && <p className="text-xs text-neutral-400 mt-0.5 line-clamp-1" title={d.role}>{d.role}</p>}
                        </div>
                        <span className="shrink-0 whitespace-nowrap px-3.5 py-1 rounded-full text-xs font-bold bg-white text-black border border-white text-center shadow-xs tracking-wide min-w-[76px]">
                          {d.packageCategory === 'DREAM'
                            ? 'Dream'
                            : d.packageCategory === 'INTERNSHIP'
                            ? 'Internship'
                            : 'General'}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-neutral-400 pt-1">
                        {d.ctcLpa !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-500">Compensation:</span>
                            <span className="font-bold text-white font-mono text-sm">
                              {d.ctcLpa} LPA
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500">Eligible Streams:</span>
                          <span className="font-medium text-neutral-200">{d.eligibleBranches.join(', ')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-neutral-500">Deadline:</span>
                          <span className="text-neutral-300 font-medium">
                            {new Date(d.deadline).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-neutral-800/80">
                      <Link
                        href={`/drives/${d.id}`}
                        className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 transition shadow-2xs"
                      >
                        <span>Open Application Sheet</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center py-10 text-xs text-neutral-500 bg-[#101012] rounded-2xl border border-neutral-800">
                  Campus recruitment drives live. Click &quot;View All Drives&quot; to sign in and apply.
                </div>
              )}
            </div>
          </section>

          {/* ========================================================= */}
          {/* 6. BATCH 2028 & MULTI-ROLE PORTAL ACCESS                   */}
          {/* ========================================================= */}
          <section className="space-y-4">
            <div className="text-center max-w-xl mx-auto space-y-1">
              <h3 className="text-base font-bold text-white">
                Access Placement Cell Portals &amp; Credentials
              </h3>
              <p className="text-xs text-neutral-400">
                Seamless role-based authentication for students, teachers, and batch coordinators.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
              {/* Student Portal */}
              <div className="p-6 rounded-2xl bg-[#101012] border border-neutral-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl w-fit text-white">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Student Portal</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Log in with your university roll number to view academic records, apply to campus recruitment drives, and fill questionnaires.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 transition"
                >
                  <span>Student Login</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Department / Teacher Login */}
              <div className="p-6 rounded-2xl bg-[#101012] border border-neutral-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl w-fit text-white">
                    <Building className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Department &amp; Teacher Login</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    For branch coordinators and faculty of CSE, ECE, EEE, IT, CIVIL, and MCA to monitor class student data, inspect records, and approve drive applications.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 transition"
                >
                  <span>Department Login</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Batch 2028 & Super Admin Card */}
              <div className="p-6 rounded-2xl bg-[#101012] border border-neutral-800 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl w-fit text-white">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm">Batch 2028 &amp; Super Admin</h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    College-wide administration for Batch 2026 &amp; Batch 2028. Manage junior coordinators, publish AI-analyzed drives, and export company spreadsheets.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl text-xs font-bold text-black bg-white hover:bg-neutral-200 transition"
                >
                  <span>Super Admin &amp; Junior Coord</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-neutral-800/80 py-8 text-center text-xs text-neutral-500 mt-16 bg-[#09090b]">
          <div className="max-w-7xl mx-auto px-4 space-y-1">
            <p>&copy; 2026 CUCEK Placement Portal &bull; Cochin University College of Engineering Kuttanad</p>
            <p className="text-neutral-600">
              CSE &bull; ECE &bull; EEE &bull; IT &bull; CIVIL &bull; MCA &bull; Batch 2026 &bull; Batch 2028
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function LayoutDashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}
