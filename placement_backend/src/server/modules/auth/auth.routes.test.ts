/**
 * @fileoverview Integration tests for authentication routes.
 * @module server/modules/auth/auth.routes.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '@/server/app';
import { createTestDb } from '@/test/test-db';
import { createUser, loginAs } from '@/test/seed';
import { hashPassword } from './password';
import type { Db } from '@/core/db/client';

describe('Auth Routes (/api/auth)', () => {
  let db: Db;
  let app: Express;

  beforeEach(() => {
    db = createTestDb();
    app = createApp(db);
  });

  describe('POST /api/auth/login', () => {
    it('authenticates valid credentials, sets session cookie, and returns sanitized user', async () => {
      const passwordHash = await hashPassword('StudentPassword123!');
      await createUser(db, {
        id: 'usr_student_test',
        username: 'john_doe',
        passwordHash,
        role: 'STUDENT',
        branch: 'CSE',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'john_doe', password: 'StudentPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe('usr_student_test');
      expect(res.body.user.username).toBe('john_doe');
      expect(res.body.user.role).toBe('STUDENT');
      expect(res.body.user.branch).toBe('CSE');
      expect(res.body.user.passwordHash).toBeUndefined(); // Security invariant!

      // Verify session cookie
      const rawCookies = res.headers['set-cookie'];
      const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
      expect(cookies.length).toBeGreaterThan(0);
      const sessionCookie = cookies.find((c) => typeof c === 'string' && c.startsWith('session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('SameSite=Lax');
    });

    it('returns uniform generic error for unknown user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'non_existent_user', password: 'AnyPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        },
      });
    });

    it('returns uniform generic error for wrong password', async () => {
      const passwordHash = await hashPassword('CorrectPassword123!');
      await createUser(db, {
        username: 'alice_smith',
        passwordHash,
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'alice_smith', password: 'WrongPassword456!' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        },
      });
    });

    it('rate limits failed login attempts and returns 429 JSON error', async () => {
      // Create an app instance with a tight rate limit of 2 failed attempts
      const limitedApp = createApp(db, {
        authLimiter: { limit: 2, windowMs: 60000 },
      });

      // Failed attempt 1
      const res1 = await request(limitedApp)
        .post('/api/auth/login')
        .send({ username: 'rate_limited_user', password: 'wrong' });
      expect(res1.status).toBe(401);

      // Failed attempt 2
      const res2 = await request(limitedApp)
        .post('/api/auth/login')
        .send({ username: 'rate_limited_user', password: 'wrong' });
      expect(res2.status).toBe(401);

      // Failed attempt 3 -> Must trigger 429
      const res3 = await request(limitedApp)
        .post('/api/auth/login')
        .send({ username: 'rate_limited_user', password: 'wrong' });
      expect(res3.status).toBe(429);
      expect(res3.body).toEqual({
        error: {
          code: 'RATE_LIMITED',
          message: expect.stringMatching(/too many/i),
        },
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session cookie and returns success response', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: 'Logged out successfully' });

      const rawCookies = res.headers['set-cookie'];
      const cookies = Array.isArray(rawCookies) ? rawCookies : rawCookies ? [rawCookies] : [];
      expect(cookies.length).toBeGreaterThan(0);
      const sessionCookie = cookies.find((c) => typeof c === 'string' && c.startsWith('session='));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/session=;.*Expires=/i);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 200 and user data when authenticated via cookie', async () => {
      const user = await createUser(db, {
        id: 'usr_me_test',
        username: 'me_user',
        role: 'BRANCH_COORDINATOR',
        branch: 'ECE',
      });

      const cookie = await loginAs(app, user);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe('usr_me_test');
      expect(res.body.user.username).toBe('me_user');
      expect(res.body.user.role).toBe('BRANCH_COORDINATOR');
      expect(res.body.user.branch).toBe('ECE');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 401 when session cookie is missing', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    });

    it('returns 401 when session cookie is invalid', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', 'session=invalid-token-string');

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired session',
        },
      });
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('changes password when current password is valid and allows login with new password', async () => {
      const initialHash = await hashPassword('OldPassword123!');
      const user = await createUser(db, {
        username: 'password_changer',
        passwordHash: initialHash,
      });

      const cookie = await loginAs(app, user);

      const changeRes = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'BrandNewPassword456!',
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body).toEqual({
        message: 'Password changed successfully',
      });

      // Verify login with new password succeeds
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'password_changer',
          password: 'BrandNewPassword456!',
        });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.username).toBe('password_changer');
    });

    it('returns 401 when current password is incorrect', async () => {
      const initialHash = await hashPassword('CorrectCurrentPassword123!');
      const user = await createUser(db, {
        username: 'wrong_current_test',
        passwordHash: initialHash,
      });

      const cookie = await loginAs(app, user);

      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Cookie', cookie)
        .send({
          currentPassword: 'IncorrectPassword!',
          newPassword: 'BrandNewPassword456!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Current password is incorrect',
        },
      });
    });
  });

  describe('POST /api/auth/coordinators', () => {
    it('allows MAIN_COORDINATOR to create a BRANCH_COORDINATOR', async () => {
      const admin = await createUser(db, {
        role: 'MAIN_COORDINATOR',
        branch: null,
      });

      const adminCookie = await loginAs(app, admin);

      const res = await request(app)
        .post('/api/auth/coordinators')
        .set('Cookie', adminCookie)
        .send({
          username: 'ece_coordinator',
          password: 'CoordPassword123!',
          branch: 'ECE',
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('ece_coordinator');
      expect(res.body.user.role).toBe('BRANCH_COORDINATOR');
      expect(res.body.user.branch).toBe('ECE');
      expect(res.body.user.passwordHash).toBeUndefined();

      // Verify coordinator can log in
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'ece_coordinator',
          password: 'CoordPassword123!',
        });
      expect(loginRes.status).toBe(200);
    });

    it('rejects creation attempt by non-MAIN_COORDINATOR (STUDENT) with 403 Forbidden', async () => {
      const student = await createUser(db, {
        role: 'STUDENT',
        branch: 'CSE',
      });

      const studentCookie = await loginAs(app, student);

      const res = await request(app)
        .post('/api/auth/coordinators')
        .set('Cookie', studentCookie)
        .send({
          username: 'illegal_coord',
          password: 'CoordPassword123!',
          branch: 'CSE',
        });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
        },
      });
    });

    it('rejects duplicate coordinator username with 400 validation error', async () => {
      const admin = await createUser(db, {
        role: 'MAIN_COORDINATOR',
      });
      await createUser(db, {
        username: 'existing_coord',
        role: 'BRANCH_COORDINATOR',
      });

      const adminCookie = await loginAs(app, admin);

      const res = await request(app)
        .post('/api/auth/coordinators')
        .set('Cookie', adminCookie)
        .send({
          username: 'existing_coord',
          password: 'Password123!',
          branch: 'MECH',
        });

      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Username is already taken',
        },
      });
    });
  });
});
