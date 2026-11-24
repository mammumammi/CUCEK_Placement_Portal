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
    {
      scenario: 'Placement policy: Student placed in DREAM cannot apply for ANY drive',
      profile: { branch: 'CSE', cgpa: 8.5, activeBacklogs: 0, placementStatus: 'DREAM' },
      drive: { ...baseDrive, packageCategory: 'DREAM' },
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['Students placed in a Dream category offer'],
    },
    {
      scenario: 'Placement policy: Student placed in DREAM cannot apply for GENERAL drive',
      profile: { branch: 'CSE', cgpa: 8.5, activeBacklogs: 0, placementStatus: 'DREAM' },
      drive: { ...baseDrive, packageCategory: 'GENERAL' },
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['Students placed in a Dream category offer'],
    },
    {
      scenario: 'Placement policy: Student placed in GENERAL cannot apply for another GENERAL drive',
      profile: { branch: 'CSE', cgpa: 8.5, activeBacklogs: 0, placementStatus: 'GENERAL' },
      drive: { ...baseDrive, packageCategory: 'GENERAL' },
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['Students placed in a General category offer cannot apply for another General category drive'],
    },
    {
      scenario: 'Placement policy: Student placed in GENERAL CAN apply for a DREAM drive',
      profile: { branch: 'CSE', cgpa: 8.5, activeBacklogs: 0, placementStatus: 'GENERAL' },
      drive: { ...baseDrive, packageCategory: 'DREAM' },
      expectedEligible: true,
      expectedReasonCount: 0,
    },
    {
      scenario: 'Placement policy: Student placed in GENERAL CAN apply for an INTERNSHIP drive',
      profile: { branch: 'CSE', cgpa: 8.5, activeBacklogs: 0, placementStatus: 'GENERAL' },
      drive: { ...baseDrive, packageCategory: 'INTERNSHIP' },
      expectedEligible: true,
      expectedReasonCount: 0,
    },
    {
      scenario: 'Placement policy: Student placed in INTERNSHIP cannot apply for another INTERNSHIP drive',
      profile: { branch: 'CSE', cgpa: 8.5, activeBacklogs: 0, placementStatus: 'INTERNSHIP' },
      drive: { ...baseDrive, packageCategory: 'INTERNSHIP' },
      expectedEligible: false,
      expectedReasonCount: 1,
      expectedReasonSubstrings: ['Students who have secured an Internship offer cannot apply for other Internship drives'],
    },
    {
      scenario: 'Placement policy: Student placed in INTERNSHIP CAN apply for GENERAL or DREAM drive',
      profile: { branch: 'CSE', cgpa: 8.5, activeBacklogs: 0, placementStatus: 'INTERNSHIP' },
      drive: { ...baseDrive, packageCategory: 'GENERAL' },
      expectedEligible: true,
      expectedReasonCount: 0,
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

