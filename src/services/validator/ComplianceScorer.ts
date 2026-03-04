/**
 * Calculates compliance score (0-100) from violations.
 * Weighted by category: architecture 30%, security 25%, quality 20%, testing 15%, docs 10%.
 *
 * @module ComplianceScorer
 */

import type { Violation } from "../../types/validation";

/** Category weights for compliance scoring */
const CATEGORY_WEIGHTS: Record<string, number> = {
  dependency: 0.3,
  structure: 0.3,
  security: 0.25,
  quality: 0.2,
  docs: 0.1,
};

/** Penalty points per severity level */
const SEVERITY_PENALTY: Record<string, number> = {
  critical: 10,
  warning: 3,
  info: 1,
};

/**
 * Calculate overall compliance score from a list of violations.
 * Score starts at 100 and is reduced by weighted violation penalties.
 * Minimum score is 0.
 *
 * @param violations - Array of detected violations
 * @returns Overall compliance score (0-100)
 */
export function calculateOverallScore(violations: Violation[]): number {
  if (violations.length === 0) return 100;

  let totalPenalty = 0;

  for (const v of violations) {
    const weight = CATEGORY_WEIGHTS[v.category] ?? 0.15;
    const penalty = SEVERITY_PENALTY[v.severity] ?? 1;
    totalPenalty += penalty * weight;
  }

  return Math.max(0, Math.round(100 - totalPenalty));
}

/**
 * Calculate compliance scores broken down by category.
 *
 * @param violations - Array of detected violations
 * @returns Score per category (0-100)
 */
export function calculateCategoryScores(
  violations: Violation[]
): Record<string, number> {
  const categories = [
    "dependency",
    "structure",
    "security",
    "quality",
    "docs",
  ];
  const scores: Record<string, number> = {};

  for (const category of categories) {
    const categoryViolations = violations.filter(
      (v) => v.category === category
    );
    let penalty = 0;

    for (const v of categoryViolations) {
      penalty += SEVERITY_PENALTY[v.severity] ?? 1;
    }

    scores[category] = Math.max(0, Math.round(100 - penalty));
  }

  return scores;
}

/**
 * Count violations grouped by severity level.
 *
 * @param violations - Array of detected violations
 * @returns Counts per severity
 */
export function countBySeverity(
  violations: Violation[]
): Record<string, number> {
  const counts: Record<string, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  };

  for (const v of violations) {
    counts[v.severity] = (counts[v.severity] ?? 0) + 1;
  }

  return counts;
}

/**
 * Count violations grouped by rule ID.
 *
 * @param violations - Array of detected violations
 * @returns Counts per rule
 */
export function countByRule(
  violations: Violation[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const v of violations) {
    counts[v.ruleId] = (counts[v.ruleId] ?? 0) + 1;
  }

  return counts;
}
