import { describe, expect, test } from "bun:test";
import { evaluateConfidence } from "./SocraticMetaOperator";
import { Confidence, Dimension, Atomicity } from "./SocraticTypes";
import type { SocraticAnswer } from "./SocraticTypes";

function makeAnswer(overrides: Partial<SocraticAnswer> = {}): SocraticAnswer {
  return {
    questionId: "TI-EINAI",
    answer: "Express middleware",
    confidence: Confidence.KSERO,
    evidence: "package.json shows express@4.18",
    atomicity: Atomicity.ATOMIC,
    verifiedAt: Date.now(),
    ...overrides,
  };
}

describe("SocraticMetaOperator", () => {
  describe("evaluateConfidence", () => {
    test("KSERO with evidence → null (pass)", () => {
      const result = evaluateConfidence(makeAnswer(), Dimension.TI);
      expect(result).toBeNull();
    });

    test("KSERO without evidence → returns verification command", () => {
      const result = evaluateConfidence(
        makeAnswer({ evidence: null }),
        Dimension.TI,
      );
      expect(result).not.toBeNull();
      expect(result!.questionId).toBe("TI-EINAI");
    });

    test("YPOTHETO → returns verification command", () => {
      const result = evaluateConfidence(
        makeAnswer({ confidence: Confidence.YPOTHETO, evidence: null }),
        Dimension.APO_TI,
      );
      expect(result).not.toBeNull();
      expect(result!.dimension).toBe(Dimension.APO_TI);
      expect(result!.description).toContain("ΥΠΟΘΕΣΗ");
    });

    test("DEN_KSERO → returns verification command", () => {
      const result = evaluateConfidence(
        makeAnswer({ confidence: Confidence.DEN_KSERO, evidence: null }),
        Dimension.POU,
      );
      expect(result).not.toBeNull();
      expect(result!.description).toContain("ΔΕΝ ΞΕΡΕΙΣ");
    });

    test("APO_TI dimension → READ_CODEBASE method", () => {
      const result = evaluateConfidence(
        makeAnswer({ confidence: Confidence.YPOTHETO, evidence: null }),
        Dimension.APO_TI,
      );
      expect(result!.method).toBe("READ_CODEBASE");
      expect(result!.suggestedActions.some((a) => a.includes("package.json"))).toBe(true);
    });

    test("GIATI dimension → ASK_USER method", () => {
      const result = evaluateConfidence(
        makeAnswer({ confidence: Confidence.DEN_KSERO, evidence: null }),
        Dimension.GIATI,
      );
      expect(result!.method).toBe("ASK_USER");
      expect(result!.suggestedActions.some((a) => a.includes("Ask user"))).toBe(true);
    });

    test("TI dimension → WEB_SEARCH method", () => {
      const result = evaluateConfidence(
        makeAnswer({ confidence: Confidence.YPOTHETO, evidence: null }),
        Dimension.TI,
      );
      expect(result!.method).toBe("WEB_SEARCH");
      expect(result!.suggestedActions.some((a) => a.includes("Web search"))).toBe(true);
    });

    test("POS dimension → WEB_SEARCH_AND_DOCS method", () => {
      const result = evaluateConfidence(
        makeAnswer({ confidence: Confidence.YPOTHETO, evidence: null }),
        Dimension.POS,
      );
      expect(result!.method).toBe("WEB_SEARCH_AND_DOCS");
    });
  });
});
