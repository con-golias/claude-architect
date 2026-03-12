# Bridge Pattern

> **Domain:** Fundamentals > Design Patterns > Structural
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

The Bridge pattern decouples an **abstraction from its implementation** so that both can vary independently. Instead of one class hierarchy where abstraction and implementation are mixed, you create two separate hierarchies connected by a "bridge" (composition).

**GoF Intent:** "Decouple an abstraction from its implementation so that the two can vary independently."

## Why It Matters

- **Avoids class explosion** — without Bridge, combining M abstractions with N implementations requires M×N classes. With Bridge: M + N.
- **Runtime implementation swapping** — change the implementation without modifying the abstraction.
- **Platform independence** — separate platform-specific code from business logic.

## How It Works

```
Without Bridge (class explosion):        With Bridge (composition):
Shape                                    Shape (has renderer)
├── CircleOpenGL                          ├── Circle
├── CircleDirectX                         └── Square
├── CircleVulkan
├── SquareOpenGL                         Renderer (interface)
├── SquareDirectX                         ├── OpenGLRenderer
└── SquareVulkan                          ├── DirectXRenderer
                                          └── VulkanRenderer
6 classes                                5 classes (and extensible)
```

```typescript
// Implementation hierarchy
interface Renderer {
  renderCircle(radius: number): void;
  renderSquare(side: number): void;
}

class SVGRenderer implements Renderer {
  renderCircle(r: number) { console.log(`<circle r="${r}" />`); }
  renderSquare(s: number) { console.log(`<rect width="${s}" height="${s}" />`); }
}

class CanvasRenderer implements Renderer {
  renderCircle(r: number) { console.log(`ctx.arc(0,0,${r})`); }
  renderSquare(s: number) { console.log(`ctx.fillRect(0,0,${s},${s})`); }
}

// Abstraction hierarchy
abstract class Shape {
  constructor(protected renderer: Renderer) {}  // bridge
  abstract draw(): void;
}

class Circle extends Shape {
  constructor(renderer: Renderer, private radius: number) {
    super(renderer);
  }
  draw() { this.renderer.renderCircle(this.radius); }
}

class Square extends Shape {
  constructor(renderer: Renderer, private side: number) {
    super(renderer);
  }
  draw() { this.renderer.renderSquare(this.side); }
}

// Any shape with any renderer
const circle = new Circle(new SVGRenderer(), 10);
circle.draw();  // <circle r="10" />

const square = new Square(new CanvasRenderer(), 5);
square.draw();  // ctx.fillRect(0,0,5,5)
```

## Best Practices

1. **Identify the two dimensions of variation** — what varies vs how it varies.
2. **Use when you see class explosion** from combining two hierarchies.
3. **Combine with Abstract Factory** — let the factory decide which implementation to inject.

## Real-world Examples

- **JDBC** — `Connection` (abstraction) + vendor-specific `Driver` (implementation).
- **Remote controls + devices** — a universal remote (abstraction) works with any TV brand (implementation).
- **Cross-platform UI** — shape logic vs rendering engine.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 151-161.
- [Refactoring.Guru — Bridge](https://refactoring.guru/design-patterns/bridge)
