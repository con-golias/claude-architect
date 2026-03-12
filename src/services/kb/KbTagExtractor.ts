/**
 * Extracts tags from KB files using 7 sources:
 * path segments, domain metadata, title words, section headers,
 * code block languages, directive keywords, and technical terms.
 *
 * @module kb-tag-extractor
 */

import type { KbMetadata } from "./KbTypes";

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "need", "dare",
  "for", "and", "nor", "but", "or", "yet", "so", "in", "on", "at",
  "to", "of", "with", "by", "from", "up", "about", "into", "through",
  "during", "before", "after", "above", "below", "between", "out",
  "off", "over", "under", "again", "further", "then", "once", "here",
  "there", "when", "where", "why", "how", "all", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "not", "only",
  "own", "same", "than", "too", "very", "just", "because", "as",
  "until", "while", "also", "its", "it", "this", "that", "these",
  "those", "what", "which", "who", "whom", "whose", "if", "else",
  "complete", "specification", "overview", "fundamentals", "guide",
  "introduction", "advanced", "practical", "patterns", "best",
  "practices", "using", "vs", "based", "within", "every",
]);

const GENERIC_HEADERS = new Set([
  "what it is", "why it matters", "how it works", "sources", "references",
  "table of contents", "metadata", "prerequisites", "summary",
  "conclusion", "introduction", "further reading",
]);

const LANG_ALIASES: Record<string, string> = {
  ts: "typescript", tsx: "typescript", typescript: "typescript",
  js: "javascript", jsx: "javascript", javascript: "javascript",
  py: "python", python: "python",
  go: "go", golang: "go",
  java: "java", kt: "kotlin", kotlin: "kotlin",
  cs: "csharp", csharp: "csharp",
  rb: "ruby", ruby: "ruby",
  rs: "rust", rust: "rust",
  sql: "sql",
  yaml: "yaml", yml: "yaml",
  json: "json",
  html: "html", css: "css", scss: "scss", sass: "scss",
  sh: "bash", bash: "bash", shell: "bash", zsh: "bash",
  docker: "docker", dockerfile: "docker",
  graphql: "graphql", gql: "graphql",
  proto: "protobuf", protobuf: "protobuf",
  hcl: "hcl", terraform: "hcl",
  swift: "swift", dart: "dart", cpp: "cpp", c: "c",
  markdown: "markdown", md: "markdown",
  xml: "xml", toml: "toml", ini: "ini",
  text: "text", txt: "text", plaintext: "text",
};

/**
 * Extract all tags from a KB file using 7 sources.
 *
 * @param relativePath - Relative path from KB root (e.g., "08-security/secure-coding/input-validation.md")
 * @param content - Full file content
 * @param metadata - Parsed metadata
 * @returns Deduplicated, normalized tag array
 */
export function extractTags(
  relativePath: string,
  content: string,
  metadata: KbMetadata,
): string[] {
  const tags = new Set<string>();

  // Source 1: Path segments
  for (const tag of extractPathTags(relativePath)) {
    tags.add(tag);
  }

  // Source 2: Domain metadata
  if (metadata.domain) {
    for (const tag of extractDomainTags(metadata.domain)) {
      tags.add(tag);
    }
  }

  // Source 3: Title words
  const titleMatch = content.match(/^#\s+(.+)/m);
  if (titleMatch) {
    for (const tag of extractTitleTags(titleMatch[1])) {
      tags.add(tag);
    }
  }

  // Source 4: Section headers
  for (const tag of extractHeaderTags(content)) {
    tags.add(tag);
  }

  // Source 5: Code block languages
  for (const lang of extractCodeLanguages(content)) {
    tags.add(lang);
  }

  // Source 6: Directive keywords
  if (metadata.directive) {
    for (const tag of extractDirectiveKeywords(metadata.directive)) {
      tags.add(tag);
    }
  }

  // Source 7: Technical terms from first 1000 chars
  const snippet = content.slice(0, 1000);
  for (const tag of extractTechnicalTerms(snippet)) {
    tags.add(tag);
  }

  return Array.from(tags).sort();
}

/**
 * Extract programming languages from fenced code blocks.
 */
export function extractCodeLanguages(content: string): string[] {
  const langs = new Set<string>();
  const regex = /^```(\w+)/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const raw = match[1].toLowerCase();
    const canonical = LANG_ALIASES[raw];
    if (canonical && canonical !== "text" && canonical !== "markdown") {
      langs.add(canonical);
    }
  }

  return Array.from(langs).sort();
}

/** Source 1: Extract tags from file path segments. */
function extractPathTags(relativePath: string): string[] {
  return relativePath
    .replace(/\.md$/, "")
    .split(/[/\\]/)
    .map((seg) => seg.replace(/^\d+-/, ""))
    .filter((seg) => seg.length > 1)
    .map(normalize);
}

/** Source 2: Extract tags from domain string (split by " > " or " / "). */
function extractDomainTags(domain: string): string[] {
  return domain
    .split(/\s*[>/]\s*/)
    .map((seg) => seg.trim())
    .filter((seg) => seg.length > 1)
    .map(normalize);
}

/** Source 3: Extract tags from title words. */
function extractTitleTags(title: string): string[] {
  // Handle acronyms in parentheses: "CQRS (Command Query...)" -> add both
  const acronymMatch = title.match(/\(([A-Z]{2,})\)/);
  const tags: string[] = [];

  if (acronymMatch) {
    tags.push(acronymMatch[1].toLowerCase());
  }

  // Split on common separators and filter
  const words = title
    .replace(/[()—:,]/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9-]/g, ""))
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  return [...tags, ...words.map(normalize)];
}

/** Source 4: Extract tags from H2/H3 section headers. */
function extractHeaderTags(content: string): string[] {
  const tags: string[] = [];
  const regex = /^#{2,3}\s+(?:\d+\.\s+)?(.+)/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const header = match[1].trim().toLowerCase();
    if (GENERIC_HEADERS.has(header)) continue;

    // Normalize header to tag
    const tag = normalize(header.replace(/[()—:,]/g, " ").trim());
    if (tag.length > 1 && !STOPWORDS.has(tag)) {
      tags.push(tag);
    }
  }

  return tags.slice(0, 20);
}

/** Source 6: Extract keywords from AI Plugin Directive text. */
function extractDirectiveKeywords(directive: string): string[] {
  const words = directive
    .replace(/[()—:,."']/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  // Take unique technical-looking words
  return [...new Set(words)].filter((w) => /^[a-z]/.test(w)).slice(0, 10).map(normalize);
}

/** Source 7: Extract technical terms (CamelCase, ALL_CAPS, dotted). */
function extractTechnicalTerms(text: string): string[] {
  const terms = new Set<string>();

  // CamelCase words (e.g., "EventSourcing")
  const camelCase = text.match(/[A-Z][a-z]+[A-Z][a-zA-Z]*/g);
  if (camelCase) {
    for (const term of camelCase) {
      terms.add(normalize(term));
    }
  }

  // ALL_CAPS terms (e.g., "CQRS", "SOLID")
  const allCaps = text.match(/\b[A-Z]{2,}\b/g);
  if (allCaps) {
    for (const term of allCaps) {
      if (term.length <= 8) terms.add(term.toLowerCase());
    }
  }

  return Array.from(terms).slice(0, 10);
}

/** Normalize a string to a kebab-case tag. */
function normalize(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}
