/**
 * Socratic Reasoning Engine — central orchestrator.
 * Ties together: classifier → generator → meta-operator → atomicity → DB.
 * Three operations: analyze, verify, getStatus.
 *
 * @module SocraticEngine
 */

import type { Database } from "bun:sqlite";
import {
  type AnalyzeInput,
  type AnalyzeResult,
  type VerifyInput,
  type VerifyResult,
  type StatusResult,
  type VerificationCommand,
  type SocraticAnswer,
  Tier,
  Confidence,
  SessionStatus,
  Atomicity,
  MAX_RECURSION_DEPTH,
} from "./SocraticTypes";
import { DIMENSION_LABELS } from "./SocraticMatrix";
import { classifyTier, isBypassRequested } from "./SocraticTierClassifier";
import { generateQuestions, generateRecursiveQuestions } from "./SocraticGenerator";
import { evaluateConfidence } from "./SocraticMetaOperator";
import { classifyAtomicity } from "./SocraticAtomicity";
import { extractContext } from "./SocraticBridge";
import {
  createSocraticSession,
  getSocraticSession,
  updateSessionStatus,
  insertSocraticQuestions,
  updateSocraticAnswer,
  getAnswersBySession,
  getAnswerStats,
} from "../sqlite/Socratic";
import type { Dimension } from "./SocraticTypes";

/**
 * Analyze an action: classify tier, generate questions, store session.
 * TRIVIAL → auto-bypass. STANDARD → 7 questions. SIGNIFICANT → 77.
 */
export function analyze(db: Database, input: AnalyzeInput): AnalyzeResult {
  // Check bypass
  if (isBypassRequested(input.userOriginalPrompt)) {
    const sessionId = createSocraticSession(db, {
      prompt: input.userOriginalPrompt,
      actionType: input.actionType,
      actionDescription: input.actionDescription,
      affectedScope: input.affectedScope,
      tier: Tier.TRIVIAL,
    });
    updateSessionStatus(db, sessionId, SessionStatus.VALIDATED, Date.now());

    return {
      sessionId,
      tier: Tier.TRIVIAL,
      questionCount: 0,
      questionsByDimension: {},
      summary: "⚠️ Socratic analysis skipped (user bypass). Proceeding with assumptions.",
    };
  }

  // Classify tier
  const tier = classifyTier(
    input.actionDescription,
    input.actionType,
    input.affectedScope,
  );

  // Trivial → auto-validate
  if (tier === Tier.TRIVIAL) {
    const sessionId = createSocraticSession(db, {
      prompt: input.userOriginalPrompt,
      actionType: input.actionType,
      actionDescription: input.actionDescription,
      affectedScope: input.affectedScope,
      tier: Tier.TRIVIAL,
    });
    updateSessionStatus(db, sessionId, SessionStatus.VALIDATED, Date.now());

    return {
      sessionId,
      tier: Tier.TRIVIAL,
      questionCount: 0,
      questionsByDimension: {},
      summary: "Trivial action — Socratic analysis not required. Proceed.",
    };
  }

  // Generate questions
  const subject = extractSubject(input.actionDescription);
  const questions = generateQuestions(subject, tier);

  // Create session + store questions
  const sessionId = createSocraticSession(db, {
    prompt: input.userOriginalPrompt,
    actionType: input.actionType,
    actionDescription: input.actionDescription,
    affectedScope: input.affectedScope,
    tier,
  });
  insertSocraticQuestions(db, sessionId, questions);

  // Group by dimension for structured output
  const questionsByDimension: Record<string, typeof questions> = {};
  for (const q of questions) {
    const label = DIMENSION_LABELS[q.dimension];
    if (!questionsByDimension[label]) questionsByDimension[label] = [];
    questionsByDimension[label].push(q);
  }

  return {
    sessionId,
    tier,
    questionCount: questions.length,
    questionsByDimension,
    summary: `Analyzing: ${questions.length} questions across 7 dimensions (${tier} tier). Answer each — for every answer, state: KNOWN / ASSUMED / UNKNOWN.`,
  };
}

/**
 * Verify answers against the META-OPERATOR gate.
 * KSERO → pass. YPOTHETO/DEN_KSERO → BLOCKED with verification commands.
 * If all verified → check atomicity for recursion → VALIDATED.
 */
