# Injection Prevention

> **AI Plugin Directive — SQL, NoSQL, Command & Path Injection Prevention**
> You are an AI coding assistant. When generating, reviewing, or refactoring code that handles
> user input, follow EVERY rule in this document. Injection attacks are the #1 vulnerability
> class (OWASP Top 10). A single unparameterized query can compromise an entire database.
> Treat each section as non-negotiable.

**Core Rule: ALWAYS use parameterized queries for ALL database operations. ALWAYS use allow-lists for dynamic identifiers (table names, column names). NEVER concatenate user input into queries, commands, or file paths. NEVER use eval(), exec(), or system() with user-controlled data. ALWAYS validate and restrict file paths to a base directory.**

---

## 1. SQL Injection

```
┌──────────────────────────────────────────────────────────────┐
│              SQL Injection Attack                             │
│                                                               │
│  Vulnerable Code:                                            │
│  query("SELECT * FROM users WHERE id = " + userId)          │
│                                                               │
│  Attack Input: userId = "1; DROP TABLE users; --"            │
│  Resulting SQL:                                               │
│  SELECT * FROM users WHERE id = 1; DROP TABLE users; --     │
│                                                               │
│  Attack Types:                                               │
│  ├── Classic: ' OR '1'='1                                   │
│  ├── Union: ' UNION SELECT password FROM users --           │
│  ├── Blind: ' AND (SELECT 1 FROM users LIMIT 1) = 1 --     │
│  ├── Time-based: ' AND SLEEP(5) --                          │
│  ├── Stacked: '; DROP TABLE users; --                       │
│  └── Second-order: Stored payload triggers later            │
│                                                               │
│  Defense (ONLY SOLUTION):                                    │
│  Parameterized queries / Prepared statements                 │
│  query("SELECT * FROM users WHERE id = $1", [userId])       │
│  The database treats $1 as DATA, never as SQL code          │
│                                                               │
│  RULE: There is NO OTHER acceptable defense.                │
│  NOT escaping, NOT sanitizing, NOT filtering.                │
│  ONLY parameterized queries.                                 │
└──────────────────────────────────────────────────────────────┘
```

### TypeScript — Parameterized Queries

```typescript
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// CORRECT: Parameterized query
async function getUserById(id: string): Promise<User | null> {
  const result = await pool.query(
    "SELECT id, name, email FROM users WHERE id = $1",
    [id],
  );
  return result.rows[0] || null;
}

// CORRECT: Multiple parameters
async function searchUsers(name: string, role: string, limit: number): Promise<User[]> {
  const result = await pool.query(
    "SELECT id, name, email FROM users WHERE name ILIKE $1 AND role = $2 ORDER BY name LIMIT $3",
    [`%${name}%`, role, limit],
  );
  return result.rows;
}

// CORRECT: Dynamic WHERE clauses (safe builder)
async function findUsers(filters: UserFilters): Promise<User[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (filters.name) {
    conditions.push(`name ILIKE $${paramIndex++}`);
    params.push(`%${filters.name}%`);
  }
  if (filters.email) {
    conditions.push(`email = $${paramIndex++}`);
    params.push(filters.email);
  }
  if (filters.role) {
    conditions.push(`role = $${paramIndex++}`);
    params.push(filters.role);
  }
  if (filters.createdAfter) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.createdAfter);
  }

  const where = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pool.query(
    `SELECT id, name, email, role FROM users ${where} ORDER BY created_at DESC LIMIT $${paramIndex}`,
    [...params, filters.limit || 50],
  );
  return result.rows;
}

// CORRECT: Dynamic column names (allow-list)
const ALLOWED_SORT_COLUMNS = new Set(["name", "email", "created_at", "updated_at"]);
const ALLOWED_DIRECTIONS = new Set(["ASC", "DESC"]);

async function getUsersSorted(sortBy: string, direction: string): Promise<User[]> {
  // ALLOW-LIST: Only permit known column names
  if (!ALLOWED_SORT_COLUMNS.has(sortBy)) {
    throw new BadRequestError(`Invalid sort column: ${sortBy}`);
  }
  if (!ALLOWED_DIRECTIONS.has(direction.toUpperCase())) {
    throw new BadRequestError(`Invalid sort direction: ${direction}`);
  }

  // Safe to interpolate — validated against allow-list
  const result = await pool.query(
    `SELECT id, name, email FROM users ORDER BY ${sortBy} ${direction} LIMIT 100`,
  );
  return result.rows;
}

// WRONG — NEVER do these:
// ❌ query("SELECT * FROM users WHERE id = " + id)
// ❌ query(`SELECT * FROM users WHERE name = '${name}'`)
// ❌ query("SELECT * FROM " + tableName + " WHERE id = $1", [id])
```

