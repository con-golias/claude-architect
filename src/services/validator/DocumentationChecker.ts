/**
 * Documentation density and basic formatting checks.
 * Detects missing JSDoc, low comment density, long lines, trailing whitespace.
 *
 * @module DocumentationChecker
 */

import { readFileSync } from "fs";
import { join, relative } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import type { SourceResolution } from "../../utils/sourceResolver";
import { buildGlobPattern } from "../../utils/sourceResolver";
import { normalizePath, globSync } from "../../utils/paths";

const MIN_COMMENT_RATIO = 0.05;
const MIN_FILE_LINES = 20;
const MAX_LINE_LENGTH = 120;
const MAX_LONG_LINES = 3;
const JSDOC_THRESHOLD = 0.5;
const MAX_TRAILING_WS = 5;

const EXCLUDE_PATTERNS = [
  "node_modules", ".test.", ".spec.", "__tests__",
  ".d.ts", "dist/", "build/", "coverage/", ".config.",
  ".json", ".lock", ".min.", "bundle",
];

/**
 * Run documentation and formatting checks on source files.
 *
 * @param projectPath - Absolute path to project root
 * @param resolution - Source resolution from sourceResolver
 * @returns Checker result with documentation violations
 */
export function checkDocumentation(
  projectPath: string,
  resolution?: SourceResolution
): CheckerResult {
  const violations: Violation[] = [];
  const sourceDirs = resolution?.sourceDirs ?? [join(projectPath, "src")];
  const extensions = resolution?.codeExtensions ?? [".ts", ".tsx", ".js", ".jsx"];
  const pattern = buildGlobPattern(extensions);
  let filesScanned = 0;

  for (const srcDir of sourceDirs) {
    try {
      const files = globSync(pattern, srcDir);
      for (const file of files) {
        if (EXCLUDE_PATTERNS.some((p) => file.includes(p))) continue;
        filesScanned++;
        const fullPath = join(srcDir, file);
        const relativePath = normalizePath(relative(projectPath, fullPath));

        let content: string;
        try { content = readFileSync(fullPath, "utf-8"); } catch { continue; }

        const lines = content.split("\n");
        if (lines.length < MIN_FILE_LINES) continue;

        checkCommentDensity(lines, relativePath, violations);
        checkJSDocCoverage(content, relativePath, violations);
        checkLineLengths(lines, relativePath, violations);
        checkTrailingWhitespace(lines, relativePath, violations);
      }
    } catch { /* directory doesn't exist */ }
  }

  return { violations, filesScanned };
}

/** Check if file has minimum comment density. */
function checkCommentDensity(
  lines: string[], filePath: string, violations: Violation[]
): void {
  const nonBlank = lines.filter((l) => l.trim().length > 0);
  if (nonBlank.length < MIN_FILE_LINES) return;

  const commentLines = nonBlank.filter((l) => {
    const t = l.trim();
    return t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")
      || t.startsWith("#") || t.startsWith("'''") || t.startsWith('"""');
  });

  const ratio = commentLines.length / nonBlank.length;
  if (ratio < MIN_COMMENT_RATIO) {
    violations.push({
      ruleId: "06-documentation", ruleName: "Documentation",
      severity: "info", category: "docs", filePath,
      description: `File has very low comment density (${Math.round(ratio * 100)}% — minimum ${MIN_COMMENT_RATIO * 100}%)`,
      suggestion: "Add comments explaining complex logic, public API usage, and non-obvious decisions",
    });
  }
}

/** Check if exported functions have JSDoc. */
function checkJSDocCoverage(
  content: string, filePath: string, violations: Violation[]
): void {
  // Only check JS/TS files
  if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) return;

  const exportRegex = /^export\s+(?:async\s+)?(?:function|class|const|type|interface)\s+(\w+)/gm;
  const exports: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = exportRegex.exec(content)) !== null) exports.push(match[1]);

  if (exports.length === 0) return;

  let undocumented = 0;
  for (const name of exports) {
    const idx = content.indexOf(name);
    if (idx < 0) continue;
    const before = content.substring(Math.max(0, idx - 200), idx);
    if (!before.includes("*/")) undocumented++;
  }

  const ratio = undocumented / exports.length;
  if (ratio > JSDOC_THRESHOLD) {
    violations.push({
      ruleId: "06-documentation", ruleName: "Documentation",
      severity: "warning", category: "docs", filePath,
      description: `${undocumented}/${exports.length} exported symbols lack JSDoc documentation`,
      suggestion: "Add /** ... */ JSDoc comments before exported functions, classes, and types",
    });
  }
}

/** Check for excessively long lines. */
function checkLineLengths(
  lines: string[], filePath: string, violations: Violation[]
): void {
  let longCount = 0;
  for (const line of lines) {
    // Skip import/require lines (often unavoidably long)
    if (/^\s*(import|require|from)\s/.test(line)) continue;
    if (line.length > MAX_LINE_LENGTH) longCount++;
  }

  if (longCount > MAX_LONG_LINES) {
    violations.push({
      ruleId: "15-code-style", ruleName: "Code Style",
      severity: "info", category: "quality", filePath,
      description: `${longCount} lines exceed ${MAX_LINE_LENGTH} characters`,
      suggestion: `Break long lines to stay under ${MAX_LINE_LENGTH} characters for readability`,
    });
  }
}

/** Check for trailing whitespace. */
function checkTrailingWhitespace(
  lines: string[], filePath: string, violations: Violation[]
): void {
  let count = 0;
  for (const line of lines) {
    if (line !== line.trimEnd() && line.trim().length > 0) count++;
  }

  if (count > MAX_TRAILING_WS) {
    violations.push({
      ruleId: "15-code-style", ruleName: "Code Style",
      severity: "info", category: "quality", filePath,
      description: `${count} lines have trailing whitespace`,
      suggestion: "Configure your editor to trim trailing whitespace on save",
    });
  }
}
