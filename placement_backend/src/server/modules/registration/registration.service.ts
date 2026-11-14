/**
 * @fileoverview Registration service for Excel parsing, validation, preview, and batch commit.
 * @module server/modules/registration/registration.service
 */

import ExcelJS from 'exceljs';
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { users, studentProfiles, semesterResults } from '@/core/db';
import { PortalError } from '@/core/errors/portal-error';
import { calculateCreditBasedCgpa } from '../cgpa/cgpa.service';
import { getBranchCreditsMap } from '../cgpa/branch-credits.service';
import { hashPassword } from '../auth/password';
import {
  COLUMN_MAP,
  REQUIRED_COLUMNS,
  studentRowSchema,
  type StudentRowData,
  type ParsedRowResult,
  type RegistrationSummary,
  type PreviewResponse,
  type CommitResponse,
} from './registration.schema';
import { analyzeWorkbook, extractCellText } from './mapping/sheet-analyzer';
import { buildMapping } from './mapping/mapping.service';

export interface RegistrationActor {
  id: string;
  role: string;
  branch: string | null;
}

interface ParsedRawRow {
  rowNumber: number;
  data: Record<string, unknown>;
}

/**
 * Parses DOB from Date object, Excel serial number, or DD/MM/YYYY / YYYY-MM-DD strings.
 */