### Go — Parameterized Queries

```go
func (r *UserRepo) GetByID(ctx context.Context, id string) (*User, error) {
    var user User
    // CORRECT: $1 placeholder
    err := r.db.QueryRowContext(ctx,
        "SELECT id, name, email, role FROM users WHERE id = $1", id,
    ).Scan(&user.ID, &user.Name, &user.Email, &user.Role)

    if errors.Is(err, sql.ErrNoRows) {
        return nil, nil
    }
    return &user, err
}

func (r *UserRepo) Search(ctx context.Context, filters UserFilters) ([]User, error) {
    var conditions []string
    var args []interface{}
    argIdx := 1

    if filters.Name != "" {
        conditions = append(conditions, fmt.Sprintf("name ILIKE $%d", argIdx))
        args = append(args, "%"+filters.Name+"%")
        argIdx++
    }
    if filters.Role != "" {
        conditions = append(conditions, fmt.Sprintf("role = $%d", argIdx))
        args = append(args, filters.Role)
        argIdx++
    }

    query := "SELECT id, name, email, role FROM users"
    if len(conditions) > 0 {
        query += " WHERE " + strings.Join(conditions, " AND ")
    }
    query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argIdx)
    args = append(args, filters.Limit)

    rows, err := r.db.QueryContext(ctx, query, args...)
    if err != nil {
        return nil, fmt.Errorf("search users: %w", err)
    }
    defer rows.Close()

    var users []User
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role); err != nil {
            return nil, fmt.Errorf("scan user: %w", err)
        }
        users = append(users, u)
    }
    return users, rows.Err()
}

// Allow-list for dynamic identifiers
var allowedSortColumns = map[string]bool{
    "name": true, "email": true, "created_at": true,
}

func (r *UserRepo) GetSorted(ctx context.Context, sortBy, direction string) ([]User, error) {
    if !allowedSortColumns[sortBy] {
        return nil, fmt.Errorf("invalid sort column: %s", sortBy)
    }
    dir := "ASC"
    if strings.EqualFold(direction, "DESC") {
        dir = "DESC"
    }

    query := fmt.Sprintf("SELECT id, name, email FROM users ORDER BY %s %s LIMIT 100", sortBy, dir)
    // Safe: sortBy validated against allow-list, dir is either ASC or DESC
    rows, err := r.db.QueryContext(ctx, query)
    // ...
}
```

### Python — Parameterized Queries

```python
import asyncpg

async def get_user_by_id(pool: asyncpg.Pool, user_id: str) -> dict | None:
    # CORRECT: $1 placeholder
    return await pool.fetchrow(
        "SELECT id, name, email FROM users WHERE id = $1", user_id
    )

async def search_users(pool: asyncpg.Pool, filters: dict) -> list[dict]:
    conditions = []
    args = []
    idx = 1

    if name := filters.get("name"):
        conditions.append(f"name ILIKE ${idx}")
        args.append(f"%{name}%")
        idx += 1

    if role := filters.get("role"):
        conditions.append(f"role = ${idx}")
        args.append(role)
        idx += 1

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    query = f"SELECT id, name, email FROM users {where} ORDER BY created_at DESC LIMIT ${idx}"
    args.append(filters.get("limit", 50))

    return await pool.fetch(query, *args)

# ORM (SQLAlchemy) — parameterized by default
async def get_user_orm(session: AsyncSession, user_id: str) -> User | None:
    # CORRECT: SQLAlchemy parameterizes automatically
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()

# WRONG — NEVER do:
# ❌ await pool.fetch(f"SELECT * FROM users WHERE id = '{user_id}'")
# ❌ session.execute(text(f"SELECT * FROM users WHERE name = '{name}'"))
```

