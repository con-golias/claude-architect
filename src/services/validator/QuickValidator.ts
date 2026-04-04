/**
 * Lightweight single-file validator for real-time feedback.
 * Used by PostToolUse hook for ~10ms checks on file save.
 *
 * @module QuickValidator
 */

import { readFileSync, existsSync } from "fs";
import { relative, basename, dirname, join } from "path";
import type { Violation } from "../../types/validation";
import { normalizePath, isInsideStringLiteral } from "../../utils/paths";

const QUICK_SECURITY_PATTERNS = [
  {
    name: "Hardcoded API Key",
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{10,}['"]/gi,
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
    pattern: /(?:query|sql|exec|execute|raw|stmt|statement)\s*(?:=|:\s*|\()\s*[`'"].*\$\{.*\}.*[`'"]/gi,
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

const FORBIDDEN_IMPORTS: Record<string, string[]> = {
  domain: ["infrastructure", "application"],
  application: ["infrastructure"],
};

/**
 * Run a quick, lightweight validation on a single changed file.
 *
 * @param projectPath - Absolute path to project root
 * @param changedFile - Absolute path to the specific file that changed
 * @returns Array of violations for the changed file only
 */
export function quickValidate(projectPath: string, changedFile: string): Violation[] {
  const violations: Violation[] = [];
  const fileName = basename(changedFile);

  if (/\.(test|spec)\./i.test(fileName) || !/\.(ts|tsx|js|jsx|py|go|rb|java|kt|cs)$/i.test(fileName)) {
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

  if (lines.length > 200) {
    violations.push({
      ruleId: "15-code-style", ruleName: "File Too Long", severity: "warning",
      category: "quality", filePath: relativePath,
      description: `File has ${lines.length} lines (limit: 200)`,
      suggestion: "Split into smaller, focused modules",
    });
  }

  checkSecurityPatterns(content, lines, relativePath, violations);
  checkDependencyDirection(relativePath, lines, violations);
  checkScaffoldCompliance(projectPath, relativePath, content, violations);

  return violations;
}

function checkSecurityPatterns(content: string, lines: string[], relativePath: string, violations: Violation[]): void {
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
        ruleId: "02-security", ruleName: sp.name, severity: sp.severity,
        category: "security", filePath: relativePath, lineNumber, description: sp.description,
      });
    }
  }
}

function checkDependencyDirection(relativePath: string, lines: string[], violations: Violation[]): void {
  const normalized = normalizePath(relativePath);
  const layerMatch = normalized.match(/\/(?:domain|application|infrastructure)\//);
  if (!layerMatch) return;

  const currentLayer = layerMatch[0].replace(/\//g, "");
  const forbidden = FORBIDDEN_IMPORTS[currentLayer];
  if (!forbidden) return;

  for (const line of lines) {
    const importMatch = line.match(/(?:import|from|require)\s*\(?['"]([^'"]+)['"]/);
    if (!importMatch) continue;
    for (const forbiddenLayer of forbidden) {
      if (importMatch[1].includes(`/${forbiddenLayer}/`) || importMatch[1].includes(`\\${forbiddenLayer}\\`)) {
        violations.push({
          ruleId: "01-architecture", ruleName: "Dependency Direction", severity: "critical",
          category: "dependency", filePath: relativePath,
          description: `${currentLayer} layer imports from ${forbiddenLayer} (forbidden)`,
          suggestion: `Define a port interface in ${currentLayer}/ and implement in ${forbiddenLayer}/`,
        });
        break;
      }
    }
  }
}

/**
 * Check if a file in a scaffolded feature respects the layer structure.
 * Detects: flat files bypassing scaffold, controllers importing repos directly.
 */
function checkScaffoldCompliance(
  projectPath: string, relativePath: string, content: string, violations: Violation[],
): void {
  const normalized = normalizePath(relativePath);
  const featureMatch = normalized.match(/src\/features\/([^/]+)\/(.+)/);
  if (!featureMatch) return;

  const [, featureName, fileInFeature] = featureMatch;
  const featureDir = join(projectPath, "src", "features", featureName);

  // Only enforce if scaffold layers exist (scaffold was used)
  const hasScaffoldLayers =
    existsSync(join(featureDir, "domain")) ||
    existsSync(join(featureDir, "application")) ||
    existsSync(join(featureDir, "infrastructure"));
  if (!hasScaffoldLayers) return;

  // Flat file at feature root (not in any layer subdirectory)
  const isInLayer = /^(domain|application|infrastructure|__tests__)\//.test(fileInFeature);
  const isReadme = /readme/i.test(fileInFeature);
  const isIndex = /^index\./i.test(fileInFeature);
  if (!isInLayer && !fileInFeature.includes("/") && !isReadme && !isIndex) {
    violations.push({
      ruleId: "01-architecture", ruleName: "Scaffold Structure Bypassed",
      severity: "warning", category: "structure", filePath: relativePath,
      description: `File "${basename(relativePath)}" is at feature root, bypassing scaffold layers`,
      suggestion: "Move to: domain/ (entities), application/use-cases/ (logic), infrastructure/controllers/ (routes), infrastructure/repositories/ (DB)",
    });
  }

  // Controller imports repository directly without use-case layer
  if (/controller/i.test(relativePath)) {
    const importLines = content.split("\n").filter((l) => /require|import/.test(l));
    const importsRepo = importLines.some((l) => /repository|\.repository/i.test(l));
    const importsDb = importLines.some((l) => /database|\.db|getDb|connection/i.test(l));
    const importsUseCase = importLines.some((l) => /use-case|UseCase|usecase/i.test(l));

    if ((importsRepo || importsDb) && !importsUseCase) {
      violations.push({
        ruleId: "01-architecture", ruleName: "Controller Bypasses Use-Case Layer",
        severity: "warning", category: "dependency", filePath: relativePath,
        description: "Controller imports repositories/DB directly — business logic should go through use-cases",
        suggestion: "Create use-case classes in application/use-cases/ and have controllers delegate to them",
      });
    }
  }
}
