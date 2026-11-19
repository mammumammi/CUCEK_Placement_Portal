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

/**
 * Suggests an internal system field matching an arbitrary header string from a company template.
 */
export function suggestFieldForHeader(header: string): string {
  const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (norm.includes('reg') || norm.includes('usn') || norm.includes('urn') || norm.includes('univroll')) {
    return 'registrationNumber';
  }
  if (norm.includes('roll') || norm.includes('studentid') || norm.includes('idno') || norm.includes('enroll')) {
    return 'studentId';
  }
  if (norm.includes('fullname') || norm === 'name' || norm.includes('candidatename') || norm.includes('studentname')) {
    return 'name';
  }
  if (norm.includes('firstname') || norm.includes('fname')) {
    return 'firstName';
  }
  if (norm.includes('lastname') || norm.includes('surname')) {
    return 'lastName';
  }
  if (norm.includes('name') || norm.includes('candidate') || norm.includes('student')) {
    return 'name';
  }
  if (
    norm.includes('branch') ||
    norm.includes('dept') ||
    norm.includes('department') ||
    norm.includes('stream') ||
    norm.includes('course') ||
    norm.includes('discipline')
  ) {
    return 'branch';
  }
  if (norm.includes('batch') || norm.includes('passout') || norm.includes('gradyear') || norm.includes('passingyear')) {
    return 'batch';
  }
  if (norm.includes('cgpa') || norm.includes('gpa') || norm.includes('pointer') || norm.includes('grade')) {
    return 'cgpa';
  }
  if (norm.includes('backlog') || norm.includes('arrear') || norm.includes('supply') || norm.includes('kt')) {
    return 'activeBacklogs';
  }
  if (norm.includes('email') || norm.includes('mail')) {
    return 'email';
  }
  if (norm.includes('phone') || norm.includes('mobile') || norm.includes('contact') || norm.includes('cell')) {
    return 'phone';
  }
  if (norm.includes('10th') || norm.includes('tenth') || norm.includes('ssc')) {
    return 'tenthPercentage';
  }
  if (norm.includes('12th') || norm.includes('twelfth') || norm.includes('hsc') || norm.includes('plustwo')) {
    return 'twelfthPercentage';
  }
  if (norm.includes('percent') || norm.includes('aggregate')) {
    return 'percentage';
  }
  if (norm.includes('dob') || norm.includes('birth')) {
    return 'dob';
  }
  if (norm.includes('gender') || norm.includes('sex')) {
    return 'gender';
  }
  if (norm.includes('resume') || norm.includes('cv') || norm.includes('link') || norm.includes('drive')) {
    return 'resumeUrl';
  }

  return header.trim();
}

/**
 * Parses an uploaded Excel template file buffer and extracts header column names and suggested mappings.
 */
export async function parseCompanyTemplateBuffer(buffer: Buffer): Promise<{
  headers: string[];
  suggestedColumns: Array<{ companyHeader: string; sourceField: string }>;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new PortalError('VALIDATION_ERROR', 'The uploaded Excel template contains no worksheets', 400);
  }

  // Find first row with cells
  let headers: string[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    if (headers.length === 0) {
      const rawValues = Array.isArray(row.values)
        ? row.values.slice(1) // ExcelJS row.values is 1-indexed
        : [];
      headers = rawValues
        .map((v) => (v !== null && v !== undefined ? String(v).trim() : ''))
        .filter(Boolean);
    }
  });

  if (headers.length === 0) {
    throw new PortalError('VALIDATION_ERROR', 'No header row detected in the uploaded Excel template', 400);
  }

  const suggestedColumns = headers.map((h) => ({
    companyHeader: h,
    sourceField: suggestFieldForHeader(h),
  }));

  return { headers, suggestedColumns };
}

/**
 * Extracts candidate value given a candidate object and a sourceField key.
 */
