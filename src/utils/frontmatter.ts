/**
 * YAML frontmatter parser for rule files.
 * Extracts metadata (mode, paths) from markdown content.
 *
 * @module frontmatter
 */

const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n?/;

export interface RuleFrontmatter {
  mode: "auto" | "manual";
  paths: string[];
  [key: string]: unknown;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns metadata object and the body without frontmatter.
 *
 * @param content - Raw markdown file content
 * @returns Parsed metadata and remaining body
 */
export function parseFrontmatter(content: string): {
  metadata: RuleFrontmatter;
  body: string;
} {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    return {
      metadata: { mode: "auto", paths: [] },
      body: content,
    };
  }

  const raw = match[1];
  const body = content.slice(match[0].length);
  const metadata: RuleFrontmatter = { mode: "auto", paths: [] };

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const kvMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      if (key === "mode") {
        metadata.mode = value.trim() === "manual" ? "manual" : "auto";
      } else if (key === "paths") {
        continue; // paths are parsed from subsequent list items
      } else {
        metadata[key] = value.trim();
      }
    } else if (trimmed.startsWith("- ")) {
      const pathValue = trimmed.slice(2).replace(/^["']|["']$/g, "").trim();
      if (pathValue) metadata.paths.push(pathValue);
    }
  }

  return { metadata, body };
}

/**
 * Get the rule mode from file content.
 *
 * @param content - Raw markdown file content
 * @returns "auto" or "manual" (defaults to "auto")
 */
export function getRuleMode(content: string): "auto" | "manual" {
  return parseFrontmatter(content).metadata.mode;
}

/**
 * Get path scope patterns from rule file content.
 *
 * @param content - Raw markdown file content
 * @returns Array of glob patterns (empty if no paths defined)
 */
export function getRulePaths(content: string): string[] {
  return parseFrontmatter(content).metadata.paths;
}
