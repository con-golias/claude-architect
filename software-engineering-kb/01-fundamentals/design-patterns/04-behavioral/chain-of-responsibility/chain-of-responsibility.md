# Chain of Responsibility Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Chain of Responsibility pattern passes a request along a **chain of handlers**. Each handler decides whether to process the request or pass it to the next handler in the chain. The sender doesn't know which handler will process the request.

**GoF Intent:** "Avoid coupling the sender of a request to its receiver by giving more than one object a chance to handle the request. Chain the receiving objects and pass the request along the chain until an object handles it."

## How It Works

```typescript
abstract class Handler {
  private next: Handler | null = null;

  setNext(handler: Handler): Handler {
    this.next = handler;
    return handler;  // for chaining: a.setNext(b).setNext(c)
  }

  handle(request: Request): Response | null {
    if (this.next) return this.next.handle(request);
    return null;
  }
}

class AuthHandler extends Handler {
  handle(request: Request): Response | null {
    if (!request.headers.authorization) {
      return { status: 401, body: "Unauthorized" };
    }
    return super.handle(request);  // pass to next
  }
}

class RateLimitHandler extends Handler {
  private requests = new Map<string, number>();

  handle(request: Request): Response | null {
    const ip = request.ip;
    const count = (this.requests.get(ip) || 0) + 1;
    this.requests.set(ip, count);
    if (count > 100) {
      return { status: 429, body: "Too Many Requests" };
    }
    return super.handle(request);
  }
}

class LoggingHandler extends Handler {
  handle(request: Request): Response | null {
    console.log(`${request.method} ${request.url}`);
    return super.handle(request);  // always passes to next
  }
}

// Build chain
const chain = new LoggingHandler();
chain.setNext(new AuthHandler()).setNext(new RateLimitHandler());

chain.handle(request);
```

## Real-world Examples

- **Express.js middleware** — `app.use(cors()); app.use(auth()); app.use(router);`
- **Java Servlet Filters** — filter chain processes requests before reaching the servlet.
- **DOM event bubbling** — events propagate up the DOM tree until handled.
- **Exception handling** — try/catch chain up the call stack.
- **Spring Security** — filter chain for authentication and authorization.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 223-232.
- [Refactoring.Guru — Chain of Responsibility](https://refactoring.guru/design-patterns/chain-of-responsibility)
