/**
 * Project-level baseline checks.
 * Detects missing fundamental elements: tests, README, CI, linter config.
 *
 * @module BaselineChecker
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { globSync } from "../../utils/paths";

/** Test file glob patterns to search across the entire project. */
const TEST_PATTERNS = [
  "**/*.test.{ts,tsx,js,jsx,py}",
  "**/*.spec.{ts,tsx,js,jsx,py}",
  "**/__tests__/**/*.{ts,tsx,js,jsx,py}",
  "**/test/**/*.{ts,tsx,js,jsx,py}",
  "**/tests/**/*.{ts,tsx,js,jsx,py}",
];

/** Known linter/formatter config files. */
const LINTER_CONFIGS = [
  ".eslintrc", ".eslintrc.js", ".eslintrc.cjs", ".eslintrc.json", ".eslintrc.yml",
  "eslint.config.js", "eslint.config.mjs", "eslint.config.ts",
  "biome.json", "biome.jsonc",
  ".prettierrc", ".prettierrc.js", ".prettierrc.json", ".prettierrc.yml",
  "ruff.toml", ".flake8", ".pylintrc",
];

/** Known CI config paths. */
const CI_CONFIGS = [
  ".github/workflows", ".gitlab-ci.yml", "Jenkinsfile",
  ".circleci", ".travis.yml", "azure-pipelines.yml",
];

/**
 * Run baseline project-level checks.
 *
 * @param projectPath - Absolute path to project root
 * @returns Checker result with baseline violations
 */
export function checkBaseline(projectPath: string): CheckerResult {
  const violations: Violation[] = [];

  checkReadme(projectPath, violations);
  const testCount = checkTestExistence(projectPath, violations);
  checkLinterConfig(projectPath, violations);
  checkCIConfig(projectPath, violations);
  checkPackageScripts(projectPath, violations);
  checkGitignore(projectPath, violations);

  return { violations, filesScanned: testCount };
}

/** Check for README.md at project root. */
function checkReadme(projectPath: string, violations: Violation[]): void {
  const hasReadme = existsSync(join(projectPath, "README.md"))
    || existsSync(join(projectPath, "readme.md"))
    || existsSync(join(projectPath, "README"));
  if (!hasReadme) {
    violations.push({
      ruleId: "06-documentation", ruleName: "Documentation",
      severity: "warning", category: "docs",
      description: "Project has no README.md file",
      suggestion: "Create a README.md with project description, setup instructions, and usage examples",
    });
  }
}

/** Check for test files anywhere in the project. Returns count found. */
function checkTestExistence(projectPath: string, violations: Violation[]): number {
  let total = 0;
  for (const pattern of TEST_PATTERNS) {
    try {
      const files = globSync(pattern, projectPath)
        .filter((f) => !f.includes("node_modules") && !f.includes("dist"));
      total += files.length;
    } catch { /* directory might not exist */ }
  }

  if (total === 0) {
    violations.push({
      ruleId: "03-testing", ruleName: "Testing",
      severity: "warning", category: "quality",
      description: "No test files found anywhere in the project",
      suggestion: "Add test files (*.test.ts, *.spec.ts, or __tests__/) for critical functionality",
    });
  }
  return total;
}

/** Check for linter/formatter configuration. */
function checkLinterConfig(projectPath: string, violations: Violation[]): void {
  const hasLinter = LINTER_CONFIGS.some((c) => existsSync(join(projectPath, c)));
  if (!hasLinter) {
    violations.push({
      ruleId: "15-code-style", ruleName: "Code Style",
      severity: "info", category: "quality",
      description: "No linter or formatter configuration found",
      suggestion: "Add ESLint, Biome, or Prettier config for consistent code style",
    });
  }
}

/** Check for CI/CD configuration. */
function checkCIConfig(projectPath: string, violations: Violation[]): void {
  const hasCI = CI_CONFIGS.some((c) => existsSync(join(projectPath, c)));
  if (!hasCI) {
    violations.push({
      ruleId: "16-ci-cd", ruleName: "CI/CD",
      severity: "info", category: "quality",
      description: "No CI/CD configuration found",
      suggestion: "Add GitHub Actions, GitLab CI, or similar for automated testing and deployment",
    });
  }
}

/** Check package.json for test script. */
function checkPackageScripts(projectPath: string, violations: Violation[]): void {
  const pkgPath = join(projectPath, "package.json");
  if (!existsSync(pkgPath)) return;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    if (!pkg.scripts?.test || pkg.scripts.test.includes("no test specified")) {
      violations.push({
        ruleId: "03-testing", ruleName: "Testing",
        severity: "info", category: "quality",
        description: "package.json has no test script configured",
        suggestion: "Add a 'test' script to package.json (e.g., \"test\": \"jest\" or \"test\": \"vitest\")",
      });
    }
  } catch { /* invalid JSON */ }
}

/** Check for .gitignore when .git exists. */
function checkGitignore(projectPath: string, violations: Violation[]): void {
  if (!existsSync(join(projectPath, ".git"))) return;
  if (!existsSync(join(projectPath, ".gitignore"))) {
    violations.push({
      ruleId: "09-git-workflow", ruleName: "Git Workflow",
      severity: "info", category: "quality",
      description: "Git repository has no .gitignore file",
      suggestion: "Add a .gitignore to exclude node_modules/, dist/, .env, and other generated files",
    });
  }
}
