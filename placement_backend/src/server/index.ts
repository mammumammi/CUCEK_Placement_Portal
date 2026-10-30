/**
 * @fileoverview Server bootstrap and listener entry point.
 * @module server/index
 */

import { env } from './config/env';
import { createDb } from '@/core/db/client';
import { createApp } from './app';

// Initialize SQLite database instance
const db = createDb(env.DATABASE_URL);

// Create Express application
const app = createApp(db);

// Start HTTP server
const server = app.listen(env.PORT, () => {
  console.log(`Placement Portal Backend listening on http://localhost:${env.PORT}`);
  console.log(`Active Environment: ${env.NODE_ENV}`);
});

export default server;

