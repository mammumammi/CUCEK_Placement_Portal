/**
 * @fileoverview Database client factory supporting both better-sqlite3 (local dev)
 * and Cloudflare D1 (production Workers deployment).
 * @module core/db/client
 */

import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './index';

/**
 * Type alias for the strongly-typed Drizzle database instance.
 * Both better-sqlite3 and D1 Drizzle instances expose the same query API,
 * so we use a union type to allow either.
 */
export type Db = BetterSQLite3Database<typeof schema> | DrizzleD1Database<typeof schema>;

/**
 * Creates and initializes a Drizzle SQLite database instance (local dev / tests).
 *
 * @param url - Path to the SQLite database file or ':memory:'.
 * @returns Fully typed Drizzle ORM database instance configured with WAL and foreign keys enabled.
 */
export function createDb(url: string): BetterSQLite3Database<typeof schema> {
  const sqlite = new Database(url);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');
  return drizzle(sqlite, { schema });
}

/**
 * Creates a Drizzle DB instance backed by a Cloudflare D1 binding.
 *
 * @param d1 - The D1Database binding provided by Cloudflare Workers runtime.
 * @returns Drizzle ORM database instance backed by D1.
 */
export function createD1Db(d1: D1Database): DrizzleD1Database<typeof schema> {
  return drizzleD1(d1, { schema });
}