---

## 2. NoSQL Injection

```
┌──────────────────────────────────────────────────────────────┐
│              NoSQL Injection                                  │
│                                                               │
│  MongoDB Injection:                                          │
│  Vulnerable: db.users.find({ email: req.body.email })       │
│                                                               │
│  Attack Input: { "email": { "$gt": "" } }                   │
│  Result: Returns ALL users (always true condition)           │
│                                                               │
│  Attack Input: { "email": { "$regex": ".*" } }              │
│  Result: Returns ALL users (regex matches everything)        │
│                                                               │
│  Attack Input: { "$where": "this.password == '...'" }       │
│  Result: Server-side JavaScript execution                    │
│                                                               │
│  Defenses:                                                   │
│  ├── Validate input types (email MUST be string)            │
│  ├── Reject objects where strings are expected               │
│  ├── Disable $where operator                                │
│  └── Use schema validation (Mongoose, Zod)                  │
└──────────────────────────────────────────────────────────────┘
```

### TypeScript — MongoDB Injection Prevention

```typescript
import { z } from "zod";

// Defense 1: Strict schema validation
const LoginSchema = z.object({
  email: z.string().email(),      // MUST be string (rejects objects)
  password: z.string().min(8),
});

app.post("/api/login", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input" });
  }

  // Safe: email is guaranteed to be a string
  const user = await db.collection("users").findOne({
    email: parsed.data.email,
  });
  // ...
});

// Defense 2: Sanitize MongoDB operators
function sanitizeMongoQuery(input: unknown): unknown {
  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") {
    return input;
  }
  if (input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeMongoQuery);
  }
  if (typeof input === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      // Block MongoDB operators in keys
      if (key.startsWith("$")) {
        throw new BadRequestError(`Operator ${key} not allowed in input`);
      }
      sanitized[key] = sanitizeMongoQuery(value);
    }
    return sanitized;
  }
  throw new BadRequestError("Unsupported input type");
}

// Defense 3: Express middleware to reject objects in string fields
function rejectOperators(req: Request, res: Response, next: NextFunction): void {
  function checkValue(value: unknown, path: string): void {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const key of Object.keys(value as object)) {
        if (key.startsWith("$")) {
          throw new BadRequestError(`Operator injection attempt at ${path}`);
        }
      }
    }
  }

  if (req.body && typeof req.body === "object") {
    for (const [key, value] of Object.entries(req.body)) {
      checkValue(value, `body.${key}`);
    }
  }

  next();
}
```

---

## 3. Command Injection

```
┌──────────────────────────────────────────────────────────────┐
│              Command Injection                                │
│                                                               │
│  Vulnerable Code:                                            │
│  exec(`convert ${filename} output.png`)                      │
│                                                               │
│  Attack Input: filename = "image.jpg; rm -rf /"             │
│  Result: convert image.jpg; rm -rf / output.png             │
│  → Deletes entire filesystem                                 │
│                                                               │
│  Attack Vectors:                                             │
│  ├── Shell metacharacters: ; | & ` $ ( ) { } < > # !       │
│  ├── Command substitution: $(whoami) or `whoami`            │
│  ├── Pipe: | cat /etc/passwd                                │
│  └── Newline: %0a followed by another command               │
│                                                               │
│  Defense Priority:                                           │
│  1. AVOID shell commands entirely (use libraries/APIs)       │
│  2. If unavoidable: use execFile (no shell interpretation)  │
│  3. NEVER pass user input to exec/system/shell_exec         │
│  4. If args needed: strict allow-list validation             │
└──────────────────────────────────────────────────────────────┘
```

### TypeScript — Safe Command Execution

```typescript
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// CORRECT: execFile — no shell interpretation
async function convertImage(inputPath: string, outputPath: string): Promise<void> {
  // Validate paths first
  const safePath = validateFilePath(inputPath);

  // execFile: arguments are passed as array, NOT through shell
  // Shell metacharacters (;, |, &, etc.) are treated as literal characters
  await execFileAsync("convert", [safePath, "-resize", "800x600", outputPath]);
}

