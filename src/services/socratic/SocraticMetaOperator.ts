/**
 * META-OPERATOR: ΞΕΡΟΥΜΕ / ΥΠΟΘΕΤΟΥΜΕ enforcement gate.
 * Applied to EVERY answer — the most critical part of the system.
 * If Claude assumes → BLOCKED → verification required.
 *
 * @module SocraticMetaOperator
 */

import {
  Confidence,
  Dimension,
  VerificationMethod,
  type SocraticAnswer,
  type VerificationCommand,
} from "./SocraticTypes";
import { VERIFICATION_MAP } from "./SocraticMatrix";

/**
 * Evaluate an answer's confidence and return verification command if needed.
 * KSERO with evidence → pass (null).
 * YPOTHETO or DEN_KSERO → BLOCKED with actionable verification steps.
 *
 * @param answer - The answer to evaluate
 * @param dimension - Which dimension this answer belongs to
 * @returns null if verified, VerificationCommand if blocked
 */
export function evaluateConfidence(
  answer: SocraticAnswer,
  dimension: Dimension,
): VerificationCommand | null {
  if (answer.confidence === Confidence.KSERO && answer.evidence) {
    return null; // Verified — pass
  }

  const verificationInfo = VERIFICATION_MAP[dimension];
  const suggestedActions = generateVerificationActions(
    dimension,
    verificationInfo.method,
    answer.answer,
  );

  const reason =
    answer.confidence === Confidence.YPOTHETO
      ? "ΥΠΟΘΕΣΗ — πρέπει verification πριν προχωρήσεις"
      : "ΔΕΝ ΞΕΡΕΙΣ — ψάξε πρώτα";

  return {
    questionId: answer.questionId,
    dimension,
    method: verificationInfo.method,
    suggestedActions,
    description: `${reason}. ${verificationInfo.description}`,
  };
}

/**
 * Generate actionable verification steps based on dimension and method.
 *
 * @param dimension - The question dimension
 * @param method - The verification method to use
 * @param answerText - The answer to verify
 * @returns Array of concrete actions Claude Code should take
 */
function generateVerificationActions(
  dimension: Dimension,
  method: VerificationMethod,
  answerText: string,
): string[] {
  const keywords = extractKeywords(answerText);
  const keywordStr = keywords.join(", ");

  switch (method) {
    case VerificationMethod.READ_CODEBASE:
      return buildCodebaseActions(dimension, keywords);

    case VerificationMethod.WEB_SEARCH:
      return [
        `Web search: "${answerText} definition"`,
        `Web search: "${keywordStr} specification standard"`,
      ];

    case VerificationMethod.ASK_USER:
      return [
        `Ask user: "${buildUserQuestion(dimension, answerText)}"`,
      ];

    case VerificationMethod.WEB_SEARCH_AND_DOCS:
      return [
        `Web search: "${keywordStr} best practices"`,
        `Web search: "${keywordStr} official documentation"`,
        ...buildCodebaseActions(dimension, keywords),
      ];
  }
}

/**
 * Build codebase-reading verification actions.
 */
function buildCodebaseActions(
  dimension: Dimension,
  keywords: string[],
): string[] {
  const actions: string[] = [];
  const grepTerms = keywords.slice(0, 3);

  switch (dimension) {
    case Dimension.APO_TI:
      actions.push(`Read: package.json (check dependencies)`);
      for (const term of grepTerms) {
        actions.push(`Grep: "${term}" in src/`);
      }
      break;

    case Dimension.POTE:
      for (const term of grepTerms) {
        actions.push(`Grep: "import.*${term}" in src/`);
      }
      actions.push(`Read: CI/CD config files`);
      break;

    case Dimension.POU:
      for (const term of grepTerms) {
        actions.push(`Glob: **/*${term}*`);
      }
      actions.push(`List: directory structure of affected scope`);
      break;

    default:
      for (const term of grepTerms) {
        actions.push(`Grep: "${term}" in project`);
      }
  }

  return actions;
}

/**
 * Build a user-facing question for ASK_USER dimensions.
 */
function buildUserQuestion(dimension: Dimension, answerText: string): string {
  switch (dimension) {
    case Dimension.GIATI:
      return `Why is this needed: ${answerText}? What is the business reason?`;
    case Dimension.POIOS:
      return `Who is responsible for / affected by: ${answerText}?`;
    default:
      return `Can you confirm: ${answerText}?`;
  }
}

/**
 * Extract meaningful keywords from answer text for search/grep.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been",
    "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "that", "this", "it", "not", "but", "and", "or", "if", "as",
    "its", "has", "had", "have", "will", "would", "could", "should",
    "can", "may", "must", "shall", "do", "does", "did",
    "στο", "από", "για", "με", "το", "τα", "τη", "την", "τον",
    "και", "ή", "αν", "θα", "να", "δεν", "μη", "που", "πως",
    "είναι", "ένα", "μία", "ένας",
  ]);

  return text
    .split(/[\s,;:()[\]{}'"]+/)
    .map((w) => w.replace(/[^\w\-./]/g, ""))
    .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()))
    .slice(0, 5);
}
