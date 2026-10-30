/**
 * @fileoverview Seed script for sample dev users and mock placement drive.
 * Creates:
 * 1. MAIN_COORDINATOR: admin / AdminPassword123!
 * 2. BRANCH_COORDINATOR: cse_coord / CoordPassword123! (branch: CSE)
 * 3. STUDENT: 2022BCSE001 / StudentPassword123! (branch: CSE, CGPA: 8.75)
 * 4. Sample Placement Drive: "Google Software Engineer Intern 2026"
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { createDb } from '@/core/db/client';
import { runMigrations } from '@/core/db/migrate';
import { users } from '@/core/db/schema/users.schema';
import { studentProfiles, semesterResults } from '@/core/db/schema/profiles.schema';
import { drives } from '@/core/db/schema/drives.schema';
import { env } from '@/server/config/env';
import { hashPassword } from '@/server/modules/auth/password';

async function seedDevData() {
  console.log('--- Seeding Dev Data ---');
  runMigrations(env.DATABASE_URL);
  const db = createDb(env.DATABASE_URL);

  // 1. Seed Main Coordinator (admin)
  const [existingAdmin] = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
  let adminId: string;
  if (!existingAdmin) {
    adminId = crypto.randomUUID();
    const hash = await hashPassword('AdminPassword123!');
    await db.insert(users).values({
      id: adminId,
      username: 'admin',
      passwordHash: hash,
      role: 'MAIN_COORDINATOR',
      branch: null,
      createdAt: new Date(),
    });
    console.log('Created Main Coordinator: admin / AdminPassword123!');
  } else {
    adminId = existingAdmin.id;
    console.log('Main Coordinator "admin" already exists.');
  }

  // 2. Seed Branch Coordinator (cse_coord)
  const [existingCoord] = await db.select().from(users).where(eq(users.username, 'cse_coord')).limit(1);
  if (!existingCoord) {
    const coordId = crypto.randomUUID();
    const hash = await hashPassword('CoordPassword123!');
    await db.insert(users).values({
      id: coordId,
      username: 'cse_coord',
      passwordHash: hash,
      role: 'BRANCH_COORDINATOR',
      branch: 'CSE',
      createdAt: new Date(),
    });
    console.log('Created Branch Coordinator: cse_coord / CoordPassword123! (CSE)');
  } else {
    console.log('Branch Coordinator "cse_coord" already exists.');
  }

  // 3. Seed Student (2022BCSE001)
  const studentUsername = '2022BCSE001';
  const [existingStudent] = await db.select().from(users).where(eq(users.username, studentUsername)).limit(1);
  let studentUserId: string;
  if (!existingStudent) {
    studentUserId = crypto.randomUUID();
    const hash = await hashPassword('StudentPassword123!');
    await db.insert(users).values({
      id: studentUserId,
      username: studentUsername,
      passwordHash: hash,
      role: 'STUDENT',
      branch: 'CSE',
      createdAt: new Date(),
    });

    // Profile
    await db.insert(studentProfiles).values({
      userId: studentUserId,
      studentId: studentUsername,
      name: 'Aditya Sharma',
      branch: 'CSE',
      batch: '2026',
      email: 'aditya.sharma@college.edu',
      phone: '9876543210',
      activeBacklogs: 0,
      cgpa: 8.75,
      resumeUrl: 'https://example.com/resumes/2022BCSE001.pdf',
    });

    // Semester results
    const semRecords = [
      { semester: 1, credits: 20, sgpa: 8.5 },
      { semester: 2, credits: 22, sgpa: 8.8 },
      { semester: 3, credits: 24, sgpa: 8.9 },
      { semester: 4, credits: 22, sgpa: 8.7 },
      { semester: 5, credits: 20, sgpa: 8.85 },
      { semester: 6, credits: 18, sgpa: 8.7 },
    ];
    for (const sem of semRecords) {
      await db.insert(semesterResults).values({
        id: crypto.randomUUID(),
        userId: studentUserId,
        semester: sem.semester,
        credits: sem.credits,
        sgpa: sem.sgpa,
      });
    }

    console.log('Created Student: 2022BCSE001 / StudentPassword123! (Aditya Sharma, CSE, CGPA: 8.75)');
  } else {
    studentUserId = existingStudent.id;
    console.log('Student "2022BCSE001" already exists.');
  }

  // 4. Sample Recruitment Drive
  const driveTitle = 'Google Software Engineer Intern 2026';
  const [existingDrive] = await db.select().from(drives).where(eq(drives.company, 'Google')).limit(1);
  if (!existingDrive) {
    const futureDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await db.insert(drives).values({
      id: crypto.randomUUID(),
      company: 'Google',
      description: 'Summer 2026 Software Engineer Internship Program.',
      jdFileUrl: '/uploads/sample_google_jd.pdf',
      deadline: futureDeadline,
      eligibleBranches: ['CSE', 'IT', 'ECE'],
      minCgpa: 7.5,
      maxActiveBacklogs: 0,
      totalRounds: 3,
      extraFields: [
        { key: 'preferredLocation', label: 'Preferred Location', type: 'dropdown', options: ['Bangalore', 'Hyderabad', 'Remote'], required: true },
        { key: 'githubUrl', label: 'GitHub Profile URL', type: 'text', required: false },
        { key: 'yearsOfCodingExperience', label: 'Years of Coding Experience', type: 'number', required: false },
      ],
      createdBy: adminId,
      createdAt: new Date(),
    });
    console.log(`Created sample recruitment drive: "${driveTitle}" (deadline in 14 days)`);
  } else {
    console.log('Sample drive for Google already exists.');
  }

  console.log('--- Dev Data Seeding Complete ---');
}

seedDevData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });

