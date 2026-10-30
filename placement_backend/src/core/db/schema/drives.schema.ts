/**
 * @fileoverview Placement drives, applications, and application rounds schema definitions.
 * @module core/db/schema/drives
 */

import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { RoundResult } from '@/core/types/roles';
import { users } from './users.schema';

/**
 * Specification for dynamic additional form fields configured on a drive.
 */
export interface DriveExtraField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'dropdown';
  options?: string[];
  required?: boolean;
}

/**
 * Company placement drives table.
 */
export const drives = sqliteTable(
  'drives',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    company: text('company').notNull(),
    description: text('description'),
    jdFileUrl: text('jdFileUrl'),
    deadline: text('deadline').notNull(), // ISO UTC timestamp string
    eligibleBranches: text('eligibleBranches', { mode: 'json' })
      .$type<string[]>()
      .notNull(),
    minCgpa: real('minCgpa').notNull().default(0.0),
    maxActiveBacklogs: integer('maxActiveBacklogs').notNull().default(0),
    extraFields: text('extraFields', { mode: 'json' })
      .$type<DriveExtraField[]>()
      .default([]),
    totalRounds: integer('totalRounds').notNull().default(1),
    createdBy: text('createdBy')
      .notNull()
      .references(() => users.id),
    createdAt: integer('createdAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index('drives_created_by_idx').on(table.createdBy),
  ]
);

/**
 * Student applications submitted for recruitment drives.
 */
export const applications = sqliteTable(
  'applications',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    driveId: text('driveId')
      .notNull()
      .references(() => drives.id, { onDelete: 'cascade' }),
    studentUserId: text('studentUserId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    extraData: text('extraData', { mode: 'json' }).$type<Record<string, unknown>>(),
    verified: integer('verified', { mode: 'boolean' }).notNull().default(false),
    verifiedBy: text('verifiedBy').references(() => users.id),
    placed: integer('placed', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('createdAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('applications_drive_student_idx').on(table.driveId, table.studentUserId),
    index('applications_drive_id_idx').on(table.driveId),
    index('applications_student_user_id_idx').on(table.studentUserId),
    index('applications_verified_by_idx').on(table.verifiedBy),
  ]
);

/**
 * Application rounds tracking round-by-round selection outcomes.
 */
export const applicationRounds = sqliteTable(
  'application_rounds',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    applicationId: text('applicationId')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    roundNumber: integer('roundNumber').notNull(),
    result: text('result', { enum: ['SHORTLISTED', 'REJECTED'] })
      .$type<RoundResult>()
      .notNull(),
    createdAt: integer('createdAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex('application_rounds_app_round_idx').on(table.applicationId, table.roundNumber),
    index('application_rounds_app_id_idx').on(table.applicationId),
  ]
);

export type Drive = InferSelectModel<typeof drives>;
export type NewDrive = InferInsertModel<typeof drives>;

export type Application = InferSelectModel<typeof applications>;
export type NewApplication = InferInsertModel<typeof applications>;

export type ApplicationRound = InferSelectModel<typeof applicationRounds>;
export type NewApplicationRound = InferInsertModel<typeof applicationRounds>;
