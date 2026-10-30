/**
 * @fileoverview Database client factory using better-sqlite3 and Drizzle ORM.
 * @module core/db/client
 */

import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './index';

/**
 * Type alias for the strongly-typed Drizzle better-sqlite3 database instance.
 */
export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Creates and initializes a Drizzle SQLite database instance.
 *
 * @param url - Path to the SQLite database file or ':memory:'.
 * @returns Fully typed Drizzle ORM database instance configured with WAL and foreign keys enabled.
 */
export function createDb(url: string): Db {
  const sqlite = new Database(url);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  return drizzle(sqlite, { schema });
}

