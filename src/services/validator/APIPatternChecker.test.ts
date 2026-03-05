/**
 * Tests for APIPatternChecker — detects API design anti-patterns.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { checkAPIPatterns } from "./APIPatternChecker";

let TEST_DIR: string;

function createSrcFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, "src", relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "api-test-"));
  mkdirSync(join(TEST_DIR, "src"), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("checkAPIPatterns", () => {
  test("should return empty for clean route file", () => {
    const code = [
      `import { Router } from "express";`,
      `const router = Router();`,
      `router.get("/users", async (req, res) => {`,
      `  try {`,
      `    const users = await db.getUsers();`,
      `    res.json({ data: users });`,
      `  } catch (err) {`,
      `    res.status(500).json({ error: "Failed" });`,
      `  }`,
      `});`,
      `router.post("/users", async (req, res) => {`,
      `  if (!req.body.name) return res.status(400).json({ error: "Missing name" });`,
      `  try {`,
      `    const user = await db.createUser(req.body.name);`,
      `    res.json({ data: user });`,
      `  } catch (err) {`,
      `    res.status(500).json({ error: "Failed" });`,
      `  }`,
      `});`,
    ].join("\n");
    createSrcFile("userRoutes.ts", code);
    const result = checkAPIPatterns(TEST_DIR);
    expect(result.violations).toEqual([]);
  });

  test("should detect camelCase route path segment", () => {
    const code = [
      `import { Router } from "express";`,
      `const router = Router();`,
      `router.get("/userProfile/:id", async (req, res) => {`,
      `  try {`,
      `    res.json({ data: {} });`,
      `  } catch (err) {`,
      `    res.status(500).json({ error: "Failed" });`,
      `  }`,
      `});`,
    ].join("\n");
    createSrcFile("profileRoutes.ts", code);
    const result = checkAPIPatterns(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Route Naming");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("info");
    expect(v[0].description).toContain("userProfile");
  });

  test("should detect missing error handling in route file", () => {
    const code = [
      `import { Router } from "express";`,
      `const router = Router();`,
      `router.get("/items", async (req, res) => {`,
      `  const items = await db.getItems();`,
      `  res.json(items);`,
      `});`,
    ].join("\n");
    createSrcFile("itemRoutes.ts", code);
    const result = checkAPIPatterns(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Missing Error Handling");
    expect(v.length).toBe(1);
    expect(v[0].severity).toBe("warning");
    expect(v[0].ruleId).toBe("28-advanced-api-patterns");
  });

  test("should only scan route/controller files", () => {
    createSrcFile(
      "utils.ts",
      `export function formatDate(d: Date) { return d.toISOString(); }`
    );
    const result = checkAPIPatterns(TEST_DIR);
    expect(result.filesScanned).toBe(0);
  });

  test("should detect routes by content pattern even without route in filename", () => {
    const code = [
      `import { Router } from "express";`,
      `const router = Router();`,
      `router.get("/health", (req, res) => {`,
      `  try { res.json({ ok: true }); } catch(e) { res.status(500).json({}); }`,
      `});`,
    ].join("\n");
    createSrcFile("api.ts", code);
    const result = checkAPIPatterns(TEST_DIR);
    expect(result.filesScanned).toBe(1);
  });
});
