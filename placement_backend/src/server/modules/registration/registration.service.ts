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
 * Extracts raw tabular data from an uploaded Excel workbook buffer.
 */
export async function parseXlsxWorkbook(
  buffer: Buffer
): Promise<{ rows: ParsedRawRow[]; missingColumns: string[] }> {
  const workbook = new ExcelJS.Workbook();
  // Satisfy ExcelJS load parameter typing
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new PortalError('VALIDATION_ERROR', 'The uploaded Excel file contains no worksheets');
  }

  // 1. Identify header mapping from row 1
  const headerMap = new Map<number, string>();
  const headerRow = worksheet.getRow(1);

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const rawHeader = String(cell.value ?? '')
      .trim()
      .toLowerCase();
    const canonicalProp = COLUMN_MAP[rawHeader];
    if (canonicalProp) {
      headerMap.set(colNumber, canonicalProp);
    }
  });

  const recognizedColumns = new Set(headerMap.values());
  const missingColumns = REQUIRED_COLUMNS.filter(
    (col) => !recognizedColumns.has(col)
  );

  // 2. Parse data rows
  const rows: ParsedRawRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row

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
      rows.push({ rowNumber, data: rowData });
    }
  });

  return { rows, missingColumns };
}

/**
 * Validates all student rows without writing to the database or hashing passwords.
 * Calculates credit-weighted CGPA and detects duplicates both within the file and DB.
 */
export async function validateRegistrationSheet(
  db: Db,
  actor: RegistrationActor,
  buffer: Buffer
): Promise<PreviewResponse & { validRows: { rowNumber: number; data: StudentRowData; cgpa: number }[] }> {
  const { rows: rawRows, missingColumns } = await parseXlsxWorkbook(buffer);

  // Collect studentIds from file to check duplicate occurrences
  const studentIdCounts = new Map<string, number>();
  for (const raw of rawRows) {
    const sid = typeof raw.data.studentId === 'string' ? raw.data.studentId.trim().toUpperCase() : '';
    if (sid) {
      studentIdCounts.set(sid, (studentIdCounts.get(sid) ?? 0) + 1);
    }
  }

  // Check existing database records
  const allStudentIds = Array.from(studentIdCounts.keys());
  const existingInDb = new Set<string>();

  if (allStudentIds.length > 0) {
    const existingProfiles = await db
      .select({ studentId: studentProfiles.studentId })
      .from(studentProfiles)
      .where(inArray(studentProfiles.studentId, allStudentIds));

    for (const p of existingProfiles) {
      existingInDb.add(p.studentId.toUpperCase());
    }
  }

  const resultRows: ParsedRowResult[] = [];
  const validRows: { rowNumber: number; data: StudentRowData; cgpa: number }[] = [];
  const duplicateIdsInFile = new Set<string>();
  let duplicatesInDbCount = 0;

  for (const raw of rawRows) {
    const errors: string[] = [];

    // Missing column check
    if (missingColumns.length > 0) {
      errors.push(`Sheet is missing required column headers: ${missingColumns.join(', ')}`);
    }

    const sid = typeof raw.data.studentId === 'string' ? raw.data.studentId.trim().toUpperCase() : '';

    // Duplicate in file check
    if (sid && (studentIdCounts.get(sid) ?? 0) > 1) {
      duplicateIdsInFile.add(sid);
      errors.push(`Duplicate studentId found within file: "${raw.data.studentId}"`);
    }

    // Duplicate in database check
    if (sid && existingInDb.has(sid)) {
      duplicatesInDbCount++;
      errors.push(`Student ID "${raw.data.studentId}" already exists in the database`);
    }

    // Branch coordinator authorization check
    if (actor.role === 'BRANCH_COORDINATOR' && actor.branch) {
      const rowBranch = typeof raw.data.branch === 'string' ? raw.data.branch.trim().toUpperCase() : '';
      if (rowBranch !== actor.branch.trim().toUpperCase()) {
        errors.push(
          `Branch Coordinator for "${actor.branch}" cannot register students for branch "${raw.data.branch || 'unknown'}"`
        );
      }
    }

    // Schema validation
    const parsed = studentRowSchema.safeParse(raw.data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(issue.message);
      }
    }

    // Calculate CGPA
    const semesters: { credits: number; sgpa: number }[] = [];
    for (let sem = 1; sem <= 6; sem++) {
      const sgpa = Number(raw.data[`s${sem}Sgpa`]);
      const credits = Number(raw.data[`s${sem}Credits`]);
      if (!isNaN(sgpa) && !isNaN(credits) && credits > 0) {
        semesters.push({ credits, sgpa });
      }
    }

    let cgpa = 0;
    try {
      cgpa = calculateCreditBasedCgpa(semesters);
    } catch {
      // Ignored for CGPA calculation if schema validation already caught it
    }

    resultRows.push({
      rowNumber: raw.rowNumber,
      data: raw.data,
      cgpa,
      errors,
    });

    if (errors.length === 0 && parsed.success) {
      validRows.push({
        rowNumber: raw.rowNumber,
        data: parsed.data,
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
  skipInvalid = false
): Promise<CommitResponse> {
  // Always re-parse and re-validate on the server!
  const { validRows, summary } = await validateRegistrationSheet(db, actor, buffer);

  if (!skipInvalid && summary.invalid > 0) {
    throw new PortalError(
      'VALIDATION_ERROR',
      `Cannot commit registration: ${summary.invalid} of ${summary.total} rows failed validation.`
    );
  }

  if (validRows.length === 0) {
    return { created: 0, skipped: summary.invalid };
  }

  // Precompute password hashes asynchronously before opening the transaction
  const preparedItems = await Promise.all(
    validRows.map(async ({ data, cgpa }) => {
      const userId = crypto.randomUUID();
      const passwordHash = await hashPassword(data.studentId);
      return {
        userId,
        passwordHash,
        data,
        cgpa,
      };
    })
  );

  let created = 0;

  // Execute in ONE atomic SQLite transaction
  db.transaction((tx) => {
    for (const { userId, passwordHash, data, cgpa } of preparedItems) {
      // 1. Insert user
      tx.insert(users).values({
        id: userId,
        username: data.studentId,
        passwordHash,
        role: 'STUDENT',
        branch: data.branch,
        createdAt: new Date(),
      }).run();

      // 2. Insert student profile
      tx.insert(studentProfiles).values({
        userId,
        studentId: data.studentId,
        name: data.name,
        branch: data.branch,
        batch: data.batch,
        email: data.email,
        phone: data.phone,
        activeBacklogs: data.activeBacklogs,
        cgpa,
        createdAt: new Date(),
      }).run();

      // 3. Insert semester results
      for (let sem = 1; sem <= 6; sem++) {
        const sgpa = data[`s${sem}Sgpa` as keyof StudentRowData];
        const credits = data[`s${sem}Credits` as keyof StudentRowData];

        if (typeof sgpa === 'number' && typeof credits === 'number') {
          tx.insert(semesterResults).values({
            id: crypto.randomUUID(),
            userId,
            semester: sem,
            credits,
            sgpa,
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
