/**
 * Architecture validation, scaffolding, and rules routes.
 *
 * @module architectRoutes
 */

import type { Router, Request, Response } from "express";
import type { Database } from "bun:sqlite";
import { findProjectByPath } from "../../sqlite/Projects";
import { saveSnapshot } from "../../sqlite/Compliance";
import { validateProject } from "../../validator/ValidatorEngine";
import { countBySeverity, countByRule } from "../../validator/ComplianceScorer";
import { generateFeature } from "../../scaffolder/FeatureGenerator";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import { getRulesDir } from "../../../utils/paths";

/**
 * Register architecture-related routes.
 *
 * @param router - Express router
 * @param db - Database instance
 */
export function registerArchitectRoutes(router: Router, db: Database): void {
  // Compliance check
  router.get("/api/check", (req: Request, res: Response) => {
    const projectPath = req.query.project_path as string;
    if (!projectPath || typeof projectPath !== "string") {
      res.status(400).json({ error: "project_path query parameter required" });
      return;
    }

    const categories = req.query.categories
      ? (req.query.categories as string).split(",")
      : undefined;
    const severity = req.query.severity as string | undefined;

    const report = validateProject(projectPath, {
      categories,
      severity: severity as "critical" | "warning" | "info" | undefined,
    });

    // Save snapshot if project is registered
    const project = findProjectByPath(db, projectPath);
    if (project) {
      saveSnapshot(db, {
        projectId: project.id,
        overallScore: report.overallScore,
        scoresByCategory: report.scoresByCategory,
        totalFeatures: report.totalFeatures,
        totalFiles: report.totalFiles,
        totalViolations: report.violations.length,
        violationsBySeverity: countBySeverity(report.violations),
        violationsByRule: countByRule(report.violations),
      });
    }

    res.json(report);
  });

  // Feature scaffolding
  router.post("/api/scaffold", (req: Request, res: Response) => {
    const { project_path, feature_name, description, with_tests } = req.body;
    if (!project_path || !feature_name) {
      res.status(400).json({ error: "project_path and feature_name are required" });
      return;
    }
    if (typeof project_path !== "string" || typeof feature_name !== "string") {
      res.status(400).json({ error: "project_path and feature_name must be strings" });
      return;
    }

    try {
      const result = generateFeature({
        projectPath: project_path,
        featureName: feature_name,
        description: typeof description === "string" ? description : undefined,
        withTests: with_tests !== false,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(409).json({ error: (err as Error).message });
    }
  });

  // Get architecture rules
  router.get("/api/rules", (req: Request, res: Response) => {
    const filePath = req.query.file_path as string | undefined;
    const category = req.query.category as string | undefined;
    const rulesDir = getRulesDir();

    if (!existsSync(rulesDir)) {
      res.json({ rules: [], message: "Rules directory not found" });
      return;
    }

    const ruleFiles = readdirSync(rulesDir)
      .filter((f) => f.endsWith(".md"))
      .sort();

    const rules: Array<{ id: string; name: string; content: string }> = [];

    for (const file of ruleFiles) {
      const ruleId = basename(file, ".md");

      // Filter by category if specified
      if (category && !ruleId.includes(category)) continue;

      const content = readFileSync(join(rulesDir, file), "utf-8");

      // Filter by file path scope if specified
      if (filePath) {
        const pathsMatch = content.match(/^---\s*\npaths:\s*\n([\s\S]*?)---/m);
        if (pathsMatch) {
          const paths = pathsMatch[1]
            .split("\n")
            .map((l) => l.replace(/^\s*-\s*/, "").trim())
            .filter(Boolean);

          const isRelevant = paths.some((p) => {
            const pattern = p.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
            return new RegExp(pattern).test(filePath);
          });

          if (!isRelevant) continue;
        }
      }

      rules.push({
        id: ruleId,
        name: ruleId.replace(/^\d+-/, "").replace(/-/g, " "),
        content,
      });
    }

    res.json({ rules });
  });
}
