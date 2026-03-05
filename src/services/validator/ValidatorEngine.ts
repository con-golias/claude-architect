/**
 * Main validation orchestrator for claude-architect.
 * Combines all 10 checkers and produces a unified compliance report.
 *
 * @module ValidatorEngine
 */

import type { ComplianceReport, Violation, FeatureInfo } from "../../types/validation";
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
 * Executes all checkers and produces a unified compliance report.
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
  logger.info("Starting validation", { projectPath });

  let allViolations: Violation[] = [];
  let features: FeatureInfo[] = [];
  let totalFiles = 0;

  // Run dependency checks
  if (shouldRunCategory("dependency", options.categories)) {
    const depResult = checkDependencies(projectPath);
    allViolations.push(...depResult.violations);
    totalFiles += depResult.filesScanned;
  }

  // Run structure checks (includes API pattern checks)
  if (shouldRunCategory("structure", options.categories)) {
    const structResult = checkStructure(projectPath);
    allViolations.push(...structResult.violations);
    features = structResult.features;

    const apiResult = checkAPIPatterns(projectPath);
    allViolations.push(...apiResult.violations);
    totalFiles = Math.max(totalFiles, apiResult.filesScanned);
  }

  // Run security checks (original + OWASP + privacy)
  if (shouldRunCategory("security", options.categories)) {
    const secResult = checkSecurity(projectPath);
    allViolations.push(...secResult.violations);
    totalFiles = Math.max(totalFiles, secResult.filesScanned);

    const owaspResult = checkOWASP(projectPath);
    allViolations.push(...owaspResult.violations);

    const privacyResult = checkPrivacy(projectPath);
    allViolations.push(...privacyResult.violations);
  }

  // Run base quality checker (produces both quality and docs violations)
  if (
    shouldRunCategory("quality", options.categories) ||
    shouldRunCategory("docs", options.categories)
  ) {
    const qualResult = checkQuality(projectPath);
    allViolations.push(...qualResult.violations);
    totalFiles = Math.max(totalFiles, qualResult.filesScanned);
  }

  // Run advanced quality checkers — only for quality category, NOT docs
  if (shouldRunCategory("quality", options.categories)) {
    const concResult = checkConcurrency(projectPath);
    allViolations.push(...concResult.violations);

    const a11yResult = checkAccessibility(projectPath);
    allViolations.push(...a11yResult.violations);

    const advResult = checkAdvancedQuality(projectPath);
    allViolations.push(...advResult.violations);
  }

  // Filter by severity if specified
  if (options.severity) {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const minLevel = severityOrder[options.severity];
    allViolations = allViolations.filter(
      (v) => severityOrder[v.severity] <= minLevel
    );
  }

  const overallScore = calculateOverallScore(allViolations);
  const scoresByCategory = calculateCategoryScores(allViolations);

  const duration = Date.now() - startTime;
  logger.info("Validation complete", {
    projectPath,
    score: overallScore,
    violations: allViolations.length,
    duration,
  });

  return {
    overallScore,
    scoresByCategory,
    totalFeatures: features.length,
    totalFiles,
    violations: allViolations,
    featureMap: features,
    trend: "stable",
    timestamp: Date.now(),
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
