/**
 * Code quality checks: file size, function length, documentation, test coverage.
 *
 * @module QualityChecker
 */

import { readFileSync, existsSync } from "fs";
import { join, relative, basename, dirname } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { normalizePath, globSync } from "../../utils/paths";

const MAX_FILE_LINES = 200;
const MAX_FUNCTION_LINES = 30;

/**
 * Run quality checks on a project's source files.
 *
 * @param projectPath - Absolute path to project root
 * @returns Checker result with quality violations
 */
export function checkQuality(projectPath: string): CheckerResult {
  const violations: Violation[] = [];
  const srcPath = join(projectPath, "src");

  if (!existsSync(srcPath)) {
    return { violations: [], filesScanned: 0 };
  }

  let filesScanned = 0;

  try {
    const files = globSync("**/*.{ts,tsx,js,jsx}", srcPath);

    for (const file of files) {
      if (
        file.includes("node_modules") ||
        file.includes(".d.ts") ||
        file.includes("dist/")
      ) {
        continue;
      }

      filesScanned++;
      const fullPath = join(srcPath, file);
      const relativePath = normalizePath(relative(projectPath, fullPath));

      let content: string;
      try {
        content = readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      const lines = content.split("\n");

      // Check file size
      if (lines.length > MAX_FILE_LINES) {
        violations.push({
          ruleId: "15-code-style",
          ruleName: "File Size Limit",
          severity: "warning",
          category: "quality",
          filePath: relativePath,
          description: `File has ${lines.length} lines (max ${MAX_FILE_LINES})`,
          suggestion: `Split into smaller focused modules. Extract helper functions or sub-components.`,
        });
      }

      // Check for TODO without ticket reference
      checkTodos(content, relativePath, violations);

      // Check for commented-out code blocks
      checkCommentedCode(content, relativePath, violations);

      // Check for missing test file
      if (
        !file.includes(".test.") &&
        !file.includes(".spec.") &&
        !file.includes("__tests__") &&
        isExportingFile(content)
      ) {
        checkTestFileExists(fullPath, relativePath, violations);
      }

      // Check for exported functions without JSDoc
      checkMissingDocs(content, relativePath, violations);
    }
  } catch {
    // Glob errors are non-fatal
  }

  return { violations, filesScanned };
}

/**
 * Check for TODO comments without ticket/issue references.
 *
 * @param content - File content
 * @param filePath - Relative file path
 * @param violations - Array to push violations into
 */
function checkTodos(
  content: string,
  filePath: string,
  violations: Violation[]
): void {
  const todoPattern = /\/\/\s*TODO(?!\s*\(?\s*[A-Z]+-\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = todoPattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split("\n").length;
    violations.push({
      ruleId: "15-code-style",
      ruleName: "TODO Without Ticket",
      severity: "info",
      category: "quality",
      filePath,
      lineNumber,
      description: "TODO comment without issue/ticket reference",
      suggestion:
        'Add a ticket reference: // TODO(JIRA-123): description',
    });
  }
}

/**
 * Check for large blocks of commented-out code.
 *
 * @param content - File content
 * @param filePath - Relative file path
 * @param violations - Array to push violations into
 */
function checkCommentedCode(
  content: string,
  filePath: string,
  violations: Violation[]
): void {
  const lines = content.split("\n");
  let consecutiveComments = 0;
  let blockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith("//") && !trimmed.startsWith("///") && !trimmed.startsWith("// @")) {
      if (consecutiveComments === 0) blockStart = i + 1;
      consecutiveComments++;
    } else {
      if (consecutiveComments >= 5) {
        violations.push({
          ruleId: "15-code-style",
          ruleName: "Commented-Out Code",
          severity: "info",
          category: "quality",
          filePath,
          lineNumber: blockStart,
          description: `${consecutiveComments} consecutive commented lines — likely commented-out code`,
          suggestion: "Remove commented-out code. Use version control to recover old code.",
        });
      }
      consecutiveComments = 0;
    }
  }
}

/**
 * Check if a file has corresponding test file.
 *
 * @param filePath - Absolute path to the source file
 * @param relativePath - Relative path for violation reporting
 * @param violations - Array to push violations into
 */
function checkTestFileExists(
  filePath: string,
  relativePath: string,
  violations: Violation[]
): void {
  const dir = dirname(filePath);
  const base = basename(filePath);
  const extensions = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".test.js", ".spec.js"];

  const baseName = base.replace(/\.(ts|tsx|js|jsx)$/, "");
  const hasTest = extensions.some((ext) =>
    existsSync(join(dir, baseName + ext))
  );

  if (!hasTest) {
    violations.push({
      ruleId: "03-testing",
      ruleName: "Missing Test File",
      severity: "info",
      category: "quality",
      filePath: relativePath,
      description: `No test file found for "${base}"`,
      suggestion: `Create ${baseName}.test.ts alongside this file`,
    });
  }
}

/**
 * Check for exported functions/classes without JSDoc comments.
 *
 * @param content - File content
 * @param filePath - Relative path for violation reporting
 * @param violations - Array to push violations into
 */
function checkMissingDocs(
  content: string,
  filePath: string,
  violations: Violation[]
): void {
  const exportPattern =
    /^export\s+(?:async\s+)?(?:function|class|const|interface|type)\s+(\w+)/gm;
  let match: RegExpExecArray | null;

  while ((match = exportPattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split("\n").length;
    const prevLines = content.substring(0, match.index).split("\n");
    const prevLine = prevLines[prevLines.length - 2]?.trim() || "";

    // Check if there's a JSDoc comment or regular doc comment above
    if (!prevLine.endsWith("*/") && !prevLine.startsWith("*")) {
      violations.push({
        ruleId: "06-documentation",
        ruleName: "Missing Documentation",
        severity: "info",
        category: "docs",
        filePath,
        lineNumber,
        description: `Exported "${match[1]}" has no JSDoc/doc comment`,
        suggestion: `Add a doc comment with @param, @returns, @throws as applicable`,
      });
    }
  }
}

/**
 * Check if a file exports anything (to determine if tests are expected).
 *
 * @param content - File content
 * @returns True if the file has exports
 */
function isExportingFile(content: string): boolean {
  return /^export\s+/m.test(content);
}
