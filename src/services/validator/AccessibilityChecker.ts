/**
 * Accessibility (a11y) checks for JSX/TSX/HTML content.
 * Uses element-level scanning with brace-depth tracking for accurate
 * multi-line JSX detection. Detects missing alt text, keyboard handlers,
 * and form labels.
 *
 * @module AccessibilityChecker
 */

import { readFileSync } from "fs";
import { join, relative } from "path";
import type { Violation, CheckerResult } from "../../types/validation";
import { normalizePath, globSync } from "../../utils/paths";
import type { SourceResolution } from "../../utils/sourceResolver";
import { buildGlobPattern } from "../../utils/sourceResolver";

const EXCLUDE = ["node_modules", ".test.", ".spec.", "__tests__", ".d.ts", "dist/", "build/", "coverage/"];

/** Native HTML elements that already support keyboard events. */
const NATIVE_INTERACTIVE = new Set([
  "button", "a", "input", "select", "textarea", "summary", "details", "label",
]);

/**
 * Walk backward from a prop position to find the opening `<tag`.
 * Tracks brace depth to skip nested JSX expressions.
 */
function findElementStart(content: string, fromIndex: number): number {
  let i = fromIndex;
  let braceDepth = 0;
  while (i >= 0) {
    const ch = content[i];
    if (ch === "}") braceDepth++;
    else if (ch === "{") { if (braceDepth > 0) braceDepth--; }
    else if (ch === "<" && braceDepth === 0) {
      if (i + 1 < content.length && /[a-zA-Z]/.test(content[i + 1])) return i;
    }
    i--;
  }
  return -1;
}

/**
 * Extract the full opening tag from `<tag` to the matching `>`.
 * Tracks `{}` brace depth so `>` inside JSX expressions (ternaries,
 * comparisons) does not prematurely terminate the element.
 */
function extractElementText(content: string, startIndex: number): string {
  let i = startIndex;
  let braceDepth = 0;
  while (i < content.length) {
    const ch = content[i];
    if (ch === "{") {
      braceDepth++;
    } else if (ch === "}") {
      if (braceDepth > 0) braceDepth--;
    } else if (ch === ">" && braceDepth === 0) {
      return content.substring(startIndex, i + 1);
    } else if (braceDepth > 0 && (ch === '"' || ch === "'" || ch === "`")) {
      const quote = ch;
      i++;
      while (i < content.length) {
        if (content[i] === "\\") i++;
        else if (content[i] === quote) break;
        i++;
      }
    }
    i++;
  }
  return content.substring(startIndex, Math.min(startIndex + 2000, content.length));
}

/** Get 1-based line number at a given character offset. */
function lineAt(content: string, offset: number): number {
  return content.substring(0, offset).split("\n").length;
}

/** Check if line is a comment. */
function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("{/*");
}

/** Check onClick handlers without keyboard event support. */
function checkClickWithoutKeyboard(
  content: string, lines: string[], filePath: string, violations: Violation[],
): void {
  const regex = /onClick\s*=/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const ln = lineAt(content, match.index);
    if (isComment(lines[ln - 1] || "")) continue;

    const elStart = findElementStart(content, match.index);
    if (elStart < 0) continue;
    const el = extractElementText(content, elStart);

    const tag = el.match(/^<(\w+)/);
    if (!tag) continue;
    // Skip native interactive elements (built-in keyboard support)
    if (NATIVE_INTERACTIVE.has(tag[1].toLowerCase())) continue;
    // Skip custom React components (handle a11y internally)
    if (/^[A-Z]/.test(tag[1])) continue;

    if (/onKeyDown\s*=|onKeyUp\s*=|onKeyPress\s*=/.test(el)) continue;
    if (/role\s*=\s*["'{]button/.test(el)) continue;

    violations.push({
      ruleId: "22-accessibility", ruleName: "Click Without Keyboard",
      severity: "warning", category: "quality", filePath, lineNumber: ln,
      description: "Click handler without keyboard event — not accessible via keyboard navigation",
      suggestion: "Add onKeyDown handler and role='button', or use <button> instead of <div>/<span>",
    });
  }
}

/** Check `<img>` elements without alt attribute. */
function checkImageWithoutAlt(
  content: string, lines: string[], filePath: string, violations: Violation[],
): void {
  const regex = /<img\s/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const ln = lineAt(content, match.index);
    if (isComment(lines[ln - 1] || "")) continue;

    const el = extractElementText(content, match.index);
    if (/\balt\s*=/.test(el)) continue;

    violations.push({
      ruleId: "22-accessibility", ruleName: "Image Without Alt",
      severity: "warning", category: "quality", filePath, lineNumber: ln,
      description: "Image element without alt attribute — screen readers cannot describe it",
      suggestion: 'Add alt="descriptive text" or alt="" for decorative images',
    });
  }
}

