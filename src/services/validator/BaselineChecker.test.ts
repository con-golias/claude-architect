/**
 * Tests for BaselineChecker — project-level quality signals.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { checkBaseline } from "./BaselineChecker";

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "baseline-checker-"));
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("checkBaseline", () => {
  test("flags missing README", () => {
    const result = checkBaseline(testDir);
    const readme = result.violations.find((v) => v.description.includes("README"));
    expect(readme).toBeTruthy();
    expect(readme!.severity).toBe("warning");
  });

  test("does not flag if README.md exists", () => {
    writeFileSync(join(testDir, "README.md"), "# My Project");
    const result = checkBaseline(testDir);
    const readme = result.violations.find((v) => v.description.includes("README"));
    expect(readme).toBeUndefined();
  });

  test("flags zero test files in project", () => {
    const result = checkBaseline(testDir);
    const tests = result.violations.find((v) => v.description.includes("test files"));
    expect(tests).toBeTruthy();
    expect(tests!.severity).toBe("warning");
  });

  test("does not flag when test files exist", () => {
    mkdirSync(join(testDir, "src"), { recursive: true });
    writeFileSync(join(testDir, "src", "app.test.ts"), "test('works', () => {})");
    const result = checkBaseline(testDir);
    const tests = result.violations.find((v) => v.description.includes("test files"));
    expect(tests).toBeUndefined();
  });

  test("flags missing linter config", () => {
    const result = checkBaseline(testDir);
    const linter = result.violations.find((v) => v.description.includes("linter"));
    expect(linter).toBeTruthy();
    expect(linter!.severity).toBe("info");
  });

  test("does not flag if eslint config exists", () => {
    writeFileSync(join(testDir, ".eslintrc.json"), "{}");
    const result = checkBaseline(testDir);
    const linter = result.violations.find((v) => v.description.includes("linter"));
    expect(linter).toBeUndefined();
  });

  test("flags package.json without test script", () => {
    writeFileSync(join(testDir, "package.json"), JSON.stringify({ scripts: {} }));
    const result = checkBaseline(testDir);
    const script = result.violations.find((v) => v.description.includes("test script"));
    expect(script).toBeTruthy();
  });

  test("does not flag package.json with test script", () => {
    writeFileSync(join(testDir, "package.json"), JSON.stringify({ scripts: { test: "jest" } }));
    const result = checkBaseline(testDir);
    const script = result.violations.find((v) => v.description.includes("test script"));
    expect(script).toBeUndefined();
  });

  test("flags missing .gitignore when .git exists", () => {
    mkdirSync(join(testDir, ".git"), { recursive: true });
    const result = checkBaseline(testDir);
    const gi = result.violations.find((v) => v.description.includes(".gitignore"));
    expect(gi).toBeTruthy();
  });

  test("does not flag .gitignore when no .git", () => {
    const result = checkBaseline(testDir);
    const gi = result.violations.find((v) => v.description.includes(".gitignore"));
    expect(gi).toBeUndefined();
  });
});
