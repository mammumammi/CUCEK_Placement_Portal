/**
 * @fileoverview High-level mapping service orchestrating deterministic and AI-powered header mapping.
 * @module server/modules/registration/mapping/mapping.service
 */

import { suggestMappingDeterministic } from './header-matcher';
import { suggestMappingWithAi, type GenAiClient } from './ai-mapper';
import { REQUIRED_CANONICAL_KEYS } from './canonical-fields';

export interface HeaderMappingResult {
  field: string | null;
  confidence: number;
  source: 'exact' | 'pattern' | 'ai';
}

export interface BuildMappingResult {
  mapping: Record<string, HeaderMappingResult>;
  missingRequired: string[];
}

/**
 * Builds a complete column-to-canonical field mapping:
 * 1. Runs deterministic matcher first (exact synonyms + regex semester patterns).
 * 2. If any headers remain unmatched, sends only those leftover headers to AI.
 * 3. Merges the results.
 * 4. Determines which required canonical fields are still missing.
 *
 * @param headers - All table headers extracted from the uploaded worksheet.
 * @param deps - Optional dependency injection for the AI client.
 * @returns Combined mapping dictionary and list of missing required canonical keys.
 */
export async function buildMapping(
  headers: string[],
  deps?: { client?: GenAiClient }
): Promise<BuildMappingResult> {
  // 1. Run deterministic matcher
  const { mapping: deterministicMapping, unmatched } =
    suggestMappingDeterministic(headers);

  // 2. Identify fields already claimed by deterministic matching
  const alreadyMapped: Record<string, string> = {};
  for (const [header, match] of Object.entries(deterministicMapping)) {
    if (match.field !== null) {
      alreadyMapped[header] = match.field;
    }
  }

  // 3. If all headers matched deterministically, AI is never invoked
  let mergedMapping: Record<string, HeaderMappingResult> = {
    ...deterministicMapping,
  };

  if (unmatched.length > 0) {
    // 4. Send only leftover headers to AI
    const aiMapping = await suggestMappingWithAi(
      unmatched,
      alreadyMapped,
      deps
    );

    mergedMapping = {
      ...deterministicMapping,
      ...aiMapping,
    };
  }

  // 5. Compute missingRequired canonical fields
  const mappedFields = new Set<string>();
  for (const match of Object.values(mergedMapping)) {
    if (match.field !== null) {
      mappedCanonicalFields(match.field, mappedFields);
    }
  }

  const missingRequired = REQUIRED_CANONICAL_KEYS.filter((reqKey) => {
    // If studentId is required, having either studentId or registrationNumber satisfies the requirement
    if (reqKey === 'studentId' && (mappedFields.has('studentId') || mappedFields.has('registrationNumber'))) {
      return false;
    }
    return !mappedFields.has(reqKey);
  });

  return {
    mapping: mergedMapping,
    missingRequired,
  };
}

function mappedCanonicalFields(
  field: string,
  fieldSet: Set<string>
): void {
  fieldSet.add(field);
}

