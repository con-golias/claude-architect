/**
 * Code structure and git activity routes.
 *
 * @module codeInfoRoutes
 */

import type { Router, Request, Response } from "express";
import { readdirSync, statSync } from "fs";
import { spawnSync } from "child_process";
import { join, basename } from "path";

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".bun", "coverage", ".turbo",
  ".cache", "__pycache__", "dist", ".next",
]);

/**
 * Register code structure and git activity routes.
 *
 * @param router - Express router
 */
export function registerCodeInfoRoutes(router: Router): void {
  // Code structure tree
  router.get("/api/structure", (req: Request, res: Response) => {
    const projectPath = req.query.project_path as string;
    if (!projectPath || typeof projectPath !== "string") {
      res.status(400).json({ error: "project_path query parameter required" });
      return;
    }

    function scan(dirPath: string, depth: number): Record<string, unknown> | null {
      if (depth > 6) return null;
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        const children: Record<string, unknown>[] = [];
        let totalSize = 0;
        let fileCount = 0;

        for (const entry of entries) {
          if (SKIP_DIRS.has(entry.name)) continue;
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
              const ext = entry.name.includes(".") ? entry.name.split(".").pop() || "" : "";
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

        return { name: basename(dirPath), type: "dir", size: totalSize, fileCount, children };
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
        "log", "--format=%H%x09%at%x09%s", "--name-status", "-n", "30",
      ], { cwd: projectPath, encoding: "utf-8", timeout: 5000 });
      const raw = result.stdout || "";

      const commits: Array<{
        hash: string; timestamp: number; subject: string;
        files: Array<{ status: string; path: string }>;
      }> = [];
      let current: (typeof commits)[0] | null = null;

      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const commitMatch = trimmed.match(/^([a-f0-9]{40})\t(\d+)\t(.*)$/);
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
          current.files.push({ status: parts[0], path: parts.slice(1).join("\t") });
        }
      }
      if (current) commits.push(current);

      // Include uncommitted changes via git status
      try {
        const statusResult = spawnSync("git", ["status", "--short"], {
          cwd: projectPath, encoding: "utf-8", timeout: 3000,
        });
        const statusLines = (statusResult.stdout || "").split("\n").filter((l: string) => l.trim());
        if (statusLines.length > 0) {
          const files = statusLines.map((line: string) => ({
            status: line.substring(0, 2).trim() || "M",
            path: line.substring(3).trim(),
          }));
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
}
