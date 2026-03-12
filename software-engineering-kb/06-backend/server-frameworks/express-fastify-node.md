# Express & Fastify — Node.js Server Frameworks

> **AI Plugin Directive — Express & Fastify Production Patterns for Node.js**
> You are an AI coding assistant. When generating, reviewing, or refactoring Express or Fastify
> applications, follow EVERY rule in this document. Node.js backend applications require careful
> attention to async patterns, error handling, and process management. Treat each section as non-negotiable.

**Core Rule: ALWAYS use TypeScript for Node.js backends. ALWAYS handle async errors (no unhandled promise rejections). ALWAYS implement graceful shutdown. ALWAYS use structured logging (pino). ALWAYS validate all input with Zod or equivalent. NEVER block the event loop with synchronous operations.**

---

## 1. Express vs Fastify Decision

```
┌──────────────────────────────────────────────────────────────┐
│              Express vs Fastify                               │
│                                                               │
│  Express:                                                    │
│  ├── Largest ecosystem (100K+ npm packages)                 │
│  ├── Most tutorials, Stack Overflow answers                 │
│  ├── Middleware-based architecture                          │
│  ├── ~15,000-30,000 req/sec                                │
│  ├── No built-in schema validation                          │
│  └── Express 5.x: native async error handling              │
│                                                               │
│  Fastify:                                                    │
│  ├── 2-3x faster than Express                               │
│  ├── Built-in JSON Schema validation                        │
│  ├── Built-in logging (pino)                                │
│  ├── Plugin architecture (encapsulated)                     │
│  ├── ~30,000-60,000 req/sec                                │
│  └── Auto-generated OpenAPI docs                            │
│                                                               │
│  Choose Express when:                                        │
│  ├── Team already knows Express                             │
│  ├── Need specific Express middleware                       │
│  └── Rapid prototyping, maximum community support           │
│                                                               │
│  Choose Fastify when:                                        │
│  ├── Performance matters (high throughput API)              │
│  ├── Want built-in validation and serialization             │
│  ├── Want auto-generated API documentation                  │
│  └── New project with no Express lock-in                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Express — Production Setup

```typescript
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import pino from "pino";
import pinoHttp from "pino-http";
import { z } from "zod";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(process.env.NODE_ENV === "development" && {
    transport: { target: "pino-pretty" },
  }),
});

const app = express();

// --- Middleware ordering (CRITICAL) ---
// 1. Request ID (first — needed by everything)
app.use((req, res, next) => {
  req.id = req.headers["x-request-id"] as string || crypto.randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
});

// 2. Logging
app.use(pinoHttp({ logger, genReqId: (req) => req.id }));

// 3. Security headers
app.use(helmet());

// 4. CORS
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(","), credentials: true }));

// 5. Body parsing with size limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// 6. Compression
app.use(compression());

// 7. Trust proxy (if behind load balancer)
app.set("trust proxy", 1);

// --- Routes ---
app.use("/api/users", userRouter);
app.use("/api/products", productRouter);
app.use("/api/orders", orderRouter);

// --- Health check ---
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({ error: "not_found", path: req.path });
});

// --- Global error handler (MUST be last middleware) ---
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Known application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      request_id: req.id,
    });
  }

  // Validation errors (Zod)
  if (err.name === "ZodError") {
    return res.status(400).json({
      error: "validation_error",
      details: (err as z.ZodError).issues,
      request_id: req.id,
    });
  }

  // Unknown errors
  logger.error({ err, requestId: req.id }, "Unhandled error");
  res.status(500).json({
    error: "internal_server_error",
    request_id: req.id,
  });
});

// --- Server startup ---
const PORT = parseInt(process.env.PORT || "3000");
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "Server started");
});

// --- Graceful shutdown ---
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutdown signal received");

  server.close(async () => {
    logger.info("HTTP server closed");
    await db.end();           // Close database pool
    await redis.quit();       // Close Redis connection
    process.exit(0);
  });

  // Force shutdown after 30s
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Catch unhandled rejections (CRITICAL)
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled rejection — shutting down");
  process.exit(1);
});
```

---

## 3. Express — Router & Controller Pattern

```typescript
// routes/users.ts
import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { userController } from "../controllers/user";
import { CreateUserSchema, UpdateUserSchema } from "../schemas/user";

const router = Router();

