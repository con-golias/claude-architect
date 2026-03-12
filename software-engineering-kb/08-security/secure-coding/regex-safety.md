# Regex Safety

> **Domain:** Security > Secure Coding > Regex Safety
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** 2026-03-10

## Why It Matters

Regular expressions are one of the most powerful tools in a developer's arsenal -- and one of the most dangerous. A single poorly written regex can take down an entire production service. The mechanism is deceptively simple: certain regex patterns exhibit exponential time complexity when evaluated against crafted input. An attacker who discovers such a pattern can send a single HTTP request containing a malicious string and freeze the server for minutes or hours. This is Regular Expression Denial of Service (ReDoS), classified as CWE-1333.

ReDoS is not theoretical. It has caused outages at Stack Overflow, Cloudflare, and npm. It has generated CVEs against widely-used libraries. It exploits a fundamental property of how most regex engines work: backtracking. Every language that uses a backtracking NFA regex engine -- JavaScript, Python, Java, Ruby, PHP, C#, Perl -- is vulnerable by default.

This guide covers the mechanics of ReDoS, how to identify vulnerable patterns, which regex engines are safe, how to enforce timeouts, how to lint regex patterns in CI, when to avoid regex entirely, and how to prevent regex injection. Every recommendation is production-tested and backed by real-world incident analysis.

---

## Table of Contents

