/**
 * Deterministic atomicity classifier for recursion control.
 * Rules-based, not judgment-based — no LLM interpretation needed.
 *
 * @module SocraticAtomicity
 */

import { Atomicity } from "./SocraticTypes";

/* ── Detection patterns ──────────────────────────────────── */

/** File path patterns (Unix + Windows) */
const PATH_PATTERN = /^(\.{0,2}\/|[A-Z]:\\|src\/|lib\/|test\/|node_modules\/)[\w./-]+$/;

/** Spec/standard references */
const SPEC_PATTERN = /\b(RFC\s*\d+|WCAG|ISO\s*\d+|OWASP|ECMA-?\d+|IEEE|W3C|POSIX)\b/i;

/** Version numbers */
const VERSION_PATTERN = /^\d+\.\d+(\.\d+)?$/;

/** Boolean-like responses */
const BOOLEAN_PATTERN = /^(true|false|yes|no|ναι|όχι)$/i;

/** Command output markers */
const COMMAND_OUTPUT_PATTERNS = [
  /^[$>]\s/,                    // $ grep ... or > find ...
  /^(grep|find|cat|ls)\s+/i,   // starts with command name
  /grep output:/i,
  /file content:/i,
  /command result:/i,
];

/** Multi-concept indicators */
const MULTI_CONCEPT_PATTERNS = [
  /,\s*\w/,                    // comma followed by word
  /(?:^|\s)και(?:\s|$)/i,       // Greek "and" (no \b for non-ASCII)
  /\band\b/i,                  // English "and"
  /\bor\b/i,                   // English "or"
  /(?:^|\s)ή(?:\s|$)/,          // Greek "or" (no \b for non-ASCII)
  /\n\s*[-*•]\s/,              // bullet list
];

/* ── Public API ──────────────────────────────────────────── */

/**
 * Classify an answer's atomicity using deterministic rules.
 *
 * TERMINAL: answer is verifiable command output (stop recursion)
 * ATOMIC: single concept — file path, number, boolean, spec ref, or <5 words
 * NON_ATOMIC: multiple concepts — contains comma, "and", list, or >1 concept
 *
 * @param answer - The answer text to classify
 * @returns Atomicity classification
 */
export function classifyAtomicity(answer: string): Atomicity {
  const trimmed = answer.trim();
  if (!trimmed) return Atomicity.ATOMIC;

  // TERMINAL: command output
  if (COMMAND_OUTPUT_PATTERNS.some((p) => p.test(trimmed))) {
    return Atomicity.TERMINAL;
  }

  // ATOMIC: file path
  if (PATH_PATTERN.test(trimmed)) {
    return Atomicity.ATOMIC;
  }

  // ATOMIC: number or version
  if (/^\d+$/.test(trimmed) || VERSION_PATTERN.test(trimmed)) {
    return Atomicity.ATOMIC;
  }

  // ATOMIC: boolean
  if (BOOLEAN_PATTERN.test(trimmed)) {
    return Atomicity.ATOMIC;
  }

  // ATOMIC: spec reference
  if (SPEC_PATTERN.test(trimmed) && wordCount(trimmed) <= 8) {
    return Atomicity.ATOMIC;
  }

  // NON_ATOMIC: multi-concept indicators
  if (MULTI_CONCEPT_PATTERNS.some((p) => p.test(trimmed))) {
    return Atomicity.NON_ATOMIC;
  }

  // ATOMIC: short single concept (<5 words)
  if (wordCount(trimmed) < 5) {
    return Atomicity.ATOMIC;
  }

  // Default: NON_ATOMIC (err on the side of deeper analysis)
  return Atomicity.NON_ATOMIC;
}

/* ── Helpers ─────────────────────────────────────────────── */

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