export function parseDobDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  if (typeof val === 'number') {
    if (val > 1000 && val < 60000) {
      const msPerDay = 86400 * 1000;
      const date = new Date((val - 25569) * msPerDay);
      if (!isNaN(date.getTime())) return date;
    }
  }
  if (typeof val === 'string') {
    const s = val.trim();
    // DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyyMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
      const year = parseInt(ddmmyyyyMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    // YYYY-MM-DD
    const yyyymmddMatch = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
    if (yyyymmddMatch) {
      const year = parseInt(yyyymmddMatch[1], 10);
      const month = parseInt(yyyymmddMatch[2], 10) - 1;
      const day = parseInt(yyyymmddMatch[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * Calculates current age from a DOB value.
 */
export function calculateAgeFromDob(val: unknown): number | null {
  const birthDate = parseDobDate(val);
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 && age <= 120 ? age : null;
}

/**
 * Extracts raw tabular data from an uploaded Excel workbook buffer.
 * Automatically analyzes worksheet structure to detect the true header row
 * (skipping title banners or blank leading rows) and maps columns to canonical fields
 * using deterministic synonyms, pattern matching, AI mapping, or custom overrides.
 */
export async function parseXlsxWorkbook(
  buffer: Buffer,
  customMapping?: Record<string, string>
): Promise<{ rows: ParsedRawRow[]; missingColumns: string[]; headerRowNumber: number }> {
  const workbook = new ExcelJS.Workbook();
  // Satisfy ExcelJS load parameter typing
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new PortalError('VALIDATION_ERROR', 'The uploaded Excel file contains no worksheets');
  }

  // 1. Analyze worksheet structure to detect true header row
  const analyses = await analyzeWorkbook(buffer);
  const primaryAnalysis = analyses[0];
  const targetHeaderRow = primaryAnalysis ? primaryAnalysis.headerRow : 1;

  // 2. Resolve field mappings: use customMapping if provided, otherwise auto-map headers
  const activeMapping: Record<string, string> = { ...(customMapping ?? {}) };
  if (!customMapping || Object.keys(customMapping).length === 0) {
    if (primaryAnalysis && primaryAnalysis.headers.length > 0) {
      const mappingRes = await buildMapping(primaryAnalysis.headers);
      for (const [hdr, res] of Object.entries(mappingRes.mapping)) {
        if (res.field) {
          activeMapping[hdr] = res.field;
        }
      }
    }
  }

  // 3. Identify header mapping from targetHeaderRow
  const headerMap = new Map<number, string>();
  const headerRow = worksheet.getRow(targetHeaderRow);

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const rawHeader = extractCellText(cell);
    let canonicalProp = activeMapping[rawHeader];
    if (!canonicalProp) {
      const lower = rawHeader.toLowerCase();
      canonicalProp = COLUMN_MAP[lower];
      if (!canonicalProp) {
        for (const [k, v] of Object.entries(activeMapping)) {
          if (k.toLowerCase() === lower) {
            canonicalProp = v;
            break;
          }
        }
      }
    }
    if (canonicalProp) {
      headerMap.set(colNumber, canonicalProp);
    }
  });

  const recognizedColumns = new Set(headerMap.values());
  // If firstName is provided, name can be derived automatically
  if (recognizedColumns.has('firstName')) {
    recognizedColumns.add('name');
  }
  // Either studentId or registrationNumber satisfies the student identity column
  if (recognizedColumns.has('registrationNumber')) {
    recognizedColumns.add('studentId');
  }
  if (recognizedColumns.has('studentId')) {
    recognizedColumns.add('registrationNumber');
  }
  const missingColumns = REQUIRED_COLUMNS.filter(
    (col) => !recognizedColumns.has(col)
  );

  // 4. Parse data rows strictly after targetHeaderRow
  const rows: ParsedRawRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= targetHeaderRow) return; // Skip header row and any preceding title/banner rows

    const rowData: Record<string, unknown> = {};
    let hasNonEmptyCell = false;

    headerMap.forEach((prop, colNumber) => {
      const cell = row.getCell(colNumber);
      let val: unknown = cell.value;

      if (val !== null && typeof val === 'object') {
        if ('result' in val) val = (val as { result: unknown }).result;
        else if ('text' in val) val = (val as { text: unknown }).text;
      }

      if (val !== null && val !== undefined && String(val).trim() !== '') {
        hasNonEmptyCell = true;
        if (typeof val === 'string') {
          val = val.trim();
        }
        rowData[prop] = val;
      }
    });

    if (hasNonEmptyCell) {
      // 1. Take First Name and Last Name from Full Name (if not already provided)
      if (rowData.name && typeof rowData.name === 'string') {
        const parts = rowData.name.trim().split(/\s+/);
        if (!rowData.firstName && parts.length > 0) {
          rowData.firstName = parts[0];
        }
        if (!rowData.lastName && parts.length > 1) {
          rowData.lastName = parts.slice(1).join(' ');
        }
      } else if (!rowData.name && (rowData.firstName || rowData.lastName)) {
        // Construct Full Name from First Name and Last Name
        rowData.name = [rowData.firstName, rowData.lastName]
          .filter(Boolean)
          .map((s) => String(s).trim())
          .join(' ');
      }

      // 2. Take Age from DOB (if not already provided)
      if (rowData.dob) {
        if (rowData.dob instanceof Date) {
          const y = rowData.dob.getFullYear();
          const m = String(rowData.dob.getMonth() + 1).padStart(2, '0');
          const d = String(rowData.dob.getDate()).padStart(2, '0');
          rowData.dob = `${y}-${m}-${d}`;
        }
        if (rowData.age === undefined || rowData.age === null || rowData.age === '') {
          const computedAge = calculateAgeFromDob(rowData.dob);
          if (computedAge !== null) {
            rowData.age = computedAge;
          }
        }
      }

      // 3. Default studentId or registrationNumber if one is provided
      if (rowData.registrationNumber && !rowData.studentId) {
        rowData.studentId = rowData.registrationNumber;
      } else if (rowData.studentId && !rowData.registrationNumber) {
        rowData.registrationNumber = rowData.studentId;
      }

      rows.push({ rowNumber, data: rowData });
    }
  });

  return { rows, missingColumns, headerRowNumber: targetHeaderRow };
}

/**
 * Validates all student rows without writing to the database or hashing passwords.
 * Calculates credit-weighted CGPA and detects duplicates both within the file and DB.
 */
