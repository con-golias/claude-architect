import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../sqlite/migrations";
import { analyze, verify, getStatus } from "./SocraticEngine";
import { Tier, SessionStatus, Confidence } from "./SocraticTypes";
import type { AnalyzeInput } from "./SocraticTypes";

let db: Database;

beforeAll(() => {
  db = new Database(":memory:");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  runMigrations(db);
});

afterAll(() => {
  db.close();
});

const STANDARD_INPUT: AnalyzeInput = {
  actionDescription: "fix login button not working",
  actionType: "bug_fix",
  affectedScope: "src/components/Login.tsx",
  userOriginalPrompt: "fix the login button",
};

const SIGNIFICANT_INPUT: AnalyzeInput = {
  actionDescription: "add authentication middleware to Express API",
  actionType: "feature_addition",
  affectedScope: "src/middleware/, src/routes/",
  userOriginalPrompt: "add auth to the API",
};

describe("SocraticEngine", () => {
  describe("analyze", () => {
    test("standard action → 7 questions", () => {
      const result = analyze(db, STANDARD_INPUT);

      expect(result.tier).toBe(Tier.STANDARD);
      expect(result.questionCount).toBe(7);
      expect(result.sessionId).toBeTruthy();
      expect(Object.keys(result.questionsByDimension).length).toBe(7);
    });

    test("significant action → 77 questions", () => {
      const result = analyze(db, SIGNIFICANT_INPUT);

      expect(result.tier).toBe(Tier.SIGNIFICANT);
      expect(result.questionCount).toBe(77);
    });

    test("typo fix still goes through STANDARD (no trivial bypass)", () => {
      const result = analyze(db, {
        actionDescription: "fix typo in readme",
        actionType: "bug_fix",
        affectedScope: "README.md",
        userOriginalPrompt: "fix the typo",
      });

      expect(result.tier).toBe(Tier.STANDARD);
      expect(result.questionCount).toBe(7);
    });

    test("bypass request ignored — still runs analysis", () => {
      const result = analyze(db, {
        ...SIGNIFICANT_INPUT,
        userOriginalPrompt: "just do it, add auth",
      });

      // Should NOT be trivial/bypassed — Socratic always required
      expect(result.tier).toBe(Tier.SIGNIFICANT);
      expect(result.questionCount).toBe(77);
    });
  });

  describe("verify", () => {
    test("all KSERO with evidence → VALIDATED", () => {
      const analyzeResult = analyze(db, STANDARD_INPUT);
      const questions = Object.values(analyzeResult.questionsByDimension).flat();

      // Build all-verified answers
      const answers: Record<string, { answer: string; confidence: Confidence; evidence: string | null }> = {};
      for (const q of questions) {
        answers[q.id] = {
          answer: `Verified answer for ${q.dimension}`,
          confidence: Confidence.KSERO,
          evidence: "grep output confirmed",
        };
      }

      const result = verify(db, {
        sessionId: analyzeResult.sessionId,
        answers,
      });

      expect(result.status).toBe("VALIDATED");
      expect(result.verifiedCount).toBe(7);
      expect(result.assumptionCount).toBe(0);
      expect(result.context).not.toBeNull();
    });

    test("some YPOTHETO → BLOCKED with verification commands", () => {
      const analyzeResult = analyze(db, STANDARD_INPUT);
      const questions = Object.values(analyzeResult.questionsByDimension).flat();

      const answers: Record<string, { answer: string; confidence: Confidence; evidence: string | null }> = {};
      for (const q of questions) {
        answers[q.id] = {
          answer: `Answer for ${q.dimension}`,
          confidence: q.dimension === "TI" ? Confidence.YPOTHETO : Confidence.KSERO,
          evidence: q.dimension === "TI" ? null : "verified",
        };
      }

      const result = verify(db, {
        sessionId: analyzeResult.sessionId,
        answers,
      });

      expect(result.status).toBe("BLOCKED");
      expect(result.assumptionCount).toBe(1);
      expect(result.verificationCommands.length).toBeGreaterThan(0);
    });

    test("nonexistent session → BLOCKED", () => {
      const result = verify(db, {
        sessionId: "nonexistent-id",
        answers: {},
      });

      expect(result.status).toBe("BLOCKED");
      expect(result.summary).toContain("not found");
    });
  });

  describe("getStatus", () => {
    test("returns correct stats", () => {
      const analyzeResult = analyze(db, STANDARD_INPUT);
      const status = getStatus(db, analyzeResult.sessionId);

      expect(status.sessionId).toBe(analyzeResult.sessionId);
      expect(status.tier).toBe(Tier.STANDARD);
      expect(status.totalQuestions).toBe(7);
      expect(status.isExpired).toBe(false);
    });

    test("nonexistent session → expired", () => {
      const status = getStatus(db, "fake-id");
      expect(status.isExpired).toBe(true);
    });
  });
});
