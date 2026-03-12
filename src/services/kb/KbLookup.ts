/**
 * KB Lookup Engine — loads the index into memory and provides instant lookups.
 * Used by both the PreToolUse hook and the Worker API.
 *
 * @module kb-lookup
 */

import { readFileSync, existsSync } from "fs";
import { extname, basename } from "path";
import { getKbIndexPath } from "../../utils/paths";
import { rankEntries } from "./KbRanker";
import type { KbIndex, KbEntry, LookupContext, KbLookupResult } from "./KbTypes";

let cachedIndex: KbIndex | null = null;

/**
 * Load the KB index from disk. Caches in memory after first load.
 * Returns null if index file doesn't exist (graceful degradation).
 */
export function loadIndex(indexPath?: string): KbIndex | null {
  if (cachedIndex) return cachedIndex;

  const path = indexPath || getKbIndexPath();
  if (!existsSync(path)) return null;

  try {
    const raw = readFileSync(path, "utf-8");
    cachedIndex = JSON.parse(raw) as KbIndex;
    return cachedIndex;
  } catch {
    return null;
  }
}

/** Clear the cached index (for testing or rebuild). */
export function clearCache(): void {
  cachedIndex = null;
}

/**
 * Build a LookupContext from a target file path and optional content/query.
 */
export function buildContext(
  filePath: string,
  content?: string,
  query?: string,
): LookupContext {
  const fileExtension = extname(filePath).toLowerCase();

  // Extract path segments (directory names)
  const pathSegments = filePath
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s.length > 0 && !s.includes("."));

  // Extract keywords from file name
  const fileName = basename(filePath, extname(filePath));
  const fileNameKeywords = splitCamelKebab(fileName);

  // Extract keywords from content (imports, function calls, patterns)
  const contentKeywords: string[] = [];
  if (content) {
    // Extract import targets
    const importMatches = content.matchAll(
      /(?:import|require|from)\s+['"]([^'"]+)['"]/g,
    );
    for (const m of importMatches) {
      const pkg = m[1].split("/").pop() || "";
      if (pkg.length > 1) contentKeywords.push(pkg.toLowerCase());
    }

    // Extract common patterns
    const patterns = [
      /\bexpress\b/i, /\brouter\b/i, /\bfetch\b/i, /\baxios\b/i,
      /\buseState\b/, /\buseEffect\b/, /\buseContext\b/,
      /\bdb\.query\b/i, /\bprisma\b/i, /\bsequelize\b/i, /\bmongoose\b/i,
      /\bjwt\b/i, /\bbcrypt\b/i, /\boauth\b/i,
      /\bcreateServer\b/, /\bmiddleware\b/i,
      /\bwebsocket\b/i, /\bsocket\.io\b/i,
      /\bredis\b/i, /\bcache\b/i,
      /\bSELECT\b/, /\bINSERT\b/, /\bUPDATE\b/, /\bDELETE\b/,
      /\binnerHTML\b/, /\beval\b/, /\bFunction\b/,
      /\breq\.body\b/, /\breq\.params\b/, /\breq\.query\b/,
      /\bvalidat/i, /\bsaniti/i, /\bescap/i,
      /\btest\b/i, /\bdescribe\b/, /\bit\b/, /\bexpect\b/,
    ];
    for (const p of patterns) {
      if (p.test(content)) {
        const match = content.match(p);
        if (match) contentKeywords.push(match[0].toLowerCase());
      }
    }
  }

  // Parse query terms
  const queryTerms = query
    ? query
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1)
    : [];

  return {
    fileExtension,
    pathSegments,
    fileNameKeywords,
    contentKeywords: [...new Set(contentKeywords)],
    queryTerms,
  };
}

/**
 * Look up relevant KB entries for a given file context.
 *
 * @param filePath - Target file path
 * @param content - Optional file content for deeper analysis
 * @param query - Optional free-text search query
 * @param options - Lookup options
 * @returns Ranked KB lookup results
 */
export function lookup(
  filePath: string,
  content?: string,
  query?: string,
  options: { limit?: number; category?: string; language?: string; indexPath?: string } = {},
): KbLookupResult[] {
  const index = loadIndex(options.indexPath);
  if (!index) return [];

  const context = buildContext(filePath, content, query);
  const limit = options.limit || 5;

  // Collect candidate entries using inverted indices for fast pre-filtering
  const candidateIds = collectCandidates(index, context, options.category, options.language);

  // Resolve IDs to entries
  const candidates: KbEntry[] = [];
  for (const id of candidateIds) {
    const entry = index.entries[id];
    if (entry) candidates.push(entry);
  }

  // Rank and return top results
  const ranked = rankEntries(candidates, context, limit);

  return ranked.map(({ entry, score }) => ({
    id: entry.id,
    title: entry.title,
    category: entry.category,
    domain: entry.domain,
    score: Math.round(score * 100) / 100,
    directive: entry.directive,
    coreRule: entry.coreRule,
    tags: entry.tags.slice(0, 10),
    languages: entry.languages,
    imperatives: entry.imperatives,
    bestPractices: entry.bestPractices.slice(0, 5),
    checklist: entry.checklist.slice(0, 5),
  }));
}

/**
 * Collect candidate entry IDs using inverted indices.
 * Uses union of matches from multiple dimensions for recall.
 */
function collectCandidates(
  index: KbIndex,
  context: LookupContext,
  categoryFilter?: string,
  languageFilter?: string,
): Set<string> {
  const ids = new Set<string>();

  // By extension
  const extEntries = index.byExtension[context.fileExtension];
  if (extEntries) {
    for (const id of extEntries) ids.add(id);
  }

  // By path segments
  for (const segment of context.pathSegments) {
    const segLower = segment.toLowerCase();
    for (const [pattern, entryIds] of Object.entries(index.byPathPattern)) {
      if (segLower.includes(pattern.replace("/", ""))) {
        for (const id of entryIds) ids.add(id);
      }
    }
  }

  // By keywords (from file name, content, and query)
  const allKeywords = [
    ...context.fileNameKeywords,
    ...context.contentKeywords,
    ...context.queryTerms,
  ];

  for (const kw of allKeywords) {
    const kwLower = kw.toLowerCase();
    const kwEntries = index.byKeyword[kwLower];
    if (kwEntries) {
      for (const id of kwEntries) ids.add(id);
    }
  }

  // By language
  if (languageFilter) {
    const langEntries = index.byLanguage[languageFilter];
    if (langEntries) {
      for (const id of langEntries) ids.add(id);
    }
  }

  // By category (filter, not add)
  if (categoryFilter) {
    const catEntries = new Set(index.byCategory[categoryFilter] || []);
    const filtered = new Set<string>();
    for (const id of ids) {
      if (catEntries.has(id)) filtered.add(id);
    }
    return filtered.size > 0 ? filtered : ids;
  }

  return ids;
}

/** Split CamelCase and kebab-case names into keywords. */
function splitCamelKebab(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);
}
