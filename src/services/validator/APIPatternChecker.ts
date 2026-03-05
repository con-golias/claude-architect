/**
 * API design pattern checks.
 * Validates route naming conventions, input validation, error handling,
 * and response consistency in Express-style route files.
 *
 * @module APIPatternChecker
 */

import { readFileSync } from "fs";
import { join, relative } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { normalizePath, globSync } from "../../utils/paths";

const EXCLUDE = ["node_modules", ".test.", ".spec.", "__tests__", ".d.ts", "dist/", "build/", "coverage/"];

/**
 * Run API pattern checks on source files.
 *
 * @param projectPath - Absolute path to project root
 * @returns Checker result with API pattern violations
 */
export function checkAPIPatterns(projectPath: string): CheckerResult {
  const violations: Violation[] = [];
  const srcPath = join(projectPath, "src");
  let filesScanned = 0;

  try {
    const files = globSync("**/*.{ts,js}", srcPath);

    for (const file of files) {
      if (EXCLUDE.some(p => file.includes(p))) continue;

      const fullPath = join(srcPath, file);
      const relativePath = normalizePath(relative(projectPath, fullPath));

      let content: string;
      try {
        content = readFileSync(fullPath, "utf-8");
      } catch { continue; }

      // Only check files that look like route/controller files
      if (!isRouteFile(content, file)) continue;
      filesScanned++;

      const lines = content.split("\n");
      checkRouteNaming(content, lines, relativePath, violations);
      checkInputValidation(content, lines, relativePath, violations);
      checkErrorHandling(content, relativePath, violations);
      checkResponseConsistency(content, lines, relativePath, violations);
    }
  } catch { /* src/ doesn't exist */ }

  return { violations, filesScanned };
}

/** Determine if a file is a route/controller file. */
function isRouteFile(content: string, filename: string): boolean {
  const isNameMatch = /(?:route|controller|handler|endpoint|api)/i.test(filename);
  const hasRoutePatterns = /router\.\w+\s*\(|app\.\w+\s*\(|@(?:Get|Post|Put|Delete|Patch)\b/i.test(content);
  return isNameMatch || hasRoutePatterns;
}

/** Check route path naming follows kebab-case convention. */
function checkRouteNaming(
  content: string, lines: string[], filePath: string, violations: Violation[]
): void {
  const routePattern = /(?:router|app)\.\w+\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = routePattern.exec(content)) !== null) {
    const path = match[1];
    const segments = path.split("/").filter(s => s && !s.startsWith(":"));

    for (const seg of segments) {
      if (seg !== seg.toLowerCase() || seg.includes("_")) {
        const lineNumber = content.substring(0, match.index).split("\n").length;
        violations.push({
          ruleId: "28-advanced-api-patterns",
          ruleName: "Route Naming",
          severity: "info",
          category: "structure",
          filePath,
          lineNumber,
          description: `Route path segment "${seg}" should use kebab-case`,
          suggestion: `Rename to "${seg.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase()}"`,
        });
        break;
      }
    }
  }
}

/** Check that POST/PUT/PATCH routes validate request input. */
function checkInputValidation(
  content: string, lines: string[], filePath: string, violations: Violation[]
): void {
  const mutationPattern = /(?:router|app)\.(post|put|patch)\s*\(\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = mutationPattern.exec(content)) !== null) {
    const method = match[1];
    const route = match[2];
    const lineNumber = content.substring(0, match.index).split("\n").length;

    // Check if there's validation within the next 30 lines
    const nextLines = lines.slice(lineNumber - 1, lineNumber + 30).join("\n");
    const hasValidation =
      /(?:validate|schema|zod|joi|yup|ajv|\.parse\(|\.safeParse\(|typeof\s+\w+\s*!==|if\s*\(\s*!\w+)/i.test(nextLines);

    if (!hasValidation) {
      violations.push({
        ruleId: "28-advanced-api-patterns",
        ruleName: "Missing Input Validation",
        severity: "warning",
        category: "structure",
        filePath,
        lineNumber,
        description: `${method.toUpperCase()} ${route} — no input validation detected`,
        suggestion: "Add request body validation using Zod, Joi, or manual type checks",
      });
    }
  }
}

/** Check that route files have error handling. */
function checkErrorHandling(
  content: string, filePath: string, violations: Violation[]
): void {
  const hasRoutes = /(?:router|app)\.\w+\s*\(/g.test(content);
  if (!hasRoutes) return;

  const hasTryCatch = /try\s*\{/.test(content);
  const hasErrorMiddleware = /err(?:or)?\s*(?:,\s*req|:\s*Error)/i.test(content);
  const hasStatusError = /\.status\s*\(\s*(?:4\d{2}|5\d{2})\s*\)/.test(content);

  if (!hasTryCatch && !hasErrorMiddleware && !hasStatusError) {
    violations.push({
      ruleId: "28-advanced-api-patterns",
      ruleName: "Missing Error Handling",
      severity: "warning",
      category: "structure",
      filePath,
      description: "Route file has no error handling (no try-catch, error middleware, or error responses)",
      suggestion: "Add try-catch blocks or error middleware to handle failures gracefully",
    });
  }
}

/** Check for inconsistent response patterns. */
function checkResponseConsistency(
  content: string, lines: string[], filePath: string, violations: Violation[]
): void {
  const jsonResponses = content.match(/res\.json\s*\(/g);
  const sendResponses = content.match(/res\.send\s*\(/g);

  if (jsonResponses && sendResponses) {
    const jsonCount = jsonResponses.length;
    const sendCount = sendResponses.length;

    if (jsonCount > 0 && sendCount > 0 && Math.min(jsonCount, sendCount) > 1) {
      violations.push({
        ruleId: "28-advanced-api-patterns",
        ruleName: "Inconsistent Response Format",
        severity: "info",
        category: "structure",
        filePath,
        description: `Mixed response methods: ${jsonCount} res.json() and ${sendCount} res.send()`,
        suggestion: "Use res.json() consistently for API endpoints",
      });
    }
  }
}