export async function validateRegistrationSheet(
  db: Db,
  actor: RegistrationActor,
  buffer: Buffer,
  customMapping?: Record<string, string>
): Promise<PreviewResponse & { validRows: { rowNumber: number; data: StudentRowData; cgpa: number }[] }> {
  const { rows: rawRows, missingColumns } = await parseXlsxWorkbook(buffer, customMapping);

  // Collect studentIds and registrationNumbers from file to check duplicate occurrences
  const studentIdCounts = new Map<string, number>();
  const regNoCounts = new Map<string, number>();
  for (const raw of rawRows) {
    const sid = typeof raw.data.studentId === 'string' ? raw.data.studentId.trim().toUpperCase() : '';
    const regNo = typeof raw.data.registrationNumber === 'string' ? raw.data.registrationNumber.trim().toUpperCase() : '';
    if (sid) {
      studentIdCounts.set(sid, (studentIdCounts.get(sid) ?? 0) + 1);
    }
    if (regNo) {
      regNoCounts.set(regNo, (regNoCounts.get(regNo) ?? 0) + 1);
    }
  }

  // Check existing database records
  const allStudentIds = Array.from(studentIdCounts.keys());
  const allRegNos = Array.from(regNoCounts.keys());
  const existingInDb = new Set<string>();

  if (allStudentIds.length > 0 || allRegNos.length > 0) {
    const existingProfiles = await db
      .select({
        studentId: studentProfiles.studentId,
        registrationNumber: studentProfiles.registrationNumber,
      })
      .from(studentProfiles);

    for (const p of existingProfiles) {
      if (p.studentId) existingInDb.add(p.studentId.toUpperCase());
      if (p.registrationNumber) existingInDb.add(p.registrationNumber.toUpperCase());
    }
  }

  const resultRows: ParsedRowResult[] = [];
  const validRows: { rowNumber: number; data: StudentRowData; cgpa: number }[] = [];
  const duplicateIdsInFile = new Set<string>();
  let duplicatesInDbCount = 0;

  // Pre-load branch curriculum credits cache
  const branchCreditCache = new Map<string, Map<number, number>>();
  const getBranchMap = async (b: string) => {
    const normalized = (b || 'CSE').trim().toUpperCase();
    if (!branchCreditCache.has(normalized)) {
      const map = await getBranchCreditsMap(db, normalized);
      branchCreditCache.set(normalized, map);
    }
    return branchCreditCache.get(normalized)!;
  };

  for (const raw of rawRows) {
    const errors: string[] = [];

    // Missing column check
    if (missingColumns.length > 0) {
      errors.push(`Sheet is missing required column headers: ${missingColumns.join(', ')}`);
    }

    const sid = typeof raw.data.studentId === 'string' ? raw.data.studentId.trim().toUpperCase() : '';
    const regNo = typeof raw.data.registrationNumber === 'string' ? raw.data.registrationNumber.trim().toUpperCase() : '';

    // Duplicate in file check
    if ((sid && (studentIdCounts.get(sid) ?? 0) > 1) || (regNo && (regNoCounts.get(regNo) ?? 0) > 1)) {
      if (sid) duplicateIdsInFile.add(sid);
      if (regNo) duplicateIdsInFile.add(regNo);
      errors.push(`Duplicate studentId found within file: "${raw.data.registrationNumber || raw.data.studentId}"`);
    }

    // Duplicate in database check
    if ((sid && existingInDb.has(sid)) || (regNo && existingInDb.has(regNo))) {
      duplicatesInDbCount++;
      errors.push(`Student identifier "${raw.data.registrationNumber || raw.data.studentId}" already exists in the database`);
    }

    // Branch coordinator authorization check & default branch assignment
    if (actor.role === 'BRANCH_COORDINATOR' && actor.branch) {
      const rowBranch = typeof raw.data.branch === 'string' ? raw.data.branch.trim().toUpperCase() : '';
      if (rowBranch && rowBranch !== actor.branch.trim().toUpperCase()) {
        errors.push(
          `Branch Coordinator for "${actor.branch}" cannot register students for branch "${raw.data.branch || 'unknown'}"`
        );
      } else if (!rowBranch) {
        raw.data.branch = actor.branch;
      }
    }

    // Schema validation
    const parsed = studentRowSchema.safeParse(raw.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(issue.message);
      }
    }

    // Calculate CGPA using provided credits or branch curriculum defaults
    const rowBranch = typeof raw.data.branch === 'string' && raw.data.branch.trim()
      ? raw.data.branch.trim().toUpperCase()
      : (actor.role === 'BRANCH_COORDINATOR' ? actor.branch?.toUpperCase() : 'CSE') || 'CSE';
    const branchCreditMap = await getBranchMap(rowBranch);

    const semesters: { credits: number; sgpa: number }[] = [];
    for (let sem = 1; sem <= 6; sem++) {
      const sgpa = Number(raw.data[`s${sem}Sgpa`]);
      let credits = Number(raw.data[`s${sem}Credits`]);
      if (!isNaN(sgpa)) {
        if (isNaN(credits) || credits <= 0) {
          credits = branchCreditMap.get(sem) ?? 20;
        }
        semesters.push({ credits, sgpa });
      }
    }

    let cgpa = 0;
    try {
      cgpa = calculateCreditBasedCgpa(semesters);
    } catch {
      // Ignored for CGPA calculation if schema validation already caught it
    }

    // Determine percentage if not explicitly provided
    let calculatedPercentage: number | null = null;
    if (typeof raw.data.percentage === 'number' && !isNaN(raw.data.percentage)) {
      calculatedPercentage = raw.data.percentage;
    } else if (
      typeof raw.data.totalMarks === 'number' &&
      typeof raw.data.maxMarks === 'number' &&
      raw.data.maxMarks > 0
    ) {
      calculatedPercentage = Number(
        ((raw.data.totalMarks / raw.data.maxMarks) * 100).toFixed(2)
      );
    } else if (cgpa > 0) {
      calculatedPercentage = Number((cgpa * 9.5).toFixed(2));
    }

    if (calculatedPercentage !== null && raw.data.percentage === undefined) {
      raw.data.percentage = calculatedPercentage;
    }

    resultRows.push({
      rowNumber: raw.rowNumber,
      data: raw.data,
      cgpa,
      errors,
    });

    if (errors.length === 0 && parsed.success) {
      const rowValidData = {
        ...parsed.data,
        percentage: parsed.data.percentage ?? (calculatedPercentage ?? undefined),
      };
      validRows.push({
        rowNumber: raw.rowNumber,
        data: rowValidData,
        cgpa,
      });
    }
  }

  const total = resultRows.length;
  const invalid = resultRows.filter((r) => r.errors.length > 0).length;
  const valid = total - invalid;

  const summary: RegistrationSummary = {
    total,
    valid,
    invalid,
    duplicatesInFile: duplicateIdsInFile.size,
    duplicatesInDb: duplicatesInDbCount,
  };

  return {
    rows: resultRows,
    validRows,
    summary,
  };
}

