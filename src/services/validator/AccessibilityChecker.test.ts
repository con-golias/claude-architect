/**
 * Tests for AccessibilityChecker — detects a11y issues in JSX/TSX/HTML.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { checkAccessibility } from "./AccessibilityChecker";

let TEST_DIR: string;

function createSrcFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, "src", relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "a11y-test-"));
  mkdirSync(join(TEST_DIR, "src"), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("checkAccessibility", () => {
  test("should return empty for clean JSX with proper alt", () => {
    createSrcFile(
      "Banner.tsx",
      `export const Banner = () => <img src="photo.jpg" alt="Company banner" />;`
    );
    const result = checkAccessibility(TEST_DIR);
    const imgViolations = result.violations.filter((v) => v.ruleName === "Image Without Alt");
    expect(imgViolations).toEqual([]);
  });

  test("should detect img without alt attribute", () => {
    createSrcFile(
      "Avatar.tsx",
      `export const Avatar = () => <img src="photo.jpg" />;`
    );
    const result = checkAccessibility(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "Image Without Alt");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("warning");
    expect(v[0].ruleId).toBe("22-accessibility");
  });

  test("should detect autoFocus usage", () => {
    createSrcFile(
      "SearchBox.tsx",
      `export const SearchBox = () => <input type="text" autoFocus />;`
    );
    const result = checkAccessibility(TEST_DIR);
    const v = result.violations.filter((v) => v.ruleName === "AutoFocus Usage");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("info");
  });

  test("should only scan tsx/jsx/html/vue files", () => {
    createSrcFile(
      "utils.ts",
      `const tag = '<img src="photo.jpg" />';`
    );
    const result = checkAccessibility(TEST_DIR);
    expect(result.filesScanned).toBe(0);
  });

  test("should not flag test files", () => {
    createSrcFile(
      "Avatar.test.tsx",
      `const el = <img src="photo.jpg" />;`
    );
    const result = checkAccessibility(TEST_DIR);
    expect(result.filesScanned).toBe(0);
  });

  test("should report correct file paths", () => {
    createSrcFile(
      "components/Card.tsx",
      `export const Card = () => <img src="card.jpg" />;`
    );
    const result = checkAccessibility(TEST_DIR);
    if (result.violations.length > 0) {
      expect(result.violations[0].filePath).toContain("components/Card.tsx");
    }
  });
});
