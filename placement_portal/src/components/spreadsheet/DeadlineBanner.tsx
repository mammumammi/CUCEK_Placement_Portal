'use client';

/**
 * @fileoverview DeadlineBanner component notifying users if the application window has closed.
 * @module components/spreadsheet/DeadlineBanner
 */

import React from 'react';

export interface DeadlineBannerProps {
  deadline: string;
}

/**
 * Renders an alert banner if the deadline has passed, or null otherwise.
 *
 * @param props.deadline - ISO timestamp string of the drive's cutoff deadline.
 */
export function DeadlineBanner({ deadline }: DeadlineBannerProps) {
  if (!deadline) {
    return null;
  }

  const deadlineTime = new Date(deadline).getTime();
  const isPast = deadlineTime < Date.now();

  if (!isPast) {
    return null;
  }

  return (
    <div
      role="alert"
      className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 font-medium rounded-md shadow-sm mb-4 flex items-center justify-between"
    >
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-red-500 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>Deadline has passed</span>
      </div>
    </div>
  );
}

export default DeadlineBanner;

