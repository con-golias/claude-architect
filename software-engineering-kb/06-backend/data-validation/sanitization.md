# Input Sanitization

> **AI Plugin Directive — Input Sanitization & Injection Prevention**
> You are an AI coding assistant. When generating, reviewing, or refactoring input sanitization
> code, follow EVERY rule in this document. Missing sanitization leads to XSS, SQL injection,
> command injection, and data corruption. Treat each section as non-negotiable.

**Core Rule: ALWAYS sanitize AFTER validation. ALWAYS use context-appropriate encoding (HTML context, URL context, SQL context). NEVER build queries or HTML by string concatenation. ALWAYS use parameterized queries for SQL and template engines with auto-escaping for HTML.**

---

## 1. Sanitization vs Validation

```
┌──────────────────────────────────────────────────────────────┐
│              Validation vs Sanitization                        │
│                                                               │
│  VALIDATION (reject bad input)                               │
│  ├── "Is this input acceptable?"                             │
│  ├── Returns YES/NO                                          │
│  ├── Rejects with error message                              │
│  └── Example: email format check → reject if invalid         │
│                                                               │
│  SANITIZATION (clean input)                                  │
│  ├── "Transform this input to be safe"                       │
│  ├── Returns cleaned value                                   │
│  ├── Modifies the input                                      │
│  └── Example: trim whitespace, escape HTML entities          │
│                                                               │
│  Order: VALIDATE first → then SANITIZE accepted input        │
│                                                               │
│  NEVER sanitize INSTEAD of validating.                       │
│  NEVER rely on sanitization alone for security.              │
└──────────────────────────────────────────────────────────────┘
```

| Operation | Purpose | Example |
|-----------|---------|---------|
| **Trim** | Remove leading/trailing whitespace | `"  hello  "` → `"hello"` |
| **Normalize** | Consistent format | `"HELLO@Email.Com"` → `"hello@email.com"` |
| **Escape** | Neutralize special characters | `"<script>"` → `"&lt;script&gt;"` |
| **Strip** | Remove disallowed content | `"Hello <b>world</b>"` → `"Hello world"` |
| **Encode** | Context-appropriate encoding | URL encode: `"a b"` → `"a%20b"` |
| **Truncate** | Enforce max length after transform | Limit to N characters |

---

## 2. XSS Prevention

```typescript
// ALWAYS use contextual output encoding
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const purify = DOMPurify(window);

// Sanitize HTML content (for rich text fields)
function sanitizeHTML(dirty: string): string {
  return purify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href", "title"],
    ALLOW_DATA_ATTR: false,
  });
}

// Escape for HTML text context (no HTML allowed)
function escapeHTML(input: string): string {
  const map: Record<string, string> = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#x27;", "/": "&#x2F;",
  };
  return input.replace(/[&<>"'/]/g, (char) => map[char]);
}

// Escape for JavaScript context
function escapeJS(input: string): string {
  return JSON.stringify(input); // Safe for embedding in JS
}

// Escape for URL parameter context
function escapeURLParam(input: string): string {
  return encodeURIComponent(input);
}
```

```go
import (
    "html"
    "html/template"
    "net/url"
    "github.com/microcosm-cc/bluemonday"
)

// Rich text sanitization (allowlist)
var htmlPolicy = bluemonday.UGCPolicy() // User-Generated Content policy

func sanitizeHTML(input string) string {
    return htmlPolicy.Sanitize(input)
}

// Strict text (no HTML)
func escapeHTML(input string) string {
    return html.EscapeString(input)
}

// Go templates auto-escape by default (use html/template, NOT text/template)
tmpl := template.Must(template.New("page").Parse(`<h1>{{.Title}}</h1>`))
// {{.Title}} is auto-escaped — safe against XSS
```

```python
import bleach
from markupsafe import escape
from urllib.parse import quote

# Rich text sanitization
def sanitize_html(dirty: str) -> str:
    return bleach.clean(
        dirty,
        tags=["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
        attributes={"a": ["href", "title"]},
        strip=True,
    )

# Text escaping (no HTML)
def escape_html(text: str) -> str:
    return str(escape(text))  # markupsafe.escape

# URL parameter encoding
def escape_url_param(value: str) -> str:
    return quote(value, safe="")
```

- ALWAYS use `html/template` in Go (NOT `text/template`) — auto-escapes HTML
- ALWAYS use DOMPurify or bleach for user-generated HTML content
- ALWAYS use allowlist of tags/attributes — NEVER denylist
- NEVER insert user input into HTML without escaping
- NEVER use `innerHTML` or `dangerouslySetInnerHTML` with unsanitized input

---

## 3. SQL Injection Prevention