export function extractCandidateFieldValue(c: Record<string, any>, sourceField: string): unknown {
  const normKey = sourceField.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normKey === 'studentid' || normKey === 'student' || normKey === 'id') {
    return c.studentId || c.registrationNumber || '';
  }
  if (
    normKey === 'registrationnumber' ||
    normKey === 'regno' ||
    normKey === 'usn' ||
    normKey === 'urn' ||
    normKey === 'univroll'
  ) {
    return c.registrationNumber || c.studentId || '';
  }
  if (normKey === 'name' || normKey === 'fullname' || normKey === 'candidate') {
    return c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '';
  }
  if (normKey === 'firstname') return c.firstName || '';
  if (normKey === 'lastname') return c.lastName || '';
  if (normKey === 'branch' || normKey === 'department' || normKey === 'dept') return c.branch || '';
  if (normKey === 'batch' || normKey === 'year') return c.batch || '';
  if (normKey === 'cgpa' || normKey === 'gpa' || normKey === 'pointer') return c.cgpa;
  if (normKey === 'activebacklogs' || normKey === 'backlogs' || normKey === 'arrears' || normKey === 'supply') {
    return c.activeBacklogs;
  }
  if (normKey === 'email' || normKey === 'emailid' || normKey === 'mail') return c.email || '';
  if (normKey === 'phone' || normKey === 'contact' || normKey === 'mobile') return c.phone || '';
  if (normKey === 'percentage' || normKey === 'percent') return c.percentage || '';
  if (normKey === 'dob' || normKey === 'dateofbirth') return c.dob || '';
  if (normKey === 'age') return c.age || '';
  if (normKey === 'resumeurl' || normKey === 'resume' || normKey === 'cv') return c.resumeUrl || '';
  if (normKey === 'placed') return c.placed ? 'YES' : 'NO';
  if (normKey === 'verified') return c.verified ? 'YES' : 'NO';

  // Check extraData dynamically
  if (c.extraData && typeof c.extraData === 'object') {
    if (c.extraData[sourceField] !== undefined) return c.extraData[sourceField];
    for (const [k, v] of Object.entries(c.extraData)) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey) {
        return v;
      }
    }
  }

  // Check direct object field
  if (c[sourceField] !== undefined) return c[sourceField];

  return '';
}

/**
 * Builds an Excel workbook formatted exactly according to the company's required column schema.
 */
export async function buildCompanyFormatWorkbook(
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

  // Query verified candidates
  const candidateQuery = db
    .select({
      studentId: studentProfiles.studentId,
      registrationNumber: studentProfiles.registrationNumber,
      name: studentProfiles.name,
      firstName: studentProfiles.firstName,
      lastName: studentProfiles.lastName,
      dob: studentProfiles.dob,
      age: studentProfiles.age,
      branch: studentProfiles.branch,
      batch: studentProfiles.batch,
      cgpa: studentProfiles.cgpa,
      activeBacklogs: studentProfiles.activeBacklogs,
      email: studentProfiles.email,
      phone: studentProfiles.phone,
      percentage: studentProfiles.percentage,
      resumeUrl: studentProfiles.resumeUrl,
      marksheetUrl: studentProfiles.marksheetUrl,
      extraData: applications.extraData,
      verified: applications.verified,
      placed: applications.placed,
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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Placement Portal - Company Format Generator';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`${drive.company.slice(0, 20)} Candidates`);

  // Determine columns
  const companyColumns: Array<{ companyHeader: string; sourceField: string }> =
    Array.isArray(drive.companyFormat) && drive.companyFormat.length > 0
      ? drive.companyFormat
      : [
          { companyHeader: 'Roll Number', sourceField: 'studentId' },
          { companyHeader: 'Registration Number', sourceField: 'registrationNumber' },
          { companyHeader: 'Candidate Name', sourceField: 'name' },
          { companyHeader: 'Department / Branch', sourceField: 'branch' },
          { companyHeader: 'Graduation Batch', sourceField: 'batch' },
          { companyHeader: 'CGPA', sourceField: 'cgpa' },
          { companyHeader: 'Active Backlogs', sourceField: 'activeBacklogs' },
          { companyHeader: 'Email ID', sourceField: 'email' },
          { companyHeader: 'Mobile Number', sourceField: 'phone' },
          { companyHeader: 'Resume URL', sourceField: 'resumeUrl' },
          ...(drive.extraFields ?? []).map((f) => ({
            companyHeader: f.label || f.key,
            sourceField: f.key,
          })),
        ];

  // Add Header Row
  const headerRow = sheet.addRow(companyColumns.map((col) => col.companyHeader));
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Slate-800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };

  // Add Candidate Data Rows
  for (const c of verifiedCandidates) {
    const rowValues = companyColumns.map((col) => {
      const val = extractCandidateFieldValue(c, col.sourceField);
      return sanitizeCellValue(val !== undefined && val !== null ? val : '');
    });
    sheet.addRow(rowValues);
  }

  // Auto-fit column widths
  sheet.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellLen = cell.value ? String(cell.value).length : 0;
      if (cellLen > maxLen) maxLen = Math.min(cellLen + 3, 40);
    });
    col.width = maxLen;
  });

  return workbook;
}

