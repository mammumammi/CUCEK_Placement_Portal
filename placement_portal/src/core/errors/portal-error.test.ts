import { describe, it, expect } from 'vitest';
import { PortalError, isPortalError } from '@/core/errors/portal-error';
import { USER_ROLES, APPLICATION_STATUSES } from '@/core/types/roles';
import type { SessionActor, UserRole, ApplicationStatus } from '@/core/types/roles';

describe('Core RBAC & Types', () => {
  it('should export all valid UserRole values', () => {
    expect(USER_ROLES).toContain('STUDENT');
    expect(USER_ROLES).toContain('BRANCH_COORDINATOR');
    expect(USER_ROLES).toContain('MAIN_COORDINATOR');
    expect(USER_ROLES.length).toBe(3);
  });

  it('should export all valid ApplicationStatus values', () => {
    expect(APPLICATION_STATUSES).toEqual([
      'APPLIED',
      'ROUND_1',
      'ROUND_2',
      'ROUND_3',
      'PLACED',
      'REJECTED',
    ]);
  });

  it('should allow constructing a valid SessionActor', () => {
    const actor: SessionActor = {
      userId: 'usr_123',
      role: 'BRANCH_COORDINATOR' as UserRole,
      branch: 'CSE',
    };
    expect(actor.userId).toBe('usr_123');
    expect(actor.role).toBe('BRANCH_COORDINATOR');
    expect(actor.branch).toBe('CSE');
  });
});

describe('PortalError', () => {
  it('should construct PortalError with default status code', () => {
    const err = new PortalError('FORBIDDEN', 'Access denied');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PortalError);
    expect(err.code).toBe('FORBIDDEN');
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Access denied');
    expect(err.name).toBe('PortalError');
  });

  it('should construct with factory methods and correct status codes', () => {
    const forbidden = PortalError.forbidden();
    expect(forbidden.code).toBe('FORBIDDEN');
    expect(forbidden.statusCode).toBe(403);

    const locked = PortalError.rowLocked('Record locked');
    expect(locked.code).toBe('ROW_LOCKED');
    expect(locked.statusCode).toBe(423);

    const expired = PortalError.deadlineExpired('Cutoff reached');
    expect(expired.code).toBe('DEADLINE_EXPIRED');
    expect(expired.statusCode).toBe(410);

    const ineligible = PortalError.ineligible('Low CGPA');
    expect(ineligible.code).toBe('INELIGIBLE');
    expect(ineligible.statusCode).toBe(422);

    const validation = PortalError.validationError('Invalid field');
    expect(validation.code).toBe('VALIDATION_ERROR');
    expect(validation.statusCode).toBe(400);

    const rateLimited = PortalError.rateLimited();
    expect(rateLimited.code).toBe('RATE_LIMITED');
    expect(rateLimited.statusCode).toBe(429);
  });

  it('should serialize correctly to JSON payload', () => {
    const err = PortalError.ineligible('CGPA must be >= 7.5', { currentCgpa: 6.8 });
    const json = err.toJSON();

    expect(json).toEqual({
      success: false,
      error: {
        code: 'INELIGIBLE',
        message: 'CGPA must be >= 7.5',
        statusCode: 422,
        details: { currentCgpa: 6.8 },
      },
    });
  });

  it('should identify PortalError using isPortalError type guard', () => {
    const portalErr = PortalError.forbidden();
    const standardErr = new Error('Generic error');
    const customObj = { name: 'PortalError', code: 'FORBIDDEN', statusCode: 403 };

    expect(isPortalError(portalErr)).toBe(true);
    expect(isPortalError(standardErr)).toBe(false);
    expect(isPortalError(customObj)).toBe(true);
    expect(isPortalError(null)).toBe(false);
    expect(isPortalError('string error')).toBe(false);
  });
});

