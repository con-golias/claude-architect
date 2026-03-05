/**
 * Concurrency and async pattern checks.
 * Detects missing await, unhandled Promise.all, shared mutable state,
 * and timer cleanup issues.
 *
 * @module ConcurrencyChecker
 */

import { readFileSync } from "fs";
import { join, relative } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { normalizePath, globSync } from "../../utils/paths";
import type { SourceResolution } from "../../utils/sourceResolver";
import { buildGlobPattern } from "../../utils/sourceResolver";

interface ConcurrencyPattern {
  name: string;
  pattern: RegExp;
  severity: Violation["severity"];
  description: string;
  suggestion: string;
}

const CONCURRENCY_PATTERNS: ConcurrencyPattern[] = [
  {
    name: "Missing Await",
    pattern: /(?:^|\n)\s*(?!return\b)(?!await\b)(?!const\b)(?!let\b)(?!var\b)(?!if\b)(?!throw\b)\w+\.\b(?:save|update|delete|create|insert|remove|destroy|findOne|findMany)\s*\(/gm,
    severity: "info",
    description: "Async database operation may be missing await",
    suggestion: "Add await before async operations to ensure proper execution order",
  },
  {
    name: "Promise.all Without Catch",
    pattern: /Promise\.all\s*\([^)]+\)\s*(?!\.catch|\.then\([^,]+,[^)]+\))(?:\s*;|\s*$)/gm,
    severity: "warning",
    description: "Promise.all without error handling — one rejection crashes all",
    suggestion: "Use Promise.allSettled() or add .catch() / try-catch around Promise.all",
  },
  {
    name: "Shared Mutable State",
    pattern: /^(?:export\s+)?let\s+\w+\s*(?::\s*(?:Map|Set|Array|Record|object|\{)|\s*=\s*(?:new\s+(?:Map|Set)|(?:\[|\{)))/gm,
    severity: "warning",
    description: "Module-level mutable collection — potential race condition in concurrent access",
    suggestion: "Use const with immutable patterns, or isolate state in a class instance",
  },
  {
    name: "Timer Without Cleanup",
    pattern: /(?:setInterval|setTimeout)\s*\([^)]+\)\s*;?\s*(?:\n|$)(?!.*(?:clearInterval|clearTimeout|\.unref))/gm,
    severity: "info",
    description: "Timer created without storing reference for cleanup",
    suggestion: "Store timer reference and clear it in cleanup/dispose: const timer = setInterval(...); // clearInterval(timer)",
  },
  {
    name: "Async Void Function",
    pattern: /(?:addEventListener|on\w+)\s*\(\s*['"][^'"]+['"]\s*,\s*async\s/g,
    severity: "info",
    description: "Async event handler — errors may be silently swallowed",
    suggestion: "Wrap async event handlers in try-catch to prevent unhandled rejections",
  },
];

const ASYNC_DB_IMPORTS = /(?:import|require)\s*(?:\(|.+from\s+)['"](?:@?prisma|sequelize|mongoose|typeorm|drizzle|knex|pg|mysql|better-sqlite3|mikro-orm)/;

const EXCLUDE = ["node_modules", ".test.", ".spec.", "__tests__", ".d.ts", "dist/", "build/", "coverage/"];

/**
 * Run concurrency and async pattern checks on source files.
 *
 * @param projectPath - Absolute path to project root
 * @param resolution - Optional source resolution for multi-directory scanning
 * @returns Checker result with concurrency violations
 */
export function checkConcurrency(projectPath: string, resolution?: SourceResolution): CheckerResult {
  const violations: Violation[] = [];
  const sourceDirs = resolution?.sourceDirs ?? [join(projectPath, "src")];
  const globPattern = buildGlobPattern(resolution?.codeExtensions ?? [".ts", ".tsx", ".js", ".jsx"]);
  let filesScanned = 0;

  for (const srcDir of sourceDirs) {
    try {
      const files = globSync(globPattern, srcDir);

      for (const file of files) {
        if (EXCLUDE.some(p => file.includes(p))) continue;
        filesScanned++;

        const fullPath = join(srcDir, file);
        const relativePath = normalizePath(relative(projectPath, fullPath));

        let content: string;
        try {
          content = readFileSync(fullPath, "utf-8");
        } catch { continue; }

        const hasAsyncDb = ASYNC_DB_IMPORTS.test(content);

        for (const cp of CONCURRENCY_PATTERNS) {
          // "Missing Await" only applies to files with async DB imports
          if (cp.name === "Missing Await" && !hasAsyncDb) continue;

          const regex = new RegExp(cp.pattern.source, cp.pattern.flags);
          let match: RegExpExecArray | null;

          while ((match = regex.exec(content)) !== null) {
            const lineNumber = content.substring(0, match.index).split("\n").length;
            const lineContent = content.split("\n")[lineNumber - 1]?.trim() || "";
            if (lineContent.startsWith("//") || lineContent.startsWith("*")) continue;

            violations.push({
              ruleId: "20-concurrency",
              ruleName: cp.name,
              severity: cp.severity,
              category: "quality",
              filePath: relativePath,
              lineNumber,
              description: cp.description,
              suggestion: cp.suggestion,
            });
          }
        }
      }
    } catch { /* directory doesn't exist */ }
  }

  return { violations, filesScanned };
}
