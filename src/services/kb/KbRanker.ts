/**
 * Scoring and ranking algorithm for KB lookup results.
 * Uses weighted multi-signal scoring to find the most relevant KB entries.
 *
 * @module kb-ranker
 */

import type { KbEntry, LookupContext } from "./KbTypes";

/** Signal weights for scoring. */
const WEIGHTS = {
  titleMatch: 4.0,
  domainMatch: 3.0,
  extensionMatch: 3.0,
  pathSegmentMatch: 2.5,
  languageMatch: 2.0,
  tagMatch: 1.5,
  keywordMatch: 1.0,
  directiveBonus: 2.0,
  checklistBonus: 1.0,
  imperativeBonus: 0.5,
};

/** Minimum score to be included in results. */
const MIN_SCORE = 3.0;

/** Map file extensions to canonical language names. */
const EXT_TO_LANG: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript",
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".java": "java", ".kt": "kotlin",
  ".cs": "csharp",
  ".rb": "ruby",
  ".rs": "rust",
  ".swift": "swift",
  ".dart": "dart",
  ".sql": "sql",
  ".html": "html", ".css": "css", ".scss": "css",
  ".yaml": "yaml", ".yml": "yaml",
  ".sh": "bash",
};

/**
 * Score a single KB entry against a lookup context.
 */
export function scoreEntry(entry: KbEntry, context: LookupContext): number {
  let score = 0;

  // Signal 1: Title keyword match (highest value)
  const titleLower = entry.title.toLowerCase();
  for (const term of context.queryTerms) {
    if (titleLower.includes(term.toLowerCase())) {
      score += WEIGHTS.titleMatch;
      break;
    }
  }
  for (const kw of context.fileNameKeywords) {
    if (titleLower.includes(kw.toLowerCase())) {
      score += WEIGHTS.titleMatch * 0.5;
      break;
    }
  }

  // Signal 2: Domain match
  const domainLower = entry.domain.toLowerCase();
  for (const term of context.queryTerms) {
    if (domainLower.includes(term.toLowerCase())) {
      score += WEIGHTS.domainMatch;
      break;
    }
  }

  // Signal 3: Extension match
  if (entry.appliesTo.extensions.includes(context.fileExtension)) {
    score += WEIGHTS.extensionMatch;
  }

  // Signal 4: Path segment match
  for (const segment of context.pathSegments) {
    const segLower = segment.toLowerCase();
    if (entry.appliesTo.pathPatterns.some((p) => segLower.includes(p.replace("/", "")))) {
      score += WEIGHTS.pathSegmentMatch;
      break;
    }
  }

  // Signal 5: Language match
  const targetLang = EXT_TO_LANG[context.fileExtension];
  if (targetLang && entry.languages.includes(targetLang)) {
    score += WEIGHTS.languageMatch;
  }

  // Signal 6: Tag overlap
  const contextTerms = new Set([
    ...context.queryTerms.map((t) => t.toLowerCase()),
    ...context.fileNameKeywords.map((t) => t.toLowerCase()),
    ...context.contentKeywords.map((t) => t.toLowerCase()),
  ]);

  let tagMatches = 0;
  for (const tag of entry.tags) {
    if (contextTerms.has(tag)) {
      tagMatches++;
    }
  }
  if (tagMatches > 0) {
    score += Math.min(tagMatches * WEIGHTS.tagMatch, WEIGHTS.tagMatch * 3);
  }

  // Signal 7: Keyword match (from appliesTo.keywords)
  let kwMatches = 0;
  for (const kw of entry.appliesTo.keywords) {
    if (contextTerms.has(kw)) {
      kwMatches++;
    }
  }
  if (kwMatches > 0) {
    score += Math.min(kwMatches * WEIGHTS.keywordMatch, WEIGHTS.keywordMatch * 3);
  }

  // Bonuses
  if (entry.directive) score += WEIGHTS.directiveBonus;
  if (entry.checklist.length > 0) score += WEIGHTS.checklistBonus;
  if (entry.imperatives.length > 0) score += WEIGHTS.imperativeBonus;

  return score;
}

/**
 * Rank a list of KB entries against a lookup context.
 * Returns top entries sorted by score descending, filtered by minimum threshold.
 */
export function rankEntries(
  entries: KbEntry[],
  context: LookupContext,
  limit: number = 5,
): Array<{ entry: KbEntry; score: number }> {
  const scored = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, context) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
