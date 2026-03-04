/**
 * Compliance snapshot storage and trend tracking.
 *
 * @module Compliance
 */

import type { Database } from "bun:sqlite";
import type { ComplianceSnapshotRecord } from "../../types/database";

interface CreateSnapshotInput {
  projectId: string;
  sessionId?: string;
  overallScore: number;
  scoresByCategory: Record<string, number>;
  totalFeatures: number;
  totalFiles: number;
  totalViolations: number;
  violationsBySeverity: Record<string, number>;
  violationsByRule: Record<string, number>;
}

/**
 * Save a compliance snapshot for trend tracking.
 *
 * @param db - Database instance
 * @param input - Snapshot data
 * @returns The created snapshot ID
 */
export function saveSnapshot(
  db: Database,
  input: CreateSnapshotInput
): number {
  const stmt = db.query(
    `INSERT INTO compliance_snapshots
       (project_id, session_id, overall_score, scores_by_category,
        total_features, total_files, total_violations,
        violations_by_severity, violations_by_rule, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    input.projectId,
    input.sessionId ?? null,
    input.overallScore,
    JSON.stringify(input.scoresByCategory),
    input.totalFeatures,
    input.totalFiles,
    input.totalViolations,
    JSON.stringify(input.violationsBySeverity),
    JSON.stringify(input.violationsByRule),
    Date.now(),
  );
  return Number((result as unknown as { lastInsertRowid: number }).lastInsertRowid);
}

/**
 * Get the most recent compliance snapshot for a project.
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @returns Most recent snapshot or null
 */
export function getLatestSnapshot(
  db: Database,
  projectId: string
): ComplianceSnapshotRecord | null {
  return db
    .query<ComplianceSnapshotRecord, [string]>(
      `SELECT * FROM compliance_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(projectId);
}

/**
 * Get compliance score history for trend charts.
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @param count - Number of snapshots to return
 * @returns Array of snapshots ordered oldest → newest
 */
export function getScoreHistory(
  db: Database,
  projectId: string,
  count: number = 20
): ComplianceSnapshotRecord[] {
  return db
    .query<ComplianceSnapshotRecord, [string, number]>(
      `SELECT * FROM compliance_snapshots WHERE project_id = ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(projectId, count)
    .reverse();
}

/**
 * Determine compliance trend (improving, stable, or declining).
 *
 * @param db - Database instance
 * @param projectId - Project ID
 * @returns Trend direction based on last 5 snapshots
 */
export function getComplianceTrend(
  db: Database,
  projectId: string
): "improving" | "stable" | "declining" {
  const snapshots = db
    .query<{ overall_score: number }, [string]>(
      `SELECT overall_score FROM compliance_snapshots
       WHERE project_id = ? ORDER BY created_at DESC LIMIT 5`
    )
    .all(projectId);

  if (snapshots.length < 2) return "stable";

  const latest = snapshots[0].overall_score;
  const oldest = snapshots[snapshots.length - 1].overall_score;
  const diff = latest - oldest;

  if (diff > 3) return "improving";
  if (diff < -3) return "declining";
  return "stable";
}
