/**
 * Tests for the SelfImprover analysis engine.
 * Validates suggestion patterns: relax, add (auto-fix), remove, and deduplication.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "../sqlite/migrations";
import { upsertProject } from "../sqlite/Projects";
import { startSession } from "../sqlite/Sessions";
import { trackViolation, trackResolution, getPendingSuggestions } from "../sqlite/Improvements";
import { analyzeAndSuggest } from "./SelfImprover";

let db: Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  runMigrations(db);
});

describe("SelfImprover", () => {
  const PROJECT_ID = "proj-1";

  beforeEach(() => {
    upsertProject(db, { id: PROJECT_ID, name: "TestApp", path: "/test/app" });
  });

  test("below minimum sessions returns empty suggestions", () => {
    startSession(db, "s1", PROJECT_ID);
    startSession(db, "s2", PROJECT_ID);

    const result = analyzeAndSuggest(db, PROJECT_ID, 5);

    expect(result.suggestions).toEqual([]);
    expect(result.analysisMetadata.totalSessions).toBe(2);
    expect(result.analysisMetadata.totalRules).toBe(0);
  });

  test("relax suggestion for frequently ignored rules", () => {
    for (let i = 0; i < 5; i++) startSession(db, `s${i}`, PROJECT_ID);

    const ruleId = "01-architecture";
    for (let i = 0; i < 20; i++) trackViolation(db, ruleId, PROJECT_ID);
    db.run("UPDATE rule_metrics SET ignored_violations = ? WHERE rule_id = ?", [15, ruleId]);

    const result = analyzeAndSuggest(db, PROJECT_ID);
    const relax = result.suggestions.find((s) => s.type === "relax" && s.ruleId === ruleId);

    expect(relax).toBeDefined();
    expect(relax!.title).toContain(ruleId);
    expect((relax!.evidence as { ignoreRate: number }).ignoreRate).toBe(75);
  });

  test("auto-fix suggestion for fast-resolved rules", () => {
    for (let i = 0; i < 5; i++) startSession(db, `s${i}`, PROJECT_ID);

    const ruleId = "02-security";
    for (let i = 0; i < 10; i++) trackViolation(db, ruleId, PROJECT_ID);
    for (let i = 0; i < 6; i++) trackResolution(db, ruleId, 60000, PROJECT_ID);

    const result = analyzeAndSuggest(db, PROJECT_ID);
    const autoFix = result.suggestions.find((s) => s.type === "add" && s.ruleId === ruleId);

    expect(autoFix).toBeDefined();
    expect(autoFix!.title).toContain("Auto-fix");
    expect((autoFix!.evidence as { resolvedCount: number }).resolvedCount).toBe(6);
  });

  test("zero-violation rule detection suggests removal", () => {
    for (let i = 0; i < 5; i++) startSession(db, `s${i}`, PROJECT_ID);

    const result = analyzeAndSuggest(db, PROJECT_ID);
    const removals = result.suggestions.filter((s) => s.type === "remove");

    expect(removals.length).toBeGreaterThan(0);
    for (const r of removals) {
      expect(r.title).toContain("never triggered");
      expect((r.evidence as { totalViolations: number }).totalViolations).toBe(0);
    }
  });

  test("deduplication prevents duplicate suggestions in database", () => {
    for (let i = 0; i < 5; i++) startSession(db, `s${i}`, PROJECT_ID);

    const ruleId = "03-testing";
    for (let i = 0; i < 20; i++) trackViolation(db, ruleId, PROJECT_ID);
    db.run("UPDATE rule_metrics SET ignored_violations = ? WHERE rule_id = ?", [15, ruleId]);

    analyzeAndSuggest(db, PROJECT_ID);
    const firstRun = getPendingSuggestions(db, PROJECT_ID);

    analyzeAndSuggest(db, PROJECT_ID);
    const secondRun = getPendingSuggestions(db, PROJECT_ID);

    expect(secondRun.length).toBe(firstRun.length);
  });
});
