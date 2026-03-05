/**
 * Self-improvement tracking — rule metrics and improvement suggestions.
 *
 * @module Improvements
 */

import type { Database } from "bun:sqlite";
import type {
  RuleMetricRecord,
  ImprovementSuggestionRecord,
} from "../../types/database";

/**
 * Increment violation count for a rule.
 *
 * @param db - Database instance
 * @param ruleId - Rule identifier (e.g., "01-architecture")
 * @param projectId - Project ID (null for global metrics)
 */
export function trackViolation(
  db: Database,
  ruleId: string,
  projectId: string | null = null
): void {
  const now = Date.now();
  const existing = db
    .query<RuleMetricRecord, [string, string | null]>(
      "SELECT * FROM rule_metrics WHERE rule_id = ? AND project_id IS ?"
    )
    .get(ruleId, projectId);

  if (existing) {
    db.query(
      `UPDATE rule_metrics SET
         total_violations = total_violations + 1,
         last_violation_at = ?,
         updated_at = ?
       WHERE id = ?`
    ).run(now, now, existing.id);
  } else {
    db.query(
      `INSERT INTO rule_metrics
         (project_id, rule_id, total_violations, resolved_violations,
          ignored_violations, last_violation_at, updated_at)
       VALUES (?, ?, 1, 0, 0, ?, ?)`
    ).run(projectId, ruleId, now, now);
  }
}

/**
 * Track a resolved violation for a rule.
 *
 * @param db - Database instance
 * @param ruleId - Rule identifier
 * @param resolutionTimeMs - Time taken to resolve (milliseconds)
 * @param projectId - Project ID (null for global)
 */
export function trackResolution(
  db: Database,
  ruleId: string,
  resolutionTimeMs: number,
  projectId: string | null = null
): void {
  const now = Date.now();
  db.query(
    `UPDATE rule_metrics SET
       resolved_violations = resolved_violations + 1,
       avg_resolution_time_ms = CASE
         WHEN avg_resolution_time_ms IS NULL THEN ?
         ELSE ((avg_resolution_time_ms * resolved_violations) + ?) / (resolved_violations + 1)
       END,
       updated_at = ?
     WHERE rule_id = ? AND project_id IS ?`
  ).run(resolutionTimeMs, resolutionTimeMs, now, ruleId, projectId);
}

/**
 * Get all rule metrics for a project.
 *
 * @param db - Database instance
 * @param projectId - Project ID (null for global metrics)
 * @returns Array of rule metric records
 */
export function getRuleMetrics(
  db: Database,
  projectId: string | null = null
): RuleMetricRecord[] {
  return db
    .query<RuleMetricRecord, [string | null]>(
      `SELECT * FROM rule_metrics WHERE project_id IS ?
       ORDER BY total_violations DESC`
    )
    .all(projectId);
}

/**
 * Create an improvement suggestion.
 *
 * @param db - Database instance
 * @param suggestion - Suggestion data
 * @returns The created suggestion ID
 */
export function createSuggestion(
  db: Database,
  suggestion: {
    projectId?: string;
    ruleId?: string;
    suggestionType: ImprovementSuggestionRecord["suggestion_type"];
    title: string;
    reasoning: string;
    evidence?: Record<string, unknown>;
  }
): number {
  const stmt = db.query(
    `INSERT INTO improvement_suggestions
       (project_id, rule_id, suggestion_type, title, reasoning, evidence, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
  );
  const result = stmt.run(
    suggestion.projectId ?? null,
    suggestion.ruleId ?? null,
    suggestion.suggestionType,
    suggestion.title,
    suggestion.reasoning,
    suggestion.evidence ? JSON.stringify(suggestion.evidence) : null,
    Date.now(),
  );
  return Number((result as unknown as { lastInsertRowid: number }).lastInsertRowid);
}

/**
 * Get pending improvement suggestions.
 *
 * @param db - Database instance
 * @param projectId - Project ID (null for global)
 * @returns Array of pending suggestions
 */
export function getPendingSuggestions(
  db: Database,
  projectId: string | null = null
): ImprovementSuggestionRecord[] {
  if (projectId) {
    return db
      .query<ImprovementSuggestionRecord, [string]>(
        `SELECT * FROM improvement_suggestions
         WHERE (project_id = ? OR project_id IS NULL) AND status = 'pending'
         ORDER BY created_at DESC`
      )
      .all(projectId);
  }

  return db
    .query<ImprovementSuggestionRecord, []>(
      `SELECT * FROM improvement_suggestions
       WHERE status = 'pending' ORDER BY created_at DESC`
    )
    .all();
}

/**
 * Update suggestion status (apply or dismiss).
 *
 * @param db - Database instance
 * @param suggestionId - Suggestion ID
 * @param status - New status
 */
export function updateSuggestionStatus(
  db: Database,
  suggestionId: number,
  status: "applied" | "dismissed"
): void {
  db.query(
    `UPDATE improvement_suggestions SET status = ?, applied_at = ? WHERE id = ?`
  ).run(status, status === "applied" ? Date.now() : null, suggestionId);
}
