# YAGNI — You Aren't Gonna Need It

> **Domain:** Fundamentals > Clean Code > Principles
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

YAGNI (You Aren't Gonna Need It) is a principle from Extreme Programming (XP), coined by Ron Jeffries around 1998:

> "Always implement things when you actually need them, never when you just foresee that you may need them."

YAGNI states that you should **not add functionality until it is necessary**. Every feature, abstraction, or generalization that you build "just in case" is wasted effort — it adds complexity, takes time to build and maintain, and may never be used.

### The Economics of YAGNI

Martin Fowler identified three costs of building something you don't need:
1. **Cost of building** — time spent now instead of on something valuable.
2. **Cost of delay** — the features you didn't build because you were building speculative ones.
3. **Cost of carry** — the ongoing maintenance, testing, and cognitive load of unused code.
4. **Cost of repair** — if the speculative feature is wrong (it usually is), you pay to redesign it.

Studies suggest that **65% of features are rarely or never used** (Standish Group, 2002). Every speculative feature has a high chance of being pure waste.

## Why It Matters

### Focus on Value
Building only what's needed keeps the team focused on delivering real value to users, not hypothetical future needs.

### Reduced Complexity
Unused code clutters the codebase, confuses developers, and makes the system harder to understand and modify.

### Faster Delivery
By not building unnecessary features, you deliver working software sooner.

### Easier Refactoring
A leaner codebase is easier to refactor when real requirements emerge. You're not fighting against speculative abstractions.

## How It Works

### Example: Speculative Generalization

```typescript
// BAD: Building a multi-database system when you only need PostgreSQL
interface DatabaseAdapter {
  connect(config: DatabaseConfig): Promise<Connection>;
  query(sql: string, params: any[]): Promise<Result>;
  disconnect(): Promise<void>;
}

class PostgresAdapter implements DatabaseAdapter { /* ... */ }
class MySQLAdapter implements DatabaseAdapter { /* ... */ }     // YAGNI!
class SQLiteAdapter implements DatabaseAdapter { /* ... */ }    // YAGNI!
class MongoAdapter implements DatabaseAdapter { /* ... */ }     // YAGNI!

class DatabaseFactory {
  static create(type: string): DatabaseAdapter {               // YAGNI!
    switch (type) {
      case 'postgres': return new PostgresAdapter();
      case 'mysql': return new MySQLAdapter();
      // ...
    }
  }
}

// GOOD: Just use PostgreSQL directly
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
```

### Example: Unused Configuration

```python
# BAD: Configuration for features that don't exist yet
class AppConfig:
    DATABASE_URL = "postgresql://..."
    CACHE_BACKEND = "redis"           # No caching implemented yet
    QUEUE_BACKEND = "rabbitmq"        # No queue implemented yet
    SEARCH_ENGINE = "elasticsearch"   # No search implemented yet
    ML_MODEL_PATH = "/models/"        # No ML features yet
    WEBSOCKET_ENABLED = True          # No real-time features yet

# GOOD: Only configure what exists
class AppConfig:
    DATABASE_URL = "postgresql://..."
```

### Example: Premature API Versioning

```java
// BAD: API versioning for an API with zero external consumers
@RestController
@RequestMapping("/api/v1/users")  // You have one client — your own frontend
public class UserControllerV1 { }

@RestController
@RequestMapping("/api/v2/users")  // Zero need for this yet
public class UserControllerV2 { }

// GOOD: Just build the API. Add versioning when you actually need it.
@RestController
@RequestMapping("/api/users")
public class UserController { }
```

### Example: Over-Parameterized Functions

```typescript
// BAD: Making everything configurable "just in case"
function fetchUsers(options: {
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeInactive?: boolean;
  fields?: string[];
  cache?: boolean;
  cacheTimeout?: number;
  retryCount?: number;
  retryDelay?: number;
  timeout?: number;
}) { /* ... */ }

// GOOD: Build what you need now, extend later
function fetchUsers(page: number, pageSize: number): Promise<User[]> {
  return db.query('SELECT * FROM users LIMIT $1 OFFSET $2', [pageSize, page * pageSize]);
}
```

## Best Practices

1. **Build for today's requirements.** Implement exactly what is needed to satisfy the current user story or task. No more.

2. **Trust that you can refactor.** If you need to generalize later, you can refactor then — with the benefit of knowing the actual requirements.

3. **Delete unused code.** Dead code is worse than no code. It confuses readers, shows up in searches, and must be maintained. Version control keeps the history.

4. **Question "what if" requirements.** When someone says "what if we need to support X in the future?" ask: "Is there a concrete plan for X? If not, we'll add it when needed."

5. **Use feature flags over speculative code.** If a feature is uncertain, use feature flags to enable/disable it rather than building a complex configurable architecture.

6. **Timebox speculative work.** If you feel something might be needed, limit investigation to 30 minutes. If the need isn't clear after that, it's probably YAGNI.

## Anti-patterns / Common Mistakes

### Gold Plating
Adding polish, features, or options that nobody asked for. "While I'm here, let me also add..."

### Premature Optimization
Optimizing for performance before you have evidence of a performance problem. This is a specific form of YAGNI.

### Architecture Astronautics
Designing a system to handle millions of users when you have a hundred. Building microservices for a CRUD app. Creating a message bus for one event.

### Fear-Driven Development
"What if the requirements change?" — They will. But you can't predict how. Building for imagined changes is almost always wrong.

## Real-world Examples

### Basecamp/37signals
Basecamp is a multi-million dollar product built on a monolithic Rails application. They explicitly reject microservices, kubernetes, and complex architectures in favor of YAGNI simplicity.

### Early Amazon
Amazon's early website was a monolithic Perl/C application. They only moved to service-oriented architecture when scale *actually* demanded it, not speculatively.

### The Startup That Over-Engineered
A common cautionary tale: a startup spends 6 months building a scalable microservices architecture, event sourcing, and CQRS — then runs out of funding before launching. A simple monolith would have been in production in month one.

## Sources

- Jeffries, R. (1998). *YAGNI*. Extreme Programming concept.
- Beck, K. (1999). *Extreme Programming Explained*. Addison-Wesley.
- Fowler, M. (2015). "YAGNI." (Blog post on martinfowler.com)
- Martin, R.C. (2008). *Clean Code*. Prentice Hall.
- [Clean Code Essentials: YAGNI, KISS, DRY (DEV Community)](https://dev.to/juniourrau/clean-code-essentials-yagni-kiss-and-dry-in-software-engineering-4i3j)
