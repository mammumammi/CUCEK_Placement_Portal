/**
 * @fileoverview Idempotent admin user seeding script.
 * @module scripts/seed-admin
 *
 * Reads ADMIN_USERNAME and ADMIN_PASSWORD environment variables to seed the
 * initial MAIN_COORDINATOR account.
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { createDb } from '@/core/db/client';
import { runMigrations } from '@/core/db/migrate';
import { users } from '@/core/db/schema/users.schema';
import { env } from '@/server/config/env';
import { hashPassword } from '@/server/modules/auth/password';

async function seedAdmin(): Promise<void> {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';

  // Ensure database migrations are up to date
  runMigrations(env.DATABASE_URL);

  console.log(`Checking for admin user: ${adminUsername}...`);
  const db = createDb(env.DATABASE_URL);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.username, adminUsername))
    .limit(1);

  if (existing) {
    console.log(`Admin user "${adminUsername}" already exists. No action needed.`);
    return;
  }

  const passwordHash = await hashPassword(adminPassword);

  await db.insert(users).values({
    id: crypto.randomUUID(),
    username: adminUsername,
    passwordHash,
    role: 'MAIN_COORDINATOR',
    branch: null,
    createdAt: new Date(),
  });

  console.log(`Successfully created MAIN_COORDINATOR user: "${adminUsername}"`);
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to seed admin user:', err);
    process.exit(1);
  });
