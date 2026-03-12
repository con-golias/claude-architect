# Abstract Factory Pattern

> **Domain:** Fundamentals > Design Patterns > Creational
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Abstract Factory pattern provides an interface for creating **families of related objects** without specifying their concrete classes. It is a "factory of factories" — each concrete factory produces a complete set of related products that are designed to work together.

**GoF Intent:** "Provide an interface for creating families of related or dependent objects without specifying their concrete classes."

## Why It Matters

- **Ensures compatibility** — products from the same factory are guaranteed to work together.
- **Swaps entire families** — change all products at once by switching the factory.
- **Platform independence** — create UI elements, database connections, or API clients for different platforms.

## How It Works

```typescript
// Abstract products
interface Button {
  render(): string;
}
interface Input {
  render(): string;
}

// Concrete products — Material Design family
class MaterialButton implements Button {
  render() { return '<button class="md-btn">Click</button>'; }
}
class MaterialInput implements Input {
  render() { return '<input class="md-input" />'; }
}

// Concrete products — iOS family
class IOSButton implements Button {
  render() { return '<button class="ios-btn">Click</button>'; }
}
class IOSInput implements Input {
  render() { return '<input class="ios-input" />'; }
}

// Abstract factory
interface UIFactory {
  createButton(): Button;
  createInput(): Input;
}

// Concrete factories
class MaterialFactory implements UIFactory {
  createButton() { return new MaterialButton(); }
  createInput() { return new MaterialInput(); }
}

class IOSFactory implements UIFactory {
  createButton() { return new IOSButton(); }
  createInput() { return new IOSInput(); }
}

// Client — works with any factory
function renderForm(factory: UIFactory) {
  const button = factory.createButton();
  const input = factory.createInput();
  return `${input.render()} ${button.render()}`;
}

// Switch entire UI family by changing the factory
const factory = platform === "ios" ? new IOSFactory() : new MaterialFactory();
renderForm(factory);
```

```python
from abc import ABC, abstractmethod

class DatabaseConnection(ABC):
    @abstractmethod
    def connect(self): pass

class DatabaseQuery(ABC):
    @abstractmethod
    def execute(self, sql: str): pass

# PostgreSQL family
class PostgresConnection(DatabaseConnection):
    def connect(self): return "Connected to PostgreSQL"

class PostgresQuery(DatabaseQuery):
    def execute(self, sql): return f"PG: {sql}"

# MySQL family
class MySQLConnection(DatabaseConnection):
    def connect(self): return "Connected to MySQL"

class MySQLQuery(DatabaseQuery):
    def execute(self, sql): return f"MySQL: {sql}"

# Abstract factory
class DatabaseFactory(ABC):
    @abstractmethod
    def create_connection(self) -> DatabaseConnection: pass
    @abstractmethod
    def create_query(self) -> DatabaseQuery: pass

class PostgresFactory(DatabaseFactory):
    def create_connection(self): return PostgresConnection()
    def create_query(self): return PostgresQuery()

class MySQLFactory(DatabaseFactory):
    def create_connection(self): return MySQLConnection()
    def create_query(self): return MySQLQuery()
```

## Best Practices

1. **Use when products must be used together** — buttons with inputs, connections with queries.
2. **Keep the factory interface small** — only include products that truly form a family.
3. **Combine with Factory Method** — each method in the Abstract Factory is a Factory Method.

## Anti-patterns / Common Mistakes

- **Using when there's only one product type** — Factory Method is simpler.
- **Creating too many factory interfaces** — leads to interface explosion.
- **Tight coupling to concrete factories** — inject the factory, don't hardcode which one.

## Real-world Examples

- **Java AWT/Swing** — `ToolKit` creates platform-specific UI components.
- **ADO.NET** — `DbProviderFactory` creates connections, commands, and adapters for any database.
- **Cross-platform UI frameworks** — Flutter, React Native use abstract factories for platform components.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 87-95.
- [Refactoring.Guru — Abstract Factory](https://refactoring.guru/design-patterns/abstract-factory)
