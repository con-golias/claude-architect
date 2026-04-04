/**
 * Generates Socratic questions from the 7×11 matrix.
 * Deterministic: same input always produces same questions.
 *
 * @module SocraticGenerator
 */

import {
  type SocraticQuestion,
  type Atomicity,
  Dimension,
  Tier,
  MAX_RECURSION_DEPTH,
} from "./SocraticTypes";
import {
  QUESTION_TEMPLATES,
  TIER_STRATEGY,
  RECURSION_STRATEGY,
} from "./SocraticMatrix";

/**
 * Generate questions for a subject based on tier.
 * TRIVIAL → 0, STANDARD → 7, SIGNIFICANT → 77.
 *
 * @param subject - The topic to question (from action description)
 * @param tier - Analysis depth tier
 * @returns Deterministically ordered question list
 */
export function generateQuestions(
  subject: string,
  tier: Tier,
): SocraticQuestion[] {
  const strategy = TIER_STRATEGY[tier];
  if (strategy.dimensions.length === 0) return [];

  const questions: SocraticQuestion[] = [];

  for (const dimension of strategy.dimensions) {
    for (const operator of strategy.operators) {
      const template = QUESTION_TEMPLATES[dimension][operator];
      questions.push({
        id: `${dimension}-${operator}`,
        dimension,
        operator,
        template,
        question: template.replace(/\{subject\}/g, subject),
      });
    }
  }

  return questions;
}

/**
 * Generate recursive follow-up questions for a non-atomic answer.
 * Level 2: 7 questions (all dimensions, EINAI only), cap 35 total.
 * Level 3: 3 questions (TI, APO_TI, POU), cap 15 total.
 * Level 4+: none (termination).
 *
 * @param parentQuestionId - The question whose answer spawned recursion
 * @param answerSubject - The non-atomic answer text (becomes new subject)
 * @param recursionLevel - Current depth (2, 3, or 4+)
 * @returns Follow-up questions, or empty array if at max depth
 */
export function generateRecursiveQuestions(
  parentQuestionId: string,
  answerSubject: string,
  recursionLevel: number,
): SocraticQuestion[] {
  if (recursionLevel >= MAX_RECURSION_DEPTH) return [];

  const strategy = RECURSION_STRATEGY[recursionLevel];
  if (!strategy) return [];

  const questions: SocraticQuestion[] = [];

  for (const dimension of strategy.dimensions) {
    for (const operator of strategy.operators) {
      if (questions.length >= strategy.maxQuestions) break;

      const template = QUESTION_TEMPLATES[dimension][operator];
      questions.push({
        id: `L${recursionLevel}-${parentQuestionId}-${dimension}-${operator}`,
        dimension,
        operator,
        template,
        question: template.replace(/\{subject\}/g, answerSubject),
      });
    }
    if (questions.length >= strategy.maxQuestions) break;
  }

  return questions;
}
