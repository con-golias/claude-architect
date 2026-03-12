# Module Pattern

> **Domain:** Fundamentals > Design Patterns > Modern
> **Difficulty:** Beginner
> **Last Updated:** 2026-03-06

## What It Is

The Module pattern **encapsulates related code into a self-contained unit** with a clear public interface, hiding internal implementation details. It provides information hiding (private state), namespace organization, and controlled exports. In modern JavaScript/TypeScript, native ES modules have largely replaced the classic module pattern, but the underlying principles remain fundamental.

**Origin:** The pattern traces back to JavaScript's lack of native modules (pre-ES2015). Douglas Crockford popularized the IIFE-based module pattern. Today, ES modules (`import`/`export`), CommonJS (`require`/`module.exports`), and language-level modules (Python packages, Java packages, Go packages) are the standard.

## How It Works

### ES Modules (Modern Standard)

```typescript
// logger.ts — module with private state and public API
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

// Private — not exported
let currentLevel: LogLevel = "info";
const history: string[] = [];

function formatMessage(level: LogLevel, message: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
}

// Public API — explicitly exported
export function setLevel(level: LogLevel): void {
  currentLevel = level;
}

export function log(level: LogLevel, message: string): void {
  if (LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]) {
    const formatted = formatMessage(level, message);
    console.log(formatted);
    history.push(formatted);
  }
}

export function debug(msg: string): void { log("debug", msg); }
export function info(msg: string): void  { log("info", msg); }
export function warn(msg: string): void  { log("warn", msg); }
export function error(msg: string): void { log("error", msg); }

export function getHistory(): readonly string[] {
  return [...history];  // return copy, not reference
}

// Consumer
// import { info, warn, setLevel } from "./logger";
// setLevel("warn");
// info("ignored");
// warn("this shows up");
```

### Classic Module Pattern (IIFE)

```javascript
// Pre-ES2015 — immediately invoked function expression
const Counter = (function() {
  // Private state — enclosed in closure
  let count = 0;
  const MAX = 100;

  // Private function
  function validate(n) {
    if (n < 0 || n > MAX) throw new RangeError(`Count must be 0-${MAX}`);
  }

  // Public API — returned object
  return {
    increment() { validate(count + 1); return ++count; },
    decrement() { validate(count - 1); return --count; },
    getCount()  { return count; },
    reset()     { count = 0; },
  };
})();

Counter.increment(); // 1
Counter.increment(); // 2
Counter.getCount();  // 2
// Counter.count     → undefined (private)
// Counter.MAX       → undefined (private)
```

### Revealing Module Pattern

```javascript
// All functions defined as private, selectively revealed
const Validator = (function() {
  function isEmail(str) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
  }

  function isPhone(str) {
    return /^\+?[\d\s-]{10,}$/.test(str);
  }

  function isNotEmpty(str) {
    return str.trim().length > 0;
  }

  function sanitize(str) {
    return str.replace(/[<>&"']/g, "");
  }

  // Reveal only what consumers need
  return { isEmail, isPhone, isNotEmpty, sanitize };
})();
```

### Python Module System

```python
# utils/config.py — Python module with private convention

import os
from dataclasses import dataclass

# Private by convention (underscore prefix)
_defaults = {
    "port": 3000,
    "host": "localhost",
    "debug": False,
}

_config: dict = {}

def _merge(base: dict, overrides: dict) -> dict:
    return {**base, **overrides}

# Public API
@dataclass(frozen=True)
class Config:
    port: int
    host: str
    debug: bool

def load(env: str = "development") -> Config:
    """Load configuration for the given environment."""
    global _config
    env_overrides = {
        "port": int(os.getenv("PORT", _defaults["port"])),
        "host": os.getenv("HOST", _defaults["host"]),
        "debug": env == "development",
    }
    _config = _merge(_defaults, env_overrides)
    return Config(**_config)

def get(key: str):
    """Get a configuration value."""
    return _config.get(key)

# __all__ controls what "from config import *" exports
__all__ = ["Config", "load", "get"]
```

### Module Organization Patterns

```
Barrel Exports (index.ts):
  // Re-export public API from a directory
  export { UserService } from "./user.service";
  export { UserRepository } from "./user.repository";
  export type { User, CreateUserDTO } from "./user.types";
  // Internal files like user.mapper.ts are NOT exported

Package by Feature (recommended):
  src/
    users/
      index.ts          ← public API (barrel)
      user.service.ts   ← internal
      user.repo.ts      ← internal
    orders/
      index.ts          ← public API
      order.service.ts  ← internal

Package by Layer (less recommended):
  src/
    controllers/
    services/
    repositories/
    models/
```

### Module Encapsulation Levels

```
ES Modules:     File-level scope, explicit import/export
CommonJS:       File-level scope, require/module.exports
Python:         File = module, directory + __init__.py = package
Java:           Package access + module-info.java (JPMS since Java 9)
Go:             Package-level, exported = Capitalized name
Rust:           mod keyword, pub visibility, crate boundary
C#:             Namespace + internal/public access modifiers
```

## Real-world Examples

- **Node.js `fs`, `path`, `http`** — core modules with clear public APIs.
- **Python standard library** — `os`, `json`, `collections` are well-designed modules.
- **npm packages** — each package is a module with `package.json` entry point.
- **Java 9 JPMS** — `module-info.java` declares module dependencies and exports.
- **Angular modules** — `@NgModule` groups related components, services, and pipes.
- **Webpack/Vite** — bundlers that resolve and optimize module dependency graphs.

## Sources

- Crockford, D. (2008). *JavaScript: The Good Parts*. O'Reilly. Chapter 4.
- Osmani, A. (2012). *Learning JavaScript Design Patterns*. O'Reilly. Chapter 9.
- [MDN — JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
