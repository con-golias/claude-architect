import { describe, test, expect } from "bun:test";
import { buildIndex } from "./KbIndexBuilder";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "kb-test-" + Date.now());
const OUTPUT_PATH = join(TEST_DIR, "output", "kb-index.json");

function setup() {
  // Create a mini KB for testing
  const categories = [
    {
      dir: "01-fundamentals/clean-code/principles",
      file: "dry.md",
      content: `# DRY — Don't Repeat Yourself

> **Domain:** Fundamentals > Clean Code > Principles
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

The DRY principle states that every piece of knowledge must have a single representation.

## Best Practices

1. Extract shared logic into reusable functions
2. Use constants for magic numbers
3. Create shared type definitions

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Copy-Paste Code** | Identical blocks in multiple files | Extract to shared function |
| **Shotgun Surgery** | One change requires edits in many files | Consolidate related logic |

## Enforcement Checklist

- [ ] No duplicated business logic across files
- [ ] Constants used instead of magic numbers
- [ ] Shared types defined in one location

MUST consolidate duplicated logic.
NEVER copy-paste business rules.`,
    },
    {
      dir: "08-security/secure-coding",
      file: "injection-prevention.md",
      content: `# Injection Prevention

> **AI Plugin Directive:** ALWAYS use parameterized queries for all database operations. NEVER concatenate user input into SQL strings.

> **Core Rule:** Validate all input at system boundaries before passing to business logic.

---

## How It Works

Injection attacks occur when untrusted data is sent to an interpreter.

\`\`\`typescript
// Bad
const result = db.query(\`SELECT * FROM users WHERE id = '\${id}'\`);

// Good
const result = db.query('SELECT * FROM users WHERE id = $1', [id]);
\`\`\`

\`\`\`python
# Also in Python
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
\`\`\`

## Best Practices

1. Use parameterized queries exclusively
2. Validate input with schema validation libraries
3. Encode output based on context

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **String Concatenation SQL** | Dynamic SQL with user input | Parameterized queries |
| **eval() with user data** | Dynamic code execution | Static analysis |

MUST use parameterized queries.
NEVER use eval() with user input.
ALWAYS validate at system boundaries.`,
    },
    {
      dir: "05-frontend/web/frameworks/react",
      file: "react-overview.md",
      content: `# React Overview

| Property | Value |
|----------|-------|
| Domain   | Frontend > Web > React |
| Importance | High |

---

## Component Design

Use functional components with hooks.

\`\`\`tsx
function UserCard({ name }: { name: string }) {
  return <div>{name}</div>;
}
\`\`\`

## Best Practices

1. Prefer functional components over class components
2. Use custom hooks for reusable logic
3. Memoize expensive computations

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| **Prop Drilling** | Use Context or state management |

NEVER use class components for new code.`,
    },
  ];

  // Create directory structure
  const kbRoot = join(TEST_DIR, "kb");
  for (const cat of categories) {
    const dir = join(kbRoot, cat.dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, cat.file), cat.content, "utf-8");
  }

  return kbRoot;
}

function cleanup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

describe("KbIndexBuilder", () => {
  const kbRoot = setup();

  test("builds index from test KB", () => {
    const stats = buildIndex(kbRoot, OUTPUT_PATH);
    expect(stats.totalEntries).toBe(3);
    expect(stats.sizeKB).toBeGreaterThan(0);
    expect(stats.buildTimeMs).toBeGreaterThanOrEqual(0);
  });

  test("index contains all entries", () => {
    const index = JSON.parse(
      require("fs").readFileSync(OUTPUT_PATH, "utf-8"),
    );
    expect(index.version).toBe(1);
    expect(index.totalFiles).toBe(3);
    expect(Object.keys(index.entries)).toHaveLength(3);
  });

  test("DRY entry is correctly parsed", () => {
    const index = JSON.parse(
      require("fs").readFileSync(OUTPUT_PATH, "utf-8"),
    );
    const dry = index.entries["01-fundamentals/clean-code/principles/dry"];
    expect(dry).toBeDefined();
    expect(dry.title).toBe("DRY — Don't Repeat Yourself");
    expect(dry.category).toBe("fundamentals");
    expect(dry.domain).toBe("Fundamentals > Clean Code > Principles");
    expect(dry.difficulty).toBe("Beginner");
    expect(dry.bestPractices.length).toBeGreaterThanOrEqual(3);
    expect(dry.antiPatterns.length).toBe(2);
    expect(dry.antiPatterns[0].name).toContain("Copy-Paste Code");
    expect(dry.checklist.length).toBe(3);
    expect(dry.imperatives.length).toBeGreaterThanOrEqual(2);
  });

  test("Injection entry has directive and core rule", () => {
    const index = JSON.parse(
      require("fs").readFileSync(OUTPUT_PATH, "utf-8"),
    );
    const inj =
      index.entries["08-security/secure-coding/injection-prevention"];
    expect(inj).toBeDefined();
    expect(inj.directive).toContain("parameterized queries");
    expect(inj.coreRule).toContain("Validate all input");
    expect(inj.category).toBe("security");
    expect(inj.languages).toContain("typescript");
    expect(inj.languages).toContain("python");
    expect(inj.imperatives.length).toBeGreaterThanOrEqual(3);
  });

  test("React entry parsed from table format", () => {
    const index = JSON.parse(
      require("fs").readFileSync(OUTPUT_PATH, "utf-8"),
    );
    const react =
      index.entries["05-frontend/web/frameworks/react/react-overview"];
    expect(react).toBeDefined();
    expect(react.domain).toBe("Frontend > Web > React");
    expect(react.importance).toBe("High");
    expect(react.category).toBe("frontend");
    expect(react.languages).toContain("typescript");
  });

  test("inverted indices are populated", () => {
    const index = JSON.parse(
      require("fs").readFileSync(OUTPUT_PATH, "utf-8"),
    );

    // byCategory
    expect(index.byCategory.security).toContain(
      "08-security/secure-coding/injection-prevention",
    );
    expect(index.byCategory.fundamentals).toContain(
      "01-fundamentals/clean-code/principles/dry",
    );

    // byLanguage
    expect(index.byLanguage.typescript).toBeDefined();
    expect(index.byLanguage.python).toBeDefined();

    // byExtension should have .ts entries
    expect(index.byExtension[".ts"]).toBeDefined();
    expect(index.byExtension[".ts"].length).toBeGreaterThan(0);
  });

  test("byKeyword contains title-derived keywords", () => {
    const index = JSON.parse(
      require("fs").readFileSync(OUTPUT_PATH, "utf-8"),
    );

    // "injection" should appear as a keyword
    expect(index.byKeyword["injection"]).toBeDefined();
    expect(index.byKeyword["injection"]).toContain(
      "08-security/secure-coding/injection-prevention",
    );
  });

  // Cleanup after all tests
  test("cleanup", () => {
    cleanup();
    expect(true).toBe(true);
  });
});
