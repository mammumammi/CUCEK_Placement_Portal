/**
 * @fileoverview Comprehensive Seed script for sample dev users, department logins, and mock placement drives.
 * Creates:
 * 1. MAIN_COORDINATOR: admin / AdminPassword123!
 * 2. BRANCH_COORDINATORS / DEPARTMENT LOGINS:
 *    - CSE: cse_coord, cse_dept / CoordPassword123!
 *    - ECE: ece_coord, ece_dept / CoordPassword123!
 *    - EEE: eee_coord, eee_dept / CoordPassword123!
 *    - IT: it_coord, it_dept / CoordPassword123!
 *    - CIVIL: civil_coord, civil_dept / CoordPassword123!
 *    - MCA: mca_coord, mca_dept / CoordPassword123!
 * 3. Sample students across all 6 departments with full academic records.
 * 4. Sample Placement Drives (Dream, General, Internship) with placed applications.
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { createDb } from '@/core/db/client';
import { runMigrations } from '@/core/db/migrate';
import { users } from '@/core/db/schema/users.schema';
import { studentProfiles, semesterResults } from '@/core/db/schema/profiles.schema';
import { drives, applications } from '@/core/db/schema/drives.schema';
import { env } from '@/server/config/env';
import { hashPassword } from '@/server/modules/auth/password';

export const ALL_BRANCHES = ['CSE', 'ECE', 'EEE', 'IT', 'CIVIL', 'MCA'] as const;

async function seedDevData() {
  console.log('--- Seeding Dev Data ---');
  runMigrations(env.DATABASE_URL);
  const db = createDb(env.DATABASE_URL);

  const defaultCoordPassword = 'CoordPassword123!';
  const coordHash = await hashPassword(defaultCoordPassword);

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

  // 1b. Seed Batch 2028 Super Admin
  const [existingAdmin2028] = await db.select().from(users).where(eq(users.username, 'admin_2028')).limit(1);
  if (!existingAdmin2028) {
    const admin2028Hash = await hashPassword('Admin2028Password!');
    await db.insert(users).values({
      id: crypto.randomUUID(),
      username: 'admin_2028',
      passwordHash: admin2028Hash,
      role: 'MAIN_COORDINATOR',
      branch: null,
      createdAt: new Date(),
    });
    console.log('Created Batch 2028 Super Admin: admin_2028 / Admin2028Password!');
  }

  // 2. Seed Department / Branch Coordinators for CSE, ECE, EEE, IT, CIVIL, MCA
  const juniorCoordPassword = 'JuniorCoord2028!';
  const juniorCoordHash = await hashPassword(juniorCoordPassword);

  for (const branch of ALL_BRANCHES) {
    const coordUsername = `${branch.toLowerCase()}_coord`;
    const deptUsername = `${branch.toLowerCase()}_dept`;
    const juniorUsername = `${branch.toLowerCase()}_junior_2028`;
    const juniorCoord2028 = `${branch.toLowerCase()}_coord_2028`;

    for (const uName of [coordUsername, deptUsername]) {
      const [existing] = await db.select().from(users).where(eq(users.username, uName)).limit(1);
      if (!existing) {
        await db.insert(users).values({
          id: crypto.randomUUID(),
          username: uName,
          passwordHash: coordHash,
          role: 'BRANCH_COORDINATOR',
          branch,
          createdAt: new Date(),
        });
        console.log(`Created Department Login: ${uName} / ${defaultCoordPassword} (${branch})`);
      }
    }

    // Seed Junior Coordinators for Batch 2028
    for (const jName of [juniorUsername, juniorCoord2028]) {
      const [existingJ] = await db.select().from(users).where(eq(users.username, jName)).limit(1);
      if (!existingJ) {
        await db.insert(users).values({
          id: crypto.randomUUID(),
          username: jName,
          passwordHash: juniorCoordHash,
          role: 'BRANCH_COORDINATOR',
          branch,
          createdAt: new Date(),
        });
        console.log(`Created Junior Coordinator (Batch 2028): ${jName} / ${juniorCoordPassword} (${branch})`);
      }
    }
  }

  // 3. Seed Placement Drives
  const driveConfigs = [
    {
      company: 'Google',
      role: 'Software Development Engineer (SDE-1)',
      description: 'Google is hiring software engineers to build scalable distributed systems and cloud services.',
      packageCategory: 'DREAM' as const,
      ctcLpa: 28.5,
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      eligibleBranches: ['CSE', 'ECE', 'EEE', 'IT', 'MCA'],
      minCgpa: 7.5,
      allowBacklogs: false,
      maxActiveBacklogs: 0,
      totalRounds: 3,
      extraFields: [
        { key: 'preferredLocation', label: 'Preferred Location', type: 'dropdown' as const, options: ['Bangalore', 'Hyderabad', 'Gurgaon'], required: true },
        { key: 'githubUrl', label: 'GitHub Profile URL', type: 'text' as const, required: false },
        { key: 'codingExperience', label: 'Years of Coding Experience', type: 'number' as const, required: false },
      ],
    },
    {
      company: 'Microsoft',
      role: 'Software Engineer',
      description: 'Microsoft hiring engineers for Core OS, Azure Cloud, and AI development.',
      packageCategory: 'DREAM' as const,
      ctcLpa: 22.0,
      deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      eligibleBranches: ['CSE', 'ECE', 'EEE', 'IT', 'MCA'],
      minCgpa: 7.0,
      allowBacklogs: false,
      maxActiveBacklogs: 0,
      totalRounds: 3,
      extraFields: [
        { key: 'portfolioUrl', label: 'Portfolio Link', type: 'text' as const, required: false },
        { key: 'internshipExpMonths', label: 'Internship Experience (Months)', type: 'number' as const, required: false },
      ],
    },
    {
      company: 'Tata Consultancy Services (TCS)',
      role: 'Digital Systems Engineer Trainee',
      description: 'TCS Digital campus recruitment drive for engineering and computer application graduates.',
      packageCategory: 'GENERAL' as const,
      ctcLpa: 7.0,
      deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      eligibleBranches: ['CSE', 'ECE', 'EEE', 'IT', 'CIVIL', 'MCA'],
      minCgpa: 6.0,
      allowBacklogs: true,
      maxActiveBacklogs: 1,
      totalRounds: 2,
      extraFields: [
        { key: 'willingToRelocate', label: 'Willing to Relocate', type: 'dropdown' as const, options: ['Yes', 'No'], required: true },
      ],
    },
    {
      company: 'Amazon',
      role: '6-Month Summer Technical Intern',
      description: 'Amazon technical internship program offering live project mentoring and competitive stipend.',
      packageCategory: 'INTERNSHIP' as const,
      ctcLpa: null,
      deadline: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      eligibleBranches: ['CSE', 'IT', 'ECE', 'MCA'],
      minCgpa: 7.0,
      allowBacklogs: false,
      maxActiveBacklogs: 0,
      totalRounds: 2,
      extraFields: [
        { key: 'preferredDomain', label: 'Preferred Domain', type: 'dropdown' as const, options: ['Backend', 'Full Stack', 'Machine Learning'], required: true },
      ],
    },
  ];

  const driveMap: Record<string, string> = {};
  for (const conf of driveConfigs) {
    const [existing] = await db.select().from(drives).where(eq(drives.company, conf.company)).limit(1);
    if (!existing) {
      const dId = crypto.randomUUID();
      await db.insert(drives).values({
        id: dId,
        ...conf,
        createdBy: adminId,
        createdAt: new Date(),
      });
      driveMap[conf.company] = dId;
      console.log(`Created drive: ${conf.company} (${conf.packageCategory})`);
    } else {
      driveMap[conf.company] = existing.id;
      // Update with new fields if needed
      await db.update(drives).set({
        role: conf.role,
        packageCategory: conf.packageCategory,
        ctcLpa: conf.ctcLpa,
        eligibleBranches: conf.eligibleBranches,
        minCgpa: conf.minCgpa,
        allowBacklogs: conf.allowBacklogs,
        maxActiveBacklogs: conf.maxActiveBacklogs,
        extraFields: conf.extraFields,
      }).where(eq(drives.id, existing.id));
    }
  }

  // 4. Seed Students across CSE, ECE, EEE, IT, CIVIL, MCA
  const studentData = [
    // CSE
    {
      id: '2022BCSE001',
      regNo: 'REG-2022-CSE-001',
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
      placedCompany: 'Google',
      marksheetUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view?usp=sharing',
    },
    {
      id: '2022BCSE010',
      regNo: 'REG-2022-CSE-010',
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
      placedCompany: 'Microsoft',
      marksheetUrl: 'https://drive.google.com/file/d/1RohanGuptaConsolidatedMarksheet/view',
    },
    {
      id: '2022BCSE011',
      regNo: 'REG-2022-CSE-011',
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
      placedCompany: 'Amazon',
      marksheetUrl: 'https://drive.google.com/file/d/1SnehaPatelConsolidatedMarksheet/view',
    },
    // ECE
    {
      id: '2022BECE005',
      regNo: 'REG-2022-ECE-005',
      name: 'Priya Nair',
      firstName: 'Priya',
      lastName: 'Nair',
      dob: '2004-05-18',
      age: 22,
      branch: 'ECE',
      batch: '2026',
      email: 'priya.nair@college.edu',
      phone: '9876500003',
      activeBacklogs: 0,
      cgpa: 8.10,
      totalMarks: 4860,
      maxMarks: 6000,
      percentage: 81.0,
      placedCompany: 'Tata Consultancy Services (TCS)',
      marksheetUrl: 'https://drive.google.com/file/d/1PriyaNairMarksheet/view',
    },
    {
      id: '2022BECE008',
      regNo: 'REG-2022-ECE-008',
      name: 'Rahul Varma',
      firstName: 'Rahul',
      lastName: 'Varma',
      dob: '2004-11-04',
      age: 22,
      branch: 'ECE',
      batch: '2026',
      email: 'rahul.varma@college.edu',
      phone: '9876500004',
      activeBacklogs: 1,
      cgpa: 6.80,
      totalMarks: 4080,
      maxMarks: 6000,
      percentage: 68.0,
      placedCompany: null,
      marksheetUrl: 'https://drive.google.com/file/d/1RahulVarmaMarksheet/view',
    },
    // EEE
    {
      id: '2022BEEE002',
      regNo: 'REG-2022-EEE-002',
      name: 'Ananya Das',
      firstName: 'Ananya',
      lastName: 'Das',
      dob: '2004-02-14',
      age: 22,
      branch: 'EEE',
      batch: '2026',
      email: 'ananya.das@college.edu',
      phone: '9876500005',
      activeBacklogs: 0,
      cgpa: 8.40,
      totalMarks: 5040,
      maxMarks: 6000,
      percentage: 84.0,
      placedCompany: 'Tata Consultancy Services (TCS)',
      marksheetUrl: 'https://drive.google.com/file/d/1AnanyaDasMarksheet/view',
    },
    {
      id: '2022BEEE014',
      regNo: 'REG-2022-EEE-014',
      name: 'Sandeep Kumar',
      firstName: 'Sandeep',
      lastName: 'Kumar',
      dob: '2004-07-29',
      age: 22,
      branch: 'EEE',
      batch: '2026',
      email: 'sandeep.kumar@college.edu',
      phone: '9876500006',
      activeBacklogs: 0,
      cgpa: 7.20,
      totalMarks: 4320,
      maxMarks: 6000,
      percentage: 72.0,
      placedCompany: null,
      marksheetUrl: 'https://drive.google.com/file/d/1SandeepKumarMarksheet/view',
    },
    // IT
    {
      id: '2022BIT003',
      regNo: 'REG-2022-IT-003',
      name: 'Vikram Malhotra',
      firstName: 'Vikram',
      lastName: 'Malhotra',
      dob: '2004-06-10',
      age: 22,
      branch: 'IT',
      batch: '2026',
      email: 'vikram.malhotra@college.edu',
      phone: '9876500007',
      activeBacklogs: 0,
      cgpa: 8.90,
      totalMarks: 5340,
      maxMarks: 6000,
      percentage: 89.0,
      placedCompany: 'Google',
      marksheetUrl: 'https://drive.google.com/file/d/1VikramMalhotraMarksheet/view',
    },
    {
      id: '2022BIT012',
      regNo: 'REG-2022-IT-012',
      name: 'Neha Singh',
      firstName: 'Neha',
      lastName: 'Singh',
      dob: '2004-08-19',
      age: 22,
      branch: 'IT',
      batch: '2026',
      email: 'neha.singh@college.edu',
      phone: '9876500008',
      activeBacklogs: 0,
      cgpa: 7.80,
      totalMarks: 4680,
      maxMarks: 6000,
      percentage: 78.0,
      placedCompany: null,
      marksheetUrl: 'https://drive.google.com/file/d/1NehaSinghMarksheet/view',
    },
    // CIVIL
    {
      id: '2022BCIVIL001',
      regNo: 'REG-2022-CIV-001',
      name: 'Karthik Raj',
      firstName: 'Karthik',
      lastName: 'Raj',
      dob: '2004-01-25',
      age: 22,
      branch: 'CIVIL',
      batch: '2026',
      email: 'karthik.raj@college.edu',
      phone: '9876500009',
      activeBacklogs: 0,
      cgpa: 7.45,
      totalMarks: 4470,
      maxMarks: 6000,
      percentage: 74.5,
      placedCompany: null,
      marksheetUrl: 'https://drive.google.com/file/d/1KarthikRajMarksheet/view',
    },
    // MCA
    {
      id: '2024MCA006',
      regNo: 'REG-2024-MCA-006',
      name: 'Pooja Iyer',
      firstName: 'Pooja',
      lastName: 'Iyer',
      dob: '2002-12-05',
      age: 24,
      branch: 'MCA',
      batch: '2026',
      email: 'pooja.iyer@college.edu',
      phone: '9876500010',
      activeBacklogs: 0,
      cgpa: 9.05,
      totalMarks: 5430,
      maxMarks: 6000,
      percentage: 90.5,
      placedCompany: 'Microsoft',
      marksheetUrl: 'https://drive.google.com/file/d/1PoojaIyerMarksheet/view',
    },
  ];

  for (const s of studentData) {
    let studentUserId: string;
    const [existing] = await db.select().from(users).where(eq(users.username, s.id)).limit(1);
    if (!existing) {
      studentUserId = crypto.randomUUID();
      const hash = await hashPassword('StudentPassword123!');
      await db.insert(users).values({
        id: studentUserId,
        username: s.id,
        passwordHash: hash,
        role: 'STUDENT',
        branch: s.branch,
        createdAt: new Date(),
      });
      console.log(`Created student user: ${s.id} (${s.branch})`);
    } else {
      studentUserId = existing.id;
    }

    const [existingProfile] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, studentUserId)).limit(1);
    const profileValues = {
      userId: studentUserId,
      studentId: s.id,
      registrationNumber: s.regNo,
      name: s.name,
      firstName: s.firstName,
      lastName: s.lastName,
      dob: s.dob,
      age: s.age,
      branch: s.branch,
      batch: s.batch,
      email: s.email,
      phone: s.phone,
      activeBacklogs: s.activeBacklogs,
      cgpa: s.cgpa,
      totalMarks: s.totalMarks,
      maxMarks: s.maxMarks,
      percentage: s.percentage,
      isProfileComplete: true,
      marksheetUrl: s.marksheetUrl,
      s1MarksheetUrl: `${s.marksheetUrl}_Sem1`,
      s2MarksheetUrl: `${s.marksheetUrl}_Sem2`,
      s3MarksheetUrl: `${s.marksheetUrl}_Sem3`,
      s4MarksheetUrl: `${s.marksheetUrl}_Sem4`,
      s5MarksheetUrl: `${s.marksheetUrl}_Sem5`,
      s6MarksheetUrl: `${s.marksheetUrl}_Sem6`,
    };

    if (!existingProfile) {
      await db.insert(studentProfiles).values(profileValues);
    } else {
      await db.update(studentProfiles).set(profileValues).where(eq(studentProfiles.userId, studentUserId));
    }

    // Insert semester breakdown results
    const existingSems = await db.select().from(semesterResults).where(eq(semesterResults.userId, studentUserId));
    if (existingSems.length === 0) {
      for (let sem = 1; sem <= 6; sem++) {
        const semSgpa = Math.min(10, Math.max(5, s.cgpa + (sem % 2 === 0 ? 0.2 : -0.2)));
        await db.insert(semesterResults).values({
          id: crypto.randomUUID(),
          userId: studentUserId,
          semester: sem,
          credits: 20,
          sgpa: Number(semSgpa.toFixed(2)),
          totalMarks: Math.round(semSgpa * 95),
          maxMarks: 1000,
          percentage: Number((semSgpa * 9.5).toFixed(1)),
          marksheetUrl: `${s.marksheetUrl}_Sem${sem}`,
        });
      }
    }

    // Link application and placement if placed
    if (s.placedCompany && driveMap[s.placedCompany]) {
      const driveId = driveMap[s.placedCompany];
      const [existingApp] = await db
        .select()
        .from(applications)
        .where(eq(applications.studentUserId, studentUserId))
        .limit(1);

      if (!existingApp) {
        await db.insert(applications).values({
          id: crypto.randomUUID(),
          driveId,
          studentUserId,
          verified: true,
          verifiedBy: adminId,
          placed: true,
          extraData: {
            preferredLocation: 'Bangalore',
            willingToRelocate: 'Yes',
          },
          createdAt: new Date(),
        });
        console.log(`Placed student: ${s.name} (${s.branch}) -> ${s.placedCompany}`);
      } else {
        await db.update(applications).set({
          placed: true,
          verified: true,
        }).where(eq(applications.id, existingApp.id));
      }
    }
  }

  console.log('--- Dev Data Seeding Complete ---');
}

seedDevData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