export function verify(db: Database, input: VerifyInput): VerifyResult {
  const session = getSocraticSession(db, input.sessionId);
  if (!session) {
    return blockedResult("Session not found. Call socratic_analyze first.");
  }
  if (session.expires_at <= Date.now()) {
    updateSessionStatus(db, input.sessionId, SessionStatus.BLOCKED);
    return blockedResult("Session expired (30min TTL). Run socratic_analyze again.");
  }

  // Process each answer
  const verificationCommands: VerificationCommand[] = [];
  const strategyChanges: string[] = [];
  const humanQuestions: string[] = [];
  let verifiedCount = 0;
  let assumptionCount = 0;
  let unknownCount = 0;

  for (const [questionId, answerData] of Object.entries(input.answers)) {
    const atomicity = classifyAtomicity(answerData.answer);
    const isVerified = answerData.confidence === Confidence.KSERO;
    const now = Date.now();

    // Persist answer
    updateSocraticAnswer(db, input.sessionId, questionId, {
      answer: answerData.answer,
      confidence: answerData.confidence,
      evidence: answerData.evidence,
      atomicity,
      verifiedAt: isVerified ? now : null,
    });

    // Evaluate via META-OPERATOR
    const dimension = extractDimensionFromQuestionId(questionId);
    const socraticAnswer: SocraticAnswer = {
      questionId,
      answer: answerData.answer,
      confidence: answerData.confidence,
      evidence: answerData.evidence,
      atomicity,
      verifiedAt: isVerified ? now : null,
    };

    const verification = evaluateConfidence(socraticAnswer, dimension);

    if (verification === null) {
      verifiedCount++;
    } else {
      if (answerData.confidence === Confidence.YPOTHETO) {
        assumptionCount++;
      } else {
        unknownCount++;
      }
      verificationCommands.push(verification);

      // Human-input questions (ASK_USER dimensions)
      if (verification.method === "ASK_USER" as any) {
        humanQuestions.push(
          ...verification.suggestedActions.filter((a) => a.startsWith("Ask user:")),
        );
      }
    }
  }

  // If assumptions remain → BLOCKED
  if (assumptionCount > 0 || unknownCount > 0) {
    updateSessionStatus(db, input.sessionId, SessionStatus.BLOCKED);

    return {
      status: "BLOCKED",
      verifiedCount,
      assumptionCount,
      unknownCount,
      verificationCommands,
      strategyChanges,
      humanQuestions,
      context: null,
      summary: buildSummary(verifiedCount, assumptionCount, unknownCount, humanQuestions),
    };
  }

  // All verified — check for recursion
  if (session.recursion_level < MAX_RECURSION_DEPTH) {
    const nonAtomicAnswers = findNonAtomicAnswers(db, input.sessionId);
    if (nonAtomicAnswers.length > 0) {
      // Strategy change: found decomposable answers
      for (const na of nonAtomicAnswers.slice(0, 3)) {
        strategyChanges.push(
          `Decomposable: "${na.answer}" (from ${na.question_id}) → needs deeper analysis`,
        );
      }
    }
  }

  // VALIDATED
  updateSessionStatus(db, input.sessionId, SessionStatus.VALIDATED, Date.now());

  // Extract verified context (zero-coupling: data only, no KB imports)
  const context = extractContext(db, input.sessionId);

  return {
    status: "VALIDATED",
    verifiedCount,
    assumptionCount: 0,
    unknownCount: 0,
    verificationCommands: [],
    strategyChanges,
    humanQuestions: [],
    context,
    summary: `✅ Analyzed: ${verifiedCount} questions, 0 assumptions. All verified. Proceed with implementation.`,
  };
}

/**
 * Get current status of a Socratic session.
 */
export function getStatus(db: Database, sessionId: string): StatusResult {
  const session = getSocraticSession(db, sessionId);
  if (!session) {
    return {
      sessionId,
      status: SessionStatus.BLOCKED,
      tier: Tier.STANDARD,
      totalQuestions: 0,
      verifiedCount: 0,
      assumptionCount: 0,
      unknownCount: 0,
      blockedQuestions: [],
      createdAt: 0,
      expiresAt: 0,
      isExpired: true,
    };
  }

  const stats = getAnswerStats(db, sessionId);
  const isExpired = session.expires_at <= Date.now();

  // Get blocked questions
  const answers = getAnswersBySession(db, sessionId);
  const blockedQuestions = answers
    .filter((a) => a.confidence && a.confidence !== "KSERO")
    .map((a) => ({
      questionId: a.question_id,
      question: a.question,
      reason: a.confidence === "YPOTHETO" ? "Assumption — needs verification" : "Unknown — needs research",
    }));

  return {
    sessionId,
    status: session.status as SessionStatus,
    tier: session.tier as Tier,
    totalQuestions: stats.total,
    verifiedCount: stats.verified,
    assumptionCount: stats.assumptions,
    unknownCount: stats.unknown,
    blockedQuestions,
    createdAt: session.created_at,
    expiresAt: session.expires_at,
    isExpired,
  };
}

