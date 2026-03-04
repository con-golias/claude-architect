/**
 * Project CRUD operations for the architect database.
 *
 * @module Projects
 */

import type { Database } from "bun:sqlite";
import type { ProjectRecord } from "../../types/database";

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
  const existing = db
    .query<ProjectRecord, [string]>("SELECT * FROM projects WHERE path = ?")
    .get(project.path);

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
    return { ...existing, name: project.name, updated_at: now };
  }

  db.query(
    `INSERT INTO projects (id, name, path, tech_stack, architecture_pattern, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    project.id,
    project.name,
    project.path,
    project.tech_stack ?? null,
    project.architecture_pattern ?? "clean",
    now,
    now,
  );

  return {
    id: project.id,
    name: project.name,
    path: project.path,
    tech_stack: project.tech_stack ?? null,
    architecture_pattern: project.architecture_pattern ?? "clean",
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
    .get(projectPath);
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