// CORRECT: Use library instead of shell command
import sharp from "sharp";

async function convertImageSafe(inputPath: string, outputPath: string): Promise<void> {
  const safePath = validateFilePath(inputPath);
  // No shell involved — pure library call
  await sharp(safePath).resize(800, 600).toFile(outputPath);
}

// WRONG — NEVER do:
// ❌ exec(`convert ${inputPath} ${outputPath}`)           // Shell injection
// ❌ exec("ping " + hostname)                              // Shell injection
// ❌ exec(`git log --author="${username}"`)                 // Shell injection

// For git operations, use a library:
import simpleGit from "simple-git";

async function getCommitsByAuthor(author: string): Promise<string[]> {
  const git = simpleGit();
  const log = await git.log({ "--author": author });  // Library call, no shell
  return log.all.map(c => c.message);
}
```

### Go — Safe Command Execution

```go
import "os/exec"

func ConvertImage(inputPath, outputPath string) error {
    safePath, err := validateFilePath(inputPath)
    if err != nil {
        return err
    }

    // CORRECT: exec.Command passes args directly (no shell interpretation)
    cmd := exec.CommandContext(ctx, "convert", safePath, "-resize", "800x600", outputPath)
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    return cmd.Run()
}

// WRONG — NEVER use shell invocation:
// ❌ exec.Command("sh", "-c", "convert " + inputPath + " " + outputPath)
// ❌ exec.Command("bash", "-c", fmt.Sprintf("ping %s", hostname))
```

### Python — Safe Command Execution

```python
import subprocess

def convert_image(input_path: str, output_path: str) -> None:
    safe_path = validate_file_path(input_path)

    # CORRECT: shell=False (default), args as list
    subprocess.run(
        ["convert", safe_path, "-resize", "800x600", output_path],
        check=True,
        capture_output=True,
        timeout=30,
    )

# CORRECT: Use library instead
from PIL import Image

def convert_image_safe(input_path: str, output_path: str) -> None:
    safe_path = validate_file_path(input_path)
    with Image.open(safe_path) as img:
        img.thumbnail((800, 600))
        img.save(output_path)

# WRONG — NEVER do:
# ❌ os.system(f"convert {input_path} {output_path}")
# ❌ subprocess.run(f"ping {hostname}", shell=True)
# ❌ subprocess.run("convert " + input_path, shell=True)
```

---

## 4. Path Traversal

```
┌──────────────────────────────────────────────────────────────┐
│              Path Traversal Attack                            │
│                                                               │
│  Vulnerable Code:                                            │
│  const file = path.join("/uploads", req.params.filename)    │
│  fs.readFile(file)                                           │
│                                                               │
│  Attack Input: filename = "../../../etc/passwd"              │
│  Result: Reads /etc/passwd (or any file on system)          │
│                                                               │
│  Attack Variations:                                          │
│  ├── ../../../etc/shadow                                    │
│  ├── ..%2F..%2F..%2Fetc%2Fpasswd (URL encoded)             │
│  ├── ....//....//etc/passwd (double traversal)              │
│  ├── /uploads/../../../etc/passwd (absolute with traversal) │
│  └── \\..\\..\\..\\windows\\system32 (Windows)             │
│                                                               │
│  Defense:                                                    │
│  1. Resolve the full path and verify it's under base dir    │
│  2. NEVER trust user-supplied filenames directly             │
│  3. Use a UUID or hash as the stored filename               │
│  4. Reject paths containing ".." or absolute paths          │
└──────────────────────────────────────────────────────────────┘
```

### TypeScript — Path Traversal Prevention

```typescript
import path from "path";
import fs from "fs/promises";

