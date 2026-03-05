/**
 * Project CRUD operations for the architect database.
 *
 * @module Projects
 */

import type { Database } from "bun:sqlite";
import type { ProjectRecord } from "../../types/database";
import { normalizePath } from "../../utils/paths";

/**
 * Register a new project or update an existing one.
 *
 * @param db - Database instance
 * @param project - Project data (id, name, path required)
 * @returns The created/updated project record
 */
export function upsertProject(
  db: Database,
  project: Pick<ProjectRecord, "id" | "name" | "path"> &
    Partial<ProjectRecord>
): ProjectRecord {
  const now = Date.now();
  const normalizedProjectPath = normalizePath(project.path);
  const existing = db
    .query<ProjectRecord, [string]>("SELECT * FROM projects WHERE path = ?")
    .get(normalizedProjectPath);

  if (existing) {
    db.query(
      `UPDATE projects SET name = ?, tech_stack = ?, architecture_pattern = ?, updated_at = ? WHERE id = ?`
    ).run(
      project.name,
      project.tech_stack ?? existing.tech_stack,
      project.architecture_pattern ?? existing.architecture_pattern,
      now,
      existing.id,
    );
    return {
      ...existing,
      name: project.name,
      enabled_manual_rules: existing.enabled_manual_rules ?? "[]",
      updated_at: now,
    };
  }

  db.query(
    `INSERT INTO projects (id, name, path, tech_stack, architecture_pattern, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    project.id,
    project.name,
    normalizedProjectPath,
    project.tech_stack ?? null,
    project.architecture_pattern ?? "clean",
    now,
    now,
  );

  return {
    id: project.id,
    name: project.name,
    path: normalizedProjectPath,
    tech_stack: project.tech_stack ?? null,
    architecture_pattern: project.architecture_pattern ?? "clean",
    enabled_manual_rules: "[]",
    created_at: now,
    updated_at: now,
  };
}

/**
 * Find a project by its filesystem path.
 *
 * @param db - Database instance
 * @param projectPath - Absolute path to the project root
 * @returns Project record or null if not found
 */
export function findProjectByPath(
  db: Database,
  projectPath: string
): ProjectRecord | null {
  return db
    .query<ProjectRecord, [string]>("SELECT * FROM projects WHERE path = ?")
    .get(normalizePath(projectPath));
}

/**
 * Find a project by its ID.
 *
 * @param db - Database instance
 * @param projectId - Project UUID
 * @returns Project record or null if not found
 */
export function findProjectById(
  db: Database,
  projectId: string
): ProjectRecord | null {
  return db
    .query<ProjectRecord, [string]>("SELECT * FROM projects WHERE id = ?")
    .get(projectId);
}

/**
 * List all registered projects.
 *
 * @param db - Database instance
 * @returns Array of all project records
 */
export function listProjects(db: Database): ProjectRecord[] {
  return db
    .query<ProjectRecord, []>("SELECT * FROM projects ORDER BY updated_at DESC")
    .all();
}

/**
 * Get enabled manual rules for a project.
 *
 * @param db - Database instance
 * @param projectId - Project UUID
 * @returns Array of enabled manual rule IDs
 */
export function getEnabledManualRules(
  db: Database,
  projectId: string
): string[] {
  const row = db
    .query<{ enabled_manual_rules: string }, [string]>(
      "SELECT enabled_manual_rules FROM projects WHERE id = ?"
    )
    .get(projectId);

  if (!row?.enabled_manual_rules) return [];

  try {
    const parsed = JSON.parse(row.enabled_manual_rules);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Set enabled manual rules for a project.
 *
 * @param db - Database instance
 * @param projectId - Project UUID
 * @param ruleIds - Array of manual rule IDs to enable
 */
export function setEnabledManualRules(
  db: Database,
  projectId: string,
  ruleIds: string[]
): void {
  const now = Date.now();
  db.query(
    "UPDATE projects SET enabled_manual_rules = ?, updated_at = ? WHERE id = ?"
  ).run(JSON.stringify(ruleIds), now, projectId);
}
