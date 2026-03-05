/**
 * Tests for PrivacyChecker — detects PII exposure and data protection issues.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { checkPrivacy } from "./PrivacyChecker";

let TEST_DIR: string;

function createSrcFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, "src", relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "privacy-test-"));
  mkdirSync(join(TEST_DIR, "src"), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("checkPrivacy", () => {
  test("should return empty for clean code", () => {
    createSrcFile("app.ts", `const config = { port: 3000 };\nconsole.log("Server started");`);
    const result = checkPrivacy(TEST_DIR);
    expect(result.violations).toEqual([]);
  });

  test("should detect PII in logs (email keyword)", () => {
    createSrcFile(
      "auth.ts",
      `console.log("User email: ", user.email);`
    );
    const result = checkPrivacy(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "PII in Logs");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("critical");
  });

  test("should detect PII in URL params", () => {
    createSrcFile(
      "redirect.ts",
      "const url = `/reset?password=${user.password}`;"
    );
    const result = checkPrivacy(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "PII in URL Params");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("warning");
  });

  test("should detect unencrypted PII storage", () => {
    createSrcFile(
      "store.ts",
      `localStorage.setItem("password", userPassword);`
    );
    const result = checkPrivacy(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Unencrypted PII Storage");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("critical");
  });

  test("should not flag comments as violations", () => {
    createSrcFile(
      "safe.ts",
      `// console.log(email);\nconst x = 1;`
    );
    const result = checkPrivacy(TEST_DIR);
    expect(result.violations).toEqual([]);
  });

  test("should report correct ruleId", () => {
    createSrcFile(
      "logger.ts",
      `logger.info("Processing email for user", data.email);`
    );
    const result = checkPrivacy(TEST_DIR);
    if (result.violations.length > 0) {
      expect(result.violations[0].ruleId).toBe("18-data-privacy");
    }
  });
});
