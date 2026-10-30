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
});

