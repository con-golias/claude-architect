/**
 * Advanced code quality checks.
 * Detects deep nesting, magic numbers, long parameter lists,
 * TODO/FIXME density, and hardcoded configuration values.
 *
 * @module AdvancedQualityChecker
 */

import { readFileSync } from "fs";
import { join, relative } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { normalizePath, globSync } from "../../utils/paths";

const MAX_NESTING_DEPTH = 4;
const MAX_PARAMS = 4;
const MAX_TODOS_PER_FILE = 5;
const EXCLUDE = ["node_modules", ".test.", ".spec.", "__tests__", ".d.ts", "dist/", "build/", "coverage/"];

/** Create a violation object with common defaults. */
function violation(
  ruleId: string, ruleName: string, severity: Violation["severity"],
  filePath: string, description: string, suggestion: string,
  lineNumber?: number,
): Violation {
  return { ruleId, ruleName, severity, category: "quality", filePath, lineNumber, description, suggestion };
}

/**
 * Run advanced code quality checks on source files.
 *
 * @param projectPath - Absolute path to project root
 * @returns Checker result with quality violations
 */
export function checkAdvancedQuality(projectPath: string): CheckerResult {
  const violations: Violation[] = [];
  const srcPath = join(projectPath, "src");
  let filesScanned = 0;

  try {
    const files = globSync("**/*.{ts,tsx,js,jsx}", srcPath);

    for (const file of files) {
      if (EXCLUDE.some(p => file.includes(p))) continue;
      filesScanned++;

      const fullPath = join(srcPath, file);
      const relativePath = normalizePath(relative(projectPath, fullPath));

      let content: string;
      try { content = readFileSync(fullPath, "utf-8"); } catch { continue; }

      const lines = content.split("\n");
      checkDeepNesting(lines, relativePath, violations);
      checkLongParamLists(content, relativePath, violations);
      checkTodoDensity(lines, relativePath, violations);
      checkHardcodedConfig(content, lines, relativePath, violations);
      checkMagicNumbers(lines, relativePath, violations);
    }
  } catch { /* src/ doesn't exist */ }

  return { violations, filesScanned };
}

/** Detect deep nesting beyond MAX_NESTING_DEPTH levels. */
function checkDeepNesting(lines: string[], filePath: string, violations: Violation[]): void {
  let depth = 0;
  let maxDepth = 0;
  let maxLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
    for (const ch of trimmed) {
      if (ch === "{") { depth++; if (depth > maxDepth) { maxDepth = depth; maxLine = i + 1; } }
      else if (ch === "}") { depth = Math.max(0, depth - 1); }
    }
  }

  if (maxDepth > MAX_NESTING_DEPTH) {
    violations.push(violation(
      "26-advanced-code-quality", "Deep Nesting", "warning", filePath,
      `Nesting depth of ${maxDepth} exceeds maximum of ${MAX_NESTING_DEPTH}`,
      "Extract nested logic into helper functions or use early returns to reduce nesting",
      maxLine,
    ));
  }
}

/** Detect functions with too many parameters. */
function checkLongParamLists(content: string, filePath: string, violations: Violation[]): void {
  const funcPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+=>)|\w+\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{)/g;
  let match: RegExpExecArray | null;

  while ((match = funcPattern.exec(content)) !== null) {
    const parenStart = match[0].indexOf("(");
    if (parenStart === -1) continue;

    const afterParen = content.substring(match.index + parenStart);
    const closeIdx = findClosingParen(afterParen);
    if (closeIdx <= 1) continue;

    const params = afterParen.substring(1, closeIdx);
    const paramCount = params.split(",").filter(p => p.trim().length > 0).length;

    if (paramCount > MAX_PARAMS) {
      const lineNumber = content.substring(0, match.index).split("\n").length;
      violations.push(violation(
        "26-advanced-code-quality", "Long Parameter List", "info", filePath,
        `Function has ${paramCount} parameters (max ${MAX_PARAMS})`,
        "Group related parameters into an options object", lineNumber,
      ));
    }
  }
}

/** Detect high density of TODO/FIXME/HACK comments. */
function checkTodoDensity(lines: string[], filePath: string, violations: Violation[]): void {
  let count = 0;
  for (const line of lines) {
    if (/\b(?:TODO|FIXME|HACK|XXX)\b/i.test(line)) count++;
  }

  if (count > MAX_TODOS_PER_FILE) {
    violations.push(violation(
      "26-advanced-code-quality", "TODO Density", "info", filePath,
      `${count} TODO/FIXME/HACK comments — indicates accumulated technical debt`,
      "Address or create tickets for TODO items. Remove resolved TODOs",
    ));
  }
}

/** Detect hardcoded URLs, ports, and IP addresses in source code. */
function checkHardcodedConfig(
  content: string, lines: string[], filePath: string, violations: Violation[],
): void {
  const configPatterns = [
    { pattern: /(?:https?:\/\/(?!localhost|127\.0\.0\.1|example\.com)[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-z]{2,})/g, name: "Hardcoded URL" },
    { pattern: /(?:port|PORT)\s*[:=]\s*(\d{4,5})\b/g, name: "Hardcoded Port" },
    { pattern: /['"](\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?!\.0\.1)['"]/g, name: "Hardcoded IP" },
  ];

  for (const { pattern, name } of configPatterns) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split("\n").length;
      const lineContent = lines[lineNumber - 1]?.trim() || "";
      if (lineContent.startsWith("//") || lineContent.startsWith("*")) continue;
      violations.push(violation(
        "29-configuration-hygiene", name, "info", filePath,
        `${name} detected — should be in configuration/environment variable`,
        "Move to environment variable or configuration file", lineNumber,
      ));
    }
  }
}

/** Detect magic numbers (excluding common values like 0, 1, -1, 2). */
function checkMagicNumbers(lines: string[], filePath: string, violations: Violation[]): void {
  const allowed = new Set(["0", "1", "-1", "2", "100", "1000", "200", "201", "400", "401", "403", "404", "500"]);
  let magicCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("//") || line.startsWith("*") || line.startsWith("import")) continue;
    if (/(?:const|let|var)\s+\w+\s*=\s*-?\d+\s*;/.test(line)) continue;
    const matches = line.match(/(?<![a-zA-Z_$.])\b(\d{3,})\b(?!["'`])/g);
    if (matches) {
      for (const m of matches) { if (!allowed.has(m)) magicCount++; }
    }
  }

  if (magicCount > 3) {
    violations.push(violation(
      "26-advanced-code-quality", "Magic Numbers", "info", filePath,
      `${magicCount} magic numbers found — extract to named constants`,
      "Define meaningful constants: const MAX_RETRIES = 3; const TIMEOUT_MS = 5000;",
    ));
  }
}

/** Find closing parenthesis index, handling nesting. */
function findClosingParen(str: string): number {
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "(") depth++;
    else if (str[i] === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}