router.get("/", authMiddleware, userController.list);
router.get("/:id", authMiddleware, userController.getById);
router.post("/", authMiddleware, validate(CreateUserSchema), userController.create);
router.put("/:id", authMiddleware, validate(UpdateUserSchema), userController.update);
router.delete("/:id", authMiddleware, userController.delete);

export { router as userRouter };

// middleware/validate.ts
import { z, ZodSchema } from "zod";

function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "validation_error",
        details: result.error.issues,
      });
    }
    req.body = result.data; // Replace with parsed & validated data
    next();
  };
}

// controllers/user.ts — async handler wrapper
function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next); // Forward async errors to error handler
  };
}

const userController = {
  list: asyncHandler(async (req, res) => {
    const users = await userService.findAll({
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 20, 100),
    });
    res.json(users);
  }),

  getById: asyncHandler(async (req, res) => {
    const user = await userService.findById(req.params.id);
    if (!user) throw new NotFoundError("User not found");
    res.json(user);
  }),

  create: asyncHandler(async (req, res) => {
    const user = await userService.create(req.body);
    res.status(201).json(user);
  }),

  update: asyncHandler(async (req, res) => {
    const user = await userService.update(req.params.id, req.body);
    if (!user) throw new NotFoundError("User not found");
    res.json(user);
  }),

  delete: asyncHandler(async (req, res) => {
    await userService.delete(req.params.id);
    res.status(204).send();
  }),
};
```

---

## 4. Fastify — Production Setup

```typescript
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    ...(process.env.NODE_ENV === "development" && {
      transport: { target: "pino-pretty" },
    }),
  },
  genReqId: (req) => req.headers["x-request-id"] as string || crypto.randomUUID(),
  trustProxy: true,
  bodyLimit: 1048576,  // 1MB
});

// --- Plugins ---
await app.register(fastifyHelmet);
await app.register(fastifyCors, {
  origin: process.env.ALLOWED_ORIGINS?.split(","),
  credentials: true,
});
await app.register(fastifyRateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// --- Auto-generated API docs ---
await app.register(fastifySwagger, {
  openapi: {
    info: { title: "My API", version: "1.0.0" },
    servers: [{ url: process.env.API_URL || "http://localhost:3000" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  },
});
await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

// --- Routes ---
await app.register(userRoutes, { prefix: "/api/users" });
await app.register(productRoutes, { prefix: "/api/products" });

// --- Health check ---
app.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

// --- Global error handler ---
app.setErrorHandler((error, request, reply) => {
  if (error.validation) {
    return reply.status(400).send({
      error: "validation_error",
      details: error.validation,
      request_id: request.id,
    });
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      request_id: request.id,
    });
  }

  request.log.error(error, "Unhandled error");
  reply.status(500).send({
    error: "internal_server_error",
    request_id: request.id,
  });
});

// --- Start ---
const PORT = parseInt(process.env.PORT || "3000");
await app.listen({ port: PORT, host: "0.0.0.0" });
app.log.info({ port: PORT }, "Server started");

// --- Graceful shutdown ---
async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "Shutting down");
  await app.close();
  await db.end();
  await redis.quit();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

---

## 5. Fastify — Route & Schema Validation

```typescript
// routes/users.ts
import { FastifyPluginAsync } from "fastify";
import { Type, Static } from "@sinclair/typebox";

// TypeBox schemas (JSON Schema compatible, TypeScript types inferred)
const UserSchema = Type.Object({
  id: Type.String({ format: "uuid" }),
  name: Type.String({ minLength: 1, maxLength: 100 }),
  email: Type.String({ format: "email" }),
  role: Type.Union([Type.Literal("user"), Type.Literal("admin")]),
  created_at: Type.String({ format: "date-time" }),
});

const CreateUserSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 8 }),
});

const UpdateUserSchema = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 100 }),
    email: Type.String({ format: "email" }),
  }),
);

type CreateUserInput = Static<typeof CreateUserSchema>;
type UpdateUserInput = Static<typeof UpdateUserSchema>;

const userRoutes: FastifyPluginAsync = async (app) => {
  // GET /api/users
  app.get("/", {
    schema: {
      querystring: Type.Object({
        page: Type.Integer({ minimum: 1, default: 1 }),
        limit: Type.Integer({ minimum: 1, maximum: 100, default: 20 }),
      }),
      response: {
        200: Type.Object({
          data: Type.Array(UserSchema),
          total: Type.Integer(),
        }),
      },
    },
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const { page, limit } = request.query as { page: number; limit: number };
      const result = await userService.findAll({ page, limit });
      return result;
    },
  });

  // POST /api/users
  app.post<{ Body: CreateUserInput }>("/", {
    schema: {
      body: CreateUserSchema,
      response: { 201: UserSchema },
    },
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const user = await userService.create(request.body);
      reply.status(201);
      return user;
    },
  });

  // PUT /api/users/:id
  app.put<{ Params: { id: string }; Body: UpdateUserInput }>("/:id", {
    schema: {
      params: Type.Object({ id: Type.String({ format: "uuid" }) }),
      body: UpdateUserSchema,
      response: { 200: UserSchema },
    },
    preHandler: [authMiddleware],
    handler: async (request, reply) => {
      const user = await userService.update(request.params.id, request.body);
      if (!user) throw new NotFoundError("User not found");
      return user;
    },
  });
};
```

