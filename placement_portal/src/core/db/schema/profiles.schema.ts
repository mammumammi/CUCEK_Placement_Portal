/**
 * @fileoverview Student profiles, semester results, and audit logs schema definitions.
 * @module core/db/schema/profiles
 */

import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users } from './users.schema';

/**
 * Student academic profile table.
 */
export const studentProfiles = sqliteTable(
  'student_profiles',
  {
    userId: text('userId')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    studentId: text('studentId').notNull().unique(),
    name: text('name'),
    branch: text('branch'),
    batch: text('batch'),
    email: text('email'),
    phone: text('phone'),
    activeBacklogs: integer('activeBacklogs').notNull().default(0),
    cgpa: real('cgpa').notNull().default(0),
    resumeUrl: text('resumeUrl'),
    s1MarksheetUrl: text('s1MarksheetUrl'),
    s2MarksheetUrl: text('s2MarksheetUrl'),
    s3MarksheetUrl: text('s3MarksheetUrl'),
    s4MarksheetUrl: text('s4MarksheetUrl'),
    s5MarksheetUrl: text('s5MarksheetUrl'),
    s6MarksheetUrl: text('s6MarksheetUrl'),
    createdAt: integer('createdAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('student_profiles_user_id_idx').on(table.userId),
  ]
);

/**
 * Semester results table tracking semester-wise SGPA and credits.
 */
export const semesterResults = sqliteTable(
  'semester_results',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    semester: integer('semester').notNull(),
    credits: integer('credits').notNull().default(0),
    sgpa: real('sgpa').notNull().default(0.0),
    createdAt: integer('createdAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('semester_results_user_semester_idx').on(table.userId, table.semester),
    index('semester_results_user_id_idx').on(table.userId),
  ]
);

/**
 * Audit logs table capturing field-level data mutations.
 */
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    actorId: text('actorId')
      .notNull()
      .references(() => users.id),
    studentUserId: text('studentUserId').references(() => users.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    oldValue: text('oldValue'),
    newValue: text('newValue'),
    createdAt: integer('createdAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('audit_logs_actor_id_idx').on(table.actorId),
    index('audit_logs_student_user_id_idx').on(table.studentUserId),
  ]
);

export type StudentProfile = InferSelectModel<typeof studentProfiles>;
export type NewStudentProfile = InferInsertModel<typeof studentProfiles>;

export type SemesterResult = InferSelectModel<typeof semesterResults>;
export type NewSemesterResult = InferInsertModel<typeof semesterResults>;

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;
