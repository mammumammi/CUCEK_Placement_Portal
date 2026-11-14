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
      registrationNumber: 'REG-2022-CSE-001',
      name: 'Aditya Sharma',
      firstName: 'Aditya',
      lastName: 'Sharma',
      dob: '2004-03-12',
      age: 22,
      branch: 'CSE',
      batch: '2026',
      email: 'aditya.sharma@college.edu',
      phone: '9876543210',
      activeBacklogs: 0,
      cgpa: 8.75,
      totalMarks: 5250,
      maxMarks: 6000,
      percentage: 87.5,
      isProfileComplete: true,
      marksheetUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing',
      s1MarksheetUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
      s2MarksheetUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
      s3MarksheetUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
      resumeUrl: 'https://example.com/resumes/2022BCSE001.pdf',
    });

    // Semester results
    const semRecords = [
      { semester: 1, credits: 20, sgpa: 8.5, totalMarks: 850, maxMarks: 1000, percentage: 85.0, marksheetUrl: 'https://drive.google.com/file/d/1Sem1MarksheetLink/view' },
      { semester: 2, credits: 22, sgpa: 8.8, totalMarks: 880, maxMarks: 1000, percentage: 88.0, marksheetUrl: 'https://drive.google.com/file/d/1Sem2MarksheetLink/view' },
      { semester: 3, credits: 24, sgpa: 8.9, totalMarks: 890, maxMarks: 1000, percentage: 89.0, marksheetUrl: 'https://drive.google.com/file/d/1Sem3MarksheetLink/view' },
      { semester: 4, credits: 22, sgpa: 8.7, totalMarks: 870, maxMarks: 1000, percentage: 87.0, marksheetUrl: 'https://drive.google.com/file/d/1Sem4MarksheetLink/view' },
      { semester: 5, credits: 20, sgpa: 8.85, totalMarks: 885, maxMarks: 1000, percentage: 88.5, marksheetUrl: 'https://drive.google.com/file/d/1Sem5MarksheetLink/view' },
      { semester: 6, credits: 18, sgpa: 8.7, totalMarks: 870, maxMarks: 1000, percentage: 87.0, marksheetUrl: 'https://drive.google.com/file/d/1Sem6MarksheetLink/view' },
    ];
    for (const sem of semRecords) {
      await db.insert(semesterResults).values({
        id: crypto.randomUUID(),
        userId: studentUserId,
        semester: sem.semester,
        credits: sem.credits,
        sgpa: sem.sgpa,
        totalMarks: sem.totalMarks,
        maxMarks: sem.maxMarks,
        percentage: sem.percentage,
        marksheetUrl: sem.marksheetUrl,
      });
    }

    console.log('Created Student: 2022BCSE001 / StudentPassword123! (Aditya Sharma, CSE, CGPA: 8.75)');
  } else {
    studentUserId = existingStudent.id;
    // Update existing profile with new columns
    await db.update(studentProfiles).set({
      registrationNumber: 'REG-2022-CSE-001',
      firstName: 'Aditya',
      lastName: 'Sharma',
      dob: '2004-03-12',
      age: 22,
      totalMarks: 5250,
      maxMarks: 6000,
      percentage: 87.5,
      isProfileComplete: true,
      marksheetUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing',
      s1MarksheetUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
      s2MarksheetUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
      s3MarksheetUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view',
    }).where(eq(studentProfiles.userId, studentUserId));

    console.log('Updated Student "2022BCSE001" with marksheet, totalMarks, and percentage.');
  }

  // Seed additional students with drive marksheet links: Rohan Gupta (2022BCSE010)
  const student2Id = '2022BCSE010';
  const [existingStudent2] = await db.select().from(users).where(eq(users.username, student2Id)).limit(1);
  if (!existingStudent2) {
    const u2Id = crypto.randomUUID();
    const hash2 = await hashPassword(student2Id);
    await db.insert(users).values({
      id: u2Id,
      username: student2Id,
      passwordHash: hash2,
      role: 'STUDENT',
      branch: 'CSE',
      createdAt: new Date(),
    });
    await db.insert(studentProfiles).values({
      userId: u2Id,
      studentId: student2Id,
      registrationNumber: 'REG-2022-CSE-010',
      name: 'Rohan Gupta',
      firstName: 'Rohan',
      lastName: 'Gupta',
      dob: '2004-04-15',
      age: 22,
      branch: 'CSE',
      batch: '2026',
      email: 'rohan.gupta@college.edu',
      phone: '9876500001',
      activeBacklogs: 0,
      cgpa: 8.60,
      totalMarks: 5160,
      maxMarks: 6000,
      percentage: 86.0,
      isProfileComplete: true,
      marksheetUrl: 'https://drive.google.com/file/d/1RohanGuptaConsolidatedMarksheet/view',
      s1MarksheetUrl: 'https://drive.google.com/file/d/1RohanSem1Marksheet/view',
      s2MarksheetUrl: 'https://drive.google.com/file/d/1RohanSem2Marksheet/view',
    });
    for (let sem = 1; sem <= 6; sem++) {
      await db.insert(semesterResults).values({
        id: crypto.randomUUID(),
        userId: u2Id,
        semester: sem,
        credits: 20,
        sgpa: sem === 1 ? 8.5 : sem === 2 ? 8.7 : 8.6,
        percentage: sem === 1 ? 85.0 : sem === 2 ? 87.0 : 86.0,
        marksheetUrl: `https://drive.google.com/file/d/1RohanSem${sem}Marksheet/view`,
      });
    }
    console.log('Created Student: 2022BCSE010 / 2022BCSE010 (Rohan Gupta, CSE, CGPA: 8.60)');
  }

  // Seed additional students with drive marksheet links: Sneha Patel (2022BCSE011)
  const student3Id = '2022BCSE011';
  const [existingStudent3] = await db.select().from(users).where(eq(users.username, student3Id)).limit(1);
  if (!existingStudent3) {
    const u3Id = crypto.randomUUID();
    const hash3 = await hashPassword(student3Id);
    await db.insert(users).values({
      id: u3Id,
      username: student3Id,
      passwordHash: hash3,
      role: 'STUDENT',
      branch: 'CSE',
      createdAt: new Date(),
    });
    await db.insert(studentProfiles).values({
      userId: u3Id,
      studentId: student3Id,
      registrationNumber: 'REG-2022-CSE-011',
      name: 'Sneha Patel',
      firstName: 'Sneha',
      lastName: 'Patel',
      dob: '2004-09-22',
      age: 22,
      branch: 'CSE',
      batch: '2026',
      email: 'sneha.patel@college.edu',
      phone: '9876500002',
      activeBacklogs: 0,
      cgpa: 9.20,
      totalMarks: 5520,
      maxMarks: 6000,
      percentage: 92.0,
      isProfileComplete: true,
      marksheetUrl: 'https://drive.google.com/file/d/1SnehaPatelConsolidatedMarksheet/view',
      s1MarksheetUrl: 'https://drive.google.com/file/d/1SnehaSem1Marksheet/view',
      s2MarksheetUrl: 'https://drive.google.com/file/d/1SnehaSem2Marksheet/view',
    });
    for (let sem = 1; sem <= 6; sem++) {
      await db.insert(semesterResults).values({
        id: crypto.randomUUID(),
        userId: u3Id,
        semester: sem,
        credits: 22,
        sgpa: sem === 1 ? 9.1 : sem === 2 ? 9.3 : 9.2,
        percentage: sem === 1 ? 91.0 : sem === 2 ? 93.0 : 92.0,
        marksheetUrl: `https://drive.google.com/file/d/1SnehaSem${sem}Marksheet/view`,
      });
    }
    console.log('Created Student: 2022BCSE011 / 2022BCSE011 (Sneha Patel, CSE, CGPA: 9.20)');
  }

  // Seed sample student with INCOMPLETE profile (created by coordinator without email, phone, etc.)
  const studentIncompleteId = '2022BCSE099';
  const [existingIncomplete] = await db.select().from(users).where(eq(users.username, studentIncompleteId)).limit(1);
  if (!existingIncomplete) {
    const uIncId = crypto.randomUUID();
    const hashInc = await hashPassword(studentIncompleteId);
    await db.insert(users).values({
      id: uIncId,
      username: studentIncompleteId,
      passwordHash: hashInc,
      role: 'STUDENT',
      branch: 'CSE',
      createdAt: new Date(),
    });
    await db.insert(studentProfiles).values({
      userId: uIncId,
      studentId: studentIncompleteId,
      registrationNumber: 'REG-2022-CSE-099',
      branch: 'CSE',
      activeBacklogs: 0,
      cgpa: 0,
      isProfileComplete: false,
    });
    console.log('Created Incomplete Student: 2022BCSE099 / 2022BCSE099 (CSE, awaiting first login profile setup)');
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

