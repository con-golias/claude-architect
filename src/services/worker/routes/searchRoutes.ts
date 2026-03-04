/**
 * Search, timeline, and details batch routes.
 * Implements the 3-layer search workflow: search → timeline → details.
 *
 * @module searchRoutes
 */

import type { Router, Request, Response } from "express";
import type { Database } from "bun:sqlite";
import { findProjectByPath } from "../../sqlite/Projects";
import { searchDecisions, getDecision } from "../../sqlite/Decisions";
import { searchViolations } from "../../sqlite/Violations";

interface SearchResultItem {
  id: number;
  type: string;
  title: string;
  status: string;
  created_at: number;
  extra: string;
}

/**
 * Register search-related routes.
 *
 * @param router - Express router
 * @param db - Database instance
 */
export function registerSearchRoutes(router: Router, db: Database): void {
  // Unified search (Step 1: compact index)
  router.get("/api/search", (req: Request, res: Response) => {
    const query = req.query.query as string;
    const projectPath = req.query.project_path as string;
    const type = req.query.type as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const project = projectPath ? findProjectByPath(db, projectPath) : null;
    const projectId = project?.id;

    const results: SearchResultItem[] = [];

    if (!type || type === "decisions") {
      if (projectId) {
        const decisions = searchDecisions(db, projectId, { query, limit });
        for (const d of decisions) {
          results.push({
            id: d.id,
            type: "decision",
            title: d.title,
            status: d.status,
            created_at: d.created_at,
            extra: d.tags || "",
          });
        }
      }
    }

    if (!type || type === "violations") {
      if (projectId) {
        const violations = searchViolations(db, projectId, { query, limit });
        for (const v of violations) {
          results.push({
            id: v.id,
            type: "violation",
            title: `[${v.severity}] ${v.description}`,
            status: v.resolved ? "resolved" : "open",
            created_at: v.created_at,
            extra: v.rule_id,
          });
        }
      }
    }

    results.sort((a, b) => b.created_at - a.created_at);
    res.json(results.slice(0, limit));
  });

  // Timeline (Step 2: context around anchor)
  router.get("/api/timeline", (req: Request, res: Response) => {
    const anchorId = parseInt(req.query.anchor as string);
    const query = req.query.query as string;
    const projectPath = req.query.project_path as string;
    const depthBefore = parseInt(req.query.depth_before as string) || 5;
    const depthAfter = parseInt(req.query.depth_after as string) || 5;

    const project = projectPath ? findProjectByPath(db, projectPath) : null;
    const projectId = project?.id;

    if (!projectId) {
      res.status(404).json({ events: [], message: "Project not found" });
      return;
    }

    // Get all events for the project, sorted by time
    const allEvents: SearchResultItem[] = [];

    const decisions = searchDecisions(db, projectId, { query, limit: 100 });
    for (const d of decisions) {
      allEvents.push({
        id: d.id,
        type: "decision",
        title: d.title,
        status: d.status,
        created_at: d.created_at,
        extra: d.tags || "",
      });
    }

    const violations = searchViolations(db, projectId, { limit: 100 });
    for (const v of violations) {
      allEvents.push({
        id: v.id,
        type: "violation",
        title: `[${v.severity}] ${v.description}`,
        status: v.resolved ? "resolved" : "open",
        created_at: v.created_at,
        extra: v.rule_id,
      });
    }

    allEvents.sort((a, b) => a.created_at - b.created_at);

    // Find anchor point
    let anchorIndex = -1;
    if (!isNaN(anchorId)) {
      anchorIndex = allEvents.findIndex((e) => e.id === anchorId);
    } else if (query) {
      anchorIndex = allEvents.findIndex(
        (e) => e.title.toLowerCase().includes(query.toLowerCase())
      );
    }

    if (anchorIndex === -1) {
      anchorIndex = allEvents.length - 1;
    }

    const start = Math.max(0, anchorIndex - depthBefore);
    const end = Math.min(allEvents.length, anchorIndex + depthAfter + 1);

    res.json({
      events: allEvents.slice(start, end),
      anchorIndex: anchorIndex - start,
      total: allEvents.length,
    });
  });

  // Batch details (Step 3: full records)
  router.post("/api/details/batch", (req: Request, res: Response) => {
    const { ids, type } = req.body;

    if (!Array.isArray(ids) || !type) {
      res.status(400).json({ error: "ids (array) and type (string) are required" });
      return;
    }
    if (typeof type !== "string" || !["decisions", "violations", "changes"].includes(type)) {
      res.status(400).json({ error: 'type must be "decisions", "violations", or "changes"' });
      return;
    }
    if (ids.length > 50) {
      res.status(400).json({ error: "Maximum 50 IDs per request" });
      return;
    }

    const results: unknown[] = [];

    if (type === "decisions") {
      for (const id of ids) {
        const decision = getDecision(db, Number(id));
        if (decision) results.push(decision);
      }
    } else if (type === "violations") {
      // Fetch violations by ID
      for (const id of ids) {
        const violation = db
          .query<unknown, [number]>("SELECT * FROM violations WHERE id = ?")
          .get(Number(id));
        if (violation) results.push(violation);
      }
    } else if (type === "changes") {
      for (const id of ids) {
        const change = db
          .query<unknown, [number]>("SELECT * FROM structural_changes WHERE id = ?")
          .get(Number(id));
        if (change) results.push(change);
      }
    }

    res.json(results);
  });
}
