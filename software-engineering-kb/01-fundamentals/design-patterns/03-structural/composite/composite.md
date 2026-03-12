# Composite Pattern

> **Domain:** Fundamentals > Design Patterns > Structural
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Composite pattern composes objects into **tree structures** and lets clients treat individual objects and compositions uniformly. A single leaf and a group of objects respond to the same interface — enabling recursive tree structures.

**GoF Intent:** "Compose objects into tree structures to represent part-whole hierarchies. Composite lets clients treat individual objects and compositions of objects uniformly."

## How It Works

```typescript
// Component interface
interface FileSystemItem {
  getName(): string;
  getSize(): number;
  display(indent: string): void;
}

// Leaf
class File implements FileSystemItem {
  constructor(private name: string, private size: number) {}

  getName() { return this.name; }
  getSize() { return this.size; }
  display(indent = "") { console.log(`${indent}📄 ${this.name} (${this.size}KB)`); }
}

// Composite
class Directory implements FileSystemItem {
  private children: FileSystemItem[] = [];

  constructor(private name: string) {}

  add(item: FileSystemItem): void { this.children.push(item); }
  remove(item: FileSystemItem): void {
    this.children = this.children.filter(c => c !== item);
  }

  getName() { return this.name; }
  getSize() { return this.children.reduce((sum, c) => sum + c.getSize(), 0); }
  display(indent = "") {
    console.log(`${indent}📁 ${this.name} (${this.getSize()}KB)`);
    this.children.forEach(c => c.display(indent + "  "));
  }
}

// Usage — uniform treatment
const root = new Directory("project");
const src = new Directory("src");
src.add(new File("index.ts", 5));
src.add(new File("app.ts", 12));
root.add(src);
root.add(new File("README.md", 2));

root.display();
// 📁 project (19KB)
//   📁 src (17KB)
//     📄 index.ts (5KB)
//     📄 app.ts (12KB)
//   📄 README.md (2KB)

root.getSize();  // 19 — works on individual files AND directories
```

## Best Practices

1. **Use for tree structures** — file systems, UI component trees, organizational charts.
2. **Define operations on the component interface** — both leaves and composites implement the same methods.
3. **Consider the Visitor pattern** for adding operations without modifying the tree.

## Real-world Examples

- **React component tree** — components contain other components.
- **DOM** — `Node` can be an `Element` or a `Text` node, both respond to the same interface.
- **Graphics editors** — shapes grouped into compound shapes that can be moved/resized as one.
- **Menu systems** — menu items can be individual actions or submenus.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 163-173.
- [Refactoring.Guru — Composite](https://refactoring.guru/design-patterns/composite)
