# Visitor Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

The Visitor pattern lets you **add new operations to existing object structures without modifying them**. It separates an algorithm from the object structure it operates on by placing the algorithm in a separate visitor class. Each element "accepts" a visitor, which then performs the operation.

**GoF Intent:** "Represent an operation to be performed on the elements of an object structure. Visitor lets you define a new operation without changing the classes of the elements on which it operates."

## How It Works

```typescript
// Element hierarchy (stable — rarely changes)
interface ASTNode {
  accept(visitor: ASTVisitor): any;
}

class NumberNode implements ASTNode {
  constructor(public value: number) {}
  accept(visitor: ASTVisitor) { return visitor.visitNumber(this); }
}

class BinaryOpNode implements ASTNode {
  constructor(public op: string, public left: ASTNode, public right: ASTNode) {}
  accept(visitor: ASTVisitor) { return visitor.visitBinaryOp(this); }
}

// Visitor interface (new operations added here)
interface ASTVisitor {
  visitNumber(node: NumberNode): any;
  visitBinaryOp(node: BinaryOpNode): any;
}

// Concrete visitors — each is a new operation
class Evaluator implements ASTVisitor {
  visitNumber(node: NumberNode) { return node.value; }
  visitBinaryOp(node: BinaryOpNode) {
    const left = node.left.accept(this);
    const right = node.right.accept(this);
    switch (node.op) {
      case "+": return left + right;
      case "*": return left * right;
    }
  }
}

class PrettyPrinter implements ASTVisitor {
  visitNumber(node: NumberNode) { return `${node.value}`; }
  visitBinaryOp(node: BinaryOpNode) {
    return `(${node.left.accept(this)} ${node.op} ${node.right.accept(this)})`;
  }
}

// Usage — add operations without modifying AST classes
const ast = new BinaryOpNode("+", new NumberNode(3), new NumberNode(4));
new Evaluator().visitBinaryOp(ast);        // 7
new PrettyPrinter().visitBinaryOp(ast);    // "(3 + 4)"
```

### When to Use Visitor (Double Dispatch)

```
                   add new        add new
                   elements       operations
─────────────────────────────────────────────
Visitor:           Hard           Easy ✓
Type switch:       Easy ✓         Hard

Use Visitor when:  element types are stable, operations change frequently
Use switch when:   operations are stable, element types change frequently
```

## Real-world Examples

- **Compiler AST processing** — type checking, optimization, code generation as different visitors.
- **DOM traversal** — `TreeWalker`, `NodeFilter` walk the DOM applying operations.
- **`java.nio.file.FileVisitor`** — walk a file tree with custom actions.
- **Babel/ESLint** — AST visitors for code transformation and linting.
- **Antlr** — parser generator produces visitor interfaces for language processing.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 331-344.
- [Refactoring.Guru — Visitor](https://refactoring.guru/design-patterns/visitor)
