'use client';

/**
 * @fileoverview Department Placement Pie / Donut Chart Component.
 * Visualizes the distribution of placements across academic departments (CSE, ECE, EEE, IT, CIVIL, MCA).
 * Slices/portions represent each department's share of total placed students:
 * portion = (dept_placed / total_placed) * 100%.
 *
 * Designed with the Modern 2026 Black & White high-contrast aesthetic.
 * Uses exact SVG geometric donut arc paths to eliminate CSS transform-origin bugs,
 * off-center rotation drift, and visual overlaps.
 *
 * @module components/analytics/DepartmentPlacementPieChart
 */

import React, { useState, useId } from 'react';
import { Building2, Award } from 'lucide-react';

export interface BranchStat {
  branch: string;
  total: number;
  placed: number;
  placementRate: number;
}

interface DepartmentPlacementPieChartProps {
  branchBreakdown: BranchStat[];
  totalStudents?: number;
  totalPlaced?: number;
  title?: string;
  subtitle?: string;
  className?: string;
  showLegendCards?: boolean;
}

// Distinct vibrant color palette for each academic department with high contrast on dark theme
const DEPT_COLORS: Record<string, { fill: string; border: string; label: string; textClass: string }> = {
  CSE: {
    fill: '#3b82f6', // Electric Blue
    border: '#60a5fa',
    label: 'Computer Science & Engineering',
    textClass: 'text-blue-400',
  },
  ECE: {
    fill: '#10b981', // Emerald Green
    border: '#34d399',
    label: 'Electronics & Communication',
    textClass: 'text-emerald-400',
  },
  EEE: {
    fill: '#f59e0b', // Amber Gold
    border: '#fbbf24',
    label: 'Electrical & Electronics',
    textClass: 'text-amber-400',
  },
  IT: {
    fill: '#a855f7', // Vibrant Purple
    border: '#c084fc',
    label: 'Information Technology',
    textClass: 'text-purple-400',
  },
  CIVIL: {
    fill: '#f43f5e', // Rose Coral
    border: '#fb7185',
    label: 'Civil Engineering',
    textClass: 'text-rose-400',
  },
  MCA: {
    fill: '#06b6d4', // Cyan Teal
    border: '#22d3ee',
    label: 'Master of Computer Applications',
    textClass: 'text-cyan-400',
  },
};

const DEFAULT_DEPT = {
  fill: '#94a3b8',
  border: '#cbd5e1',
  label: 'Department',
  textClass: 'text-neutral-300',
};

/**
 * Mathematically generates an exact SVG donut arc path.
 * 0 degrees = 12 o'clock, proceeding clockwise.
 */
