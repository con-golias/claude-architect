/**
 * Tests for AdvancedQualityChecker — detects code quality anti-patterns.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { checkAdvancedQuality } from "./AdvancedQualityChecker";

let TEST_DIR: string;

function createSrcFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, "src", relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "quality-test-"));
  mkdirSync(join(TEST_DIR, "src"), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("checkAdvancedQuality", () => {
  test("should return empty for clean code", () => {
    createSrcFile("app.ts", `export function greet(name: string) {\n  return "Hello " + name;\n}`);
    const result = checkAdvancedQuality(TEST_DIR);
    expect(result.violations).toEqual([]);
  });

  test("should detect deep nesting (5+ levels)", () => {
    const code = [
      "function process(data: any) {",
      "  if (data) {",
      "    for (const item of data) {",
      "      if (item.active) {",
      "        for (const sub of item.list) {",
      "          if (sub.valid) {",
      "            console.log(sub);",
      "          }",
      "        }",
      "      }",
      "    }",
      "  }",
      "}",
    ].join("\n");
    createSrcFile("deep.ts", code);
    const result = checkAdvancedQuality(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Deep Nesting");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("warning");
    expect(v[0].ruleId).toBe("26-advanced-code-quality");
  });

  test("should detect high TODO density (6+ TODOs)", () => {
    const lines = Array.from({ length: 7 }, (_, i) => `// TODO: fix issue ${i + 1}`);
    lines.push("const x = 1;");
    createSrcFile("messy.ts", lines.join("\n"));
    const result = checkAdvancedQuality(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "TODO Density");
    expect(v.length).toBe(1);
    expect(v[0].severity).toBe("info");
    expect(v[0].description).toContain("7");
  });

  test("should detect hardcoded URL", () => {
    createSrcFile(
      "api.ts",
      `const endpoint = "https://api.production-server.com/v1/data";`
    );
    const result = checkAdvancedQuality(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Hardcoded URL");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].ruleId).toBe("29-configuration-hygiene");
  });

  test("should not flag localhost URLs", () => {
    createSrcFile(
      "dev.ts",
      `const base = "http://localhost:3000/api";`
    );
    const result = checkAdvancedQuality(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Hardcoded URL");
    expect(v).toEqual([]);
  });

  test("should not flag test files", () => {
    createSrcFile(
      "deep.test.ts",
      `// TODO: a\n// TODO: b\n// TODO: c\n// TODO: d\n// TODO: e\n// TODO: f\n// TODO: g`
    );
    const result = checkAdvancedQuality(TEST_DIR);
    expect(result.filesScanned).toBe(0);
  });
});
