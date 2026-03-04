/**
 * Project management API routes.
 *
 * @module projectRoutes
 */

import type { Router, Request, Response } from "express";
import type { Database } from "bun:sqlite";
import { listProjects, findProjectByPath, upsertProject } from "../../sqlite/Projects";

/**
 * Register project-related routes.
 *
 * @param router - Express router
 * @param db - Database instance
 */
export function registerProjectRoutes(router: Router, db: Database): void {
  router.get("/api/projects", (_req: Request, res: Response) => {
    res.json(listProjects(db));
  });

  router.post("/api/projects", (req: Request, res: Response) => {
    const { id, name, path, tech_stack } = req.body;
    if (!id || !name || !path) {
      res.status(400).json({ error: "id, name, and path are required" });
      return;
    }
    if (typeof id !== "string" || typeof name !== "string" || typeof path !== "string") {
      res.status(400).json({ error: "id, name, and path must be strings" });
      return;
    }
    const project = upsertProject(db, { id, name, path, tech_stack });
    res.status(201).json(project);
  });
}
