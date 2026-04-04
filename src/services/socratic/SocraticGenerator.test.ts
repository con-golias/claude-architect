import { describe, expect, test } from "bun:test";
import { generateQuestions, generateRecursiveQuestions } from "./SocraticGenerator";
import { Tier, Operator, Dimension } from "./SocraticTypes";

describe("SocraticGenerator", () => {
  describe("generateQuestions", () => {
    test("TRIVIAL tier → 0 questions", () => {
      const questions = generateQuestions("fix typo", Tier.TRIVIAL);
      expect(questions).toHaveLength(0);
    });

    test("STANDARD tier → 7 questions (one per dimension)", () => {
      const questions = generateQuestions("dark mode", Tier.STANDARD);
      expect(questions).toHaveLength(7);

      const dimensions = new Set(questions.map((q) => q.dimension));
      expect(dimensions.size).toBe(7);

      // All operators should be EINAI
      for (const q of questions) {
        expect(q.operator).toBe(Operator.EINAI);
      }
    });

    test("SIGNIFICANT tier → 77 questions (7 dimensions × 11 operators)", () => {
      const questions = generateQuestions("authentication", Tier.SIGNIFICANT);
      expect(questions).toHaveLength(77);

      const dimensions = new Set(questions.map((q) => q.dimension));
      expect(dimensions.size).toBe(7);

      const operators = new Set(questions.map((q) => q.operator));
      expect(operators.size).toBe(11);
    });

    test("questions contain the subject", () => {
      const questions = generateQuestions("dark mode", Tier.STANDARD);
      for (const q of questions) {
        expect(q.question).toContain("dark mode");
      }
    });

    test("question IDs are deterministic", () => {
      const q1 = generateQuestions("test", Tier.SIGNIFICANT);
      const q2 = generateQuestions("test", Tier.SIGNIFICANT);
      expect(q1.map((q) => q.id)).toEqual(q2.map((q) => q.id));
    });

    test("question IDs follow DIMENSION-OPERATOR format", () => {
      const questions = generateQuestions("test", Tier.STANDARD);
      for (const q of questions) {
        expect(q.id).toBe(`${q.dimension}-${q.operator}`);
      }
    });
  });

  describe("generateRecursiveQuestions", () => {
    test("level 2 → 7 questions (all dimensions, EINAI only)", () => {
      const questions = generateRecursiveQuestions("TI-EINAI", "CSS variables and ThemeProvider", 2);
      expect(questions).toHaveLength(7);

      for (const q of questions) {
        expect(q.id).toStartWith("L2-TI-EINAI-");
        expect(q.operator).toBe(Operator.EINAI);
      }
    });

    test("level 3 → 3 questions (TI, APO_TI, POU only)", () => {
      const questions = generateRecursiveQuestions("TI-EINAI", "ThemeProvider component", 3);
      expect(questions).toHaveLength(3);

      const dimensions = new Set(questions.map((q) => q.dimension));
      expect(dimensions).toContain(Dimension.TI);
      expect(dimensions).toContain(Dimension.APO_TI);
      expect(dimensions).toContain(Dimension.POU);
    });

    test("level 4+ → 0 questions (termination)", () => {
      const questions = generateRecursiveQuestions("TI-EINAI", "something", 4);
      expect(questions).toHaveLength(0);
    });

    test("level 5 → 0 questions", () => {
      const questions = generateRecursiveQuestions("TI-EINAI", "something", 5);
      expect(questions).toHaveLength(0);
    });
  });
});
