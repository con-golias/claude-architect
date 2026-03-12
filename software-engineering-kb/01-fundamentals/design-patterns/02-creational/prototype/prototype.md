# Prototype Pattern

> **Domain:** Fundamentals > Design Patterns > Creational
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Prototype pattern creates new objects by **cloning an existing instance** (the prototype) rather than instantiating from scratch. This is useful when object creation is expensive or complex, and when you want to avoid coupling code to specific classes.

**GoF Intent:** "Specify the kinds of objects to create using a prototypical instance, and create new objects by copying this prototype."

## How It Works

```typescript
interface Prototype<T> {
  clone(): T;
}

class GameCharacter implements Prototype<GameCharacter> {
  constructor(
    public name: string,
    public health: number,
    public inventory: string[],
    public position: { x: number; y: number }
  ) {}

  clone(): GameCharacter {
    return new GameCharacter(
      this.name,
      this.health,
      [...this.inventory],         // deep copy array
      { ...this.position }         // deep copy object
    );
  }
}

// Create prototype
const warrior = new GameCharacter("Warrior", 100, ["sword", "shield"], { x: 0, y: 0 });

// Clone and customize
const warrior2 = warrior.clone();
warrior2.name = "Warrior 2";
warrior2.position = { x: 10, y: 5 };
```

```python
import copy

class Spreadsheet:
    def __init__(self, title: str, data: list[list], styles: dict):
        self.title = title
        self.data = data
        self.styles = styles

    def clone(self) -> "Spreadsheet":
        return copy.deepcopy(self)  # Python's built-in deep clone

# Usage
template = Spreadsheet("Monthly Report", [[0]*12], {"font": "Arial", "size": 12})
january = template.clone()
january.title = "January Report"
january.data[0][0] = 1500
```

```java
// Java — Cloneable interface
public class Shape implements Cloneable {
    private String type;
    private List<Point> points;

    @Override
    public Shape clone() {
        try {
            Shape copy = (Shape) super.clone();
            copy.points = new ArrayList<>(this.points);  // deep copy
            return copy;
        } catch (CloneNotSupportedException e) {
            throw new RuntimeException(e);
        }
    }
}
```

### Shallow vs Deep Clone

```
Shallow clone: copies references (both objects share nested objects)
Deep clone: copies everything recursively (independent copies)

Original:  { name: "A", items: [1, 2, 3] }
Shallow:   { name: "A", items: ─────────→ [1, 2, 3] }  ← shared!
Deep:      { name: "A", items: [1, 2, 3] }               ← independent
```

## Best Practices

1. **Always deep clone mutable fields** — shallow cloning shares state and causes bugs.
2. **Use language-provided cloning** — `copy.deepcopy()` (Python), `structuredClone()` (JS), `Cloneable` (Java).
3. **Consider prototype registries** — store pre-configured prototypes by name for easy retrieval.
4. **Use when construction is expensive** — database-loaded configs, complex graph structures.

## Anti-patterns / Common Mistakes

- **Shallow cloning mutable objects** — leads to shared state bugs.
- **Java's `Cloneable` pitfalls** — `clone()` returns `Object`, doesn't call constructors, and is considered broken by many (Effective Java, Item 13).
- **Using prototype when a factory suffices** — if construction is cheap, prototype adds unnecessary complexity.

## Real-world Examples

- **JavaScript `Object.assign()` / spread operator** — shallow prototype cloning.
- **`structuredClone()`** — JavaScript's built-in deep clone (2022+).
- **Java `Cloneable`** — used throughout the JDK for object copying.
- **Game development** — clone enemy/NPC templates with different positions.
- **Spreadsheet templates** — clone a template, modify specific cells.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 117-126.
- [Refactoring.Guru — Prototype](https://refactoring.guru/design-patterns/prototype)
- Bloch, J. (2018). *Effective Java* (3rd ed.). Item 13: "Override clone judiciously."
