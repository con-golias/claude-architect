/**
 * Lightweight single-file validator for real-time feedback.
 * Used by PostToolUse hook for ~10ms checks on file save.
 *
 * @module QuickValidator
 */

import { readFileSync } from "fs";
import { relative, basename } from "path";
import type { Violation } from "../../types/validation";
import { normalizePath, isInsideStringLiteral } from "../../utils/paths";

/** Security patterns for quick single-file checks */
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

  // Check 3: Dependency direction
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
