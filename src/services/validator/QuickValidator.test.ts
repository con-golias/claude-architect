/**
 * Tests for QuickValidator — lightweight single-file validation.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { quickValidate } from "./QuickValidator";

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "quick-validator-"));
});

afterEach(() => {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

/** Write a source file and return its absolute path. */
function writeSource(relativePath: string, content: string): string {
  const fullPath = join(testDir, relativePath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
  return fullPath;
}

describe("quickValidate", () => {
  test("detects hardcoded API key", () => {
    const file = writeSource(
      "src/config.ts",
      'const apiKey = "sk_test_1234567890abcdef";'
    );
    const violations = quickValidate(testDir, file);
    const apiKeyHits = violations.filter((v) => v.ruleName === "Hardcoded API Key");
    expect(apiKeyHits.length).toBeGreaterThan(0);
    expect(apiKeyHits[0].severity).toBe("critical");
    expect(apiKeyHits[0].category).toBe("security");
  });

  test("detects eval() usage", () => {
    const file = writeSource(
      "src/dynamic.ts",
      "const result = eval(userInput);"
    );
    const violations = quickValidate(testDir, file);
    const evalHits = violations.filter((v) => v.ruleName.includes("eval"));
    expect(evalHits.length).toBeGreaterThan(0);
    expect(evalHits[0].severity).toBe("critical");
  });

  test("skips test files and returns no violations", () => {
    const file = writeSource(
      "src/auth.test.ts",
      'const password = "super_secret_value_12345678";'
    );
    const violations = quickValidate(testDir, file);
    expect(violations).toEqual([]);
  });

  test("detects files longer than 200 lines", () => {
    const lines = Array.from({ length: 210 }, (_, i) => `const x${i} = ${i};`);
    const file = writeSource("src/big-file.ts", lines.join("\n"));
    const violations = quickValidate(testDir, file);
    const longFile = violations.filter((v) => v.ruleName === "File Too Long");
    expect(longFile.length).toBe(1);
    expect(longFile[0].severity).toBe("warning");
    expect(longFile[0].description).toContain("210");
  });

  test("ignores security patterns inside comments", () => {
    const file = writeSource(
      "src/safe.ts",
      '// const apiKey = "sk_test_1234567890abcdef";\nconst x = 1;'
    );
    const violations = quickValidate(testDir, file);
    const apiKeyHits = violations.filter((v) => v.ruleName === "Hardcoded API Key");
    expect(apiKeyHits).toEqual([]);
  });

  test("detects dependency direction violation (domain importing infrastructure)", () => {
    const file = writeSource(
      "src/features/auth/domain/entities/User.ts",
      'import { db } from "../../infrastructure/repositories/UserRepo";\nexport class User {}'
    );
    const violations = quickValidate(testDir, file);
    const depHits = violations.filter((v) => v.ruleName === "Dependency Direction");
    expect(depHits.length).toBeGreaterThan(0);
    expect(depHits[0].severity).toBe("critical");
    expect(depHits[0].category).toBe("dependency");
    expect(depHits[0].description).toContain("infrastructure");
  });
});
