/**
 * @fileoverview Integration tests for bulk registration module covering all 13 specifications.
 * @module server/modules/registration/registration.routes.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { createApp } from '@/server/app';
import { createTestDb } from '@/test/test-db';
import { createUser, loginAs } from '@/test/seed';
import { users, studentProfiles, semesterResults } from '@/core/db';
import { verifyPassword } from '../auth/password';
import { createExcelBuffer } from './registration.test-helper';
import type { Db } from '@/core/db/client';

describe('Registration Module (/api/registration)', () => {
  let db: Db;
  let app: Express;
  let adminCookie: string;
  let cseCoordinatorCookie: string;
  let studentCookie: string;

  const validStudentRow = {
    studentId: '2022BCSE001',
    name: 'Alice Johnson',
    branch: 'CSE',
    batch: '2022-2026',
    email: 'alice.johnson@example.edu',
    phone: '9876543210',
    activeBacklogs: 0,
    s1Sgpa: 8.5,
    s1Credits: 20,
    s2Sgpa: 9.0,
    s2Credits: 22,
  };

  beforeEach(async () => {
    db = createTestDb();
    app = createApp(db);

    const admin = await createUser(db, {
      username: 'main_tpo_admin',
      role: 'MAIN_COORDINATOR',
      branch: null,
    });
    adminCookie = await loginAs(app, admin);

    const cseCoord = await createUser(db, {
      username: 'cse_coordinator',
      role: 'BRANCH_COORDINATOR',
      branch: 'CSE',
    });
    cseCoordinatorCookie = await loginAs(app, cseCoord);

    const student = await createUser(db, {
      username: 'sample_student',
      role: 'STUDENT',
      branch: 'CSE',
    });
    studentCookie = await loginAs(app, student);
  });

  // 1. Cover: valid sheet
  it('1. valid sheet: generates preview with correct CGPA and zero errors', async () => {
    const buffer = await createExcelBuffer([validStudentRow]);

    const res = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'valid_students.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      total: 1,
      valid: 1,
      invalid: 0,
      duplicatesInFile: 0,
      duplicatesInDb: 0,
    });
    expect(res.body.rows[0].errors).toHaveLength(0);
    expect(res.body.rows[0].cgpa).toBe(8.76); // (20*8.5 + 22*9.0) / 42 = 368 / 42 = 8.76
  });

  // 2. Cover: missing column
  it('2. missing column: flags sheet when a required header column is omitted', async () => {
    // Exclude 'email' and 'phone' from headers
    const incompleteHeaders = ['studentId', 'name', 'branch', 'batch', 'activeBacklogs'];
    const buffer = await createExcelBuffer([validStudentRow], incompleteHeaders);

    const res = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'missing_columns.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.summary.invalid).toBe(1);
    expect(res.body.rows[0].errors.some((e: string) => e.includes('missing required column headers'))).toBe(true);
  });

  // 3. Cover: bad email
  it('3. bad email: flags rows with invalid email formats as invalid', async () => {
    const invalidRow = {
      ...validStudentRow,
      email: 'not-a-valid-email-string',
    };
    const buffer = await createExcelBuffer([invalidRow]);

    const res = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'bad_email.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.summary.invalid).toBe(1);
    expect(res.body.rows[0].errors).toContain('Invalid email address');
  });

  // 4. Cover: sgpa 11
  it('4. sgpa 11: rejects rows where SGPA exceeds the 0-10 range', async () => {
    const invalidRow = {
      ...validStudentRow,
      s1Sgpa: 11,
      s1Credits: 20,
    };
    const buffer = await createExcelBuffer([invalidRow]);

    const res = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'sgpa_11.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.summary.invalid).toBe(1);
    expect(res.body.rows[0].errors).toContain('SGPA must be <= 10');
  });

  // 5. Cover: duplicate IDs inside the file
  it('5. duplicate IDs inside the file: detects and increments duplicatesInFile summary', async () => {
    const buffer = await createExcelBuffer([
      { ...validStudentRow, studentId: '2022BCSE001', name: 'Alice 1' },
      { ...validStudentRow, studentId: '2022BCSE001', name: 'Alice 2' },
    ]);

    const res = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'internal_duplicates.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.summary.duplicatesInFile).toBe(1);
    expect(res.body.summary.invalid).toBe(2);
    expect(res.body.rows[0].errors.some((e: string) => e.includes('Duplicate studentId found within file'))).toBe(true);
    expect(res.body.rows[1].errors.some((e: string) => e.includes('Duplicate studentId found within file'))).toBe(true);
  });

  // 6. Cover: duplicate against existing DB
  it('6. duplicate against existing DB: detects records matching existing student profiles', async () => {
    // Seed existing student in DB
    const existingUser = await createUser(db, { username: '2022BCSE099' });
    await db.insert(studentProfiles).values({
      userId: existingUser.id,
      studentId: '2022BCSE099',
    });

    const buffer = await createExcelBuffer([
      { ...validStudentRow, studentId: '2022BCSE099' },
    ]);

    const res = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'db_duplicate.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.summary.duplicatesInDb).toBe(1);
    expect(res.body.summary.invalid).toBe(1);
    expect(res.body.rows[0].errors.some((e: string) => e.includes('already exists in the database'))).toBe(true);
  });

  // 7. Cover: preview does not write to the DB
  it('7. preview does not write to the DB: leaves database unchanged', async () => {
    const initialUserCount = (await db.select().from(users)).length;
    const initialProfileCount = (await db.select().from(studentProfiles)).length;

    const buffer = await createExcelBuffer([validStudentRow]);
    const res = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'preview_only.xlsx');

    expect(res.status).toBe(200);

    const finalUserCount = (await db.select().from(users)).length;
    const finalProfileCount = (await db.select().from(studentProfiles)).length;

    expect(finalUserCount).toBe(initialUserCount);
    expect(finalProfileCount).toBe(initialProfileCount);
  });

  // 8. Cover: commit creates users with a hashed password that verifies against studentId
  it('8. commit creates users with a hashed password that verifies against studentId', async () => {
    const studentIdToRegister = '2022BCSE777';
    const buffer = await createExcelBuffer([
      { ...validStudentRow, studentId: studentIdToRegister },
    ]);

    const res = await request(app)
      .post('/api/registration/commit')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'commit_valid.xlsx');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ created: 1, skipped: 0 });

    // Verify user created
    const [newUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, studentIdToRegister));

    expect(newUser).toBeDefined();
    expect(newUser.role).toBe('STUDENT');
    expect(newUser.branch).toBe('CSE');

    // Verify password is scrypt hash of studentId
    const passwordMatches = await verifyPassword(studentIdToRegister, newUser.passwordHash);
    expect(passwordMatches).toBe(true);

    // Verify student profile created
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, studentIdToRegister));
    expect(profile).toBeDefined();
    expect(profile.name).toBe(validStudentRow.name);
    expect(profile.cgpa).toBe(8.76);

    // Verify semester results created
    const semesters = await db
      .select()
      .from(semesterResults)
      .where(eq(semesterResults.userId, newUser.id));
    expect(semesters).toHaveLength(2);
  });

  // 9. Cover: a student gets 403
  it('9. a student gets 403: forbids access to non-coordinators', async () => {
    const buffer = await createExcelBuffer([validStudentRow]);

    const previewRes = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', studentCookie)
      .attach('file', buffer, 'unauthorized.xlsx');

    expect(previewRes.status).toBe(403);
    expect(previewRes.body.error.code).toBe('FORBIDDEN');

    const commitRes = await request(app)
      .post('/api/registration/commit')
      .set('Cookie', studentCookie)
      .attach('file', buffer, 'unauthorized.xlsx');

    expect(commitRes.status).toBe(403);
    expect(commitRes.body.error.code).toBe('FORBIDDEN');
  });

  // 10. Cover: non-xlsx upload gets 400
  it('10. non-xlsx upload gets 400: rejects text or non-excel files', async () => {
    const textBuffer = Buffer.from('studentId,name,email\n1,Alice,alice@example.com');

    const res = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', adminCookie)
      .attach('file', textBuffer, 'report.csv');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('.xlsx');
  });

  // 11. Cover: the response never contains a password or hash
  it('11. the response never contains a password or hash in preview or commit', async () => {
    const buffer = await createExcelBuffer([validStudentRow]);

    const previewRes = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'sanitize_check.xlsx');

    const previewBodyStr = JSON.stringify(previewRes.body);
    expect(previewBodyStr).not.toContain('password');
    expect(previewBodyStr).not.toContain('scrypt$');

    const commitRes = await request(app)
      .post('/api/registration/commit')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'sanitize_check.xlsx');

    const commitBodyStr = JSON.stringify(commitRes.body);
    expect(commitBodyStr).not.toContain('password');
    expect(commitBodyStr).not.toContain('scrypt$');
  });

  // 12. Cover: a branch coordinator's other-branch rows are rejected
  it("12. a branch coordinator's other-branch rows are rejected", async () => {
    const otherBranchRow = {
      ...validStudentRow,
      studentId: '2022BECE001',
      branch: 'ECE', // CSE coordinator uploading ECE row
    };
    const buffer = await createExcelBuffer([otherBranchRow]);

    const res = await request(app)
      .post('/api/registration/preview')
      .set('Cookie', cseCoordinatorCookie)
      .attach('file', buffer, 'other_branch.xlsx');

    expect(res.status).toBe(200);
    expect(res.body.summary.invalid).toBe(1);
    expect(res.body.rows[0].errors.some((e: string) => e.includes('cannot register students for branch "ECE"'))).toBe(true);
  });

  // 13. Cover: commit rolls back fully when an insert fails
  it('13. commit rolls back fully when an insert fails', async () => {
    const initialUserCount = (await db.select().from(users)).length;

    // Row 1 is valid, Row 2 has bad email so validation fails
    const buffer = await createExcelBuffer([
      { ...validStudentRow, studentId: '2022BCSE888', email: 'good@example.edu' },
      { ...validStudentRow, studentId: '2022BCSE889', email: 'not-an-email' },
    ]);

    // Commit without skipInvalid should reject whole batch and roll back
    const res = await request(app)
      .post('/api/registration/commit')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'atomic_failure.xlsx');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // Verify row 1 was NOT inserted into DB
    const finalUserCount = (await db.select().from(users)).length;
    expect(finalUserCount).toBe(initialUserCount);

    const [uninsertedUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, '2022BCSE888'));
    expect(uninsertedUser).toBeUndefined();

    // Verify commit succeeds when skipInvalid=true, inserting only the valid row
    const skipRes = await request(app)
      .post('/api/registration/commit?skipInvalid=true')
      .set('Cookie', adminCookie)
      .attach('file', buffer, 'skip_invalid.xlsx');

    expect(skipRes.status).toBe(200);
    expect(skipRes.body).toEqual({ created: 1, skipped: 1 });

    const [insertedUser] = await db
      .select()
      .from(users)
      .where(eq(users.username, '2022BCSE888'));
    expect(insertedUser).toBeDefined();
  });
});

