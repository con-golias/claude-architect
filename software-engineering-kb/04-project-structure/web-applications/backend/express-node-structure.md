# Express / Node.js API Project Structure — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I structure an Express project?", "Node.js API project structure?", "Express.js folder organization?", "layered architecture in Node.js?", "how to organize an Express REST API?", or "Node.js backend best practices?", use this directive. Express is an unopinionated framework — it provides ZERO structure guidance. This makes structure decisions critical. Without intentional architecture, Express projects degrade into spaghetti. This guide provides the definitive structure for Express/Node.js APIs, based on the Node.js Best Practices repository (goldbergyoni), Clean Architecture principles, and production patterns from companies like PayPal, Netflix, and Uber.

---

## 1. The Core Rule

**Express projects MUST follow a feature-first (component-based) architecture, NOT a layer-first (technical role) architecture. Each feature/domain is a self-contained directory with its own routes, controllers, services, repositories, models, and tests. Shared infrastructure (middleware, database, auth) lives in dedicated directories. The 3-layer architecture (Controller → Service → Repository) MUST be enforced within each feature. Express route handlers MUST be thin — they delegate to services. Business logic NEVER lives in route handlers or middleware.**

```
❌ WRONG: Layer-first / MVC god folders
src/
├── controllers/
│   ├── userController.js        ← ALL controllers dumped here
│   ├── orderController.js
│   └── productController.js
├── models/
│   ├── User.js                  ← ALL models dumped here
│   ├── Order.js
│   └── Product.js
├── routes/
│   ├── userRoutes.js
│   └── orderRoutes.js
├── services/
│   ├── userService.js
│   └── orderService.js
└── utils/
    └── helpers.js               ← God file

✅ CORRECT: Feature-first / component-based
src/
├── features/
│   ├── users/
│   │   ├── users.routes.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   ├── users.model.ts
│   │   ├── users.validation.ts
│   │   ├── users.types.ts
│   │   └── __tests__/
│   │       ├── users.service.test.ts
│   │       └── users.controller.test.ts
│   ├── orders/
│   │   ├── orders.routes.ts
│   │   ├── orders.controller.ts
│   │   ├── orders.service.ts
│   │   └── ...
│   └── auth/
│       ├── auth.routes.ts
│       ├── auth.controller.ts
│       ├── auth.service.ts
│       └── ...
├── middleware/
├── config/
├── lib/
└── app.ts
```

---

## 2. Enterprise Structure

### Complete Express/Node.js API

