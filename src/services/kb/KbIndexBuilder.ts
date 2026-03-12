/**
 * KB Index Builder — reads all KB markdown files and produces a structured index.
 * This runs at build time (via build.ts) and generates kb-index.json.
 *
 * @module kb-index-builder
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, relative, extname, dirname } from "path";
import { getKbDir, getKbIndexPath } from "../../utils/paths";
import { parseKbMetadata, extractTitle } from "./KbMetadataParser";
import { extractTags, extractCodeLanguages } from "./KbTagExtractor";
import {
  extractBestPractices,
  extractAntiPatterns,
  extractChecklist,
  extractImperatives,
} from "./KbContentExtractor";
import { generateAppliesTo, mapCategory } from "./KbAppliesTo";
import type { KbIndex, KbEntry } from "./KbTypes";

/** Build stats returned after index generation. */
export interface BuildStats {
  totalEntries: number;
  sizeKB: number;
  buildTimeMs: number;
  categories: Record<string, number>;
}

/**
 * Build the complete KB index from all markdown files in the KB directory.
 *
 * @param kbDir - Override KB directory (for testing)
 * @param outputPath - Override output path (for testing)
 * @returns Build statistics
 */
export function buildIndex(kbDir?: string, outputPath?: string): BuildStats {
  const startTime = Date.now();
  const kbRoot = kbDir || getKbDir();
  const outPath = outputPath || getKbIndexPath();

  if (!existsSync(kbRoot)) {
    throw new Error(`KB directory not found: ${kbRoot}`);
  }

  // Step 1: Discover all .md files
  const files = discoverFiles(kbRoot);

  // Step 2: Process each file into a KbEntry
  const entries: Record<string, KbEntry> = {};
  const categories: Record<string, number> = {};

  for (const filePath of files) {
    const entry = processFile(kbRoot, filePath);
    if (entry) {
      entries[entry.id] = entry;
      categories[entry.category] = (categories[entry.category] || 0) + 1;
    }
  }

  // Step 3: Build inverted indices (prototype-free objects for safe key lookups)
  const byExtension: Record<string, string[]> = Object.create(null);
  const byPathPattern: Record<string, string[]> = Object.create(null);
  const byKeyword: Record<string, string[]> = Object.create(null);
  const byLanguage: Record<string, string[]> = Object.create(null);
  const byCategory: Record<string, string[]> = Object.create(null);
  const byDomain: Record<string, string[]> = Object.create(null);

  for (const entry of Object.values(entries)) {
    // By extension
    for (const ext of entry.appliesTo.extensions) {
      if (!byExtension[ext]) byExtension[ext] = [];
      byExtension[ext].push(entry.id);
    }

    // By path pattern
    for (const pattern of entry.appliesTo.pathPatterns) {
      if (!byPathPattern[pattern]) byPathPattern[pattern] = [];
      byPathPattern[pattern].push(entry.id);
    }

    // By keyword
    for (const keyword of entry.appliesTo.keywords) {
      if (!byKeyword[keyword]) byKeyword[keyword] = [];
      byKeyword[keyword].push(entry.id);
    }

    // By language
    for (const lang of entry.languages) {
      if (!byLanguage[lang]) byLanguage[lang] = [];
      byLanguage[lang].push(entry.id);
    }

    // By category
    if (!byCategory[entry.category]) byCategory[entry.category] = [];
    byCategory[entry.category].push(entry.id);

    // By domain tags
    const domainParts = entry.domain
      .split(/[>/]/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 1);

    for (const part of domainParts) {
      if (!byDomain[part]) byDomain[part] = [];
      byDomain[part].push(entry.id);
    }
  }

  // Step 4: Compute hash
  const kbHash = computeHash(files);

  // Step 5: Assemble index
  const index: KbIndex = {
    version: 1,
    builtAt: Date.now(),
    totalFiles: Object.keys(entries).length,
    kbHash,
    entries,
    byExtension,
    byPathPattern,
    byKeyword,
    byLanguage,
    byCategory,
    byDomain,
  };

  // Step 6: Write to disk
  const json = JSON.stringify(index);
  const outDir = dirname(outPath);
  if (!existsSync(outDir)) {
    const { mkdirSync } = require("fs");
    mkdirSync(outDir, { recursive: true });
  }
  writeFileSync(outPath, json, "utf-8");

  const buildTimeMs = Date.now() - startTime;
  const sizeKB = Math.round(json.length / 1024);

  return { totalEntries: index.totalFiles, sizeKB, buildTimeMs, categories };
}

/** Recursively discover all .md files in a directory. */
function discoverFiles(dir: string): string[] {
  const results: string[] = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let items: string[];
    try {
      items = readdirSync(current);
    } catch {
      continue;
    }

    for (const item of items) {
      // Skip hidden directories
      if (item.startsWith(".")) continue;

      const fullPath = join(current, item);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        stack.push(fullPath);
      } else if (extname(item) === ".md") {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

/** Process a single KB file into a KbEntry. */
function processFile(kbRoot: string, filePath: string): KbEntry | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  if (content.trim().length === 0) return null;

  const relPath = relative(kbRoot, filePath).replace(/\\/g, "/");

  // Extract ID from path (remove .md extension)
  const id = relPath.replace(/\.md$/, "");

  // Extract top-level category from first path segment
  const topDir = relPath.split("/")[0];
  const category = mapCategory(topDir);

  // Parse metadata
  const metadata = parseKbMetadata(content);

  // Extract title
  const title = extractTitle(content);

  // Extract domain — prefer metadata, fall back to path-derived
  const domain = metadata.domain || deriveDomainFromPath(relPath);

  // Extract tags
  const tags = extractTags(relPath, content, metadata);

  // Extract languages from code blocks
  const languages = extractCodeLanguages(content);

  // Extract content sections
  const bestPractices = extractBestPractices(content);
  const antiPatterns = extractAntiPatterns(content);
  const checklist = extractChecklist(content);
  const imperatives = extractImperatives(content);

  // Generate appliesTo mapping
  const appliesTo = generateAppliesTo(category, tags, languages, title, domain);

  // File size
  let fileSize = 0;
  try {
    fileSize = statSync(filePath).size;
  } catch {
    // ignore
  }

  return {
    id,
    path: relPath,
    title,
    category,
    domain,
    difficulty: metadata.difficulty,
    importance: metadata.importance,
    directive: metadata.directive,
    coreRule: metadata.coreRule,
    tags,
    languages,
    appliesTo,
    bestPractices,
    antiPatterns,
    checklist,
    imperatives,
    fileSize,
  };
}

/** Derive a domain string from a relative path when metadata is missing. */
function deriveDomainFromPath(relPath: string): string {
  return relPath
    .replace(/\.md$/, "")
    .split("/")
    .map((seg) => seg.replace(/^\d+-/, ""))
    .map((seg) =>
      seg
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    )
    .join(" > ");
}

/** Compute a simple hash from file paths for change detection. */
function computeHash(files: string[]): string {
  let hash = 0;
  const str = files.join("|");
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}
