# Proxy Pattern

> **Domain:** Fundamentals > Design Patterns > Structural
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Proxy pattern provides a **surrogate or placeholder** for another object to control access to it. The proxy has the same interface as the real object and can add behavior like lazy loading, access control, caching, or logging — transparently to the client.

**GoF Intent:** "Provide a surrogate or placeholder for another object to control access to it."

## How It Works

### Types of Proxies

| Type | Purpose | Example |
|------|---------|---------|
| **Virtual Proxy** | Lazy loading — defer expensive creation | Large image loading |
| **Protection Proxy** | Access control — check permissions | Role-based API access |
| **Caching Proxy** | Cache results — avoid repeated work | API response caching |
| **Logging Proxy** | Logging — record operations | Audit trail |
| **Remote Proxy** | Network — represent remote object locally | RPC, gRPC stubs |

```typescript
// Subject interface
interface DataService {
  getData(id: string): Promise<Data>;
}

// Real service (expensive)
class APIDataService implements DataService {
  async getData(id: string): Promise<Data> {
    const response = await fetch(`/api/data/${id}`);
    return response.json();
  }
}

// Caching Proxy
class CachingProxy implements DataService {
  private cache = new Map<string, Data>();

  constructor(private service: DataService) {}

  async getData(id: string): Promise<Data> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;  // return cached
    }
    const data = await this.service.getData(id);
    this.cache.set(id, data);
    return data;
  }
}

// Logging Proxy
class LoggingProxy implements DataService {
  constructor(private service: DataService) {}

  async getData(id: string): Promise<Data> {
    console.log(`[${new Date().toISOString()}] getData(${id})`);
    const start = Date.now();
    const result = await this.service.getData(id);
    console.log(`[${Date.now() - start}ms] getData completed`);
    return result;
  }
}

// Stack proxies
const service = new LoggingProxy(
  new CachingProxy(
    new APIDataService()
  )
);
```

```python
# Virtual Proxy — lazy loading
class HeavyImage:
    def __init__(self, path: str):
        self.path = path
        self._data = None

    def _load(self):
        if self._data is None:
            self._data = load_from_disk(self.path)  # expensive

    def display(self):
        self._load()  # load only when needed
        render(self._data)

# JavaScript Proxy object — built-in metaprogramming
```

```typescript
// JavaScript Proxy (ES6) — built-in proxy support
const handler: ProxyHandler<any> = {
  get(target, prop) {
    console.log(`Accessing ${String(prop)}`);
    return Reflect.get(target, prop);
  },
  set(target, prop, value) {
    console.log(`Setting ${String(prop)} = ${value}`);
    return Reflect.set(target, prop, value);
  }
};

const user = new Proxy({ name: "Alice", age: 30 }, handler);
user.name;      // logs: "Accessing name"
user.age = 31;  // logs: "Setting age = 31"
```

### Proxy vs Decorator

```
Proxy:     Controls ACCESS to the object (same interface, added control)
Decorator: Adds BEHAVIOR to the object (same interface, added features)

The distinction is about intent:
- Proxy manages the object's lifecycle or access
- Decorator enhances the object's functionality
```

## Best Practices

1. **Use the same interface** as the real object — the client shouldn't know it's a proxy.
2. **Stack proxies** for multiple concerns — caching + logging + auth.
3. **Use JavaScript's `Proxy` object** for metaprogramming — data binding, validation, reactive systems.
4. **Consider lazy proxies for expensive resources** — images, database connections, large files.

## Real-world Examples

- **JavaScript `Proxy`** — Vue.js 3 reactivity system, MobX state management.
- **Spring AOP** — `@Transactional`, `@Cacheable` are implemented via dynamic proxies.
- **Java RMI** — remote method invocation uses proxy stubs.
- **Hibernate lazy loading** — entity proxies defer database queries until properties are accessed.
- **Nginx** — reverse proxy that controls access to backend servers.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 207-217.
- [Refactoring.Guru — Proxy](https://refactoring.guru/design-patterns/proxy)
- [MDN — JavaScript Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