```
my-express-api/
├── src/
│   ├── features/                          ← Feature modules (business domains)
│   │   ├── auth/
│   │   │   ├── auth.routes.ts             ← Route definitions
│   │   │   ├── auth.controller.ts         ← Request/response handling
│   │   │   ├── auth.service.ts            ← Business logic
│   │   │   ├── auth.repository.ts         ← Data access
│   │   │   ├── auth.validation.ts         ← Zod schemas for input validation
│   │   │   ├── auth.types.ts              ← TypeScript interfaces
│   │   │   ├── auth.middleware.ts          ← Feature-specific middleware
│   │   │   └── __tests__/
│   │   │       ├── auth.service.test.ts
│   │   │       ├── auth.controller.test.ts
│   │   │       └── auth.integration.test.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.routes.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts
│   │   │   ├── users.validation.ts
│   │   │   ├── users.types.ts
│   │   │   ├── dto/                       ← Data Transfer Objects
│   │   │   │   ├── create-user.dto.ts
│   │   │   │   └── update-user.dto.ts
│   │   │   └── __tests__/
│   │   │       ├── users.service.test.ts
│   │   │       └── users.integration.test.ts
│   │   │
│   │   ├── orders/
│   │   │   ├── orders.routes.ts
│   │   │   ├── orders.controller.ts
│   │   │   ├── orders.service.ts
│   │   │   ├── orders.repository.ts
│   │   │   ├── orders.validation.ts
│   │   │   ├── orders.types.ts
│   │   │   ├── events/                    ← Domain events
│   │   │   │   ├── order-created.event.ts
│   │   │   │   └── order-shipped.event.ts
│   │   │   └── __tests__/
│   │   │
│   │   └── products/
│   │       ├── products.routes.ts
│   │       ├── products.controller.ts
│   │       ├── products.service.ts
│   │       ├── products.repository.ts
│   │       └── __tests__/
│   │
│   ├── middleware/                         ← Global middleware
│   │   ├── error-handler.middleware.ts     ← Global error handler (MUST be last)
│   │   ├── auth.middleware.ts             ← JWT verification
│   │   ├── rate-limiter.middleware.ts     ← Rate limiting
│   │   ├── request-logger.middleware.ts   ← Morgan or custom logger
│   │   ├── cors.middleware.ts            ← CORS configuration
│   │   ├── helmet.middleware.ts          ← Security headers
│   │   ├── not-found.middleware.ts       ← 404 handler
│   │   └── validate.middleware.ts        ← Generic Zod validation middleware
│   │
│   ├── lib/                               ← Infrastructure / integrations
│   │   ├── database/
│   │   │   ├── client.ts                  ← Prisma/Drizzle/Knex client singleton
│   │   │   ├── migrations/               ← Database migrations
│   │   │   └── seed.ts                    ← Database seeder
│   │   ├── cache/
│   │   │   ├── redis.ts                   ← Redis client
│   │   │   └── cache.service.ts           ← Cache abstraction
│   │   ├── queue/
│   │   │   ├── bull.ts                    ← BullMQ setup
│   │   │   └── processors/
│   │   │       ├── email.processor.ts
│   │   │       └── order.processor.ts
│   │   ├── email/
│   │   │   ├── email.service.ts           ← Email sending abstraction
│   │   │   └── templates/
│   │   │       ├── welcome.html
│   │   │       └── reset-password.html
│   │   ├── storage/
│   │   │   └── s3.service.ts              ← File upload to S3
│   │   └── logger/
│   │       └── logger.ts                  ← Winston/Pino logger
│   │
│   ├── shared/                            ← Shared code (used by 3+ features)
│   │   ├── errors/
│   │   │   ├── app-error.ts               ← Custom error classes
│   │   │   ├── not-found.error.ts
│   │   │   ├── validation.error.ts
│   │   │   └── unauthorized.error.ts
│   │   ├── types/
│   │   │   ├── pagination.ts
│   │   │   ├── api-response.ts
│   │   │   └── express.d.ts               ← Express type augmentation
│   │   └── utils/
│   │       ├── async-handler.ts           ← Async error wrapper
│   │       ├── pagination.ts              ← Pagination helper
│   │       └── hash.ts                    ← Password hashing
│   │
│   ├── config/                            ← Application configuration
│   │   ├── index.ts                       ← Main config export
│   │   ├── database.config.ts
│   │   ├── auth.config.ts
│   │   ├── cors.config.ts
│   │   └── rate-limit.config.ts
│   │
│   ├── app.ts                             ← Express app setup (middleware, routes)
│   └── server.ts                          ← HTTP server startup
│
├── tests/                                 ← Integration / E2E tests
│   ├── setup/
│   │   ├── global-setup.ts                ← Test database setup
│   │   ├── global-teardown.ts
│   │   └── test-helpers.ts
│   ├── integration/
│   │   ├── users.integration.test.ts
│   │   └── orders.integration.test.ts
│   └── fixtures/
│       ├── users.fixture.ts
│       └── orders.fixture.ts
│
├── prisma/                                ← Prisma ORM (if using Prisma)
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── .env
├── .env.example
├── .env.test
├── docker-compose.yml                     ← Local dev services (DB, Redis)
├── Dockerfile
├── tsconfig.json
├── vitest.config.ts                       ← or jest.config.ts
├── eslint.config.js
└── package.json
```

---

## 3. The 3-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        HTTP Request                                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Middleware Layer         │  Auth, rate limit, validation, logging   │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Controller Layer        │  Parse request, call service, send response │
│  (users.controller.ts)   │  NO business logic here                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Service Layer           │  Business logic, orchestration, validation │
│  (users.service.ts)      │  NO HTTP concepts (req/res) here          │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Repository Layer        │  Data access, database queries             │
│  (users.repository.ts)   │  Only Prisma/Drizzle/SQL queries here     │
└──────────────────────────┬──────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Database                                      │
└─────────────────────────────────────────────────────────────────────┘

RULE: Controller → Service → Repository. NEVER skip layers.
RULE: Controllers know about HTTP (req, res). Services do NOT.
RULE: Services know about business rules. Repositories do NOT.
RULE: Repositories know about databases. Nothing else does.
RULE: Each layer ONLY calls the layer directly below it.
```

### Implementation

```typescript
// features/users/users.routes.ts
import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate } from '@/middleware/auth.middleware';
import { validate } from '@/middleware/validate.middleware';
import { createUserSchema, updateUserSchema } from './users.validation';

const router = Router();
const controller = new UsersController();

