/**
 * Tests for Database, Projects, Decisions, Violations, Compliance, and Improvements.
 * Uses an in-memory SQLite database for isolation.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { runMigrations } from "./migrations";
import { upsertProject, findProjectByPath, findProjectById, listProjects } from "./Projects";
import { createDecision, getDecision, searchDecisions, getRecentDecisions, updateDecisionStatus } from "./Decisions";
import { createViolation, getOpenViolations, resolveViolation, getViolationCounts, searchViolations } from "./Violations";
import { startSession, completeSession, getSession, getRecentSessions, countSessions } from "./Sessions";
import { saveSnapshot, getLatestSnapshot, getScoreHistory, getComplianceTrend } from "./Compliance";
import { trackViolation, trackResolution, getRuleMetrics, createSuggestion, getPendingSuggestions } from "./Improvements";

let db: Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  runMigrations(db);
});

describe("migrations", () => {
  test("should create all 8 tables", () => {
    const tables = db
      .query<{ name: string }, []>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations' ORDER BY name"
      )
      .all()
      .map((r) => r.name);

    expect(tables).toContain("projects");
    expect(tables).toContain("decisions");
    expect(tables).toContain("violations");
    expect(tables).toContain("sessions");
    expect(tables).toContain("structural_changes");
    expect(tables).toContain("rule_metrics");
    expect(tables).toContain("improvement_suggestions");
    expect(tables).toContain("compliance_snapshots");
  });

  test("should be idempotent (run twice without error)", () => {
    expect(() => runMigrations(db)).not.toThrow();
  });
});

describe("Projects", () => {
  test("should create and find a project by path", () => {
    upsertProject(db, { id: "p1", name: "Test", path: "/test/project" });
    const found = findProjectByPath(db, "/test/project");
    expect(found).not.toBeNull();
    expect(found!.name).toBe("Test");
    expect(found!.id).toBe("p1");
  });

  test("should find a project by ID", () => {
    upsertProject(db, { id: "p2", name: "Another", path: "/another" });
    const found = findProjectById(db, "p2");
    expect(found).not.toBeNull();
    expect(found!.path).toBe("/another");
  });

  test("should update existing project on upsert", () => {
    upsertProject(db, { id: "p1", name: "Old Name", path: "/test" });
    upsertProject(db, { id: "p1-new", name: "New Name", path: "/test" });
    const found = findProjectByPath(db, "/test");
    expect(found!.name).toBe("New Name");
  });

  test("should list all projects", () => {
    upsertProject(db, { id: "p1", name: "A", path: "/a" });
    upsertProject(db, { id: "p2", name: "B", path: "/b" });
    const all = listProjects(db);
    expect(all.length).toBe(2);
  });

  test("should return null for non-existent project", () => {
    expect(findProjectByPath(db, "/nonexistent")).toBeNull();
    expect(findProjectById(db, "nonexistent")).toBeNull();
  });
});

describe("Decisions", () => {
  beforeEach(() => {
    upsertProject(db, { id: "p1", name: "Test", path: "/test" });
  });

  test("should create and retrieve a decision", () => {
    const id = createDecision(db, {
      projectId: "p1",
      title: "Use PostgreSQL",
      decision: "We will use PostgreSQL for the database",
      context: "Need a relational database",
    });
    expect(id).toBeGreaterThan(0);

    const decision = getDecision(db, id);
    expect(decision).not.toBeNull();
    expect(decision!.title).toBe("Use PostgreSQL");
    expect(decision!.status).toBe("accepted");
  });

  test("should search decisions by query", () => {
    createDecision(db, { projectId: "p1", title: "Use PostgreSQL", decision: "Postgres" });
    createDecision(db, { projectId: "p1", title: "Use Redis", decision: "Redis for caching" });

    const results = searchDecisions(db, "p1", { query: "Redis" });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Use Redis");
  });

  test("should get recent decisions limited by count", () => {
    createDecision(db, { projectId: "p1", title: "First", decision: "d1" });
    createDecision(db, { projectId: "p1", title: "Second", decision: "d2" });
    createDecision(db, { projectId: "p1", title: "Third", decision: "d3" });

    const recent = getRecentDecisions(db, "p1", 2);
    expect(recent.length).toBe(2);
  });

  test("should update decision status", () => {
    const id = createDecision(db, { projectId: "p1", title: "Old", decision: "old" });
    updateDecisionStatus(db, id, "deprecated");
    const decision = getDecision(db, id);
    expect(decision!.status).toBe("deprecated");
  });
});

describe("Violations", () => {
  beforeEach(() => {
    upsertProject(db, { id: "p1", name: "Test", path: "/test" });
  });

  test("should create and retrieve violations", () => {
    const id = createViolation(db, {
      projectId: "p1",
      ruleId: "01-architecture",
      ruleName: "Dependency Direction",
      severity: "critical",
      category: "dependency",
      description: "Domain imports infrastructure",
      filePath: "src/domain/user.ts",
      lineNumber: 5,
    });
    expect(id).toBeGreaterThan(0);

    const violations = getOpenViolations(db, "p1");
    expect(violations.length).toBe(1);
    expect(violations[0].severity).toBe("critical");
  });

  test("should resolve violations", () => {
    const id = createViolation(db, {
      projectId: "p1",
      ruleId: "02-security",
      ruleName: "Hardcoded Secret",
      severity: "critical",
      category: "security",
      description: "API key in source",
    });

    resolveViolation(db, id, "manual");

    const open = getOpenViolations(db, "p1");
    expect(open.length).toBe(0);
  });

  test("should count violations by severity", () => {
    createViolation(db, { projectId: "p1", ruleId: "r1", ruleName: "R1", severity: "critical", category: "security", description: "d1" });
    createViolation(db, { projectId: "p1", ruleId: "r2", ruleName: "R2", severity: "warning", category: "quality", description: "d2" });
    createViolation(db, { projectId: "p1", ruleId: "r3", ruleName: "R3", severity: "warning", category: "quality", description: "d3" });

    const counts = getViolationCounts(db, "p1");
    expect(counts.critical).toBe(1);
    expect(counts.warning).toBe(2);
    expect(counts.info).toBe(0);
  });

  test("should search violations", () => {
    createViolation(db, { projectId: "p1", ruleId: "r1", ruleName: "R1", severity: "critical", category: "security", description: "SQL injection risk" });
    createViolation(db, { projectId: "p1", ruleId: "r2", ruleName: "R2", severity: "info", category: "quality", description: "File too long" });

    const results = searchViolations(db, "p1", { query: "SQL" });
    expect(results.length).toBe(1);
    expect(results[0].description).toContain("SQL");
  });

  test("should order open violations by severity", () => {
    createViolation(db, { projectId: "p1", ruleId: "r1", ruleName: "R1", severity: "info", category: "docs", description: "d1" });
    createViolation(db, { projectId: "p1", ruleId: "r2", ruleName: "R2", severity: "critical", category: "security", description: "d2" });
    createViolation(db, { projectId: "p1", ruleId: "r3", ruleName: "R3", severity: "warning", category: "quality", description: "d3" });

    const violations = getOpenViolations(db, "p1");
    expect(violations[0].severity).toBe("critical");
    expect(violations[1].severity).toBe("warning");
    expect(violations[2].severity).toBe("info");
  });
});

describe("Sessions", () => {
  beforeEach(() => {
    upsertProject(db, { id: "p1", name: "Test", path: "/test" });
  });

  test("should start and complete a session", () => {
    startSession(db, "s1", "p1", 85);
    const session = getSession(db, "s1");
    expect(session).not.toBeNull();
    expect(session!.compliance_score_before).toBe(85);

    completeSession(db, "s1", {
      summary: "Added auth feature",
      violationsFound: 3,
      complianceScoreAfter: 78,
    });

    const completed = getSession(db, "s1");
    expect(completed!.summary).toBe("Added auth feature");
    expect(completed!.compliance_score_after).toBe(78);
  });

  test("should count sessions", () => {
    startSession(db, "s1", "p1");
    startSession(db, "s2", "p1");
    expect(countSessions(db, "p1")).toBe(2);
  });

  test("should get recent sessions", () => {
    startSession(db, "s1", "p1");
    startSession(db, "s2", "p1");
    startSession(db, "s3", "p1");

    const recent = getRecentSessions(db, "p1", 2);
    expect(recent.length).toBe(2);
  });
});

describe("Compliance", () => {
  beforeEach(() => {
    upsertProject(db, { id: "p1", name: "Test", path: "/test" });
  });

  test("should save and retrieve snapshots", () => {
    const id = saveSnapshot(db, {
      projectId: "p1",
      overallScore: 85,
      scoresByCategory: { dependency: 90, security: 80, quality: 85, docs: 90 },
      totalFeatures: 5,
      totalFiles: 50,
      totalViolations: 3,
      violationsBySeverity: { critical: 0, warning: 2, info: 1 },
      violationsByRule: { "01-architecture": 2, "15-code-style": 1 },
    });
    expect(id).toBeGreaterThan(0);

    const latest = getLatestSnapshot(db, "p1");
    expect(latest).not.toBeNull();
    expect(latest!.overall_score).toBe(85);
  });

  test("should get score history", () => {
    saveSnapshot(db, { projectId: "p1", overallScore: 70, scoresByCategory: {}, totalFeatures: 0, totalFiles: 0, totalViolations: 5, violationsBySeverity: {}, violationsByRule: {} });
    saveSnapshot(db, { projectId: "p1", overallScore: 80, scoresByCategory: {}, totalFeatures: 0, totalFiles: 0, totalViolations: 3, violationsBySeverity: {}, violationsByRule: {} });
    saveSnapshot(db, { projectId: "p1", overallScore: 90, scoresByCategory: {}, totalFeatures: 0, totalFiles: 0, totalViolations: 1, violationsBySeverity: {}, violationsByRule: {} });

    const history = getScoreHistory(db, "p1");
    expect(history.length).toBe(3);
    // All scores should be present
    const scores = history.map((h) => h.overall_score).sort();
    expect(scores).toEqual([70, 80, 90]);
  });

  test("should detect improving trend", () => {
    // Insert with explicit created_at spacing via raw SQL
    db.query(
      "INSERT INTO compliance_snapshots (project_id, overall_score, scores_by_category, total_features, total_files, total_violations, violations_by_severity, violations_by_rule, created_at) VALUES (?, ?, '{}', 0, 0, 0, '{}', '{}', ?)"
    ).run("p1", 60, 1000);
    db.query(
      "INSERT INTO compliance_snapshots (project_id, overall_score, scores_by_category, total_features, total_files, total_violations, violations_by_severity, violations_by_rule, created_at) VALUES (?, ?, '{}', 0, 0, 0, '{}', '{}', ?)"
    ).run("p1", 70, 2000);
    db.query(
      "INSERT INTO compliance_snapshots (project_id, overall_score, scores_by_category, total_features, total_files, total_violations, violations_by_severity, violations_by_rule, created_at) VALUES (?, ?, '{}', 0, 0, 0, '{}', '{}', ?)"
    ).run("p1", 80, 3000);

    expect(getComplianceTrend(db, "p1")).toBe("improving");
  });

  test("should detect declining trend", () => {
    db.query(
      "INSERT INTO compliance_snapshots (project_id, overall_score, scores_by_category, total_features, total_files, total_violations, violations_by_severity, violations_by_rule, created_at) VALUES (?, ?, '{}', 0, 0, 0, '{}', '{}', ?)"
    ).run("p1", 90, 1000);
    db.query(
      "INSERT INTO compliance_snapshots (project_id, overall_score, scores_by_category, total_features, total_files, total_violations, violations_by_severity, violations_by_rule, created_at) VALUES (?, ?, '{}', 0, 0, 0, '{}', '{}', ?)"
    ).run("p1", 80, 2000);
    db.query(
      "INSERT INTO compliance_snapshots (project_id, overall_score, scores_by_category, total_features, total_files, total_violations, violations_by_severity, violations_by_rule, created_at) VALUES (?, ?, '{}', 0, 0, 0, '{}', '{}', ?)"
    ).run("p1", 70, 3000);

    expect(getComplianceTrend(db, "p1")).toBe("declining");
  });

  test("should detect stable trend", () => {
    db.query(
      "INSERT INTO compliance_snapshots (project_id, overall_score, scores_by_category, total_features, total_files, total_violations, violations_by_severity, violations_by_rule, created_at) VALUES (?, ?, '{}', 0, 0, 0, '{}', '{}', ?)"
    ).run("p1", 85, 1000);
    db.query(
      "INSERT INTO compliance_snapshots (project_id, overall_score, scores_by_category, total_features, total_files, total_violations, violations_by_severity, violations_by_rule, created_at) VALUES (?, ?, '{}', 0, 0, 0, '{}', '{}', ?)"
    ).run("p1", 86, 2000);

    expect(getComplianceTrend(db, "p1")).toBe("stable");
  });
});

describe("Improvements", () => {
  beforeEach(() => {
    upsertProject(db, { id: "p1", name: "Test", path: "/test" });
  });

  test("should track violation metrics", () => {
    trackViolation(db, "01-architecture", "p1");
    trackViolation(db, "01-architecture", "p1");
    trackViolation(db, "02-security", "p1");

    const metrics = getRuleMetrics(db, "p1");
    expect(metrics.length).toBe(2);

    const archMetric = metrics.find((m) => m.rule_id === "01-architecture");
    expect(archMetric!.total_violations).toBe(2);
  });

  test("should track resolutions", () => {
    trackViolation(db, "01-architecture", "p1");
    trackResolution(db, "01-architecture", 5000, "p1");

    const metrics = getRuleMetrics(db, "p1");
    const metric = metrics.find((m) => m.rule_id === "01-architecture");
    expect(metric!.resolved_violations).toBe(1);
    expect(metric!.avg_resolution_time_ms).toBe(5000);
  });

  test("should create and retrieve suggestions", () => {
    const id = createSuggestion(db, {
      projectId: "p1",
      ruleId: "01-architecture",
      suggestionType: "relax",
      title: "Relax dependency rule",
      reasoning: "Too many violations",
    });
    expect(id).toBeGreaterThan(0);

    const suggestions = getPendingSuggestions(db, "p1");
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].title).toBe("Relax dependency rule");
  });
});
