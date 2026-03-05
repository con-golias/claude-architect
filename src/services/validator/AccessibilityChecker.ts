/**
 * Accessibility (a11y) checks for JSX/TSX/HTML content.
 * Detects missing alt text, keyboard handlers, ARIA labels, and form labels.
 *
 * @module AccessibilityChecker
 */

import { readFileSync } from "fs";
import { join, relative } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { normalizePath, globSync } from "../../utils/paths";

interface A11yPattern {
  name: string;
  pattern: RegExp;
  severity: Violation["severity"];
  description: string;
  suggestion: string;
}

const A11Y_PATTERNS: A11yPattern[] = [
  {
    name: "Image Without Alt",
    pattern: /<img\s(?![^>]*\balt\s*=)[^>]*>/gi,
    severity: "warning",
    description: "Image element without alt attribute — screen readers cannot describe it",
    suggestion: 'Add alt="descriptive text" or alt="" for decorative images',
  },
  {
    name: "Click Without Keyboard",
    pattern: /onClick\s*=\s*\{(?![^}]*(?:onKeyDown|onKeyUp|onKeyPress|role))/gi,
    severity: "warning",
    description: "Click handler without keyboard event — not accessible via keyboard navigation",
    suggestion: "Add onKeyDown handler and role='button' for non-button clickable elements",
  },
  {
    name: "Interactive Without ARIA",
    pattern: /<(?:div|span)\s+(?=[^>]*onClick)[^>]*(?<!aria-label\s*=\s*"[^"]*")[^>]*>/gi,
    severity: "info",
    description: "Interactive div/span without aria-label — purpose unclear to assistive technology",
    suggestion: "Add aria-label or use semantic HTML elements (button, a) instead",
  },
  {
    name: "Input Without Label",
    pattern: /<input\s(?![^>]*(?:aria-label|aria-labelledby|id\s*=\s*"[^"]*"))[^>]*>/gi,
    severity: "warning",
    description: "Form input without associated label or aria-label",
    suggestion: 'Add <label htmlFor="id"> or aria-label attribute to the input',
  },
  {
    name: "Missing Lang Attribute",
    pattern: /<html\s(?![^>]*\blang\s*=)[^>]*>/gi,
    severity: "warning",
    description: "HTML element missing lang attribute — affects screen reader pronunciation",
    suggestion: 'Add lang="en" (or appropriate language code) to the <html> element',
  },
  {
    name: "AutoFocus Usage",
    pattern: /\bautoFocus\b|\bautofocus\b/gi,
    severity: "info",
    description: "autoFocus can disorient screen reader users and break navigation flow",
    suggestion: "Avoid autoFocus. Manage focus programmatically only when necessary",
  },
];

const EXCLUDE = ["node_modules", ".test.", ".spec.", "__tests__", ".d.ts", "dist/", "build/", "coverage/"];

/**
 * Run accessibility checks on JSX/TSX/HTML files.
 *
 * @param projectPath - Absolute path to project root
 * @returns Checker result with accessibility violations
 */
export function checkAccessibility(projectPath: string): CheckerResult {
  const violations: Violation[] = [];
  const srcPath = join(projectPath, "src");
  let filesScanned = 0;

  try {
    const files = globSync("**/*.{tsx,jsx,html,vue}", srcPath);

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

      for (const ap of A11Y_PATTERNS) {
        const regex = new RegExp(ap.pattern.source, ap.pattern.flags);
        let match: RegExpExecArray | null;

        while ((match = regex.exec(content)) !== null) {
          const lineNumber = content.substring(0, match.index).split("\n").length;
          const lineContent = lines[lineNumber - 1]?.trim() || "";
          if (lineContent.startsWith("//") || lineContent.startsWith("*") || lineContent.startsWith("{/*")) continue;

          violations.push({
            ruleId: "22-accessibility",
            ruleName: ap.name,
            severity: ap.severity,
            category: "quality",
            filePath: relativePath,
            lineNumber,
            description: ap.description,
            suggestion: ap.suggestion,
          });
        }
      }
    }
  } catch { /* src/ doesn't exist */ }

  return { violations, filesScanned };
}
