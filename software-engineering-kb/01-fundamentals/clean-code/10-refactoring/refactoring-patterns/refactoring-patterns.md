# Refactoring Patterns at Scale

> **Domain:** Fundamentals > Clean Code > Refactoring
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Large-scale refactoring goes beyond individual functions and classes to restructure entire systems. These patterns allow safe, incremental transformation of legacy systems.

## How It Works

### Strangler Fig Pattern (Martin Fowler)

Gradually replace a legacy system by routing new functionality to a new system while the old one continues to serve existing features. Over time, the new system "strangles" the old one.

```
         ┌──────────────┐
Request → │   Router/    │ → New System (growing)
         │   Proxy      │ → Legacy System (shrinking)
         └──────────────┘
```

### Branch by Abstraction

Replace a dependency by introducing an abstraction layer, then swapping implementations behind it:
1. Create an abstraction (interface) for the component to replace.
2. Point existing code to the abstraction.
3. Create the new implementation.
4. Switch the abstraction to use the new implementation.
5. Remove the old implementation.

### Mikado Method

For large, tangled refactorings where you can't see the full dependency graph:
1. Set a goal (e.g., "Extract Payment module").
2. Try the change — it will break things.
3. Record what broke in a "Mikado Graph."
4. Revert the change.
5. Fix the leaf dependencies first, then retry.

### Working with Legacy Code (Michael Feathers)

Key patterns for code without tests:
- **Characterization Tests:** Write tests that document current behavior (even if it's "wrong").
- **Seam:** A place where you can alter behavior without editing the code (e.g., dependency injection point).
- **Sprout Method/Class:** Add new functionality in a new, tested method/class instead of modifying untested legacy code.

## Best Practices

1. **Never refactor without tests.** For legacy code, write characterization tests first.
2. **Prefer incremental migration** (Strangler Fig) over big-bang rewrites.
3. **Use feature flags** to safely switch between old and new implementations.
4. **Make refactoring changes in separate PRs** from feature work.
5. **Measure progress** — track the ratio of legacy vs. new code over time.

## Sources

- Fowler, M. (2004). "StranglerFigApplication." (Blog post)
- Feathers, M. (2004). *Working Effectively with Legacy Code*. Prentice Hall.
- Ellnestam, O. & Brolund, D. (2012). *The Mikado Method*. Manning.
