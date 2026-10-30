/**
 * @fileoverview Users table schema definition for Drizzle ORM SQLite.
 * @module core/db/schema/users
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { UserRole } from '@/core/types/roles';

export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text('username').notNull().unique(),
  passwordHash: text('passwordHash').notNull(),
  role: text('role', {
    enum: ['STUDENT', 'BRANCH_COORDINATOR', 'MAIN_COORDINATOR'],
  })
    .$type<UserRole>()
    .notNull()
    .default('STUDENT'),
  branch: text('branch'),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
