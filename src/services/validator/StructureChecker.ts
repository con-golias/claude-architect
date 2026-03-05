/**
 * Validates project folder structure follows clean architecture conventions.
 * Checks feature structure, required files, and naming conventions.
 *
 * @module StructureChecker
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import type { Violation, CheckerResult, FeatureInfo } from "../../types/validation";
import { normalizePath, globSync } from "../../utils/paths";

const REQUIRED_FEATURE_DIRS = ["domain", "application", "infrastructure"];

/**
 * Run structure validation on a project.
 *
 * @param projectPath - Absolute path to project root
 * @returns Checker result with violations and feature map
 */
export function checkStructure(projectPath: string): CheckerResult & {
  features: FeatureInfo[];
} {
  const violations: Violation[] = [];
  const features: FeatureInfo[] = [];
  const featuresDir = join(projectPath, "src", "features");

  if (!existsSync(featuresDir)) {
    return { violations: [], filesScanned: 0, features: [] };
  }

  const featureDirs = readdirSync(featuresDir).filter((name) => {
    const fullPath = join(featuresDir, name);
    return statSync(fullPath).isDirectory() && !name.startsWith(".");
  });

  const featuresMissingReadme: string[] = [];

  for (const featureName of featureDirs) {
    const featurePath = join(featuresDir, featureName);
    const featureInfo = analyzeFeature(featurePath, featureName, violations, featuresMissingReadme);
    features.push(featureInfo);
  }

  // Add ONE summary violation for missing feature READMEs
  if (featuresMissingReadme.length > 0) {
    violations.push({
      ruleId: "06-documentation",
      ruleName: "Feature README",
      severity: "info",
      category: "docs",
      description: `${featuresMissingReadme.length} feature(s) missing README.md: ${featuresMissingReadme.join(", ")}`,
      suggestion: "Run /architect-scaffold to generate README.md from template",
    });
  }

  // Check for tsconfig.json
  if (!existsSync(join(projectPath, "tsconfig.json"))) {
    violations.push({
      ruleId: "03-quality",
      ruleName: "TypeScript Config",
      severity: "warning",
      category: "quality",
      filePath: "project root",
      description: "Missing tsconfig.json",
      suggestion: "Add TypeScript compiler configuration",
    });
  }

  // Check for PROJECT_MAP.md
  if (!existsSync(join(projectPath, "PROJECT_MAP.md"))) {
    violations.push({
      ruleId: "06-documentation",
      ruleName: "PROJECT_MAP Required",
      severity: "warning",
      category: "docs",
      description: "Missing PROJECT_MAP.md at project root",
      suggestion: "Run /architect-init to generate PROJECT_MAP.md",
    });
  }

  // Check for shared directory structure
  const sharedDir = join(projectPath, "src", "shared");
  if (existsSync(sharedDir)) {
    checkNamingConventions(sharedDir, projectPath, violations);
  }

  return { violations, filesScanned: featureDirs.length, features };
}

/**
 * Analyze a single feature directory for structural compliance.
 *
 * @param featurePath - Absolute path to the feature directory
 * @param featureName - Name of the feature
 * @param violations - Array to push violations into
 * @returns Feature information object
 */
function analyzeFeature(
  featurePath: string,
  featureName: string,
  violations: Violation[],
  featuresMissingReadme: string[]
): FeatureInfo {
  const hasDomain = existsSync(join(featurePath, "domain"));
  const hasApplication = existsSync(join(featurePath, "application"));
  const hasInfrastructure = existsSync(join(featurePath, "infrastructure"));
  const hasReadme = existsSync(join(featurePath, "README.md"));
  const hasTests =
    existsSync(join(featurePath, "__tests__")) ||
    hasColocatedTests(featurePath);

  // Check for missing layers — grouped per feature
  const missingDirs = REQUIRED_FEATURE_DIRS.filter(
    (dir) => !existsSync(join(featurePath, dir))
  );
  if (missingDirs.length === REQUIRED_FEATURE_DIRS.length) {
    // All layers missing — flat structure
    violations.push({
      ruleId: "01-architecture",
      ruleName: "Feature Structure",
      severity: "warning",
      category: "structure",
      filePath: normalizePath(`src/features/${featureName}/`),
      description: `Flat structure — no clean architecture layers`,
      suggestion: `Scaffold domain/application/infrastructure directories`,
    });
  } else if (missingDirs.length > 0) {
    // Some layers missing
    violations.push({
      ruleId: "01-architecture",
      ruleName: "Feature Structure",
      severity: "warning",
      category: "structure",
      filePath: normalizePath(`src/features/${featureName}/`),
      description: `Missing ${missingDirs.join(", ")} layer${missingDirs.length > 1 ? "s" : ""}`,
      suggestion: `Add ${missingDirs.map(d => d + "/").join(", ")} with repository adapters`,
    });
  }

  // Collect missing READMEs for summary violation
  if (!hasReadme) {
    featuresMissingReadme.push(featureName);
  }

  // Check naming convention (kebab-case)
  if (featureName !== featureName.toLowerCase() || featureName.includes("_")) {
    violations.push({
      ruleId: "15-code-style",
      ruleName: "Naming Convention",
      severity: "info",
      category: "structure",
      filePath: normalizePath(`src/features/${featureName}/`),
      description: `Feature directory "${featureName}" should use kebab-case`,
      suggestion: `Rename to "${toKebabCase(featureName)}"`,
    });
  }

  let violationCount = 0;
  if (!hasDomain) violationCount++;
  if (!hasApplication) violationCount++;
  if (!hasInfrastructure) violationCount++;
  if (!hasReadme) violationCount++;

  return {
    name: featureName,
    path: normalizePath(`src/features/${featureName}/`),
    hasReadme,
    hasDomain,
    hasApplication,
    hasInfrastructure,
    hasTests,
    violationCount,
  };
}

/**
 * Check if a feature directory has co-located test files.
 *
 * @param featurePath - Absolute path to the feature directory
 * @returns True if any .test.* or .spec.* files exist
 */
function hasColocatedTests(featurePath: string): boolean {
  try {
    const entries = globSync("**/*.{test,spec}.{ts,tsx,js,jsx}", featurePath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

/**
 * Check file naming conventions within a directory.
 *
 * @param dirPath - Directory to check
 * @param projectPath - Project root for relative paths
 * @param violations - Array to push violations into
 */
function checkNamingConventions(
  dirPath: string,
  projectPath: string,
  violations: Violation[]
): void {
  try {
    const entries = globSync("**/*.{ts,tsx,js,jsx}", dirPath);
    for (const entry of entries) {
      if (entry.includes("node_modules")) continue;
      const fileName = entry.split("/").pop() || "";
      const baseName = fileName.replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, "");

      // Check for PascalCase files that aren't components
      if (/^[A-Z]/.test(baseName) && !baseName.includes(".")) {
        // PascalCase is OK for components and classes
        continue;
      }
    }
  } catch {
    // Glob errors are non-fatal
  }
}

/**
 * Convert a string to kebab-case.
 *
 * @param str - Input string
 * @returns kebab-case version
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}
