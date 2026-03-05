/**
 * Tests for ValidatorEngine — orchestrates all validation checkers.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { validateProject } from "./ValidatorEngine";

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "validator-engine-"));
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

describe("validateProject", () => {
  test("empty directory gets baseline violations and reduced score", () => {
    const report = validateProject(testDir);
    // BaselineChecker flags missing README, tests, linter, CI, gitignore
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.overallScore).toBeLessThan(100);
    expect(report.scanCoverage).toBe("none");
  });

  test("nonexistent directory returns baseline violations", () => {
    const fakePath = join(testDir, "does-not-exist");
    const report = validateProject(fakePath);
    expect(report.violations.length).toBeGreaterThan(0);
    expect(report.overallScore).toBeLessThan(100);
  });

  test("report has all required fields", () => {
    const report = validateProject(testDir);
    expect(typeof report.overallScore).toBe("number");
    expect(typeof report.scoresByCategory).toBe("object");
    expect(typeof report.totalFeatures).toBe("number");
    expect(typeof report.totalFiles).toBe("number");
    expect(Array.isArray(report.violations)).toBe(true);
    expect(Array.isArray(report.featureMap)).toBe(true);
    expect(typeof report.trend).toBe("string");
    expect(typeof report.timestamp).toBe("number");
  });

  test("category filter: only security produces no structure/dependency violations", () => {
    const report = validateProject(testDir, { categories: ["security"] });
    const nonSecurity = report.violations.filter(
      (v) => v.category === "structure" || v.category === "dependency"
    );
    expect(nonSecurity).toEqual([]);
  });

  test("severity filter: warning excludes info violations", () => {
    const report = validateProject(testDir, { severity: "warning" });
    const infoViolations = report.violations.filter(
      (v) => v.severity === "info"
    );
    expect(infoViolations).toEqual([]);
  });

  test("timestamp is set to a recent value", () => {
    const before = Date.now();
    const report = validateProject(testDir);
    const after = Date.now();
    expect(report.timestamp).toBeGreaterThanOrEqual(before);
    expect(report.timestamp).toBeLessThanOrEqual(after);
  });
});
