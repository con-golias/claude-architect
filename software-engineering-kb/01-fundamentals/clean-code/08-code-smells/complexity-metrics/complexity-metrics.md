# Complexity Metrics

> **Domain:** Fundamentals > Clean Code > Code Smells
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Complexity metrics are quantitative measures of how difficult code is to understand, test, and maintain. They provide objective data to complement subjective code reviews.

### Key Metrics

**Cyclomatic Complexity (Thomas McCabe, 1976):** Counts the number of independent paths through a function. Each `if`, `else`, `for`, `while`, `case`, `&&`, `||` adds 1 to the count.

| Score | Risk Level | Action |
|-------|-----------|--------|
| 1-10 | Low | Simple, well-tested |
| 11-20 | Moderate | Consider refactoring |
| 21-50 | High | Must refactor |
| 50+ | Very High | Untestable — rewrite |

**Cognitive Complexity (SonarSource, 2016):** A newer metric designed to better match human perception of complexity. Unlike cyclomatic complexity, it penalizes **nesting** more heavily and rewards linear flow structures.

```typescript
// Cyclomatic = 4, Cognitive = 7 (nesting adds extra weight)
function processOrder(order: Order) {
  if (order.isPaid) {                    // +1 cyclomatic, +1 cognitive
    for (const item of order.items) {    // +1 cyclomatic, +2 cognitive (nesting)
      if (item.needsShipping) {          // +1 cyclomatic, +3 cognitive (nesting)
        shipItem(item);
      }
    }
  } else {                              // +1 cyclomatic, +1 cognitive
    sendPaymentReminder(order);
  }
}
```

**LCOM (Lack of Cohesion of Methods):** Measures how related the methods of a class are. High LCOM = low cohesion = the class should be split.

**Lines of Code (LOC):** Simple but useful. Function LOC > 20 is a smell; file LOC > 500 is a smell.

### Measurement Tools

| Tool | Languages | Metrics |
|------|-----------|---------|
| SonarQube | 30+ languages | Cognitive complexity, duplication, maintainability rating |
| CodeClimate | Many | Cognitive complexity, duplication, churn |
| ESLint (complexity rule) | JS/TS | Cyclomatic complexity per function |
| Radon | Python | Cyclomatic complexity, maintainability index |
| NDepend | .NET | All OO metrics + custom queries |

## Why It Matters

"You can't improve what you can't measure." Complexity metrics provide early warning signals and quality gates that prevent code from degrading.

## Best Practices

1. **Set complexity thresholds** in your linter: max cyclomatic complexity of 10-15 per function.
2. **Track trends, not absolute numbers.** Is complexity going up or down over time?
3. **Use quality gates in CI.** Block PRs that introduce functions above the complexity threshold.
4. **Focus on cognitive complexity** over cyclomatic — it better matches human perception.
5. **Combine metrics.** No single metric tells the full story. Use complexity + coverage + duplication together.

## Sources

- McCabe, T. (1976). "A Complexity Measure." IEEE Transactions on Software Engineering.
- [SonarSource — Cognitive Complexity](https://www.sonarsource.com/resources/cognitive-complexity/)
- [Code Smells Catalog (luzkan.github.io)](https://luzkan.github.io/smells/)