const UPLOAD_BASE_DIR = path.resolve("/app/uploads");

// CORRECT: Resolve and validate path
function validateFilePath(userInput: string): string {
  // 1. Remove null bytes (bypass attempt)
  const cleaned = userInput.replace(/\0/g, "");

  // 2. Resolve the full path
  const resolvedPath = path.resolve(UPLOAD_BASE_DIR, cleaned);

  // 3. Verify it's within the base directory
  if (!resolvedPath.startsWith(UPLOAD_BASE_DIR + path.sep) && resolvedPath !== UPLOAD_BASE_DIR) {
    throw new ForbiddenError("Path traversal attempt detected");
  }

  return resolvedPath;
}

// CORRECT: Use UUID for stored filenames (eliminate traversal entirely)
import { randomUUID } from "crypto";

async function saveUpload(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase();
  const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".pdf"]);

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BadRequestError(`File extension ${ext} not allowed`);
  }

  // UUID filename — no user input in the stored path
  const filename = `${randomUUID()}${ext}`;
  const destPath = path.join(UPLOAD_BASE_DIR, filename);

  await fs.copyFile(file.path, destPath);
  await fs.unlink(file.path); // Remove temp file

  return filename; // Store this in database, not the original name
}

// File download endpoint
app.get("/api/files/:filename", authMiddleware, async (req, res) => {
  const safePath = validateFilePath(req.params.filename);

  try {
    await fs.access(safePath);
    res.sendFile(safePath);
  } catch {
    res.status(404).json({ error: "file_not_found" });
  }
});
```

### Go — Path Traversal Prevention

```go
const uploadBaseDir = "/app/uploads"

func ValidateFilePath(userInput string) (string, error) {
    // Remove null bytes
    cleaned := strings.ReplaceAll(userInput, "\x00", "")

    // Resolve full path
    resolved := filepath.Join(uploadBaseDir, filepath.Clean(cleaned))

    // Verify within base directory
    absBase, _ := filepath.Abs(uploadBaseDir)
    absResolved, _ := filepath.Abs(resolved)

    if !strings.HasPrefix(absResolved, absBase+string(filepath.Separator)) && absResolved != absBase {
        return "", fmt.Errorf("path traversal attempt: %s", userInput)
    }

    return absResolved, nil
}

func SaveUpload(file multipart.File, header *multipart.FileHeader) (string, error) {
    ext := strings.ToLower(filepath.Ext(header.Filename))
    allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".pdf": true}

    if !allowedExts[ext] {
        return "", fmt.Errorf("extension not allowed: %s", ext)
    }

    // UUID filename — no user input
    filename := uuid.New().String() + ext
    destPath := filepath.Join(uploadBaseDir, filename)

    dst, err := os.Create(destPath)
    if err != nil {
        return "", err
    }
    defer dst.Close()

    if _, err := io.Copy(dst, file); err != nil {
        return "", err
    }

    return filename, nil
}
```

### Python — Path Traversal Prevention

```python
from pathlib import Path
import uuid

UPLOAD_BASE_DIR = Path("/app/uploads").resolve()

def validate_file_path(user_input: str) -> Path:
    # Remove null bytes
    cleaned = user_input.replace("\x00", "")

    # Resolve full path
    resolved = (UPLOAD_BASE_DIR / cleaned).resolve()

    # Verify within base directory
    if not str(resolved).startswith(str(UPLOAD_BASE_DIR) + "/"):
        raise PermissionError(f"Path traversal attempt: {user_input}")

    return resolved

