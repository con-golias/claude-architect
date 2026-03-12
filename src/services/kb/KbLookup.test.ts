import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { lookup, clearCache, loadIndex } from "./KbLookup";
import { buildIndex } from "./KbIndexBuilder";
import { join } from "path";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), "kb-lookup-test-" + Date.now());
const KB_ROOT = join(TEST_DIR, "kb");
const INDEX_PATH = join(TEST_DIR, "kb-index.json");

function createTestKb() {
  const files: Array<{ dir: string; file: string; content: string }> = [
    {
      dir: "08-security/secure-coding",
      file: "injection-prevention.md",
      content: `# Injection Prevention

> **AI Plugin Directive:** ALWAYS use parameterized queries. NEVER concatenate user input into SQL.

> **Core Rule:** Validate all input at system boundaries.

---

## How It Works

SQL injection and XSS prevention.

\`\`\`typescript
const result = db.query('SELECT * FROM users WHERE id = $1', [id]);
\`\`\`

\`\`\`python
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
\`\`\`

## Best Practices

1. Use parameterized queries exclusively
2. Validate input with schema libraries
3. Encode output based on context

## Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **String concat SQL** | Dynamic SQL | Parameterized queries |

MUST use parameterized queries.
NEVER use eval() with user input.`,
    },
    {
      dir: "06-backend/api-design/rest",
      file: "rest-principles.md",
      content: `# REST API Design Principles

> **AI Plugin Directive:** Use proper HTTP methods, status codes, and resource naming.

---

## Resource Design

\`\`\`typescript
app.get('/api/users/:id', getUser);
app.post('/api/users', createUser);
\`\`\`

## Best Practices

1. Use plural nouns for resources
2. Use proper HTTP status codes
3. Version your API

MUST use proper HTTP methods.
NEVER expose internal IDs in URLs.`,
    },
    {
      dir: "05-frontend/web/frameworks/react",
      file: "react-components.md",
      content: `# React Component Design

> **Domain:** Frontend > Web > React
> **Difficulty:** Intermediate

## Component Patterns

\`\`\`tsx
function UserCard({ name }: Props) {
  const [active, setActive] = useState(false);
  return <div onClick={() => setActive(!active)}>{name}</div>;
}
\`\`\`

## Best Practices

1. Use functional components
2. Extract reusable hooks
3. Keep components small and focused

NEVER use class components for new code.`,
    },
    {
      dir: "07-database/data-modeling",
      file: "normalization.md",
      content: `# Database Normalization

> **Domain:** Database > Data Modeling
> **Difficulty:** Intermediate

## Normal Forms

\`\`\`sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL
);
\`\`\`

## Best Practices

1. Normalize to 3NF as starting point
2. Denormalize only for measured performance needs

ALWAYS normalize to 3NF first.`,
    },
    {
      dir: "14-accessibility-i18n/accessibility",
      file: "wcag-compliance.md",
      content: `# WCAG Accessibility

> **Domain:** Accessibility > Compliance
> **Importance:** Critical

## Semantic HTML

\`\`\`tsx
<button aria-label="Close dialog" onClick={onClose}>X</button>
\`\`\`

## Enforcement Checklist

- [ ] All images have alt text
- [ ] All form controls have labels
- [ ] Color contrast meets WCAG AA

MUST provide alt text for images.
NEVER rely on color alone to convey meaning.`,
    },
    {
      dir: "01-fundamentals/clean-code/principles",
      file: "solid-overview.md",
      content: `# SOLID Principles

> **Domain:** Fundamentals > Clean Code > Principles
> **Difficulty:** Intermediate

## Overview

The five SOLID principles for object-oriented design.

\`\`\`typescript
class UserService {
  constructor(private readonly repo: UserRepository) {}
}
\`\`\`

## Best Practices

1. Single Responsibility: one reason to change
2. Open/Closed: open for extension, closed for modification`,
    },
  ];

  for (const f of files) {
    const dir = join(KB_ROOT, f.dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, f.file), f.content, "utf-8");
  }

  buildIndex(KB_ROOT, INDEX_PATH);
}

beforeAll(() => {
  clearCache();
  createTestKb();
});

afterAll(() => {
  clearCache();
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("KbLookup", () => {
  test("loads index successfully", () => {
    const index = loadIndex(INDEX_PATH);
    expect(index).not.toBeNull();
    expect(index!.totalFiles).toBe(6);
  });

  test("finds security articles for route files", () => {
    clearCache();
    const results = lookup("src/routes/users.ts", undefined, undefined, {
      indexPath: INDEX_PATH,
    });
    expect(results.length).toBeGreaterThan(0);
    const ids = results.map((r) => r.id);
    // Should find REST API design (route context)
    expect(ids).toContain("06-backend/api-design/rest/rest-principles");
  });

  test("finds injection prevention for SQL content", () => {
    clearCache();
    const results = lookup(
      "src/services/db.ts",
      'const result = db.query("SELECT * FROM users");',
      undefined,
      { indexPath: INDEX_PATH },
    );
    const ids = results.map((r) => r.id);
    expect(ids).toContain(
      "08-security/secure-coding/injection-prevention",
    );
  });

  test("finds React articles for .tsx files", () => {
    clearCache();
    const results = lookup(
      "src/components/UserCard.tsx",
      'import { useState } from "react";',
      undefined,
      { indexPath: INDEX_PATH },
    );
    const ids = results.map((r) => r.id);
    expect(ids).toContain(
      "05-frontend/web/frameworks/react/react-components",
    );
  });

  test("finds database articles for .sql files", () => {
    clearCache();
    const results = lookup("migrations/001_users.sql", undefined, undefined, {
      indexPath: INDEX_PATH,
    });
    const ids = results.map((r) => r.id);
    expect(ids).toContain("07-database/data-modeling/normalization");
  });

  test("query-based lookup finds relevant articles", () => {
    clearCache();
    const results = lookup("src/app.ts", undefined, "accessibility wcag", {
      indexPath: INDEX_PATH,
    });
    const ids = results.map((r) => r.id);
    expect(ids).toContain(
      "14-accessibility-i18n/accessibility/wcag-compliance",
    );
  });

  test("results include directives and imperatives", () => {
    clearCache();
    const results = lookup(
      "src/routes/api.ts",
      'db.query("SELECT")',
      "sql injection",
      { indexPath: INDEX_PATH },
    );
    const secResult = results.find((r) =>
      r.id.includes("injection-prevention"),
    );
    expect(secResult).toBeDefined();
    expect(secResult!.directive).toContain("parameterized queries");
    expect(secResult!.imperatives.length).toBeGreaterThan(0);
  });

  test("results are sorted by score descending", () => {
    clearCache();
    const results = lookup("src/app.ts", undefined, "rest api design", {
      indexPath: INDEX_PATH,
      limit: 10,
    });
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  test("limit parameter works", () => {
    clearCache();
    const results = lookup("src/app.ts", undefined, undefined, {
      indexPath: INDEX_PATH,
      limit: 2,
    });
    expect(results.length).toBeLessThanOrEqual(2);
  });
});
