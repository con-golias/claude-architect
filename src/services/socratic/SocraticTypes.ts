/**
 * Type definitions for the Socratic Reasoning Engine.
 * 7 Aristotelian dimensions × 11 modal operators = 77 pre-action questions.
 *
 * @module SocraticTypes
 */

/* ── Enums ───────────────────────────────────────────────── */

/** Aristotle's causes + place/time/subject */
export enum Dimension {
  TI = "TI",             // Τυπικό αίτιο — What
  GIATI = "GIATI",       // Τελικό αίτιο — Why
  APO_TI = "APO_TI",     // Υλικό αίτιο — From what
  POS = "POS",           // Ποιητικό αίτιο — How
  POTE = "POTE",         // Χρόνος — When
  POIOS = "POIOS",       // Υποκείμενο — Who
  POU = "POU",           // Τόπος — Where
}

/** Modal logic operators */
export enum Operator {
  EINAI = "EINAI",             // Κατάφαση — Is
  DEN_EINAI = "DEN_EINAI",     // Άρνηση — Is not
  PREPEI = "PREPEI",           // Δεοντικό — Must
  DEN_PREPEI = "DEN_PREPEI",   // Απαγόρευση — Must not
  MPOREI = "MPOREI",           // Δυνατότητα — Can
  DEN_MPOREI = "DEN_MPOREI",   // Αδυναμία — Cannot
  ALLAZEI = "ALLAZEI",         // Μεταβολή — Changes
  EKSARTATAI = "EKSARTATAI",   // Εξάρτηση — Depends on
  PROKALEI = "PROKALEI",       // Αιτιότητα — Causes
  MOIAZEI = "MOIAZEI",         // Αναλογία — Resembles
  ORIO = "ORIO",               // Σύνορο — Boundary
}

/** Confidence level for the META-OPERATOR gate */
export enum Confidence {
  KSERO = "KSERO",           // Verified fact
  YPOTHETO = "YPOTHETO",     // Assumption — BLOCKED
  DEN_KSERO = "DEN_KSERO",   // Unknown — BLOCKED
}

/** Action classification tier */
export enum Tier {
  TRIVIAL = "TRIVIAL",         // 0 questions — bypass
  STANDARD = "STANDARD",       // 7 questions (1 per dimension)
  SIGNIFICANT = "SIGNIFICANT", // 77 questions + recursion
}

/** Session lifecycle state */
export enum SessionStatus {
  ANALYZING = "ANALYZING",
  AWAITING_ANSWERS = "AWAITING_ANSWERS",
  VERIFYING = "VERIFYING",
  BLOCKED = "BLOCKED",
  VALIDATED = "VALIDATED",
}

/** Atomicity classification for recursion control */
export enum Atomicity {
  ATOMIC = "ATOMIC",           // Terminal — no recursion
  NON_ATOMIC = "NON_ATOMIC",   // Needs decomposition
  TERMINAL = "TERMINAL",       // Verifiable command output
}

/** How to verify an assumption */
export enum VerificationMethod {
  READ_CODEBASE = "READ_CODEBASE",
  WEB_SEARCH = "WEB_SEARCH",
  ASK_USER = "ASK_USER",
  WEB_SEARCH_AND_DOCS = "WEB_SEARCH_AND_DOCS",
}

/* ── Constants ───────────────────────────────────────────── */

export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const MAX_RECURSION_DEPTH = 4;
export const MAX_QUESTIONS_PER_LEVEL = 35;

export const ACTION_TYPES = [
  "file_creation",
  "major_refactor",
  "architecture_change",
  "dependency_addition",
  "api_modification",
  "database_change",
  "config_change",
  "security_sensitive",
  "feature_addition",
  "bug_fix",
  "performance_optimization",
  "other_significant",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

/* ── Core interfaces ─────────────────────────────────────── */

export interface SocraticQuestion {
  id: string;
  dimension: Dimension;
  operator: Operator;
  template: string;
  question: string;
}

export interface SocraticAnswer {
  questionId: string;
  answer: string;
  confidence: Confidence;
  evidence: string | null;
  atomicity: Atomicity;
  verifiedAt: number | null;
}

export interface VerificationCommand {
  questionId: string;
  dimension: Dimension;
  method: VerificationMethod;
  suggestedActions: string[];
  description: string;
}

/* ── Tool I/O interfaces ─────────────────────────────────── */

export interface AnalyzeInput {
  actionDescription: string;
  actionType: string;
  affectedScope: string;
  userOriginalPrompt: string;
}

export interface AnalyzeResult {
  sessionId: string;
  tier: Tier;
  questionCount: number;
  questionsByDimension: Record<string, SocraticQuestion[]>;
  summary: string;
}

export interface VerifyInput {
  sessionId: string;
  answers: Record<string, {
    answer: string;
    confidence: Confidence;
    evidence: string | null;
  }>;
}

export interface VerifyResult {
  status: "VALIDATED" | "BLOCKED";
  verifiedCount: number;
  assumptionCount: number;
  unknownCount: number;
  verificationCommands: VerificationCommand[];
  strategyChanges: string[];
  humanQuestions: string[];
  context: SocraticContext | null;
  summary: string;
}

export interface StatusResult {
  sessionId: string;
  status: SessionStatus;
  tier: Tier;
  totalQuestions: number;
  verifiedCount: number;
  assumptionCount: number;
  unknownCount: number;
  blockedQuestions: Array<{ questionId: string; question: string; reason: string }>;
  createdAt: number;
  expiresAt: number;
  isExpired: boolean;
}

/* ── Verified context (zero coupling — data only) ───────── */

export interface SocraticContext {
  /** Programming language detected — from ΑΠΟ_ΤΙ×ΕΙΝΑΙ */
  language: string | null;
  /** Framework/runtime — from ΑΠΟ_ΤΙ×ΕΙΝΑΙ */
  framework: string | null;
  /** Project structure type — from ΠΟΥ×ΕΙΝΑΙ */
  projectStructure: "flat" | "feature-first" | "clean-arch" | null;
  /** Actual directory paths found — from ΠΟΥ×ΕΙΝΑΙ */
  directories: string[];
  /** Constraints and prohibitions — from ΤΙ×ΔΕΝ_ΠΡΕΠΕΙ + ΤΙ×ΠΡΕΠΕΙ */
  constraints: string[];
  /** Full technology list — from ΑΠΟ_ΤΙ×ΕΙΝΑΙ */
  technologies: string[];
  /** Existing patterns found — from ΠΩΣ×ΜΟΙΑΖΕΙ + ΠΟΥ×ΜΟΙΑΖΕΙ */
  patterns: string[];
  /** All verified dimension→answer pairs */
  verifiedFacts: Record<string, string>;
  /** File paths found — from ΠΟΥ dimension */
  filePaths: string[];
  /** Stakeholders — from ΠΟΙΟΣ×ΕΙΝΑΙ */
  stakeholders: string[];
}

/* ── Database record types ───────────────────────────────── */

export interface SocraticSessionRecord {
  id: string;
  prompt: string;
  action_type: string;
  action_description: string;
  affected_scope: string;
  tier: string;
  status: string;
  recursion_level: number;
  parent_question_id: string | null;
  created_at: number;
  validated_at: number | null;
  expires_at: number;
}

export interface SocraticAnswerRecord {
  id: number;
  session_id: string;
  question_id: string;
  dimension: string;
  operator: string;
  question: string;
  answer: string | null;
  confidence: string | null;
  evidence: string | null;
  atomicity: string | null;
  verified_at: number | null;
  created_at: number;
}