def save_upload(file: UploadFile) -> str:
    ext = Path(file.filename).suffix.lower()
    allowed = {".jpg", ".jpeg", ".png", ".gif", ".pdf"}

    if ext not in allowed:
        raise ValueError(f"Extension not allowed: {ext}")

    # UUID filename
    filename = f"{uuid.uuid4()}{ext}"
    dest = UPLOAD_BASE_DIR / filename

    with open(dest, "wb") as f:
        while chunk := file.file.read(8192):
            f.write(chunk)

    return filename
```

---

## 5. SSRF — Server-Side Request Forgery

```
┌──────────────────────────────────────────────────────────────┐
│              SSRF Attack                                      │
│                                                               │
│  Vulnerable Code:                                            │
│  const url = req.body.url;                                   │
│  const response = await fetch(url); // User-controlled URL   │
│                                                               │
│  Attack: url = "http://169.254.169.254/latest/meta-data"    │
│  Result: Reads AWS instance metadata (credentials leak)      │
│                                                               │
│  Attack: url = "http://localhost:6379/SET+key+value"         │
│  Result: Writes to internal Redis via HTTP                   │
│                                                               │
│  Internal targets:                                           │
│  ├── Cloud metadata: 169.254.169.254 (AWS, GCP, Azure)     │
│  ├── Internal services: localhost, 127.0.0.1, 10.x, 192.168│
│  ├── Docker: 172.17.0.1 (host from container)               │
│  └── Kubernetes: kubernetes.default.svc                      │
│                                                               │
│  Defense:                                                    │
│  1. Allow-list of permitted domains                          │
│  2. Block private/reserved IP ranges                         │
│  3. Use DNS resolution to verify target before connecting   │
│  4. Disable redirects (or re-validate after redirect)       │
└──────────────────────────────────────────────────────────────┘
```

### SSRF Prevention

```typescript
import { URL } from "url";
import dns from "dns/promises";
import { isIP } from "net";

const BLOCKED_IP_RANGES = [
  /^127\./,                          // Loopback
  /^10\./,                           // Private A
  /^172\.(1[6-9]|2\d|3[01])\./,     // Private B
  /^192\.168\./,                     // Private C
  /^169\.254\./,                     // Link-local (AWS metadata)
  /^0\./,                            // This network
  /^::1$/,                           // IPv6 loopback
  /^fc00:/,                          // IPv6 private
  /^fe80:/,                          // IPv6 link-local
];

async function validateExternalURL(userURL: string): Promise<URL> {
  // 1. Parse URL
  let parsed: URL;
  try {
    parsed = new URL(userURL);
  } catch {
    throw new BadRequestError("Invalid URL");
  }

  // 2. Only allow HTTPS (or HTTP in specific cases)
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new BadRequestError("Only HTTP(S) URLs allowed");
  }

  // 3. Block reserved hostnames
  const blockedHostnames = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal"];
  if (blockedHostnames.includes(parsed.hostname.toLowerCase())) {
    throw new BadRequestError("Internal hosts not allowed");
  }

  // 4. Resolve DNS and check IP
  let addresses: string[];
  if (isIP(parsed.hostname)) {
    addresses = [parsed.hostname];
  } else {
    try {
      addresses = (await dns.resolve4(parsed.hostname));
    } catch {
      throw new BadRequestError("Cannot resolve hostname");
    }
  }

  for (const ip of addresses) {
    for (const pattern of BLOCKED_IP_RANGES) {
      if (pattern.test(ip)) {
        throw new BadRequestError("Internal IP address not allowed");
      }
    }
  }

  return parsed;
}