---

## 6. Database Integration Pattern

```typescript
// Shared pattern for both Express and Fastify
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Database pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,                    // Max connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail if can't connect in 5s
});

// Connection health check
pool.on("error", (err) => {
  logger.error({ err }, "Unexpected database error");
});

const db = drizzle(pool, { schema });

// Repository pattern
class UserRepository {
  async findById(id: string) {
    return db.query.users.findFirst({
      where: eq(schema.users.id, id),
      with: { profile: true },
    });
  }

  async findAll(opts: { page: number; limit: number }) {
    const offset = (opts.page - 1) * opts.limit;
    const [data, countResult] = await Promise.all([
      db.select().from(schema.users)
        .limit(opts.limit)
        .offset(offset)
        .orderBy(desc(schema.users.createdAt)),
      db.select({ count: sql<number>`count(*)` }).from(schema.users),
    ]);

    return { data, total: countResult[0].count };
  }

  async create(input: CreateUserInput) {
    const [user] = await db.insert(schema.users)
      .values({
        ...input,
        passwordHash: await bcrypt.hash(input.password, 12),
      })
      .returning();
    return user;
  }
}
```

---

## 7. Testing Pattern

```typescript
// Express: Supertest
import request from "supertest";
import { app } from "../app";

describe("GET /api/users", () => {
  it("returns paginated users", async () => {
    const res = await request(app)
      .get("/api/users?page=1&limit=10")
      .set("Authorization", `Bearer ${testToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(10);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it("returns 401 without auth", async () => {
    await request(app).get("/api/users").expect(401);
  });
});

// Fastify: Built-in inject (no HTTP server needed — faster)
import { buildApp } from "../app";

describe("GET /api/users", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns paginated users", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/users?page=1&limit=10",
      headers: { authorization: `Bearer ${testToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveLength(10);
  });
});
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No TypeScript | Type errors in production, hard to refactor | Always use TypeScript for Node.js backends |
| Unhandled promise rejections | Silent failures, process crash | `asyncHandler` wrapper or Express 5 native async |
| Blocking the event loop | Slow response times, timeouts | Use worker threads for CPU work, async for I/O |
| No request validation | Garbage data in database, runtime errors | Zod (Express) or JSON Schema (Fastify) on every endpoint |
| `console.log` for logging | No structured logs, no levels, no correlation | pino for structured JSON logging |
| No graceful shutdown | Dropped connections, incomplete transactions | Handle SIGTERM/SIGINT, drain connections |
| Global state mutation | Race conditions, memory leaks | Dependency injection, request-scoped state |
| No error handler middleware | Unhandled errors crash the process | Global error handler as last middleware |
| `npm start` in production | No auto-restart, no clustering | PM2, Docker, or Kubernetes for process management |
| Direct DB queries in route handlers | Untestable, no separation of concerns | Service layer + repository pattern |

---

## 9. Enforcement Checklist

- [ ] TypeScript enabled with strict mode
- [ ] Structured logging with pino (JSON to stdout)
- [ ] Request validation on all endpoints (Zod or JSON Schema)
- [ ] Async error handling (asyncHandler wrapper or Fastify native)
- [ ] Global error handler returning safe error responses
- [ ] Graceful shutdown handling SIGTERM and SIGINT
- [ ] Security headers via Helmet
- [ ] CORS configured with explicit origins
- [ ] Request body size limits configured
- [ ] Health check endpoint at /health
- [ ] Database connection pool configured with timeouts
- [ ] Request ID generation and propagation
- [ ] Rate limiting middleware configured
- [ ] Trust proxy configured (if behind load balancer)
- [ ] unhandledRejection process handler registered
