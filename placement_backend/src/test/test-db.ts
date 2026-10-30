/**
 * @fileoverview Test database factory creating migrated in-memory SQLite instances.
 * @module test/test-db
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/core/db';
import type { Db } from '@/core/db/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a fresh, isolated in-memory better-sqlite3 database with full migrations applied.
 *
 * @returns Fully migrated Db instance ready for test execution.
 */
export function createTestDb(): Db {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  const db: Db = drizzle(sqlite, { schema });
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');

  migrate(db, { migrationsFolder });
  return db;
}

