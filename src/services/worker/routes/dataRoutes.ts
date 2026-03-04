/**
 * Data CRUD routes: decisions, violations, sessions, compliance, improvements.
 *
 * @module dataRoutes
 */

import type { Router, Request, Response } from "express";
import type { Database } from "bun:sqlite";
import { findProjectByPath } from "../../sqlite/Projects";
import {
  searchDecisions,
  getDecision,
  createDecision,
  getRecentDecisions,
} from "../../sqlite/Decisions";
import {
  getOpenViolations,
  searchViolations,
  resolveViolation,
  getViolationCounts,
} from "../../sqlite/Violations";
import { getRecentSessions, countSessions } from "../../sqlite/Sessions";
import {
  getLatestSnapshot,
  getScoreHistory,
  getComplianceTrend,
} from "../../sqlite/Compliance";
import { getPendingSuggestions } from "../../sqlite/Improvements";

/**
 * Register data CRUD routes.
 *
 * @param router - Express router
 * @param db - Database instance
 */
export function registerDataRoutes(router: Router, db: Database): void {
  // --- Decisions ---

  router.get("/api/decisions", (req: Request, res: Response) => {
    const projectId = req.query.project_id as string;
    const projectPath = req.query.project_path as string;

    // Support both project_id and project_path
    let resolvedProjectId = projectId;
    if (!resolvedProjectId && projectPath) {
      const project = findProjectByPath(db, projectPath);
      resolvedProjectId = project?.id ?? "";
    }

    if (!resolvedProjectId) {
      res.status(400).json({ error: "project_id or project_path required" });
      return;
    }

    const results = searchDecisions(db, resolvedProjectId, {
      query: req.query.query as string,
      status: req.query.status as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json(results);
  });

  router.get("/api/decisions/:id", (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid decision ID" });
      return;
    }
    const decision = getDecision(db, id);
    if (!decision) {
      res.status(404).json({ error: "Decision not found" });
      return;
    }
    res.json(decision);
  });

  router.post("/api/decisions", (req: Request, res: Response) => {
    const { projectId, project_path, title, context, decision, alternatives, tags } = req.body;

    // Support both projectId and project_path
    let resolvedProjectId = projectId;
    if (!resolvedProjectId && project_path) {
      const project = findProjectByPath(db, project_path);
      resolvedProjectId = project?.id;
    }

    if (!resolvedProjectId || !title || !decision) {
      res.status(400).json({ error: "projectId (or project_path), title, and decision required" });
      return;
    }
    if (typeof title !== "string" || typeof decision !== "string") {
      res.status(400).json({ error: "title and decision must be strings" });
      return;
    }

    const id = createDecision(db, {
      projectId: resolvedProjectId,
      title,
      context: typeof context === "string" ? context : undefined,
      decision,
      alternatives: Array.isArray(alternatives) ? alternatives : undefined,
      tags: Array.isArray(tags) ? tags : undefined,
    });
    res.status(201).json({ id });
  });

  // --- Violations ---

  router.get("/api/violations", (req: Request, res: Response) => {
    const projectId = req.query.project_id as string;
    if (!projectId) {
      res.status(400).json({ error: "project_id required" });
      return;
    }
    const results = searchViolations(db, projectId, {
      query: req.query.query as string,
      resolved:
        req.query.resolved === "true"
          ? true
          : req.query.resolved === "false"
            ? false
            : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json(results);
  });

  router.patch("/api/violations/:id", (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid violation ID" });
      return;
    }
    const { resolved_by } = req.body;
    resolveViolation(db, id, typeof resolved_by === "string" ? resolved_by : "manual");
    res.json({ success: true });
  });

  // --- Sessions ---

  router.get("/api/sessions", (req: Request, res: Response) => {
    const projectId = req.query.project_id as string;
    if (!projectId) {
      res.status(400).json({ error: "project_id required" });
      return;
    }
    res.json(getRecentSessions(db, projectId));
  });

  // --- Compliance ---

  router.get("/api/compliance/snapshots", (req: Request, res: Response) => {
    const projectId = req.query.project_id as string;
    if (!projectId) {
      res.status(400).json({ error: "project_id required" });
      return;
    }
    res.json(getScoreHistory(db, projectId));
  });

  // --- Improvements ---

  router.get("/api/improvements", (req: Request, res: Response) => {
    const projectId = (req.query.project_id as string) || null;
    res.json(getPendingSuggestions(db, projectId));
  });
}
