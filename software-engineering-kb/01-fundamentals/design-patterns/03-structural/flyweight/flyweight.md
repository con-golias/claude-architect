# Flyweight Pattern

> **Domain:** Fundamentals > Design Patterns > Structural
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

The Flyweight pattern reduces memory usage by **sharing common state** (intrinsic state) across many objects, while keeping unique state (extrinsic state) separate. Instead of creating millions of similar objects, you create a few shared flyweight objects and pass the varying data as method parameters.

**GoF Intent:** "Use sharing to support large numbers of fine-grained objects efficiently."

## How It Works

```
Without Flyweight: 10,000 tree objects × full data each = massive memory
With Flyweight:    5 TreeType flyweights + 10,000 lightweight positions = minimal memory

Intrinsic state (shared):   tree type, texture, color
Extrinsic state (unique):   x, y position of each tree instance
```

```typescript
// Flyweight — shared intrinsic state
class TreeType {
  constructor(
    public name: string,
    public color: string,
    public texture: string   // large texture data
  ) {}

  draw(x: number, y: number): void {
    console.log(`Drawing ${this.name} at (${x}, ${y})`);
  }
}

// Flyweight Factory — ensures sharing
class TreeFactory {
  private static types = new Map<string, TreeType>();

  static getTreeType(name: string, color: string, texture: string): TreeType {
    const key = `${name}-${color}`;
    if (!this.types.has(key)) {
      this.types.set(key, new TreeType(name, color, texture));
    }
    return this.types.get(key)!;
  }
}

// Context — stores extrinsic state
class Tree {
  constructor(
    private x: number,
    private y: number,
    private type: TreeType   // shared reference
  ) {}

  draw(): void {
    this.type.draw(this.x, this.y);
  }
}

// Forest — uses flyweights
class Forest {
  private trees: Tree[] = [];

  plantTree(x: number, y: number, name: string, color: string, texture: string): void {
    const type = TreeFactory.getTreeType(name, color, texture);  // shared
    this.trees.push(new Tree(x, y, type));
  }
}

// Plant 1,000,000 trees but only 3 TreeType objects exist in memory
const forest = new Forest();
for (let i = 0; i < 1_000_000; i++) {
  forest.plantTree(Math.random() * 1000, Math.random() * 1000, "Oak", "green", "oak.png");
}
```

## Best Practices

1. **Separate intrinsic from extrinsic state** — intrinsic = shared and immutable; extrinsic = unique per instance.
2. **Use a factory to manage flyweights** — ensures objects are shared, not duplicated.
3. **Make flyweights immutable** — shared state must not be modified.

## Real-world Examples

- **Java String interning** — `String.intern()` shares identical string objects.
- **Integer caching** — Java caches `Integer` objects from -128 to 127.
- **Browser DOM** — CSS classes are flyweights shared across elements.
- **Game engines** — texture/sprite sharing for rendering thousands of similar objects.
- **Font rendering** — glyph objects shared across all text with the same font.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 195-206.
- [Refactoring.Guru — Flyweight](https://refactoring.guru/design-patterns/flyweight)
