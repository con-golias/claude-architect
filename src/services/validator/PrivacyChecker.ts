/**
 * Privacy and data protection checks.
 * Detects PII in logs, PII in URLs, and unprotected sensitive data patterns.
 *
 * @module PrivacyChecker
 */

import { readFileSync } from "fs";
import { join, relative } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { normalizePath, globSync, isInsideStringLiteral } from "../../utils/paths";

interface PrivacyPattern {
  name: string;
  pattern: RegExp;
  severity: Violation["severity"];
  description: string;
  suggestion: string;
}

const PRIVACY_PATTERNS: PrivacyPattern[] = [
  {
    name: "PII in Logs",
    pattern: /(?:console\.\w+|logger\.\w+|log\.\w+)\s*\([^)]*(?:email|ssn|social.?security|credit.?card|phone.?number|passport|national.?id)/gi,
    severity: "critical",
    description: "Potentially logging PII (email, SSN, credit card, phone) — GDPR/privacy violation",
    suggestion: "Mask or redact PII before logging. Use a structured logger with PII sanitization",
  },
  {
    name: "PII in URL Params",
    pattern: /(?:url|href|redirect|location|navigate)\s*(?:=|\+=|:)\s*[`'"][^`'"]*\$\{[^}]*(?:email|password|ssn|token|secret)/gi,
    severity: "warning",
    description: "Sensitive data included in URL parameters — visible in logs, history, and referrers",
    suggestion: "Send sensitive data in request body or headers, never in URL query parameters",
  },
  {
    name: "Unencrypted PII Storage",
    pattern: /(?:localStorage|sessionStorage|cookie|setCookie)\s*(?:\.\w+\s*\(|\[)[^)]*(?:password|ssn|credit.?card|social.?security)/gi,
    severity: "critical",
    description: "Sensitive data stored in browser storage without encryption",
    suggestion: "Never store passwords, SSN, or credit cards in localStorage/cookies. Use encrypted server-side sessions",
  },
  {
    name: "Email Regex in Log",
    pattern: /(?:console\.\w+|logger\.\w+|log\.\w+)\s*\([^)]*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: "warning",
    description: "Hardcoded email address found in logging statement",
    suggestion: "Remove email addresses from log statements to protect privacy",
  },
];

const EXCLUDE = ["node_modules", ".test.", ".spec.", "__tests__", ".d.ts", "dist/", "build/", "coverage/"];

/**
 * Run privacy and data protection checks on source files.
 *
 * @param projectPath - Absolute path to project root
 * @returns Checker result with privacy violations
 */
export function checkPrivacy(projectPath: string): CheckerResult {
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

      for (const pp of PRIVACY_PATTERNS) {
        const regex = new RegExp(pp.pattern.source, pp.pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split("\n").length;
          const lineContent = lines[lineNumber - 1]?.trim() || "";
          if (lineContent.startsWith("//") || lineContent.startsWith("*")) continue;
          const pos = match.index - content.lastIndexOf("\n", match.index - 1) - 1;
          if (isInsideStringLiteral(lineContent, pos)) continue;

          violations.push({
            ruleId: "18-data-privacy",
            ruleName: pp.name,
            severity: pp.severity,
            category: "security",
            filePath: relativePath,
            lineNumber,
            description: pp.description,
            suggestion: pp.suggestion,
          });
        }
      }
    }
  } catch { /* src/ doesn't exist */ }

  return { violations, filesScanned };
}
