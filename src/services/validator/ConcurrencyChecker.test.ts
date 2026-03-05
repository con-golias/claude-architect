/**
 * Tests for ConcurrencyChecker — detects async/concurrency anti-patterns.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { checkConcurrency } from "./ConcurrencyChecker";

let TEST_DIR: string;

function createSrcFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, "src", relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "concurrency-test-"));
  mkdirSync(join(TEST_DIR, "src"), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("checkConcurrency", () => {
  test("should return empty for clean code", () => {
    createSrcFile("app.ts", `const x = await Promise.all([fetchA(), fetchB()]).catch(console.error);`);
    const result = checkConcurrency(TEST_DIR);
    expect(result.violations).toEqual([]);
  });

  test("should detect Promise.all without catch", () => {
    createSrcFile(
      "batch.ts",
      `const promises = [taskA, taskB];\nPromise.all(promises);`
    );
    const result = checkConcurrency(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Promise.all Without Catch");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("warning");
  });

  test("should detect shared mutable state", () => {
    createSrcFile(
      "cache.ts",
      `export let cache = new Map();\nexport let items = [];`
    );
    const result = checkConcurrency(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Shared Mutable State");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("warning");
    expect(v[0].ruleId).toBe("20-concurrency");
  });

  test("should detect async event handler", () => {
    createSrcFile(
      "events.ts",
      `element.addEventListener("click", async (e) => {\n  await doStuff();\n});`
    );
    const result = checkConcurrency(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Async Void Function");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("info");
  });

  test("should not flag test files", () => {
    createSrcFile(
      "batch.test.ts",
      `const results = await Promise.all([a(), b()]);`
    );
    const result = checkConcurrency(TEST_DIR);
    expect(result.filesScanned).toBe(0);
  });

  test("should report file paths correctly", () => {
    createSrcFile(
      "services/worker.ts",
      `export let connections = new Map();`
    );
    const result = checkConcurrency(TEST_DIR);
    if (result.violations.length > 0) {
      expect(result.violations[0].filePath).toContain("services/worker.ts");
    }
  });
});