/* ── Internal helpers ────────────────────────────────────── */

function extractSubject(actionDescription: string): string {
  // Remove common prefixes and trim
  return actionDescription
    .replace(/^(add|create|implement|build|fix|update|modify|change|refactor)\s+/i, "")
    .replace(/^(a|an|the)\s+/i, "")
    .trim();
}

function extractDimensionFromQuestionId(questionId: string): Dimension {
  // Format: "TI-EINAI" or "L2-TI-EINAI-TI-EINAI"
  const parts = questionId.split("-");
  // Skip recursion prefix if present (L2-, L3-)
  const dimPart = questionId.startsWith("L") ? parts[1] : parts[0];
  // Handle compound dimension names like APO_TI
  if (parts.length > 2 && !questionId.startsWith("L")) {
    const candidate = `${parts[0]}_${parts[1]}`;
    if (candidate === "APO_TI" || candidate === "DEN_EINAI" || candidate === "DEN_PREPEI" ||
        candidate === "DEN_MPOREI") {
      // The dimension is the first part, but for compound IDs like APO_TI-EINAI
      // the format is actually just DIMENSION-OPERATOR where DIMENSION can contain _
      // Let's parse differently
    }
  }

  // More robust: question ID format is DIMENSION-OPERATOR
  // Dimensions with underscores: APO_TI
  // Operators with underscores: DEN_EINAI, DEN_PREPEI, DEN_MPOREI
  // So "APO_TI-DEN_EINAI" → dimension=APO_TI, operator=DEN_EINAI
  // Strategy: try to match known dimension prefixes
  const DIMENSION_VALUES = ["TI", "GIATI", "APO_TI", "POS", "POTE", "POIOS", "POU"];

  const cleanId = questionId.startsWith("L")
    ? questionId.replace(/^L\d+-[^-]+-/, "") // strip recursion prefix
    : questionId;

  for (const dim of DIMENSION_VALUES) {
    if (cleanId.startsWith(dim + "-")) {
      return dim as Dimension;
    }
  }

  // Fallback — sort by longest match first to handle APO_TI before TI
  const sorted = [...DIMENSION_VALUES].sort((a, b) => b.length - a.length);
  for (const dim of sorted) {
    if (cleanId.includes(dim)) {
      return dim as Dimension;
    }
  }

  return "TI" as Dimension; // Safe fallback
}

function findNonAtomicAnswers(
  db: Database,
  sessionId: string,
): Array<{ question_id: string; answer: string }> {
  return db
    .query<{ question_id: string; answer: string }, [string, string]>(
      `SELECT question_id, answer FROM socratic_answers
       WHERE session_id = ? AND atomicity = ? AND answer IS NOT NULL`,
    )
    .all(sessionId, Atomicity.NON_ATOMIC);
}

function buildSummary(
  verified: number,
  assumptions: number,
  unknown: number,
  humanQuestions: string[],
): string {
  const parts: string[] = [];
  parts.push(`⛔ BLOCKED: ${verified} verified, ${assumptions} assumptions, ${unknown} unknown.`);

  if (assumptions > 0) {
    parts.push(`Resolve ${assumptions} assumption(s) — verify each before proceeding.`);
  }
  if (unknown > 0) {
    parts.push(`Research ${unknown} unknown(s) — search codebase or ask user.`);
  }
  if (humanQuestions.length > 0) {
    parts.push(`Questions for user:\n${humanQuestions.map((q) => `  • ${q}`).join("\n")}`);
  }

  return parts.join("\n");
}

function blockedResult(reason: string): VerifyResult {
  return {
    status: "BLOCKED",
    verifiedCount: 0,
    assumptionCount: 0,
    unknownCount: 0,
    verificationCommands: [],
    strategyChanges: [],
    humanQuestions: [],
    context: null,
    summary: `⛔ ${reason}`,
  };
}
