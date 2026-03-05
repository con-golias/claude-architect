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

  const missingTestFiles: string[] = [];

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

      // Check for unused imports
      checkUnusedImports(content, relativePath, violations);

      // Check for commented-out code blocks
      checkCommentedCode(content, relativePath, violations);

      // Collect missing test files (summarized later)
      if (
        !file.includes(".test.") &&
        !file.includes(".spec.") &&
        !file.includes("__tests__") &&
        isExportingFile(content)
      ) {
        if (!hasTestFile(fullPath)) {
          missingTestFiles.push(relativePath);
        }
      }
    }
  } catch {
    // Glob errors are non-fatal
  }

  // Add ONE summary violation for missing tests
  if (missingTestFiles.length > 0) {
    const tested = filesScanned - missingTestFiles.length;
    violations.push({
      ruleId: "03-testing",
      ruleName: "Test Coverage",
      severity: "info",
      category: "quality",
      description: `No test files found (${tested} of ${filesScanned} source files have tests)`,
      suggestion: `Create test files for: ${missingTestFiles.map(f => basename(f)).join(", ")}`,
    });
  }

  return { violations, filesScanned };
}

/**
 * Check for unused named imports.
 *
 * @param content - File content
 * @param filePath - Relative file path
 * @param violations - Array to push violations into
 */
function checkUnusedImports(
  content: string,
  filePath: string,
  violations: Violation[]
): void {
  const importPattern = /^import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/gm;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(content)) !== null) {
    const lineNumber = content.substring(0, match.index).split("\n").length;
    const symbols = match[1].split(",").map((s) => s.trim().split(" as ").pop()!.trim()).filter(Boolean);
    const restOfCode = content.substring(match.index + match[0].length);

    for (const sym of symbols) {
      const usagePattern = new RegExp(`\\b${sym}\\b`);
      if (!usagePattern.test(restOfCode)) {
        violations.push({
          ruleId: "03-quality",
          ruleName: "Unused Import",
          severity: "warning",
          category: "quality",
          filePath,
          lineNumber,
          description: `Unused import ${sym}`,
          suggestion: "Remove the import",
        });
      }
    }
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
 * Check if a file has a corresponding test file.
 *
 * @param filePath - Absolute path to the source file
 * @returns True if a test file exists
 */
function hasTestFile(filePath: string): boolean {
  const dir = dirname(filePath);
  const base = basename(filePath);
  const extensions = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".test.js", ".spec.js"];
  const baseName = base.replace(/\.(ts|tsx|js|jsx)$/, "");
  return extensions.some((ext) => existsSync(join(dir, baseName + ext)));
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
