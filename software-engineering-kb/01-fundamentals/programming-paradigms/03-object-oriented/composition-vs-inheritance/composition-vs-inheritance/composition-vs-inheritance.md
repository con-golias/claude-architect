# Composition vs Inheritance

> **Domain:** Fundamentals > Programming Paradigms > Object-Oriented
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

**Inheritance** models "is-a" relationships (a Dog is-a Animal). **Composition** models "has-a" relationships (a Car has-a Engine). The Gang of Four famously advised: **"Favor object composition over class inheritance."** Composition provides greater flexibility by assembling behavior from smaller, interchangeable components rather than locking into rigid class hierarchies.

## How It Works

```typescript
// INHERITANCE approach — rigid, tightly coupled
class Animal {
  eat() { return "eating"; }
}
class FlyingAnimal extends Animal {
  fly() { return "flying"; }
}
class SwimmingAnimal extends Animal {
  swim() { return "swimming"; }
}
// Problem: Duck needs both fly() AND swim() — can't extend two classes!
// class Duck extends FlyingAnimal, SwimmingAnimal  ← impossible in most languages

// COMPOSITION approach — flexible, mix-and-match
interface CanFly   { fly(): string; }
interface CanSwim  { swim(): string; }
interface CanEat   { eat(): string; }

const flying = (): CanFly  => ({ fly: () => "flying" });
const swimming = (): CanSwim => ({ swim: () => "swimming" });
const eating = (): CanEat  => ({ eat: () => "eating" });

// Compose behaviors freely
function createDuck() {
  return { ...eating(), ...flying(), ...swimming(), quack: () => "quack!" };
}

function createPenguin() {
  return { ...eating(), ...swimming(), waddle: () => "waddling" };
  // No fly() — penguins can't fly, and we don't inherit unwanted behavior
}
```

```python
# Python — composition with dependency injection
class Engine:
    def __init__(self, horsepower: int):
        self.horsepower = horsepower

    def start(self) -> str:
        return f"Engine started ({self.horsepower}hp)"

class GPS:
    def navigate(self, destination: str) -> str:
        return f"Navigating to {destination}"

class MusicPlayer:
    def play(self, song: str) -> str:
        return f"Playing: {song}"

# Car HAS-A engine, HAS-A GPS, HAS-A music player
class Car:
    def __init__(self, engine: Engine, gps: GPS, player: MusicPlayer):
        self.engine = engine    # composition — delegates to components
        self.gps = gps
        self.player = player

    def drive_to(self, destination: str) -> list[str]:
        return [
            self.engine.start(),
            self.gps.navigate(destination),
            self.player.play("Road Trip Mix"),
        ]

# Easy to swap components
sports_car = Car(Engine(450), GPS(), MusicPlayer())
economy_car = Car(Engine(120), GPS(), MusicPlayer())
```

### Strategy Pattern — Composition in Action

```typescript
// Instead of subclassing for each variation, compose with strategies
interface SortStrategy {
  sort<T>(items: T[], compare: (a: T, b: T) => number): T[];
}

class QuickSort implements SortStrategy {
  sort<T>(items: T[], compare: (a: T, b: T) => number): T[] { /* ... */ }
}

class MergeSort implements SortStrategy {
  sort<T>(items: T[], compare: (a: T, b: T) => number): T[] { /* ... */ }
}

class DataProcessor {
  constructor(private sortStrategy: SortStrategy) {}  // composed, not inherited

  setSortStrategy(strategy: SortStrategy) {
    this.sortStrategy = strategy;  // can change at runtime!
  }

  process(data: number[]): number[] {
    return this.sortStrategy.sort(data, (a, b) => a - b);
  }
}
```

### When to Use Each

```
Use INHERITANCE when:                Use COMPOSITION when:
─────────────────────                ──────────────────────
True "is-a" relationship             "has-a" or "uses-a" relationship
Sharing implementation is natural    Need flexibility to change behavior
Framework requires it                Need to combine multiple behaviors
Shallow hierarchy (1-2 levels)       Deep hierarchies would emerge
LSP is maintained                    Subclass would violate LSP

Examples:                            Examples:
  IOException extends Exception        Car has-a Engine
  ArrayList extends AbstractList       Logger has-a Formatter
  HttpServlet extends GenericServlet   Controller has-a Service
```

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. p. 20: "Favor composition over inheritance."
- Bloch, J. (2018). *Effective Java*. 3rd ed. Item 18: "Favor composition over inheritance."
- Martin, R.C. (2017). *Clean Architecture*. Prentice Hall.
