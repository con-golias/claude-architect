/**
 * Dashboard and status routes for web UI and project health.
 *
 * @module dashboardRoutes
 */

import type { Router, Request, Response } from "express";
import type { Database } from "bun:sqlite";
import { listProjects, findProjectByPath } from "../../sqlite/Projects";
import { getRecentDecisions } from "../../sqlite/Decisions";
import { getOpenViolations, getViolationCounts } from "../../sqlite/Violations";
import { countSessions } from "../../sqlite/Sessions";
import {
  getLatestSnapshot,
  getScoreHistory,
  getComplianceTrend,
} from "../../sqlite/Compliance";
import { getPendingSuggestions } from "../../sqlite/Improvements";

/**
 * Register dashboard and status routes.
 *
 * @param router - Express router
 * @param db - Database instance
 */
export function registerDashboardRoutes(router: Router, db: Database): void {
  // Project status (API for MCP tools)
  router.get("/api/status", (req: Request, res: Response) => {
    const projectPath = req.query.project_path as string;
    if (!projectPath) {
      res.status(400).json({ error: "project_path required" });
      return;
    }

    const project = findProjectByPath(db, projectPath);
    if (!project) {
      res.json({
        registered: false,
        message: "Project not registered. Run /architect-init first.",
      });
      return;
    }

    const latestSnapshot = getLatestSnapshot(db, project.id);
    const trend = getComplianceTrend(db, project.id);
    const violationCounts = getViolationCounts(db, project.id);
    const recentDecisions = getRecentDecisions(db, project.id, 5);
    const sessionCount = countSessions(db, project.id);
    const suggestions = getPendingSuggestions(db, project.id);

    res.json({
      project,
      complianceScore: latestSnapshot?.overall_score ?? null,
      trend,
      violations: violationCounts,
      recentDecisions,
      sessionCount,
      suggestions: suggestions.length,
      lastChecked: latestSnapshot?.created_at ?? null,
    });
  });

  // Dashboard data (for web UI)
  router.get("/dashboard/data", (req: Request, res: Response) => {
    const projectPath = req.query.project_path as string;
    const project = projectPath ? findProjectByPath(db, projectPath) : null;

    if (!project) {
      const allProjects = listProjects(db);
      res.json({ projects: allProjects, selectedProject: null });
      return;
    }

    const scoreHistory = getScoreHistory(db, project.id, 20);
    const violations = getOpenViolations(db, project.id, { limit: 50 });
    const recentDecisions = getRecentDecisions(db, project.id, 10);
    const trend = getComplianceTrend(db, project.id);
    const violationCounts = getViolationCounts(db, project.id);
    const suggestions = getPendingSuggestions(db, project.id);

    res.json({
      project,
      scoreHistory,
      violations,
      recentDecisions,
      trend,
      violationCounts,
      suggestions,
    });
  });

  // Health check
  router.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      service: "claude-architect",
      timestamp: new Date().toISOString(),
    });
  });
}
