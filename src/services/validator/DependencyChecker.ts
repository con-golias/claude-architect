/**
 * Validates import direction follows clean architecture rules.
 * Domain never imports from application/infrastructure.
 * Application never imports from infrastructure.
 * No direct cross-feature imports.
 *
 * @module DependencyChecker
 */

import { readFileSync, existsSync } from "fs";
import { join, relative } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { normalizePath, globSync } from "../../utils/paths";
import type { SourceResolution } from "../../utils/sourceResolver";

const IMPORT_PATTERNS = [
  /import\s+.*from\s+['"](.+)['"]/g,
  /import\s*\(\s*['"](.+)['"]\s*\)/g,
  /require\s*\(\s*['"](.+)['"]\s*\)/g,
];

type Layer = "domain" | "application" | "infrastructure" | "unknown";

/** Determine which architectural layer a file belongs to. */
function getLayer(filePath: string): Layer {
  const parts = normalizePath(filePath).split("/");
  if (parts.includes("domain")) return "domain";
  if (parts.includes("application")) return "application";
  if (parts.includes("infrastructure")) return "infrastructure";
  return "unknown";
}

/** Extract the feature name from a file path. */
function getFeatureName(filePath: string): string | null {
  const match = normalizePath(filePath).match(
    /src\/features\/([^/]+)\//
  );
  return match ? match[1] : null;
}

/** Extract import paths from a source file. */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  for (const pattern of IMPORT_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }
  return imports;
}

/** Check if an import is a relative path. */
function isRelativeImport(importPath: string): boolean {
  return importPath.startsWith(".");
}

/**
 * Run dependency direction validation on a project.
 *
 * @param projectPath - Absolute path to project root
 * @returns Checker result with violations found
 */
export function checkDependencies(projectPath: string, resolution?: SourceResolution): CheckerResult {
  const violations: Violation[] = [];
  const srcPath = join(projectPath, "src");

  if (!existsSync(srcPath)) {
    return { violations: [], filesScanned: 0 };
  }

  // Only meaningful for clean architecture projects
  if (resolution && !resolution.hasCleanArchitecture) {
    return { violations: [], filesScanned: 0 };
  }

  const sourceFiles = findSourceFiles(srcPath);
  let filesScanned = 0;

  for (const filePath of sourceFiles) {
    filesScanned++;
    const relativePath = normalizePath(relative(projectPath, filePath));
    const fileLayer = getLayer(relativePath);
    const fileFeature = getFeatureName(relativePath);

    if (fileLayer === "unknown") continue;

    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const imports = extractImports(content);

    for (const importPath of imports) {
      if (!isRelativeImport(importPath)) continue;

      const violation = checkImportViolation(
        relativePath,
        importPath,
        fileLayer,
        fileFeature
      );
      if (violation) {
        violations.push({
          ...violation,
          filePath: relativePath,
        });
      }
    }
  }

  return { violations, filesScanned };
}

/** Check a single import for architecture violations. */
function checkImportViolation(
  sourceFile: string,
  importPath: string,
  sourceLayer: Layer,
  sourceFeature: string | null
): Omit<Violation, "filePath"> | null {
  const normalizedImport = normalizePath(importPath);

  // Domain importing from application or infrastructure
  if (sourceLayer === "domain") {
    if (
      normalizedImport.includes("/application/") ||
      normalizedImport.includes("/infrastructure/")
    ) {
      const targetLayer = normalizedImport.includes("/application/")
        ? "application"
        : "infrastructure";
      return {
        ruleId: "01-architecture",
        ruleName: "Dependency Direction",
        severity: "critical",
        category: "dependency",
        description: `Domain layer imports from ${targetLayer} layer: "${importPath}"`,
        suggestion: `Move the dependency to a port interface in domain/ and implement it in infrastructure/`,
      };
    }
  }

  // Application importing from infrastructure
  if (sourceLayer === "application") {
    if (normalizedImport.includes("/infrastructure/")) {
      return {
        ruleId: "01-architecture",
        ruleName: "Dependency Direction",
        severity: "critical",
        category: "dependency",
        description: `Application layer imports from infrastructure layer: "${importPath}"`,
        suggestion: `Define a port interface in domain/ and inject the infrastructure implementation`,
      };
    }
  }

  // Cross-feature imports
  if (sourceFeature && normalizedImport.includes("/features/")) {
    const importFeatureMatch = normalizedImport.match(
      /features\/([^/]+)\//
    );
    if (importFeatureMatch && importFeatureMatch[1] !== sourceFeature) {
      return {
        ruleId: "01-architecture",
        ruleName: "Cross-Feature Isolation",
        severity: "warning",
        category: "dependency",
        description: `Direct import from feature "${importFeatureMatch[1]}": "${importPath}"`,
        suggestion: `Use shared contracts in src/shared/contracts/ or domain events instead`,
      };
    }
  }

  return null;
}

/** Find all TypeScript/JavaScript source files recursively. */
function findSourceFiles(dirPath: string): string[] {
  const files: string[] = [];
  const entries = globSync("**/*.{ts,tsx,js,jsx}", dirPath);
  for (const entry of entries) {
    if (
      !entry.includes("node_modules") &&
      !entry.includes(".test.") &&
      !entry.includes(".spec.")
    ) {
      files.push(join(dirPath, entry));
    }
  }
  return files;
}
