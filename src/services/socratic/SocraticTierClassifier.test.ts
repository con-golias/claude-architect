import { describe, expect, test } from "bun:test";
import { classifyTier, isBypassRequested } from "./SocraticTierClassifier";
import { Tier } from "./SocraticTypes";

describe("SocraticTierClassifier", () => {
  describe("classifyTier", () => {
    test("typo fix → STANDARD (no TRIVIAL bypass during testing)", () => {
      expect(classifyTier("fix typo in readme", "bug_fix", "README.md")).toBe(Tier.STANDARD);
    });

    test("rename variable → STANDARD (no TRIVIAL bypass during testing)", () => {
      expect(classifyTier("rename variable to camelCase", "bug_fix", "src/utils.ts")).toBe(Tier.STANDARD);
    });

    test("formatting → STANDARD (no TRIVIAL bypass during testing)", () => {
      expect(classifyTier("fix formatting in file", "config_change", "src/")).toBe(Tier.STANDARD);
    });

    test("bug fix → STANDARD", () => {
      expect(classifyTier("fix login button not working", "bug_fix", "src/components/Login.tsx")).toBe(Tier.STANDARD);
    });

    test("config change → STANDARD", () => {
      expect(classifyTier("update eslint config", "config_change", "eslintrc.json")).toBe(Tier.STANDARD);
    });

    test("architecture change type → SIGNIFICANT", () => {
      expect(classifyTier("change module structure", "architecture_change", "src/")).toBe(Tier.SIGNIFICANT);
    });

    test("security sensitive type → SIGNIFICANT", () => {
      expect(classifyTier("update token handling", "security_sensitive", "src/auth/")).toBe(Tier.SIGNIFICANT);
    });

    test("refactor keyword → SIGNIFICANT", () => {
      expect(classifyTier("refactor the payment module", "bug_fix", "src/payments/")).toBe(Tier.SIGNIFICANT);
    });

    test("authentication keyword → SIGNIFICANT", () => {
      expect(classifyTier("add authentication to API", "feature_addition", "src/")).toBe(Tier.SIGNIFICANT);
    });

    test("multi-file scope (3+) → SIGNIFICANT", () => {
      expect(classifyTier("update imports", "bug_fix", "src/a.ts, src/b.ts, src/c.ts")).toBe(Tier.SIGNIFICANT);
    });

    test("single file scope → STANDARD by default", () => {
      expect(classifyTier("add error message", "feature_addition", "src/utils.ts")).toBe(Tier.STANDARD);
    });
  });

  describe("isBypassRequested", () => {
    test("bypass disabled — always returns false", () => {
      expect(isBypassRequested("just do it, fix the button")).toBe(false);
      expect(isBypassRequested("skip reasoning and fix it")).toBe(false);
      expect(isBypassRequested("fix the bug --no-socratic")).toBe(false);
      expect(isBypassRequested("add a new feature to the dashboard")).toBe(false);
    });
  });
});
