/**
 * @fileoverview Integration tests for the Profiles module Express routes and service.
 * @module server/modules/profiles/profiles.routes.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { createApp } from '@/server/app';
import { createTestDb } from '@/test/test-db';
import { createUser, loginAs } from '@/test/seed';
import { users, studentProfiles, semesterResults, auditLogs } from '@/core/db';
import type { Db } from '@/core/db/client';
import { correctStudentProfile } from './profiles.service';

describe('Profiles Module (/api/profiles)', () => {
  let db: Db;
  let app: Express;

  // Test actors
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

  const cseStudentId = '2022BCSE001';
  const eceStudentId = '2022BECE001';

  beforeEach(async () => {
    db = createTestDb();
    app = createApp(db);

    // 1. Create coordinators
    mainCoordinator = await createUser(db, {
      username: 'main_admin',
      role: 'MAIN_COORDINATOR',
      branch: null,
    }) as typeof mainCoordinator;
    mainCookie = await loginAs(app, mainCoordinator);

    cseCoordinator = await createUser(db, {
      username: 'cse_coord',
      role: 'BRANCH_COORDINATOR',
      branch: 'CSE',
    }) as typeof cseCoordinator;
    cseCookie = await loginAs(app, cseCoordinator);

    eceCoordinator = await createUser(db, {
      username: 'ece_coord',
      role: 'BRANCH_COORDINATOR',
      branch: 'ECE',
    }) as typeof eceCoordinator;
    eceCookie = await loginAs(app, eceCoordinator);

    // 2. Create student users and their profiles
    cseStudentUser = await createUser(db, {
      username: cseStudentId,
      role: 'STUDENT',
      branch: 'CSE',
    }) as typeof cseStudentUser;
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
      cgpa: 8.0,
      resumeUrl: 'https://storage.college.edu/resumes/alice.pdf',
    });

    await db.insert(semesterResults).values([
      {
        id: 'sem-1-cse',
        userId: cseStudentUser.id,
        semester: 1,
        credits: 20,
        sgpa: 8.0,
      },
      {
        id: 'sem-2-cse',
        userId: cseStudentUser.id,
        semester: 2,
        credits: 20,
        sgpa: 8.0,
      },
    ]);

    eceStudentUser = await createUser(db, {
      username: eceStudentId,
      role: 'STUDENT',
      branch: 'ECE',
    }) as typeof eceStudentUser;
    eceStudentCookie = await loginAs(app, eceStudentUser);

    await db.insert(studentProfiles).values({
      userId: eceStudentUser.id,
      studentId: eceStudentId,
      name: 'Bob ECE',
      branch: 'ECE',
      batch: '2022-2026',
      email: 'bob@ece.college.edu',
      phone: '9123456780',
      activeBacklogs: 1,
      cgpa: 7.5,
    });
  });

  // ==========================================
  // REQUIRED SPECIFICATION TESTS
  // ==========================================

  it('1. student patch -> 403 and DB unchanged', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${cseStudentId}/correct`)
      .set('Cookie', cseStudentCookie)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    // Verify DB profile unchanged
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, cseStudentId));
    expect(profile.name).toBe('Alice CSE');

    // Verify zero audit logs written
    const logs = await db.select().from(auditLogs);
    expect(logs).toHaveLength(0);
  });

  it('2. branch coordinator own branch -> 200', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${cseStudentId}/correct`)
      .set('Cookie', cseCookie)
      .send({
        name: 'Alice Cooper',
        phone: '9876500000',
        activeBacklogs: 2,
      });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice Cooper');
    expect(res.body.phone).toBe('9876500000');
    expect(res.body.activeBacklogs).toBe(2);

    // Verify DB was updated
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, cseStudentId));
    expect(profile.name).toBe('Alice Cooper');
    expect(profile.phone).toBe('9876500000');
    expect(profile.activeBacklogs).toBe(2);
  });

  it('3. branch coordinator other branch -> 403', async () => {
    // CSE coordinator attempts to patch ECE student
    const res = await request(app)
      .patch(`/api/profiles/${eceStudentId}/correct`)
      .set('Cookie', cseCookie)
      .send({ name: 'Should Not Change' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    // Verify DB was not changed
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, eceStudentId));
    expect(profile.name).toBe('Bob ECE');
  });

  it('4. branch coordinator changing branch to another -> 403', async () => {
    // CSE coordinator attempts to move CSE student to ECE
    const res = await request(app)
      .patch(`/api/profiles/${cseStudentId}/correct`)
      .set('Cookie', cseCookie)
      .send({ branch: 'ECE' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('cannot move students to another branch');

    // Verify branch unchanged in DB
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, cseStudentId));
    expect(profile.branch).toBe('CSE');
  });

  it('5. unknown field in body -> 400', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${cseStudentId}/correct`)
      .set('Cookie', mainCookie)
      .send({
        name: 'Alice Valid',
        unrecognizedField: 'invalid_payload',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    // Verify DB unchanged
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, cseStudentId));
    expect(profile.name).toBe('Alice CSE');
  });

  it('6. audit diffs contain correct oldValue and newValue', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${cseStudentId}/correct`)
      .set('Cookie', mainCookie)
      .send({
        name: 'Alice Johnson',
        phone: '9998887776',
      });

    expect(res.status).toBe(200);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.studentUserId, cseStudentUser.id));

    expect(logs).toHaveLength(2);

    const nameLog = logs.find((l) => l.field === 'name');
    expect(nameLog).toBeDefined();
    expect(nameLog?.oldValue).toBe('Alice CSE');
    expect(nameLog?.newValue).toBe('Alice Johnson');
    expect(nameLog?.actorId).toBe(mainCoordinator.id);

    const phoneLog = logs.find((l) => l.field === 'phone');
    expect(phoneLog).toBeDefined();
    expect(phoneLog?.oldValue).toBe('9876543210');
    expect(phoneLog?.newValue).toBe('9998887776');
    expect(phoneLog?.actorId).toBe(mainCoordinator.id);
  });

  it('7. no-op patch writes no audit rows', async () => {
    const res = await request(app)
      .patch(`/api/profiles/${cseStudentId}/correct`)
      .set('Cookie', mainCookie)
      .send({
        name: 'Alice CSE', // Same as existing
        phone: '9876543210', // Same as existing
      });

    expect(res.status).toBe(200);

    // Verify zero audit rows written
    const logs = await db.select().from(auditLogs);
    expect(logs).toHaveLength(0);
  });

  it("8. correcting an SGPA updates CGPA and records an audit log row for field='cgpa'", async () => {
    // Current: Sem 1: 20cr, 8.0 SGPA; Sem 2: 20cr, 8.0 SGPA -> CGPA = 8.0
    // Correction: Sem 1 SGPA from 8.0 to 9.0
    // New CGPA: (20*9.0 + 20*8.0) / 40 = 340 / 40 = 8.5
    const res = await request(app)
      .patch(`/api/profiles/${cseStudentId}/correct`)
      .set('Cookie', cseCookie)
      .send({
        semesters: [{ semester: 1, credits: 20, sgpa: 9.0 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.cgpa).toBe(8.5);

    // Verify updated in DB
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, cseStudentId));
    expect(profile.cgpa).toBe(8.5);

    // Verify semesterResults table updated
    const sems = await db
      .select()
      .from(semesterResults)
      .where(eq(semesterResults.userId, cseStudentUser.id));
    const sem1 = sems.find((s) => s.semester === 1);
    expect(sem1?.sgpa).toBe(9.0);

    // Verify audit logs contains field='cgpa'
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.studentUserId, cseStudentUser.id));

    expect(logs).toHaveLength(1);
    expect(logs[0].field).toBe('cgpa');
    expect(logs[0].oldValue).toBe('8');
    expect(logs[0].newValue).toBe('8.5');
  });

  it('9. transaction rollback on failure leaves zero partial audit rows', async () => {
    // Using a non-existent actorId triggers SQLite FOREIGN KEY constraint on auditLogs.actorId
    // when inserting the audit log, causing the synchronous transaction to throw and rollback.
    const fakeActor = {
      id: 'usr_non_existent_foreign_key',
      role: 'MAIN_COORDINATOR',
      branch: null,
    };

    await expect(
      correctStudentProfile(db, fakeActor, cseStudentId, {
        name: 'Should Rollback Name',
      })
    ).rejects.toThrow();

    // Verify DB profile was NOT updated
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.studentId, cseStudentId));
    expect(profile.name).toBe('Alice CSE');

    // Verify zero audit logs recorded
    const logs = await db.select().from(auditLogs);
    expect(logs).toHaveLength(0);
  });

  // ==========================================
  // ADDITIONAL ROUTE SPECIFICATION TESTS
  // ==========================================

  describe('GET /api/profiles/me', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/profiles/me');
      expect(res.status).toBe(401);
    });

    it('returns 403 when accessed by non-student', async () => {
      const res = await request(app)
        .get('/api/profiles/me')
        .set('Cookie', mainCookie);
      expect(res.status).toBe(403);
    });

    it('returns 200 with student profile and semester results', async () => {
      const res = await request(app)
        .get('/api/profiles/me')
        .set('Cookie', cseStudentCookie);

      expect(res.status).toBe(200);
      expect(res.body.studentId).toBe(cseStudentId);
      expect(res.body.name).toBe('Alice CSE');
      expect(res.body.semesters).toHaveLength(2);
      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  describe('GET /api/profiles/:studentId', () => {
    it('returns 404 for nonexistent studentId', async () => {
      const res = await request(app)
        .get('/api/profiles/NONEXISTENT')
        .set('Cookie', mainCookie);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('allows student to view their own profile', async () => {
      const res = await request(app)
        .get(`/api/profiles/${cseStudentId}`)
        .set('Cookie', cseStudentCookie);

      expect(res.status).toBe(200);
      expect(res.body.studentId).toBe(cseStudentId);
    });

    it('forbids student from viewing another student profile (403)', async () => {
      const res = await request(app)
        .get(`/api/profiles/${eceStudentId}`)
        .set('Cookie', cseStudentCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows branch coordinator to view own branch student', async () => {
      const res = await request(app)
        .get(`/api/profiles/${cseStudentId}`)
        .set('Cookie', cseCookie);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Alice CSE');
    });

    it('forbids branch coordinator from viewing another branch student (403)', async () => {
      const res = await request(app)
        .get(`/api/profiles/${eceStudentId}`)
        .set('Cookie', cseCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('allows main coordinator to view any student across branches', async () => {
      const cseRes = await request(app)
        .get(`/api/profiles/${cseStudentId}`)
        .set('Cookie', mainCookie);
      expect(cseRes.status).toBe(200);

      const eceRes = await request(app)
        .get(`/api/profiles/${eceStudentId}`)
        .set('Cookie', mainCookie);
      expect(eceRes.status).toBe(200);
    });
  });

  describe('GET /api/profiles (List profiles)', () => {
    it('forbids students from listing profiles (403)', async () => {
      const res = await request(app)
        .get('/api/profiles')
        .set('Cookie', cseStudentCookie);
      expect(res.status).toBe(403);
    });

    it('forces branch coordinator strictly to their own branch', async () => {
      // Even if ?branch=ECE is passed, CSE coordinator only gets CSE students
      const res = await request(app)
        .get('/api/profiles?branch=ECE')
        .set('Cookie', cseCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].branch).toBe('CSE');
    });

    it('allows main coordinator to list all profiles or filter by branch query', async () => {
      const allRes = await request(app)
        .get('/api/profiles')
        .set('Cookie', mainCookie);

      expect(allRes.status).toBe(200);
      expect(allRes.body).toHaveLength(2);

      const eceOnlyRes = await request(app)
        .get('/api/profiles?branch=ECE')
        .set('Cookie', mainCookie);

      expect(eceOnlyRes.status).toBe(200);
      expect(eceOnlyRes.body).toHaveLength(1);
      expect(eceOnlyRes.body[0].branch).toBe('ECE');
    });
  });

  describe('GET /api/profiles/:studentId/audit-logs', () => {
    it('forbids students from accessing audit logs (403)', async () => {
      const res = await request(app)
        .get(`/api/profiles/${cseStudentId}/audit-logs`)
        .set('Cookie', cseStudentCookie);
      expect(res.status).toBe(403);
    });

    it('forbids branch coordinator from viewing audit logs of another branch (403)', async () => {
      const res = await request(app)
        .get(`/api/profiles/${eceStudentId}/audit-logs`)
        .set('Cookie', cseCookie);
      expect(res.status).toBe(403);
    });

    it('allows coordinator to retrieve audit logs for own branch student', async () => {
      // Create an audit entry first
      await request(app)
        .patch(`/api/profiles/${cseStudentId}/correct`)
        .set('Cookie', cseCookie)
        .send({ name: 'Alice Renamed' });

      const res = await request(app)
        .get(`/api/profiles/${cseStudentId}/audit-logs`)
        .set('Cookie', cseCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].field).toBe('name');
      expect(res.body[0].newValue).toBe('Alice Renamed');
    });
  });

  describe('Main coordinator branch modification', () => {
    it('allows main coordinator to move student to a different branch and syncs users table', async () => {
      const res = await request(app)
        .patch(`/api/profiles/${cseStudentId}/correct`)
        .set('Cookie', mainCookie)
        .send({ branch: 'MECH' });

      expect(res.status).toBe(200);
      expect(res.body.branch).toBe('MECH');

      // Check users table was synced
      const [u] = await db
        .select()
        .from(users)
        .where(eq(users.id, cseStudentUser.id));
      expect(u.branch).toBe('MECH');

      // Check audit log recorded
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.studentUserId, cseStudentUser.id));
      const branchLog = logs.find((l) => l.field === 'branch');
      expect(branchLog?.oldValue).toBe('CSE');
      expect(branchLog?.newValue).toBe('MECH');
    });
  });
});

