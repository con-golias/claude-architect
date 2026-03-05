/**
 * Tests for ComplianceScorer — compliance score calculation.
 */

import { describe, test, expect } from "bun:test";
import {
  calculateOverallScore,
  calculateCategoryScores,
  countBySeverity,
  countByRule,
} from "./ComplianceScorer";
import type { Violation } from "../../types/validation";

function makeViolation(
  overrides: Partial<Violation> = {}
): Violation {
  return {
    ruleId: "01-architecture",
    ruleName: "Test Rule",
    severity: "warning",
    category: "dependency",
    description: "Test violation",
    ...overrides,
  };
}

describe("calculateOverallScore", () => {
  test("should return 100 for zero violations (no filesScanned param)", () => {
    expect(calculateOverallScore([])).toBe(100);
  });

  test("should return 50 when zero files scanned and zero violations", () => {
    expect(calculateOverallScore([], 0)).toBe(50);
  });

  test("should return 100 when files scanned and zero violations", () => {
    expect(calculateOverallScore([], 10)).toBe(100);
  });

  test("should reduce score for critical violations", () => {
    const violations = [makeViolation({ severity: "critical", category: "security" })];
    const score = calculateOverallScore(violations);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test("should reduce score more for critical than warning", () => {
    const critical = [makeViolation({ severity: "critical", category: "security" })];
    const warning = [makeViolation({ severity: "warning", category: "security" })];
    expect(calculateOverallScore(critical)).toBeLessThan(calculateOverallScore(warning));
  });

  test("should reduce score more for warning than info", () => {
    const warning = [makeViolation({ severity: "warning", category: "quality" })];
    const info = [makeViolation({ severity: "info", category: "quality" })];
    expect(calculateOverallScore(warning)).toBeLessThan(calculateOverallScore(info));
  });

  test("should never go below 0", () => {
    const many = Array.from({ length: 100 }, () =>
      makeViolation({ severity: "critical", category: "security" })
    );
    expect(calculateOverallScore(many)).toBe(0);
  });

  test("should apply category weights", () => {
    const security = [makeViolation({ severity: "warning", category: "security" })];
    const docs = [makeViolation({ severity: "warning", category: "docs" })];
    // Security weight (0.25) > docs weight (0.10), so security violation has more impact
    expect(calculateOverallScore(security)).toBeLessThan(calculateOverallScore(docs));
  });
});

describe("calculateCategoryScores", () => {
  test("should return 100 for all categories with no violations", () => {
    const scores = calculateCategoryScores([]);
    expect(scores.dependency).toBe(100);
    expect(scores.security).toBe(100);
    expect(scores.quality).toBe(100);
    expect(scores.docs).toBe(100);
  });

  test("should reduce only affected category", () => {
    const violations = [makeViolation({ category: "security", severity: "critical" })];
    const scores = calculateCategoryScores(violations);
    expect(scores.security).toBeLessThan(100);
    expect(scores.dependency).toBe(100);
    expect(scores.quality).toBe(100);
  });

  test("should never go below 0 per category", () => {
    const many = Array.from({ length: 50 }, () =>
      makeViolation({ severity: "critical", category: "security" })
    );
    const scores = calculateCategoryScores(many);
    expect(scores.security).toBe(0);
  });
});

describe("countBySeverity", () => {
  test("should return zeros for no violations", () => {
    const counts = countBySeverity([]);
    expect(counts).toEqual({ critical: 0, warning: 0, info: 0 });
  });

  test("should count correctly by severity", () => {
    const violations = [
      makeViolation({ severity: "critical" }),
      makeViolation({ severity: "critical" }),
      makeViolation({ severity: "warning" }),
      makeViolation({ severity: "info" }),
      makeViolation({ severity: "info" }),
      makeViolation({ severity: "info" }),
    ];
    const counts = countBySeverity(violations);
    expect(counts.critical).toBe(2);
    expect(counts.warning).toBe(1);
    expect(counts.info).toBe(3);
  });
});

describe("countByRule", () => {
  test("should return empty object for no violations", () => {
    expect(countByRule([])).toEqual({});
  });

  test("should count correctly by rule ID", () => {
    const violations = [
      makeViolation({ ruleId: "01-architecture" }),
      makeViolation({ ruleId: "01-architecture" }),
      makeViolation({ ruleId: "02-security" }),
    ];
    const counts = countByRule(violations);
    expect(counts["01-architecture"]).toBe(2);
    expect(counts["02-security"]).toBe(1);
  });
});
