# When to Refactor

> **Domain:** Fundamentals > Clean Code > Refactoring
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Knowing **when** to refactor is as important as knowing **how**. Martin Fowler describes the "Two Hats" metaphor: at any moment you're either **adding functionality** (feature hat) or **restructuring code** (refactoring hat). Never do both simultaneously.

### Types of Refactoring Triggers

- **Preparatory Refactoring:** "Let me restructure this before adding the feature — it'll make the feature easier."
- **Comprehension Refactoring:** "I don't understand this code. Let me clean it up so I do."
- **Litter-Pickup Refactoring:** "This isn't great, but I can make it slightly better while I'm here." (Boy Scout Rule)
- **Planned Refactoring:** Dedicated time in a sprint to address technical debt.

### The Rule of Three

> "The first time you do something, just do it. The second time, wince at the duplication. The third time, refactor." — Don Roberts

## When NOT to Refactor

- **Near a hard deadline.** The risk of breaking something outweighs the benefit.
- **The code works and will never change.** If nobody will ever touch it again, leave it.
- **A rewrite is more appropriate.** If the code is so bad that restructuring is harder than starting over.
- **No tests exist.** Write characterization tests first, then refactor.

## How to Get Buy-In

1. **Don't ask for permission to refactor.** Just do it as part of normal development (preparatory/litter-pickup).
2. **For larger efforts, frame it as risk reduction.** "This area has 5x the bug rate of the rest of the codebase."
3. **Track the cost of not refactoring.** "We spent 3 days debugging because of this tangled code."
4. **Allocate 15-20% of each sprint** for continuous improvement (Google's approach).

## Sources

- Fowler, M. (2018). *Refactoring* (2nd ed.). Chapter 2: Principles in Refactoring.
- Martin, R.C. (2008). *Clean Code*. The Boy Scout Rule.
