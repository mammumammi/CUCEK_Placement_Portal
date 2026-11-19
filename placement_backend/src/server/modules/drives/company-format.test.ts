import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  suggestFieldForHeader,
  parseCompanyTemplateBuffer,
  extractCandidateFieldValue,
} from './export.service';
import { summarizeJobDescription } from './jd-summarizer.service';

describe('Company Format & Multi-Document JD Analysis', () => {
  describe('suggestFieldForHeader', () => {
    it('intelligently maps common company header variations to canonical fields', () => {
      expect(suggestFieldForHeader('Candidate Name')).toBe('name');
      expect(suggestFieldForHeader('Full Name')).toBe('name');
      expect(suggestFieldForHeader('College Reg No')).toBe('registrationNumber');
      expect(suggestFieldForHeader('USN / URN')).toBe('registrationNumber');
      expect(suggestFieldForHeader('Student Roll No')).toBe('studentId');
      expect(suggestFieldForHeader('Department / Branch')).toBe('branch');
      expect(suggestFieldForHeader('Discipline')).toBe('branch');
      expect(suggestFieldForHeader('Graduation Batch')).toBe('batch');
      expect(suggestFieldForHeader('Current CGPA / Pointer')).toBe('cgpa');
      expect(suggestFieldForHeader('Active Arrears / Backlogs')).toBe('activeBacklogs');
      expect(suggestFieldForHeader('Email ID')).toBe('email');
      expect(suggestFieldForHeader('Mobile Number')).toBe('phone');
      expect(suggestFieldForHeader('Resume Link')).toBe('resumeUrl');
      expect(suggestFieldForHeader('10th Percentage')).toBe('tenthPercentage');
      expect(suggestFieldForHeader('12th / HSC Marks')).toBe('twelfthPercentage');
    });
  });

  describe('parseCompanyTemplateBuffer', () => {
    it('parses uploaded company Excel template and auto-maps columns', async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Required Format');
      sheet.addRow([
        'Full Name',
        'Registration Number',
        'Department',
        'CGPA',
        'Backlogs Count',
        'Email Address',
        'Phone Number',
      ]);

      const buffer = await workbook.xlsx.writeBuffer();
      const parsed = await parseCompanyTemplateBuffer(Buffer.from(buffer));

      expect(parsed.headers).toEqual([
        'Full Name',
        'Registration Number',
        'Department',
        'CGPA',
        'Backlogs Count',
        'Email Address',
        'Phone Number',
      ]);

      expect(parsed.suggestedColumns).toEqual([
        { companyHeader: 'Full Name', sourceField: 'name' },
        { companyHeader: 'Registration Number', sourceField: 'registrationNumber' },
        { companyHeader: 'Department', sourceField: 'branch' },
        { companyHeader: 'CGPA', sourceField: 'cgpa' },
        { companyHeader: 'Backlogs Count', sourceField: 'activeBacklogs' },
        { companyHeader: 'Email Address', sourceField: 'email' },
        { companyHeader: 'Phone Number', sourceField: 'phone' },
      ]);
    });
  });

  describe('extractCandidateFieldValue', () => {
    const candidate = {
      studentId: 'STU001',
      registrationNumber: 'REG2024001',
      name: 'John Doe',
      branch: 'CSE',
      batch: '2024',
      cgpa: 8.75,
      activeBacklogs: 0,
      email: 'john@college.edu',
      phone: '9876543210',
      resumeUrl: 'https://cdn.example.com/resumes/john.pdf',
      placed: true,
      verified: true,
      extraData: {
        tenthPercentage: 92.5,
        twelfthPercentage: 89.0,
        github: 'https://github.com/johndoe',
      },
    };

    it('extracts direct and normalized candidate fields', () => {
      expect(extractCandidateFieldValue(candidate, 'name')).toBe('John Doe');
      expect(extractCandidateFieldValue(candidate, 'registrationNumber')).toBe('REG2024001');
      expect(extractCandidateFieldValue(candidate, 'studentId')).toBe('STU001');
      expect(extractCandidateFieldValue(candidate, 'cgpa')).toBe(8.75);
      expect(extractCandidateFieldValue(candidate, 'branch')).toBe('CSE');
      expect(extractCandidateFieldValue(candidate, 'placed')).toBe('YES');
      expect(extractCandidateFieldValue(candidate, 'verified')).toBe('YES');
    });

    it('extracts dynamic extraData fields', () => {
      expect(extractCandidateFieldValue(candidate, 'tenthPercentage')).toBe(92.5);
      expect(extractCandidateFieldValue(candidate, 'github')).toBe('https://github.com/johndoe');
    });
  });

  describe('Multi-Document Job Description Summarization', () => {
    it('synthesizes multiple documents into a consolidated recruitment drive summary', async () => {
      const doc1Buffer = Buffer.from(
        'Company: Nexus Cloud Technologies\nRole: Cloud Solutions Architect\nWelcome to Nexus Cloud Careers.'
      );
      const doc2Buffer = Buffer.from(
        'Compensation CTC: 12 LPA (Dream Package).\nMinimum CGPA: 7.5 across CSE, IT, ECE.\nArrears: No active backlogs allowed.'
      );

      const result = await summarizeJobDescription({
        files: [
          {
            buffer: doc1Buffer,
            mimetype: 'application/pdf',
            originalname: 'Nexus_Company_Overview.pdf',
          },
          {
            buffer: doc2Buffer,
            mimetype: 'application/pdf',
            originalname: 'Eligibility_and_Compensation.pdf',
          },
        ],
      });

      expect(result.company).toBe('Nexus Cloud Technologies');
      expect(result.role).toBe('Cloud Solutions Architect');
      expect(result.packageCategory).toBe('DREAM');
      expect(result.ctcLpa).toBe(12);
      expect(result.minCgpa).toBe(7.5);
      expect(result.allowBacklogs).toBe(false);
      expect(result.eligibleBranches).toContain('CSE');
      expect(result.eligibleBranches).toContain('IT');
      expect(result.eligibleBranches).toContain('ECE');
    });
  });
});