function describeDonutSlice(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  // If full circle (360 degrees or close)
  if (endAngle - startAngle >= 359.9) {
    return [
      `M ${cx} ${cy - outerRadius}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${cx} ${cy + outerRadius}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${cx} ${cy - outerRadius}`,
      `M ${cx} ${cy - innerRadius}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy + innerRadius}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${cx} ${cy - innerRadius}`,
      'Z',
    ].join(' ');
  }

  // Convert angles to radians (0 deg is top / 12 o'clock, so subtract 90 deg)
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;

  const x1 = (cx + outerRadius * Math.cos(startRad)).toFixed(3);
  const y1 = (cy + outerRadius * Math.sin(startRad)).toFixed(3);
  const x2 = (cx + outerRadius * Math.cos(endRad)).toFixed(3);
  const y2 = (cy + outerRadius * Math.sin(endRad)).toFixed(3);

  const x3 = (cx + innerRadius * Math.cos(endRad)).toFixed(3);
  const y3 = (cy + innerRadius * Math.sin(endRad)).toFixed(3);
  const x4 = (cx + innerRadius * Math.cos(startRad)).toFixed(3);
  const y4 = (cy + innerRadius * Math.sin(startRad)).toFixed(3);

  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

export function DepartmentPlacementPieChart({
  branchBreakdown,
  totalStudents,
  totalPlaced: propTotalPlaced,
  title = 'Department Placement Share',
  subtitle = 'Portion represents number of placements per department',
  className = '',
  showLegendCards = true,
}: DepartmentPlacementPieChartProps) {
  const chartId = useId();
  const [hoveredBranch, setHoveredBranch] = useState<string | null>(null);

  // Fallback branches if breakdown is empty or missing any department
  const standardBranches = ['CSE', 'ECE', 'EEE', 'IT', 'CIVIL', 'MCA'];
  const normalizedData: BranchStat[] = standardBranches.map((branchCode) => {
    const existing = branchBreakdown?.find(
      (b) => b.branch.toUpperCase() === branchCode.toUpperCase()
    );
    return (
      existing || {
        branch: branchCode,
        total: 0,
        placed: 0,
        placementRate: 0,
      }
    );
  });

  // Calculate actual total placements across all departments
  const calculatedTotalPlaced = normalizedData.reduce((acc, curr) => acc + (curr.placed || 0), 0);
  const totalPlacedCount = propTotalPlaced !== undefined ? propTotalPlaced : calculatedTotalPlaced;

  // Compute slice proportions based on number of placements per department
  let cumulativeAngle = 0;
  const slices = normalizedData.map((dept) => {
    const placed = dept.placed || 0;
    const shareFraction = totalPlacedCount > 0 ? placed / totalPlacedCount : 0;
    const sharePercentage = Math.round(shareFraction * 1000) / 10; // 1 decimal place

    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + shareFraction * 360;
    cumulativeAngle = endAngle;

    const styling = DEPT_COLORS[dept.branch.toUpperCase()] || DEFAULT_DEPT;

    return {
      ...dept,
      shareFraction,
      sharePercentage,
      startAngle,
      endAngle,
      styling,
    };
  });

  const activeSlice = hoveredBranch
    ? slices.find((s) => s.branch === hoveredBranch)
    : null;

  return (
    <div
      className={`bg-[#101012] border border-neutral-800 rounded-3xl p-6 sm:p-7 text-white space-y-6 ${className}`}
      data-testid="department-placement-pie-chart"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800/80 pb-4">
        <div>
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="h-4 w-4 text-white" />
            {title}
          </h4>
          <p className="text-xs text-neutral-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 font-semibold">
            {totalPlacedCount} Total Placed
          </span>
          {totalStudents !== undefined && totalStudents > 0 && (
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-neutral-900/60 border border-neutral-800 text-neutral-400">
              {totalStudents} Enrolled
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* SVG Donut / Pie Chart Visual */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative py-2">
          <div className="relative w-56 h-56 flex items-center justify-center">
            <svg
              className="w-full h-full"
              viewBox="0 0 100 100"
              aria-label="Department Placement Share Pie Chart"
            >
              {/* Neutral background circular track */}
              <circle
                cx="50"
                cy="50"
                r="38"
                stroke="#27272a"
                strokeWidth="11"
                fill="transparent"
              />

              {/* Render mathematically exact pie/donut slices */}
              {totalPlacedCount > 0 ? (
                slices.map((slice) => {
                  if (slice.placed <= 0) return null;
                  const isHovered = hoveredBranch === slice.branch;
                  const innerR = isHovered ? 29 : 32.5;
                  const outerR = isHovered ? 45.5 : 43.5;
                  const pathD = describeDonutSlice(
                    50,
                    50,
                    innerR,
                    outerR,
                    slice.startAngle,
                    slice.endAngle
                  );

                  return (
                    <path
                      key={`${chartId}-${slice.branch}`}
                      d={pathD}
                      fill={slice.styling.fill}
                      stroke="#101012"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      className="transition-all duration-200 cursor-pointer"
                      onMouseEnter={() => setHoveredBranch(slice.branch)}
                      onMouseLeave={() => setHoveredBranch(null)}
                      style={{
                        filter: isHovered
                          ? 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.6))'
                          : undefined,
                      }}
                    />
                  );
                })
              ) : (
                <circle
                  cx="50"
                  cy="50"
                  r="38"
                  stroke="#3f3f46"
                  strokeWidth="11"
                  strokeDasharray="6 4"
                  fill="transparent"
                />
              )}
            </svg>

            {/* Center Dynamic Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
              {activeSlice ? (
                <>
                  <span className="text-[11px] font-bold tracking-wider text-neutral-300 uppercase">
                    {activeSlice.branch}
                  </span>
                  <span className="text-2xl font-black text-white font-mono mt-0.5">
                    {activeSlice.placed} Placed
                  </span>
                  <span className="text-[10px] text-neutral-400 font-medium">
                    {activeSlice.sharePercentage}% of placements
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest">
                    Total Placed
                  </span>
                  <span className="text-2xl font-black text-white font-mono mt-0.5">
                    {totalPlacedCount}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    across 6 streams
                  </span>
                </>
              )}
            </div>
          </div>

          <p className="text-[11px] text-neutral-500 mt-3 text-center">
            Hover over any department slice or legend item to view details
          </p>
        </div>

        {/* Breakdown List / Slices Portions Summary */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {slices.map((slice) => {
              const isHovered = hoveredBranch === slice.branch;
              const hasPlacements = slice.placed > 0;

              return (
                <div
                  key={slice.branch}
                  onMouseEnter={() => setHoveredBranch(slice.branch)}
                  onMouseLeave={() => setHoveredBranch(null)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isHovered
                      ? 'bg-neutral-800/90 border-white shadow-lg ring-1 ring-white/30'
                      : 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-md shrink-0 border shadow-xs"
                        style={{
                          backgroundColor: slice.styling.fill,
                          borderColor: slice.styling.border,
                        }}
                      />
                      <div className="min-w-0">
                        <span className={`text-xs font-bold block ${slice.styling.textClass}`}>
                          {slice.branch}
                        </span>
                        <span className="text-[10px] text-neutral-400 block truncate">
                          {slice.styling.label}
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold text-white shrink-0 px-2 py-0.5 rounded-md bg-black/40 border border-neutral-800">
                      {hasPlacements ? `${slice.sharePercentage}%` : '0%'}
                    </span>
                  </div>

                  {/* Progress Bar of slice share */}
                  <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, slice.sharePercentage))}%`,
                        backgroundColor: slice.styling.fill,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-neutral-400 mt-2 font-mono">
                    <span>
                      <strong className="text-white">{slice.placed}</strong> placed
                      {slice.total > 0 && ` / ${slice.total}`}
                    </span>
                    <span>
                      {slice.total > 0
                        ? `${slice.placementRate}% rate`
                        : 'No candidates'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stream summary note */}
          <div className="p-3 bg-neutral-950/70 border border-neutral-800/90 rounded-xl flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-white" />
              <span>Portion Formula:</span>
            </span>
            <code className="text-[11px] font-mono text-neutral-300">
              Department Placed ÷ Total Placements × 100%
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
