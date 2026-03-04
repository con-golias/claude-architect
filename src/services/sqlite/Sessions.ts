/**
 * Session history tracking for claude-architect.
 *
 * @module Sessions
 */

import type { Database } from "bun:sqlite";
import type { SessionRecord } from "../../types/database";

/**
 * Start a new session for a project.
 *
 * @param db - Database instance
 * @param sessionId - Claude Code session ID
 * @param projectId - Project ID
 * @param complianceScore - Initial compliance score (if available)
 */
export function startSession(
  db: Database,
  sessionId: string,
  projectId: string,
  complianceScore?: number
): void {
  db.query(
    `INSERT OR IGNORE INTO sessions
       (id, project_id, started_at, compliance_score_before, decisions_made, violations_found, violations_resolved)
     VALUES (?, ?, ?, ?, 0, 0, 0)`
  ).run(sessionId, projectId, Date.now(), complianceScore ?? null);
}

/**
 * Complete a session with summary data.
 *
 * @param db - Database instance
 * @param sessionId - Session ID to complete
 * @param data - Completion data
 */
export function completeSession(
  db: Database,
  sessionId: string,
  data: {
    summary?: string;
    featuresAdded?: string[];
    filesChanged?: string[];
    decisionsMade?: number;
    violationsFound?: number;
    violationsResolved?: number;
    complianceScoreAfter?: number;
  }
): void {
  db.query(
    `UPDATE sessions SET
       completed_at = ?,
       summary = ?,
       features_added = ?,
       files_changed = ?,
       decisions_made = ?,
       violations_found = ?,
       violations_resolved = ?,
       compliance_score_after = ?
     WHERE id = ?`
  ).run(
    Date.now(),
    data.summary ?? null,
    data.featuresAdded ? JSON.stringify(data.featuresAdded) : null,
    data.filesChanged ? JSON.stringify(data.filesChanged) : null,
    data.decisionsMade ?? 0,
    data.violationsFound ?? 0,
    data.violationsResolved ?? 0,
    data.complianceScoreAfter ?? null,
    sessionId,
  );
}

/**
 * Get session by ID.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns Session record or null
 */
export function getSession(
  db: Database,
  sessionId: string
): SessionRecord | null {
  return db
    .query<SessionRecord, [string]>("SELECT * FROM sessions WHERE id = ?")
    .get(sessionId);
}

/**
 * Get recent sessions for a project.
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @param count - Number of sessions to return
 * @returns Array of recent sessions
 */
export function getRecentSessions(
  db: Database,
  projectId: string,
  count: number = 10
): SessionRecord[] {
  return db
    .query<SessionRecord, [string, number]>(
      `SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?`
    )
    .all(projectId, count);
}

/**
 * Count total sessions for a project.
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @returns Number of sessions
 */
export function countSessions(db: Database, projectId: string): number {
  const result = db
    .query<{ count: number }, [string]>(
      "SELECT COUNT(*) as count FROM sessions WHERE project_id = ?"
    )
    .get(projectId);
  return result?.count ?? 0;
}