/** Check form elements without label association. */
function checkInputWithoutLabel(
  content: string, lines: string[], filePath: string, violations: Violation[],
): void {
  const regex = /<(input|textarea|select)\s/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const ln = lineAt(content, match.index);
    if (isComment(lines[ln - 1] || "")) continue;

    const el = extractElementText(content, match.index);
    if (/type\s*=\s*["']hidden["']/.test(el)) continue;
    if (/type\s*=\s*["'](submit|button|reset|image)["']/.test(el)) continue;
    if (/aria-label\s*=|aria-labelledby\s*=/.test(el)) continue;
    if (/\bid\s*=/.test(el)) continue;

    violations.push({
      ruleId: "22-accessibility", ruleName: "Input Without Label",
      severity: "warning", category: "quality", filePath, lineNumber: ln,
      description: `<${match[1]}> without associated label or aria-label`,
      suggestion: 'Add <label htmlFor="id"> or aria-label attribute',
    });
  }
}

/** Simple line-level patterns (no multi-line element parsing needed). */
const SIMPLE_PATTERNS = [
  {
    name: "Missing Lang Attribute",
    pattern: /<html\s(?![^>]*\blang\s*=)[^>]*>/gi,
    severity: "warning" as const,
    description: "HTML element missing lang attribute — affects screen reader pronunciation",
    suggestion: 'Add lang="en" (or appropriate language code) to the <html> element',
  },
  {
    name: "AutoFocus Usage",
    pattern: /\bautoFocus\b|\bautofocus\b/gi,
    severity: "info" as const,
    description: "autoFocus can disorient screen reader users and break navigation flow",
    suggestion: "Avoid autoFocus. Manage focus programmatically only when necessary",
  },
];

/**
 * Run accessibility checks on JSX/TSX/HTML files.
 *
 * @param projectPath - Absolute path to project root
 * @param resolution - Optional source resolution for multi-directory scanning
 * @returns Checker result with accessibility violations
 */
export function checkAccessibility(projectPath: string, resolution?: SourceResolution): CheckerResult {
  const violations: Violation[] = [];
  const sourceDirs = resolution?.sourceDirs ?? [join(projectPath, "src")];
  let filesScanned = 0;
  const globPattern = buildGlobPattern(resolution?.frontendExtensions ?? [".tsx", ".jsx", ".html", ".vue"]);

  for (const srcDir of sourceDirs) {
    try {
      const files = globSync(globPattern, srcDir);
      for (const file of files) {
        if (EXCLUDE.some(p => file.includes(p))) continue;
        filesScanned++;

        const fullPath = join(srcDir, file);
        const relativePath = normalizePath(relative(projectPath, fullPath));
        let content: string;
        try { content = readFileSync(fullPath, "utf-8"); } catch { continue; }
        const lines = content.split("\n");

        // Element-level checks (multi-line safe)
        checkClickWithoutKeyboard(content, lines, relativePath, violations);
        checkImageWithoutAlt(content, lines, relativePath, violations);
        checkInputWithoutLabel(content, lines, relativePath, violations);

        // Simple regex checks
        for (const sp of SIMPLE_PATTERNS) {
          const regex = new RegExp(sp.pattern.source, sp.pattern.flags);
          let m;
          while ((m = regex.exec(content)) !== null) {
            const ln = lineAt(content, m.index);
            if (isComment(lines[ln - 1] || "")) continue;
            violations.push({
              ruleId: "22-accessibility", ruleName: sp.name,
              severity: sp.severity, category: "quality",
              filePath: relativePath, lineNumber: ln,
              description: sp.description, suggestion: sp.suggestion,
            });
          }
        }
      }
    } catch { /* directory doesn't exist */ }
  }

  return { violations, filesScanned };
}
