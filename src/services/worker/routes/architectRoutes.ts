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
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { spawnSync } from "child_process";
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

  // Code structure tree
  router.get("/api/structure", (req: Request, res: Response) => {
    const projectPath = req.query.project_path as string;
    if (!projectPath || typeof projectPath !== "string") {
      res.status(400).json({ error: "project_path query parameter required" });
      return;
    }

    const SKIP = new Set([
      "node_modules", ".git", ".bun", "coverage", ".turbo",
      ".cache", "__pycache__", "dist", ".next",
    ]);

    function scan(dirPath: string, depth: number): Record<string, unknown> | null {
      if (depth > 6) return null;
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        const children: Record<string, unknown>[] = [];
        let totalSize = 0;
        let fileCount = 0;

        for (const entry of entries) {
          if (SKIP.has(entry.name)) continue;
          const fullPath = join(dirPath, entry.name);

          if (entry.isDirectory()) {
            const child = scan(fullPath, depth + 1);
            if (child) {
              children.push(child);
              totalSize += child.size as number;
              fileCount += child.fileCount as number;
            }
          } else if (entry.isFile()) {
            try {
              const st = statSync(fullPath);
              const ext = entry.name.includes(".")
                ? entry.name.split(".").pop() || ""
                : "";
              children.push({ name: entry.name, type: "file", size: st.size, ext });
              totalSize += st.size;
              fileCount++;
            } catch { /* skip unreadable files */ }
          }
        }

        children.sort((a, b) => {
          if (a.type === "dir" && b.type !== "dir") return -1;
          if (a.type !== "dir" && b.type === "dir") return 1;
          return (a.name as string).localeCompare(b.name as string);
        });

        return {
          name: basename(dirPath),
          type: "dir",
          size: totalSize,
          fileCount,
          children,
        };
      } catch {
        return null;
      }
    }

    const tree = scan(projectPath, 0);
    if (!tree) {
      res.status(404).json({ error: "Project directory not found" });
      return;
    }
    res.json(tree);
  });

  // Git activity log
  router.get("/api/git-activity", (req: Request, res: Response) => {
    const projectPath = req.query.project_path as string;
    if (!projectPath || typeof projectPath !== "string") {
      res.status(400).json({ error: "project_path required" });
      return;
    }

    try {
      const result = spawnSync("git", [
        "log",
        "--format=%H%x09%at%x09%s",
        "--name-status",
        "-n", "30",
      ], { cwd: projectPath, encoding: "utf-8", timeout: 5000 });
      const raw = result.stdout || "";

      const commits: Array<{
        hash: string;
        timestamp: number;
        subject: string;
        files: Array<{ status: string; path: string }>;
      }> = [];
      let current: (typeof commits)[0] | null = null;

      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Commit line: 40-char hash <tab> unix-timestamp <tab> subject
        const commitMatch = trimmed.match(
          /^([a-f0-9]{40})\t(\d+)\t(.*)$/
        );
        if (commitMatch) {
          if (current) commits.push(current);
          current = {
            hash: commitMatch[1].substring(0, 8),
            timestamp: parseInt(commitMatch[2]) * 1000,
            subject: commitMatch[3],
            files: [],
          };
        } else if (current && /^[AMDRC]\t/.test(line)) {
          const parts = line.split("\t");
          current.files.push({
            status: parts[0],
            path: parts.slice(1).join("\t"),
          });
        }
      }
      if (current) commits.push(current);

      // Also include uncommitted (working) changes via git status
      try {
        const statusResult = spawnSync("git", ["status", "--short"], {
          cwd: projectPath,
          encoding: "utf-8",
          timeout: 3000,
        });
        const statusLines = (statusResult.stdout || "")
          .split("\n")
          .filter((l: string) => l.trim());

        if (statusLines.length > 0) {
          const files = statusLines.map((line: string) => {
            const st = line.substring(0, 2).trim() || "M";
            const p = line.substring(3).trim();
            return { status: st, path: p };
          });
          commits.unshift({
            hash: "working",
            timestamp: Date.now(),
            subject: `${files.length} uncommitted change${files.length !== 1 ? "s" : ""}`,
            files,
          });
        }
      } catch { /* not a git repo or no changes */ }

      res.json(commits);
    } catch {
      res.json([]);
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

          // Normalize backslashes for Windows compatibility
          const normalizedFilePath = filePath.replace(/\\/g, "/");
          const isRelevant = paths.some((p) => {
            const pattern = p.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
            return new RegExp(pattern).test(normalizedFilePath);
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
