/**
 * @fileoverview Integration and service tests for CGPA calculations and routes.
 * @module server/modules/cgpa/cgpa.routes.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { createApp } from '@/server/app';
import { createTestDb } from '@/test/test-db';
import { createUser, loginAs } from '@/test/seed';
import { studentProfiles, semesterResults } from '@/core/db';
import { recalculateAndStoreCgpa } from './cgpa.service';
import { applyBacklogRule } from './backlog.service';
import type { Db } from '@/core/db/client';

describe('CGPA Module (/api/cgpa)', () => {
  let db: Db;
  let app: Express;

  beforeEach(() => {
    db = createTestDb();
    app = createApp(db);
  });

  describe('POST /api/cgpa/calculate', () => {
    it('returns 401 without an authenticated session cookie', async () => {
      const res = await request(app)
        .post('/api/cgpa/calculate')
        .send({
          semesters: [{ semester: 1, credits: 20, sgpa: 8.5 }],
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('returns 200 with calculated credit-weighted CGPA when authenticated', async () => {
      const student = await createUser(db, {
        username: 'cgpa_student',
        role: 'STUDENT',
        branch: 'CSE',
      });
      const cookie = await loginAs(app, student);

      const res = await request(app)
        .post('/api/cgpa/calculate')
        .set('Cookie', cookie)
        .send({
          semesters: [
            { semester: 1, credits: 20, sgpa: 8 },
            { semester: 2, credits: 22, sgpa: 9 },
          ],
          activeBacklogs: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        cgpa: 8.52,
        activeBacklogs: 1,
      });
    });

    it('defaults activeBacklogs to 0 when omitted', async () => {
      const student = await createUser(db, {
        username: 'cgpa_student_default',
        role: 'STUDENT',
      });
      const cookie = await loginAs(app, student);

      const res = await request(app)
        .post('/api/cgpa/calculate')
        .set('Cookie', cookie)
        .send({
          semesters: [{ semester: 1, credits: 24, sgpa: 8.4 }],
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        cgpa: 8.4,
        activeBacklogs: 0,
      });
    });

    it('returns 400 on invalid input schema (negative credits)', async () => {
      const student = await createUser(db);
      const cookie = await loginAs(app, student);

      const res = await request(app)
        .post('/api/cgpa/calculate')
        .set('Cookie', cookie)
        .send({
          semesters: [{ semester: 1, credits: -5, sgpa: 8 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 on invalid input schema (SGPA out of range)', async () => {
      const student = await createUser(db);
      const cookie = await loginAs(app, student);

      const res = await request(app)
        .post('/api/cgpa/calculate')
        .set('Cookie', cookie)
        .send({
          semesters: [{ semester: 1, credits: 20, sgpa: 12 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('recalculateAndStoreCgpa', () => {
    it('reads stored semester results, computes CGPA, updates studentProfiles, and returns value', async () => {
      const user = await createUser(db, {
        id: 'usr_cgpa_recalc_test',
        username: 'recalc_user',
      });

      await db.insert(studentProfiles).values({
        userId: user.id,
        studentId: 'ROLL_RECALC_001',
        cgpa: 0,
      });

      await db.insert(semesterResults).values([
        { userId: user.id, semester: 1, credits: 20, sgpa: 8 },
        { userId: user.id, semester: 2, credits: 22, sgpa: 9 },
      ]);

      const computedCgpa = await recalculateAndStoreCgpa(db, user.id);
      expect(computedCgpa).toBe(8.52);

      const [updatedProfile] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, user.id));

      expect(updatedProfile).toBeDefined();
      expect(updatedProfile.cgpa).toBe(8.52);
    });

    it('returns 0 and updates profile when student has no semester results stored', async () => {
      const user = await createUser(db, {
        id: 'usr_cgpa_empty_test',
        username: 'empty_recalc_user',
      });

      await db.insert(studentProfiles).values({
        userId: user.id,
        studentId: 'ROLL_EMPTY_001',
        cgpa: 5.0,
      });

      const computedCgpa = await recalculateAndStoreCgpa(db, user.id);
      expect(computedCgpa).toBe(0);

      const [updatedProfile] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, user.id));

      expect(updatedProfile.cgpa).toBe(0);
    });
  });

  describe('applyBacklogRule', () => {
    it('returns cgpa unchanged and eligible: true as placeholder', () => {
      const result = applyBacklogRule(8.52, 2);
      expect(result).toEqual({
        cgpa: 8.52,
        eligible: true,
      });
    });
  });

  describe('Branch Curriculum Credits (/api/cgpa/branch-credits)', () => {
    it('returns default curriculum credits for a branch when not customized', async () => {
      const coord = await createUser(db, {
        username: 'cse_coord_test',
        role: 'BRANCH_COORDINATOR',
        branch: 'CSE',
      });
      const cookie = await loginAs(app, coord);

      const res = await request(app)
        .get('/api/cgpa/branch-credits?branch=CSE')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.branch).toBe('CSE');
      expect(res.body.credits).toHaveLength(8);
      expect(res.body.credits[0]).toEqual({
        branch: 'CSE',
        semester: 1,
        credits: 20,
      });
    });

    it('allows branch coordinator to update credits for their own branch', async () => {
      const coord = await createUser(db, {
        username: 'cse_coord_test2',
        role: 'BRANCH_COORDINATOR',
        branch: 'CSE',
      });
      const cookie = await loginAs(app, coord);

      const res = await request(app)
        .put('/api/cgpa/branch-credits')
        .set('Cookie', cookie)
        .send({
          branch: 'CSE',
          credits: [
            { semester: 1, credits: 24 },
            { semester: 2, credits: 26 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.branch).toBe('CSE');
      const sem1 = res.body.credits.find((c: any) => c.semester === 1);
      const sem2 = res.body.credits.find((c: any) => c.semester === 2);
      expect(sem1.credits).toBe(24);
      expect(sem2.credits).toBe(26);
    });

    it('forbids branch coordinator from setting credits for another branch', async () => {
      const coord = await createUser(db, {
        username: 'cse_coord_test3',
        role: 'BRANCH_COORDINATOR',
        branch: 'CSE',
      });
      const cookie = await loginAs(app, coord);

      const res = await request(app)
        .put('/api/cgpa/branch-credits')
        .set('Cookie', cookie)
        .send({
          branch: 'ECE',
          credits: [{ semester: 1, credits: 22 }],
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('forbids students from setting curriculum credits', async () => {
      const student = await createUser(db, {
        username: 'student_credit_test',
        role: 'STUDENT',
        branch: 'CSE',
      });
      const cookie = await loginAs(app, student);

      const res = await request(app)
        .put('/api/cgpa/branch-credits')
        .set('Cookie', cookie)
        .send({
          branch: 'CSE',
          credits: [{ semester: 1, credits: 25 }],
        });

      expect(res.status).toBe(403);
    });

    it('allows main coordinator (admin) to set credits centrally for any branch', async () => {
      const admin = await createUser(db, {
        username: 'main_admin_test',
        role: 'MAIN_COORDINATOR',
        branch: null,
      });
      const cookie = await loginAs(app, admin);

      const res = await request(app)
        .put('/api/cgpa/branch-credits')
        .set('Cookie', cookie)
        .send({
          branch: 'MECH',
          credits: [
            { semester: 1, credits: 21 },
            { semester: 2, credits: 23 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.branch).toBe('MECH');
      const s1 = res.body.credits.find((c: any) => c.semester === 1);
      expect(s1.credits).toBe(21);
    });

    it('recalculates student CGPA when recalculateStudents is true', async () => {
      // 1. Create student with semester 1 and 2
      const student = await createUser(db, {
        username: 'recalc_student',
        role: 'STUDENT',
        branch: 'CIVIL',
      });
      await db.insert(studentProfiles).values({
        userId: student.id,
        studentId: 'CIVIL001',
        cgpa: 8.0,
      });
      await db.insert(semesterResults).values([
        { id: 'sem_civ_1', userId: student.id, semester: 1, credits: 10, sgpa: 8.0 },
        { id: 'sem_civ_2', userId: student.id, semester: 2, credits: 10, sgpa: 10.0 },
      ]);
      // initial CGPA = (10*8 + 10*10)/20 = 9.0

      const admin = await createUser(db, {
        username: 'admin_recalc',
        role: 'MAIN_COORDINATOR',
      });
      const cookie = await loginAs(app, admin);

      // Change credits: Sem 1 = 30 credits, Sem 2 = 10 credits -> new CGPA = (30*8 + 10*10)/40 = 340/40 = 8.5
      const res = await request(app)
        .put('/api/cgpa/branch-credits')
        .set('Cookie', cookie)
        .send({
          branch: 'CIVIL',
          credits: [
            { semester: 1, credits: 30 },
            { semester: 2, credits: 10 },
          ],
          recalculateStudents: true,
        });

      expect(res.status).toBe(200);
      const [updatedProfile] = await db
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.userId, student.id));
      expect(updatedProfile.cgpa).toBe(8.5);
    });
  });
});