```typescript
// ALWAYS use parameterized queries — NEVER string concatenation

// ✅ CORRECT — Parameterized
const user = await db.query(
  "SELECT * FROM users WHERE email = $1 AND status = $2",
  [email, "active"]
);

// ✅ CORRECT — ORM (auto-parameterized)
const user = await prisma.user.findFirst({
  where: { email, status: "active" },
});

// ❌ WRONG — String concatenation (SQL INJECTION)
const user = await db.query(
  `SELECT * FROM users WHERE email = '${email}'` // NEVER DO THIS
);

// Dynamic column names — use allowlist, NOT parameterization
const ALLOWED_SORT_COLUMNS = new Set(["name", "email", "created_at"]);
function buildSortQuery(column: string, direction: "asc" | "desc"): string {
  if (!ALLOWED_SORT_COLUMNS.has(column)) {
    throw new Error(`Invalid sort column: ${column}`);
  }
  // Column names cannot be parameterized — allowlist instead
  return `ORDER BY ${column} ${direction}`;
}
```

```go
// ✅ Parameterized
row := db.QueryRowContext(ctx, "SELECT * FROM users WHERE email = $1", email)

// ✅ Using sqlx (named params)
user := User{}
err := db.GetContext(ctx, &user, "SELECT * FROM users WHERE email = $1", email)

// ❌ NEVER use fmt.Sprintf for SQL
query := fmt.Sprintf("SELECT * FROM users WHERE email = '%s'", email) // INJECTION
```

```python
# ✅ Parameterized
cursor.execute("SELECT * FROM users WHERE email = %s", (email,))

# ✅ SQLAlchemy ORM
user = session.query(User).filter(User.email == email).first()

# ❌ NEVER use f-strings for SQL
cursor.execute(f"SELECT * FROM users WHERE email = '{email}'")  # INJECTION
```

- ALWAYS use parameterized queries (prepared statements) for ALL SQL
- ALWAYS use allowlists for dynamic column/table names (cannot be parameterized)
- NEVER concatenate user input into SQL strings
- ALWAYS use ORM query builders when available — they parameterize automatically

---

## 4. Command Injection Prevention

```typescript
// ❌ NEVER use shell execution with user input
import { exec } from "child_process";
exec(`convert ${userFilename} output.png`); // COMMAND INJECTION

// ✅ Use execFile with argument array (no shell interpretation)
import { execFile } from "child_process";
execFile("convert", [userFilename, "output.png"]); // Safe — no shell

// ✅ Or use a purpose-built library instead of shell commands
import sharp from "sharp";
await sharp(userFilename).resize(800).toFile("output.png");
```

```go
// ❌ NEVER
exec.Command("sh", "-c", "convert " + userFilename + " output.png")

// ✅ ALWAYS — no shell, arguments are separate
exec.Command("convert", userFilename, "output.png")
```

```python
# ❌ NEVER
os.system(f"convert {user_filename} output.png")
subprocess.run(f"convert {user_filename} output.png", shell=True)

# ✅ ALWAYS — list of arguments, shell=False (default)
subprocess.run(["convert", user_filename, "output.png"], shell=False)
```

- NEVER pass user input to shell commands via string concatenation
- ALWAYS use argument arrays (`execFile`, `exec.Command`, `subprocess.run` with list)
- ALWAYS prefer libraries over shell commands (sharp > imagemagick CLI)
- NEVER set `shell=True` when user input is involved

---

## 5. Path Traversal Prevention

```typescript
import path from "path";

const UPLOAD_DIR = "/app/uploads";

function safeFilePath(userInput: string): string {
  // Resolve to absolute path
  const resolved = path.resolve(UPLOAD_DIR, userInput);

  // Verify it's within the allowed directory
  if (!resolved.startsWith(UPLOAD_DIR)) {
    throw new Error("Path traversal detected");
  }

  return resolved;
}

// ❌ Vulnerable: "../../../etc/passwd" escapes upload dir
// ✅ safeFilePath("../../../etc/passwd") → throws Error
```

- ALWAYS resolve paths to absolute and verify they stay within allowed directory
- NEVER use user input directly in file system operations
- ALWAYS strip or reject `..`, `~`, and null bytes from file paths

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Sanitize instead of validate | Bad data stored, processed | Validate FIRST, then sanitize |
| Denylist for HTML tags | New vectors bypass filter | Allowlist of safe tags only |
| String concat for SQL | SQL injection vulnerability | Parameterized queries always |
| `shell=True` with user input | Command injection | Argument arrays, no shell |
| No output encoding | XSS in HTML responses | Context-appropriate escaping |
| Sanitizing once at storage | Wrong context for display | Encode at output time for context |
| `text/template` in Go | No auto-escaping | Use `html/template` for HTML |
| Trust Content-Type blindly | Upload bypass (rename .exe to .jpg) | Validate magic bytes, not extension |

---

## 7. Enforcement Checklist

- [ ] All user input validated BEFORE sanitization
- [ ] HTML output uses context-appropriate encoding (HTML, JS, URL, CSS)
- [ ] Rich text fields sanitized with allowlist (DOMPurify, bleach, bluemonday)
- [ ] All SQL uses parameterized queries (no string concatenation)
- [ ] Dynamic column/table names use strict allowlist
- [ ] No shell execution with user input (use argument arrays)
- [ ] File paths validated against allowed directory (no path traversal)
- [ ] Go templates use `html/template` (not `text/template`)
- [ ] File uploads validated by magic bytes, not just extension
- [ ] No `innerHTML` / `dangerouslySetInnerHTML` with unsanitized content
