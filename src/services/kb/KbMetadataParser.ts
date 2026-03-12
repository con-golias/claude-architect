/**
 * Parses metadata from KB markdown files.
 * Handles 4 distinct metadata formats found in the software-engineering-kb:
 *   1. AI Plugin Directive (blockquote with directive + core rule)
 *   2. Property Table (| Property | Value | format)
 *   3. Domain/Difficulty (blockquote with Domain, Difficulty, Last Updated)
 *   4. Structured Metadata (## Metadata section with - **Key**: Value)
 *
 * @module kb-metadata-parser
 */

import type { KbMetadata } from "./KbTypes";

/**
 * Parse metadata from KB file content into a unified KbMetadata object.
 * Detects format automatically and extracts all available fields.
 */
export function parseKbMetadata(content: string): KbMetadata {
  const lines = content.split("\n");
  const meta: KbMetadata = {};

  // Collect the metadata region (between title and first "---" divider)
  const metaRegion = extractMetaRegion(lines);

  if (metaRegion.length === 0) {
    return meta;
  }

  const joined = metaRegion.join("\n");

  // Format 1: AI Plugin Directive
  if (joined.includes("**AI Plugin Directive:**")) {
    parseAIDirectiveFormat(metaRegion, content, meta);
    return meta;
  }

  // Format 2: Property Table
  if (metaRegion.some((l) => l.trimStart().startsWith("|") && /\|\s*\w/.test(l))) {
    parseTableFormat(metaRegion, meta);
    return meta;
  }

  // Format 3: Domain/Difficulty blockquote
  if (joined.includes("**Domain:**")) {
    parseDomainFormat(metaRegion, meta);
    return meta;
  }

  // Format 4: Structured Metadata block (## Metadata with - **Key**: Value)
  const metaSection = findStructuredMetadata(lines);
  if (metaSection.length > 0) {
    parseStructuredFormat(metaSection, meta);
    return meta;
  }

  return meta;
}

/**
 * Extract the title (first H1 heading) from content.
 */
export function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : "Untitled";
}

/** Extract lines between the title and the first "---" divider. */
function extractMetaRegion(lines: string[]): string[] {
  const region: string[] = [];
  let pastTitle = false;

  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const trimmed = lines[i].trim();

    // Skip the title line
    if (!pastTitle && trimmed.startsWith("# ")) {
      pastTitle = true;
      continue;
    }

    if (!pastTitle) continue;

    // Stop at the divider or first content section
    if (trimmed === "---") break;
    if (trimmed.startsWith("## ")) break;

    // Collect non-empty lines (and blank lines within the region)
    region.push(lines[i]);
  }

  return region;
}

/** Parse Format 1: AI Plugin Directive. */
function parseAIDirectiveFormat(metaLines: string[], fullContent: string, meta: KbMetadata): void {
  // Extract the directive text
  const directiveMatch = fullContent.match(
    />\s*\*\*AI Plugin Directive:\*\*\s*([\s\S]*?)(?=\n\n|\n---|\n>\s*\*\*Core Rule)/,
  );
  if (directiveMatch) {
    meta.directive = cleanBlockquote(directiveMatch[1]);
  }

  // Extract Core Rule if present
  const coreRuleMatch = fullContent.match(/>\s*\*\*Core Rule:\*\*\s*([\s\S]*?)(?=\n\n|\n---)/);
  if (coreRuleMatch) {
    meta.coreRule = cleanBlockquote(coreRuleMatch[1]);
  }

  // Some AI Directive files also have Domain in a separate blockquote
  for (const line of metaLines) {
    const domainMatch = line.match(/>\s*\*\*Domain:\*\*\s*(.+)/);
    if (domainMatch) meta.domain = domainMatch[1].trim();
  }
}

/** Parse Format 2: Property Table. */
function parseTableFormat(metaLines: string[], meta: KbMetadata): void {
  for (const line of metaLines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || trimmed.includes("---")) continue;

    // Parse table row: | Key | Value |
    const cells = trimmed
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cells.length < 2) continue;

    const key = cells[0].toLowerCase().replace(/\s+/g, "");
    const value = cells[1];

    switch (key) {
      case "domain":
        meta.domain = value;
        break;
      case "difficulty":
        meta.difficulty = value;
        break;
      case "importance":
        meta.importance = value;
        break;
      case "lastupdated":
        meta.lastUpdated = value;
        break;
      case "audience":
        meta.audience = value;
        break;
      case "cross-ref":
      case "crossref":
        meta.crossRef = value.split(",").map((s) => s.trim());
        break;
    }
  }
}

/** Parse Format 3: Domain/Difficulty blockquote. */
function parseDomainFormat(metaLines: string[], meta: KbMetadata): void {
  for (const line of metaLines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(">")) continue;

    const domainMatch = trimmed.match(/\*\*Domain:\*\*\s*(.+)/);
    if (domainMatch) meta.domain = domainMatch[1].trim();

    const diffMatch = trimmed.match(/\*\*Difficulty:\*\*\s*(.+)/);
    if (diffMatch) meta.difficulty = diffMatch[1].trim();

    const dateMatch = trimmed.match(/\*\*Last Updated:\*\*\s*(.+)/);
    if (dateMatch) meta.lastUpdated = dateMatch[1].trim();

    const impMatch = trimmed.match(/\*\*Importance:\*\*\s*(.+)/);
    if (impMatch) meta.importance = impMatch[1].trim();
  }
}

/** Find a ## Metadata section in the content. */
function findStructuredMetadata(lines: string[]): string[] {
  const result: string[] = [];
  let inMeta = false;

  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const trimmed = lines[i].trim();

    if (trimmed === "## Metadata") {
      inMeta = true;
      continue;
    }

    if (inMeta) {
      // Stop at next section or divider
      if (trimmed.startsWith("## ") || trimmed === "---") break;
      result.push(lines[i]);
    }
  }

  return result;
}

/** Parse Format 4: Structured Metadata (- **Key**: Value). */
function parseStructuredFormat(metaLines: string[], meta: KbMetadata): void {
  for (const line of metaLines) {
    const match = line.match(/-\s*\*\*(.+?)\*\*\s*:\s*(.+)/);
    if (!match) continue;

    const key = match[1].toLowerCase().replace(/\s+/g, "");
    const value = match[2].trim();

    switch (key) {
      case "category":
        meta.category = value;
        meta.domain = value;
        break;
      case "audience":
        meta.audience = value;
        break;
      case "complexity":
        meta.difficulty = value;
        break;
      case "prerequisites":
        meta.prerequisites = value;
        break;
      case "version":
        meta.version = value;
        break;
      case "lastupdated":
        meta.lastUpdated = value;
        break;
    }
  }
}

/** Remove blockquote markers and clean up whitespace. */
function cleanBlockquote(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/^>\s*/, "").trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
