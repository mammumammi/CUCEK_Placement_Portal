import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import * as dbSchema from '../src/core/db';

describe('Micro-Prompt 1: Modular D1 Database Schema & Docs', () => {
  it('exports all 5 domain tables from the modular barrel file', () => {
    expect(getTableConfig(dbSchema.users).name).toBe('users');
    expect(getTableConfig(dbSchema.studentProfiles).columns.map(c => c.name)).toEqual(
      expect.arrayContaining(['studentId', 's1Sgpa', 's6Credits', 'calculatedCgpa', 'activeBacklogs'])
    );
    expect(getTableConfig(dbSchema.auditLogs).name).toBe('audit_logs');
    expect(getTableConfig(dbSchema.drives).name).toBe('drives');
    expect(getTableConfig(dbSchema.applications).name).toBe('applications');
  });

  it('includes the database ER documentation file', () => {
    expect(fs.existsSync('docs/modules/01-database-schema.md')).toBe(true);
  });
});