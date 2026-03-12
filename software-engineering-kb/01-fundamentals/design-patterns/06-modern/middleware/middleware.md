# Middleware Pattern

> **Domain:** Fundamentals > Design Patterns > Modern
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Middleware pattern creates a **pipeline of processing functions** that execute sequentially on a request/response or data flow. Each middleware can inspect, modify, or short-circuit the flow before passing control to the next middleware. It is essentially a refined form of the Chain of Responsibility pattern, optimized for request processing.

**Origin:** Popularized by Ruby's Rack (2007), adopted by Express.js (2010), and now the standard pattern for web frameworks, API gateways, and message processing systems.

## How It Works

```
Request → [Auth] → [Logging] → [RateLimit] → [CORS] → [Handler] → Response
              ↓          ↓           ↓           ↓          ↓
          can modify  can modify  can reject  can add    processes
          request     request     request     headers    request

Each middleware calls next() to continue or sends a response to stop.
```

### Express.js Middleware

```typescript
import express, { Request, Response, NextFunction } from "express";

const app = express();

// Middleware 1 — Logging
function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();  // pass to next middleware
}

// Middleware 2 — Authentication
function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "No token provided" });
    return;  // stop pipeline — don't call next()
  }
  try {
    req.user = verifyJWT(token);
    next();  // authenticated — continue
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Middleware 3 — Rate limiting
function rateLimit(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip;
    const now = Date.now();
    const timestamps = (hits.get(ip) || []).filter(t => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    timestamps.push(now);
    hits.set(ip, timestamps);
    next();
  };
}

// Apply middleware
app.use(requestLogger);                      // all routes
app.use("/api", rateLimit(100, 60_000));     // /api routes only
app.use("/api/admin", authenticate);         // /api/admin routes only

app.get("/api/admin/users", (req, res) => {
  // Only reached if: logged, rate-checked, and authenticated
  res.json({ users: [] });
});
```

### Generic Middleware Pipeline

```typescript
// Reusable middleware pipeline — not tied to HTTP
type Middleware<T> = (context: T, next: () => Promise<void>) => Promise<void>;

class Pipeline<T> {
  private middlewares: Middleware<T>[] = [];

  use(middleware: Middleware<T>): this {
    this.middlewares.push(middleware);
    return this;
  }

  async execute(context: T): Promise<void> {
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware(context, next);
      }
    };

    await next();
  }
}

// Usage — message processing pipeline
interface Message {
  body: string;
  metadata: Record<string, any>;
  processed: boolean;
}

const pipeline = new Pipeline<Message>()
  .use(async (msg, next) => {
    msg.metadata.receivedAt = Date.now();  // enrich
    await next();
  })
  .use(async (msg, next) => {
    if (msg.body.includes("spam")) return;  // filter (no next())
    await next();
  })
  .use(async (msg, next) => {
    msg.body = msg.body.trim().toLowerCase();  // transform
    await next();
  })
  .use(async (msg, next) => {
    await saveToDatabase(msg);  // final handler
    msg.processed = true;
  });

await pipeline.execute({ body: "  Hello World  ", metadata: {}, processed: false });
```

```python
# Python — ASGI middleware (FastAPI/Starlette)
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time

class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)  # call next middleware/handler
        duration = time.time() - start
        response.headers["X-Process-Time"] = f"{duration:.3f}"
        return response

class CORSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return Response(headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
            })
        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response

# Apply
app = FastAPI()
app.add_middleware(TimingMiddleware)
app.add_middleware(CORSMiddleware)
```

### Middleware vs Chain of Responsibility

```
Chain of Responsibility:  Each handler decides whether to handle or pass along
Middleware:               Each step processes AND passes along (via next())

CoR:        handler.handle(request)  → first matching handler wins
Middleware:  middleware(req, next)    → all middlewares run (unless one stops)

Middleware is a specialized CoR where:
  - Order matters (pipeline)
  - Each step can run code before AND after next()
  - The "next" function gives control over downstream execution
```

## Real-world Examples

- **Express.js / Koa** — `app.use(middleware)` pipeline for HTTP processing.
- **Django middleware** — `process_request` → view → `process_response` for every request.
- **ASP.NET Core** — `app.UseAuthentication()`, `app.UseRouting()`, `app.UseEndpoints()`.
- **Redux middleware** — `store => next => action => { ... }` for action processing.
- **Axios interceptors** — `request` and `response` interceptors as middleware.
- **gRPC interceptors** — unary/stream interceptors for logging, auth, metrics.
- **AWS API Gateway** — Lambda authorizers and request/response transformations.

## Sources

- [Express.js — Writing Middleware](https://expressjs.com/en/guide/writing-middleware.html)
- [Koa.js — Cascade](https://koajs.com/) (onion model middleware)
- [Django — Middleware](https://docs.djangoproject.com/en/5.0/topics/http/middleware/)
