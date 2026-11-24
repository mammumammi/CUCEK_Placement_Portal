import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import ExcelJS from 'exceljs';
import { createTestDb } from '@/test/test-db';
import { users, studentProfiles, drives, applications } from '@/core/db';
import {
  suggestFieldForHeader,
  parseCompanyTemplateBuffer,
  analyzeDriveSheetRequirementsWithAi,
  extractCandidateFieldValue,
} from './export.service';
import { applyToDrive, getDriveSpreadsheetRows, patchDriveRow } from '../spreadsheet/spreadsheet.service';
import { updateBatchCurrentSemester } from '../profiles/profiles.service';

describe('S1-S8 Support, Detail Persistence & Gemini AI Drive Sheet Understanding', () => {
  it('correctly maps S1-S8 and personal attributes with suggestFieldForHeader', () => {
    expect(suggestFieldForHeader("Father's Name")).toBe('fatherName');
    expect(suggestFieldForHeader("Mother's Name")).toBe('motherName');
    expect(suggestFieldForHeader('PAN Card Number')).toBe('panNumber');
    expect(suggestFieldForHeader('Aadhaar Number')).toBe('aadhaarNumber');
    expect(suggestFieldForHeader('Semester 7 SGPA')).toBe('s7Sgpa');
    expect(suggestFieldForHeader('Sem 8 SGPA')).toBe('s8Sgpa');
    expect(suggestFieldForHeader('Current Semester Reached')).toBe('currentSemester');
    expect(suggestFieldForHeader('Permanent Address')).toBe('address');
    expect(suggestFieldForHeader('GitHub Profile')).toBe('githubUrl');
    expect(suggestFieldForHeader('LinkedIn Profile')).toBe('linkedInUrl');
  });

  it('Gemini AI analyzer identifies existing backend fields vs new company extra questions', async () => {
    const headers = [
      'Roll Number',
      'Candidate Name',
      'Department',
      'CGPA',
      "Father's Name",
      'Permanent Address',
      'Willing to Relocate to Bangalore?',
      'Preferred Technology Domain',
    ];

    const result = await analyzeDriveSheetRequirementsWithAi(headers);

    expect(result.headers).toEqual(headers);
    expect(result.suggestedColumns).toHaveLength(8);

    // Backend matching columns
    const matched = result.columnAnalysis.filter((c) => c.isExistingBackendField);
    expect(matched.map((m) => m.companyHeader)).toContain('Roll Number');
    expect(matched.map((m) => m.companyHeader)).toContain('Candidate Name');
    expect(matched.map((m) => m.companyHeader)).toContain('Department');
    expect(matched.map((m) => m.companyHeader)).toContain('CGPA');
    expect(matched.map((m) => m.companyHeader)).toContain("Father's Name");
    expect(matched.map((m) => m.companyHeader)).toContain('Permanent Address');

    // New company-specific questions
    const newQuestions = result.columnAnalysis.filter((c) => !c.isExistingBackendField);
    expect(newQuestions.map((q) => q.companyHeader)).toContain('Willing to Relocate to Bangalore?');
    expect(newQuestions.map((q) => q.companyHeader)).toContain('Preferred Technology Domain');

    expect(result.suggestedExtraFields.length).toBeGreaterThanOrEqual(2);
    expect(result.aiAnalysis.matchedBackendCount).toBe(6);
    expect(result.aiAnalysis.newFieldsToCollectCount).toBe(2);
  });

  it('coordinator sets current semester for junior batch via updateBatchCurrentSemester', async () => {
    const db = createTestDb();

    // Create coordinator
    await db.insert(users).values({
      id: 'coord_it',
      username: 'it_coord',
      passwordHash: 'hash',
      role: 'BRANCH_COORDINATOR',
      branch: 'IT',
    });

    // Create 2 IT students in Batch 2028 (currently S2)
    await db.insert(users).values([
      { id: 'u_stud1', username: 'stud1', passwordHash: 'h', role: 'STUDENT', branch: 'IT' },
      { id: 'u_stud2', username: 'stud2', passwordHash: 'h', role: 'STUDENT', branch: 'IT' },
    ]);

    await db.insert(studentProfiles).values([
      {
        userId: 'u_stud1',
        studentId: '2028BIT001',
        name: 'Junior Student 1',
        branch: 'IT',
        batch: '2028',
        currentSemester: 8, // initial default
      },
      {
        userId: 'u_stud2',
        studentId: '2028BIT002',
        name: 'Junior Student 2',
        branch: 'IT',
        batch: '2028',
        currentSemester: 8,
      },
    ]);

    const result = await updateBatchCurrentSemester(
      db,
      { id: 'coord_it', role: 'BRANCH_COORDINATOR', branch: 'IT' },
      { branch: 'IT', batch: '2028', currentSemester: 2 }
    );

    expect(result.updatedCount).toBe(2);
    expect(result.currentSemester).toBe(2);

    const [updated1] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, 'u_stud1'));
    const [updated2] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, 'u_stud2'));
    expect(updated1.currentSemester).toBe(2);
    expect(updated2.currentSemester).toBe(2);
  });

  it('persists dynamic details on drive application and autofills them for subsequent drives', async () => {
    const db = createTestDb();

    // Create admin user for drive creator
    await db.insert(users).values({
      id: 'usr_admin',
      username: 'tpo_admin',
      passwordHash: 'h',
      role: 'MAIN_COORDINATOR',
    });

    // Create student
    await db.insert(users).values({
      id: 'u_alice',
      username: 'alice',
      passwordHash: 'h',
      role: 'STUDENT',
      branch: 'CSE',
    });

    await db.insert(studentProfiles).values({
      userId: 'u_alice',
      studentId: '2022BCSE050',
      name: 'Alice Wonder',
      branch: 'CSE',
      batch: '2026',
      cgpa: 9.0,
      activeBacklogs: 0,
      currentSemester: 7,
      additionalDetails: {},
    });

    // Create Drive 1 asking for Father's Name and PAN Number
    await db.insert(drives).values([
      {
        id: 'drive_google',
        company: 'Google',
        deadline: new Date(Date.now() + 86400000).toISOString(),
        eligibleBranches: ['CSE'],
        minCgpa: 7.0,
        maxActiveBacklogs: 0,
        extraFields: [
          { key: 'fatherName', label: "Father's Name", type: 'text', required: true },
          { key: 'panNumber', label: 'PAN Card Number', type: 'text', required: true },
        ],
        createdBy: 'usr_admin',
      },
      {
        id: 'drive_microsoft',
        company: 'Microsoft',
        deadline: new Date(Date.now() + 86400000).toISOString(),
        eligibleBranches: ['CSE'],
        minCgpa: 7.0,
        maxActiveBacklogs: 0,
        extraFields: [
          { key: 'fatherName', label: "Father's Name", type: 'text', required: true },
          { key: 'githubUrl', label: 'GitHub Link', type: 'text', required: false },
        ],
        createdBy: 'usr_admin',
      },
    ]);

    // Student applies to Drive 1 providing fatherName and panNumber
    await applyToDrive(
      db,
      { id: 'u_alice', role: 'STUDENT', branch: 'CSE' },
      'drive_google',
      {
        extraData: {
          fatherName: 'Robert Wonder',
          panNumber: 'ABCDE1234F',
        },
      }
    );

    // Verify student profile now saved these details in backend
    const [savedProfile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, 'u_alice'));
    expect(savedProfile.additionalDetails).toEqual({
      fatherName: 'Robert Wonder',
      panNumber: 'ABCDE1234F',
    });

    // Student applies to Drive 2 WITHOUT re-entering fatherName!
    // The system autofills fatherName from the backend profile
    await applyToDrive(
      db,
      { id: 'u_alice', role: 'STUDENT', branch: 'CSE' },
      'drive_microsoft',
      {
        extraData: {
          githubUrl: 'https://github.com/alicewonder',
        },
      }
    );

    // Verify Drive 2 application has fatherName autofilled AND githubUrl added
    const [appDrive2] = await db.select().from(applications).where(eq(applications.driveId, 'drive_microsoft'));
    expect(appDrive2.extraData).toEqual({
      fatherName: 'Robert Wonder',
      githubUrl: 'https://github.com/alicewonder',
    });

    // Check spreadsheet rows returns autofill count and merged data
    const rows = await getDriveSpreadsheetRows(
      db,
      { id: 'u_alice', role: 'STUDENT', branch: 'CSE' },
      'drive_microsoft'
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].extraData).toHaveProperty('fatherName', 'Robert Wonder');
    expect(rows[0].extraData).toHaveProperty('githubUrl', 'https://github.com/alicewonder');
  });
});
