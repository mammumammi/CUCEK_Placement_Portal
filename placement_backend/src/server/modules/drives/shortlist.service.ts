/**
 * @fileoverview Shortlist PDF parsing, student database matching, and in-app round notifications.
 * @module server/modules/drives/shortlist.service
 */

import crypto from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import type { Db } from '@/core/db/client';
import {
  drives,
  studentProfiles,
  applications,
  applicationRounds,
  studentNotifications,
} from '@/core/db';
import { PortalError } from '@/core/errors/portal-error';
import { extractTextFromPdfBuffer } from './jd-summarizer.service';
import type { DriveActor } from './drives.service';

export interface MatchedShortlistStudent {
  userId: string;
  studentId: string;
  name: string;
  branch: string;
  email: string | null;
  matchSource: 'ROLL_NO' | 'REG_NO' | 'EMAIL' | 'NAME';
}

/**
 * Normalizes text for case-insensitive token and name matching.
 */
function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parses a shortlisted candidates PDF (and/or raw text) and matches against studentProfiles in DB.
 */
export async function parseShortlistPdfAndMatch(
  db: Db,
  actor: DriveActor,
  driveId: string,
  input: { pdfBuffer?: Buffer; rawText?: string }
): Promise<{
  matchedStudents: MatchedShortlistStudent[];
  extractedPreview: string;
}> {
  if (actor.role !== 'MAIN_COORDINATOR' && actor.role !== 'BRANCH_COORDINATOR') {
    throw new PortalError('FORBIDDEN', 'Only coordinators can upload shortlist PDFs', 403);
  }

  const [drive] = await db.select().from(drives).where(eq(drives.id, driveId)).limit(1);
  if (!drive) {
    throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
  }

  let extracted = '';
  if (input.pdfBuffer && input.pdfBuffer.length > 0) {
    extracted = extractTextFromPdfBuffer(input.pdfBuffer);
  }
  if (input.rawText && input.rawText.trim()) {
    extracted = `${extracted}\n${input.rawText.trim()}`.trim();
  }

  if (!extracted || extracted.trim().length < 2) {
    throw new PortalError(
      'VALIDATION_ERROR',
      'Could not extract readable text from the uploaded PDF. Please ensure it is a text-based PDF or paste the shortlist text.',
      400
    );
  }

  const normalizedCorpus = normalizeText(extracted);

  // Fetch all students (scoped to branch if BRANCH_COORDINATOR)
  const profiles =
    actor.role === 'BRANCH_COORDINATOR' && actor.branch
      ? await db
          .select()
          .from(studentProfiles)
          .where(eq(studentProfiles.branch, actor.branch))
      : await db.select().from(studentProfiles);

  const matchedStudents: MatchedShortlistStudent[] = [];
  const seenUserIds = new Set<string>();

  for (const p of profiles) {
    if (seenUserIds.has(p.userId)) continue;

    let matchSource: MatchedShortlistStudent['matchSource'] | null = null;

    // 1. Match by Roll No (studentId)
    if (p.studentId && p.studentId.trim().length >= 3) {
      const sidRegex = new RegExp(`(^|[^a-z0-9])${escapeRegex(p.studentId.trim().toLowerCase())}([^a-z0-9]|$)`, 'i');
      if (sidRegex.test(normalizedCorpus)) {
        matchSource = 'ROLL_NO';
      }
    }

    // 2. Match by Registration Number
    if (!matchSource && p.registrationNumber && p.registrationNumber.trim().length >= 3) {
      const regRegex = new RegExp(
        `(^|[^a-z0-9])${escapeRegex(p.registrationNumber.trim().toLowerCase())}([^a-z0-9]|$)`,
        'i'
      );
      if (regRegex.test(normalizedCorpus)) {
        matchSource = 'REG_NO';
      }
    }

    // 3. Match by Email
    if (!matchSource && p.email && p.email.trim().length >= 5) {
      if (normalizedCorpus.includes(p.email.trim().toLowerCase())) {
        matchSource = 'EMAIL';
      }
    }

    // 4. Match by Full Name (>= 4 chars)
    if (!matchSource && p.name && p.name.trim().length >= 4) {
      const normName = normalizeText(p.name);
      const nameRegex = new RegExp(`(^|[^a-z])${escapeRegex(normName)}([^a-z]|$)`, 'i');
      if (nameRegex.test(normalizedCorpus)) {
        matchSource = 'NAME';
      }
    }

    if (matchSource) {
      seenUserIds.add(p.userId);
      matchedStudents.push({
        userId: p.userId,
        studentId: p.studentId,
        name: p.name || p.studentId,
        branch: p.branch || 'CSE',
        email: p.email || null,
        matchSource,
      });
    }
  }

  return {
    matchedStudents,
    extractedPreview: extracted.slice(0, 600),
  };
}

/**
 * Confirms shortlisted students for a drive round/interview, updates application rounds,
 * and dispatches in-app notifications directly to each student.
 */
