/**
 * Tests for sourceResolver — smart source directory detection.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { resolveSourcePaths, buildGlobPattern } from "./sourceResolver";

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), "source-resolver-"));
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe("resolveSourcePaths", () => {
  test("detects Node/TS project with tsconfig.json", () => {
    writeFileSync(join(testDir, "tsconfig.json"), "{}");
    mkdirSync(join(testDir, "src"), { recursive: true });
    const res = resolveSourcePaths(testDir);
    expect(res.projectTypes).toContain("node-ts");
    expect(res.codeExtensions).toContain(".ts");
    expect(res.codeExtensions).toContain(".tsx");
  });

  test("detects Python project with requirements.txt", () => {
    writeFileSync(join(testDir, "requirements.txt"), "flask==2.0");
    mkdirSync(join(testDir, "app"), { recursive: true });
    const res = resolveSourcePaths(testDir);
    expect(res.projectTypes).toContain("python");
    expect(res.codeExtensions).toContain(".py");
  });

  test("detects Go project with go.mod", () => {
    writeFileSync(join(testDir, "go.mod"), "module example.com");
    mkdirSync(join(testDir, "cmd"), { recursive: true });
    const res = resolveSourcePaths(testDir);
    expect(res.projectTypes).toContain("go");
    expect(res.codeExtensions).toContain(".go");
    expect(res.sourceDirs.some((d) => d.endsWith("cmd"))).toBe(true);
  });

  test("falls back to project root when no standard dirs found", () => {
    writeFileSync(join(testDir, "main.py"), "print('hello')");
    const res = resolveSourcePaths(testDir);
    expect(res.sourceDirs).toContain(testDir);
  });

  test("detects clean architecture (src/features)", () => {
    mkdirSync(join(testDir, "src", "features"), { recursive: true });
    const res = resolveSourcePaths(testDir);
    expect(res.hasCleanArchitecture).toBe(true);
  });

  test("no clean architecture without src/features", () => {
    mkdirSync(join(testDir, "src"), { recursive: true });
    const res = resolveSourcePaths(testDir);
    expect(res.hasCleanArchitecture).toBe(false);
  });

  test("prefers node-ts over node-js when tsconfig exists", () => {
    writeFileSync(join(testDir, "package.json"), "{}");
    writeFileSync(join(testDir, "tsconfig.json"), "{}");
    const res = resolveSourcePaths(testDir);
    expect(res.projectTypes).toContain("node-ts");
    expect(res.projectTypes).not.toContain("node-js");
  });

  test("returns unknown for empty project", () => {
    const res = resolveSourcePaths(testDir);
    expect(res.projectTypes).toContain("unknown");
  });

  test("finds multiple source directories", () => {
    mkdirSync(join(testDir, "src"), { recursive: true });
    mkdirSync(join(testDir, "lib"), { recursive: true });
    const res = resolveSourcePaths(testDir);
    expect(res.sourceDirs.length).toBeGreaterThanOrEqual(2);
  });
});

describe("buildGlobPattern", () => {
  test("single extension", () => {
    expect(buildGlobPattern([".py"])).toBe("**/*.py");
  });

  test("multiple extensions", () => {
    const pattern = buildGlobPattern([".ts", ".tsx", ".js"]);
    expect(pattern).toBe("**/*.{ts,tsx,js}");
  });
});
