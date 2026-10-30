import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PortalError } from '../src/core/errors/portal-error';

describe('Micro-Prompt 0: Project Structure & Documentation Foundation', () => {
  it('verifies docs/ARCHITECTURE.md exists and documents all core modules', () => {
    const docPath = path.resolve(process.cwd(), 'docs/ARCHITECTURE.md');
    expect(fs.existsSync(docPath)).toBe(true);
    const content = fs.readFileSync(docPath, 'utf-8');
    expect(content).toContain('src/core/db');
    expect(content).toContain('src/modules/spreadsheet');
    expect(content).toContain('BRANCH_COORDINATOR');
  });

  it('constructs standardized PortalError instances with typed error codes', () => {
    const err = new PortalError('ROW_LOCKED', 'Students can only edit their own row', 403);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('ROW_LOCKED');
    expect(err.statusCode).toBe(403);
  });
});