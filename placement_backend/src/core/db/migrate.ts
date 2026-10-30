/**
 * @fileoverview Standalone database migration runner for SQLite Drizzle.
 * @module core/db/migrate
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDb } from './client';
import { env } from '@/server/config/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs pending Drizzle SQLite migrations against the specified database URL.
 */
export function runMigrations(dbUrl = env.DATABASE_URL): void {
  const db = createDb(dbUrl);
  const migrationsFolder = path.resolve(__dirname, '../../../drizzle');
  migrate(db, { migrationsFolder });
  console.log('Database migrations applied successfully.');
}

// Execute migration when run directly from CLI
if (process.argv[1] === __filename) {
  runMigrations();
}