router.get('/', authenticate, controller.getAll);
router.get('/:id', authenticate, controller.getById);
router.post('/', authenticate, validate(createUserSchema), controller.create);
router.put('/:id', authenticate, validate(updateUserSchema), controller.update);
router.delete('/:id', authenticate, controller.delete);

export { router as usersRouter };
```

```typescript
// features/users/users.controller.ts
import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { asyncHandler } from '@/shared/utils/async-handler';

export class UsersController {
  private service = new UsersService();

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const result = await this.service.findAll({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
    res.json({ success: true, data: result });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.service.findById(req.params.id);
    res.json({ success: true, data: user });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.service.create(req.body);
    res.status(201).json({ success: true, data: user });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.service.update(req.params.id, req.body);
    res.json({ success: true, data: user });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.service.delete(req.params.id);
    res.status(204).send();
  });
}
```

```typescript
// features/users/users.service.ts
import { UsersRepository } from './users.repository';
import { NotFoundError } from '@/shared/errors/not-found.error';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { hashPassword } from '@/shared/utils/hash';

export class UsersService {
  private repository = new UsersRepository();

  async findAll(params: { page: number; limit: number }) {
    return this.repository.findAll(params);
  }

  async findById(id: string) {
    const user = await this.repository.findById(id);
    if (!user) throw new NotFoundError('User', id);
    return user;
  }

  async create(dto: CreateUserDto) {
    const hashedPassword = await hashPassword(dto.password);
    return this.repository.create({ ...dto, password: hashedPassword });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id); // Throws NotFoundError if missing
    return this.repository.update(id, dto);
  }

  async delete(id: string) {
    await this.findById(id);
    return this.repository.delete(id);
  }
}
```

```typescript
// features/users/users.repository.ts
import { db } from '@/lib/database/client';

export class UsersRepository {
  async findAll({ page, limit }: { page: number; limit: number }) {
    const offset = (page - 1) * limit;
    const [users, total] = await Promise.all([
      db.user.findMany({ skip: offset, take: limit, orderBy: { createdAt: 'desc' } }),
      db.user.count(),
    ]);
    return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    return db.user.findUnique({ where: { id } });
  }

  async create(data: any) {
    return db.user.create({ data });
  }

  async update(id: string, data: any) {
    return db.user.update({ where: { id }, data });
  }

  async delete(id: string) {
    return db.user.delete({ where: { id } });
  }
}
```

---

## 4. App and Server Setup

```typescript
// src/app.ts — Express application setup
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { corsConfig } from '@/config/cors.config';
import { requestLogger } from '@/middleware/request-logger.middleware';
import { rateLimiter } from '@/middleware/rate-limiter.middleware';
import { errorHandler } from '@/middleware/error-handler.middleware';
import { notFoundHandler } from '@/middleware/not-found.middleware';

// Feature routes
import { authRouter } from '@/features/auth/auth.routes';
import { usersRouter } from '@/features/users/users.routes';
import { ordersRouter } from '@/features/orders/orders.routes';
import { productsRouter } from '@/features/products/products.routes';

const app = express();

// Global middleware (ORDER MATTERS)
app.use(helmet());
app.use(cors(corsConfig));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(rateLimiter);

// Health check (before auth)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Feature routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/orders', ordersRouter);
app.use('/api/v1/products', productsRouter);

// Error handling (MUST be after routes)
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
```

```typescript
// src/server.ts — HTTP server startup
import { app } from './app';
import { config } from '@/config';
import { logger } from '@/lib/logger/logger';

const server = app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.env} mode`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', reason);
  server.close(() => process.exit(1));
});
```

```
RULE: app.ts creates the Express app (middleware + routes). server.ts starts the HTTP server.
RULE: This separation allows importing app.ts for testing without starting the server.
RULE: Error handler middleware MUST be registered LAST — after all routes.
RULE: Health check MUST be before authentication middleware.
RULE: API routes MUST be versioned: /api/v1/, /api/v2/.
RULE: Graceful shutdown MUST be implemented for production (SIGTERM handling).
```

---

## 5. Error Handling

```typescript
// shared/errors/app-error.ts
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, 404);
  }
}

export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;
  constructor(errors: Record<string, string[]>) {
    super('Validation failed', 400);
    this.errors = errors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403);
  }
}
```

