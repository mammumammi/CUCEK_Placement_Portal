/**
 * @fileoverview Canonical field definitions for student bulk registration and Excel mapping.
 * Single source of truth across registration and spreadsheet modules.
 * @module server/modules/registration/mapping/canonical-fields
 */

export interface CanonicalField {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'email';
}

export const CANONICAL_FIELDS: readonly CanonicalField[] = [
  { key: 'studentId', label: 'Student ID / Roll No', required: true, type: 'string' },
  { key: 'registrationNumber', label: 'Registration Number', required: false, type: 'string' },
  { key: 'name', label: 'Name', required: false, type: 'string' },
  { key: 'firstName', label: 'First Name', required: false, type: 'string' },
  { key: 'lastName', label: 'Last Name', required: false, type: 'string' },
  { key: 'dob', label: 'Date of Birth (DOB)', required: false, type: 'string' },
  { key: 'age', label: 'Age', required: false, type: 'number' },
  { key: 'branch', label: 'Branch', required: false, type: 'string' },
  { key: 'batch', label: 'Batch', required: false, type: 'string' },
  { key: 'email', label: 'Email', required: false, type: 'email' },
  { key: 'phone', label: 'Phone', required: false, type: 'string' },
  { key: 'activeBacklogs', label: 'Active Backlogs', required: false, type: 'number' },
  { key: 'totalMarks', label: 'Total Marks', required: false, type: 'number' },
  { key: 'maxMarks', label: 'Max Marks', required: false, type: 'number' },
  { key: 'percentage', label: 'Percentage (%)', required: false, type: 'number' },
  { key: 'marksheetUrl', label: 'Marksheet Drive Link', required: false, type: 'string' },

  // Semester SGPA & Credits (optional)
  { key: 's1Sgpa', label: 'Semester 1 SGPA', required: false, type: 'number' },
  { key: 's1Credits', label: 'Semester 1 Credits', required: false, type: 'number' },
  { key: 's1MarksheetUrl', label: 'Sem 1 Marksheet Link', required: false, type: 'string' },
  { key: 's2Sgpa', label: 'Semester 2 SGPA', required: false, type: 'number' },
  { key: 's2Credits', label: 'Semester 2 Credits', required: false, type: 'number' },
  { key: 's2MarksheetUrl', label: 'Sem 2 Marksheet Link', required: false, type: 'string' },
  { key: 's3Sgpa', label: 'Semester 3 SGPA', required: false, type: 'number' },
  { key: 's3Credits', label: 'Semester 3 Credits', required: false, type: 'number' },
  { key: 's3MarksheetUrl', label: 'Sem 3 Marksheet Link', required: false, type: 'string' },
  { key: 's4Sgpa', label: 'Semester 4 SGPA', required: false, type: 'number' },
  { key: 's4Credits', label: 'Semester 4 Credits', required: false, type: 'number' },
  { key: 's4MarksheetUrl', label: 'Sem 4 Marksheet Link', required: false, type: 'string' },
  { key: 's5Sgpa', label: 'Semester 5 SGPA', required: false, type: 'number' },
  { key: 's5Credits', label: 'Semester 5 Credits', required: false, type: 'number' },
  { key: 's5MarksheetUrl', label: 'Sem 5 Marksheet Link', required: false, type: 'string' },
  { key: 's6Sgpa', label: 'Semester 6 SGPA', required: false, type: 'number' },
  { key: 's6Credits', label: 'Semester 6 Credits', required: false, type: 'number' },
  { key: 's6MarksheetUrl', label: 'Sem 6 Marksheet Link', required: false, type: 'string' },
  { key: 's7Sgpa', label: 'Semester 7 SGPA', required: false, type: 'number' },
  { key: 's7Credits', label: 'Semester 7 Credits', required: false, type: 'number' },
  { key: 's7MarksheetUrl', label: 'Sem 7 Marksheet Link', required: false, type: 'string' },
  { key: 's8Sgpa', label: 'Semester 8 SGPA', required: false, type: 'number' },
  { key: 's8Credits', label: 'Semester 8 Credits', required: false, type: 'number' },
  { key: 's8MarksheetUrl', label: 'Sem 8 Marksheet Link', required: false, type: 'string' },
  { key: 'currentSemester', label: 'Current Semester Reached', required: false, type: 'number' },

  // Candidate Personal & Background Information
  { key: 'fatherName', label: "Father's Name", required: false, type: 'string' },
  { key: 'motherName', label: "Mother's Name", required: false, type: 'string' },
  { key: 'tenthPercentage', label: '10th Percentage / SSC', required: false, type: 'number' },
  { key: 'twelfthPercentage', label: '12th / Diploma Percentage', required: false, type: 'number' },
  { key: 'panNumber', label: 'PAN Card Number', required: false, type: 'string' },
  { key: 'aadhaarNumber', label: 'Aadhaar Number', required: false, type: 'string' },
  { key: 'githubUrl', label: 'GitHub Profile Link', required: false, type: 'string' },
  { key: 'linkedInUrl', label: 'LinkedIn Profile Link', required: false, type: 'string' },
  { key: 'address', label: 'Permanent Address', required: false, type: 'string' },
] as const;

export type CanonicalFieldKey = (typeof CANONICAL_FIELDS)[number]['key'];

export const CANONICAL_FIELD_KEYS: readonly string[] = CANONICAL_FIELDS.map((f) => f.key);

export const REQUIRED_CANONICAL_KEYS: readonly string[] = CANONICAL_FIELDS
  .filter((f) => f.required)
  .map((f) => f.key);

export const RECOMMENDED_PROFILE_KEYS = [
  'name',
  'branch',
  'batch',
  'email',
  'phone',
] as const;


