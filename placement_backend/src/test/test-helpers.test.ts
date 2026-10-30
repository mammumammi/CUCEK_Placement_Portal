/**
 * @fileoverview Unit tests for test helpers (createTestDb, seed utilities).
 * @module test/test-helpers.test
 */

import { describe, it, expect } from 'vitest';
import { createTestDb } from './test-db';
import { createUser } from './seed';
import { users } from '@/core/db/schema/users.schema';
import { eq } from 'drizzle-orm';

describe('Test Database and Seed Helpers', () => {
  it('creates an in-memory test database with migrations applied', async () => {
    const db = createTestDb();
    expect(db).toBeDefined();

    const created = await createUser(db, {
      id: 'student_123',
      role: 'STUDENT',
      branch: 'CSE',
    });

    expect(created.id).toBe('student_123');
    expect(created.role).toBe('STUDENT');
    expect(created.branch).toBe('CSE');

    const [found] = await db.select().from(users).where(eq(users.id, 'student_123'));
    expect(found).toBeDefined();
    expect(found.id).toBe('student_123');
  });
});

