/**
 * @fileoverview Schema verification tests testing relational constraints, cascading, and indexes.
 * @module core/db/schema.test
 */

import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '@/test/test-db';
import {
  users,
  studentProfiles,
  semesterResults,
  drives,
  applications,
} from './index';

describe('Drizzle Database Schema Constraints & Cascading', () => {
  it('createTestDb works', () => {
    const db = createTestDb();
    expect(db).toBeDefined();
  });

  it('inserting a user + profile + semester results works', async () => {
    const db = createTestDb();

    // 1. Insert User
    await db.insert(users).values({
      id: 'usr_student_1',
      username: 'alice_smith',
      passwordHash: '$2b$10$hashedPasswordValue',
      role: 'STUDENT',
      branch: 'CSE',
    });

    // 2. Insert Student Profile
    await db.insert(studentProfiles).values({
      userId: 'usr_student_1',
      studentId: '2022BCSE001',
      name: 'Alice Smith',
      branch: 'CSE',
      batch: '2022-2026',
      email: 'alice@example.edu',
      phone: '+919876543210',
      activeBacklogs: 0,
      cgpa: 8.92,
      resumeUrl: 'https://r2.storage/resumes/alice.pdf',
      s1MarksheetUrl: 'https://r2.storage/marks/s1.pdf',
    });

    // 3. Insert Semester Results
    await db.insert(semesterResults).values([
      { userId: 'usr_student_1', semester: 1, credits: 24, sgpa: 8.8 },
      { userId: 'usr_student_1', semester: 2, credits: 24, sgpa: 9.04 },
    ]);

    // Verify User record
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, 'usr_student_1'));
    expect(user).toBeDefined();
    expect(user.username).toBe('alice_smith');
    expect(user.role).toBe('STUDENT');

    // Verify Profile record
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, 'usr_student_1'));
    expect(profile).toBeDefined();
    expect(profile.studentId).toBe('2022BCSE001');
    expect(profile.cgpa).toBe(8.92);

    // Verify Semester Results records
    const results = await db
      .select()
      .from(semesterResults)
      .where(eq(semesterResults.userId, 'usr_student_1'));
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.semester).sort()).toEqual([1, 2]);
  });

  it('duplicate studentId throws', async () => {
    const db = createTestDb();

    await db.insert(users).values([
      {
        id: 'usr_student_1',
        username: 'alice',
        passwordHash: 'hash1',
        role: 'STUDENT',
        branch: 'CSE',
      },
      {
        id: 'usr_student_2',
        username: 'bob',
        passwordHash: 'hash2',
        role: 'STUDENT',
        branch: 'ECE',
      },
    ]);

    await db.insert(studentProfiles).values({
      userId: 'usr_student_1',
      studentId: 'ROLL_DUPLICATE_TEST',
      name: 'Alice',
    });

    // Inserting another student with duplicate studentId must throw unique constraint error
    await expect(
      db.insert(studentProfiles).values({
        userId: 'usr_student_2',
        studentId: 'ROLL_DUPLICATE_TEST',
        name: 'Bob',
      })
    ).rejects.toThrow();
  });

  it('duplicate (driveId, studentUserId) throws', async () => {
    const db = createTestDb();

    await db.insert(users).values([
      {
        id: 'usr_admin',
        username: 'tpo_admin',
        passwordHash: 'admin_hash',
        role: 'MAIN_COORDINATOR',
        branch: null,
      },
      {
        id: 'usr_student_1',
        username: 'student_carol',
        passwordHash: 'hash3',
        role: 'STUDENT',
        branch: 'CSE',
      },
    ]);

    await db.insert(drives).values({
      id: 'drv_google_swe',
      company: 'Google',
      description: 'Software Engineer Campus Recruitment',
      deadline: '2026-11-15T23:59:59.000Z',
      eligibleBranches: ['CSE', 'IT'],
      minCgpa: 8.5,
      maxActiveBacklogs: 0,
      createdBy: 'usr_admin',
    });

    await db.insert(applications).values({
      id: 'app_1',
      driveId: 'drv_google_swe',
      studentUserId: 'usr_student_1',
      extraData: { willingToRelocate: true },
    });

    // Submitting duplicate application for the same (driveId, studentUserId) must throw
    await expect(
      db.insert(applications).values({
        id: 'app_2',
        driveId: 'drv_google_swe',
        studentUserId: 'usr_student_1',
      })
    ).rejects.toThrow();
  });

  it('deleting a user cascades to the profile', async () => {
    const db = createTestDb();

    await db.insert(users).values({
      id: 'usr_cascade_target',
      username: 'cascade_user',
      passwordHash: 'pass_hash',
      role: 'STUDENT',
      branch: 'MECH',
    });

    await db.insert(studentProfiles).values({
      userId: 'usr_cascade_target',
      studentId: 'CASCADE_ROLL_001',
      name: 'Cascade Target',
    });

    await db.insert(semesterResults).values({
      userId: 'usr_cascade_target',
      semester: 1,
      credits: 20,
      sgpa: 7.8,
    });

    // Delete the parent user
    await db.delete(users).where(eq(users.id, 'usr_cascade_target'));

    // Verify child student profile was cascaded
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, 'usr_cascade_target'));
    expect(profile).toBeUndefined();

    // Verify child semester results were cascaded
    const results = await db
      .select()
      .from(semesterResults)
      .where(eq(semesterResults.userId, 'usr_cascade_target'));
    expect(results).toHaveLength(0);
  });
});

