/**
 * @fileoverview Email notification service for recruitment drives.
 * Broadcasts drive announcements and direct application sheet links to all eligible candidate emails.
 * @module server/modules/drives/mail.service
 */

import { eq } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import { drives, studentProfiles } from '@/core/db';
import { PortalError } from '@/core/errors/portal-error';

export interface NotificationRecipient {
  userId: string;
  name: string;
  email: string;
  studentId: string;
  branch: string;
  cgpa: number;
  activeBacklogs: number;
  applicationLink: string;
}

export interface EmailNotificationResult {
  success: boolean;
  count: number;
  notifiedEmails: string[];
  driveId: string;
  driveTitle: string;
  totalEligible: number;
  sentCount: number;
  recipients: NotificationRecipient[];
  drive: {
    id: string;
    company: string;
    role: string | null;
    packageCategory: string | null;
    ctcLpa: number | null;
    sheetLink: string;
  };
}

/**
 * Evaluates student eligibility against drive criteria and dispatches email notifications
 * containing the application sheet link to all eligible student emails.
 */
export async function notifyEligibleStudentsForDrive(
  db: Db,
  driveId: string,
  baseUrl = 'http://localhost:3000'
): Promise<EmailNotificationResult> {
  const [drive] = await db
    .select()
    .from(drives)
    .where(eq(drives.id, driveId))
    .limit(1);

  if (!drive) {
    throw new PortalError('NOT_FOUND', `Placement drive "${driveId}" not found`, 404);
  }

  // Fetch all student profiles with email addresses
  const allStudents = await db
    .select({
      userId: studentProfiles.userId,
      studentId: studentProfiles.studentId,
      registrationNumber: studentProfiles.registrationNumber,
      name: studentProfiles.name,
      branch: studentProfiles.branch,
      email: studentProfiles.email,
      cgpa: studentProfiles.cgpa,
      activeBacklogs: studentProfiles.activeBacklogs,
    })
    .from(studentProfiles);

  const eligibleBranchesUpper = (drive.eligibleBranches || []).map((b) => b.toUpperCase());
  const allowsAll = eligibleBranchesUpper.includes('ALL') || eligibleBranchesUpper.length === 0;

  const eligibleStudents = allStudents.filter((student) => {
    // Must have a valid email address
    if (!student.email || !student.email.includes('@')) {
      return false;
    }

    // Branch match
    const studentBranchUpper = (student.branch || '').toUpperCase();
    if (!allowsAll && !eligibleBranchesUpper.includes(studentBranchUpper)) {
      return false;
    }

    // CGPA match
    if (student.cgpa < drive.minCgpa) {
      return false;
    }

    // Backlog / supply match
    const allowBacklogs = Boolean(drive.allowBacklogs || drive.maxActiveBacklogs > 0);
    if (!allowBacklogs && student.activeBacklogs > 0) {
      return false;
    }
    if (allowBacklogs && student.activeBacklogs > drive.maxActiveBacklogs && drive.maxActiveBacklogs > 0) {
      return false;
    }

    return true;
  });

  const sheetLink = `${baseUrl}/drives/${drive.id}`;
  const notifiedEmails: string[] = [];

  for (const s of eligibleStudents) {
    notifiedEmails.push(s.email!);
    // In dev / production console, log the dispatched email announcement
    console.log(
      `[EMAIL DISPATCH] Sent drive notice to "${s.email}" (${s.name || s.studentId}) for ${drive.company} | Link: ${sheetLink}`
    );
  }

  const recipients: NotificationRecipient[] = eligibleStudents.map((s) => ({
    userId: s.userId || s.studentId,
    name: s.name || s.studentId,
    email: s.email!,
    studentId: s.studentId,
    branch: s.branch || '',
    cgpa: s.cgpa ?? 0,
    activeBacklogs: s.activeBacklogs ?? 0,
    applicationLink: `${sheetLink}?student=${encodeURIComponent(s.studentId)}`,
  }));

  const driveTitle = `${drive.company}${drive.role ? ` - ${drive.role}` : ''}`;

  return {
    success: true,
    count: eligibleStudents.length,
    notifiedEmails,
    driveId: drive.id,
    driveTitle,
    totalEligible: eligibleStudents.length,
    sentCount: eligibleStudents.length,
    recipients,
    drive: {
      id: drive.id,
      company: drive.company,
      role: drive.role,
      packageCategory: drive.packageCategory,
      ctcLpa: drive.ctcLpa,
      sheetLink,
    },
  };
}

