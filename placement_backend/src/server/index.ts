/**
 * @fileoverview Server bootstrap and listener entry point.
 * @module server/index
 */

import { env } from './config/env';
import { createDb } from '@/core/db/client';
import { runMigrations } from '@/core/db/migrate';
import { createApp } from './app';

// Run database migrations on startup if running local SQLite (e.g. Render / local dev)
try {
  runMigrations(env.DATABASE_URL);
} catch (err) {
  console.warn('Initial migration check info:', err);
}

// Initialize SQLite database instance
const db = createDb(env.DATABASE_URL);

// Create Express application
const app = createApp(db);

// Start HTTP server binding to 0.0.0.0 for Render / cloud containers
const port = env.PORT || 4000;
const host = '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`Placement Portal Backend listening on http://${host}:${port}`);
  console.log(`Active Environment: ${env.NODE_ENV}`);
});

export default server;

