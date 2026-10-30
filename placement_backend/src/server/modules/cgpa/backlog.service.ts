/**
 * @fileoverview Backlog policy rule evaluator for placement eligibility.
 * @module server/modules/cgpa/backlog.service
 */

export interface BacklogRuleResult {
  cgpa: number;
  eligible: boolean;
}

/**
 * Evaluates student eligibility and adjusted CGPA based on active backlogs.
 *
 * TODO: The college's real placement backlog policy rule will be supplied later.
 * Currently serves as a placeholder returning the CGPA unchanged and eligible: true.
 * Do NOT invent penalties until the official university criteria are provided.
 *
 * @param cgpa - The calculated or verified student CGPA.
 * @param activeBacklogs - Count of standing backlogs.
 * @returns Result object with cgpa and eligible flag.
 */
export function applyBacklogRule(
  cgpa: number,
  _activeBacklogs: number = 0
): BacklogRuleResult {
  return {
    cgpa,
    eligible: true,
  };
}

