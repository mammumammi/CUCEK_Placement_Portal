/**
 * @fileoverview Core Role-Based Access Control (RBAC) and Application Lifecycle Types.
 * @module core/types/roles
 */

export type UserRole = 'STUDENT' | 'BRANCH_COORDINATOR' | 'MAIN_COORDINATOR';

export const USER_ROLES: readonly UserRole[] = [
  'STUDENT',
  'BRANCH_COORDINATOR',
  'MAIN_COORDINATOR',
] as const;

export type ApplicationStatus =
  | 'APPLIED'
  | 'ROUND_1'
  | 'ROUND_2'
  | 'ROUND_3'
  | 'PLACED'
  | 'REJECTED';

export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'APPLIED',
  'ROUND_1',
  'ROUND_2',
  'ROUND_3',
  'PLACED',
  'REJECTED',
] as const;

export type RoundResult = 'SHORTLISTED' | 'REJECTED';

export const ROUND_RESULTS: readonly RoundResult[] = [
  'SHORTLISTED',
  'REJECTED',
] as const;

export interface SessionActor {
  readonly userId: string;
  readonly role: UserRole;
  readonly branch: string;
}
