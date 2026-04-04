/**
 * CRUD operations for Socratic Reasoning Engine tables.
 * Follows the same pattern as Sessions.ts, Decisions.ts, etc.
 *
 * @module Socratic
 */

import type { Database } from "bun:sqlite";
import type {
  SocraticSessionRecord,
  SocraticAnswerRecord,
  SocraticQuestion,
} from "../socratic/SocraticTypes";
import { SESSION_TTL_MS } from "../socratic/SocraticTypes";

/* ── Session CRUD ────────────────────────────────────────── */

/**
 * Create a new Socratic analysis session.
 *
 * @param db - Database instance
 * @param input - Session creation data
 * @returns The generated session ID
 */
export function createSocraticSession(
  db: Database,
  input: {
    prompt: string;
    actionType: string;
    actionDescription: string;
    affectedScope: string;
    tier: string;
    recursionLevel?: number;
    parentQuestionId?: string | null;
  },
): string {
  const id = crypto.randomUUID();
  const now = Date.now();

  db.query(
    `INSERT INTO socratic_sessions
       (id, prompt, action_type, action_description, affected_scope,
        tier, status, recursion_level, parent_question_id, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, 'AWAITING_ANSWERS', ?, ?, ?, ?)`,
  ).run(
    id,
    input.prompt,
    input.actionType,
    input.actionDescription,
    input.affectedScope,
    input.tier,
    input.recursionLevel ?? 0,
    input.parentQuestionId ?? null,
    now,
    now + SESSION_TTL_MS,
  );

  return id;
}

/**
 * Get a Socratic session by ID.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns Session record or null
 */
export function getSocraticSession(
  db: Database,
  sessionId: string,
): SocraticSessionRecord | null {
  return db
    .query<SocraticSessionRecord, [string]>(
      "SELECT * FROM socratic_sessions WHERE id = ?",
    )
    .get(sessionId);
}

/**
 * Update a session's status.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @param status - New status
 * @param validatedAt - Timestamp when validated (optional)
 */
export function updateSessionStatus(
  db: Database,
  sessionId: string,
  status: string,
  validatedAt?: number,
): void {
  db.query(
    `UPDATE socratic_sessions SET status = ?, validated_at = ? WHERE id = ?`,
  ).run(status, validatedAt ?? null, sessionId);
}

/**
 * Check if a session is valid (not expired, exists).
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns true if session exists and hasn't expired
 */
export function isSessionValid(
  db: Database,
  sessionId: string,
): boolean {
  const session = getSocraticSession(db, sessionId);
  return session !== null && session.expires_at > Date.now();
}

/**
 * Get the most recent validated, non-expired session.
 *
 * @param db - Database instance
 * @returns The active session or null
 */
export function getActiveSession(
  db: Database,
): SocraticSessionRecord | null {
  return db
    .query<SocraticSessionRecord, [number]>(
      `SELECT * FROM socratic_sessions
       WHERE status = 'VALIDATED' AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(Date.now());
}

/* ── Answer CRUD ─────────────────────────────────────────── */

/**
 * Bulk insert question placeholders for a session.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @param questions - Questions to insert as blank answer rows
 */
export function insertSocraticQuestions(
  db: Database,
  sessionId: string,
  questions: SocraticQuestion[],
): void {
  const now = Date.now();
  const stmt = db.query(
    `INSERT INTO socratic_answers
       (session_id, question_id, dimension, operator, question, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  db.run("BEGIN TRANSACTION");
  try {
    for (const q of questions) {
      stmt.run(sessionId, q.id, q.dimension, q.operator, q.question, now);
    }
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}

/**
 * Update a single answer with response data.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @param questionId - Question ID
 * @param data - Answer data
 */
export function updateSocraticAnswer(
  db: Database,
  sessionId: string,
  questionId: string,
  data: {
    answer: string;
    confidence: string;
    evidence: string | null;
    atomicity: string;
    verifiedAt: number | null;
  },
): void {
  db.query(
    `UPDATE socratic_answers
     SET answer = ?, confidence = ?, evidence = ?, atomicity = ?, verified_at = ?
     WHERE session_id = ? AND question_id = ?`,
  ).run(
    data.answer,
    data.confidence,
    data.evidence,
    data.atomicity,
    data.verifiedAt,
    sessionId,
    questionId,
  );
}

/**
 * Get all answers for a session.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns Array of answer records
 */
export function getAnswersBySession(
  db: Database,
  sessionId: string,
): SocraticAnswerRecord[] {
  return db
    .query<SocraticAnswerRecord, [string]>(
      "SELECT * FROM socratic_answers WHERE session_id = ? ORDER BY id",
    )
    .all(sessionId);
}

/**
 * Get answer statistics for a session.
 *
 * @param db - Database instance
 * @param sessionId - Session ID
 * @returns Counts by confidence level
 */
export function getAnswerStats(
  db: Database,
  sessionId: string,
): { total: number; verified: number; assumptions: number; unknown: number } {
  const rows = db
    .query<{ confidence: string | null; cnt: number }, [string]>(
      `SELECT confidence, COUNT(*) as cnt
       FROM socratic_answers WHERE session_id = ?
       GROUP BY confidence`,
    )
    .all(sessionId);

  let total = 0;
  let verified = 0;
  let assumptions = 0;
  let unknown = 0;

  for (const row of rows) {
    total += row.cnt;
    if (row.confidence === "KSERO") verified += row.cnt;
    else if (row.confidence === "YPOTHETO") assumptions += row.cnt;
    else unknown += row.cnt; // DEN_KSERO or NULL
  }

  return { total, verified, assumptions, unknown };
}

/**
 * Delete expired sessions and their answers.
 *
 * @param db - Database instance
 * @returns Number of sessions cleaned up
 */
export function cleanExpiredSessions(db: Database): number {
  const now = Date.now();

  const expired = db
    .query<{ id: string }, [number]>(
      "SELECT id FROM socratic_sessions WHERE expires_at < ?",
    )
    .all(now);

  if (expired.length === 0) return 0;

  db.run("BEGIN TRANSACTION");
  try {
    for (const { id } of expired) {
      db.query("DELETE FROM socratic_answers WHERE session_id = ?").run(id);
      db.query("DELETE FROM socratic_sessions WHERE id = ?").run(id);
    }
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }

  return expired.length;
}
