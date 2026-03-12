/**
 * Extracts structured content from KB markdown files:
 * best practices, anti-patterns, enforcement checklists, and imperatives.
 *
 * @module kb-content-extractor
 */

import type { AntiPattern } from "./KbTypes";

/**
 * Extract best practices from the "## Best Practices" section.
 * Returns up to 10 items.
 */
export function extractBestPractices(content: string): string[] {
  const section = extractSection(content, "Best Practices");
  if (!section) return [];

  const practices: string[] = [];
  for (const line of section.split("\n")) {
    const match = line.match(/^\s*(?:\d+\.|[-*])\s+(.+)/);
    if (match) {
      const text = cleanMarkdown(match[1]);
      if (text.length > 5) practices.push(text);
    }
  }

  return practices.slice(0, 10);
}

/**
 * Extract anti-patterns from the "## Anti-Patterns" section.
 * Supports both table format and list format.
 * Returns up to 10 items.
 */
export function extractAntiPatterns(content: string): AntiPattern[] {
  // Try multiple header variations
  const section =
    extractSection(content, "Anti-Patterns") ||
    extractSection(content, "Anti-Patterns Quick Reference") ||
    extractSection(content, "Anti-Pattern");

  if (!section) return [];

  // Try table format first: | Name | Description | Fix |
  const tablePatterns = extractAntiPatternsFromTable(section);
  if (tablePatterns.length > 0) return tablePatterns.slice(0, 10);

  // Fall back to list format: - **Name** — Fix description
  return extractAntiPatternsFromList(section).slice(0, 10);
}

/**
 * Extract enforcement checklist items.
 * Returns up to 15 items.
 */
export function extractChecklist(content: string): string[] {
  const section =
    extractSection(content, "Enforcement Checklist") || extractSection(content, "Checklist");

  if (!section) return [];

  const items: string[] = [];
  for (const line of section.split("\n")) {
    const match = line.match(/^\s*-\s*\[[\s x]\]\s+(.+)/i);
    if (match) {
      const text = cleanMarkdown(match[1]);
      if (text.length > 3) items.push(text);
    }
  }

  return items.slice(0, 15);
}

/**
 * Extract imperative statements containing MUST, NEVER, ALWAYS, etc.
 * Returns up to 10 unique items.
 */
export function extractImperatives(content: string): string[] {
  const imperatives: string[] = [];
  const seen = new Set<string>();

  // Match lines containing strong directive keywords
  for (const line of content.split("\n")) {
    const trimmed = line.replace(/^[>*\-#\s]+/, "").trim();
    if (trimmed.length < 10 || trimmed.length > 200) continue;

    // Must contain a directive keyword as a standalone word
    if (!/\b(MUST NOT|MUST|NEVER|ALWAYS|DO NOT|REQUIRED|FORBIDDEN)\b/.test(trimmed)) continue;

    // Skip table header rows and code blocks
    if (trimmed.startsWith("|") || trimmed.startsWith("```") || trimmed.startsWith("//")) continue;

    const cleaned = cleanMarkdown(trimmed);
    const key = cleaned.toLowerCase().slice(0, 50);

    if (!seen.has(key)) {
      seen.add(key);
      imperatives.push(cleaned);
    }
  }

  return imperatives.slice(0, 10);
}

/** Extract a section by its H2 header name. Returns content until next H2 or EOF. */
function extractSection(content: string, headerName: string): string | null {
  const lines = content.split("\n");
  const headerLower = headerName.toLowerCase();
  let collecting = false;
  const result: string[] = [];

  for (const line of lines) {
    const h2Match = line.match(/^##\s+(?:\d+\.\s+)?(.+)/);

    if (h2Match) {
      if (collecting) break;
      if (h2Match[1].trim().toLowerCase().includes(headerLower)) {
        collecting = true;
        continue;
      }
    }

    if (collecting) {
      result.push(line);
    }
  }

  return result.length > 0 ? result.join("\n") : null;
}

/** Extract anti-patterns from a markdown table. */
function extractAntiPatternsFromTable(section: string): AntiPattern[] {
  const patterns: AntiPattern[] = [];
  let headerParsed = false;
  let nameCol = 0;
  let fixCol = -1;

  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;

    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cells.length < 2) continue;

    // Skip separator rows (|---|---|)
    if (cells[0].match(/^-+$/)) continue;

    // Parse header row to find column positions
    if (!headerParsed) {
      for (let i = 0; i < cells.length; i++) {
        const lower = cells[i].toLowerCase();
        if (lower.includes("anti-pattern") || lower.includes("name") || lower.includes("pattern"))
          nameCol = i;
        if (lower.includes("fix") || lower.includes("solution") || lower.includes("remedy"))
          fixCol = i;
      }
      headerParsed = true;
      continue;
    }

    const name = cleanMarkdown(cells[nameCol] || "");
    const fix = fixCol >= 0 ? cleanMarkdown(cells[fixCol] || "") : "";

    if (name.length > 2) {
      patterns.push({ name, fix });
    }
  }

  return patterns;
}

/** Extract anti-patterns from a list format. */
function extractAntiPatternsFromList(section: string): AntiPattern[] {
  const patterns: AntiPattern[] = [];

  for (const line of section.split("\n")) {
    // Match: - **Name** — Description or fix
    const match = line.match(/^\s*[-*]\s+\*\*(.+?)\*\*\s*[—:\-–]\s*(.+)/);
    if (match) {
      patterns.push({
        name: cleanMarkdown(match[1]),
        fix: cleanMarkdown(match[2]),
      });
    }
  }

  return patterns;
}

/** Remove markdown formatting (bold, links, inline code). */
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .trim();
}
