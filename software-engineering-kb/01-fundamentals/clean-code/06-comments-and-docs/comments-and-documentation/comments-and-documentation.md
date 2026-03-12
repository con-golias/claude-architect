# Comments and Documentation

> **Domain:** Fundamentals > Clean Code > Comments and Documentation
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Robert C. Martin's Chapter 4 of *Clean Code* opens with a provocative stance:

> "The proper use of comments is to compensate for our failure to express ourselves in code. Comments are always failures."

This doesn't mean never write comments. It means **code should be self-explanatory first**, and comments should only exist when the code alone cannot convey intent.

### Good Comments (Acceptable)

1. **Legal comments:** Copyright, license headers.
2. **Informative comments:** Explaining return value of an abstract method.
3. **Explanation of intent:** "We use this algorithm because it handles edge case X."
4. **Clarification:** When working with opaque third-party code.
5. **Warning of consequences:** "This test takes 10 minutes to run."
6. **TODO comments:** Temporary markers for known improvements (with a plan to address them).
7. **Amplification:** Emphasizing importance of something that might seem trivial.

### Bad Comments (Code Smells)

1. **Mumbling:** Unclear, half-formed thoughts.
2. **Redundant comments:** Restating what the code already says.
3. **Misleading comments:** Inaccurate descriptions of behavior.
4. **Mandated comments:** Javadoc on every function regardless of need.
5. **Journal comments:** Changelog in the file (use version control instead).
6. **Noise comments:** `// Default constructor` above a default constructor.
7. **Position markers:** `// ====== GETTERS ======`
8. **Commented-out code:** Dead code in comments — delete it, version control remembers.

## Why It Matters

Comments lie. Code doesn't. Comments aren't maintained with the same rigor as code — they rot. Misleading comments are worse than no comments because they actively deceive readers.

## How It Works

### Redundant Comments

```java
// BAD: Comment adds nothing
// Check if the user is active
if (user.isActive()) {
    // Process the active user
    processActiveUser(user);
}

// GOOD: Code speaks for itself — no comment needed
if (user.isActive()) {
    processActiveUser(user);
}
```

### Replace Comment with Better Code

```typescript
// BAD: Comment compensates for bad naming
// Check if employee is eligible for full benefits
if (employee.flags & 0x02 && employee.age > 65) { ... }

// GOOD: Extract to a well-named function
if (employee.isEligibleForFullBenefits()) { ... }
```

### When Comments ARE Valuable

```python
# GOOD: Explains WHY, not what
# We use binary search here because the dataset is sorted and
# contains up to 10M records. Linear search exceeded our 100ms SLA.
index = bisect.bisect_left(sorted_records, target)

# GOOD: Warning of consequences
# WARNING: This regex handles 99.9% of email formats per RFC 5322.
# Do NOT simplify it — the previous "simple" regex caused 200+ support tickets.
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
```

## Best Practices

1. **Don't comment bad code — rewrite it.** If you feel the need to comment, first try to express the same thing through better naming, extraction, or structure.
2. **Comments should explain WHY, not WHAT.** The code tells you what happens; comments should explain why it happens that way.
3. **Delete commented-out code.** Git remembers everything.
4. **Treat TODO as temporary.** Enforce TODO cleanup through linter rules or periodic review.
5. **Keep JSDoc/docstrings for public APIs.** Library functions, API endpoints, and framework hooks deserve documentation.

## Anti-patterns / Common Mistakes

- **Comment decay:** Comments written 3 years ago that no longer match the code.
- **Apologetic comments:** `// Sorry, this is a hack` — fix the hack instead.
- **Commented-out code hoarding:** Files with 50% comments of old code "just in case."

## Sources

- Martin, R.C. (2008). *Clean Code*. Chapter 4: Comments.
- [Best Practices for Code Documentation (pullchecklist.com)](https://www.pullchecklist.com/posts/code-documentation-best-practices)