1. [ReDoS -- Regular Expression Denial of Service (CWE-1333)](#1-redos----regular-expression-denial-of-service-cwe-1333)
2. [Catastrophic Backtracking Explained](#2-catastrophic-backtracking-explained)
3. [Vulnerable Regex Patterns](#3-vulnerable-regex-patterns)
4. [Real-World ReDoS Incidents](#4-real-world-redos-incidents)
5. [Regex Engine Types: NFA vs DFA](#5-regex-engine-types-nfa-vs-dfa)
6. [Safe Regex Practices](#6-safe-regex-practices)
7. [Regex Timeout Mechanisms](#7-regex-timeout-mechanisms)
8. [Regex Linting and Static Analysis Tools](#8-regex-linting-and-static-analysis-tools)
9. [Input Validation Without Regex](#9-input-validation-without-regex)
10. [Regex Injection (CWE-730)](#10-regex-injection-cwe-730)
11. [Regex Security in WAF Rules](#11-regex-security-in-waf-rules)
12. [Best Practices](#best-practices)
13. [Anti-Patterns](#anti-patterns)
14. [Enforcement Checklist](#enforcement-checklist)

---

## 1. ReDoS -- Regular Expression Denial of Service (CWE-1333)

**What it is:** ReDoS is a denial-of-service attack that exploits the computational characteristics of certain regular expression patterns. When a regex engine encounters a pattern with ambiguous matching paths and the input causes repeated failures at the end of the string, the engine backtracks through an exponential number of possible states before concluding that no match exists. The CPU is consumed entirely by this backtracking process. A single request with a carefully crafted input string can pin a CPU core at 100% for seconds, minutes, or longer.

**CWE:** CWE-1333 (Inefficient Regular Expression Complexity). Also related to CWE-400 (Uncontrolled Resource Consumption).

**OWASP:** Mapped to A05:2021 Security Misconfiguration and denial-of-service attack vectors.

**Impact:** Application hangs, thread pool exhaustion, cascading failures across microservices, complete service unavailability. In single-threaded environments like Node.js, a single ReDoS-triggering request blocks the entire event loop.

### How It Works

ReDoS requires two conditions:

1. **A vulnerable regex pattern** -- a pattern where the engine has multiple ways to match the same substring (ambiguity), typically caused by nested quantifiers or overlapping alternations.
2. **A malicious input string** -- a string that almost matches the pattern but fails at the very end, forcing the engine to exhaust all possible matching paths before reporting failure.

The time complexity of a vulnerable pattern grows exponentially with input length. Adding a single character to the input doubles (or more) the number of backtracking steps. An input of 25 characters might take milliseconds; an input of 50 characters might take hours.

---

## 2. Catastrophic Backtracking Explained

### The Mechanics of NFA Backtracking

Most regex engines use a Nondeterministic Finite Automaton (NFA) with backtracking. When the engine encounters a quantifier like `+` or `*`, it tries to match as many characters as possible (greedy behavior). If the overall match fails later in the pattern, the engine backtracks -- it returns to the quantifier, gives up one character, and tries the rest of the pattern again. If that also fails, it backtracks again, and again, exploring every possible combination.

For simple patterns, backtracking terminates quickly. For patterns with nested or overlapping quantifiers, the number of combinations explodes.

### Step-by-Step Execution Trace

Consider the regex `^(a+)+$` applied to the input `aaaaX`:

```
Pattern: ^(a+)+$
Input:   aaaaX (5 characters)
The engine must match one or more groups of (a+), and the entire string must match (anchored with ^ and $).

Step 1: The inner (a+) matches "aaaa" (greedy, takes all 4 a's).
        The outer (+) has matched 1 group.
        The $ anchor tries to match -- FAILS (next char is 'X', not end of string).

Step 2: Backtrack. Inner (a+) gives up one 'a', matches "aaa".
        Outer (+) tries another iteration of (a+).
        Second (a+) matches "a".
        $ anchor tries -- FAILS ('X' remains).

Step 3: Backtrack second (a+). It has only "a", cannot shrink.
        Backtrack further. First (a+) gives up another 'a', matches "aa".
        Second (a+) matches "aa".
        $ anchor -- FAILS.

Step 4: Backtrack second (a+) to "a".
        Third (a+) matches "a".
        $ anchor -- FAILS.

Step 5: Backtrack. First (a+) = "aa", second (a+) = "a", need third.
        ... continues exploring 3-group splits.

Step 6-...: The engine tries every possible way to partition "aaaa" into
        groups of one or more a's:
        [aaaa]
        [aaa][a]
        [aa][aa]
        [aa][a][a]
        [a][aaa]
        [a][aa][a]
        [a][a][aa]
        [a][a][a][a]

        That is 2^(n-1) possible partitions for n 'a' characters.
        For n=4: 8 combinations.
        For n=25: 16,777,216 combinations.
        For n=50: 562,949,953,421,312 combinations.

Every single partition is tried and fails because 'X' never matches $.
```

### Exponential Growth Visualization

```
Input length (n) | Backtracking steps | Approximate time
-----------------|--------------------|------------------
10               | ~1,024             | < 1 ms
20               | ~1,048,576         | ~100 ms
25               | ~33,554,432        | ~3 seconds
30               | ~1,073,741,824     | ~2 minutes
35               | ~34,359,738,368    | ~1 hour
40               | ~1,099,511,627,776 | ~days
```

This is why ReDoS is called "catastrophic backtracking." The growth is not linear or polynomial -- it is exponential. A difference of 10 characters in input length can change execution time from milliseconds to hours.

---

## 3. Vulnerable Regex Patterns

### Evil Regex Patterns

A regex pattern is "evil" (vulnerable to ReDoS) if it contains:
- **Nested quantifiers:** a quantifier applied to a group that itself contains a quantifier. Examples: `(a+)+`, `(a*)*`, `(a+)*`, `(a*)+`.
- **Overlapping alternations with quantifiers:** alternations where both branches can match the same character. Examples: `(a|a)+`, `(a|aa)+`, `(a|ab)+`.
- **Unbounded repetition of overlapping patterns:** patterns like `(.*a){x}` where `.*` and the literal overlap.

### Pattern 1: Nested Quantifiers -- `(a+)+`

```
Pattern: (a+)+
Evil input: "aaaaaaaaaaaaaaaaaaaaaaaa!"

Why it is vulnerable:
  - The inner a+ can match 1 to N 'a' characters.
  - The outer + repeats the group.
  - For N 'a' characters followed by a non-'a' character, the engine tries
    every way to partition N items into groups -- 2^(N-1) combinations.
```

### Pattern 2: Overlapping Alternations -- `(a|aa)+`

```
Pattern: (a|aa)+
Evil input: "aaaaaaaaaaaaaaaaaaaaaaaa!"

Why it is vulnerable:
  - For each 'a' in the input, the engine can choose to match it with the
    first branch (a) or combine it with the next 'a' using the second
    branch (aa).
  - This creates 2^(N-1) possible matching paths for N 'a' characters.
  - Same exponential behavior as nested quantifiers.
```

### Pattern 3: Unbounded Repetition with Overlap -- `(.*a){x}`

```
Pattern: (.*a){3}
Evil input: "aaaaaaaaaaaaaaaaaaaaaaaa!"

Why it is vulnerable:
  - .* matches everything including 'a', so .* and 'a' overlap.
  - The engine must try every way to assign 'a' characters to the .*
    portion vs. the literal 'a' at the end of each group.
  - Combined with the {3} repetition, the complexity is super-exponential.
```

### Email Validation Regex Gone Wrong

This is one of the most common sources of ReDoS in real applications. Developers write email validation regex patterns that contain nested quantifiers:

```
VULNERABLE email regex:
  ^([a-zA-Z0-9_\.\-])+@(([a-zA-Z0-9\-])+\.)+([a-zA-Z]{2,4})+$

Breakdown of the vulnerability:
  ([a-zA-Z0-9\-])+ inside (...)+ creates nested quantifiers.
  The outer group with \. is repeated with +.

Evil input:
  "aaaaaaaaaaaaaaaaaaaaaaaa@aaaaaaaaaaaaaaaaaaaaaaaa" (no valid TLD)
  The engine backtracks exponentially trying different groupings of the
  domain part.

Another vulnerable email regex:
  ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$

  This simpler pattern is actually SAFE (no nested quantifiers).
  But many "comprehensive" email regex patterns are not.
```

### URL Validation Regex Vulnerabilities

```
VULNERABLE URL regex:
  ^https?:\/\/(([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,})(\/.*)*$

  The nested group ([a-zA-Z0-9\-]+\.)+ is already a risk.
  Combined with (\/.*)*  -- nested quantifiers on the path.

Evil input:
  "http://aaaaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaa" (no valid end)
  The engine tries every way to split the characters between the
  inner [a-zA-Z0-9\-]+ and the outer repeating group.

SAFE alternative:
  Validate URLs with a URL parser, not with regex. Every language has one.
```

### More Vulnerable Patterns Found in the Wild

```
Pattern                          | Source / Context
---------------------------------|------------------------------------
(\s+)*                           | Whitespace matching in parsers
(\d+\.?\d*)+                     | Number parsing
(\w+\s?)*                        | Word list matching
([a-zA-Z]+)*                     | Text token matching
(.*?a){20}                       | Log pattern matching
(<[^>]*>)*                       | Naive HTML tag matching
(\b\w+\b\s*)+                    | Word boundary matching
```

---

## 4. Real-World ReDoS Incidents

### Stack Overflow Outage (July 2016)

**What happened:** A single specially crafted post caused the Stack Overflow web servers to hang. The post contained whitespace characters that triggered catastrophic backtracking in a regex used for trimming trailing whitespace in the Markdown renderer. The regex `\s+$` was applied to a long string of spaces followed by a non-space character (not at the end of the string). The NFA engine (.NET) tried every possible partition of the spaces before concluding no match existed.

**Impact:** The web application became unresponsive. The regex was running on the rendering path, so every page load that included the malicious content triggered the hang.

**Root cause:** The pattern `\s+$` is not inherently exponential, but the .NET regex engine's behavior with certain combinations of the pattern and very long whitespace sequences created pathological performance. The fix was to add a timeout to regex operations and rewrite the pattern.

**Lesson:** Even seemingly simple patterns can be dangerous depending on the engine implementation and input characteristics. Always set regex timeouts.

### Cloudflare Outage (July 2, 2019)

**What happened:** A firewall rule update deployed to Cloudflare's global network contained a regex pattern that caused catastrophic backtracking. The pattern `(?:(?:\"|'|\]|\}|\\|\d|(?:nan|infinity|true|false|null|undefined|symbol|math)|\`|\-|\+)+[)]*;?(googletag|tele498498|...)` was added to a WAF rule. The `(?:...)+` with nested alternation caused exponential backtracking. Because Cloudflare's WAF runs on every HTTP request, the CPU on every edge server spiked to 100%.

**Impact:** Cloudflare's entire network went down for 27 minutes. Millions of websites were inaccessible. The incident affected approximately 5% of all HTTP requests on the internet during that window.

**Root cause:** The regex pattern had nested quantifiers inside alternation groups. No regex timeout was configured. No pre-deployment regex safety analysis was performed.

**Lesson:** WAF regex rules must be tested for ReDoS before deployment. Regex execution in the hot path (every request) must have strict timeouts. Use a DFA-based engine (RE2) for WAF rules.

### npm Package Vulnerabilities

Multiple widely-used npm packages have had ReDoS vulnerabilities:

```
Package             | CVE            | Vulnerable Pattern Context
--------------------|----------------|------------------------------------
ua-parser-js        | CVE-2021-27292 | User-Agent string parsing regex
browserslist         | CVE-2021-23364 | Browser query parsing
normalize-url       | CVE-2021-33502 | URL normalization regex
nth-check            | CVE-2021-3803  | CSS selector parsing
glob-parent          | CVE-2020-28469 | Glob pattern parsing
color-string         | CVE-2021-29060 | Color string parsing
validator            | CVE-2021-3765  | isSlug() validation regex
```

Each of these packages is downloaded millions of times per week. A ReDoS vulnerability in any of them affects a vast number of applications.

### CVE Examples

**CVE-2021-27292 (ua-parser-js):** The User-Agent parsing regex contained nested quantifiers. An attacker could send a crafted User-Agent header that caused the server to hang. Because User-Agent parsing often runs on every HTTP request, this was a critical denial-of-service vector.

**CVE-2023-26920 (fast-xml-parser):** A regex in the XML attribute parsing logic was vulnerable to ReDoS. A crafted XML document with specific attribute patterns could cause exponential backtracking.

**CVE-2022-25858 (terser):** The JavaScript minifier's regex for parsing certain code constructs was vulnerable to ReDoS. A crafted JavaScript file sent to a build pipeline could halt the build.

---

## 5. Regex Engine Types: NFA vs DFA

The vulnerability of a regex engine to ReDoS depends entirely on its implementation. There are two fundamental engine types.

### NFA (Nondeterministic Finite Automaton) -- Backtracking

NFA engines try one matching path at a time. When a path fails, they backtrack and try another. This enables powerful features (backreferences, lookaheads, lookbehinds, lazy quantifiers) but introduces the possibility of exponential backtracking.

**Characteristics:**
- Supports backreferences (`\1`, `\2`)
- Supports lookahead and lookbehind assertions
- Supports lazy quantifiers (`*?`, `+?`)
- Time complexity: O(2^n) worst case for pathological patterns
- Vulnerable to ReDoS

**Languages using NFA engines:**

```
Language    | Engine         | ReDoS Vulnerable?
------------|----------------|-------------------
JavaScript  | V8 Irregexp    | YES
Python      | re module      | YES
Java        | java.util.regex| YES
Ruby        | Onigmo         | YES
PHP         | PCRE2          | YES
C#          | .NET Regex     | YES (has Timeout option)
Perl        | Native         | YES
```

### DFA (Deterministic Finite Automaton) -- No Backtracking

DFA engines process every possible matching path simultaneously. They advance one character at a time through all states in parallel. This guarantees that each character is examined at most once, providing linear time complexity regardless of the pattern. However, DFA engines cannot support features that require remembering previous matches (backreferences).

**Characteristics:**
- No backreferences
- No lookahead/lookbehind
- No lazy quantifiers (they are syntactically accepted but behave differently)
- Time complexity: O(n) guaranteed -- linear in input length
- NOT vulnerable to ReDoS

**Languages and libraries using DFA/linear-time engines:**

```
Language / Library | Engine   | ReDoS Vulnerable?
-------------------|----------|-------------------
Go (regexp)        | RE2-like | NO -- guaranteed linear time
Rust (regex crate) | DFA/NFA  | NO -- guaranteed linear time
RE2 (C++ library)  | RE2      | NO -- guaranteed linear time
re2 (Python)       | RE2      | NO -- guaranteed linear time (via google-re2)
node-re2 (Node.js) | RE2      | NO -- guaranteed linear time (via re2 bindings)
```

### RE2: The Safe Regex Engine

RE2 is a regex engine created by Google that guarantees linear-time execution. It achieves this by using a DFA-based approach and refusing to support features that would require backtracking (backreferences, lookaheads, lookbehinds).

RE2 does support:
- Character classes, alternation, repetition (quantifiers)
- Named and numbered capture groups
- Non-greedy quantifiers (but they may match differently than NFA)
- Unicode support
- Most POSIX and Perl-compatible syntax

RE2 does not support:
- Backreferences (`\1`, `\2`)
- Lookahead assertions (`(?=...)`, `(?!...)`)
- Lookbehind assertions (`(?<=...)`, `(?<!...)`)
- Atomic groups (`(?>...)`)
- Possessive quantifiers (`a++`, `a*+`)

If your regex patterns do not require these features, use RE2.

---

## 6. Safe Regex Practices

### 6.1. Use RE2 or RE2-Compatible Engines

Replace the default regex engine with RE2 wherever possible. RE2 guarantees linear-time execution and eliminates ReDoS entirely.

**TypeScript/JavaScript (node-re2):**

```typescript
// SAFE: RE2 engine -- guaranteed linear time
import RE2 from "re2";

const emailPattern = new RE2("^[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}$");

function validateEmail(input: string): boolean {
  // RE2 will never hang, regardless of input content or length
  return emailPattern.test(input);
}

// RE2 as a drop-in replacement for RegExp
const urlPattern = new RE2("^https?://[a-zA-Z0-9][a-zA-Z0-9.\\-]*\\.[a-zA-Z]{2,}(/\\S*)?$");

function isValidUrl(input: string): boolean {
  return urlPattern.test(input);
}
```

**Python (google-re2):**

```python
# SAFE: RE2 engine via google-re2 package
# Install: pip install google-re2
import re2

def validate_email(email: str) -> bool:
    # RE2 guarantees linear-time execution
    pattern = re2.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
    return bool(pattern.match(email))

def find_patterns(text: str) -> list[str]:
    # Even with complex patterns, RE2 runs in O(n) time
    pattern = re2.compile(r"\b\d{1,3}(\.\d{1,3}){3}\b")
    return pattern.findall(text)
```

**Go (regexp -- RE2 by default):**

```go
// SAFE: Go's regexp package uses RE2 by default -- always linear time
package main

import (
    "fmt"
    "regexp"
)

var emailPattern = regexp.MustCompile(
    `^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`,
)

func validateEmail(email string) bool {
    // This can NEVER cause ReDoS -- Go uses RE2 engine
    return emailPattern.MatchString(email)
}
```

**Rust (regex crate -- DFA by default):**

```rust
// SAFE: Rust's regex crate guarantees linear-time matching
use regex::Regex;

fn validate_email(email: &str) -> bool {
    // Rust regex crate uses a hybrid NFA/DFA that guarantees O(n) matching
    let pattern = Regex::new(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")
        .expect("Invalid regex");
    pattern.is_match(email)
}

// Compile once, use many times
use once_cell::sync::Lazy;

static EMAIL_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$").unwrap()
});

fn is_valid_email(email: &str) -> bool {
    EMAIL_RE.is_match(email)
}
```

### 6.2. Avoid Nested Quantifiers

Never apply a quantifier to a group that contains a quantifier. This is the single most common source of ReDoS.

```
VULNERABLE (nested quantifiers):
  (a+)+        -- quantifier + applied to group containing +
  (a*)*        -- quantifier * applied to group containing *
  (a+)*        -- quantifier * applied to group containing +
  (a*)+        -- quantifier + applied to group containing *
  (a{1,10})+   -- quantifier + applied to group containing {1,10}
  ([a-z]+\.)+  -- quantifier + applied to group containing +

SAFE (no nesting):
  a+           -- single quantifier, no group
  [a-z]+       -- single quantifier on character class
  [a-z]+\.[a-z]+ -- quantifiers at same level, not nested
  (?:[a-z]\.)+   -- quantifier + on group, but no inner quantifier
```

### 6.3. Use Atomic Groups and Possessive Quantifiers

Atomic groups and possessive quantifiers prevent backtracking. Once the engine matches inside an atomic group, it commits to that match and never backtracks into it. This eliminates exponential behavior.

**Java (supports possessive quantifiers and atomic groups):**

```java
// SAFE: Possessive quantifier (++) prevents backtracking
import java.util.regex.Pattern;

public class SafeRegex {
    // a++ means "match one or more 'a' and NEVER give back characters"
    // Possessive quantifier: no backtracking into this match
    private static final Pattern SAFE_PATTERN = Pattern.compile("^(a++)+$");

    // Atomic group: (?>...) commits to match, no backtracking
    private static final Pattern ATOMIC_PATTERN = Pattern.compile("^(?>a+)+$");

    public static boolean matchSafely(String input) {
        // Even with pathological input, these patterns run in linear time
        // because backtracking is prevented
        return SAFE_PATTERN.matcher(input).matches();
    }
}

// Compare behavior:
// Pattern.compile("^(a+)+$")   -- VULNERABLE: exponential backtracking
// Pattern.compile("^(a++)+$")  -- SAFE: possessive quantifier, no backtracking
// Pattern.compile("^(?>a+)+$") -- SAFE: atomic group, no backtracking
```

**Feature availability by language:**

```
Feature              | Java | .NET | Perl | PHP  | Python | JavaScript | Go | Rust
---------------------|------|------|------|------|--------|------------|----|-----
Possessive (a++)     | YES  | NO   | YES  | YES  | NO     | NO         | N/A| N/A
Atomic groups (?>)   | YES  | YES  | YES  | YES  | NO     | NO         | N/A| N/A
```

Go and Rust are marked N/A because their engines already guarantee linear time; they do not need possessive quantifiers or atomic groups.

### 6.4. Limit Input Length Before Regex Matching

Enforce a maximum input length before applying any regex. Even a vulnerable regex cannot cause catastrophic backtracking on a short string. This is a critical defense-in-depth measure.

```typescript
// DEFENSE IN DEPTH: Limit input length before regex matching
function validateUsername(input: string): boolean {
  // Step 1: Reject excessively long input BEFORE regex evaluation
  if (input.length > 64) {
    return false;
  }

  // Step 2: Now apply the regex -- even if the pattern were vulnerable,
  // 64 characters limits the backtracking to a manageable number of steps
  const pattern = /^[a-zA-Z][a-zA-Z0-9_]{2,63}$/;
  return pattern.test(input);
}

// Input length limits for common fields:
// Username:   3-64 characters
// Email:      5-254 characters (RFC 5321)
// URL:        1-2048 characters
// Name:       1-200 characters
// Comment:    1-10000 characters
// Search:     1-500 characters
```

```python
def validate_input(value: str, pattern: str, max_length: int) -> bool:
    """Validate input with length check before regex."""
    # Always check length first -- O(1) operation
    if len(value) > max_length:
        return False

    # Then apply regex -- backtracking is bounded by max_length
    import re
    return bool(re.match(pattern, value))
```

### 6.5. Set Regex Execution Timeouts

Configure execution timeouts so that even a vulnerable regex pattern cannot run indefinitely. This is the most important mitigation when you cannot guarantee that all regex patterns are safe.

See [Section 7: Regex Timeout Mechanisms](#7-regex-timeout-mechanisms) for implementation details.

### 6.6. Use Specific Character Classes Instead of `.*`

The dot-star pattern `.*` matches everything and creates maximum ambiguity. Replace it with specific character classes that match only the characters you expect.

```
VULNERABLE (ambiguous):
  ".*@.*\..*"          -- .* matches anything, including @ and .
  "<.*>"               -- .* matches everything including > characters
  "https?://.*"        -- .* matches the entire rest of the string

SAFE (specific):
  "[^@]+@[^@]+\.[^@]+" -- [^@]+ matches anything EXCEPT @
  "<[^>]*>"            -- [^>]* matches anything EXCEPT >
  "https?://[^\s]+"    -- [^\s]+ matches anything EXCEPT whitespace
```

```typescript
// VULNERABLE: .* creates ambiguity in matching
const badHtmlTag = /<.*>/;  // Matches across multiple tags: <a>text</b>

// SAFE: Negated character class eliminates ambiguity
const safeHtmlTag = /<[^>]*>/;  // Stops at first >: <a>
```

### 6.7. Prefer Simple String Operations Over Regex

Many common validation tasks do not require regex at all. String methods like `startsWith`, `endsWith`, `includes`, `indexOf`, `split`, and `trim` are faster and cannot cause ReDoS.

```typescript
// UNNECESSARY REGEX: Use string methods instead

// Instead of: /^Bearer /.test(header)
header.startsWith("Bearer ")

// Instead of: /\.json$/.test(filename)
filename.endsWith(".json")

// Instead of: /admin/.test(path)
path.includes("admin")

// Instead of: /^[^@]+@[^@]+$/.test(email) for basic check
email.includes("@") && email.indexOf("@") === email.lastIndexOf("@")

// Instead of: input.replace(/^\s+|\s+$/g, "")
input.trim()

// Instead of: str.split(/,\s*/)
str.split(",").map(s => s.trim())  // When performance is not critical
```

```python
# Python string methods instead of regex

# Instead of: re.match(r"^https://", url)
url.startswith("https://")

# Instead of: re.search(r"\.csv$", filename)
filename.endswith(".csv")

# Instead of: re.sub(r"^\s+|\s+$", "", text)
text.strip()

# Instead of: re.split(r"\s+", text)
text.split()  # str.split() without args splits on any whitespace
```

---

## 7. Regex Timeout Mechanisms

### JavaScript (Node.js)

JavaScript's built-in `RegExp` has no native timeout mechanism. Use `vm.runInNewContext` with a timeout, or use the `re2` package which is inherently safe.

```typescript
// APPROACH 1: Use RE2 (preferred -- eliminates the problem entirely)
import RE2 from "re2";

const safePattern = new RE2("^(a+)+$");
safePattern.test("aaaaaaaaaaaaaaaaaaaaa!");  // Returns false instantly

// APPROACH 2: vm.runInNewContext with timeout (for when you must use NFA regex)
import { runInNewContext } from "vm";

function regexWithTimeout(
  pattern: string,
  input: string,
  timeoutMs: number
): boolean {
  try {
    // Run regex in a sandboxed context with a timeout
    const result = runInNewContext(
      `new RegExp(pattern).test(input)`,
      { pattern, input },
      { timeout: timeoutMs }
    );
    return result as boolean;
  } catch (error) {
    // Timeout exceeded -- treat as no match
    if ((error as Error).message?.includes("Script execution timed out")) {
      console.warn("Regex execution timed out", { pattern, inputLength: input.length });
      return false;
    }
    throw error;
  }
}

// Usage:
const result = regexWithTimeout("^(a+)+$", "aaaaaaaaaaaaaaa!", 1000);
// Returns false after 1 second timeout instead of hanging

// APPROACH 3: Worker threads with timeout
import { Worker, isMainThread, parentPort, workerData } from "worker_threads";

function regexInWorker(pattern: string, input: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { pattern, input },
    });

    const timer = setTimeout(() => {
      worker.terminate();
      resolve(false);  // Timeout -- treat as no match
    }, timeoutMs);

    worker.on("message", (result: boolean) => {
      clearTimeout(timer);
      resolve(result);
    });

    worker.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

if (!isMainThread && workerData) {
  const { pattern, input } = workerData;
  const result = new RegExp(pattern).test(input);
  parentPort?.postMessage(result);
}
```

### Python

```python
import re
import signal

class RegexTimeout(Exception):
    """Raised when regex execution exceeds the timeout."""
    pass

def _timeout_handler(signum, frame):
    raise RegexTimeout("Regex execution timed out")

def regex_with_timeout(pattern: str, text: str, timeout_seconds: int = 2) -> bool:
    """Execute a regex match with a timeout (Unix only -- signal.alarm).

    For cross-platform timeout, use the 'regex' package or google-re2.
    """
    old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(timeout_seconds)
    try:
        result = re.match(pattern, text)
        return result is not None
    except RegexTimeout:
        return False
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)

# Usage:
result = regex_with_timeout(r"^(a+)+$", "a" * 30 + "!", timeout_seconds=2)
# Returns False after 2 seconds instead of hanging

# PREFERRED: Use google-re2 to eliminate the problem entirely
import re2

def safe_match(pattern: str, text: str) -> bool:
    """Match using RE2 -- guaranteed linear time, no timeout needed."""
    return bool(re2.match(pattern, text))
```

### Java

```java
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SafeRegexMatcher {

    /**
     * Execute a regex match with a timeout using thread interruption.
     * Java's regex engine checks for thread interruption during matching.
     */
    public static boolean matchWithTimeout(String regex, String input, long timeoutMs) {
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(input);

        Thread matchThread = new Thread(() -> {
            try {
                // matcher.matches() will be interrupted if thread is interrupted
                matcher.matches();
            } catch (Exception e) {
                // Interrupted -- match failed
            }
        });

        matchThread.start();
        try {
            matchThread.join(timeoutMs);
            if (matchThread.isAlive()) {
                matchThread.interrupt();
                matchThread.join(100);
                return false;  // Timeout -- treat as no match
            }
            return matcher.matches();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /**
     * Use CharSequence wrapper that checks for interruption.
     * This is more reliable than thread interruption alone.
     */
    public static CharSequence interruptibleInput(CharSequence input) {
        return new CharSequence() {
            @Override public int length() { return input.length(); }
            @Override public CharSequence subSequence(int start, int end) {
                return input.subSequence(start, end);
            }
            @Override public char charAt(int index) {
                // Check for interruption on every character access
                if (Thread.currentThread().isInterrupted()) {
                    throw new RuntimeException("Regex execution interrupted");
                }
                return input.charAt(index);
            }
            @Override public String toString() { return input.toString(); }
        };
    }
}
```

### Go (Inherently Safe)

```go
package main

import (
    "fmt"
    "regexp"
)

func main() {
    // Go's regexp package uses the RE2 algorithm.
    // No timeout is needed because execution time is always linear.
    // This pattern would cause catastrophic backtracking in NFA engines,
    // but Go handles it in microseconds regardless of input length.

    pattern := regexp.MustCompile(`^(a+)+$`)

    // Even with a very long input, matching is instantaneous
    input := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"
    result := pattern.MatchString(input)  // Returns false instantly
    fmt.Println(result)

    // NOTE: Go's regexp does NOT support backreferences or lookaheads.
    // If you need those features, you cannot use Go's standard regexp.
    // This is the tradeoff for guaranteed safety.
}
```

### Rust (Inherently Safe)

```rust
use regex::Regex;

fn main() {
    // Rust's regex crate guarantees linear-time matching.
    // No timeout needed -- it is architecturally impossible to cause ReDoS.

    let pattern = Regex::new(r"^(a+)+$").unwrap();

    // Instantly returns false, even with a very long input
    let input = "a".repeat(1000) + "!";
    let result = pattern.is_match(&input);
    println!("{}", result);  // false, computed in microseconds

    // Rust also provides a configurable size limit for compiled regexes
    use regex::RegexBuilder;

    let pattern = RegexBuilder::new(r"^(a+)+$")
        .size_limit(10 * 1024 * 1024)  // 10 MB limit on compiled DFA size
        .build()
        .unwrap();
}
```

### .NET (C#) -- Built-in Timeout

```csharp
using System;
using System.Text.RegularExpressions;

public class SafeRegex
{
    // .NET is the only major NFA engine with a built-in timeout parameter
    public static bool MatchWithTimeout(string pattern, string input, TimeSpan timeout)
    {
        try
        {
            var regex = new Regex(pattern, RegexOptions.None, timeout);
            return regex.IsMatch(input);
        }
        catch (RegexMatchTimeoutException)
        {
            // Timeout exceeded -- treat as no match
            Console.WriteLine($"Regex timed out on input of length {input.Length}");
            return false;
        }
    }

    // Usage:
    // MatchWithTimeout(@"^(a+)+$", new string('a', 30) + "!", TimeSpan.FromSeconds(2));
    // Returns false after 2 seconds instead of hanging

    // Set a default timeout for ALL regex operations in the AppDomain
    // AppDomain.CurrentDomain.SetData("REGEX_DEFAULT_MATCH_TIMEOUT", TimeSpan.FromSeconds(2));
}
```

---

## 8. Regex Linting and Static Analysis Tools

### safe-regex (npm)

Analyzes regex patterns statically and detects patterns that are vulnerable to ReDoS.

```bash
# Install
npm install --save-dev safe-regex

# Usage in code
```

```typescript
import safeRegex from "safe-regex";

const patterns = [
  /^(a+)+$/,           // UNSAFE -- nested quantifiers
  /^([a-z]+)*$/,       // UNSAFE -- nested quantifiers
  /^[a-z]+$/,          // SAFE -- single quantifier
  /^(a|aa)+$/,         // UNSAFE -- overlapping alternation
];

for (const pattern of patterns) {
  const isSafe = safeRegex(pattern);
  console.log(`${pattern} => ${isSafe ? "SAFE" : "UNSAFE"}`);
}
```

### vuln-regex-detector

A more thorough analysis tool that uses multiple detection algorithms.

```bash
# Install globally
npm install -g vuln-regex-detector

# Analyze a regex from the command line
vuln-regex-detector --regex "^(a+)+$"
# Output: VULNERABLE

vuln-regex-detector --regex "^[a-z]+$"
# Output: SAFE
```

### recheck

A ReDoS detection tool from the recheck project that supports multiple languages.

```bash
# Install
npm install --save-dev recheck

# Usage in code
```

```typescript
import { check } from "recheck";

async function analyzePattern(pattern: string): Promise<void> {
  const result = await check(pattern, "");
  console.log(`Pattern: ${pattern}`);
  console.log(`Status: ${result.status}`);  // "safe" or "vulnerable"
  if (result.status === "vulnerable") {
    console.log(`Attack string: ${result.attack}`);
    console.log(`Complexity: ${result.complexity}`);
  }
}

// Usage:
await analyzePattern("^(a+)+$");
// Status: vulnerable
// Attack string: "aaaaaaaaaaaaaaa!"
// Complexity: exponential
```

### CI Integration

Integrate regex safety checks into CI/CD pipelines to catch vulnerable patterns before they reach production.

```yaml
# GitHub Actions workflow for regex safety linting
name: Regex Safety Check
on: [pull_request]

jobs:
  regex-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm install safe-regex recheck

      - name: Scan for vulnerable regex patterns
        run: |
          node -e "
          const safeRegex = require('safe-regex');
          const { execSync } = require('child_process');

          // Find all regex literals in TypeScript/JavaScript files
          const files = execSync('find src -name \"*.ts\" -o -name \"*.js\"')
            .toString().trim().split('\n');

          let vulnerableCount = 0;
          for (const file of files) {
            const content = require('fs').readFileSync(file, 'utf-8');
            // Extract regex literals (simplified -- use AST parser for production)
            const regexLiterals = content.match(/\/[^\/\n]+\/[gimsuy]*/g) || [];
            for (const literal of regexLiterals) {
              try {
                const pattern = literal.slice(1, literal.lastIndexOf('/'));
                if (!safeRegex(pattern)) {
                  console.error('VULNERABLE:', file, literal);
                  vulnerableCount++;
                }
              } catch (e) { /* skip invalid patterns */ }
            }
          }

          if (vulnerableCount > 0) {
            console.error(vulnerableCount + ' vulnerable regex patterns found');
            process.exit(1);
          }
          console.log('All regex patterns are safe');
          "
```

### ESLint Plugin for Regex Safety

```javascript
// .eslintrc.js -- use eslint-plugin-regexp for comprehensive regex linting
module.exports = {
  plugins: ["regexp"],
  rules: {
    // Detect potentially exponential backtracking
    "regexp/no-super-linear-backtracking": "error",

    // Detect patterns that can never match
    "regexp/no-useless-assertions": "error",

    // Prefer character classes over alternation for single chars
    "regexp/prefer-character-class": "warn",

    // Detect unnecessary nested groups
    "regexp/no-useless-non-capturing-group": "warn",

    // Detect empty groups and alternations
    "regexp/no-empty-alternative": "warn",
  },
};
```

### Semgrep Rules

```yaml
# .semgrep.yml -- detect dangerous regex patterns
rules:
  - id: redos-nested-quantifiers
    patterns:
      - pattern-regex: '\([^)]*[+*][^)]*\)[+*{]'
    message: >
      Potential ReDoS: nested quantifiers detected. The outer quantifier is
      applied to a group containing an inner quantifier. This can cause
      exponential backtracking. Use RE2 or refactor the pattern.
    severity: ERROR
    languages: [generic]

  - id: regex-from-user-input
    patterns:
      - pattern: new RegExp($USER_INPUT)
    message: >
      Regex injection: user input is used directly in RegExp constructor.
      Escape the input with a regex escaping function or use a fixed pattern.
    severity: ERROR
    languages: [javascript, typescript]
```

---

## 9. Input Validation Without Regex

For many common validation tasks, regex is the wrong tool. Dedicated parsers are safer (no ReDoS risk), more correct (they implement the full specification), and easier to maintain.

### Email Validation

```typescript
// DO NOT validate email with regex. Use a parsing library.

// The "complete" email regex from RFC 5322 is thousands of characters long and
// no regex implementation correctly handles all edge cases (quoted strings,
// comments, folding whitespace, internationalized domain names).

// WRONG: Complex regex that is both incomplete and ReDoS-vulnerable
const badEmailRegex = /^([a-zA-Z0-9_\.\-])+@(([a-zA-Z0-9\-])+\.)+([a-zA-Z]{2,4})+$/;

// CORRECT: Use a validated library
// Option 1: Basic structural check + send verification email
function isPlausibleEmail(email: string): boolean {
  if (email.length > 254) return false;  // RFC 5321 limit
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (local.length === 0 || local.length > 64) return false;
  if (domain.length === 0) return false;
  if (!domain.includes(".")) return false;
  return true;
  // Then send a verification email to confirm the address is real
}

// Option 2: Use a proper validation library
// npm: email-validator, isemail, zod (.email())
import { z } from "zod";

const emailSchema = z.string().email().max(254);

function validateEmail(input: string): boolean {
  return emailSchema.safeParse(input).success;
}
```

```python
# Python: Use the email-validator library
# pip install email-validator
from email_validator import validate_email, EmailNotValidError

def is_valid_email(email: str) -> bool:
    try:
        # Validates format, DNS, and normalizes the address
        validated = validate_email(email, check_deliverability=True)
        return True
    except EmailNotValidError:
        return False
```

### URL Validation

```typescript
// DO NOT validate URLs with regex. Use the URL constructor.

// WRONG: Regex that is both incomplete and potentially vulnerable
const badUrlRegex = /^https?:\/\/(([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,})(\/.*)*$/;

// CORRECT: Use the URL parser
function isValidHttpUrl(input: string): boolean {
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
```

```python
from urllib.parse import urlparse

def is_valid_http_url(url: str) -> bool:
    """Validate URL using the standard library parser."""
    try:
        result = urlparse(url)
        return result.scheme in ("http", "https") and bool(result.netloc)
    except ValueError:
        return False
```

```go
import "net/url"

func isValidHTTPUrl(rawURL string) bool {
    parsed, err := url.Parse(rawURL)
    if err != nil {
        return false
    }
    return (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}
```

### Date Validation

```typescript
// DO NOT parse dates with regex. Use a date library.

// WRONG: Regex cannot validate date logic (Feb 30, leap years, etc.)
const badDateRegex = /^\d{4}-\d{2}-\d{2}$/;

// CORRECT: Parse and validate with the Date constructor or a library
function isValidDate(input: string): boolean {
  // Check basic format first (simple string operations, not regex)
  if (input.length !== 10 || input[4] !== "-" || input[7] !== "-") {
    return false;
  }
  const date = new Date(input + "T00:00:00Z");
  if (isNaN(date.getTime())) {
    return false;
  }
  // Verify the date round-trips correctly (catches Feb 30, etc.)
  return date.toISOString().startsWith(input);
}
```

### HTML Parsing

```typescript
// NEVER parse HTML with regex.
// This is not just a ReDoS concern -- regex fundamentally cannot parse
// nested structures (HTML is not a regular language).

// WRONG: Regex for HTML tags
const badHtmlParser = /<([a-z]+)([^>]*)>(.*?)<\/\1>/g;

// CORRECT: Use an HTML parser
import { JSDOM } from "jsdom";
// or: import { parse } from "node-html-parser";
// or: import DOMPurify from "dompurify";

function extractTextFromHtml(html: string): string {
  const dom = new JSDOM(html);
  return dom.window.document.body.textContent || "";
}

function sanitizeHtml(html: string): string {
  // Use DOMPurify to allow only safe HTML tags
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br"],
    ALLOWED_ATTR: ["href"],
  });
}
```

### When Regex IS Appropriate

Regex is the right tool for:
- Matching simple, well-defined patterns (phone numbers, zip codes, UUIDs)
- Search-and-replace in text editors and build tools
- Log analysis with known, safe patterns
- Pattern matching in configuration (routing, filtering)

Regex is NOT the right tool for:
- Parsing structured formats (HTML, XML, JSON, CSV, email addresses, URLs)
- Validating complex data with semantic rules (dates, credit cards with Luhn check)
- Anything that requires understanding nested structure

---

## 10. Regex Injection (CWE-730)

**What it is:** Regex injection occurs when user-supplied input is used to construct a regex pattern without proper escaping. The attacker can inject regex metacharacters to alter the pattern's behavior, cause ReDoS, or bypass validation logic.

**CWE:** CWE-730 (OWASP Regex Denial of Service). Also related to CWE-185 (Incorrect Regular Expression).

**Impact:** ReDoS (attacker crafts a pattern that causes exponential backtracking), validation bypass (attacker alters the pattern to match unintended inputs), information disclosure (attacker uses regex to probe for data patterns).

### Vulnerable Code

```typescript
// VULNERABLE: User input used directly in RegExp constructor
app.get("/search", (req, res) => {
  const query = req.query.q as string;

  // NEVER DO THIS -- attacker controls the regex pattern
  const pattern = new RegExp(query, "i");

  // Attacker sends: q=(a+)+$
  // This creates a ReDoS-vulnerable pattern from user input

  // Attacker sends: q=.*
  // This matches everything, bypassing any filtering

  const results = items.filter(item => pattern.test(item.name));
  res.json(results);
});
```

```python
# VULNERABLE: User input in re.compile()
import re

def search_items(query: str, items: list[str]) -> list[str]:
    # NEVER DO THIS -- attacker controls the regex pattern
    pattern = re.compile(query, re.IGNORECASE)
    return [item for item in items if pattern.search(item)]
    # Attacker sends query="(a+)+$" -- causes ReDoS
    # Attacker sends query="(?s).*" -- matches everything
```

### Secure Code -- Escaping User Input

Always escape user input before incorporating it into a regex pattern. Every language provides an escaping function.

```typescript
// SECURE: Escape user input before using in regex
function escapeRegex(input: string): string {
  // Escape all regex metacharacters: \ ^ $ . * + ? ( ) [ ] { } |
  return input.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

app.get("/search", (req, res) => {
  const query = req.query.q as string;

  if (!query || query.length > 200) {
    return res.status(400).json({ error: "Invalid query" });
  }

  // Escape the user input so it is treated as a literal string
  const escapedQuery = escapeRegex(query);
  const pattern = new RegExp(escapedQuery, "i");

  // Even if the user sends "(a+)+$", it becomes the literal string "\(a\+\)\+\$"
  // which matches the characters ( a + ) + $ literally

  const results = items.filter(item => pattern.test(item.name));
  res.json(results);
});
```

```python
import re

def search_items(query: str, items: list[str]) -> list[str]:
    """Search items with user query treated as a literal string."""
    if not query or len(query) > 200:
        raise ValueError("Invalid query")

    # re.escape() escapes all regex metacharacters
    escaped = re.escape(query)
    pattern = re.compile(escaped, re.IGNORECASE)

    return [item for item in items if pattern.search(item)]
    # User input "(a+)+$" becomes "\(a\+\)\+\$" -- no ReDoS, no injection
```

```go
import "regexp"

func searchItems(query string, items []string) []string {
    if len(query) == 0 || len(query) > 200 {
        return nil
    }

    // regexp.QuoteMeta escapes all regex metacharacters
    escaped := regexp.QuoteMeta(query)
    pattern := regexp.MustCompile("(?i)" + escaped)

    var results []string
    for _, item := range items {
        if pattern.MatchString(item) {
            results = append(results, item)
        }
    }
    return results
}
```

```java
import java.util.regex.Pattern;

public List<String> searchItems(String query, List<String> items) {
    if (query == null || query.isEmpty() || query.length() > 200) {
        return Collections.emptyList();
    }

    // Pattern.quote() wraps the string in \Q...\E, treating everything as literal
    String escaped = Pattern.quote(query);
    Pattern pattern = Pattern.compile(escaped, Pattern.CASE_INSENSITIVE);

    return items.stream()
        .filter(item -> pattern.matcher(item).find())
        .collect(Collectors.toList());
}
```

```rust
use regex::Regex;

fn search_items(query: &str, items: &[String]) -> Vec<String> {
    if query.is_empty() || query.len() > 200 {
        return vec![];
    }

    // regex::escape() escapes all regex metacharacters
    let escaped = regex::escape(query);
    let pattern = Regex::new(&format!("(?i){}", escaped)).unwrap();

    items.iter()
        .filter(|item| pattern.is_match(item))
        .cloned()
        .collect()
}
```

### Secure Code -- Avoid Regex Entirely for Search

For simple substring search, do not use regex at all. String containment checks are faster, safer, and simpler.

```typescript
// BEST: No regex needed for simple search
app.get("/search", (req, res) => {
  const query = (req.query.q as string || "").toLowerCase();

  if (!query || query.length > 200) {
    return res.status(400).json({ error: "Invalid query" });
  }

  // Simple string containment -- no regex, no ReDoS, no injection
  const results = items.filter(item =>
    item.name.toLowerCase().includes(query)
  );

  res.json(results);
});
```

---

## 11. Regex Security in WAF Rules

Web Application Firewalls (WAFs) use regex patterns to inspect HTTP traffic and block malicious requests. Because WAF regex patterns are evaluated on every request, they must be both correct and performant. A single vulnerable WAF regex can take down the entire infrastructure (as the Cloudflare incident demonstrated).

### Performance Considerations for WAF Regex

```
Rule 1: Use a DFA-based engine (RE2) for WAF regex evaluation.
        DFA engines guarantee linear-time matching and eliminate
        ReDoS entirely. ModSecurity supports RE2 via --with-pcre2
        configured with JIT. Cloudflare switched to RE2 after
        their 2019 outage.

Rule 2: Avoid nested quantifiers in WAF rules.
        VULNERABLE: (?:keyword1|keyword2|keyword3)+
        SAFE:       (?:keyword1|keyword2|keyword3)

Rule 3: Anchor patterns when possible.
        Unanchored patterns scan the entire request body.
        Anchored patterns (^...$) have a defined scope.
        Use \b word boundaries for keyword detection.

Rule 4: Prefer literal string matching over regex for exact matches.
        If you are looking for "admin" in a URL path, use string
        comparison, not regex.

Rule 5: Limit the scope of inspection.
        Apply regex only to specific request components (URI,
        headers, specific parameters), not the entire request body.

Rule 6: Test every WAF regex against pathological inputs before deployment.
        Use recheck or vuln-regex-detector to verify safety.

Rule 7: Set per-rule execution timeouts.
        Even with safe patterns, set a timeout as defense in depth.
        NGINX: pcre_jit on; with timeouts.
        ModSecurity: SecRuleEngine with per-rule timeout.
```

### WAF Regex Example -- SQL Injection Detection

```
# VULNERABLE WAF rule -- nested quantifiers
SecRule ARGS "@rx (?:(?:select|insert|update|delete|drop|union|exec)\s+)+" \
    "id:1001,phase:2,deny,status:403"

# The (\s+)+ at the end creates nested quantifiers.
# An attacker can send a long string of spaces to trigger ReDoS.

# SAFE WAF rule -- no nested quantifiers
SecRule ARGS "@rx \b(?:select|insert|update|delete|drop|union|exec)\b" \
    "id:1001,phase:2,deny,status:403"

# Uses word boundaries (\b) instead of \s+.
# No nested quantifiers. Linear-time matching.
```

### WAF Regex Example -- XSS Detection

```
# VULNERABLE: .* with nested groups
SecRule ARGS "@rx <script(.*?)>(.*?)</script>" \
    "id:1002,phase:2,deny,status:403"

# SAFE: Negated character classes, no nested quantifiers
SecRule ARGS "@rx <script[^>]*>[^<]*</script>" \
    "id:1002,phase:2,deny,status:403"

# Even safer: Use specific matchers instead of regex
SecRule ARGS "@contains <script" \
    "id:1002,phase:2,deny,status:403"
```

### Testing WAF Rules for ReDoS

```bash
# Test every WAF rule regex before deployment
# Extract patterns from ModSecurity rules and test them

#!/bin/bash
# Extract regex patterns from ModSecurity rule files
grep -oP '@rx\s+\K.*' /etc/modsecurity/rules/*.conf | while read -r pattern; do
    result=$(vuln-regex-detector --regex "$pattern" 2>&1)
    if echo "$result" | grep -q "VULNERABLE"; then
        echo "VULNERABLE RULE: $pattern"
        exit 1
    fi
done
echo "All WAF rules are safe"
```

---

## Best Practices

### 1. Use a Linear-Time Regex Engine by Default

Use RE2 (via `node-re2` in JavaScript, `google-re2` in Python) or a language with a built-in linear-time engine (Go, Rust). Linear-time engines eliminate ReDoS entirely by design. Only fall back to NFA engines when you need features that RE2 does not support (backreferences, lookaheads, lookbehinds). When you must use an NFA engine, apply all other mitigations: input length limits, timeouts, and pattern analysis.

### 2. Validate Input Length Before Regex Matching

Check `input.length` (or `len(input)`) before applying any regex. Reject inputs that exceed the maximum expected length for the field. Even a vulnerable regex cannot cause significant harm on a 64-character input. This is a zero-cost mitigation that protects against both known and unknown vulnerable patterns.

### 3. Never Use User Input in Regex Patterns Without Escaping

Always escape user-supplied strings before incorporating them into regex patterns. Use `escapeRegex()` in JavaScript, `re.escape()` in Python, `regexp.QuoteMeta()` in Go, `Pattern.quote()` in Java, `regex::escape()` in Rust. Better yet, use simple string methods (`includes`, `indexOf`, `contains`) instead of regex for user-driven search.

### 4. Ban Nested Quantifiers in Code Review

Establish a code review rule: reject any regex containing nested quantifiers. The patterns `(x+)+`, `(x*)*`, `(x+)*`, `(x*)+`, and `(x{n,m})+` are almost always vulnerable. If a nested quantifier is genuinely needed, require the author to prove safety with a regex analysis tool and document the justification.

### 5. Set Regex Execution Timeouts as Defense in Depth

Configure regex timeouts in every application, even when using safe patterns. In .NET, pass `TimeSpan` to the `Regex` constructor. In Java, use thread interruption with a `CharSequence` wrapper. In Node.js, use `vm.runInNewContext` with a timeout or use RE2. Timeouts catch regressions: a future code change might introduce a vulnerable pattern, and the timeout prevents it from becoming an outage.

### 6. Integrate Regex Linting Into CI

Add regex static analysis to your CI pipeline. Use `eslint-plugin-regexp` for JavaScript/TypeScript, `safe-regex` for npm, `recheck` for multi-language analysis, or `semgrep` with custom rules. Fail the build if a vulnerable pattern is detected. This catches issues before they reach production.

### 7. Use Dedicated Parsers Instead of Regex for Structured Data

Do not use regex to validate emails, URLs, dates, HTML, XML, JSON, CSV, or any other structured format. Use the standard library parser or a dedicated validation library. Parsers are correct by construction (they implement the specification), and they cannot cause ReDoS. See [Section 9](#9-input-validation-without-regex) for specific alternatives.

### 8. Prefer Specific Character Classes Over Dot-Star

Replace `.*` with negated character classes that match only expected characters. Use `[^@]+` instead of `.+` for the local part of an email. Use `[^>]*` instead of `.*` inside HTML tags. Use `[^\s]+` instead of `.+` for tokens. Specific character classes create unambiguous matching paths that prevent backtracking.

### 9. Test Regex Patterns With Adversarial Inputs

Before deploying any regex pattern, test it with inputs specifically designed to trigger backtracking. For a pattern matching `x` characters, test with a string of 30+ `x` characters followed by a non-matching character. Measure execution time. If execution time grows non-linearly with input length, the pattern is vulnerable. Automate this testing in your test suite.

### 10. Document the Purpose and Safety of Every Regex

Every regex pattern in production code should have a comment explaining what it matches, why it is safe from ReDoS, and what the maximum expected input length is. Undocumented regex patterns become technical debt that is expensive to audit later. If a pattern is complex enough to need a comment, consider whether a parser would be a better choice.

---

## Anti-Patterns

### 1. Assuming Short Patterns Are Safe

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Believing that a regex is safe because it is short or "simple" (e.g., `(a+)+`) | Short patterns can still exhibit exponential backtracking. The pattern `(a+)+` is only 6 characters but causes 2^n backtracking steps | Analyze every pattern for nested quantifiers and overlapping alternations, regardless of length. Use a regex linting tool |

### 2. Using Complex Regex for Input Validation Instead of Parsers

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Writing a 500-character regex to validate email addresses or URLs | The regex is both incorrect (fails edge cases) and vulnerable to ReDoS (contains nested quantifiers from trying to be comprehensive) | Use a dedicated parser. `new URL()` for URLs, `email-validator` for emails, `Date.parse()` for dates. Parsers are correct and safe |

### 3. Constructing Regex from User Input Without Escaping

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Using `new RegExp(userInput)` or `re.compile(userInput)` with raw user input | Attacker injects regex metacharacters to cause ReDoS (`(a+)+$`) or bypass validation (`.*`) | Always escape user input with the language's regex escaping function. Better yet, use string methods instead of regex for user-driven search |

### 4. Relying on Regex Flags to Prevent ReDoS

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Believing that non-greedy (`?`), case-insensitive (`i`), or multiline (`m`) flags prevent ReDoS | Regex flags do not change the fundamental backtracking behavior of the engine. Non-greedy quantifiers still backtrack; they just start from the other end | Use a linear-time engine (RE2) or restructure the pattern to eliminate nested quantifiers |

### 5. Testing Regex Only With Matching Inputs

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Testing that a regex correctly matches valid inputs but never testing with adversarial or non-matching inputs | ReDoS occurs on non-matching inputs, not matching ones. The regex performs well on valid data but hangs on crafted invalid data | Always test with adversarial inputs: long strings of matching characters followed by a non-matching character. Measure execution time |

### 6. No Timeout on Regex Operations

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Executing regex without any timeout, relying on the pattern being "safe enough" | A future code change introduces a vulnerable pattern, or a dependency upgrade changes regex behavior, and the application hangs in production | Always set regex timeouts. Use .NET's `TimeSpan`, Java's thread interruption, Node.js `vm.runInNewContext`, or switch to RE2 |

### 7. Applying WAF Regex Rules Without ReDoS Testing

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Adding regex-based WAF rules without testing them for ReDoS vulnerability | The WAF rule itself becomes a denial-of-service vector. Attacker sends crafted input that matches the WAF rule's vulnerable pattern, consuming CPU on every edge server | Test every WAF regex with `recheck` or `vuln-regex-detector` before deployment. Use a DFA engine (RE2) for WAF rule evaluation |

### 8. Ignoring Regex Vulnerabilities in Dependencies

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Assuming that regex vulnerabilities in npm/pip/Maven dependencies are not exploitable in your application | If user-controlled input reaches the vulnerable regex in the dependency (e.g., a User-Agent parser, URL normalizer, or CSS selector engine), the vulnerability is exploitable | Audit dependencies for known ReDoS CVEs. Use `npm audit`, `pip audit`, `snyk test`. Update dependencies promptly when ReDoS fixes are released |

---

## Enforcement Checklist

### Regex Pattern Safety
- [ ] All regex patterns in the codebase have been analyzed for nested quantifiers
- [ ] No pattern contains `(x+)+`, `(x*)*`, `(x+)*`, or `(x*)+` constructs
- [ ] No pattern contains overlapping alternations with quantifiers (e.g., `(a|aa)+`)
- [ ] All `.*` and `.+` usages have been reviewed and replaced with specific character classes where possible
- [ ] Regex patterns used in hot paths (request handling, middleware, WAF) are verified safe with a linting tool

### Input Length Enforcement
- [ ] Every endpoint that applies regex to user input enforces a maximum input length
- [ ] Maximum lengths are documented and appropriate for the field type (username: 64, email: 254, URL: 2048)
- [ ] Length checks are performed before regex evaluation, not after

### Regex Engine Selection
- [ ] The project uses RE2 or a DFA-based engine where possible (`node-re2`, `google-re2`, Go `regexp`, Rust `regex`)
- [ ] If an NFA engine is required (for backreferences/lookaheads), the justification is documented
- [ ] NFA engine usage is accompanied by both input length limits and execution timeouts

### Regex Timeout Configuration
- [ ] Regex execution timeouts are configured for all NFA-based regex operations
- [ ] .NET applications pass `TimeSpan` to the `Regex` constructor or set `REGEX_DEFAULT_MATCH_TIMEOUT`
- [ ] Java applications use interruptible `CharSequence` wrappers or thread-based timeouts
- [ ] Node.js applications use RE2 or `vm.runInNewContext` with timeout for untrusted patterns
- [ ] Timeout values are set to a maximum of 2 seconds for request-path regex

### Regex Injection Prevention
- [ ] No `RegExp(userInput)`, `re.compile(userInput)`, or equivalent exists without escaping
- [ ] All user input incorporated into regex patterns is escaped with the language's escaping function
- [ ] Search functionality uses string methods (`includes`, `indexOf`) instead of regex where possible

### CI/CD Integration
- [ ] `eslint-plugin-regexp` (or equivalent) is configured with `no-super-linear-backtracking` set to error
- [ ] `safe-regex` or `recheck` runs in CI on every pull request
- [ ] WAF rule changes include automated ReDoS testing before deployment
- [ ] Semgrep or CodeQL rules detect regex injection patterns (`new RegExp(userInput)`)

### Dependency Management
- [ ] Dependencies are scanned for known ReDoS CVEs (`npm audit`, `pip audit`, `snyk`)
- [ ] ReDoS advisories trigger immediate dependency updates (treat as severity: high)
- [ ] User-Agent parsers, URL normalizers, and HTML sanitizers are reviewed for regex safety

### Structured Data Validation
- [ ] Email validation uses a parsing library, not a custom regex
- [ ] URL validation uses the standard library URL parser (`new URL()`, `url.parse()`, `net/url`)
- [ ] Date validation uses a date parsing library, not regex
- [ ] HTML sanitization uses a DOM-based sanitizer (DOMPurify, Bleach), not regex
- [ ] JSON and XML parsing uses standard library parsers with safe configurations

### Documentation and Code Review
- [ ] Every regex pattern in production code has a comment explaining its purpose and safety
- [ ] Code review guidelines include regex safety as a mandatory check item
- [ ] Patterns flagged by reviewers are tested with adversarial inputs before approval
- [ ] Maximum input lengths are documented alongside regex patterns

---

## CWE and CVE Reference Map

| Vulnerability | CWE | Related CVEs |
|--------------|------|-------------|
| ReDoS (Regular Expression Denial of Service) | CWE-1333 | CVE-2021-27292, CVE-2021-23364, CVE-2021-33502, CVE-2021-3803, CVE-2020-28469 |
| Regex Injection | CWE-730, CWE-185 | Application-specific |
| Uncontrolled Resource Consumption (via regex) | CWE-400 | CVE-2023-26920, CVE-2022-25858 |
| Improper Input Validation (regex bypass) | CWE-20 | Application-specific |