export async function confirmShortlistAndNotify(
  db: Db,
  actor: DriveActor,
  driveId: string,
  input: {
    studentUserIds: string[];
    roundNumber: number;
    roundName?: string;
    markAsPlaced?: boolean;
  }
) {
  if (actor.role !== 'MAIN_COORDINATOR' && actor.role !== 'BRANCH_COORDINATOR') {
    throw new PortalError('FORBIDDEN', 'Only coordinators can shortlist students', 403);
  }

  const [drive] = await db.select().from(drives).where(eq(drives.id, driveId)).limit(1);
  if (!drive) {
    throw new PortalError('NOT_FOUND', `Drive "${driveId}" not found`, 404);
  }

  if (!input.studentUserIds || input.studentUserIds.length === 0) {
    throw new PortalError('VALIDATION_ERROR', 'Please select at least one student to shortlist', 400);
  }

  const roundNum = Math.max(1, Math.floor(input.roundNumber || 1));
  const roundLabel = input.roundName?.trim() || `Round ${roundNum}`;
  const isPlaced = Boolean(input.markAsPlaced);

  let notifiedCount = 0;

  for (const studentUserId of input.studentUserIds) {
    const [profile] = await db
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, studentUserId))
      .limit(1);

    if (!profile) continue;

    // 1. Upsert application row
    const [existingApp] = await db
      .select()
      .from(applications)
      .where(and(eq(applications.driveId, driveId), eq(applications.studentUserId, studentUserId)))
      .limit(1);

    let applicationId: string;
    if (existingApp) {
      applicationId = existingApp.id;
      await db
        .update(applications)
        .set({
          verified: true,
          verifiedBy: actor.id,
          placed: isPlaced ? true : existingApp.placed,
        })
        .where(eq(applications.id, applicationId));
    } else {
      applicationId = crypto.randomUUID();
      await db.insert(applications).values({
        id: applicationId,
        driveId,
        studentUserId,
        verified: true,
        verifiedBy: actor.id,
        placed: isPlaced,
      });
    }

    // 2. Upsert application_rounds row
    const [existingRound] = await db
      .select()
      .from(applicationRounds)
      .where(
        and(
          eq(applicationRounds.applicationId, applicationId),
          eq(applicationRounds.roundNumber, roundNum)
        )
      )
      .limit(1);

    if (existingRound) {
      await db
        .update(applicationRounds)
        .set({ result: 'SHORTLISTED' })
        .where(eq(applicationRounds.id, existingRound.id));
    } else {
      await db.insert(applicationRounds).values({
        id: crypto.randomUUID(),
        applicationId,
        roundNumber: roundNum,
        result: 'SHORTLISTED',
      });
    }

    // 3. If marked as placed/selected, update studentProfiles.placementStatus
    if (isPlaced) {
      const statusCategory: 'UNPLACED' | 'GENERAL' | 'DREAM' | 'INTERNSHIP' =
        drive.packageCategory === 'DREAM' || drive.packageCategory === 'INTERNSHIP'
          ? drive.packageCategory
          : 'GENERAL';
      await db
        .update(studentProfiles)
        .set({ placementStatus: statusCategory })
        .where(eq(studentProfiles.userId, studentUserId));
    }

    // 4. Create in-website student notification
    const notifTitle = isPlaced
      ? `🎉 Selected / Placed — ${drive.company}`
      : `Shortlisted for ${roundLabel} — ${drive.company}`;
    const notifMessage = isPlaced
      ? `Congratulations ${profile.name || profile.studentId}! You have been selected for ${drive.role || 'this position'} at ${drive.company}.`
      : `Congratulations ${profile.name || profile.studentId}! You have been shortlisted for ${roundLabel} (${drive.role || 'Campus Drive'}) at ${drive.company}.`;

    await db.insert(studentNotifications).values({
      id: crypto.randomUUID(),
      studentUserId,
      driveId,
      title: notifTitle,
      message: notifMessage,
      roundLabel,
      read: false,
      createdAt: new Date(),
    });

    notifiedCount++;
  }

  return {
    success: true,
    notifiedCount,
    roundLabel,
    message: `${notifiedCount} student(s) shortlisted for ${roundLabel} and notified in the portal.`,
  };
}

/**
 * Lists in-app notifications for a student ordered newest first.
 */
export async function listStudentNotifications(db: Db, studentUserId: string) {
  return db
    .select()
    .from(studentNotifications)
    .where(eq(studentNotifications.studentUserId, studentUserId))
    .orderBy(desc(studentNotifications.createdAt));
}

/**
 * Marks a student notification as read.
 */
export async function markNotificationRead(
  db: Db,
  studentUserId: string,
  notificationId: string
) {
  await db
    .update(studentNotifications)
    .set({ read: true })
    .where(
      and(
        eq(studentNotifications.id, notificationId),
        eq(studentNotifications.studentUserId, studentUserId)
      )
    );
  return { success: true };
}
