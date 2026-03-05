/**
 * OWASP Top 10 and supply chain security checks.
 * Detects path traversal, SSRF, mass assignment, insecure deserialization,
 * and supply chain risks (lock files, pinned versions).
 *
 * @module OWASPChecker
 */

import { readFileSync, existsSync } from "fs";
import { join, relative } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { normalizePath, globSync, isInsideStringLiteral } from "../../utils/paths";

interface OWASPPattern {
  name: string;
  pattern: RegExp;
  severity: Violation["severity"];
  ruleId: string;
  description: string;
  suggestion: string;
}

const OWASP_PATTERNS: OWASPPattern[] = [
  {
    name: "Path Traversal",
    pattern: /(?:readFile|writeFile|createReadStream|open|access)\w*\s*\([^)]*(?:req\.|params\.|query\.|body\.)/gi,
    severity: "critical",
    ruleId: "17-owasp-top-ten",
    description: "User input used directly in file system operation — path traversal risk (A01)",
    suggestion: "Validate and sanitize file paths. Use path.resolve() and verify the result is within allowed directory",
  },
  {
    name: "SSRF Risk",
    pattern: /(?:fetch|axios|http\.get|https\.get|request)\s*\(\s*(?:req\.|params\.|query\.|body\.|`\$\{)/gi,
    severity: "critical",
    ruleId: "17-owasp-top-ten",
    description: "User input used in outbound HTTP request — SSRF risk (A10)",
    suggestion: "Validate URLs against an allowlist of trusted domains before making requests",
  },
  {
    name: "Mass Assignment",
    pattern: /(?:create|update|insert|save|findOneAnd|updateOne)\s*\(\s*(?:\.\.\.\s*req\.body|req\.body\b)/gi,
    severity: "warning",
    ruleId: "17-owasp-top-ten",
    description: "Request body spread directly into database operation — mass assignment risk (A01)",
    suggestion: "Explicitly pick allowed fields instead of spreading req.body directly",
  },
  {
    name: "Insecure Deserialization",
    pattern: /(?:JSON\.parse|deserialize|unserialize|pickle\.loads)\s*\(\s*(?:req\.|params\.|body\.|query\.)/gi,
    severity: "warning",
    ruleId: "17-owasp-top-ten",
    description: "Untrusted input passed to deserialization — injection risk (A08)",
    suggestion: "Validate and sanitize input before deserialization. Use schema validation (Zod, Joi)",
  },
  {
    name: "Missing Rate Limiting",
    pattern: /router\.(post|put|patch|delete)\s*\(\s*['"][^'"]*(?:login|auth|register|password|reset|token|signup)/gi,
    severity: "info",
    ruleId: "17-owasp-top-ten",
    description: "Sensitive endpoint without apparent rate limiting (A07)",
    suggestion: "Add rate limiting middleware to authentication and sensitive endpoints",
  },
];

const EXCLUDE = ["node_modules", ".test.", ".spec.", "__tests__", ".d.ts", "dist/", "build/", "coverage/"];

/**
 * Run OWASP Top 10 and supply chain security checks.
 *
 * @param projectPath - Absolute path to project root
 * @returns Checker result with OWASP violations
 */
export function checkOWASP(projectPath: string): CheckerResult {
  const violations: Violation[] = [];
  const srcPath = join(projectPath, "src");
  let filesScanned = 0;

  try {
    const files = globSync("**/*.{ts,tsx,js,jsx}", srcPath);

    for (const file of files) {
      if (EXCLUDE.some(p => file.includes(p))) continue;
      filesScanned++;

      const fullPath = join(srcPath, file);
      const relativePath = normalizePath(relative(projectPath, fullPath));

      let content: string;
      try {
        content = readFileSync(fullPath, "utf-8");
      } catch { continue; }

      const lines = content.split("\n");

      for (const op of OWASP_PATTERNS) {
        const regex = new RegExp(op.pattern.source, op.pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split("\n").length;
          const lineContent = lines[lineNumber - 1]?.trim() || "";
          if (lineContent.startsWith("//") || lineContent.startsWith("*")) continue;
          const pos = match.index - content.lastIndexOf("\n", match.index - 1) - 1;
          if (isInsideStringLiteral(lineContent, pos)) continue;

          violations.push({
            ruleId: op.ruleId,
            ruleName: op.name,
            severity: op.severity,
            category: "security",
            filePath: relativePath,
            lineNumber,
            description: op.description,
            suggestion: op.suggestion,
          });
        }
      }
    }
  } catch { /* src/ doesn't exist */ }

  // Supply chain checks (rule 30)
  checkSupplyChain(projectPath, violations);

  return { violations, filesScanned };
}

/**
 * Check supply chain security indicators.
 */
function checkSupplyChain(projectPath: string, violations: Violation[]): void {
  const hasLockFile =
    existsSync(join(projectPath, "package-lock.json")) ||
    existsSync(join(projectPath, "bun.lockb")) ||
    existsSync(join(projectPath, "yarn.lock")) ||
    existsSync(join(projectPath, "pnpm-lock.yaml"));

  if (!hasLockFile && existsSync(join(projectPath, "package.json"))) {
    violations.push({
      ruleId: "30-supply-chain-security",
      ruleName: "Missing Lock File",
      severity: "warning",
      category: "security",
      description: "No lock file found — dependency versions are not pinned",
      suggestion: "Run npm install / bun install to generate a lock file and commit it",
    });
  }

  // Check for wildcard versions in package.json
  try {
    const pkg = readFileSync(join(projectPath, "package.json"), "utf-8");
    const wildcardMatch = pkg.match(/"[^"]+"\s*:\s*"(\*|latest)"/g);
    if (wildcardMatch && wildcardMatch.length > 0) {
      violations.push({
        ruleId: "30-supply-chain-security",
        ruleName: "Unpinned Dependencies",
        severity: "warning",
        category: "security",
        description: `${wildcardMatch.length} dependency(ies) use wildcard (*) or "latest" version`,
        suggestion: "Pin all dependencies to specific versions or version ranges",
      });
    }
  } catch { /* no package.json */ }
}
