/**
 * Project management API routes.
 *
 * @module projectRoutes
 */

import type { Router, Request, Response } from "express";
import type { Database } from "bun:sqlite";
import {
  listProjects,
  findProjectByPath,
  findProjectById,
  upsertProject,
  getEnabledManualRules,
  setEnabledManualRules,
} from "../../sqlite/Projects";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join, basename } from "path";
import { getRulesDir } from "../../../utils/paths";
import { getRuleMode } from "../../../utils/frontmatter";

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

  // Get rule configuration for a project
  router.get("/api/projects/:id/rules", (req: Request, res: Response) => {
    const project = findProjectById(db, req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const rulesDir = getRulesDir();
    if (!existsSync(rulesDir)) {
      res.json({ autoRules: [], manualRules: [], enabledManualRules: [] });
      return;
    }

    const autoRules: Array<{ id: string; name: string }> = [];
    const manualRules: Array<{ id: string; name: string }> = [];

    for (const file of readdirSync(rulesDir).filter(f => f.endsWith(".md")).sort()) {
      const ruleId = basename(file, ".md");
      const content = readFileSync(join(rulesDir, file), "utf-8");
      const mode = getRuleMode(content);
      const entry = { id: ruleId, name: ruleId.replace(/^\d+-/, "").replace(/-/g, " ") };

      if (mode === "manual") {
        manualRules.push(entry);
      } else {
        autoRules.push(entry);
      }
    }

    const enabledManualRules = getEnabledManualRules(db, project.id);
    res.json({ autoRules, manualRules, enabledManualRules });
  });

  // Set enabled manual rules for a project
  router.post("/api/projects/:id/rules", (req: Request, res: Response) => {
    const project = findProjectById(db, req.params.id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const { enabled } = req.body;
    if (!Array.isArray(enabled)) {
      res.status(400).json({ error: "enabled must be an array of rule IDs" });
      return;
    }

    // Validate that all provided IDs are actually manual rules
    const rulesDir = getRulesDir();
    const validManualIds = new Set<string>();
    if (existsSync(rulesDir)) {
      for (const file of readdirSync(rulesDir).filter(f => f.endsWith(".md"))) {
        const ruleId = basename(file, ".md");
        const content = readFileSync(join(rulesDir, file), "utf-8");
        if (getRuleMode(content) === "manual") validManualIds.add(ruleId);
      }
    }

    const validEnabled = enabled.filter(
      (id: unknown) => typeof id === "string" && validManualIds.has(id)
    );
    setEnabledManualRules(db, project.id, validEnabled);
    res.json({ enabledManualRules: validEnabled });
  });
}
