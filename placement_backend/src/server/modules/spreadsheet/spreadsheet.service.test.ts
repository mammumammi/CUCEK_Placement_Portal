/**
 * @fileoverview Unit and matrix tests for spreadsheet row permissions and validation.
 * @module server/modules/spreadsheet/spreadsheet.service.test
 */

import { describe, it, expect } from 'vitest';
import {
  getRowPermissions,
  validateExtraData,
  type SpreadsheetActor,
  type DriveDeadlineTarget,
  type DriveRowTarget,
} from './spreadsheet.service';
import type { DriveExtraField } from '@/core/db/schema/drives.schema';

describe('Spreadsheet Service Unit Tests', () => {
  describe('getRowPermissions (Permissions Matrix)', () => {
    const fixedNow = new Date('2026-10-30T12:00:00.000Z');
    const futureDrive: DriveDeadlineTarget = { deadline: '2026-11-15T23:59:59.000Z' };
    const pastDrive: DriveDeadlineTarget = { deadline: '2026-10-01T00:00:00.000Z' };

    const studentAlice: SpreadsheetActor = {
      id: 'usr_student_alice',
      role: 'STUDENT',
      branch: 'CSE',
    };

    const cseCoord: SpreadsheetActor = {
      id: 'usr_coord_cse',
      role: 'BRANCH_COORDINATOR',
      branch: 'CSE',
    };

    const mainCoord: SpreadsheetActor = {
      id: 'usr_coord_main',
      role: 'MAIN_COORDINATOR',
      branch: null,
    };

    const aliceRowUnverified: DriveRowTarget = {
      studentUserId: 'usr_student_alice',
      branch: 'CSE',
      verified: false,
    };

    const aliceRowVerified: DriveRowTarget = {
      studentUserId: 'usr_student_alice',
      branch: 'CSE',
      verified: true,
    };

    const bobRowUnverified: DriveRowTarget = {
      studentUserId: 'usr_student_bob',
      branch: 'ECE',
      verified: false,
    };

    it('1. Student accessing own row before deadline, unverified -> canEditExtraData: true, canVerify: false, locked: false', () => {
      const perms = getRowPermissions(studentAlice, futureDrive, aliceRowUnverified, fixedNow);
      expect(perms).toEqual({
        canEditExtraData: true,
        canVerify: false,
        locked: false,
        reason: null,
      });
    });

    it('2. Student accessing own row after deadline, unverified -> locked: true with deadline reason', () => {
      const perms = getRowPermissions(studentAlice, pastDrive, aliceRowUnverified, fixedNow);
      expect(perms).toEqual({
        canEditExtraData: false,
        canVerify: false,
        locked: true,
        reason: 'Application deadline has passed',
      });
    });

    it('3. Student accessing own row before deadline, verified -> locked: true with verified reason', () => {
      const perms = getRowPermissions(studentAlice, futureDrive, aliceRowVerified, fixedNow);
      expect(perms).toEqual({
        canEditExtraData: false,
        canVerify: false,
        locked: true,
        reason: 'Row is verified and locked against student modifications',
      });
    });

    it("4. Student accessing another student's row before deadline -> locked: true with access reason", () => {
      const perms = getRowPermissions(studentAlice, futureDrive, bobRowUnverified, fixedNow);
      expect(perms).toEqual({
        canEditExtraData: false,
        canVerify: false,
        locked: true,
        reason: 'Students can only access their own row',
      });
    });

    it('5. Branch coordinator accessing student in own branch before deadline -> canEditExtraData: true, canVerify: true, locked: false', () => {
      const perms = getRowPermissions(cseCoord, futureDrive, aliceRowUnverified, fixedNow);
      expect(perms).toEqual({
        canEditExtraData: true,
        canVerify: true,
        locked: false,
        reason: null,
      });
    });

    it('6. Branch coordinator accessing student in own branch after deadline -> canEditExtraData: true, canVerify: true, locked: false (deadline does not block coordinators)', () => {
      const perms = getRowPermissions(cseCoord, pastDrive, aliceRowUnverified, fixedNow);
      expect(perms).toEqual({
        canEditExtraData: true,
        canVerify: true,
        locked: false,
        reason: null,
      });
    });

    it('7. Branch coordinator accessing student in another branch -> locked: true with branch restriction reason', () => {
      const perms = getRowPermissions(cseCoord, futureDrive, bobRowUnverified, fixedNow);
      expect(perms).toEqual({
        canEditExtraData: false,
        canVerify: false,
        locked: true,
        reason: 'Branch coordinator can only manage rows in their own branch',
      });
    });

    it('8. Main coordinator accessing any row before deadline -> canEditExtraData: true, canVerify: true, locked: false', () => {
      const perms = getRowPermissions(mainCoord, futureDrive, bobRowUnverified, fixedNow);
      expect(perms).toEqual({
        canEditExtraData: true,
        canVerify: true,
        locked: false,
        reason: null,
      });
    });

    it('9. Main coordinator accessing any row after deadline, verified or unverified -> canEditExtraData: true, canVerify: true, locked: false', () => {
      const perms = getRowPermissions(mainCoord, pastDrive, aliceRowVerified, fixedNow);
      expect(perms).toEqual({
        canEditExtraData: true,
        canVerify: true,
        locked: false,
        reason: null,
      });
    });
  });

  describe('validateExtraData', () => {
    const extraFields: DriveExtraField[] = [
      { key: 'github', label: 'GitHub Profile', type: 'text', required: true },
      { key: 'experience', label: 'Experience (Years)', type: 'number', required: false },
      { key: 'preferredLocation', label: 'Preferred Location', type: 'dropdown', options: ['Bangalore', 'Hyderabad', 'Remote'], required: true },
    ];

    it('validates and accepts valid extraData payload', () => {
      const input = {
        github: 'https://github.com/alice',
        experience: '2',
        preferredLocation: 'Bangalore',
      };
      const validated = validateExtraData(input, extraFields);
      expect(validated).toEqual({
        github: 'https://github.com/alice',
        experience: 2,
        preferredLocation: 'Bangalore',
      });
    });

    it('rejects unknown fields not configured on the drive with 400', () => {
      const input = {
        github: 'https://github.com/alice',
        preferredLocation: 'Bangalore',
        hackedField: 'malicious',
      };
      expect(() => validateExtraData(input, extraFields)).toThrowError(/Unknown extra field "hackedField"/);
    });

    it('rejects missing required fields with 400', () => {
      const input = {
        experience: 1,
        preferredLocation: 'Bangalore',
      };
      expect(() => validateExtraData(input, extraFields)).toThrowError(/Field "GitHub Profile" \(github\) is required/);
    });

    it('rejects non-numeric values for number fields with 400', () => {
      const input = {
        github: 'https://github.com/alice',
        experience: 'not-a-number',
        preferredLocation: 'Bangalore',
      };
      expect(() => validateExtraData(input, extraFields)).toThrowError(/Field "Experience \(Years\)" \(experience\) must be a valid number/);
    });

    it('rejects invalid dropdown choices with 400', () => {
      const input = {
        github: 'https://github.com/alice',
        preferredLocation: 'London', // Not in Bangalore, Hyderabad, Remote
      };
      expect(() => validateExtraData(input, extraFields)).toThrowError(/Invalid option "London" for dropdown "Preferred Location"/);
    });
  });
});

