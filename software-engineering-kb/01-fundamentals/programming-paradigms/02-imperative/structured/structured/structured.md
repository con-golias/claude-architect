# Structured Programming

> **Domain:** Fundamentals > Programming Paradigms > Imperative
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

Structured programming is a paradigm that restricts control flow to **three fundamental structures: sequence, selection, and iteration** — eliminating the need for `goto` statements. The Böhm-Jacopini theorem (1966) proved that any computable function can be expressed using only these three structures.

**Historical Context:** In 1968, Edsger Dijkstra published *"Go To Statement Considered Harmful"*, arguing that `goto` creates "spaghetti code" with untraceable control flow. This letter launched the structured programming movement and fundamentally changed how software is written.

## How It Works

### The Three Control Structures

```c
// 1. SEQUENCE — statements execute in order
int x = 5;
int y = x * 2;
printf("%d\n", y);   // 10

// 2. SELECTION — branching based on conditions
if (temperature > 100) {
    printf("Boiling\n");
} else if (temperature > 0) {
    printf("Liquid\n");
} else {
    printf("Frozen\n");
}

// switch/case — multi-way selection
switch (day) {
    case 1: printf("Monday\n");    break;
    case 2: printf("Tuesday\n");   break;
    default: printf("Other day\n"); break;
}

// 3. ITERATION — loops
// for loop — known iterations
for (int i = 0; i < 10; i++) {
    printf("%d ", i);
}

// while loop — condition-based
while (fgets(line, sizeof(line), file)) {
    process_line(line);
}

// do-while — at least one iteration
do {
    input = get_user_input();
} while (!is_valid(input));
```

### Unstructured vs Structured

```c
// UNSTRUCTURED (goto-based) — hard to follow
    i = 0;
loop:
    if (i >= n) goto done;
    if (arr[i] < 0) goto skip;
    sum += arr[i];
skip:
    i++;
    goto loop;
done:
    printf("Sum: %d\n", sum);

// STRUCTURED — same logic, immediately clear
int sum = 0;
for (int i = 0; i < n; i++) {
    if (arr[i] >= 0) {
        sum += arr[i];
    }
}
printf("Sum: %d\n", sum);
```

```python
# Python — structured by design (no goto exists)
def find_first_match(items: list, predicate) -> int:
    """Structured search with single entry, single exit."""
    result = -1
    for i, item in enumerate(items):
        if predicate(item):
            result = i
            break           # structured exit from loop
    return result

# Nested structures remain readable
def process_matrix(matrix: list[list[int]]) -> list[int]:
    results = []
    for row in matrix:               # iteration
        row_sum = 0
        for val in row:              # nested iteration
            if val > 0:              # selection
                row_sum += val       # sequence
        results.append(row_sum)
    return results
```

### Structured Programming Principles

```
1. Single entry, single exit   — each block has one way in and one way out
2. No goto                     — use loops, conditionals, and functions instead
3. Top-down decomposition      — break complex problems into smaller functions
4. Block structure             — code organized in nested blocks with clear scope
5. Local variables             — minimize global state

Modern exceptions to "single exit":
  - Early returns (guard clauses) are widely accepted
  - break/continue in loops are considered structured
  - Exception handling (try/catch) is structured error flow
```

## Real-world Impact

- **All modern languages** are structured by default — Python, Java, JavaScript, Go, Rust.
- **Code reviews** flag goto usage in C/C++ (still available but discouraged).
- **Cyclomatic complexity** metrics measure structured control flow branching.
- **Linters** enforce structured patterns (no-fallthrough in switch, early returns).

## Sources

- Dijkstra, E.W. (1968). "Go To Statement Considered Harmful." *Communications of the ACM*, 11(3), 147-148.
- Böhm, C. & Jacopini, G. (1966). "Flow diagrams, Turing machines and languages with only two formation rules." *Communications of the ACM*, 9(5), 366-371.
- Dahl, O.-J., Dijkstra, E.W. & Hoare, C.A.R. (1972). *Structured Programming*. Academic Press.
