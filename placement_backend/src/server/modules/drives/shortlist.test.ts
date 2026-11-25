/**
 * @fileoverview Integration tests for Shortlist PDF matching, round notifications, and Previous Drives placed candidates.
 * @module server/modules/drives/shortlist.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '@/test/test-db';
import { users, studentProfiles, drives } from '@/core/db';
import { hashPassword } from '../auth/password';
import {
  parseShortlistPdfAndMatch,
  confirmShortlistAndNotify,
  listStudentNotifications,
  markNotificationRead,
} from './shortlist.service';
import { listDrives } from './drives.service';

describe('Shortlist PDF Matching, Notifications & Previous Drives', () => {
  let db: ReturnType<typeof createTestDb>;
  const adminActor = { id: 'admin-1', role: 'MAIN_COORDINATOR', branch: null };

  beforeEach(async () => {
    db = createTestDb();

    // Seed admin and 2 students
    const pwHash = await hashPassword('pass123');
    await db.insert(users).values([
      { id: 'admin-1', username: 'admin', passwordHash: pwHash, role: 'MAIN_COORDINATOR', branch: null },
      { id: 'stu-1', username: '2022BCSE001', passwordHash: pwHash, role: 'STUDENT', branch: 'CSE' },
      { id: 'stu-2', username: '2022BECE002', passwordHash: pwHash, role: 'STUDENT', branch: 'ECE' },
    ]);

    await db.insert(studentProfiles).values([
      {
        userId: 'stu-1',
        studentId: '2022BCSE001',
        registrationNumber: 'REG001',
        name: 'Aashin Mohammed',
        branch: 'CSE',
        batch: '2026',
        cgpa: 9.2,
        activeBacklogs: 0,
      },
      {
        userId: 'stu-2',
        studentId: '2022BECE002',
        registrationNumber: 'REG002',
        name: 'Priya Nair',
        branch: 'ECE',
        batch: '2026',
        cgpa: 8.6,
        activeBacklogs: 0,
      },
    ]);

    await db.insert(drives).values({
      id: 'drive-prev-1',
      company: 'Microsoft',
      role: 'Software Engineer',
      packageCategory: 'DREAM',
      ctcLpa: 22,
      deadline: new Date(Date.now() - 86400000).toISOString(), // Past deadline -> previous drive
      eligibleBranches: ['CSE', 'ECE'],
      minCgpa: 7,
      maxActiveBacklogs: 0,
      allowBacklogs: false,
      totalRounds: 3,
      createdBy: 'admin-1',
    });
  });

  it('matches students from uploaded shortlist PDF buffer and sends round notifications', async () => {
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n(Shortlisted Candidates for Round 2 Technical Interview: 2022BCSE001, Priya Nair) Tj\n%%EOF'
    );

    const parsed = await parseShortlistPdfAndMatch(db, adminActor, 'drive-prev-1', {
      pdfBuffer,
    });

    expect(parsed.matchedStudents).toHaveLength(2);
    expect(parsed.matchedStudents.map((s) => s.studentId).sort()).toEqual([
      '2022BCSE001',
      '2022BECE002',
    ]);

    const notifyRes = await confirmShortlistAndNotify(db, adminActor, 'drive-prev-1', {
      studentUserIds: ['stu-1'],
      roundNumber: 2,
      roundName: 'Round 2 - Technical Interview',
      markAsPlaced: true,
    });

    expect(notifyRes.success).toBe(true);
    expect(notifyRes.notifiedCount).toBe(1);

    const notifs = await listStudentNotifications(db, 'stu-1');
    expect(notifs).toHaveLength(1);
    expect(notifs[0].roundLabel).toBe('Round 2 - Technical Interview');
    expect(notifs[0].read).toBe(false);

    await markNotificationRead(db, 'stu-1', notifs[0].id);
    const updatedNotifs = await listStudentNotifications(db, 'stu-1');
    expect(updatedNotifs[0].read).toBe(true);

    // Verify listDrives returns isPrevious = true and placedCandidates populated
    const allDrives = await listDrives(db, adminActor);
    const msDrive = allDrives.find((d) => d.id === 'drive-prev-1');
    expect(msDrive).toBeDefined();
    expect(msDrive?.isPrevious).toBe(true);
    expect(msDrive?.placedCandidates).toHaveLength(1);
    expect(msDrive?.placedCandidates[0].name).toBe('Aashin Mohammed');
  });
});
