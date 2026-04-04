/**
 * Main validation orchestrator for claude-architect.
 * Combines all checkers and produces a unified compliance report.
 *
 * @module ValidatorEngine
 */

import type { ComplianceReport, Violation, FeatureInfo } from "../../types/validation";
import { resolveSourcePaths } from "../../utils/sourceResolver";
import { checkDependencies } from "./DependencyChecker";
import { checkStructure } from "./StructureChecker";
import { checkSecurity } from "./SecurityChecker";
import { checkQuality } from "./QualityChecker";
import { checkOWASP } from "./OWASPChecker";
import { checkPrivacy } from "./PrivacyChecker";
import { checkConcurrency } from "./ConcurrencyChecker";
import { checkAccessibility } from "./AccessibilityChecker";
import { checkAdvancedQuality } from "./AdvancedQualityChecker";
import { checkAPIPatterns } from "./APIPatternChecker";
import { checkBaseline } from "./BaselineChecker";
import { checkDocumentation } from "./DocumentationChecker";
import { calculateOverallScore, calculateCategoryScores } from "./ComplianceScorer";
import { logger } from "../../utils/logger";

// Re-export quickValidate for backward compatibility
export { quickValidate } from "./QuickValidator";

interface ValidateOptions {
  /** Filter to specific categories */
  categories?: string[];
  /** Minimum severity to report */
  severity?: "critical" | "warning" | "info";
}

/**
 * Run full architecture compliance validation on a project.
 * Detects project type once and passes resolution to all checkers.
 *
 * @param projectPath - Absolute path to project root
 * @param options - Validation options
 * @returns Full compliance report with score, violations, and feature map
 */
export function validateProject(
  projectPath: string,
  options: ValidateOptions = {}
): ComplianceReport {
  const startTime = Date.now();
  const resolution = resolveSourcePaths(projectPath);
  logger.info("Starting validation", {
    projectPath,
    projectTypes: resolution.projectTypes,
    sourceDirs: resolution.sourceDirs.length,
  });

  let allViolations: Violation[] = [];
  let features: FeatureInfo[] = [];
  // Track max files across checkers that scan the same file set,
  // rather than summing (which would double-count shared files).
  let maxFilesScanned = 0;

  // Always run baseline project-level checks
  const baselineResult = checkBaseline(projectPath);
  allViolations.push(...baselineResult.violations);

  // Run dependency checks
  if (shouldRunCategory("dependency", options.categories)) {
    const depResult = checkDependencies(projectPath, resolution);
    allViolations.push(...depResult.violations);
    maxFilesScanned = Math.max(maxFilesScanned, depResult.filesScanned);
  }

  // Run structure checks (includes API pattern checks)
  if (shouldRunCategory("structure", options.categories)) {
    const structResult = checkStructure(projectPath, resolution);
    allViolations.push(...structResult.violations);
    features = structResult.features;

    const apiResult = checkAPIPatterns(projectPath, resolution);
    allViolations.push(...apiResult.violations);
    maxFilesScanned = Math.max(maxFilesScanned, apiResult.filesScanned);
  }

  // Run security checks (original + OWASP + privacy)
  if (shouldRunCategory("security", options.categories)) {
    const secResult = checkSecurity(projectPath, resolution);
    allViolations.push(...secResult.violations);
    maxFilesScanned = Math.max(maxFilesScanned, secResult.filesScanned);

    const owaspResult = checkOWASP(projectPath, resolution);
    allViolations.push(...owaspResult.violations);

    const privacyResult = checkPrivacy(projectPath, resolution);
    allViolations.push(...privacyResult.violations);
  }

  // Run base quality checker (produces both quality and docs violations)
  if (
    shouldRunCategory("quality", options.categories) ||
    shouldRunCategory("docs", options.categories)
  ) {
    const qualResult = checkQuality(projectPath, resolution);
    allViolations.push(...qualResult.violations);
    maxFilesScanned = Math.max(maxFilesScanned, qualResult.filesScanned);
  }

  // Run advanced quality checkers — only for quality category, NOT docs
  if (shouldRunCategory("quality", options.categories)) {
    const concResult = checkConcurrency(projectPath, resolution);
    allViolations.push(...concResult.violations);

    const a11yResult = checkAccessibility(projectPath, resolution);
    allViolations.push(...a11yResult.violations);

    const advResult = checkAdvancedQuality(projectPath, resolution);
    allViolations.push(...advResult.violations);
  }

  // Run documentation checks
  if (
    shouldRunCategory("docs", options.categories) ||
    shouldRunCategory("quality", options.categories)
  ) {
    const docResult = checkDocumentation(projectPath, resolution);
    allViolations.push(...docResult.violations);
    maxFilesScanned = Math.max(maxFilesScanned, docResult.filesScanned);
  }

  // Filter by severity if specified
  if (options.severity) {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const minLevel = severityOrder[options.severity];
    allViolations = allViolations.filter(
      (v) => severityOrder[v.severity] <= minLevel
    );
  }

  const overallScore = calculateOverallScore(allViolations, maxFilesScanned);
  const scoresByCategory = calculateCategoryScores(allViolations);
  const scanCoverage = maxFilesScanned === 0 ? "none" as const : "full" as const;

  const duration = Date.now() - startTime;
  logger.info("Validation complete", {
    projectPath,
    score: overallScore,
    violations: allViolations.length,
    duration,
    scanCoverage,
  });

  return {
    overallScore,
    scoresByCategory,
    totalFeatures: features.length,
    totalFiles: maxFilesScanned,
    violations: allViolations,
    featureMap: features,
    trend: "stable",
    timestamp: Date.now(),
    scanCoverage,
  };
}

/**
 * Determine if a category should be checked based on filter.
 *
 * @param category - Category to check
 * @param filter - Optional category filter list
 * @returns True if category should be checked
 */
function shouldRunCategory(
  category: string,
  filter?: string[]
): boolean {
  if (!filter || filter.length === 0) return true;
  return filter.includes(category);
}
