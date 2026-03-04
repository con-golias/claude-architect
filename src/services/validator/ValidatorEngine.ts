/**
 * Main validation orchestrator for claude-architect.
 * Combines all checkers and produces a unified compliance report.
 *
 * @module ValidatorEngine
 */

import { readFileSync, statSync } from "fs";
import { relative, basename, dirname } from "path";
import type { ComplianceReport, Violation, FeatureInfo } from "../../types/validation";
import { checkDependencies } from "./DependencyChecker";
import { checkStructure } from "./StructureChecker";
import { checkSecurity } from "./SecurityChecker";
import { checkQuality } from "./QualityChecker";
import {
  calculateOverallScore,
  calculateCategoryScores,
  countBySeverity,
  countByRule,
} from "./ComplianceScorer";
import { normalizePath, isInsideStringLiteral } from "../../utils/paths";
import { logger } from "../../utils/logger";

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

  // Run structure checks
  if (shouldRunCategory("structure", options.categories)) {
    const structResult = checkStructure(projectPath);
    allViolations.push(...structResult.violations);
    features = structResult.features;
  }

  // Run security checks
  if (shouldRunCategory("security", options.categories)) {
    const secResult = checkSecurity(projectPath);
    allViolations.push(...secResult.violations);
    totalFiles = Math.max(totalFiles, secResult.filesScanned);
  }

  // Run quality checks
  if (
    shouldRunCategory("quality", options.categories) ||
    shouldRunCategory("docs", options.categories)
  ) {
    const qualResult = checkQuality(projectPath);
    allViolations.push(...qualResult.violations);
    totalFiles = Math.max(totalFiles, qualResult.filesScanned);
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

/** Security patterns for quick single-file checks */
const QUICK_SECURITY_PATTERNS = [
  {
    name: "Hardcoded API Key",
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi,
    severity: "critical" as const,
    description: "Potential hardcoded API key detected",
  },
  {
    name: "Hardcoded Secret",
    pattern: /(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: "critical" as const,
    description: "Potential hardcoded secret/password detected",
  },
  {
    name: "SQL String Concatenation",
    pattern: /(?:query|exec|execute|raw)\s*\(\s*[`'"].*\$\{.*\}.*[`'"]\s*\)/gi,
    severity: "critical" as const,
    description: "Potential SQL injection via string interpolation",
  },
  {
    name: "eval() Usage",
    pattern: /\beval\s*\(/gi,
    severity: "critical" as const,
    description: "Use of eval() — code injection vulnerability",
  },
];

/** Forbidden import directions in clean architecture */
const FORBIDDEN_IMPORTS: Record<string, string[]> = {
  domain: ["infrastructure", "application"],
  application: ["infrastructure"],
};

/**
 * Run a quick, lightweight validation on a single changed file.
 * Used by PostToolUse hook for fast feedback (~10ms instead of seconds).
 *
 * @param projectPath - Absolute path to project root
 * @param changedFile - Absolute path to the specific file that changed
 * @returns Array of violations for the changed file only
 */
export function quickValidate(
  projectPath: string,
  changedFile: string
): Violation[] {
  const violations: Violation[] = [];
  const fileName = basename(changedFile);

  // Skip test files and non-source files
  if (/\.(test|spec)\./i.test(fileName) || !/\.(ts|tsx|js|jsx)$/i.test(fileName)) {
    return violations;
  }

  let content: string;
  try {
    content = readFileSync(changedFile, "utf-8");
  } catch {
    return violations;
  }

  const relativePath = normalizePath(relative(projectPath, changedFile));
  const lines = content.split("\n");

  // Check 1: File size (>200 lines)
  if (lines.length > 200) {
    violations.push({
      ruleId: "15-code-style",
      ruleName: "File Too Long",
      severity: "warning",
      category: "quality",
      filePath: relativePath,
      description: `File has ${lines.length} lines (limit: 200)`,
      suggestion: "Split into smaller, focused modules",
    });
  }

  // Check 2: Security patterns
  for (const sp of QUICK_SECURITY_PATTERNS) {
    const regex = new RegExp(sp.pattern.source, sp.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split("\n").length;
      const lineContent = lines[lineNumber - 1]?.trim() || "";
      if (lineContent.startsWith("//") || lineContent.startsWith("*")) continue;
      const matchStartInLine = match.index - content.lastIndexOf("\n", match.index - 1) - 1;
      if (isInsideStringLiteral(lineContent, matchStartInLine)) continue;

      violations.push({
        ruleId: "02-security",
        ruleName: sp.name,
        severity: sp.severity,
        category: "security",
        filePath: relativePath,
        lineNumber,
        description: sp.description,
      });
    }
  }

  // Check 3: Dependency direction (based on file path)
  const normalizedRelPath = normalizePath(relativePath);
  const layerMatch = normalizedRelPath.match(/\/(?:domain|application|infrastructure)\//);
  if (layerMatch) {
    const currentLayer = layerMatch[0].replace(/\//g, "");
    const forbidden = FORBIDDEN_IMPORTS[currentLayer];
    if (forbidden) {
      for (const line of lines) {
        const importMatch = line.match(/(?:import|from)\s+['"]([^'"]+)['"]/);
        if (!importMatch) continue;
        const importPath = importMatch[1];
        for (const forbiddenLayer of forbidden) {
          if (importPath.includes(`/${forbiddenLayer}/`) || importPath.includes(`\\${forbiddenLayer}\\`)) {
            violations.push({
              ruleId: "01-architecture",
              ruleName: "Dependency Direction",
              severity: "critical",
              category: "dependency",
              filePath: relativePath,
              description: `${currentLayer} layer imports from ${forbiddenLayer} (forbidden)`,
              suggestion: `Define a port interface in ${currentLayer}/ and implement in ${forbiddenLayer}/`,
            });
            break;
          }
        }
      }
    }
  }

  return violations;
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
