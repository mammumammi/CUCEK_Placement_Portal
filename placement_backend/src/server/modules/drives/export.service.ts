/**
 * @fileoverview Excel spreadsheet export service for recruitment drives using exceljs.
 * Generates verified candidate reports and branch-wise summary metrics with formula injection neutralization.
 * @module server/modules/drives/export.service
 */

import ExcelJS from 'exceljs';
import { eq, and, asc } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { drives, studentProfiles, applications } from '@/core/db';
import { PortalError } from '@/core/errors/portal-error';
import { getDriveStats, type DriveActor } from './drives.service';

/**
 * Sanitizes cell values to neutralize CSV/Excel Formula Injection vulnerabilities.
 * If a string begins with '=', '+', '-', or '@', it is escaped with a prepended single quote (').
 *
 * @param val - The raw cell value.
 * @returns Escaped string or original value.
 */
export function sanitizeCellValue(val: unknown): unknown {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (
      trimmed.startsWith('=') ||
      trimmed.startsWith('+') ||
      trimmed.startsWith('-') ||
      trimmed.startsWith('@')
    ) {
      return `'${val}`;
    }
  }
  return val;
}

/**
 * Builds a two-sheet Excel workbook for a recruitment drive:
 * 1. "Consolidated Candidates": Verified candidates only with core academic profiles and extraFields.
 * 2. "Branch-Wise Summary": Funnel metrics per branch with a totals summary row.
 *
 * @param db - Database instance.
 * @param driveId - Drive unique identifier.
 * @param actor - Authenticated coordinator requesting the export.
 * @returns Configured ExcelJS Workbook ready for streaming or buffer generation.
 */
export async function buildDriveExportWorkbook(
  db: Db,
  driveId: string,
  actor: DriveActor
): Promise<ExcelJS.Workbook> {
  const [drive] = await db
    .select()
    .from(drives)
    .where(eq(drives.id, driveId))
    .limit(1);

  if (!drive) {
    throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
  }

  // 1. Fetch branch stats
  const stats = await getDriveStats(db, driveId, actor);

  // 2. Fetch verified candidates
  const candidateQuery = db
    .select({
      studentId: studentProfiles.studentId,
      name: studentProfiles.name,
      branch: studentProfiles.branch,
      batch: studentProfiles.batch,
      cgpa: studentProfiles.cgpa,
      activeBacklogs: studentProfiles.activeBacklogs,
      email: studentProfiles.email,
      phone: studentProfiles.phone,
      resumeUrl: studentProfiles.resumeUrl,
      extraData: applications.extraData,
      verified: applications.verified,
    })
    .from(applications)
    .innerJoin(studentProfiles, eq(applications.studentUserId, studentProfiles.userId))
    .where(
      and(
        eq(applications.driveId, driveId),
        eq(applications.verified, true),
        actor.role === 'BRANCH_COORDINATOR' && actor.branch
          ? eq(studentProfiles.branch, actor.branch)
          : undefined
      )
    )
    .orderBy(asc(studentProfiles.studentId));

  const verifiedCandidates = await candidateQuery;

  // 3. Initialize ExcelJS Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Placement Portal';
  workbook.created = new Date();

  // -------------------------------------------------------------
  // Worksheet 1: "Consolidated Candidates" (VERIFIED rows only)
  // -------------------------------------------------------------
  const sheet1 = workbook.addWorksheet('Consolidated Candidates');
  const extraFields = drive.extraFields ?? [];

  const headers1 = [
    'S.No',
    'studentId',
    'name',
    'branch',
    'batch',
    'cgpa',
    'activeBacklogs',
    'email',
    'phone',
    'resumeUrl',
    ...extraFields.map((f) => f.label || f.key),
  ];
  sheet1.addRow(headers1);

  // Add verified candidate rows
  for (let i = 0; i < verifiedCandidates.length; i++) {
    const c = verifiedCandidates[i];
    const rowValues = [
      i + 1,
      sanitizeCellValue(c.studentId),
      sanitizeCellValue(c.name),
      sanitizeCellValue(c.branch),
      sanitizeCellValue(c.batch),
      c.cgpa,
      c.activeBacklogs,
      sanitizeCellValue(c.email),
      sanitizeCellValue(c.phone),
      sanitizeCellValue(c.resumeUrl),
      ...extraFields.map((f) => {
        const val = c.extraData?.[f.key];
        return sanitizeCellValue(val !== undefined && val !== null ? val : '');
      }),
    ];
    sheet1.addRow(rowValues);
  }

  // -------------------------------------------------------------
  // Worksheet 2: "Branch-Wise Summary" (Funnel metrics + Totals)
  // -------------------------------------------------------------
  const sheet2 = workbook.addWorksheet('Branch-Wise Summary');
  const roundHeaders = Array.from(
    { length: drive.totalRounds },
    (_, i) => `Round ${i + 1}`
  );

  const headers2 = ['Branch', 'Applied', ...roundHeaders, 'Placed'];
  sheet2.addRow(headers2);

  // Per-branch summary rows
  for (const b of stats.branches) {
    sheet2.addRow([
      sanitizeCellValue(b.branch),
      b.applied,
      ...b.shortlistedByRound,
      b.placed,
    ]);
  }

  // Final Totals row
  sheet2.addRow([
    'Total',
    stats.totals.applied,
    ...stats.totals.shortlistedByRound,
    stats.totals.placed,
  ]);

  return workbook;
}

