# Interpreter Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

The Interpreter pattern defines a **grammar for a language** and provides an interpreter that uses the grammar to interpret sentences in that language. It represents each rule in the grammar as a class, building an abstract syntax tree (AST) that can be evaluated.

**GoF Intent:** "Given a language, define a representation for its grammar along with an interpreter that uses the representation to interpret sentences in the language."

## How It Works

```typescript
// Expression interface (AST node)
interface Expression {
  interpret(context: Map<string, number>): number;
}

// Terminal expressions
class NumberExpression implements Expression {
  constructor(private value: number) {}
  interpret(): number { return this.value; }
}

class VariableExpression implements Expression {
  constructor(private name: string) {}
  interpret(context: Map<string, number>): number {
    return context.get(this.name) || 0;
  }
}

// Non-terminal expressions
class AddExpression implements Expression {
  constructor(private left: Expression, private right: Expression) {}
  interpret(context: Map<string, number>): number {
    return this.left.interpret(context) + this.right.interpret(context);
  }
}

class MultiplyExpression implements Expression {
  constructor(private left: Expression, private right: Expression) {}
  interpret(context: Map<string, number>): number {
    return this.left.interpret(context) * this.right.interpret(context);
  }
}

// Usage: (x + 5) * 2
const expr = new MultiplyExpression(
  new AddExpression(
    new VariableExpression("x"),
    new NumberExpression(5)
  ),
  new NumberExpression(2)
);

const context = new Map([["x", 10]]);
expr.interpret(context);  // (10 + 5) * 2 = 30
```

## Real-world Examples

- **SQL parsers** — SQL statements parsed into an AST and interpreted.
- **Regular expressions** — regex engines use the interpreter pattern internally.
- **Math expression evaluators** — calculator apps, spreadsheet formula engines.
- **Configuration DSLs** — Gradle, Terraform, Ansible use custom languages.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 243-255.
- [Refactoring.Guru — Interpreter](https://refactoring.guru/design-patterns/interpreter)
