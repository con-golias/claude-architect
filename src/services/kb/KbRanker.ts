/**
 * Scoring and ranking algorithm for KB lookup results.
 * Uses weighted multi-signal scoring to find the most relevant KB entries.
 *
 * @module kb-ranker
 */

import type { KbEntry, LookupContext, PromptAnalysis } from "./KbTypes";

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

/**
 * Competing technology groups. If the prompt mentions one tech in a group,
 * articles about a DIFFERENT tech in the same group get penalized.
 * This prevents gRPC articles from appearing when user asked for REST, etc.
 */
const COMPETING_TECH_GROUPS: string[][] = [
  ["rest", "grpc", "graphql"],
  ["react", "vue", "angular", "svelte"],
  ["express", "fastify", "nestjs", "koa"],
  ["django", "flask", "fastapi"],
  ["postgres", "mysql", "mongodb", "sqlite", "dynamodb"],
];

/** Penalty applied when an article is about a competing technology. */
const COMPETING_TECH_PENALTY = -6.0;

/** Weights for prompt-based scoring (folder names are primary signal). */
const PROMPT_WEIGHTS = {
  folderSegmentMatch: 5.0,
  titleMatch: 4.0,
  domainMatch: 3.0,
  keywordMatch: 2.0,
  tagMatch: 1.5,
  categoryMatch: 3.0,
  directiveBonus: 2.0,
  imperativeBonus: 0.5,
};

/** Threshold for prompt queries — requires at least one strong signal. */
const PROMPT_MIN_SCORE = 5.0;

/**
 * Score a KB entry against a prompt analysis.
 * Folder segment matches are the highest-value signal.
 *
 * @param entry - KB entry to score
 * @param analysis - Analyzed prompt data
 * @param folderHits - Set of entry IDs that matched byFolderSegment
 */
export function scoreEntryForPrompt(
  entry: KbEntry,
  analysis: PromptAnalysis,
  folderHits: Set<string>,
): number {
  let score = 0;

  // Signal 1: Folder segment match (highest — KB organizational taxonomy)
  if (folderHits.has(entry.id)) {
    score += PROMPT_WEIGHTS.folderSegmentMatch;
  }

  // Signal 2: Title match against expanded terms
  const titleLower = entry.title.toLowerCase();
  for (const term of analysis.expandedTerms) {
    if (titleLower.includes(term)) {
      score += PROMPT_WEIGHTS.titleMatch;
      break;
    }
  }

  // Signal 3: Domain match
  const domainLower = entry.domain.toLowerCase();
  for (const term of analysis.expandedTerms) {
    if (domainLower.includes(term)) {
      score += PROMPT_WEIGHTS.domainMatch;
      break;
    }
  }

  // Signal 4: Category coherence — strong bonus for matching category
  if (analysis.categories.includes(entry.category)) {
    score += PROMPT_WEIGHTS.categoryMatch;
  } else if (analysis.categories.length > 0) {
    // Penalty: article is from a different category than what prompt asks for
    score -= 2.0;
  }

  // Signal 5: Tag overlap
  const termSet = new Set(analysis.expandedTerms);
  let tagMatches = 0;
  for (const tag of entry.tags) {
    if (termSet.has(tag)) tagMatches++;
  }
  if (tagMatches > 0) {
    score += Math.min(tagMatches * PROMPT_WEIGHTS.tagMatch, PROMPT_WEIGHTS.tagMatch * 3);
  }

  // Signal 6: Keyword overlap (appliesTo.keywords)
  let kwMatches = 0;
  for (const kw of entry.appliesTo.keywords) {
    if (termSet.has(kw)) kwMatches++;
  }
  if (kwMatches > 0) {
    score += Math.min(kwMatches * PROMPT_WEIGHTS.keywordMatch, PROMPT_WEIGHTS.keywordMatch * 3);
  }

  // Bonuses
  if (entry.directive) score += PROMPT_WEIGHTS.directiveBonus;
  if (entry.imperatives.length > 0) score += PROMPT_WEIGHTS.imperativeBonus;

  // Competing technology penalty — filter out irrelevant tech articles
  if (hasCompetingTechMismatch(entry, analysis)) {
    score += COMPETING_TECH_PENALTY;
  }

  return score;
}

/**
 * Check if an entry discusses a technology that competes with what the prompt asks for.
 * E.g., gRPC articles when prompt mentions REST/Express.
 */
function hasCompetingTechMismatch(entry: KbEntry, analysis: PromptAnalysis): boolean {
  const entrySegments = entry.id.toLowerCase().split("/");
  const allPromptTerms = new Set([
    ...analysis.technologies,
    ...analysis.expandedTerms,
    ...analysis.concepts,
  ]);

  for (const group of COMPETING_TECH_GROUPS) {
    const promptMentions = group.filter((t) => allPromptTerms.has(t));
    if (promptMentions.length === 0) continue;

    // Entry path contains a tech the prompt DOESN'T mention, from the same competing group
    const entryHasOtherTech = group.some(
      (t) => !allPromptTerms.has(t) && entrySegments.includes(t),
    );
    if (entryHasOtherTech) return true;
  }

  return false;
}

/**
 * Rank entries for a prompt-based lookup.
 */
export function rankEntriesForPrompt(
  entries: KbEntry[],
  analysis: PromptAnalysis,
  folderHits: Set<string>,
  limit: number = 5,
): Array<{ entry: KbEntry; score: number }> {
  const scored = entries
    .map((entry) => ({ entry, score: scoreEntryForPrompt(entry, analysis, folderHits) }))
    .filter((r) => r.score >= PROMPT_MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
