import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../sqlite/migrations";
import { extractContext } from "./SocraticBridge";
import {
  createSocraticSession,
  insertSocraticQuestions,
  updateSocraticAnswer,
  updateSessionStatus,
} from "../sqlite/Socratic";
import type { SocraticQuestion } from "./SocraticTypes";

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

function seedSession(answers: Array<{
  dimension: string;
  operator: string;
  answer: string;
}>): string {
  const sessionId = createSocraticSession(db, {
    prompt: "test prompt",
    actionType: "feature_addition",
    actionDescription: "test feature",
    affectedScope: "src/",
    tier: "SIGNIFICANT",
  });

  const questions: SocraticQuestion[] = answers.map((a, i) => ({
    id: `${a.dimension}-${a.operator}`,
    dimension: a.dimension as any,
    operator: a.operator as any,
    template: "test",
    question: `test question ${i}`,
  }));

  insertSocraticQuestions(db, sessionId, questions);

  for (const a of answers) {
    updateSocraticAnswer(db, sessionId, `${a.dimension}-${a.operator}`, {
      answer: a.answer,
      confidence: "KSERO",
      evidence: "verified by test",
      atomicity: "ATOMIC",
      verifiedAt: Date.now(),
    });
  }

  updateSessionStatus(db, sessionId, "VALIDATED", Date.now());
  return sessionId;
}

describe("SocraticBridge", () => {
  describe("extractContext", () => {
    test("extracts language from APO_TI×EINAI (TypeScript)", () => {
      const sessionId = seedSession([
        { dimension: "APO_TI", operator: "EINAI", answer: "TypeScript, Express, Bun" },
      ]);
      const ctx = extractContext(db, sessionId);

      expect(ctx.language).toBe("TypeScript");
      expect(ctx.technologies).toContain("TypeScript");
      expect(ctx.technologies).toContain("Express");
    });

    test("extracts language from APO_TI×EINAI (Python)", () => {
      const sessionId = seedSession([
        { dimension: "APO_TI", operator: "EINAI", answer: "Python, Django, PostgreSQL" },
      ]);
      const ctx = extractContext(db, sessionId);

      expect(ctx.language).toBe("Python");
      expect(ctx.framework).toBe("Django");
    });

    test("extracts framework from technologies", () => {
      const sessionId = seedSession([
        { dimension: "APO_TI", operator: "EINAI", answer: "React, Tailwind, Next.js" },
      ]);
      const ctx = extractContext(db, sessionId);

      expect(ctx.framework).toBe("React");
    });

    test("detects clean-arch project structure", () => {
      const sessionId = seedSession([
        { dimension: "POU", operator: "EINAI", answer: "src/domain/, src/application/, src/infrastructure/" },
      ]);
      const ctx = extractContext(db, sessionId);

      expect(ctx.projectStructure).toBe("clean-arch");
      expect(ctx.directories.length).toBeGreaterThan(0);
    });

    test("detects feature-first project structure", () => {
      const sessionId = seedSession([
        { dimension: "POU", operator: "EINAI", answer: "src/features/auth/, src/features/payments/" },
      ]);
      const ctx = extractContext(db, sessionId);

      expect(ctx.projectStructure).toBe("feature-first");
    });

    test("extracts patterns from POS×MOIAZEI", () => {
      const sessionId = seedSession([
        { dimension: "POS", operator: "MOIAZEI", answer: "factory pattern, singleton" },
      ]);
      const ctx = extractContext(db, sessionId);

      expect(ctx.patterns).toContain("factory pattern");
      expect(ctx.patterns).toContain("singleton");
    });

    test("extracts constraints from TI×DEN_PREPEI", () => {
      const sessionId = seedSession([
        { dimension: "TI", operator: "DEN_PREPEI", answer: "No !important in CSS" },
        { dimension: "TI", operator: "PREPEI", answer: "WCAG AA compliance required" },
      ]);
      const ctx = extractContext(db, sessionId);

      expect(ctx.constraints).toContain("No !important in CSS");
      expect(ctx.constraints).toContain("WCAG AA compliance required");
    });

    test("extracts file paths from POU dimension", () => {
      const sessionId = seedSession([
        { dimension: "POU", operator: "PREPEI", answer: "src/server/middleware/auth.ts" },
      ]);
      const ctx = extractContext(db, sessionId);

      expect(ctx.filePaths).toContain("src/server/middleware/auth.ts");
    });

    test("returns null language when no tech info", () => {
      const sessionId = seedSession([
        { dimension: "TI", operator: "EINAI", answer: "A login form" },
      ]);
      const ctx = extractContext(db, sessionId);

      expect(ctx.language).toBeNull();
      expect(ctx.framework).toBeNull();
    });

    test("builds verified facts map", () => {
      const sessionId = seedSession([
        { dimension: "TI", operator: "EINAI", answer: "Authentication middleware" },
        { dimension: "GIATI", operator: "EINAI", answer: "Security requirement" },
      ]);
      const ctx = extractContext(db, sessionId);

      expect(ctx.verifiedFacts["TI-EINAI"]).toBe("Authentication middleware");
      expect(ctx.verifiedFacts["GIATI-EINAI"]).toBe("Security requirement");
    });
  });
});
