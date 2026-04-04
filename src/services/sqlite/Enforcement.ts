/**
 * Session enforcement state — tracks KB gaps and web search compliance.
 * Used by PreToolUse hook to block Write/Edit when mandatory web search is missing.
 *
 * @module Enforcement
 */

import type { Database } from "bun:sqlite";

interface EnforcementRow {
  session_id: string;
  kb_gaps_detected: number;
  gap_concepts: string;
  web_search_count: number;
  scaffold_features: string;
  created_at: number;
}

/** Record that KB gaps were detected for this session. */
export function recordKbGaps(db: Database, sessionId: string, concepts: string[]): void {
  const existing = getState(db, sessionId);
  if (existing) {
    db.query(
      `UPDATE session_enforcement SET kb_gaps_detected = 1, gap_concepts = ? WHERE session_id = ?`,
    ).run(JSON.stringify(concepts), sessionId);
  } else {
    db.query(
      `INSERT INTO session_enforcement (session_id, kb_gaps_detected, gap_concepts, web_search_count, scaffold_features, created_at)
       VALUES (?, 1, ?, 0, '[]', ?)`,
    ).run(sessionId, JSON.stringify(concepts), Date.now());
  }
}

/** Increment web search counter for this session. */
export function recordWebSearch(db: Database, sessionId: string): void {
  const existing = getState(db, sessionId);
  if (existing) {
    db.query(
      `UPDATE session_enforcement SET web_search_count = web_search_count + 1 WHERE session_id = ?`,
    ).run(sessionId);
  } else {
    db.query(
      `INSERT INTO session_enforcement (session_id, kb_gaps_detected, gap_concepts, web_search_count, scaffold_features, created_at)
       VALUES (?, 0, '[]', 1, '[]', ?)`,
    ).run(sessionId, Date.now());
  }
}

/** Record that a feature was scaffolded (for structure enforcement). */
export function recordScaffold(db: Database, sessionId: string, featureName: string): void {
  const existing = getState(db, sessionId);
  const features: string[] = existing ? JSON.parse(existing.scaffold_features || "[]") : [];
  if (!features.includes(featureName)) features.push(featureName);

  if (existing) {
    db.query(
      `UPDATE session_enforcement SET scaffold_features = ? WHERE session_id = ?`,
    ).run(JSON.stringify(features), sessionId);
  } else {
    db.query(
      `INSERT INTO session_enforcement (session_id, kb_gaps_detected, gap_concepts, web_search_count, scaffold_features, created_at)
       VALUES (?, 0, '[]', 0, ?, ?)`,
    ).run(sessionId, JSON.stringify(features), Date.now());
  }
}

/** Get the enforcement state for a session. */
export function getState(db: Database, sessionId: string): EnforcementRow | null {
  return db
    .query<EnforcementRow, [string]>(
      `SELECT * FROM session_enforcement WHERE session_id = ?`,
    )
    .get(sessionId);
}

/** Check if web search is required but not yet performed. */
export function isWebSearchRequired(db: Database, sessionId: string): { required: boolean; concepts: string[] } {
  const state = getState(db, sessionId);
  if (!state || !state.kb_gaps_detected) return { required: false, concepts: [] };
  if (state.web_search_count > 0) return { required: false, concepts: [] };
  return { required: true, concepts: JSON.parse(state.gap_concepts || "[]") };
}

/** Get list of scaffolded features for this session. */
export function getScaffoldedFeatures(db: Database, sessionId: string): string[] {
  const state = getState(db, sessionId);
  if (!state) return [];
  return JSON.parse(state.scaffold_features || "[]");
}
