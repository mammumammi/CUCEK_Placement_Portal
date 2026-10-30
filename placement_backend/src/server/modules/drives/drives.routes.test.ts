/**
 * @fileoverview Integration tests for Recruitment Drives Express routes.
 * @module server/modules/drives/drives.routes.test
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import ExcelJS from 'exceljs';
import { eq } from 'drizzle-orm';
import { createApp } from '@/server/app';
import { createTestDb } from '@/test/test-db';
import { createUser, loginAs } from '@/test/seed';
import { drives, studentProfiles, applications } from '@/core/db';
import type { Db } from '@/core/db/client';
import { LocalDiskStorage } from '@/server/services/storage.service';

describe('Drives Module (/api/drives)', () => {
  let db: Db;
  let app: Express;
  const testUploadDir = path.resolve(process.cwd(), 'uploads_test_drives');
  let storage: LocalDiskStorage;

  // Actors
  let mainCoordinator: { id: string; role: 'MAIN_COORDINATOR'; branch: string | null };
  let mainCookie: string;

  let branchCoordinator: { id: string; role: 'BRANCH_COORDINATOR'; branch: string | null };
  let branchCookie: string;

  let eligibleStudent: { id: string; role: 'STUDENT'; branch: string | null };
  let eligibleStudentCookie: string;

  let ineligibleStudent: { id: string; role: 'STUDENT'; branch: string | null };
  let ineligibleStudentCookie: string;

  beforeEach(async () => {
    db = createTestDb();
    storage = new LocalDiskStorage(testUploadDir);
    app = createApp(db, { storage });

    // 1. Create main coordinator
    mainCoordinator = (await createUser(db, {
      username: 'main_admin_drive',
      role: 'MAIN_COORDINATOR',
      branch: null,
    })) as typeof mainCoordinator;
    mainCookie = await loginAs(app, mainCoordinator);

    // 2. Create branch coordinator
    branchCoordinator = (await createUser(db, {
      username: 'branch_coord_drive',
      role: 'BRANCH_COORDINATOR',
      branch: 'CSE',
    })) as typeof branchCoordinator;
    branchCookie = await loginAs(app, branchCoordinator);

    // 3. Create eligible CSE student (CGPA: 8.5, Backlogs: 0)
    eligibleStudent = (await createUser(db, {
      username: '2022BCSE101',
      role: 'STUDENT',
      branch: 'CSE',
    })) as typeof eligibleStudent;
    eligibleStudentCookie = await loginAs(app, eligibleStudent);

    await db.insert(studentProfiles).values({
      userId: eligibleStudent.id,
      studentId: '2022BCSE101',
      name: 'Eligible Alice',
      branch: 'CSE',
      batch: '2022-2026',
      email: 'alice@cse.edu',
      phone: '9876543210',
      activeBacklogs: 0,
      cgpa: 8.5,
    });

    // 4. Create ineligible ECE student (CGPA: 6.5, Backlogs: 2)
    ineligibleStudent = (await createUser(db, {
      username: '2022BECE202',
      role: 'STUDENT',
      branch: 'ECE',
    })) as typeof ineligibleStudent;
    ineligibleStudentCookie = await loginAs(app, ineligibleStudent);

    await db.insert(studentProfiles).values({
      userId: ineligibleStudent.id,
      studentId: '2022BECE202',
      name: 'Ineligible Bob',
      branch: 'ECE',
      batch: '2022-2026',
      email: 'bob@ece.edu',
      phone: '9123456780',
      activeBacklogs: 2,
      cgpa: 6.5,
    });
  });

  afterAll(() => {
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  // ==========================================
  // REQUIRED SPECIFICATION TESTS
  // ==========================================

  it('1. students cannot create drives (403)', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/drives')
      .set('Cookie', eligibleStudentCookie)
      .field('company', 'Google')
      .field('deadline', futureDate)
      .field('eligibleBranches', JSON.stringify(['CSE']))
      .field('minCgpa', '7.5')
      .field('maxActiveBacklogs', '0');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('2. branch coordinator cannot create drives (403)', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/drives')
      .set('Cookie', branchCookie)
      .field('company', 'Microsoft')
      .field('deadline', futureDate)
      .field('eligibleBranches', JSON.stringify(['CSE']))
      .field('minCgpa', '7.5');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('3. a past deadline is rejected (400)', async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/drives')
      .set('Cookie', mainCookie)
      .field('company', 'Amazon')
      .field('deadline', pastDate)
      .field('eligibleBranches', JSON.stringify(['CSE']))
      .field('minCgpa', '7.0');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Deadline must be in the future');
  });

  it('4. a non-PDF JD is rejected (400)', async () => {
    const futureDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const fakeTextFile = Buffer.from('This is a text file, not a PDF');

    const res = await request(app)
      .post('/api/drives')
      .set('Cookie', mainCookie)
      .field('company', 'Meta')
      .field('deadline', futureDate)
      .field('eligibleBranches', JSON.stringify(['CSE', 'ECE']))
      .field('minCgpa', '8.0')
      .attach('jd', fakeTextFile, 'job_description.txt');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Only PDF files are supported');
  });

  it('5. the list shows eligible=false with reasons for ineligible student', async () => {
    // Main coordinator creates a CSE-only drive requiring CGPA >= 8.0 and maxBacklogs = 0
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    const createRes = await request(app)
      .post('/api/drives')
      .set('Cookie', mainCookie)
      .field('company', 'Uber')
      .field('description', 'Backend Engineer')
      .field('deadline', futureDate)
      .field('eligibleBranches', JSON.stringify(['CSE']))
      .field('minCgpa', '8.0')
      .field('maxActiveBacklogs', '0');

    expect(createRes.status).toBe(201);
    expect(createRes.body.company).toBe('Uber');

    // Ineligible student (ECE, CGPA 6.5, Backlogs 2) fetches drives list
    const listRes = await request(app)
      .get('/api/drives')
      .set('Cookie', ineligibleStudentCookie);

    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);

    const driveItem = listRes.body[0];
    expect(driveItem.company).toBe('Uber');
    expect(driveItem.open).toBe(true);
    expect(driveItem.eligible).toBe(false);
    expect(Array.isArray(driveItem.reasons)).toBe(true);
    expect(driveItem.reasons).toHaveLength(3);
    expect(driveItem.reasons.some((r: string) => r.includes('Branch "ECE" is not eligible'))).toBe(true);
    expect(driveItem.reasons.some((r: string) => r.includes('CGPA (6.5) is below minimum requirement (8)'))).toBe(true);
    expect(driveItem.reasons.some((r: string) => r.includes('Active backlogs (2) exceed maximum allowed (0)'))).toBe(true);

    // Eligible student (CSE, CGPA 8.5, Backlogs 0) fetches drives list
    const eligibleListRes = await request(app)
      .get('/api/drives')
      .set('Cookie', eligibleStudentCookie);

    expect(eligibleListRes.status).toBe(200);
    const eligibleItem = eligibleListRes.body[0];
    expect(eligibleItem.eligible).toBe(true);
    expect(eligibleItem.reasons).toHaveLength(0);
  });

  // ==========================================
  // ADDITIONAL DRIVE CRUD & STORAGE TESTS
  // ==========================================

  it('allows main coordinator to create drive with valid PDF JD and download it', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const pdfBuffer = Buffer.from('%PDF-1.4 sample pdf content for job description');

    const res = await request(app)
      .post('/api/drives')
      .set('Cookie', mainCookie)
      .field('company', 'Apple')
      .field('description', 'iOS Engineer')
      .field('deadline', futureDate)
      .field('eligibleBranches', 'CSE, ECE')
      .field('minCgpa', '7.0')
      .field('maxActiveBacklogs', '1')
      .field('totalRounds', '3')
      .field(
        'extraFields',
        JSON.stringify([
          { key: 'portfolio', label: 'Portfolio URL', type: 'text', required: true },
        ])
      )
      .attach('file', pdfBuffer, 'apple_jd.pdf');

    expect(res.status).toBe(201);
    expect(res.body.company).toBe('Apple');
    expect(res.body.jdFileUrl).toContain('/uploads/');
    expect(res.body.totalRounds).toBe(3);
    expect(res.body.extraFields).toHaveLength(1);
    expect(res.body.open).toBe(true);

    const driveId = res.body.id;

    // Download JD file
    const downloadRes = await request(app)
      .get(`/api/drives/${driveId}/jd`)
      .set('Cookie', eligibleStudentCookie);

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers['content-type']).toContain('application/pdf');
    expect(downloadRes.headers['content-disposition']).toContain('attachment; filename="Apple_JD.pdf"');
    expect(downloadRes.body.toString()).toContain('%PDF-1.4 sample pdf content');
  });

  it('returns 404 when downloading JD from drive without an uploaded JD', async () => {
    const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post('/api/drives')
      .set('Cookie', mainCookie)
      .field('company', 'Netflix')
      .field('deadline', futureDate)
      .field('eligibleBranches', JSON.stringify(['CSE']));

    expect(res.status).toBe(201);
    const driveId = res.body.id;

    const downloadRes = await request(app)
      .get(`/api/drives/${driveId}/jd`)
      .set('Cookie', mainCookie);

    expect(downloadRes.status).toBe(404);
    expect(downloadRes.body.error.code).toBe('NOT_FOUND');
    expect(downloadRes.body.error.message).toContain('No Job Description');
  });

  it('returns drive details by ID with open and eligibility status', async () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const createRes = await request(app)
      .post('/api/drives')
      .set('Cookie', mainCookie)
      .field('company', 'Stripe')
      .field('deadline', futureDate)
      .field('eligibleBranches', JSON.stringify(['CSE']))
      .field('minCgpa', '8.0');

    expect(createRes.status).toBe(201);
    const driveId = createRes.body.id;

    // GET by ID for student
    const studentRes = await request(app)
      .get(`/api/drives/${driveId}`)
      .set('Cookie', eligibleStudentCookie);

    expect(studentRes.status).toBe(200);
    expect(studentRes.body.id).toBe(driveId);
    expect(studentRes.body.company).toBe('Stripe');
    expect(studentRes.body.open).toBe(true);
    expect(studentRes.body.eligible).toBe(true);

    // GET by ID for coordinator (open included)
    const coordRes = await request(app)
      .get(`/api/drives/${driveId}`)
      .set('Cookie', branchCookie);

    expect(coordRes.status).toBe(200);
    expect(coordRes.body.company).toBe('Stripe');
    expect(coordRes.body.open).toBe(true);
    expect(coordRes.body).not.toHaveProperty('eligible');
  });

  it('returns 404 for nonexistent driveId', async () => {
    const res = await request(app)
      .get('/api/drives/non-existent-drive-uuid')
      .set('Cookie', mainCookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ==========================================
  // ROUND PROGRESSION & PLACEMENT TESTS
  // ==========================================

  describe('PATCH /api/drives/:driveId/applications/:studentId/rounds', () => {
    let driveWith3RoundsId: string;

    beforeEach(async () => {
      driveWith3RoundsId = 'drv_rounds_test_uuid';
      await db.insert(drives).values({
        id: driveWith3RoundsId,
        company: 'Oracle',
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        eligibleBranches: ['CSE', 'ECE'],
        minCgpa: 7.0,
        maxActiveBacklogs: 1,
        totalRounds: 3,
        createdBy: mainCoordinator.id,
      });

      // Seed application for eligibleStudent (CSE)
      await db.insert(applications).values({
        id: 'app_alice_rounds',
        driveId: driveWith3RoundsId,
        studentUserId: eligibleStudent.id,
        verified: true,
      });

      // Seed application for ineligibleStudent (ECE)
      await db.insert(applications).values({
        id: 'app_bob_rounds',
        driveId: driveWith3RoundsId,
        studentUserId: ineligibleStudent.id,
        verified: true,
      });
    });

    it('cannot shortlist round 2 without round 1', async () => {
      const res = await request(app)
        .patch(`/api/drives/${driveWith3RoundsId}/applications/2022BCSE101/rounds`)
        .set('Cookie', mainCookie)
        .send({
          roundNumber: 2,
          result: 'SHORTLISTED',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('Cannot shortlist round 2 unless round 1 was SHORTLISTED');
    });

    it('round progression succeeds when round 1 was shortlisted', async () => {
      // 1. Shortlist round 1
      const r1Res = await request(app)
        .patch(`/api/drives/${driveWith3RoundsId}/applications/2022BCSE101/rounds`)
        .set('Cookie', mainCookie)
        .send({
          roundNumber: 1,
          result: 'SHORTLISTED',
        });

      expect(r1Res.status).toBe(200);

      // 2. Now shortlisting round 2 succeeds
      const r2Res = await request(app)
        .patch(`/api/drives/${driveWith3RoundsId}/applications/2022BCSE101/rounds`)
        .set('Cookie', mainCookie)
        .send({
          roundNumber: 2,
          result: 'SHORTLISTED',
        });

      expect(r2Res.status).toBe(200);
      expect(r2Res.body.rounds).toHaveLength(2);
    });

    it('rejects roundNumber exceeding drive totalRounds with 400', async () => {
      const res = await request(app)
        .patch(`/api/drives/${driveWith3RoundsId}/applications/2022BCSE101/rounds`)
        .set('Cookie', mainCookie)
        .send({
          roundNumber: 4, // Drive has totalRounds = 3
          result: 'SHORTLISTED',
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.message).toContain('cannot exceed total rounds (3)');
    });

    it('branch coordinator cannot update rounds of student in another branch (403)', async () => {
      // CSE coordinator attempts to update Bob (ECE)
      const res = await request(app)
        .patch(`/api/drives/${driveWith3RoundsId}/applications/2022BECE202/rounds`)
        .set('Cookie', branchCookie)
        .send({
          roundNumber: 1,
          result: 'SHORTLISTED',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('updates placed status when placed: true is provided', async () => {
      const res = await request(app)
        .patch(`/api/drives/${driveWith3RoundsId}/applications/2022BCSE101/rounds`)
        .set('Cookie', mainCookie)
        .send({
          placed: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.placed).toBe(true);
    });
  });

  // ==========================================
  // STATS & EXPORT TESTS
  // ==========================================

  describe('GET /api/drives/:driveId/stats and /export', () => {
    let statsDriveId: string;

    beforeEach(async () => {
      statsDriveId = 'drv_stats_test_uuid';
      await db.insert(drives).values({
        id: statsDriveId,
        company: 'Goldman Sachs',
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        eligibleBranches: ['CSE', 'ECE'],
        minCgpa: 6.0,
        maxActiveBacklogs: 2,
        totalRounds: 2,
        extraFields: [
          { key: 'github', label: 'GitHub URL', type: 'text', required: true },
        ],
        createdBy: mainCoordinator.id,
      });

      // Candidate 1: Alice (CSE) - Verified, Shortlisted R1, Placed
      await db.insert(applications).values({
        id: 'app_alice_stats',
        driveId: statsDriveId,
        studentUserId: eligibleStudent.id,
        extraData: { github: 'https://github.com/alice' },
        verified: true,
        placed: true,
      });

      // Shortlist Alice R1
      await request(app)
        .patch(`/api/drives/${statsDriveId}/applications/2022BCSE101/rounds`)
        .set('Cookie', mainCookie)
        .send({ roundNumber: 1, result: 'SHORTLISTED' });

      // Candidate 2: Bob (ECE) - Unverified, Shortlisted R1 & R2, not placed
      await db.insert(applications).values({
        id: 'app_bob_stats',
        driveId: statsDriveId,
        studentUserId: ineligibleStudent.id,
        extraData: { github: '=HYPERLINK("http://evil.com","Evil")' }, // Formula injection test
        verified: false, // Unverified
        placed: false,
      });

      // Shortlist Bob R1 and R2
      await request(app)
        .patch(`/api/drives/${statsDriveId}/applications/2022BECE202/rounds`)
        .set('Cookie', mainCookie)
        .send({ roundNumber: 1, result: 'SHORTLISTED' });
      await request(app)
        .patch(`/api/drives/${statsDriveId}/applications/2022BECE202/rounds`)
        .set('Cookie', mainCookie)
        .send({ roundNumber: 2, result: 'SHORTLISTED' });
    });

    it('stats match seeded data', async () => {
      const res = await request(app)
        .get(`/api/drives/${statsDriveId}/stats`)
        .set('Cookie', mainCookie);

      expect(res.status).toBe(200);
      expect(res.body.totals.applied).toBe(2);
      expect(res.body.totals.placed).toBe(1);
      expect(res.body.totals.shortlistedByRound).toEqual([2, 1]); // R1: 2, R2: 1

      const cseStat = res.body.branches.find((b: { branch: string }) => b.branch === 'CSE');
      expect(cseStat).toBeDefined();
      expect(cseStat.applied).toBe(1);
      expect(cseStat.placed).toBe(1);
      expect(cseStat.shortlistedByRound).toEqual([1, 0]);

      const eceStat = res.body.branches.find((b: { branch: string }) => b.branch === 'ECE');
      expect(eceStat).toBeDefined();
      expect(eceStat.applied).toBe(1);
      expect(eceStat.placed).toBe(0);
      expect(eceStat.shortlistedByRound).toEqual([1, 1]);
    });

    it('branch coordinator only sees their branch in stats', async () => {
      const res = await request(app)
        .get(`/api/drives/${statsDriveId}/stats`)
        .set('Cookie', branchCookie); // CSE coordinator

      expect(res.status).toBe(200);
      expect(res.body.branches).toHaveLength(1);
      expect(res.body.branches[0].branch).toBe('CSE');
      expect(res.body.totals.applied).toBe(1);
      expect(res.body.totals.placed).toBe(1);
    });

    it('student gets 403 on export', async () => {
      const res = await request(app)
        .get(`/api/drives/${statsDriveId}/export`)
        .set('Cookie', eligibleStudentCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('export generates valid workbook with both sheet names, unverified rows excluded, neutralized formula, and accurate totals', async () => {
      // First verify Bob so we test formula injection inside sheet 1
      await db
        .update(applications)
        .set({ verified: true })
        .where(eq(applications.id, 'app_bob_stats'));

      const res = await request(app)
        .get(`/api/drives/${statsDriveId}/export`)
        .set('Cookie', mainCookie)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toContain('attachment; filename="Goldman_Sachs_Candidates.xlsx"');

      // Parse returned buffer with ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);

      // 1. Assert both sheet names
      const sheet1 = workbook.getWorksheet('Consolidated Candidates');
      const sheet2 = workbook.getWorksheet('Branch-Wise Summary');
      expect(sheet1).toBeDefined();
      expect(sheet2).toBeDefined();

      // 2. Assert formula injection neutralization in Sheet 1
      // Find row for Bob
      let bobFound = false;
      sheet1?.eachRow((row) => {
        const values = row.values as (string | number)[];
        if (values && values.some((v) => v === '2022BECE202')) {
          bobFound = true;
          // The github extraField cell should be neutralized: starts with single quote
          const githubCell = values.find(
            (v) => typeof v === 'string' && v.includes('HYPERLINK')
          );
          expect(githubCell).toBeDefined();
          expect((githubCell as string).startsWith("'=")).toBe(true);
        }
      });
      expect(bobFound).toBe(true);

      // 3. Totals row equals sum in Sheet 2
      let totalRowValues: (string | number)[] | undefined;
      let cseApplied = 0;
      let eceApplied = 0;

      sheet2?.eachRow((row) => {
        const values = row.values as (string | number)[];
        if (values && values[1] === 'Total') {
          totalRowValues = values;
        } else if (values && values[1] === 'CSE') {
          cseApplied = Number(values[2]);
        } else if (values && values[1] === 'ECE') {
          eceApplied = Number(values[2]);
        }
      });

      expect(totalRowValues).toBeDefined();
      // Total applied in column 2 of total row should equal sum of CSE + ECE applied
      expect(Number(totalRowValues![2])).toBe(cseApplied + eceApplied);
    });

    it('unverified rows are excluded from export sheet 1', async () => {
      // Bob is unverified (verified: false) in statsDriveId
      await db
        .update(applications)
        .set({ verified: false })
        .where(eq(applications.id, 'app_bob_stats'));

      const res = await request(app)
        .get(`/api/drives/${statsDriveId}/export`)
        .set('Cookie', mainCookie)
        .responseType('blob');

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const sheet1 = workbook.getWorksheet('Consolidated Candidates');

      let bobInSheet = false;
      sheet1?.eachRow((row) => {
        const values = row.values as (string | number)[];
        if (values && values.some((v) => v === '2022BECE202')) {
          bobInSheet = true;
        }
      });
      expect(bobInSheet).toBe(false); // Unverified Bob excluded
    });

    it('branch coordinator export contains only their branch', async () => {
      // CSE coordinator exports
      const res = await request(app)
        .get(`/api/drives/${statsDriveId}/export`)
        .set('Cookie', branchCookie)
        .responseType('blob');

      expect(res.status).toBe(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);

      const sheet1 = workbook.getWorksheet('Consolidated Candidates');
      const sheet2 = workbook.getWorksheet('Branch-Wise Summary');

      // Sheet 1 has only CSE candidates
      sheet1?.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const values = row.values as (string | number)[];
          expect(values[4]).toBe('CSE'); // branch column
        }
      });

      // Sheet 2 has only CSE branch row + Totals
      let branchCount = 0;
      sheet2?.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          const values = row.values as (string | number)[];
          if (values[1] !== 'Total') {
            expect(values[1]).toBe('CSE');
            branchCount++;
          }
        }
      });
      expect(branchCount).toBe(1);
    });
  });
});

