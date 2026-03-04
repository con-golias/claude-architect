/**
 * Architectural Decision Record (ADR) storage and search.
 *
 * @module Decisions
 */

import type { Database, SQLQueryBindings } from "bun:sqlite";
import type { DecisionRecord } from "../../types/database";

interface CreateDecisionInput {
  projectId: string;
  sessionId?: string;
  title: string;
  context?: string;
  decision: string;
  alternatives?: Array<{ name: string; pros: string[]; cons: string[] }>;
  consequencesPositive?: string[];
  consequencesNegative?: string[];
  tags?: string[];
}

/**
 * Create a new architectural decision record.
 *
 * @param db - Database instance
 * @param input - Decision data
 * @returns The created decision ID
 */
export function createDecision(
  db: Database,
  input: CreateDecisionInput
): number {
  const stmt = db.query(
    `INSERT INTO decisions
       (project_id, session_id, title, status, context, decision, alternatives,
        consequences_positive, consequences_negative, tags, created_at)
     VALUES (?, ?, ?, 'accepted', ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    input.projectId,
    input.sessionId ?? null,
    input.title,
    input.context ?? null,
    input.decision,
    input.alternatives ? JSON.stringify(input.alternatives) : null,
    input.consequencesPositive
      ? JSON.stringify(input.consequencesPositive)
      : null,
    input.consequencesNegative
      ? JSON.stringify(input.consequencesNegative)
      : null,
    input.tags ? JSON.stringify(input.tags) : null,
    Date.now(),
  );
  return Number((result as unknown as { lastInsertRowid: number }).lastInsertRowid);
}

/**
 * Get a decision by ID.
 *
 * @param db - Database instance
 * @param decisionId - Decision ID
 * @returns Decision record or null
 */
export function getDecision(
  db: Database,
  decisionId: number
): DecisionRecord | null {
  return db
    .query<DecisionRecord, [number]>("SELECT * FROM decisions WHERE id = ?")
    .get(decisionId);
}

/**
 * Search decisions by project and optional filters.
 *
 * @param db - Database instance
 * @param projectId - Project ID to filter by
 * @param options - Search options
 * @returns Array of matching decisions
 */
export function searchDecisions(
  db: Database,
  projectId: string,
  options: {
    query?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}
): DecisionRecord[] {
  const conditions = ["project_id = ?"];
  const params: SQLQueryBindings[] = [projectId];

  if (options.query) {
    conditions.push("(title LIKE ? OR decision LIKE ? OR context LIKE ?)");
    const like = `%${options.query}%`;
    params.push(like, like, like);
  }

  if (options.status) {
    conditions.push("status = ?");
    params.push(options.status);
  }

  const limit = Math.min(options.limit ?? 20, 100);
  const offset = options.offset ?? 0;

  const sql = `
    SELECT * FROM decisions
    WHERE ${conditions.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  return db.query<DecisionRecord, SQLQueryBindings[]>(sql).all(...params);
}

/**
 * Get the most recent decisions for a project.
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @param count - Number of recent decisions to return
 * @returns Array of recent decisions
 */
export function getRecentDecisions(
  db: Database,
  projectId: string,
  count: number = 5
): DecisionRecord[] {
  return db
    .query<DecisionRecord, [string, number]>(
      `SELECT * FROM decisions WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(projectId, count);
}

/**
 * Update decision status (e.g., deprecate or supersede).
 *
 * @param db - Database instance
 * @param decisionId - Decision ID to update
 * @param status - New status
 * @param supersededBy - ID of the superseding decision (if applicable)
 */
export function updateDecisionStatus(
  db: Database,
  decisionId: number,
  status: DecisionRecord["status"],
  supersededBy?: number
): void {
  db.query(`UPDATE decisions SET status = ?, superseded_by = ? WHERE id = ?`)
    .run(status, supersededBy ?? null, decisionId);
}
