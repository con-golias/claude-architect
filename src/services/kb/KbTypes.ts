/**
 * Type definitions for the Knowledge Base index system.
 *
 * @module kb-types
 */

/** Parsed metadata from a KB markdown file (unified across all 4 formats). */
export interface KbMetadata {
  domain?: string;
  difficulty?: string;
  importance?: string;
  lastUpdated?: string;
  audience?: string;
  crossRef?: string[];
  directive?: string;
  coreRule?: string;
  category?: string;
  prerequisites?: string;
  version?: string;
}

/** A single entry in the KB index representing one markdown file. */
export interface KbEntry {
  /** Unique ID derived from relative path (e.g., "08-security/secure-coding/injection-prevention"). */
  id: string;
  /** Relative path from KB root to the .md file. */
  path: string;
  /** Document title (H1 heading). */
  title: string;
  /** Top-level category (e.g., "security", "frontend", "backend"). */
  category: string;
  /** Full domain path (e.g., "Security > Secure Coding > Injection Prevention"). */
  domain: string;
  /** Difficulty level if available. */
  difficulty?: string;
  /** Importance level if available. */
  importance?: string;
  /** AI Plugin Directive text. */
  directive?: string;
  /** Core Rule text. */
  coreRule?: string;
  /** Extracted tags (normalized, lowercase, hyphenated). */
  tags: string[];
  /** Programming languages present in code blocks. */
  languages: string[];
  /** Contexts where this KB entry applies. */
  appliesTo: {
    extensions: string[];
    pathPatterns: string[];
    keywords: string[];
  };
  /** Best practices (extracted text, max 10 items). */
  bestPractices: string[];
  /** Anti-patterns (name and fix, max 10 items). */
  antiPatterns: AntiPattern[];
  /** Enforcement checklist items (max 15 items). */
  checklist: string[];
  /** MUST/NEVER/ALWAYS directives extracted from content. */
  imperatives: string[];
  /** Byte size of the original file. */
  fileSize: number;
}

/** Anti-pattern with its fix. */
export interface AntiPattern {
  name: string;
  fix: string;
}

/** The complete KB index structure written to disk as JSON. */
export interface KbIndex {
  /** Schema version for forward compatibility. */
  version: 1;
  /** Timestamp of when the index was built. */
  builtAt: number;
  /** Total number of indexed files. */
  totalFiles: number;
  /** Hash of the KB directory for change detection. */
  kbHash: string;
  /** All indexed KB entries, keyed by entry ID. */
  entries: Record<string, KbEntry>;
  /** Inverted index: file extension -> entry IDs. */
  byExtension: Record<string, string[]>;
  /** Inverted index: path segment pattern -> entry IDs. */
  byPathPattern: Record<string, string[]>;
  /** Inverted index: keyword -> entry IDs. */
  byKeyword: Record<string, string[]>;
  /** Inverted index: programming language -> entry IDs. */
  byLanguage: Record<string, string[]>;
  /** Inverted index: top-level category -> entry IDs. */
  byCategory: Record<string, string[]>;
  /** Inverted index: domain tag -> entry IDs. */
  byDomain: Record<string, string[]>;
  /** Inverted index: KB folder name segment -> entry IDs. */
  byFolderSegment: Record<string, string[]>;
}

/** Context signals extracted from a target file for lookup. */
export interface LookupContext {
  fileExtension: string;
  pathSegments: string[];
  fileNameKeywords: string[];
  contentKeywords: string[];
  queryTerms: string[];
}

/** Result from a KB lookup query. */
export interface KbLookupResult {
  id: string;
  title: string;
  category: string;
  domain: string;
  score: number;
  directive?: string;
  coreRule?: string;
  tags: string[];
  languages: string[];
  imperatives: string[];
  bestPractices: string[];
  checklist: string[];
}

/** Structured analysis of a user prompt for KB lookup. */
export interface PromptAnalysis {
  /** Meaningful concepts extracted from the prompt. */
  concepts: string[];
  /** Detected technology/framework names. */
  technologies: string[];
  /** Inferred KB category names. */
  categories: string[];
  /** Original query terms for scoring. */
  queryTerms: string[];
  /** Terms after synonym expansion (for index lookup). */
  expandedTerms: string[];
}

/** Result from a prompt-based KB lookup with gap detection. */
export interface PromptLookupResult {
  results: KbLookupResult[];
  gaps: KbGap[];
  analysis: PromptAnalysis;
}

/** A detected gap where the KB lacks coverage for a concept. */
export interface KbGap {
  /** The concept that wasn't found. */
  concept: string;
  /** Which indices were searched. */
  searchedIndices: string[];
  /** Nearest existing folder match, if any. */
  closestMatch?: string;
  /** Human-readable suggestion for the gap. */
  suggestion: string;
}
