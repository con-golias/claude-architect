import { describe, expect, test } from "bun:test";
import { classifyAtomicity } from "./SocraticAtomicity";
import { Atomicity } from "./SocraticTypes";

describe("SocraticAtomicity", () => {
  describe("ATOMIC classifications", () => {
    test("file path → ATOMIC", () => {
      expect(classifyAtomicity("src/components/Login.tsx")).toBe(Atomicity.ATOMIC);
    });

    test("relative path → ATOMIC", () => {
      expect(classifyAtomicity("./config/settings.json")).toBe(Atomicity.ATOMIC);
    });

    test("number → ATOMIC", () => {
      expect(classifyAtomicity("42")).toBe(Atomicity.ATOMIC);
    });

    test("version → ATOMIC", () => {
      expect(classifyAtomicity("3.2.1")).toBe(Atomicity.ATOMIC);
    });

    test("boolean true → ATOMIC", () => {
      expect(classifyAtomicity("yes")).toBe(Atomicity.ATOMIC);
    });

    test("boolean false → ATOMIC", () => {
      expect(classifyAtomicity("no")).toBe(Atomicity.ATOMIC);
    });

    test("short spec reference → ATOMIC", () => {
      expect(classifyAtomicity("WCAG AA compliance")).toBe(Atomicity.ATOMIC);
    });

    test("single concept (<5 words) → ATOMIC", () => {
      expect(classifyAtomicity("Express middleware")).toBe(Atomicity.ATOMIC);
    });

    test("empty string → ATOMIC", () => {
      expect(classifyAtomicity("")).toBe(Atomicity.ATOMIC);
    });
  });

  describe("NON_ATOMIC classifications", () => {
    test("comma-separated list → NON_ATOMIC", () => {
      expect(classifyAtomicity("CSS variables, ThemeProvider, toggle component")).toBe(Atomicity.NON_ATOMIC);
    });

    test("contains 'and' → NON_ATOMIC", () => {
      expect(classifyAtomicity("frontend and backend changes needed")).toBe(Atomicity.NON_ATOMIC);
    });

    test("contains 'και' → NON_ATOMIC", () => {
      expect(classifyAtomicity("React και Express configuration")).toBe(Atomicity.NON_ATOMIC);
    });

    test("long text (>5 words, no special markers) → NON_ATOMIC", () => {
      expect(classifyAtomicity("This requires updating the database schema to support new fields")).toBe(Atomicity.NON_ATOMIC);
    });
  });

  describe("TERMINAL classifications", () => {
    test("command output with $ prefix → TERMINAL", () => {
      expect(classifyAtomicity("$ grep -r 'passport' package.json")).toBe(Atomicity.TERMINAL);
    });

    test("grep output marker → TERMINAL", () => {
      expect(classifyAtomicity('grep output: "passport": "^0.6.0"')).toBe(Atomicity.TERMINAL);
    });

    test("file content marker → TERMINAL", () => {
      expect(classifyAtomicity("file content: export default function auth()")).toBe(Atomicity.TERMINAL);
    });

    test("starts with grep command → TERMINAL", () => {
      expect(classifyAtomicity("grep -r import src/")).toBe(Atomicity.TERMINAL);
    });
  });
});
