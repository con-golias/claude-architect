/**
 * Calculates compliance score (0-100) from violations.
 * Weighted by category: architecture 30%, security 25%, quality 20%, testing 15%, docs 10%.
 *
 * @module ComplianceScorer
 */

import type { Violation } from "../../types/validation";

/** Category weights for compliance scoring (sum = 1.0) */
const CATEGORY_WEIGHTS: Record<string, number> = {
  dependency: 0.25,
  structure: 0.20,
  security: 0.25,
  quality: 0.20,
  docs: 0.10,
};

/** Penalty points per severity level */
const SEVERITY_PENALTY: Record<string, number> = {
  critical: 10,
  warning: 3,
  info: 1,
};

/**
 * Calculate overall compliance score as weighted average of category scores.
 * This ensures the overall score is always consistent with the category breakdown.
 *
 * @param violations - Array of detected violations
 * @returns Overall compliance score (0-100)
 */
export function calculateOverallScore(
  violations: Violation[],
  totalFilesScanned?: number
): number {
  // Low-confidence: if nothing was scanned and no violations, cap at 50
  if (totalFilesScanned !== undefined && totalFilesScanned === 0 && violations.length === 0) {
    return 50;
  }
  if (violations.length === 0) return 100;

  const categoryScores = calculateCategoryScores(violations);
  let weighted = 0;
  for (const [category, weight] of Object.entries(CATEGORY_WEIGHTS)) {
    weighted += (categoryScores[category] ?? 100) * weight;
  }

  return Math.round(weighted);
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
