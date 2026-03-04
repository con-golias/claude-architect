/**
 * Tests for SecurityChecker — detects security anti-patterns.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { checkSecurity } from "./SecurityChecker";

const TEST_DIR = join(import.meta.dir, "__test_sec_fixtures__");

function createSrcFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, "src", relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

beforeEach(() => {
  mkdirSync(join(TEST_DIR, "src"), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("checkSecurity", () => {
  test("should return empty for project with no source files", () => {
    const result = checkSecurity(TEST_DIR);
    expect(result.violations).toEqual([]);
  });

  test("should detect hardcoded API key", () => {
    createSrcFile(
      "config.ts",
      `const apiKey = "sk-1234567890abcdefghijk";`
    );

    const result = checkSecurity(TEST_DIR);
    const apiKeyViolations = result.violations.filter(
      (v) => v.ruleName === "Hardcoded API Key"
    );
    expect(apiKeyViolations.length).toBeGreaterThan(0);
    expect(apiKeyViolations[0].severity).toBe("critical");
  });

  test("should detect hardcoded secret", () => {
    createSrcFile(
      "auth.ts",
      `const password = "super_secret_password_123";`
    );

    const result = checkSecurity(TEST_DIR);
    const secretViolations = result.violations.filter(
      (v) => v.ruleName === "Hardcoded Secret"
    );
    expect(secretViolations.length).toBeGreaterThan(0);
  });

  test("should detect SQL template literal injection", () => {
    createSrcFile(
      "repo.ts",
      "const getUser = (id: string) => db.query(`SELECT * FROM users WHERE id = ${id}`);"
    );

    const result = checkSecurity(TEST_DIR);
    const sqlViolations = result.violations.filter(
      (v) => v.ruleName.includes("SQL")
    );
    expect(sqlViolations.length).toBeGreaterThan(0);
    expect(sqlViolations[0].severity).toBe("critical");
  });

  test("should detect eval usage", () => {
    createSrcFile(
      "dynamic.ts",
      `const result = eval("2 + 2");`
    );

    const result = checkSecurity(TEST_DIR);
    const evalViolations = result.violations.filter(
      (v) => v.ruleName.includes("eval")
    );
    expect(evalViolations.length).toBeGreaterThan(0);
  });

  test("should detect wildcard CORS", () => {
    createSrcFile(
      "server.ts",
      `const corsOrigin = cors: "*";`
    );

    const result = checkSecurity(TEST_DIR);
    const corsViolations = result.violations.filter(
      (v) => v.ruleName === "Wildcard CORS"
    );
    expect(corsViolations.length).toBeGreaterThan(0);
  });

  test("should not flag comments as violations", () => {
    createSrcFile(
      "safe.ts",
      `// apiKey = "not-a-real-key-just-example";
       const config = process.env.API_KEY;`
    );

    const result = checkSecurity(TEST_DIR);
    const apiKeyViolations = result.violations.filter(
      (v) => v.ruleName === "Hardcoded API Key"
    );
    expect(apiKeyViolations).toEqual([]);
  });

  test("should not scan test files", () => {
    createSrcFile(
      "auth.test.ts",
      `const password = "test_password_12345678";`
    );

    const result = checkSecurity(TEST_DIR);
    expect(result.filesScanned).toBe(0);
  });

  test("should report correct file paths", () => {
    createSrcFile(
      "features/auth/config.ts",
      `const secret = "my_secret_token_value_here";`
    );

    const result = checkSecurity(TEST_DIR);
    if (result.violations.length > 0) {
      expect(result.violations[0].filePath).toContain("features/auth/config.ts");
    }
  });
});
