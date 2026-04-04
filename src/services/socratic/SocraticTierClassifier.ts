/**
 * Classifies actions into Tier 1 (trivial), 2 (standard), or 3 (significant).
 * Determines whether Socratic analysis is bypassed, light, or full.
 *
 * @module SocraticTierClassifier
 */

import { Tier } from "./SocraticTypes";
import type { ActionType } from "./SocraticTypes";

/* ── Classification patterns ─────────────────────────────── */

const TRIVIAL_PATTERNS: RegExp[] = [
  /\b(typo|rename|format(ting)?|indent(ation)?|whitespace|spacing)\b/i,
  /\bfix\s+(typo|spelling|casing|naming)\b/i,
  /\b(lint|prettier|eslint)\s*(fix|clean)/i,
];

const TRIVIAL_ACTION_TYPES: Set<string> = new Set([
  // No explicit trivial action_types in the spec — trivial is pattern-based
]);

const SIGNIFICANT_ACTION_TYPES: Set<string> = new Set([
  "architecture_change",
  "major_refactor",
  "security_sensitive",
  "database_change",
]);

const SIGNIFICANT_KEYWORDS: RegExp[] = [
  /\b(refactor|rewrite|restructur|redesign|overhaul)\b/i,
  /\b(migrat|authentication|authorization|auth)\b/i,
  /\b(security|encrypt|secret|credential|token)\b/i,
  /\b(payment|billing|checkout|subscription|PCI|Stripe|PayPal)\b/i,
  /\bnew\s+(system|service|module|engine|layer|architecture)\b/i,
  /\b(breaking\s+change|api\s+change|schema\s+change)\b/i,
];

const BYPASS_PATTERNS: RegExp[] = [
  /\b(just\s+do\s+it|skip\s+reasoning|no[\s-]socratic)\b/i,
  /--no-socratic\b/,
  /--skip-reasoning\b/,
];

/* ── Public API ──────────────────────────────────────────── */

/**
 * Classify an action into a Socratic tier.
 * NOTE: TRIVIAL tier is disabled during testing phase — minimum is STANDARD (7 questions).
 *
 * @param actionDescription - What the action does
 * @param actionType - Enum value from ACTION_TYPES
 * @param affectedScope - Files/modules affected
 * @returns The appropriate analysis tier (STANDARD or SIGNIFICANT — never TRIVIAL)
 */
export function classifyTier(
  actionDescription: string,
  actionType: string,
  affectedScope: string,
): Tier {
  // Tier 3: significant action types
  if (SIGNIFICANT_ACTION_TYPES.has(actionType)) {
    return Tier.SIGNIFICANT;
  }

  // Tier 3: significant keywords in description
  if (SIGNIFICANT_KEYWORDS.some((p) => p.test(actionDescription))) {
    return Tier.SIGNIFICANT;
  }

  // Tier 3: multi-file scope (3+ comma-separated items or mentions "all"/"entire")
  const scopeItems = affectedScope.split(/[,;]/).filter((s) => s.trim());
  if (scopeItems.length >= 3 || /\b(all|entire|whole)\b/i.test(affectedScope)) {
    return Tier.SIGNIFICANT;
  }

  // ALWAYS at least STANDARD (7 questions) — no trivial bypass during testing
  return Tier.STANDARD;
}

/**
 * Check if the user explicitly requested bypass.
 * NOTE: Bypass is DISABLED during testing phase — always returns false.
 *
 * @param userPrompt - The user's original prompt text
 * @returns false (bypass disabled for testing)
 */
export function isBypassRequested(_userPrompt: string): boolean {
  // Disabled during testing phase — Socratic protocol is ALWAYS required
  return false;
}
