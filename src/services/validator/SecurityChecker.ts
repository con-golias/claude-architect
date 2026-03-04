/**
 * Detects common security anti-patterns in source code.
 * Checks for hardcoded secrets, SQL injection risks, XSS vulnerabilities.
 *
 * @module SecurityChecker
 */

import { readFileSync } from "fs";
import { join, relative } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { normalizePath, globSync } from "../../utils/paths";

interface SecurityPattern {
  name: string;
  pattern: RegExp;
  severity: Violation["severity"];
  description: string;
  suggestion: string;
}

const SECURITY_PATTERNS: SecurityPattern[] = [
  {
    name: "Hardcoded API Key",
    pattern:
      /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi,
    severity: "critical",
    description: "Potential hardcoded API key detected",
    suggestion:
      "Move to environment variable: process.env.API_KEY or use a secrets manager",
  },
  {
    name: "Hardcoded Secret",
    pattern:
      /(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: "critical",
    description: "Potential hardcoded secret/password detected",
    suggestion:
      "Move to environment variable or secrets manager. Never commit secrets to source code",
  },
  {
    name: "SQL String Concatenation",
    pattern:
      /(?:query|exec|execute|raw)\s*\(\s*[`'"].*\$\{.*\}.*[`'"]\s*\)/gi,
    severity: "critical",
    description: "Potential SQL injection via string concatenation/template literals",
    suggestion:
      "Use parameterized queries or prepared statements instead of string interpolation",
  },
  {
    name: "SQL Concatenation (plus operator)",
    pattern:
      /(?:query|exec|execute)\s*\(\s*['"].*['"]\s*\+\s*(?:req\.|params\.|body\.|query\.)/gi,
    severity: "critical",
    description: "SQL query built with string concatenation using user input",
    suggestion: "Use parameterized queries: db.query('SELECT * FROM x WHERE id = ?', [id])",
  },
  {
    name: "Dangerous innerHTML",
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{.*__html.*\}\s*\}/gi,
    severity: "warning",
    description: "Use of dangerouslySetInnerHTML — potential XSS vulnerability",
    suggestion:
      "Sanitize content with DOMPurify before rendering, or use safe alternatives",
  },
  {
    name: "innerHTML Assignment",
    pattern: /\.innerHTML\s*=\s*(?!['"]<)/gi,
    severity: "warning",
    description: "Direct innerHTML assignment with dynamic content — XSS risk",
    suggestion:
      "Use textContent for text, or sanitize HTML before assigning to innerHTML",
  },
  {
    name: "eval() Usage",
    pattern: /\beval\s*\(/gi,
    severity: "critical",
    description: "Use of eval() — code injection vulnerability",
    suggestion:
      "Never use eval(). Use JSON.parse() for data, or safer alternatives for dynamic code",
  },
  {
    name: "Disabled HTTPS Verification",
    pattern:
      /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?|rejectUnauthorized\s*:\s*false/gi,
    severity: "critical",
    description: "TLS/SSL certificate verification is disabled",
    suggestion:
      "Never disable certificate verification in production. Fix the certificate issue instead",
  },
  {
    name: "Wildcard CORS",
    pattern: /(?:cors|Access-Control-Allow-Origin)\s*[:=]\s*['"]?\*['"]?/gi,
    severity: "warning",
    description: "CORS allows all origins (*) — overly permissive",
    suggestion:
      "Configure CORS with explicit origin allowlist instead of wildcard",
  },
  {
    name: "Console.log in Production",
    pattern: /console\.(log|debug|trace)\s*\(/g,
    severity: "info",
    description: "console.log found — use structured logging in production",
    suggestion:
      "Replace with structured logger (e.g., winston, pino) for production code",
  },
];

/** File extensions to exclude from security scanning */
const EXCLUDE_PATTERNS = [
  "node_modules",
  ".test.",
  ".spec.",
  "__tests__",
  ".d.ts",
  ".min.js",
  "dist/",
  "build/",
  "coverage/",
];

/**
 * Run security pattern checks on a project's source files.
 *
 * @param projectPath - Absolute path to project root
 * @returns Checker result with security violations
 */
export function checkSecurity(projectPath: string): CheckerResult {
  const violations: Violation[] = [];
  const srcPath = join(projectPath, "src");

  let filesScanned = 0;

  try {
    const files = globSync("**/*.{ts,tsx,js,jsx,py}", srcPath);

    for (const file of files) {
      if (EXCLUDE_PATTERNS.some((p) => file.includes(p))) continue;

      filesScanned++;
      const fullPath = join(srcPath, file);
      const relativePath = normalizePath(relative(projectPath, fullPath));

      let content: string;
      try {
        content = readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      const lines = content.split("\n");

      for (const secPattern of SECURITY_PATTERNS) {
        const regex = new RegExp(secPattern.pattern.source, secPattern.pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split("\n").length;
          const lineContent = lines[lineNumber - 1]?.trim() || "";

          // Skip if it's a comment
          if (lineContent.startsWith("//") || lineContent.startsWith("*")) {
            continue;
          }

          violations.push({
            ruleId: "02-security",
            ruleName: secPattern.name,
            severity: secPattern.severity,
            category: "security",
            filePath: relativePath,
            lineNumber,
            description: secPattern.description,
            suggestion: secPattern.suggestion,
          });
        }
      }
    }
  } catch {
    // If src/ doesn't exist or glob fails, return empty
  }

  return { violations, filesScanned };
}
