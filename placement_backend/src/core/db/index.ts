/**
 * @fileoverview Database schema barrel export for Drizzle ORM.
 * @module core/db
 */

import { relations } from 'drizzle-orm';
import { users } from './schema/users.schema';
import { studentProfiles, semesterResults, auditLogs } from './schema/profiles.schema';
import { drives, applications, applicationRounds } from './schema/drives.schema';

export * from './schema/users.schema';
export * from './schema/profiles.schema';
export * from './schema/drives.schema';

// ---------------------------------------------------------------------------
// Relational Mappings
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(studentProfiles, {
    fields: [users.id],
    references: [studentProfiles.userId],
  }),
  semesterResults: many(semesterResults),
  applications: many(applications),
  auditLogsTriggered: many(auditLogs, { relationName: 'actorAuditLogs' }),
  createdDrives: many(drives),
}));

export const studentProfilesRelations = relations(studentProfiles, ({ one }) => ({
  user: one(users, {
    fields: [studentProfiles.userId],
    references: [users.id],
  }),
}));

export const semesterResultsRelations = relations(semesterResults, ({ one }) => ({
  user: one(users, {
    fields: [semesterResults.userId],
    references: [users.id],
  }),
}));

export const drivesRelations = relations(drives, ({ one, many }) => ({
  creator: one(users, {
    fields: [drives.createdBy],
    references: [users.id],
  }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  drive: one(drives, {
    fields: [applications.driveId],
    references: [drives.id],
  }),
  student: one(users, {
    fields: [applications.studentUserId],
    references: [users.id],
  }),
  verifier: one(users, {
    fields: [applications.verifiedBy],
    references: [users.id],
  }),
  rounds: many(applicationRounds),
}));

export const applicationRoundsRelations = relations(applicationRounds, ({ one }) => ({
  application: one(applications, {
    fields: [applicationRounds.applicationId],
    references: [applications.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
    relationName: 'actorAuditLogs',
  }),
  studentUser: one(users, {
    fields: [auditLogs.studentUserId],
    references: [users.id],
  }),
}));

export const schema = {
  users,
  studentProfiles,
  semesterResults,
  auditLogs,
  drives,
  applications,
  applicationRounds,
  usersRelations,
  studentProfilesRelations,
  semesterResultsRelations,
  drivesRelations,
  applicationsRelations,
  applicationRoundsRelations,
  auditLogsRelations,
};
