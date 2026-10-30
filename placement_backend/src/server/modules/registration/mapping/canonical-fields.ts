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
  { key: 'studentId', label: 'Student ID', required: true, type: 'string' },
  { key: 'name', label: 'Name', required: true, type: 'string' },
  { key: 'branch', label: 'Branch', required: true, type: 'string' },
  { key: 'batch', label: 'Batch', required: true, type: 'string' },
  { key: 'email', label: 'Email', required: true, type: 'email' },
  { key: 'phone', label: 'Phone', required: true, type: 'string' },
  { key: 'activeBacklogs', label: 'Active Backlogs', required: false, type: 'number' },

  // Semester SGPA & Credits (optional)
  { key: 's1Sgpa', label: 'Semester 1 SGPA', required: false, type: 'number' },
  { key: 's1Credits', label: 'Semester 1 Credits', required: false, type: 'number' },
  { key: 's2Sgpa', label: 'Semester 2 SGPA', required: false, type: 'number' },
  { key: 's2Credits', label: 'Semester 2 Credits', required: false, type: 'number' },
  { key: 's3Sgpa', label: 'Semester 3 SGPA', required: false, type: 'number' },
  { key: 's3Credits', label: 'Semester 3 Credits', required: false, type: 'number' },
  { key: 's4Sgpa', label: 'Semester 4 SGPA', required: false, type: 'number' },
  { key: 's4Credits', label: 'Semester 4 Credits', required: false, type: 'number' },
  { key: 's5Sgpa', label: 'Semester 5 SGPA', required: false, type: 'number' },
  { key: 's5Credits', label: 'Semester 5 Credits', required: false, type: 'number' },
  { key: 's6Sgpa', label: 'Semester 6 SGPA', required: false, type: 'number' },
  { key: 's6Credits', label: 'Semester 6 Credits', required: false, type: 'number' },
] as const;

export type CanonicalFieldKey = (typeof CANONICAL_FIELDS)[number]['key'];

export const CANONICAL_FIELD_KEYS: readonly string[] = CANONICAL_FIELDS.map((f) => f.key);

export const REQUIRED_CANONICAL_KEYS: readonly string[] = CANONICAL_FIELDS
  .filter((f) => f.required)
  .map((f) => f.key);
