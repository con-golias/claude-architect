/**
 * Socratic Bridge — extracts structured context from verified answers.
 * ZERO COUPLING with KB system: produces data only, never imports KB modules.
 * Used by scaffold (optionally) and by Claude for better kb_lookup queries.
 *
 * @module SocraticBridge
 */

import type { Database } from "bun:sqlite";
import type { SocraticContext, SocraticAnswerRecord } from "./SocraticTypes";
import { getAnswersBySession } from "../sqlite/Socratic";

/**
 * Extract structured context from a validated session's answers.
 * Groups verified facts by dimension into a typed context object.
 *
 * @param db - Database instance
 * @param sessionId - Validated session ID
 * @returns Structured context (data-only, no KB dependency)
 */
export function extractContext(
  db: Database,
  sessionId: string,
): SocraticContext {
  const answers = getAnswersBySession(db, sessionId);
  const verified = answers.filter((a) => a.answer && a.confidence === "KSERO");

  const technologies = extractByDimension(verified, "APO_TI", "EINAI");
  const directories = extractPaths(verified);
  const patterns = [
    ...extractByDimension(verified, "POS", "MOIAZEI"),
    ...extractByDimension(verified, "POU", "MOIAZEI"),
  ];

  return {
    language: detectLanguage(technologies, verified),
    framework: detectFramework(technologies),
    projectStructure: detectStructure(directories, patterns),
    directories,
    constraints: [
      ...extractByDimension(verified, "TI", "DEN_PREPEI"),
      ...extractByDimension(verified, "TI", "PREPEI"),
      ...extractByDimension(verified, "TI", "DEN_MPOREI"),
    ],
    technologies,
    patterns,
    verifiedFacts: buildVerifiedFacts(verified),
    filePaths: extractAllPaths(verified),
    stakeholders: extractByDimension(verified, "POIOS", "EINAI"),
  };
}

/* ── Enrichment helpers ──────────────────────────────────── */

const LANGUAGE_MAP: Record<string, string> = {
  typescript: "TypeScript", ts: "TypeScript",
  javascript: "JavaScript", js: "JavaScript",
  python: "Python", py: "Python",
  java: "Java", kotlin: "Kotlin",
  go: "Go", golang: "Go",
  rust: "Rust", ruby: "Ruby",
  csharp: "C#", "c#": "C#",
  php: "PHP", swift: "Swift",
};

const FRAMEWORK_MAP: Record<string, string> = {
  react: "React", next: "Next.js", nextjs: "Next.js",
  vue: "Vue", nuxt: "Nuxt", angular: "Angular",
  express: "Express", fastify: "Fastify", koa: "Koa",
  django: "Django", flask: "Flask", fastapi: "FastAPI",
  spring: "Spring", rails: "Rails",
  tailwind: "Tailwind CSS", polaris: "Shopify Polaris",
};

/**
 * Detect programming language from technologies and verified answers.
 */
function detectLanguage(
  technologies: string[],
  verified: SocraticAnswerRecord[],
): string | null {
  // Check technologies first
  for (const tech of technologies) {
    const lower = tech.toLowerCase().trim();
    if (LANGUAGE_MAP[lower]) return LANGUAGE_MAP[lower];
  }

  // Check verified facts for language mentions
  for (const a of verified) {
    if (!a.answer) continue;
    const lower = a.answer.toLowerCase();
    for (const [key, lang] of Object.entries(LANGUAGE_MAP)) {
      if (lower.includes(key)) return lang;
    }
  }

  return null;
}

/**
 * Detect framework from technologies list.
 */
function detectFramework(technologies: string[]): string | null {
  for (const tech of technologies) {
    const lower = tech.toLowerCase().trim();
    if (FRAMEWORK_MAP[lower]) return FRAMEWORK_MAP[lower];
  }
  return null;
}

const CLEAN_ARCH_MARKERS = ["domain", "application", "infrastructure", "use-cases", "entities", "ports"];
const FEATURE_FIRST_MARKERS = ["features/", "modules/", "feature-"];

/**
 * Detect project structure type from directories and patterns.
 */
function detectStructure(
  directories: string[],
  patterns: string[],
): "flat" | "feature-first" | "clean-arch" | null {
  const allPaths = [...directories, ...patterns].map((d) => d.toLowerCase());

  // Clean architecture markers
  if (CLEAN_ARCH_MARKERS.some((m) => allPaths.some((p) => p.includes(m)))) {
    return "clean-arch";
  }

  // Feature-first markers
  if (FEATURE_FIRST_MARKERS.some((m) => allPaths.some((p) => p.includes(m)))) {
    return "feature-first";
  }

  // Flat structure: no nested src dirs
  if (directories.length > 0 && directories.every((d) => d.split("/").length <= 2)) {
    return "flat";
  }

  return null;
}

/* ── Base helpers ────────────────────────────────────────── */

function buildVerifiedFacts(
  answers: SocraticAnswerRecord[],
): Record<string, string> {
  const facts: Record<string, string> = Object.create(null);
  for (const a of answers) {
    if (a.answer) {
      facts[`${a.dimension}-${a.operator}`] = a.answer;
    }
  }
  return facts;
}

function extractByDimension(
  answers: SocraticAnswerRecord[],
  dimension: string,
  operator: string,
): string[] {
  return answers
    .filter((a) => a.dimension === dimension && a.operator === operator && a.answer)
    .flatMap((a) => splitConcepts(a.answer!));
}

/**
 * Extract directory paths from POU dimension (for directories field).
 */
function extractPaths(answers: SocraticAnswerRecord[]): string[] {
  return answers
    .filter((a) => a.dimension === "POU" && a.operator === "EINAI" && a.answer)
    .flatMap((a) => splitConcepts(a.answer!))
    .filter((s) => /[/\\]/.test(s));
}

/**
 * Extract all file-like paths from POU dimension (for filePaths field).
 */
function extractAllPaths(answers: SocraticAnswerRecord[]): string[] {
  return answers
    .filter((a) => a.dimension === "POU" && a.answer)
    .flatMap((a) => splitConcepts(a.answer!))
    .filter((s) => /[/\\.]/.test(s));
}

function splitConcepts(text: string): string[] {
  return text
    .split(/[,;]\s*|\s+και\s+|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}
