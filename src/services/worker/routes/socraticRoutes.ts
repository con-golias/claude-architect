/**
 * REST API routes for the Socratic Reasoning Engine.
 * Endpoints: analyze, verify, status, cleanup.
 *
 * @module socraticRoutes
 */

import type { Router, Request, Response } from "express";
import type { Database } from "bun:sqlite";
import { analyze, verify, getStatus } from "../../socratic/SocraticEngine";
import { cleanExpiredSessions } from "../../sqlite/Socratic";
import { ACTION_TYPES } from "../../socratic/SocraticTypes";

/**
 * Register Socratic reasoning routes on the Express router.
 *
 * @param router - Express router instance
 * @param db - SQLite database instance
 */
export function registerSocraticRoutes(router: Router, db: Database): void {
  /**
   * POST /api/socratic/analyze
   * Start a new Socratic analysis session.
   */
  router.post("/api/socratic/analyze", (req: Request, res: Response) => {
    try {
      const {
        action_description,
        action_type,
        affected_scope,
        user_original_prompt,
      } = req.body;

      // Validate required fields
      if (!action_description || typeof action_description !== "string") {
        res.status(400).json({ error: "action_description is required (string)" });
        return;
      }
      if (action_description.length < 10) {
        res.status(400).json({ error: "action_description must be at least 10 characters" });
        return;
      }
      if (!action_type || !ACTION_TYPES.includes(action_type)) {
        res.status(400).json({
          error: `action_type must be one of: ${ACTION_TYPES.join(", ")}`,
        });
        return;
      }
      if (!affected_scope || typeof affected_scope !== "string") {
        res.status(400).json({ error: "affected_scope is required (string)" });
        return;
      }

      const result = analyze(db, {
        actionDescription: action_description,
        actionType: action_type,
        affectedScope: affected_scope,
        userOriginalPrompt: user_original_prompt || "",
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: `Analysis failed: ${(err as Error).message}`,
      });
    }
  });

  /**
   * POST /api/socratic/verify
   * Submit answers and run META-OPERATOR verification.
   */
  router.post("/api/socratic/verify", (req: Request, res: Response) => {
    try {
      const { session_id, answers } = req.body;

      if (!session_id || typeof session_id !== "string") {
        res.status(400).json({ error: "session_id is required (string)" });
        return;
      }
      if (!answers || typeof answers !== "object") {
        res.status(400).json({ error: "answers is required (object)" });
        return;
      }

      const result = verify(db, {
        sessionId: session_id,
        answers,
      });

      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: `Verification failed: ${(err as Error).message}`,
      });
    }
  });

  /**
   * GET /api/socratic/status?session_id=xxx
   * Check current status of a Socratic session.
   */
  router.get("/api/socratic/status", (req: Request, res: Response) => {
    try {
      const sessionId = req.query.session_id as string;

      if (!sessionId) {
        res.status(400).json({ error: "session_id query parameter is required" });
        return;
      }

      const result = getStatus(db, sessionId);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: `Status check failed: ${(err as Error).message}`,
      });
    }
  });

  /**
   * POST /api/socratic/cleanup
   * Remove expired sessions.
   */
  router.post("/api/socratic/cleanup", (_req: Request, res: Response) => {
    try {
      const count = cleanExpiredSessions(db);
      res.json({ cleaned: count });
    } catch (err) {
      res.status(500).json({
        error: `Cleanup failed: ${(err as Error).message}`,
      });
    }
  });
}