/**
 * Commits bulk student registration in a single database transaction.
 * Precomputes password hashes asynchronously before starting the synchronous transaction.
 */
export async function commitRegistration(
  db: Db,
  actor: RegistrationActor,
  buffer: Buffer,
  skipInvalid = false,
  customMapping?: Record<string, string>
): Promise<CommitResponse> {
  // Always re-parse and re-validate on the server!
  const { validRows, summary } = await validateRegistrationSheet(db, actor, buffer, customMapping);

  if (!skipInvalid && summary.invalid > 0) {
    throw new PortalError(
      'VALIDATION_ERROR',
      `Cannot commit registration: ${summary.invalid} of ${summary.total} rows failed validation.`
    );
  }

  if (validRows.length === 0) {
    return { created: 0, skipped: summary.invalid };
  }

  // Pre-load branch curriculum credits cache
  const commitBranchCache = new Map<string, Map<number, number>>();
  const getCommitBranchMap = async (b: string) => {
    const normalized = (b || 'CSE').trim().toUpperCase();
    if (!commitBranchCache.has(normalized)) {
      const map = await getBranchCreditsMap(db, normalized);
      commitBranchCache.set(normalized, map);
    }
    return commitBranchCache.get(normalized)!;
  };

  // Precompute password hashes asynchronously before opening the transaction
  const preparedItems = await Promise.all(
    validRows.map(async ({ data, cgpa }) => {
      const userId = crypto.randomUUID();
      const regNumber = data.registrationNumber || data.studentId!;
      const studId = data.studentId || data.registrationNumber!;
      const passwordHash = await hashPassword(regNumber);
      const branchVal = data.branch || (actor.role === 'BRANCH_COORDINATOR' ? actor.branch : 'CSE') || 'CSE';
      const branchCreditMap = await getCommitBranchMap(branchVal);

      return {
        userId,
        passwordHash,
        data: {
          ...data,
          studentId: studId,
          registrationNumber: regNumber,
        },
        cgpa,
        branchCreditMap,
      };
    })
  );

  let created = 0;

  // Execute in ONE atomic SQLite transaction
  db.transaction((tx) => {
    for (const { userId, passwordHash, data, cgpa, branchCreditMap } of preparedItems) {
      const branchVal = data.branch || (actor.role === 'BRANCH_COORDINATOR' ? actor.branch : null);
      const isComplete = Boolean(
        data.name &&
        branchVal &&
        data.batch &&
        data.email &&
        data.phone
      );

      // 1. Insert user
      tx.insert(users).values({
        id: userId,
        username: data.studentId,
        passwordHash,
        role: 'STUDENT',
        branch: branchVal,
        createdAt: new Date(),
      }).run();

      // 2. Insert student profile
      tx.insert(studentProfiles).values({
        userId,
        studentId: data.studentId,
        registrationNumber: data.registrationNumber || null,
        name: data.name || null,
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        dob: data.dob || null,
        age: typeof data.age === 'number' ? data.age : null,
        branch: branchVal,
        batch: data.batch || null,
        email: data.email || null,
        phone: data.phone || null,
        activeBacklogs: data.activeBacklogs ?? 0,
        cgpa,
        totalMarks: typeof data.totalMarks === 'number' ? data.totalMarks : null,
        maxMarks: typeof data.maxMarks === 'number' ? data.maxMarks : null,
        percentage: typeof data.percentage === 'number' ? data.percentage : (cgpa > 0 ? Number((cgpa * 9.5).toFixed(2)) : null),
        marksheetUrl: data.marksheetUrl || null,
        s1MarksheetUrl: data.s1MarksheetUrl || null,
        s2MarksheetUrl: data.s2MarksheetUrl || null,
        s3MarksheetUrl: data.s3MarksheetUrl || null,
        s4MarksheetUrl: data.s4MarksheetUrl || null,
        s5MarksheetUrl: data.s5MarksheetUrl || null,
        s6MarksheetUrl: data.s6MarksheetUrl || null,
        isProfileComplete: isComplete,
        createdAt: new Date(),
      }).run();

      // 3. Insert semester results using provided credits or branch curriculum defaults
      for (let sem = 1; sem <= 6; sem++) {
        const sgpa = data[`s${sem}Sgpa` as keyof StudentRowData];
        const credits = data[`s${sem}Credits` as keyof StudentRowData];
        const marksheetUrl = data[`s${sem}MarksheetUrl` as keyof StudentRowData] as string | undefined;

        if (typeof sgpa === 'number') {
          const finalCredits = typeof credits === 'number' && credits > 0
            ? credits
            : (branchCreditMap.get(sem) ?? 20);

          tx.insert(semesterResults).values({
            id: crypto.randomUUID(),
            userId,
            semester: sem,
            credits: finalCredits,
            sgpa,
            percentage: Number((sgpa * 9.5).toFixed(2)),
            marksheetUrl: marksheetUrl || null,
            createdAt: new Date(),
          }).run();
        }
      }

      created++;
    }
  });

  return {
    created,
    skipped: summary.invalid,
  };
}
