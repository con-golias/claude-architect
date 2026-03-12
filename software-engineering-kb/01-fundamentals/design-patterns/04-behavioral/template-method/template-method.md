# Template Method Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Template Method pattern defines the **skeleton of an algorithm** in a base class, letting subclasses override specific steps without changing the algorithm's structure. The invariant parts stay in the base class; the variant parts are abstract methods that subclasses implement.

**GoF Intent:** "Define the skeleton of an algorithm in an operation, deferring some steps to subclasses."

## How It Works

```typescript
abstract class DataProcessor {
  // Template method — defines the algorithm skeleton
  process(source: string): Report {
    const rawData = this.readData(source);     // Step 1
    const parsed = this.parseData(rawData);    // Step 2 (varies)
    const analyzed = this.analyzeData(parsed); // Step 3 (varies)
    return this.formatReport(analyzed);        // Step 4
  }

  // Concrete steps (shared)
  private readData(source: string): string {
    return fs.readFileSync(source, "utf-8");
  }

  private formatReport(data: AnalyzedData): Report {
    return { summary: data.summary, timestamp: new Date() };
  }

  // Abstract steps (subclasses fill in)
  protected abstract parseData(raw: string): ParsedData;
  protected abstract analyzeData(data: ParsedData): AnalyzedData;
}

class CSVProcessor extends DataProcessor {
  protected parseData(raw: string): ParsedData {
    return raw.split("\n").map(line => line.split(","));
  }
  protected analyzeData(data: ParsedData): AnalyzedData {
    return { summary: `${data.length} CSV rows processed` };
  }
}

class JSONProcessor extends DataProcessor {
  protected parseData(raw: string): ParsedData {
    return JSON.parse(raw);
  }
  protected analyzeData(data: ParsedData): AnalyzedData {
    return { summary: `${Object.keys(data).length} JSON keys processed` };
  }
}
```

```python
from abc import ABC, abstractmethod

class TestFramework(ABC):
    # Template method
    def run_test(self):
        self.setup()          # hook (optional override)
        try:
            self.execute()    # must implement
            self.verify()     # must implement
        finally:
            self.teardown()   # hook (optional override)

    def setup(self):    pass  # optional hook
    def teardown(self): pass  # optional hook

    @abstractmethod
    def execute(self): pass

    @abstractmethod
    def verify(self): pass

class DatabaseTest(TestFramework):
    def setup(self):
        self.db = create_test_database()

    def execute(self):
        self.db.insert({"name": "Alice"})

    def verify(self):
        assert self.db.count() == 1

    def teardown(self):
        self.db.drop()
```

### Template Method vs Strategy

```
Template Method:  Inheritance-based — subclass overrides steps
Strategy:         Composition-based — inject different algorithms

Template Method: "same algorithm, different steps"
Strategy:        "completely different algorithms"
```

## Real-world Examples

- **JUnit `@Before`/`@Test`/`@After`** — test lifecycle is a template method.
- **React class component lifecycle** — `componentDidMount`, `render`, `componentWillUnmount`.
- **Spring `JdbcTemplate`** — execute SQL with customizable row mapping.
- **Django class-based views** — `get()`, `post()`, `dispatch()` follow template method.
- **Java `AbstractList`** — implements most list methods; subclasses implement `get()` and `size()`.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 325-330.
- [Refactoring.Guru — Template Method](https://refactoring.guru/design-patterns/template-method)