```typescript
// middleware/error-handler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '@/shared/errors/app-error';
import { logger } from '@/lib/logger/logger';

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message, details: err.errors },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.constructor.name, message: err.message },
    });
  }

  // Unexpected error — log and return generic message
  logger.error('Unhandled error:', { error: err, path: req.path, method: req.method });

  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}

// shared/utils/async-handler.ts
import { Request, Response, NextFunction } from 'express';

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

```
RULE: EVERY async route handler MUST use asyncHandler() or express-async-errors.
RULE: Error handler middleware has 4 parameters (err, req, res, next).
RULE: NEVER swallow errors — always log them or propagate them.
RULE: Operational errors (AppError) return descriptive messages to clients.
RULE: Programming errors (unexpected) return generic 500 — NEVER expose internals.
RULE: NEVER send stack traces in production responses.
```

---

## 6. Validation (Zod)

```typescript
// features/users/users.validation.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    role: z.enum(['user', 'admin']).default('user'),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
  }),
});

export const getUsersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    sortBy: z.enum(['name', 'email', 'createdAt']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

// middleware/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.flatten().fieldErrors,
        },
      });
    }

    // Replace request data with parsed (coerced + defaulted) values
    req.body = result.data.body;
    req.query = result.data.query;
    req.params = result.data.params;
    next();
  };
}
```

---

## 7. Configuration

```typescript
// config/index.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  env: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  database: { url: parsed.data.DATABASE_URL },
  redis: { url: parsed.data.REDIS_URL },
  jwt: { secret: parsed.data.JWT_SECRET, expiresIn: parsed.data.JWT_EXPIRES_IN },
  cors: { origin: parsed.data.CORS_ORIGIN },
  log: { level: parsed.data.LOG_LEVEL },
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
} as const;
```

```
RULE: Validate ALL environment variables at startup with Zod.
RULE: Fail FAST — if env vars are invalid, crash immediately, don't start.
RULE: Export a typed config object — NEVER use process.env directly in features.
RULE: Provide defaults for non-critical variables.
RULE: Use .env.example as the canonical list of required env vars.
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Layer-first organization** | controllers/, services/, models/ at root | Feature-first: features/users/, features/orders/ |
| **Business logic in routes** | Route handler has 50 lines of if/else logic | Extract to service layer |
| **No error handler** | Unhandled promise rejections crash the server | Global error handler middleware + asyncHandler |
| **No validation** | Raw req.body used directly in SQL/ORM | Zod schema validation middleware on every route |
| **God service** | One AppService with 100 methods | Split by domain: UsersService, OrdersService |
| **Direct DB in controller** | `db.query('SELECT * FROM users')` in route handler | Repository pattern: controller → service → repository |
| **No env validation** | process.env.SECRET used directly, sometimes undefined | Zod schema for env vars at startup |
| **Synchronous error handling** | try/catch in every route handler | asyncHandler() wrapper or express-async-errors |
| **No graceful shutdown** | Server kills connections on SIGTERM | Handle SIGTERM, close connections, drain requests |
| **No API versioning** | /api/users with no version, breaking changes affect all clients | /api/v1/users, /api/v2/users |
| **Callback hell** | Nested callbacks for async operations | async/await throughout |
| **No request logging** | No idea which requests come in or how long they take | Morgan or Pino HTTP logger middleware |
| **Hardcoded CORS** | `app.use(cors())` with no configuration | Explicit CORS config from environment |
| **Monolithic app.ts** | Single 500-line app.ts with all middleware and routes | Separate app.ts (setup) and feature route files |

---

## 9. Enforcement Checklist

- [ ] **Feature-first structure** — features/{name}/ with co-located files
- [ ] **3-layer architecture** — controller → service → repository per feature
- [ ] **Thin controllers** — controllers only parse request and call service
- [ ] **Error handler middleware** — global error handler registered LAST
- [ ] **asyncHandler wrapper** — all async route handlers wrapped
- [ ] **Zod validation** — input validated on every route with schemas
- [ ] **Env validation at startup** — Zod schema for process.env
- [ ] **app.ts / server.ts split** — app creation separate from server startup
- [ ] **API versioning** — /api/v1/ prefix on all routes
- [ ] **Graceful shutdown** — SIGTERM handler closes connections
- [ ] **Custom error classes** — AppError hierarchy (NotFound, Validation, etc.)
- [ ] **No business logic in routes** — services own all business rules
- [ ] **Co-located tests** — __tests__/ inside each feature directory
- [ ] **Path aliases** — @/ prefix configured in tsconfig
- [ ] **Health check endpoint** — /health before any auth middleware
- [ ] **Request logging** — Morgan or Pino for HTTP request logging
