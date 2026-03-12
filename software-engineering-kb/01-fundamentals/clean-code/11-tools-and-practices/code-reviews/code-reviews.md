# Code Reviews

> **Domain:** Fundamentals > Clean Code > Tools and Practices
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Code review is the systematic examination of source code by peers to find defects, improve quality, and share knowledge. Google's engineering practices document states:

> "A code review is a process where someone other than the author of a piece of code examines that code."

At Google, **every change** must be reviewed before merging. Microsoft, Meta, and most major tech companies follow similar practices.

## Why It Matters

- **Bug detection:** Code reviews catch **60-70% of defects** (studies by Fagan, IBM).
- **Knowledge sharing:** Reviews spread understanding across the team.
- **Code quality:** The knowledge that code will be reviewed raises the bar.
- **Mentoring:** Junior developers learn from senior reviewers' feedback.

## How It Works

### What to Look For

1. **Correctness:** Does the code do what it's supposed to?
2. **Design:** Is the code well-structured? Does it follow SOLID principles?
3. **Readability:** Can you understand the code without the author explaining it?
4. **Tests:** Are there adequate tests? Do they test the right things?
5. **Security:** Any injection, XSS, or authentication vulnerabilities?
6. **Performance:** Any obvious performance issues (N+1 queries, unnecessary loops)?
7. **Naming:** Are names intention-revealing and consistent?

### Small PRs

Google's guidelines recommend **small, focused PRs**:
- ~200 lines of code changes is ideal
- One logical change per PR
- Large changes should be split into a chain of smaller PRs

### Ship/Show/Ask Model

| Type | Description | Review Required? |
|------|-------------|-----------------|
| **Ship** | Trivial changes (typos, config) | No — merge directly |
| **Show** | Straightforward changes | Merge, notify for FYI |
| **Ask** | Complex or risky changes | Full review required |

### Giving Feedback

```markdown
# BAD review comment:
"This is wrong."

# GOOD review comment:
"Consider using `Map` instead of `Object` here — it handles
non-string keys and has better iteration performance. See:
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map"
```

Rules for reviewers:
- **Critique the code, not the person.** "This code could be simpler" not "You wrote this badly."
- **Ask questions before demanding changes.** "What was the reason for this approach?"
- **Suggest, don't dictate.** "Consider..." not "Change this to..."
- **Acknowledge good work.** "Nice use of the strategy pattern here!"

## Best Practices

1. **Review within 24 hours.** Long review queues kill productivity.
2. **Keep PRs small.** Under 400 lines. Anything larger gets superficial review.
3. **Use automated checks first.** Linters, formatters, and tests should pass before human review.
4. **Use checklists** for common issues (security, error handling, test coverage).
5. **Do pair programming** for complex changes — real-time review is faster than async.

## Anti-patterns / Common Mistakes

- **Rubber-stamping:** Approving without reading. Dangerous and dishonest.
- **Nitpicking style:** If it's not caught by linters, it probably doesn't matter.
- **Gatekeeping:** Using reviews as power plays rather than collaborative improvement.
- **Review queue buildup:** PRs waiting days for review — destroys flow.

## Sources

- [Google's Code Review Guidelines](https://google.github.io/eng-practices/review/)
- [Software Engineering at Google — Chapter 9](https://abseil.io/resources/swe-book/html/ch08.html)
- [How Google Writes Clean, Maintainable Code](https://read.engineerscodex.com/p/how-google-writes-clean-maintainable)
