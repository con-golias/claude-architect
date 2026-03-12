import { describe, test, expect } from "bun:test";
import { parseKbMetadata, extractTitle } from "./KbMetadataParser";

describe("KbMetadataParser", () => {
  describe("extractTitle", () => {
    test("extracts simple title", () => {
      expect(extractTitle("# DRY — Don't Repeat Yourself\n\nContent")).toBe(
        "DRY — Don't Repeat Yourself",
      );
    });

    test("extracts title with parentheses", () => {
      expect(extractTitle("# CQRS (Command Query Responsibility Segregation)\n")).toBe(
        "CQRS (Command Query Responsibility Segregation)",
      );
    });

    test("returns Untitled for no heading", () => {
      expect(extractTitle("No heading here\nJust text")).toBe("Untitled");
    });
  });

  describe("Format 1: AI Plugin Directive", () => {
    const content = `# Event Sourcing — Complete Specification

> **AI Plugin Directive:** Event Sourcing stores the HISTORY of state changes as a sequence of immutable events. Use event sourcing ONLY when you need a complete audit trail.

> **Core Rule:** Store every state change as an immutable event. The current state is computed by replaying all events.

---

## 1. The Core Rule

Content here.`;

    test("extracts directive", () => {
      const meta = parseKbMetadata(content);
      expect(meta.directive).toContain("Event Sourcing stores the HISTORY");
      expect(meta.directive).toContain("complete audit trail");
    });

    test("extracts core rule", () => {
      const meta = parseKbMetadata(content);
      expect(meta.coreRule).toContain("Store every state change as an immutable event");
    });
  });

  describe("Format 1: AI Plugin Directive with Domain", () => {
    const content = `# Component Libraries

> **AI Plugin Directive:** When building component libraries, focus on reusability and consistency.
> **Domain:** Frontend > Design Systems > Component Libraries

---

## Overview`;

    test("extracts both directive and domain", () => {
      const meta = parseKbMetadata(content);
      expect(meta.directive).toContain("component libraries");
      expect(meta.domain).toBe("Frontend > Design Systems > Component Libraries");
    });
  });

  describe("Format 2: Property Table", () => {
    const content = `# WCAG Compliance and Legal Requirements

| Property       | Value                                                                |
|---------------|----------------------------------------------------------------------|
| Domain        | Accessibility > Compliance                                           |
| Importance    | High                                                                 |
| Audience      | All engineers, product managers, legal teams                         |

---

## WCAG 2.2 Conformance Levels`;

    test("extracts domain from table", () => {
      const meta = parseKbMetadata(content);
      expect(meta.domain).toBe("Accessibility > Compliance");
    });

    test("extracts importance from table", () => {
      const meta = parseKbMetadata(content);
      expect(meta.importance).toBe("High");
    });

    test("extracts audience from table", () => {
      const meta = parseKbMetadata(content);
      expect(meta.audience).toBe("All engineers, product managers, legal teams");
    });
  });

  describe("Format 3: Domain/Difficulty blockquote", () => {
    const content = `# DRY — Don't Repeat Yourself

> **Domain:** Fundamentals > Clean Code > Principles
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is`;

    test("extracts domain", () => {
      const meta = parseKbMetadata(content);
      expect(meta.domain).toBe("Fundamentals > Clean Code > Principles");
    });

    test("extracts difficulty", () => {
      const meta = parseKbMetadata(content);
      expect(meta.difficulty).toBe("Beginner");
    });

    test("extracts last updated", () => {
      const meta = parseKbMetadata(content);
      expect(meta.lastUpdated).toBe("2026-03-06");
    });
  });

  describe("Format 3: Domain with Importance", () => {
    const content = `# Network Performance

> **Domain:** Network Performance
> **Importance:** Critical
> **Last Updated:** 2026-03-09

---

## Overview`;

    test("extracts importance from blockquote", () => {
      const meta = parseKbMetadata(content);
      expect(meta.importance).toBe("Critical");
    });
  });

  describe("Format 4: Structured Metadata", () => {
    const content = `# AI-Generated Code Security

## Metadata
- **Category**: AI Security / Secure Development
- **Audience**: Software engineers, security engineers, tech leads
- **Complexity**: Intermediate to Advanced
- **Prerequisites**: Secure coding fundamentals, OWASP Top 10
- **Version**: 1.0
- **Last Updated**: 2026-03-10

---

## Table of Contents`;

    test("extracts category as domain", () => {
      const meta = parseKbMetadata(content);
      expect(meta.domain).toBe("AI Security / Secure Development");
    });

    test("extracts complexity as difficulty", () => {
      const meta = parseKbMetadata(content);
      expect(meta.difficulty).toBe("Intermediate to Advanced");
    });

    test("extracts audience", () => {
      const meta = parseKbMetadata(content);
      expect(meta.audience).toContain("Software engineers");
    });

    test("extracts version", () => {
      const meta = parseKbMetadata(content);
      expect(meta.version).toBe("1.0");
    });
  });

  describe("Edge cases", () => {
    test("empty content returns empty metadata", () => {
      const meta = parseKbMetadata("");
      expect(meta).toEqual({});
    });

    test("content with no metadata returns empty", () => {
      const meta = parseKbMetadata("# Title\n\nJust content, no metadata.\n\n## Section 1");
      expect(meta).toEqual({});
    });

    test("multiline AI directive is joined correctly", () => {
      const content = `# Test

> **AI Plugin Directive:** First line of directive
> that continues on a second line
> and even a third line.

---

## Content`;

      const meta = parseKbMetadata(content);
      expect(meta.directive).toContain("First line of directive");
      expect(meta.directive).toContain("second line");
      expect(meta.directive).not.toContain(">");
    });
  });
});
