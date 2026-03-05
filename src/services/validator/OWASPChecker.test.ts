/**
 * Tests for OWASPChecker — detects OWASP Top 10 and supply chain risks.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { checkOWASP } from "./OWASPChecker";

let TEST_DIR: string;

function createSrcFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, "src", relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

function createRootFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "owasp-test-"));
  mkdirSync(join(TEST_DIR, "src"), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("checkOWASP", () => {
  test("should return empty for clean project", () => {
    createSrcFile("app.ts", `const greeting = "hello world";`);
    const result = checkOWASP(TEST_DIR);
    expect(result.violations).toEqual([]);
  });

  test("should detect path traversal risk", () => {
    createSrcFile(
      "upload.ts",
      `import fs from "fs";\nfs.readFile(req.params.filename, "utf-8", cb);`
    );
    const result = checkOWASP(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Path Traversal");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("critical");
  });

  test("should detect SSRF risk", () => {
    createSrcFile(
      "proxy.ts",
      `const data = await fetch(req.body.url);`
    );
    const result = checkOWASP(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "SSRF Risk");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("critical");
  });

  test("should detect mass assignment", () => {
    createSrcFile(
      "users.ts",
      `const user = await User.create(req.body);`
    );
    const result = checkOWASP(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Mass Assignment");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("warning");
  });

  test("should detect missing lock file", () => {
    createRootFile("package.json", `{ "name": "test", "dependencies": { "express": "^4.0.0" } }`);
    const result = checkOWASP(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Missing Lock File");
    expect(v.length).toBe(1);
    expect(v[0].ruleId).toBe("30-supply-chain-security");
  });

  test("should detect wildcard dependency versions", () => {
    createRootFile("package.json", `{ "name": "test", "dependencies": { "lodash": "*", "express": "latest" } }`);
    createRootFile("bun.lockb", "");
    const result = checkOWASP(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Unpinned Dependencies");
    expect(v.length).toBe(1);
    expect(v[0].description).toContain("2");
  });

  test("should not flag test files", () => {
    createSrcFile(
      "upload.test.ts",
      `fs.readFile(req.params.filename, "utf-8", cb);`
    );
    const result = checkOWASP(TEST_DIR);
    expect(result.filesScanned).toBe(0);
  });
});
