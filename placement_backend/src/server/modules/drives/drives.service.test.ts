/**
 * @fileoverview Unit tests for the pure function evaluateEligibility.
 * @module server/modules/drives/drives.service.test
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateEligibility,
  type ProfileEligibilityInput,
  type DriveEligibilityCriteria,
} from './drives.service';

describe('evaluateEligibility (Pure Function)', () => {
  const baseDrive: DriveEligibilityCriteria = {
    eligibleBranches: ['CSE', 'ECE'],
    minCgpa: 7.5,
    maxActiveBacklogs: 1,
  };

  interface TestCase {
    scenario: string;
    profile: ProfileEligibilityInput | null | undefined;
    drive?: DriveEligibilityCriteria;
    expectedEligible: boolean;
    expectedReasonCount: number;
    expectedReasonSubstrings?: string[];
  }

  const testCases: TestCase[] = [
    {
      scenario: 'All passing: student satisfies branch, CGPA, and backlog thresholds',
      profile: { branch: 'CSE', cgpa: 8.5, activeBacklogs: 0 },
      expectedEligible: true,
      expectedReasonCount: 0,
    },
    {
      scenario: 'Rule 1 failing alone: branch is not in eligibleBranches',
      profile: { branch: 'MECH', cgpa: 8.5, activeBacklogs: 0 },
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['Branch "MECH" is not eligible', 'Eligible branches: CSE, ECE'],
    },
    {
      scenario: 'Rule 2 failing alone: CGPA is below minCgpa',
      profile: { branch: 'CSE', cgpa: 7.4, activeBacklogs: 0 },
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['CGPA (7.4) is below minimum requirement (7.5)'],
    },
    {
      scenario: 'Rule 3 failing alone: activeBacklogs exceed maxActiveBacklogs',
      profile: { branch: 'CSE', cgpa: 8.5, activeBacklogs: 2 },
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['Active backlogs (2) exceed maximum allowed (1)'],
    },
    {
      scenario: 'Boundary condition 1: CGPA exactly equals minCgpa (passes)',
      profile: { branch: 'CSE', cgpa: 7.5, activeBacklogs: 1 },
      expectedEligible: true,
      expectedReasonCount: 0,
    },
    {
      scenario: 'Boundary condition 2: activeBacklogs exactly equals maxActiveBacklogs (passes)',
      profile: { branch: 'ECE', cgpa: 7.5, activeBacklogs: 1 },
      expectedEligible: true,
      expectedReasonCount: 0,
    },
    {
      scenario: 'Boundary condition 3: CGPA just below minCgpa by 0.01 (fails)',
      profile: { branch: 'CSE', cgpa: 7.49, activeBacklogs: 0 },
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['CGPA (7.49) is below minimum requirement (7.5)'],
    },
    {
      scenario: 'Boundary condition 4: activeBacklogs exceeds maxActiveBacklogs by 1 (fails)',
      profile: { branch: 'CSE', cgpa: 8.0, activeBacklogs: 2 },
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['Active backlogs (2) exceed maximum allowed (1)'],
    },
    {
      scenario: 'All rules failing simultaneously: wrong branch, low CGPA, and excessive backlogs',
      profile: { branch: 'CIVIL', cgpa: 6.0, activeBacklogs: 4 },
      expectedEligible: false,
      expectedReasonCount: 3,
      expectedReasonSubstrings: [
        'Branch "CIVIL" is not eligible',
        'CGPA (6) is below minimum requirement (7.5)',
        'Active backlogs (4) exceed maximum allowed (1)',
      ],
    },
    {
      scenario: 'Edge case: null student profile',
      profile: null,
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['Student profile not registered or found'],
    },
    {
      scenario: 'Edge case: student with null branch',
      profile: { branch: null, cgpa: 8.0, activeBacklogs: 0 },
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['Branch "Unknown" is not eligible'],
    },
  ];

  it.each(testCases)('$scenario', ({ profile, drive, expectedEligible, expectedReasonCount, expectedReasonSubstrings }) => {
    const result = evaluateEligibility(profile, drive ?? baseDrive);

    expect(result.eligible).toBe(expectedEligible);
    expect(result.reasons).toHaveLength(expectedReasonCount);

    if (expectedReasonSubstrings) {
      for (const substring of expectedReasonSubstrings) {
        expect(result.reasons.some((r) => r.includes(substring))).toBe(true);
      }
    }
  });
});

