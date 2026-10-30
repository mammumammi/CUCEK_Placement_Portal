/**
 * @fileoverview Integration tests for Drive Application Spreadsheet Express routes.
 * @module server/modules/spreadsheet/spreadsheet.routes.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { createApp } from '@/server/app';
import { createTestDb } from '@/test/test-db';
import { createUser, loginAs } from '@/test/seed';
import { drives, studentProfiles, applications } from '@/core/db';
import type { Db } from '@/core/db/client';

describe('Spreadsheet Module (/api/spreadsheet)', () => {
  let db: Db;
  let app: Express;

  // Actors
  let mainCoordinator: { id: string; role: 'MAIN_COORDINATOR'; branch: string | null };
  let mainCookie: string;

  let cseCoordinator: { id: string; role: 'BRANCH_COORDINATOR'; branch: string | null };
  let cseCookie: string;

  let eceCoordinator: { id: string; role: 'BRANCH_COORDINATOR'; branch: string | null };
  let eceCookie: string;

  let cseStudentUser: { id: string; role: 'STUDENT'; branch: string | null };
  let cseStudentCookie: string;

  let eceStudentUser: { id: string; role: 'STUDENT'; branch: string | null };
  let eceStudentCookie: string;

  let ineligibleStudentUser: { id: string; role: 'STUDENT'; branch: string | null };
  let ineligibleStudentCookie: string;

  const cseStudentId = '2022BCSE001';
  const eceStudentId = '2022BECE002';
  const ineligibleStudentId = '2022BMECH003';

  let activeDriveId: string;
  let expiredDriveId: string;

  beforeEach(async () => {
    db = createTestDb();
    app = createApp(db);

    // 1. Create coordinators
    mainCoordinator = (await createUser(db, {
      username: 'main_admin',
      role: 'MAIN_COORDINATOR',
      branch: null,
    })) as typeof mainCoordinator;
    mainCookie = await loginAs(app, mainCoordinator);

    cseCoordinator = (await createUser(db, {
      username: 'cse_coordinator',
      role: 'BRANCH_COORDINATOR',
      branch: 'CSE',
    })) as typeof cseCoordinator;
    cseCookie = await loginAs(app, cseCoordinator);

    eceCoordinator = (await createUser(db, {
      username: 'ece_coordinator',
      role: 'BRANCH_COORDINATOR',
      branch: 'ECE',
    })) as typeof eceCoordinator;
    eceCookie = await loginAs(app, eceCoordinator);

    // 2. Create CSE student Alice (Eligible: CGPA 8.5, Backlogs 0)
    cseStudentUser = (await createUser(db, {
      username: cseStudentId,
      role: 'STUDENT',
      branch: 'CSE',
    })) as typeof cseStudentUser;
    cseStudentCookie = await loginAs(app, cseStudentUser);

    await db.insert(studentProfiles).values({
      userId: cseStudentUser.id,
      studentId: cseStudentId,
      name: 'Alice CSE',
      branch: 'CSE',
      batch: '2022-2026',
      email: 'alice@cse.college.edu',
      phone: '9876543210',
      activeBacklogs: 0,
      cgpa: 8.5,
    });

    // 3. Create ECE student Bob (Eligible: CGPA 8.0, Backlogs 0)
    eceStudentUser = (await createUser(db, {
      username: eceStudentId,
      role: 'STUDENT',
      branch: 'ECE',
    })) as typeof eceStudentUser;
    eceStudentCookie = await loginAs(app, eceStudentUser);

    await db.insert(studentProfiles).values({
      userId: eceStudentUser.id,
      studentId: eceStudentId,
      name: 'Bob ECE',
      branch: 'ECE',
      batch: '2022-2026',
      email: 'bob@ece.college.edu',
      phone: '9123456780',
      activeBacklogs: 0,
      cgpa: 8.0,
    });

    // 4. Create ineligible MECH student Charlie (Ineligible: wrong branch, low CGPA)
    ineligibleStudentUser = (await createUser(db, {
      username: ineligibleStudentId,
      role: 'STUDENT',
      branch: 'MECH',
    })) as typeof ineligibleStudentUser;
    ineligibleStudentCookie = await loginAs(app, ineligibleStudentUser);

    await db.insert(studentProfiles).values({
      userId: ineligibleStudentUser.id,
      studentId: ineligibleStudentId,
      name: 'Charlie MECH',
      branch: 'MECH',
      batch: '2022-2026',
      email: 'charlie@mech.college.edu',
      phone: '9988776655',
      activeBacklogs: 2,
      cgpa: 6.0,
    });

    // 5. Seed an active drive (future deadline) with extra fields
    activeDriveId = 'drv_active_tech_corp';
    await db.insert(drives).values({
      id: activeDriveId,
      company: 'TechCorp',
      description: 'Software Engineer',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      eligibleBranches: ['CSE', 'ECE'],
      minCgpa: 7.5,
      maxActiveBacklogs: 0,
      totalRounds: 3,
      extraFields: [
        { key: 'github', label: 'GitHub URL', type: 'text', required: true },
        { key: 'experienceYears', label: 'Experience Years', type: 'number', required: false },
        { key: 'workMode', label: 'Work Mode', type: 'dropdown', options: ['Onsite', 'Hybrid', 'Remote'], required: true },
      ],
      createdBy: mainCoordinator.id,
    });

    // 6. Seed an expired drive (past deadline)
    expiredDriveId = 'drv_expired_legacy_corp';
    await db.insert(drives).values({
      id: expiredDriveId,
      company: 'LegacyCorp',
      description: 'Systems Analyst',
      deadline: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      eligibleBranches: ['CSE', 'ECE'],
      minCgpa: 7.0,
      maxActiveBacklogs: 1,
      totalRounds: 2,
      extraFields: [
        { key: 'github', label: 'GitHub URL', type: 'text', required: false },
      ],
      createdBy: mainCoordinator.id,
    });
  });

  // ==========================================
  // SPECIFICATION TESTS
  // ==========================================

  it('1. student edits their own row OK', async () => {
    // Alice applies first
    const applyRes = await request(app)
      .post(`/api/spreadsheet/drives/${activeDriveId}/apply`)
      .set('Cookie', cseStudentCookie)
      .send({
        extraData: {
          github: 'https://github.com/alice',
          workMode: 'Remote',
        },
      });

    expect(applyRes.status).toBe(201);

    // Alice edits her own extraData
    const patchRes = await request(app)
      .patch(`/api/spreadsheet/drives/${activeDriveId}/rows/${cseStudentId}`)
      .set('Cookie', cseStudentCookie)
      .send({
        extraData: {
          github: 'https://github.com/alice-updated',
          experienceYears: 1,
        },
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.extraData.github).toBe('https://github.com/alice-updated');
    expect(patchRes.body.extraData.experienceYears).toBe(1);
    expect(patchRes.body.extraData.workMode).toBe('Remote');
    expect(patchRes.body.studentId).toBe(cseStudentId);
  });

  it("2. student edits another's row 403", async () => {
    // Alice applies
    await request(app)
      .post(`/api/spreadsheet/drives/${activeDriveId}/apply`)
      .set('Cookie', cseStudentCookie)
      .send({
        extraData: { github: 'https://github.com/alice', workMode: 'Remote' },
      });

    // Bob tries to edit Alice's row
    const patchRes = await request(app)
      .patch(`/api/spreadsheet/drives/${activeDriveId}/rows/${cseStudentId}`)
      .set('Cookie', eceStudentCookie)
      .send({
        extraData: { github: 'https://github.com/hacked' },
      });

    expect(patchRes.status).toBe(403);
    expect(patchRes.body.error.code).toBe('FORBIDDEN');
    expect(patchRes.body.error.message).toContain('Students can only edit their own application row');

    // Verify Alice's row in DB is unchanged
    const [appRow] = await db
      .select()
      .from(applications)
      .where(eq(applications.studentUserId, cseStudentUser.id));
    expect(appRow.extraData).toEqual({
      github: 'https://github.com/alice',
      workMode: 'Remote',
    });
  });

  it('3. student sends name or cgpa -> 400/403 and the DB is unchanged', async () => {
    // Alice applies
    await request(app)
      .post(`/api/spreadsheet/drives/${activeDriveId}/apply`)
      .set('Cookie', cseStudentCookie)
      .send({
        extraData: { github: 'https://github.com/alice', workMode: 'Remote' },
      });

    // Alice attempts to send name and cgpa in patch
    const patchRes = await request(app)
      .patch(`/api/spreadsheet/drives/${activeDriveId}/rows/${cseStudentId}`)
      .set('Cookie', cseStudentCookie)
      .send({
        name: 'Hacked Name',
        cgpa: 10.0,
        extraData: { github: 'https://github.com/alice' },
      });

    expect([400, 403]).toContain(patchRes.status);
    expect(patchRes.body.error.code).toBe('VALIDATION_ERROR');

    // Verify studentProfiles in DB is unchanged
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, cseStudentId));
    expect(profile.name).toBe('Alice CSE');
    expect(profile.cgpa).toBe(8.5);
  });

  it('4. student after the deadline 403', async () => {
    // Seed an existing application on the expired drive for Alice
    await db.insert(applications).values({
      id: 'app_expired_alice',
      driveId: expiredDriveId,
      studentUserId: cseStudentUser.id,
      extraData: { github: 'https://github.com/alice-old' },
      verified: false,
      createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
    });

    // Alice attempts to patch her row after the deadline
    const patchRes = await request(app)
      .patch(`/api/spreadsheet/drives/${expiredDriveId}/rows/${cseStudentId}`)
      .set('Cookie', cseStudentCookie)
      .send({
        extraData: { github: 'https://github.com/alice-new' },
      });

    expect(patchRes.status).toBe(403);
    expect(patchRes.body.error.code).toBe('DEADLINE_PASSED');
    expect(patchRes.body.error.message).toContain('Application deadline has passed');

    // Verify DB unchanged
    const [appRow] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, 'app_expired_alice'));
    expect(appRow.extraData).toEqual({ github: 'https://github.com/alice-old' });
  });

  it('5. coordinator verifies after the deadline OK', async () => {
    // Seed an existing application on the expired drive for Alice (CSE)
    await db.insert(applications).values({
      id: 'app_expired_to_verify',
      driveId: expiredDriveId,
      studentUserId: cseStudentUser.id,
      extraData: { github: 'https://github.com/alice' },
      verified: false,
      createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
    });

    // CSE coordinator verifies Alice's row after the deadline
    const verifyRes = await request(app)
      .patch(`/api/spreadsheet/drives/${expiredDriveId}/rows/${cseStudentId}`)
      .set('Cookie', cseCookie)
      .send({ verified: true });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.verified).toBe(true);
    expect(verifyRes.body.verifiedBy).toBe(cseCoordinator.id);

    // Verify in database
    const [appRow] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, 'app_expired_to_verify'));
    expect(appRow.verified).toBe(true);
    expect(appRow.verifiedBy).toBe(cseCoordinator.id);
  });

  it('6. branch coordinator other-branch 403', async () => {
    // Seed application for ECE student Bob
    await db.insert(applications).values({
      id: 'app_bob_ece',
      driveId: activeDriveId,
      studentUserId: eceStudentUser.id,
      extraData: { github: 'https://github.com/bob', workMode: 'Hybrid' },
      verified: false,
      createdAt: new Date(),
    });

    // CSE coordinator attempts to verify Bob's ECE row
    const res = await request(app)
      .patch(`/api/spreadsheet/drives/${activeDriveId}/rows/${eceStudentId}`)
      .set('Cookie', cseCookie)
      .send({ verified: true });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Branch coordinators can only manage rows in their own branch');

    // Verify Bob's row is unverified in DB
    const [appRow] = await db
      .select()
      .from(applications)
      .where(eq(applications.id, 'app_bob_ece'));
    expect(appRow.verified).toBe(false);
  });

  it('7. invalid dropdown value 400', async () => {
    // Alice applies
    await request(app)
      .post(`/api/spreadsheet/drives/${activeDriveId}/apply`)
      .set('Cookie', cseStudentCookie)
      .send({
        extraData: { github: 'https://github.com/alice', workMode: 'Remote' },
      });

    // Patch with invalid dropdown value (workMode allows: Onsite, Hybrid, Remote)
    const res = await request(app)
      .patch(`/api/spreadsheet/drives/${activeDriveId}/rows/${cseStudentId}`)
      .set('Cookie', cseStudentCookie)
      .send({
        extraData: { workMode: 'MoonBase' },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('Invalid option "MoonBase" for dropdown "Work Mode"');
  });

  it('8. ineligible student cannot apply', async () => {
    // Charlie (MECH, CGPA 6.0, Backlogs 2) tries to apply to CSE/ECE drive
    const res = await request(app)
      .post(`/api/spreadsheet/drives/${activeDriveId}/apply`)
      .set('Cookie', ineligibleStudentCookie)
      .send({
        extraData: { github: 'https://github.com/charlie', workMode: 'Onsite' },
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INELIGIBLE');
    expect(res.body.error.message).toContain('Branch "MECH" is not eligible');

    // Verify zero applications in DB for Charlie
    const apps = await db
      .select()
      .from(applications)
      .where(eq(applications.studentUserId, ineligibleStudentUser.id));
    expect(apps).toHaveLength(0);
  });

  it('9. duplicate apply 409', async () => {
    // First apply succeeds
    const firstRes = await request(app)
      .post(`/api/spreadsheet/drives/${activeDriveId}/apply`)
      .set('Cookie', cseStudentCookie)
      .send({
        extraData: { github: 'https://github.com/alice', workMode: 'Onsite' },
      });
    expect(firstRes.status).toBe(201);

    // Second apply returns 409
    const secondRes = await request(app)
      .post(`/api/spreadsheet/drives/${activeDriveId}/apply`)
      .set('Cookie', cseStudentCookie)
      .send({
        extraData: { github: 'https://github.com/alice-again', workMode: 'Remote' },
      });

    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error.code).toBe('CONFLICT');
    expect(secondRes.body.error.message).toContain('already applied');
  });

  // ==========================================
  // ADDITIONAL SPREADSHEET ROUTE TESTS
  // ==========================================

  it('students cannot verify rows (verified: true -> 403)', async () => {
    // Alice applies
    await request(app)
      .post(`/api/spreadsheet/drives/${activeDriveId}/apply`)
      .set('Cookie', cseStudentCookie)
      .send({
        extraData: { github: 'https://github.com/alice', workMode: 'Remote' },
      });

    // Alice tries to verify her own row
    const res = await request(app)
      .patch(`/api/spreadsheet/drives/${activeDriveId}/rows/${cseStudentId}`)
      .set('Cookie', cseStudentCookie)
      .send({ verified: true });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Students are not authorized to verify');
  });

  it('GET /api/spreadsheet/drives/:driveId/rows scopes rows properly across roles', async () => {
    // Seed application for Alice (CSE) and Bob (ECE)
    await db.insert(applications).values([
      {
        id: 'app_alice_cse',
        driveId: activeDriveId,
        studentUserId: cseStudentUser.id,
        extraData: { github: 'https://github.com/alice', workMode: 'Remote' },
        verified: false,
        createdAt: new Date(),
      },
      {
        id: 'app_bob_ece',
        driveId: activeDriveId,
        studentUserId: eceStudentUser.id,
        extraData: { github: 'https://github.com/bob', workMode: 'Onsite' },
        verified: true,
        verifiedBy: eceCoordinator.id,
        createdAt: new Date(),
      },
    ]);

    // 1. Student Alice gets ONLY her own row
    const aliceRes = await request(app)
      .get(`/api/spreadsheet/drives/${activeDriveId}/rows`)
      .set('Cookie', cseStudentCookie);

    expect(aliceRes.status).toBe(200);
    expect(aliceRes.body).toHaveLength(1);
    expect(aliceRes.body[0].studentId).toBe(cseStudentId);
    expect(aliceRes.body[0].permissions.canEditExtraData).toBe(true);
    expect(aliceRes.body[0].permissions.canVerify).toBe(false);

    // 2. CSE Coordinator gets ONLY CSE rows (Alice)
    const cseRes = await request(app)
      .get(`/api/spreadsheet/drives/${activeDriveId}/rows`)
      .set('Cookie', cseCookie);

    expect(cseRes.status).toBe(200);
    expect(cseRes.body).toHaveLength(1);
    expect(cseRes.body[0].branch).toBe('CSE');
    expect(cseRes.body[0].permissions.canVerify).toBe(true);

    // 3. Main Coordinator gets ALL rows (Alice + Bob)
    const mainRes = await request(app)
      .get(`/api/spreadsheet/drives/${activeDriveId}/rows`)
      .set('Cookie', mainCookie);

    expect(mainRes.status).toBe(200);
    expect(mainRes.body).toHaveLength(2);
    expect(mainRes.body.map((r: { studentId: string }) => r.studentId).sort()).toEqual([
      cseStudentId,
      eceStudentId,
    ]);
  });
});

