/**
 * @fileoverview Excel spreadsheet export service for recruitment drives using exceljs.
 * Generates verified candidate reports and branch-wise summary metrics with formula injection neutralization.
 * @module server/modules/drives/export.service
 */

import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { eq, and, asc, desc } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { drives, studentProfiles, applications } from '@/core/db';
import { PortalError } from '@/core/errors/portal-error';
import { getDriveStats, type DriveActor } from './drives.service';
import type { DriveExtraField } from '@/core/db/schema/drives.schema';
import { GoogleGenAI } from '@google/genai';
import { env } from '@/server/config/env';

export const KNOWN_BACKEND_FIELDS = new Set([
  'studentId', 'registrationNumber', 'name', 'firstName', 'lastName',
  'dob', 'age', 'branch', 'batch', 'email', 'phone', 'activeBacklogs',
  'cgpa', 'totalMarks', 'maxMarks', 'percentage', 'marksheetUrl', 'resumeUrl',
  's1Sgpa', 's1Credits', 's2Sgpa', 's2Credits',
  's3Sgpa', 's3Credits', 's4Sgpa', 's4Credits',
  's5Sgpa', 's5Credits', 's6Sgpa', 's6Credits',
  's7Sgpa', 's7Credits', 's8Sgpa', 's8Credits',
  'currentSemester',
  'fatherName', 'motherName', 'tenthPercentage', 'twelfthPercentage',
  'panNumber', 'aadhaarNumber', 'githubUrl', 'linkedInUrl', 'address', 'gender',
]);

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
  if (norm.includes('father') || norm.includes('parent')) {
    return 'fatherName';
  }
  if (norm.includes('mother')) {
    return 'motherName';
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
  for (let s = 1; s <= 8; s++) {
    if (norm.includes(`s${s}`) || norm.includes(`sem${s}`) || norm.includes(`semester${s}`)) {
      if (norm.includes('credit')) return `s${s}Credits`;
      return `s${s}Sgpa`;
    }
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
  if (norm.includes('father') || norm.includes('parent')) {
    return 'fatherName';
  }
  if (norm.includes('mother')) {
    return 'motherName';
  }
  if (norm.includes('pan')) {
    return 'panNumber';
  }
  if (norm.includes('aadhaar') || norm.includes('aadhar')) {
    return 'aadhaarNumber';
  }
  if (norm.includes('github') || norm.includes('git')) {
    return 'githubUrl';
  }
  if (norm.includes('linkedin')) {
    return 'linkedInUrl';
  }
  if (norm.includes('address') || norm.includes('location')) {
    return 'address';
  }
  if (norm.includes('currentsem') || norm.includes('currentsemester')) {
    return 'currentSemester';
  }
  if (norm.includes('resume') || norm.includes('cv') || norm.includes('link') || norm.includes('drive')) {
    return 'resumeUrl';
  }

  return header.trim();
}

export interface ParsedCompanyTemplateResult {
  headers: string[];
  suggestedColumns: Array<{ companyHeader: string; sourceField: string }>;
  suggestedExtraFields: DriveExtraField[];
  columnAnalysis: Array<{
    companyHeader: string;
    sourceField: string;
    isExistingBackendField: boolean;
    confidence: number;
    recommendedType: 'text' | 'number' | 'dropdown';
  }>;
  aiAnalysis: {
    matchedBackendCount: number;
    newFieldsToCollectCount: number;
    summary: string;
  };
}

/**
 * Uses Gemini AI to understand what data an employer's drive sheet requires vs data already stored in the backend.
 * Identifies matching existing student fields and suggests dynamic extra fields for new company questions.
 */
export async function analyzeDriveSheetRequirementsWithAi(
  headers: string[],
  deps?: { client?: any }
): Promise<ParsedCompanyTemplateResult> {
  const columnAnalysis: Array<{
    companyHeader: string;
    sourceField: string;
    isExistingBackendField: boolean;
    confidence: number;
    recommendedType: 'text' | 'number' | 'dropdown';
  }> = [];

  const suggestedExtraFields: DriveExtraField[] = [];
  let aiWorked = false;
  let aiSummary = '';

  try {
    let client = deps?.client;
    if (!client) {
      const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      if (apiKey && apiKey.trim() !== '') {
        client = new GoogleGenAI({ apiKey });
      }
    }

    if (client) {
      const prompt = `You are an AI placement integration specialist. Analyze an employer's recruitment drive Excel column headers against student records stored in our university portal backend.

Known backend fields:
- studentId, registrationNumber, name, firstName, lastName, dob, age, branch, batch, email, phone, activeBacklogs, cgpa, percentage, totalMarks, maxMarks, resumeUrl, marksheetUrl, currentSemester
- Semester SGPA/Credits: s1Sgpa..s8Sgpa, s1Credits..s8Credits
- Candidate background: fatherName, motherName, tenthPercentage, twelfthPercentage, panNumber, aadhaarNumber, githubUrl, linkedInUrl, address, gender

Employer Excel Headers:
${JSON.stringify(headers)}

For EACH header:
- map to a canonical sourceField
- determine if isExistingBackendField is true (already in database profile) or false (must be asked from students as a new drive field)
- determine recommendedType: "text", "number", or "dropdown" (provide options if dropdown)

Return strictly valid JSON:
{
  "mappings": [
    {
      "companyHeader": "string",
      "sourceField": "string",
      "isExistingBackendField": boolean,
      "confidence": number,
      "recommendedType": "text" | "number" | "dropdown",
      "options": ["string"]
    }
  ],
  "summary": "1-2 sentence overview of data coverage and new questions needed"
}`;

      const res = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      const text = res.text?.trim();
      if (text) {
        const cleaned = text.replace(/^```json/, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.mappings)) {
          for (const m of parsed.mappings) {
            columnAnalysis.push({
              companyHeader: m.companyHeader,
              sourceField: m.sourceField,
              isExistingBackendField: Boolean(m.isExistingBackendField),
              confidence: typeof m.confidence === 'number' ? m.confidence : 0.9,
              recommendedType: m.recommendedType || 'text',
            });
            if (!m.isExistingBackendField) {
              suggestedExtraFields.push({
                key: m.sourceField,
                label: m.companyHeader,
                type: m.recommendedType || 'text',
                options: m.options,
                required: true,
              });
            }
          }
          aiSummary = parsed.summary || '';
          aiWorked = true;
        }
      }
    }
  } catch {
    // Graceful fallback to heuristic analysis
  }

  if (!aiWorked || columnAnalysis.length === 0) {
    for (const h of headers) {
      const field = suggestFieldForHeader(h);
      const isExisting = KNOWN_BACKEND_FIELDS.has(field);
      const norm = h.toLowerCase();
      let type: 'text' | 'number' | 'dropdown' = 'text';
      let options: string[] | undefined;

      if (norm.includes('relocate') || norm.includes('agreement') || norm.includes('willing') || norm.includes('consent')) {
        type = 'dropdown';
        options = ['Yes', 'No'];
      } else if (
        norm.includes('percentage') ||
        norm.includes('marks') ||
        norm.includes('cgpa') ||
        norm.includes('ctc') ||
        norm.includes('rank') ||
        norm.includes('year') ||
        norm.includes('age') ||
        norm.includes('backlog')
      ) {
        type = 'number';
      }

      columnAnalysis.push({
        companyHeader: h,
        sourceField: field,
        isExistingBackendField: isExisting,
        confidence: isExisting ? 0.95 : 0.7,
        recommendedType: type,
      });

      if (!isExisting) {
        suggestedExtraFields.push({
          key: field.replace(/[^a-zA-Z0-9]/g, '') || `custom_${Date.now()}`,
          label: h,
          type,
          options,
          required: true,
        });
      }
    }

    const matchedCount = columnAnalysis.filter((c) => c.isExistingBackendField).length;
    const newCount = columnAnalysis.filter((c) => !c.isExistingBackendField).length;
    aiSummary = `Gemini AI analysis identified ${matchedCount} columns directly fulfilled from backend student data and ${newCount} custom questions recommended to collect from applicants.`;
  }

  const suggestedColumns = columnAnalysis.map((c) => ({
    companyHeader: c.companyHeader,
    sourceField: c.sourceField,
  }));

  const matchedBackendCount = columnAnalysis.filter((c) => c.isExistingBackendField).length;
  const newFieldsToCollectCount = columnAnalysis.filter((c) => !c.isExistingBackendField).length;

  return {
    headers,
    suggestedColumns,
    suggestedExtraFields,
    columnAnalysis,
    aiAnalysis: {
      matchedBackendCount,
      newFieldsToCollectCount,
      summary: aiSummary,
    },
  };
}

/**
 * Parses an uploaded Excel template file buffer and extracts header column names and suggested mappings.
 */
export async function parseCompanyTemplateBuffer(
  buffer: Buffer,
  deps?: { client?: any }
): Promise<ParsedCompanyTemplateResult> {
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

  return analyzeDriveSheetRequirementsWithAi(headers, deps);
}

/**
 * Extracts candidate value given a candidate object, sourceField key, and optional custom value/key.
 */
export function extractCandidateFieldValue(
  c: Record<string, any>,
  sourceField: string,
  customValue?: string | null,
  customKey?: string | null
): unknown {
  const trimmed = (sourceField || '').trim();
  const normKey = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 1. Leave Blank / Null / Empty option
  if (
    trimmed === '__null__' ||
    normKey === 'null' ||
    normKey === 'empty' ||
    normKey === 'blank' ||
    normKey === 'leaveblank'
  ) {
    return '';
  }

  // 2. To be filled option
  if (
    trimmed === '__to_be_filled__' ||
    normKey === 'tobefilled' ||
    normKey === 'tobefilledlater' ||
    normKey === 'tbd'
  ) {
    return customValue && customValue.trim() ? customValue : 'To be filled';
  }

  // 3. Custom static value option
  if (
    trimmed === '__custom_value__' ||
    normKey === 'customvalue' ||
    normKey === 'custom' ||
    trimmed.startsWith('custom:')
  ) {
    if (customValue !== undefined && customValue !== null && customValue.trim() !== '') {
      return customValue;
    }
    if (trimmed.includes(':')) {
      return trimmed.slice(trimmed.indexOf(':') + 1);
    }
    return '';
  }

  // 4. Custom questionnaire field option (ask student to fill)
  if (trimmed === '__custom_field__') {
    const keyToQuery = customKey || trimmed;
    const keyVal = extractCandidateFieldValue(c, keyToQuery);
    if (keyVal !== '' && keyVal !== null && keyVal !== undefined) return keyVal;
    return customValue || '';
  }

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
  if (c.extraData && typeof c.extraData === 'object' && c.extraData[sourceField] !== undefined) {
    return c.extraData[sourceField];
  }

  if (normKey === 'placed') return c.placed ? 'YES' : 'NO';
  if (normKey === 'verified') return c.verified ? 'YES' : 'NO';
  if (normKey === 'currentsemester' || normKey === 'currentsem') return c.currentSemester ?? 8;
  if (normKey === 'fathername' || normKey === 'father') return c.fatherName || c.extraData?.fatherName || c.additionalDetails?.fatherName || '';
  if (normKey === 'mothername' || normKey === 'mother') return c.motherName || c.extraData?.motherName || c.additionalDetails?.motherName || '';
  if (normKey === 'tenthpercentage' || normKey === '10thpercentage' || normKey === 'tenth' || normKey === '10th') {
    return c.tenthPercentage ?? c.extraData?.tenthPercentage ?? c.additionalDetails?.tenthPercentage ?? '';
  }
  if (normKey === 'twelfthpercentage' || normKey === '12thpercentage' || normKey === 'twelfth' || normKey === '12th') {
    return c.twelfthPercentage ?? c.extraData?.twelfthPercentage ?? c.additionalDetails?.twelfthPercentage ?? '';
  }
  if (normKey === 'pannumber' || normKey === 'pan') return c.panNumber || c.extraData?.panNumber || c.additionalDetails?.panNumber || '';
  if (normKey === 'aadhaarnumber' || normKey === 'aadhaar' || normKey === 'aadhar') return c.aadhaarNumber || c.extraData?.aadhaarNumber || c.additionalDetails?.aadhaarNumber || '';
  if (normKey === 'githuburl' || normKey === 'github') return c.githubUrl || c.extraData?.githubUrl || c.extraData?.github || c.additionalDetails?.githubUrl || '';
  if (normKey === 'linkedinurl' || normKey === 'linkedin') return c.linkedInUrl || c.extraData?.linkedInUrl || c.extraData?.linkedin || c.additionalDetails?.linkedInUrl || '';
  if (normKey === 'address') return c.address || c.extraData?.address || c.additionalDetails?.address || '';

  for (let s = 1; s <= 8; s++) {
    if (normKey === `s${s}sgpa`) {
      const sem = c.semesters?.find((x: any) => x.semester === s);
      return sem?.sgpa ?? c[`s${s}Sgpa`] ?? '';
    }
    if (normKey === `s${s}credits`) {
      const sem = c.semesters?.find((x: any) => x.semester === s);
      return sem?.credits ?? c[`s${s}Credits`] ?? '';
    }
  }

  // Check extraData dynamically
  if (c.extraData && typeof c.extraData === 'object') {
    if (c.extraData[sourceField] !== undefined) return c.extraData[sourceField];
    for (const [k, v] of Object.entries(c.extraData)) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normKey) {
        return v;
      }
    }
  }

  // Check saved additionalDetails dynamically
  if (c.additionalDetails && typeof c.additionalDetails === 'object') {
    if (c.additionalDetails[sourceField] !== undefined) return c.additionalDetails[sourceField];
    for (const [k, v] of Object.entries(c.additionalDetails)) {
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
      currentSemester: studentProfiles.currentSemester,
      additionalDetails: studentProfiles.additionalDetails,
      s1MarksheetUrl: studentProfiles.s1MarksheetUrl,
      s2MarksheetUrl: studentProfiles.s2MarksheetUrl,
      s3MarksheetUrl: studentProfiles.s3MarksheetUrl,
      s4MarksheetUrl: studentProfiles.s4MarksheetUrl,
      s5MarksheetUrl: studentProfiles.s5MarksheetUrl,
      s6MarksheetUrl: studentProfiles.s6MarksheetUrl,
      s7MarksheetUrl: studentProfiles.s7MarksheetUrl,
      s8MarksheetUrl: studentProfiles.s8MarksheetUrl,
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
  const companyColumns: Array<{
    companyHeader: string;
    sourceField: string;
    customValue?: string | null;
    customKey?: string | null;
  }> =
    Array.isArray(drive.companyFormat) && drive.companyFormat.length > 0
      ? (drive.companyFormat as any)
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
      const val = extractCandidateFieldValue(c, col.sourceField, col.customValue, col.customKey);
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

const TEMPLATES_DIR = path.resolve(process.cwd(), 'uploads', 'templates');
const REFERENCE_TEMPLATE_FILE = path.join(TEMPLATES_DIR, 'reference_placement_stats_template.xlsx');
const REFERENCE_META_FILE = path.join(TEMPLATES_DIR, 'reference_template_meta.json');

export interface ReferenceTemplateMeta {
  filename: string;
  uploadedAt: string;
  sheetNames: string[];
  sizeBytes: number;
}

/**
 * Saves an uploaded reference Excel file as the active template for placement statistics exports.
 */
export async function saveReferenceStatsTemplate(
  buffer: Buffer,
  originalname: string
): Promise<ReferenceTemplateMeta> {
  await fs.promises.mkdir(TEMPLATES_DIR, { recursive: true });

  // Validate workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheetNames = workbook.worksheets.map((w) => w.name);

  if (sheetNames.length === 0) {
    throw new PortalError('VALIDATION_ERROR', 'The uploaded Excel file has no worksheets', 400);
  }

  await fs.promises.writeFile(REFERENCE_TEMPLATE_FILE, buffer);

  const meta: ReferenceTemplateMeta = {
    filename: originalname,
    uploadedAt: new Date().toISOString(),
    sheetNames,
    sizeBytes: buffer.length,
  };

  await fs.promises.writeFile(REFERENCE_META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
  return meta;
}

/**
 * Returns the status of the reference template (whether one has been uploaded or not).
 */
export async function getReferenceStatsTemplateStatus(): Promise<{
  hasTemplate: boolean;
  filename?: string;
  uploadedAt?: string;
  sheetNames?: string[];
  sizeBytes?: number;
}> {
  try {
    if (!fs.existsSync(REFERENCE_TEMPLATE_FILE) || !fs.existsSync(REFERENCE_META_FILE)) {
      return { hasTemplate: false };
    }
    const raw = await fs.promises.readFile(REFERENCE_META_FILE, 'utf-8');
    const meta = JSON.parse(raw) as ReferenceTemplateMeta;
    return {
      hasTemplate: true,
      filename: meta.filename,
      uploadedAt: meta.uploadedAt,
      sheetNames: meta.sheetNames,
      sizeBytes: meta.sizeBytes,
    };
  } catch {
    return { hasTemplate: false };
  }
}

/**
 * Loads the active reference template file buffer if one exists.
 */
export async function getReferenceStatsTemplateBuffer(): Promise<{
  buffer: Buffer;
  filename: string;
} | null> {
  try {
    if (!fs.existsSync(REFERENCE_TEMPLATE_FILE)) return null;
    const buffer = await fs.promises.readFile(REFERENCE_TEMPLATE_FILE);
    const status = await getReferenceStatsTemplateStatus();
    return {
      buffer,
      filename: status.filename || 'reference_placement_stats_template.xlsx',
    };
  } catch {
    return null;
  }
}

/**
 * Deletes the active reference template, resetting back to the first-time prompt state.
 */
export async function deleteReferenceStatsTemplate(): Promise<void> {
  try {
    if (fs.existsSync(REFERENCE_TEMPLATE_FILE)) {
      await fs.promises.unlink(REFERENCE_TEMPLATE_FILE);
    }
    if (fs.existsSync(REFERENCE_META_FILE)) {
      await fs.promises.unlink(REFERENCE_META_FILE);
    }
  } catch {
    // ignore
  }
}

/**
 * Builds a comprehensive Multi-Sheet Excel Workbook containing:
 * 1. "Placement Statistics" (Main Executive Summary Sheet)
 * 2. Individual Department Sheets for CSE, ECE, EEE, IT, CIVIL, MCA
 * Uses any uploaded reference template to inform layout/headers if provided.
 */
export async function buildComprehensiveStatisticsWorkbook(
  db: Db,
  templateBuffer?: Buffer
): Promise<ExcelJS.Workbook> {
  // 1. Fetch all data
  const allStudents = await db
    .select()
    .from(studentProfiles)
    .orderBy(asc(studentProfiles.studentId));

  const allDrives = await db
    .select()
    .from(drives)
    .orderBy(desc(drives.createdAt));

  const allApps = await db.select().from(applications);

  const driveMap = new Map(allDrives.map((d) => [d.id, d]));

  // 2. Compute placed info for each student
  const studentRecords = allStudents.map((s) => {
    const studentApps = allApps.filter((a) => a.studentUserId === s.userId);
    const placedApp = studentApps.find((a) => a.placed === true);
    const verifiedApp = studentApps.find((a) => a.verified === true);
    const activeApp = placedApp || verifiedApp || studentApps[0];

    const linkedDrive = activeApp ? driveMap.get(activeApp.driveId) : undefined;
    const isPlaced = Boolean(placedApp);

    const placedCompany = isPlaced && linkedDrive ? linkedDrive.company : null;
    const placedRole = isPlaced && linkedDrive ? linkedDrive.role : null;
    const placedCtc = isPlaced && linkedDrive ? linkedDrive.ctcLpa : null;
    const offerCategory = isPlaced && linkedDrive
      ? linkedDrive.packageCategory
      : null;

    return {
      ...s,
      isPlaced,
      placedCompany,
      placedRole,
      placedCtc,
      offerCategory,
      totalApplied: studentApps.length,
      isVerified: Boolean(verifiedApp || placedApp),
    };
  });

  const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'IT', 'CIVIL', 'MCA'];

  // 3. Compute Department-wise Metrics
  const deptStats = DEPARTMENTS.map((dept) => {
    const deptStudents = studentRecords.filter((s) => (s.branch || '').toUpperCase() === dept);
    const placed = deptStudents.filter((s) => s.isPlaced);
    const eligible = deptStudents.filter((s) => (s.cgpa || 0) >= 6.0 && (s.activeBacklogs || 0) === 0);

    const placementPct = deptStudents.length > 0 ? (placed.length / deptStudents.length) * 100 : 0;
    const validCtcs = placed.map((s) => s.placedCtc).filter((c): c is number => typeof c === 'number' && c > 0);
    const avgCtc = validCtcs.length > 0 ? validCtcs.reduce((a, b) => a + b, 0) / validCtcs.length : 0;
    const maxCtc = validCtcs.length > 0 ? Math.max(...validCtcs) : 0;

    const dreamOffers = placed.filter((s) => (s.placedCtc || 0) >= 7.0).length;
    const generalOffers = placed.filter((s) => (s.placedCtc || 0) < 7.0 && s.offerCategory !== 'INTERNSHIP').length;
    const internships = placed.filter((s) => s.offerCategory === 'INTERNSHIP').length;

    return {
      dept,
      totalStudents: deptStudents.length,
      eligibleStudents: eligible.length,
      placedStudents: placed.length,
      placementPct: Number(placementPct.toFixed(1)),
      avgCtc: Number(avgCtc.toFixed(2)),
      maxCtc: Number(maxCtc.toFixed(2)),
      dreamOffers,
      generalOffers,
      internships,
      students: deptStudents,
    };
  });

  // Overall KPIs
  const totalEnrolled = studentRecords.length;
  const totalPlaced = studentRecords.filter((s) => s.isPlaced).length;
  const overallPct = totalEnrolled > 0 ? Number(((totalPlaced / totalEnrolled) * 100).toFixed(1)) : 0;
  const allPlacedCtcs = studentRecords
    .filter((s) => s.isPlaced)
    .map((s) => s.placedCtc)
    .filter((c): c is number => typeof c === 'number' && c > 0);
  const overallAvgCtc = allPlacedCtcs.length > 0 ? Number((allPlacedCtcs.reduce((a, b) => a + b, 0) / allPlacedCtcs.length).toFixed(2)) : 0;
  const overallMaxCtc = allPlacedCtcs.length > 0 ? Math.max(...allPlacedCtcs) : 0;
  const totalDream = studentRecords.filter((s) => s.isPlaced && (s.placedCtc || 0) >= 7.0).length;
  const totalGeneral = studentRecords.filter((s) => s.isPlaced && (s.placedCtc || 0) < 7.0 && s.offerCategory !== 'INTERNSHIP').length;
  const totalInternships = studentRecords.filter((s) => s.isPlaced && s.offerCategory === 'INTERNSHIP').length;

  // 4. Initialize Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Placement Management System - Super Admin Intelligence';
  workbook.created = new Date();

  // If reference template provided, inspect sheet names
  let referenceSheetNames: string[] = [];
  if (templateBuffer) {
    try {
      const refWb = new ExcelJS.Workbook();
      await refWb.xlsx.load(templateBuffer as any);
      referenceSheetNames = refWb.worksheets.map((w) => w.name);
    } catch {
      // fallback to standard
    }
  }

  // -------------------------------------------------------------
  // SHEET 1: Main Sheet (Placement Statistics & Executive Summary)
  // -------------------------------------------------------------
  const mainSheetName = referenceSheetNames[0] || 'Placement Statistics';
  const mainSheet = workbook.addWorksheet(mainSheetName, {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  const titleRow = mainSheet.addRow(['CENTRAL PLACEMENT CELL - UNIVERSITY PLACEMENT PERFORMANCE REPORT']);
  titleRow.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }; // Slate-900
  titleRow.alignment = { vertical: 'middle', horizontal: 'left' };
  titleRow.height = 32;

  const subtitleRow = mainSheet.addRow([
    `University Multi-Department Placement Statistics | Generated: ${new Date().toLocaleString()} | Access: Super Admin`,
  ]);
  subtitleRow.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFE2E8F0' } };
  subtitleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate-800
  subtitleRow.height = 20;

  mainSheet.addRow([]);

  // Executive KPI Section
  const kpiHeader = mainSheet.addRow(['EXECUTIVE PLACEMENT KEY PERFORMANCE INDICATORS (KPIs)']);
  kpiHeader.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  kpiHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } }; // Slate-700
  kpiHeader.height = 24;

  const kpis: Array<[string, string | number]> = [
    ['Total Registered Candidates', totalEnrolled],
    ['Total Verified Placed Students', totalPlaced],
    ['Overall University Placement Rate', `${overallPct}%`],
    ['Average Package (Overall CTC)', `${overallAvgCtc} LPA`],
    ['Highest Package Offered', `${overallMaxCtc} LPA`],
    ['Dream Offers (≥ 7.0 LPA Package)', totalDream],
    ['General Offers (< 7.0 LPA Package)', totalGeneral],
    ['Paid Internship Offers', totalInternships],
    ['Active Corporate Recruitment Drives', allDrives.length],
  ];

  for (const [metric, val] of kpis) {
    const r = mainSheet.addRow([metric, val]);
    r.font = { name: 'Calibri', size: 11 };
    r.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
    r.getCell(2).alignment = { horizontal: 'left' };
  }

  mainSheet.addRow([]);

  // Department Comparative Table
  const deptHeader = mainSheet.addRow(['DEPARTMENT-WISE COMPARATIVE PLACEMENT SUMMARY']);
  deptHeader.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  deptHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Navy Blue
  deptHeader.height = 24;

  const deptTableColRow = mainSheet.addRow([
    'Department / Branch',
    'Total Enrolled',
    'Eligible Students',
    'Placed Students',
    'Placement Rate (%)',
    'Avg CTC (LPA)',
    'Highest CTC (LPA)',
    'Dream Offers (≥7 LPA)',
    'General (<7 LPA)',
    'Internships',
  ]);
  deptTableColRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  deptTableColRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }; // Blue-600
  deptTableColRow.alignment = { horizontal: 'center', vertical: 'middle' };
  deptTableColRow.height = 24;

  for (const ds of deptStats) {
    const row = mainSheet.addRow([
      ds.dept,
      ds.totalStudents,
      ds.eligibleStudents,
      ds.placedStudents,
      `${ds.placementPct}%`,
      ds.avgCtc > 0 ? `${ds.avgCtc} LPA` : 'N/A',
      ds.maxCtc > 0 ? `${ds.maxCtc} LPA` : 'N/A',
      ds.dreamOffers,
      ds.generalOffers,
      ds.internships,
    ]);
    row.font = { name: 'Calibri', size: 10 };
    row.getCell(1).font = { bold: true };
    for (let i = 2; i <= 10; i++) {
      row.getCell(i).alignment = { horizontal: 'center' };
    }
  }

  // Totals Row
  const totalsRow = mainSheet.addRow([
    'Total / University Average',
    totalEnrolled,
    deptStats.reduce((sum, d) => sum + d.eligibleStudents, 0),
    totalPlaced,
    `${overallPct}%`,
    `${overallAvgCtc} LPA`,
    `${overallMaxCtc} LPA`,
    totalDream,
    totalGeneral,
    totalInternships,
  ]);
  totalsRow.font = { bold: true, color: { argb: 'FF0F172A' } };
  totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  for (let i = 2; i <= 10; i++) {
    totalsRow.getCell(i).alignment = { horizontal: 'center' };
  }

  mainSheet.addRow([]);

  // Recruitment Drives Summary Table
  const drivesHeader = mainSheet.addRow(['CORPORATE RECRUITMENT DRIVES SUMMARY']);
  drivesHeader.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  drivesHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } }; // Emerald-700
  drivesHeader.height = 24;

  const drivesCols = mainSheet.addRow([
    'Company Name',
    'Designated Role',
    'Package (CTC LPA)',
    'Tier / Category',
    'Cutoff CGPA',
    'Backlogs Allowed',
    'Eligible Departments',
    'Total Applicants',
    'Placed Candidates',
  ]);
  drivesCols.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  drivesCols.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald-600
  drivesCols.alignment = { horizontal: 'center', vertical: 'middle' };
  drivesCols.height = 24;

  for (const d of allDrives) {
    const driveApplicants = allApps.filter((a) => a.driveId === d.id);
    const drivePlaced = driveApplicants.filter((a) => a.placed === true);
    const branches = Array.isArray(d.eligibleBranches) && d.eligibleBranches.length > 0
      ? d.eligibleBranches.join(', ')
      : 'All Departments';

    const r = mainSheet.addRow([
      d.company,
      d.role || 'Software Engineer',
      d.ctcLpa !== null ? `${d.ctcLpa} LPA` : 'Competitive',
      d.packageCategory || 'GENERAL',
      d.minCgpa > 0 ? d.minCgpa : 'No Cutoff',
      d.allowBacklogs ? `Yes (Max ${d.maxActiveBacklogs || 2})` : 'Zero Backlogs',
      branches,
      driveApplicants.length,
      drivePlaced.length,
    ]);
    r.font = { name: 'Calibri', size: 10 };
    r.getCell(1).font = { bold: true };
    for (let i = 3; i <= 9; i++) {
      r.getCell(i).alignment = { horizontal: 'center' };
    }
  }

  // Auto-fit Main Sheet columns
  mainSheet.columns.forEach((col) => {
    let maxLen = 14;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellLen = cell.value ? String(cell.value).length : 0;
      if (cellLen > maxLen) maxLen = Math.min(cellLen + 3, 45);
    });
    col.width = maxLen;
  });

  // -------------------------------------------------------------
  // SHEETS 2 to N: Individual Department Sheets (CSE, ECE, EEE, IT, CIVIL, MCA)
  // -------------------------------------------------------------
  for (const ds of deptStats) {
    const deptSheetName = `${ds.dept} Statistics`;
    const deptSheet = workbook.addWorksheet(deptSheetName, {
      views: [{ showGridLines: true }],
    });

    // Department Title Banner
    const dTitle = deptSheet.addRow([`DEPARTMENT OF ${ds.dept} — PLACEMENT DOSSIER & CANDIDATE ROSTER`]);
    dTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    dTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    dTitle.height = 28;

    const dMetrics = deptSheet.addRow([
      `Enrolled Students: ${ds.totalStudents} | Placed: ${ds.placedStudents} | Placement Rate: ${ds.placementPct}% | Avg CTC: ${ds.avgCtc > 0 ? `${ds.avgCtc} LPA` : 'N/A'} | Highest CTC: ${ds.maxCtc > 0 ? `${ds.maxCtc} LPA` : 'N/A'}`,
    ]);
    dMetrics.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFE2E8F0' } };
    dMetrics.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    dMetrics.height = 20;

    deptSheet.addRow([]);

    // Table Header
    const dTableCols = deptSheet.addRow([
      'Sl. No',
      'Student ID / Roll No',
      'Student Name',
      'Registration Number',
      'Official Email',
      'Contact Phone',
      'CGPA',
      'Active Backlogs',
      'Placement Status',
      'Recruiting Company',
      'Designated Role',
      'Package (CTC LPA)',
      'Offer Category',
      'Coordinator Verification',
    ]);
    dTableCols.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    dTableCols.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }; // Slate-600
    dTableCols.alignment = { horizontal: 'center', vertical: 'middle' };
    dTableCols.height = 22;

    if (ds.students.length === 0) {
      const emptyRow = deptSheet.addRow(['No students registered for this department yet.']);
      emptyRow.font = { italic: true, color: { argb: 'FF94A3B8' } };
    } else {
      let idx = 1;
      for (const st of ds.students) {
        const row = deptSheet.addRow([
          idx++,
          st.studentId,
          st.name || 'N/A',
          st.registrationNumber || 'N/A',
          st.email || 'N/A',
          st.phone || 'N/A',
          typeof st.cgpa === 'number' ? st.cgpa.toFixed(2) : String(st.cgpa || '0.00'),
          st.activeBacklogs || 0,
          st.isPlaced ? 'Placed' : st.totalApplied > 0 ? 'Applied (In Process)' : 'Unplaced',
          st.placedCompany || (st.isPlaced ? 'Corporate Placement' : '—'),
          st.placedRole || (st.isPlaced ? 'Associate Engineer' : '—'),
          st.placedCtc !== null ? `${st.placedCtc} LPA` : '—',
          st.offerCategory || (st.isPlaced ? 'GENERAL' : '—'),
          st.isVerified ? 'Verified' : 'Pending',
        ]);
        row.font = { name: 'Calibri', size: 10 };
        row.getCell(1).alignment = { horizontal: 'center' };
        row.getCell(7).alignment = { horizontal: 'center' };
        row.getCell(8).alignment = { horizontal: 'center' };
        row.getCell(9).alignment = { horizontal: 'center' };
        row.getCell(12).alignment = { horizontal: 'center' };
        row.getCell(13).alignment = { horizontal: 'center' };
        row.getCell(14).alignment = { horizontal: 'center' };

        // Highlight placed students in light emerald
        if (st.isPlaced) {
          row.getCell(9).font = { bold: true, color: { argb: 'FF047857' } };
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0FDF4' }, // Light emerald tint
          };
        }
      }
    }

    // Auto-fit Department Sheet columns
    deptSheet.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const cellLen = cell.value ? String(cell.value).length : 0;
        if (cellLen > maxLen) maxLen = Math.min(cellLen + 3, 35);
      });
      col.width = maxLen;
    });
  }

  return workbook;
}

