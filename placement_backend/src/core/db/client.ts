/**
 * @fileoverview Database client factory using better-sqlite3 and Drizzle ORM.
 * @module core/db/client
 */

import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { D1Database } from '@cloudflare/workers-types';


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

/**
 * Creates a Drizzle DB instance for Cloudflare D1 binding.
 * @param binding - The D1 database binding provided by Cloudflare Workers.
 */
export function createD1Db(binding: D1Database): Db {
  // Import the D1 driver lazily to avoid loading it in non‑Worker environments.
  const { drizzle } = require('drizzle-orm/d1');
  return drizzle(binding, { schema }) as Db;
}

/**
 * Helper to obtain a DB instance based on environment configuration.
 * Use DB_TYPE='d1' and provide the D1 binding via the `env` argument for Workers.
 * Otherwise falls back to the local SQLite file defined by DATABASE_URL or ':memory:'.
 */
export function getDb(env?: { DB?: D1Database }): Db {
  if (process.env.DB_TYPE === 'd1' && env?.DB) {
    return createD1Db(env.DB);
  }
  const url = process.env.DATABASE_URL ?? ':memory:';
  return createDb(url);
}