// Safe external fetch
async function safeFetch(userURL: string): Promise<Response> {
  const validated = await validateExternalURL(userURL);

  const response = await fetch(validated.toString(), {
    redirect: "manual",        // Don't follow redirects automatically
    signal: AbortSignal.timeout(10000),  // 10s timeout
    headers: {
      "User-Agent": "MyApp/1.0",
    },
  });

  // If redirect, re-validate the redirect target
  if ([301, 302, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (location) {
      await validateExternalURL(location);  // Re-validate!
    }
  }

  return response;
}
```

---

## 6. Template Injection

```typescript
// Server-Side Template Injection (SSTI)

// WRONG — user input in template
// ❌ Handlebars.compile(userInput)({ data })
// ❌ nunjucks.renderString(userInput, { data })
// ❌ eval(`\`${userTemplate}\``)

// CORRECT — user input as data, never as template
import Handlebars from "handlebars";

const ALLOWED_TEMPLATES = new Map<string, HandlebarsTemplateDelegate>();

function registerTemplate(name: string, source: string): void {
  // Templates are defined by developers, NOT users
  ALLOWED_TEMPLATES.set(name, Handlebars.compile(source));
}

function renderTemplate(name: string, data: Record<string, unknown>): string {
  const template = ALLOWED_TEMPLATES.get(name);
  if (!template) throw new Error(`Unknown template: ${name}`);

  // User data is passed as context — never compiled as template
  return template(data);
}

// If users MUST define templates (email templates, etc.)
// Use a restricted template language with sandboxing:
import { Liquid } from "liquidjs";

const engine = new Liquid({
  strictFilters: true,    // Reject unknown filters
  strictVariables: true,  // Reject undefined variables
  // No file system access
  root: [],
  // Custom tags disabled
});

async function renderUserTemplate(userTemplate: string, data: Record<string, unknown>): Promise<string> {
  // Liquid is designed to be safe for user-defined templates
  // No file access, no code execution
  return engine.parseAndRender(userTemplate, data);
}
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| String concatenation in SQL | SQL injection | Parameterized queries ($1, ?, :name) |
| `query(text(...))` with f-strings (Python) | SQL injection via ORM bypass | Use ORM query builder, never raw f-strings |
| Dynamic table/column names from user input | SQL injection (params can't protect identifiers) | Allow-list of valid identifiers |
| No type validation on MongoDB queries | NoSQL operator injection (`$gt`, `$regex`) | Zod/Joi schema validation, reject objects in string fields |
| `exec()` or `system()` with user input | Command injection | `execFile()` (Node), `exec.Command` (Go), `subprocess.run(shell=False)` (Python) |
| `path.join(base, userInput)` without validation | Path traversal via `../` | `path.resolve()` + verify prefix matches base dir |
| `fetch(userURL)` without validation | SSRF — internal service access | Validate URL, resolve DNS, block private IPs |
| User input in template compilation | Server-side template injection | User data as context only, never as template source |
| Escaping/sanitizing instead of parameterization | Incomplete defense, encoding bypasses | ONLY parameterized queries for SQL |
| Trusting client-side validation alone | All client-side validation is bypassable | Server-side validation is mandatory |
| `eval()` with any external data | Remote code execution | Never use eval with external data. Use JSON.parse for JSON. |

---

## 8. Enforcement Checklist

- [ ] ALL SQL queries use parameterized/prepared statements
- [ ] Dynamic identifiers (table/column names) validated against allow-list
- [ ] MongoDB queries validated with schema (Zod/Joi) — no operator injection
- [ ] No `exec()`, `system()`, `shell_exec()` with user-controlled input
- [ ] Command execution uses `execFile`/array args (no shell interpretation)
- [ ] File paths resolved and validated against base directory
- [ ] Stored filenames use UUID/hash (no user-supplied names on disk)
- [ ] External URL fetches validate against allow-list and block private IPs
- [ ] SSRF: DNS resolution checked, redirects re-validated
- [ ] No `eval()`, `Function()`, or template compilation with user data
- [ ] Server-side validation on ALL inputs (client-side is supplementary only)
- [ ] ORM/query builder used for dynamic query construction
- [ ] Path traversal: null bytes stripped, `../` detected, absolute paths blocked
- [ ] Input type enforcement: strings stay strings (reject objects where strings expected)
