/**
 * @fileoverview Header normalization, synonyms map, pattern matcher, and deterministic mapping suggestion.
 * @module server/modules/registration/mapping/header-matcher
 */

import { CANONICAL_FIELDS } from './canonical-fields';

/**
 * Normalizes an arbitrary header string:
 * - lowercase
 * - trim
 * - collapse multiple spaces
 * - strip punctuation characters (e.g., '.', '-', '_', ',', ':', ';', '(', ')')
 *
 * Example: "  Student  ID. " -> "student id"
 * Example: "E-Mail" -> "e mail"
 */
export function normalizeHeader(header: string): string {
  if (!header) return '';
  return header
    .toLowerCase()
    // Replace punctuation with spaces
    .replace(/[.\-_,:;()[\]{}\\/]/g, ' ')
    // Collapse any whitespace sequence into a single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Record of canonical key -> list of normalized header synonyms.
 */
export const SYNONYMS: Record<string, string[]> = {
  studentId: [
    'student id',
    'studentid',
    'reg no',
    'regno',
    'register number',
    'registration number',
    'roll no',
    'rollno',
    'roll number',
    'admission no',
    'admission number',
    'enrollment no',
    'enrollment number',
    'id',
  ],
  name: [
    'name',
    'student name',
    'full name',
    'name of student',
    'candidate name',
  ],
  branch: [
    'branch',
    'department',
    'dept',
    'stream',
    'course',
    'program',
    'programme',
    'discipline',
  ],
  batch: [
    'batch',
    'year of admission',
    'admission year',
    'passout year',
    'passing year',
    'graduation year',
    'year',
  ],
  email: [
    'email',
    'email id',
    'mail id',
    'mail',
    'e mail',
    'official email',
    'student email',
    'email address',
  ],
  phone: [
    'phone',
    'mobile',
    'mobile no',
    'mobile number',
    'contact',
    'contact no',
    'contact number',
    'phone number',
    'phone no',
  ],
  activeBacklogs: [
    'active backlogs',
    'activebacklogs',
    'backlogs',
    'arrears',
    'no of backlogs',
    'number of backlogs',
    'current backlogs',
    'standing arrears',
  ],
};

/**
 * Helper to match semester SGPA and Credits columns using regex patterns.
 * Supports patterns like:
 * - "sem 1 sgpa", "s1 sgpa", "sgpa s1", "semester 1 gpa", "gpa sem1", "s1"
 * - "sem 1 credits", "s1 credits", "credits sem 1", "credit s1", "s1 cr"
 */
export function matchSemesterHeader(normalized: string): string | null {
  // Try SGPA / GPA
  // Matches "sem 1 sgpa", "s1 sgpa", "semester 1 sgpa", "sgpa sem 1", "sgpa s1", "gpa sem1", "sem 1 gpa", "s1"
  // Note: if it's "s1" alone without credits, standard convention is SGPA
  
  // Credits check first if explicit credits keyword present
  const creditMatch =
    normalized.match(/^(?:sem(?:ester)?\s*([1-6])\s*credits?|credits?\s*(?:sem(?:ester)?\s*)?([1-6])|s([1-6])\s*credits?|credits?\s*s([1-6]))$/i);
  if (creditMatch) {
    const sem = creditMatch[1] || creditMatch[2] || creditMatch[3] || creditMatch[4];
    return `s${sem}Credits`;
  }

  // SGPA check
  const sgpaMatch =
    normalized.match(/^(?:sem(?:ester)?\s*([1-6])\s*(?:sgpa|gpa)|(?:sgpa|gpa)\s*(?:sem(?:ester)?\s*)?([1-6])|s([1-6])\s*(?:sgpa|gpa)|(?:sgpa|gpa)\s*s([1-6]))$/i);
  if (sgpaMatch) {
    const sem = sgpaMatch[1] || sgpaMatch[2] || sgpaMatch[3] || sgpaMatch[4];
    return `s${sem}Sgpa`;
  }

  // Exact short forms: s1..s6 (e.g., 's1', 's2', 'sem1') default to SGPA per test suite
  const shortSemMatch = normalized.match(/^(?:s|sem(?:ester)?\s*)([1-6])$/i);
  if (shortSemMatch) {
    const sem = shortSemMatch[1];
    return `s${sem}Sgpa`;
  }

  return null;
}

export interface HeaderMatchResult {
  field: string | null;
  confidence: number;
  source: 'exact' | 'pattern';
}

export interface SuggestionResult {
  mapping: Record<string, HeaderMatchResult>;
  unmatched: string[];
}

/**
 * Suggests canonical field mappings deterministically for a list of table headers.
 * Ensures:
 * - Each canonical field is assigned to at most ONE header.
 * - On conflict (multiple headers matching the same canonical field), the exact / highest confidence match wins.
 * - Unrecognized headers are listed in `unmatched`.
 */
export function suggestMappingDeterministic(headers: string[]): SuggestionResult {
  const mapping: Record<string, HeaderMatchResult> = {};
  const unmatched: string[] = [];

  interface Candidate {
    header: string;
    field: string;
    confidence: number;
    source: 'exact' | 'pattern';
  }

  const candidates: Candidate[] = [];

  for (const rawHeader of headers) {
    const normalized = normalizeHeader(rawHeader);
    let matchedField: string | null = null;
    let confidence = 0;
    let source: 'exact' | 'pattern' = 'exact';

    // 1. Direct match with canonical key or canonical label
    const canonicalDirect = CANONICAL_FIELDS.find(
      (f) =>
        normalizeHeader(f.key) === normalized ||
        normalizeHeader(f.label) === normalized
    );
    if (canonicalDirect) {
      matchedField = canonicalDirect.key;
      confidence = 1.0;
      source = 'exact';
    }

    // 2. Exact match against synonyms
    if (!matchedField) {
      for (const [key, variants] of Object.entries(SYNONYMS)) {
        if (variants.includes(normalized)) {
          matchedField = key;
          // If normalized exactly equals key (like "email" or "name"), 1.0; else 0.95
          confidence = normalized === key.toLowerCase() ? 1.0 : 0.95;
          source = 'exact';
          break;
        }
      }
    }

    // 3. Pattern match for semester columns
    if (!matchedField) {
      const semField = matchSemesterHeader(normalized);
      if (semField) {
        matchedField = semField;
        confidence = 0.9;
        source = 'pattern';
      }
    }

    if (matchedField) {
      candidates.push({
        header: rawHeader,
        field: matchedField,
        confidence,
        source,
      });
    } else {
      mapping[rawHeader] = {
        field: null,
        confidence: 0,
        source: 'pattern',
      };
      unmatched.push(rawHeader);
    }
  }

  // Conflict resolution: Each canonical field is assigned to at most ONE header.
  // Group by field and select the highest confidence / exact match.
  const byField = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const list = byField.get(c.field) || [];
    list.push(c);
    byField.set(c.field, list);
  }

  for (const [field, fieldCandidates] of byField.entries()) {
    // Sort descending by confidence, prefer 'exact' over 'pattern'
    fieldCandidates.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      if (a.source === 'exact' && b.source !== 'exact') return -1;
      if (b.source === 'exact' && a.source !== 'exact') return 1;
      return 0;
    });

    const winner = fieldCandidates[0];
    mapping[winner.header] = {
      field: winner.field,
      confidence: winner.confidence,
      source: winner.source,
    };

    // Any loser candidates for this field become unmatched
    for (let i = 1; i < fieldCandidates.length; i++) {
      const loser = fieldCandidates[i];
      mapping[loser.header] = {
        field: null,
        confidence: 0,
        source: loser.source,
      };
      unmatched.push(loser.header);
    }
  }

  return { mapping, unmatched };
}

