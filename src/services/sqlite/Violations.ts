/**
 * Violation tracking and resolution for architecture rules.
 *
 * @module Violations
 */

import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { ViolationRecord } from "../../types/database";

interface CreateViolationInput {
  projectId: string;
  sessionId?: string;
  ruleId: string;
  ruleName: string;
  severity: ViolationRecord["severity"];
  category: ViolationRecord["category"];
  filePath?: string;
  lineNumber?: number;
  description: string;
  suggestion?: string;
}

/**
 * Record a new architecture violation.
 *
 * @param db - Database instance
 * @param input - Violation data
 * @returns The created violation ID
 */
export function createViolation(
  db: Database,
  input: CreateViolationInput
): number {
  const stmt = db.query(
    `INSERT INTO violations
       (project_id, session_id, rule_id, rule_name, severity, category,
        file_path, line_number, description, suggestion, resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  );
  const result = stmt.run(
    input.projectId,
    input.sessionId ?? null,
    input.ruleId,
    input.ruleName,
    input.severity,
    input.category,
    input.filePath ?? null,
    input.lineNumber ?? null,
    input.description,
    input.suggestion ?? null,
    Date.now(),
  );
  return Number((result as unknown as { lastInsertRowid: number }).lastInsertRowid);
}

/**
 * Get all unresolved violations for a project.
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @param options - Filter options
 * @returns Array of unresolved violations
 */
export function getOpenViolations(
  db: Database,
  projectId: string,
  options: {
    severity?: string;
    category?: string;
    ruleId?: string;
    limit?: number;
  } = {}
): ViolationRecord[] {
  const conditions = ["project_id = ?", "resolved = 0"];
  const params: SQLQueryBindings[] = [projectId];

  if (options.severity) {
    conditions.push("severity = ?");
    params.push(options.severity);
  }
  if (options.category) {
    conditions.push("category = ?");
    params.push(options.category);
  }
  if (options.ruleId) {
    conditions.push("rule_id = ?");
    params.push(options.ruleId);
  }

  const limit = Math.min(options.limit ?? 50, 200);
  params.push(limit);

  return db
    .query<ViolationRecord, SQLQueryBindings[]>(
      `SELECT * FROM violations WHERE ${conditions.join(" AND ")}
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC
       LIMIT ?`
    )
    .all(...params);
}

/**
 * Resolve a violation.
 *
 * @param db - Database instance
 * @param violationId - Violation ID
 * @param resolvedBy - Who/what resolved it ('auto', 'manual', or session_id)
 */
export function resolveViolation(
  db: Database,
  violationId: number,
  resolvedBy: string = "manual"
): void {
  db.query(
    `UPDATE violations SET resolved = 1, resolved_at = ?, resolved_by = ? WHERE id = ?`
  ).run(Date.now(), resolvedBy, violationId);
}

/**
 * Resolve all violations for a specific file (when file is fixed or deleted).
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @param filePath - File path whose violations should be resolved
 * @param resolvedBy - Resolution source
 */
export function resolveViolationsForFile(
  db: Database,
  projectId: string,
  filePath: string,
  resolvedBy: string = "auto"
): void {
  db.query(
    `UPDATE violations SET resolved = 1, resolved_at = ?, resolved_by = ?
     WHERE project_id = ? AND file_path = ? AND resolved = 0`
  ).run(Date.now(), resolvedBy, projectId, filePath);
}

/**
 * Get violation counts grouped by severity for a project.
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @returns Counts per severity level
 */
export function getViolationCounts(
  db: Database,
  projectId: string
): { critical: number; warning: number; info: number } {
  const rows = db
    .query<{ severity: string; count: number }, [string]>(
      `SELECT severity, COUNT(*) as count FROM violations
       WHERE project_id = ? AND resolved = 0
       GROUP BY severity`
    )
    .all(projectId);

  const counts = { critical: 0, warning: 0, info: 0 };
  for (const row of rows) {
    if (row.severity in counts) {
      counts[row.severity as keyof typeof counts] = row.count;
    }
  }
  return counts;
}

/**
 * Search violations with text matching.
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @param options - Search options
 * @returns Matching violations
 */
export function searchViolations(
  db: Database,
  projectId: string,
  options: {
    query?: string;
    resolved?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): ViolationRecord[] {
  const conditions = ["project_id = ?"];
  const params: SQLQueryBindings[] = [projectId];

  if (options.query) {
    conditions.push("(description LIKE ? OR file_path LIKE ? OR rule_name LIKE ?)");
    const like = `%${options.query}%`;
    params.push(like, like, like);
  }

  if (options.resolved !== undefined) {
    conditions.push("resolved = ?");
    params.push(options.resolved ? 1 : 0);
  }

  const limit = Math.min(options.limit ?? 20, 100);
  params.push(limit, options.offset ?? 0);

  return db
    .query<ViolationRecord, SQLQueryBindings[]>(
      `SELECT * FROM violations WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params);
}
