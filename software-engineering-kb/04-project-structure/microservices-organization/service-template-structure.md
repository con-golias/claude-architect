# Service Template Structure

> **AI Plugin Directive:** When creating a service scaffold / template / generator for microservice projects, ALWAYS use this guide. Apply consistent internal structure, pre-configured CI/CD, health checks, observability, and testing patterns. This guide covers how to build and use service templates so every new service starts with production-ready foundations.

**Core Rule: Every new service MUST start from a template, not from scratch. The template includes CI/CD, Dockerfile, health checks, logging, error handling, and testing setup. This ensures consistency across services and eliminates boilerplate setup time. NEVER let developers create services by copying another service and deleting code.**

---

## 1. Service Template Structure (Complete)

```
service-template/
├── src/
│   ├── main.ts                            # Application entry point
│   ├── app.ts                             # Express/Fastify app setup
│   │
│   ├── config/
│   │   ├── index.ts                       # Configuration loader
│   │   └── schema.ts                      # Zod config schema validation
│   │
│   ├── controllers/
│   │   ├── health.controller.ts           # /health and /ready endpoints
│   │   └── .gitkeep                       # Placeholder for feature controllers
│   │
│   ├── services/
│   │   └── .gitkeep                       # Placeholder for business logic
│   │
│   ├── repositories/
│   │   └── .gitkeep                       # Placeholder for data access
│   │
│   ├── events/
│   │   ├── publishers/
│   │   │   └── .gitkeep
│   │   └── consumers/
│   │       └── .gitkeep
│   │
│   ├── clients/                           # External service clients
│   │   └── .gitkeep
│   │
│   ├── middleware/
│   │   ├── error-handler.ts               # Global error handling
│   │   ├── request-logger.ts              # Structured request logging
│   │   ├── correlation-id.ts              # Distributed tracing context
│   │   ├── auth.ts                        # Authentication middleware
│   │   ├── rate-limit.ts                  # Rate limiting
│   │   └── not-found.ts                   # 404 handler
│   │
│   ├── dto/
│   │   └── .gitkeep                       # Placeholder for DTOs
│   │
│   ├── models/
│   │   └── .gitkeep                       # Placeholder for DB models
│   │
│   └── utils/
│       ├── errors.ts                      # Custom error class hierarchy
│       ├── response.ts                    # Standard response helpers
│       └── shutdown.ts                    # Graceful shutdown handler
│
├── tests/
│   ├── unit/
│   │   └── .gitkeep
│   ├── integration/
│   │   ├── health.test.ts                 # Health endpoint tests
│   │   └── .gitkeep
│   ├── contract/
│   │   └── .gitkeep                       # Pact/contract tests
│   ├── helpers/
│   │   ├── setup.ts                       # Test setup (DB, mocks)
│   │   ├── teardown.ts                    # Test teardown
│   │   └── factories.ts                   # Test data factories
│   └── .gitkeep
│
├── prisma/                                # Database (Prisma ORM)
│   ├── schema.prisma                      # Database schema
│   └── migrations/                        # Migration history
│       └── .gitkeep
│
├── .github/
│   └── workflows/
│       ├── ci.yml                         # Lint + test + build
│       └── deploy.yml                     # Deploy to environments
│
├── k8s/                                   # Kubernetes manifests
│   ├── base/
│   │   ├── kustomization.yaml
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   ├── hpa.yaml                       # Horizontal Pod Autoscaler
│   │   └── pdb.yaml                       # Pod Disruption Budget
│   └── overlays/
│       ├── dev/
│       │   ├── kustomization.yaml
│       │   └── patches/
│       │       └── replicas.yaml
│       ├── staging/
│       │   └── kustomization.yaml
│       └── production/
│           ├── kustomization.yaml
│           └── patches/
│               ├── replicas.yaml
│               └── resources.yaml
│
├── Dockerfile                             # Multi-stage production image
├── docker-compose.yml                     # Local development
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── .env.example                           # Example environment variables
├── .gitignore
├── .dockerignore
├── .nvmrc                                 # Node.js version
├── README.md
└── CHANGELOG.md
```

---

## 2. Pre-Configured Entry Point

```typescript
// src/main.ts
import { createApp } from "./app";
import { loadConfig } from "./config";
import { logger } from "@platform/logger";
import { gracefulShutdown } from "./utils/shutdown";

async function main() {
  const config = loadConfig();

  const { app, server } = await createApp(config);

  const httpServer = app.listen(config.port, () => {
    logger.info("Service started", {
      service: config.serviceName,
      port: config.port,
      environment: config.environment,
      version: config.version,
      nodeVersion: process.version,
    });
  });

  // Graceful shutdown
  gracefulShutdown(httpServer, {
    timeout: config.shutdownTimeout,
    onShutdown: async () => {
      // Close database connections
      if (server.db) await server.db.$disconnect();
      // Close message broker connections
      if (server.broker) await server.broker.close();
      // Close Redis connections
      if (server.redis) await server.redis.quit();
    },
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
```

```typescript
// src/utils/shutdown.ts
import type { Server } from "http";
import { logger } from "@platform/logger";

interface ShutdownOptions {
  timeout?: number;
  onShutdown?: () => Promise<void>;
}

export function gracefulShutdown(
  server: Server,
  options: ShutdownOptions = {}
) {
  const { timeout = 10_000, onShutdown } = options;
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}, starting graceful shutdown`, {
      timeout: `${timeout}ms`,
    });

    // Stop accepting new connections
    server.close(async () => {
      logger.info("HTTP server closed, cleaning up resources");

      try {
        if (onShutdown) await onShutdown();
        logger.info("Graceful shutdown complete");
        process.exit(0);
      } catch (err) {
        logger.error("Error during shutdown cleanup", { error: err });
        process.exit(1);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error("Forced shutdown after timeout", { timeout: `${timeout}ms` });
      process.exit(1);
    }, timeout);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (err) => {
    logger.fatal("Uncaught exception", { error: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal("Unhandled rejection", { reason: String(reason) });
    process.exit(1);
  });
}
```

---

## 3. App Setup (Express)

```typescript
// src/app.ts
import express from "express";
import helmet from "helmet";
import compression from "compression";
import { correlationId } from "./middleware/correlation-id";
import { requestLogger } from "./middleware/request-logger";
import { errorHandler } from "./middleware/error-handler";
import { notFoundHandler } from "./middleware/not-found";
import { healthRouter, registerHealthCheck } from "./controllers/health.controller";
import type { Config } from "./config";

export async function createApp(config: Config) {
  const app = express();

  // ─── Security ──────────────────────────────────────────
  app.use(helmet());
  app.use(compression());
  app.disable("x-powered-by");

  // ─── Request Processing ────────────────────────────────
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // ─── Middleware ────────────────────────────────────────
  app.use(correlationId);
  app.use(requestLogger);

  // ─── Health Checks (BEFORE auth) ──────────────────────
  app.use(healthRouter);

  // ─── Routes (add your routes here) ────────────────────
  // app.use("/v1/users", authMiddleware, userRouter);

  // ─── Error Handling (MUST be last) ────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ─── Infrastructure Connections ────────────────────────
  const server: Record<string, unknown> = {};

  // Database (uncomment when needed)
  // const { PrismaClient } = await import("@prisma/client");
  // const db = new PrismaClient();
  // await db.$connect();
  // server.db = db;
  // registerHealthCheck("database", async () => {
  //   await db.$queryRaw`SELECT 1`;
  //   return true;
  // });

  // Message broker (uncomment when needed)
  // const amqp = await import("amqplib");
  // const broker = await amqp.connect(config.rabbitmqUrl);
  // server.broker = broker;
  // registerHealthCheck("rabbitmq", async () => {
  //   return broker.connection.serverProperties !== undefined;
  // });

  return { app, server };
}
```

---

## 4. Pre-Configured Health Checks

```typescript
// src/controllers/health.controller.ts
import { Router } from "express";

interface HealthCheck {
  name: string;
  check: () => Promise<boolean>;
}

const healthChecks: HealthCheck[] = [];

export function registerHealthCheck(name: string, check: () => Promise<boolean>) {
  healthChecks.push({ name, check });
}

export const healthRouter = Router();

// Liveness probe -- is the process alive?
// K8s uses this to restart the pod if it fails.
healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: process.env.SERVICE_NAME || "unknown",
    version: process.env.VERSION || "unknown",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe -- can it serve traffic?
// K8s removes pod from load balancer if this fails.
healthRouter.get("/ready", async (_req, res) => {
  const results = await Promise.allSettled(
    healthChecks.map(async (hc) => {
      const start = Date.now();
      try {
        const healthy = await Promise.race([
          hc.check(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error("Health check timeout")), 5000)
          ),
        ]);
        return {
          name: hc.name,
          healthy,
          duration: Date.now() - start,
        };
      } catch {
        return {
          name: hc.name,
          healthy: false,
          duration: Date.now() - start,
        };
      }
    })
  );

  const checks = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { name: "unknown", healthy: false, duration: 0 }
  );

  const allHealthy = checks.every((c) => c.healthy);
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "ready" : "not_ready",
    checks,
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint (for Prometheus)
healthRouter.get("/metrics", async (_req, res) => {
  // If using @platform/metrics:
  // const { register } = await import("@platform/metrics");
  // res.set("Content-Type", register.contentType);
  // res.end(await register.metrics());

  // Placeholder:
  res.status(501).json({ message: "Metrics not configured" });
});
```

---

## 5. Pre-Configured Middleware

```typescript
// src/middleware/correlation-id.ts
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const HEADER = "x-correlation-id";

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

export function correlationId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers[HEADER] as string) || randomUUID();
  req.correlationId = id;
  res.setHeader(HEADER, id);
  next();
}


// src/middleware/request-logger.ts
import type { Request, Response, NextFunction } from "express";
import { logger } from "@platform/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Skip logging health checks
  if (req.path === "/health" || req.path === "/ready" || req.path === "/metrics") {
    return next();
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      correlationId: req.correlationId,
      userAgent: req.get("user-agent"),
      ip: req.ip,
      contentLength: res.get("content-length"),
    };

    if (res.statusCode >= 500) {
      logger.error("Request completed with server error", logData);
    } else if (res.statusCode >= 400) {
      logger.warn("Request completed with client error", logData);
    } else {
      logger.info("Request completed", logData);
    }
  });

  next();
}


// src/middleware/error-handler.ts
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { logger } from "@platform/logger";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    logger.warn("Application error", {
      code: err.code,
      status: err.statusCode,
      message: err.message,
      correlationId: req.correlationId,
    });

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
      correlationId: req.correlationId,
    });
  }

  // Unexpected error -- log full stack trace
  logger.error("Unhandled error", {
    error: err.message,
    stack: err.stack,
    correlationId: req.correlationId,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
    correlationId: req.correlationId,
  });
}


// src/middleware/not-found.ts
import type { Request, Response } from "express";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
    correlationId: req.correlationId,
  });
}


// src/utils/errors.ts
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(params: {
    message: string;
    statusCode: number;
    code: string;
    details?: unknown;
  }) {
    super(params.message);
    this.name = "AppError";
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super({ message, statusCode: 400, code: "BAD_REQUEST", details });
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super({ message, statusCode: 401, code: "UNAUTHORIZED" });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super({ message, statusCode: 403, code: "FORBIDDEN" });
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} '${id}' not found`
      : `${resource} not found`;
    super({ message, statusCode: 404, code: "NOT_FOUND" });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super({ message, statusCode: 409, code: "CONFLICT" });
    this.name = "ConflictError";
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown) {
    super({
      message: "Validation failed",
      statusCode: 422,
      code: "VALIDATION_ERROR",
      details,
    });
    this.name = "ValidationError";
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super({
      message: "Rate limit exceeded",
      statusCode: 429,
      code: "RATE_LIMITED",
      details: retryAfter ? { retryAfter } : undefined,
    });
    this.name = "RateLimitError";
  }
}
```

---

## 6. Configuration with Validation

```typescript
// src/config/schema.ts
import { z } from "zod";

export const ConfigSchema = z.object({
  serviceName: z.string().default("my-service"),
  version: z.string().default("0.0.0"),
  environment: z.enum(["development", "staging", "production"]).default("development"),
  port: z.coerce.number().int().min(1).max(65535).default(3000),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Database
  databaseUrl: z.string().url().optional(),

  // Message broker
  rabbitmqUrl: z.string().optional(),

  // Redis
  redisUrl: z.string().optional(),

  // Auth
  jwtSecret: z.string().min(32).optional(),
  jwtIssuer: z.string().default("platform"),

  // Graceful shutdown
  shutdownTimeout: z.coerce.number().int().min(1000).max(30000).default(10000),

  // Rate limiting
  rateLimitMax: z.coerce.number().int().min(1).default(100),
  rateLimitWindowMs: z.coerce.number().int().min(1000).default(60000),
});

export type Config = z.infer<typeof ConfigSchema>;


// src/config/index.ts
import { ConfigSchema, type Config } from "./schema";
import { logger } from "@platform/logger";

export function loadConfig(): Config {
  const raw = {
    serviceName: process.env.SERVICE_NAME,
    version: process.env.VERSION || process.env.npm_package_version,
    environment: process.env.NODE_ENV,
    port: process.env.PORT,
    logLevel: process.env.LOG_LEVEL,
    databaseUrl: process.env.DATABASE_URL,
    rabbitmqUrl: process.env.RABBITMQ_URL,
    redisUrl: process.env.REDIS_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtIssuer: process.env.JWT_ISSUER,
    shutdownTimeout: process.env.SHUTDOWN_TIMEOUT,
    rateLimitMax: process.env.RATE_LIMIT_MAX,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
  };

  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`
    );
    console.error("Configuration validation failed:\n" + errors.join("\n"));
    process.exit(1);
  }

  logger.info("Configuration loaded", {
    environment: result.data.environment,
    port: result.data.port,
    logLevel: result.data.logLevel,
    hasDatabase: !!result.data.databaseUrl,
    hasBroker: !!result.data.rabbitmqUrl,
    hasRedis: !!result.data.redisUrl,
  });

  return result.data;
}

export type { Config };
```

---

## 7. Dockerfile (Multi-Stage, Production-Ready)

```dockerfile
# Dockerfile
# Multi-stage build for production-ready service

# ──── Stage 1: Install dependencies ────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod=false

# ──── Stage 2: Build ────
FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN corepack enable pnpm && pnpm build
# Remove devDependencies after build
RUN pnpm prune --prod

# ──── Stage 3: Production image ────
FROM node:20-alpine AS production
WORKDIR /app

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Copy built artifacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# Prisma (uncomment if using Prisma)
# COPY --from=build /app/prisma ./prisma
# COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Set ownership
RUN chown -R appuser:nodejs /app

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

EXPOSE ${PORT:-3000}

# Use dumb-init for proper PID 1 signal forwarding
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

```dockerignore
# .dockerignore
node_modules
dist
.git
.github
.vscode
*.md
!README.md
tests
coverage
.env
.env.*
docker-compose.yml
*.log
k8s/
docs/
.changeset/
```

---

## 8. Kubernetes Manifests

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: SERVICE_NAME
  labels:
    app: SERVICE_NAME
    version: VERSION
spec:
  replicas: 2
  selector:
    matchLabels:
      app: SERVICE_NAME
  template:
    metadata:
      labels:
        app: SERVICE_NAME
        version: VERSION
    spec:
      serviceAccountName: SERVICE_NAME
      terminationGracePeriodSeconds: 30
      containers:
        - name: SERVICE_NAME
          image: REGISTRY/SERVICE_NAME:VERSION
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: PORT
              value: "3000"
            - name: NODE_ENV
              value: "production"
            - name: SERVICE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: metadata.labels['app']
          envFrom:
            - configMapRef:
                name: SERVICE_NAME-config
            - secretRef:
                name: SERVICE_NAME-secrets
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 10
            periodSeconds: 15
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
```

```yaml
# k8s/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: SERVICE_NAME
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: SERVICE_NAME
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 25
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
```

---

## 9. Template Generator (Copier)

```yaml
# copier.yml (Copier template configuration)
# https://copier.readthedocs.io/

_min_copier_version: "9.0.0"
_subdirectory: template

service_name:
  type: str
  help: "Service name (kebab-case, e.g., 'order-service')"
  validator: "{% if not service_name | regex_search('^[a-z][a-z0-9-]+$') %}Must be kebab-case{% endif %}"

service_description:
  type: str
  help: "Short description of the service"
  default: "A microservice"

port:
  type: int
  help: "HTTP port"
  default: 3000
  validator: "{% if port < 1 or port > 65535 %}Port must be 1-65535{% endif %}"

database:
  type: str
  help: "Database type"
  choices:
    - postgresql
    - mongodb
    - none
  default: postgresql

message_broker:
  type: str
  help: "Message broker type"
  choices:
    - rabbitmq
    - kafka
    - none
  default: rabbitmq

include_grpc:
  type: bool
  help: "Include gRPC server?"
  default: false

github_org:
  type: str
  help: "GitHub organization"
  default: myorg

team_name:
  type: str
  help: "Owning team name"
  default: platform-team
```

```
TEMPLATE GENERATION CLI:

# Using Copier (RECOMMENDED)
copier copy gh:myorg/service-template ./new-service
  --> Prompts for: service_name, port, database, message_broker

# Using Cookiecutter
cookiecutter gh:myorg/service-template
  --> Prompts based on cookiecutter.json

# Using Nx generators (monorepo)
nx g @myorg/generators:service --name=payment-service --port=3003

# Using GitHub Template Repository
1. Click "Use this template" on GitHub
2. Clone new repo
3. Run setup script: ./scripts/init.sh payment-service

COMPARISON:
  Copier      -- Best for updates (copier update), Jinja2 templates
  Cookiecutter -- Most popular, mature, Python-based
  Nx/Turbo    -- Best for monorepo, programmatic generators
  GitHub Tmpl -- Simplest, no tooling, one-time copy (no updates)
  Plop        -- Lightweight JS generator (micro-generators)

RECOMMENDATION:
  Monorepo  --> Nx generators or Turbo generators
  Polyrepo  --> Copier (supports template updates)
  Simple    --> GitHub Template Repository
```

---

## 10. 12-Factor App Compliance

```
THE TWELVE-FACTOR APP (https://12factor.net/):

Factor              | Implementation in Template
--------------------|--------------------------------------------------
I. Codebase         | One repo per service (or monorepo with clear boundaries)
II. Dependencies    | package.json with lockfile, no global deps
III. Config         | Environment variables, validated with Zod schema
IV. Backing services| Database URL, broker URL as env vars (attachable)
V. Build/release/run| Multi-stage Dockerfile, CI/CD pipeline
VI. Processes       | Stateless processes, no local file storage
VII. Port binding   | Self-contained HTTP server on $PORT
VIII. Concurrency   | Scale via process replication (K8s HPA)
IX. Disposability   | Graceful shutdown (SIGTERM handler), fast startup
X. Dev/prod parity  | docker-compose mirrors production (same DB, same broker)
XI. Logs            | Structured JSON to stdout, no file logging
XII. Admin processes | Database migrations as separate commands (prisma migrate)

TEMPLATE COMPLIANCE:
  [x] Config from environment variables (Factor III)
  [x] Zod validation ensures config is correct (Factor III)
  [x] Graceful shutdown handles SIGTERM (Factor IX)
  [x] Health checks for K8s (Factor IX)
  [x] Structured JSON logging to stdout (Factor XI)
  [x] Stateless -- no in-memory sessions (Factor VI)
  [x] Port from $PORT environment variable (Factor VII)
  [x] Multi-stage Dockerfile for build/release/run (Factor V)
  [x] Database URL as env var, swappable (Factor IV)
  [x] docker-compose for dev/prod parity (Factor X)
```

---

## 11. Observability Stack

```
STRUCTURED LOGGING:
  - JSON format to stdout (Factor XI)
  - Fields: timestamp, level, message, service, correlationId, requestId
  - PII redaction built-in
  - Log levels: debug, info, warn, error, fatal
  - Tool: pino (fastest Node.js logger)

DISTRIBUTED TRACING:
  - OpenTelemetry SDK
  - Automatic HTTP instrumentation
  - Correlation ID propagation via headers
  - Export to: Jaeger, Tempo, Datadog, New Relic
  - Context: service name, span name, duration, status

METRICS:
  - Prometheus client (prom-client)
  - Default metrics: request count, latency histogram, error rate
  - Custom business metrics: orders_created_total, payment_amount_sum
  - Endpoint: /metrics (scraped by Prometheus)

ALERTING SIGNALS (USE method):
  - Utilization: CPU, memory, disk usage
  - Saturation: Queue depth, connection pool usage
  - Errors: 5xx rate, exception count

OBSERVABILITY IN TEMPLATE:
  @platform/logger   -- Structured JSON logging
  @platform/tracing  -- OpenTelemetry auto-instrumentation
  @platform/metrics  -- Prometheus metrics middleware
  @platform/health   -- Health check endpoints

Example log output:
{
  "timestamp": "2024-06-15T10:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "service": "user-service",
  "correlationId": "abc-123-def-456",
  "method": "GET",
  "path": "/v1/users/123",
  "statusCode": 200,
  "duration": "45ms",
  "userId": "usr_789"
}
```

---

## 12. Keeping Templates Updated

```
TEMPLATE MAINTENANCE STRATEGY:

1. Version the template
   - Tag template releases (v1.0.0, v1.1.0)
   - CHANGELOG for template changes
   - Semantic versioning: major = breaking layout changes

2. Propagate updates with Copier
   # In a service created from template:
   copier update
   # Shows diff, lets you accept/reject changes
   # Tracks template version in .copier-answers.yml

3. Alternative: cruft (for cookiecutter templates)
   cruft check    # Check if service is up-to-date
   cruft diff     # Show differences from template
   cruft update   # Apply template updates

4. Required vs optional changes
   Security updates: REQUIRED (auto-merge via bot)
   CI improvements: REQUIRED (PR for review)
   Dependency bumps: REQUIRED (Renovate/Dependabot)
   New features: OPTIONAL (team decides)
   Style changes: OPTIONAL

5. Template CI
   - The template itself has CI that builds and tests it
   - Every PR to the template runs: build, test, lint
   - Template is NEVER in a broken state

ANTI-PATTERN: Template drift
  Template evolves but existing services don't update.
  After 6 months, services are completely different from template.

FIX: Monthly template update check (automated via CI cron job)
  - Bot opens PRs on services that are behind
  - Dashboard shows template version per service
```

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Impact | Fix |
|-------------|---------|--------|-----|
| Copy-paste from existing service | Leftover business logic, wrong config | Tech debt from day 1 | Use Copier/cookiecutter template |
| Template never updated | New services miss security patches | Growing divergence, inconsistency | Version template, copier update |
| Too much in template | Services bloated with unused code | Confusion, dead code, slow startup | Minimal template + optional features |
| No health checks | Services silently fail, bad K8s routing | Users see errors, restarts don't help | /health (liveness) + /ready (readiness) |
| No graceful shutdown | Connection leaks, in-flight requests lost | Data loss, error spikes during deploys | SIGTERM handler with timeout |
| No correlation ID | Cannot trace requests across services | Impossible to debug distributed issues | x-correlation-id header propagation |
| No error handling | Unhandled exceptions crash process | Random restarts, poor error messages | Global error handler middleware |
| Template doesn't build | Template itself is broken | New services start broken | CI pipeline on the template repository |
| process.exit(0) on error | No cleanup, connections leaked | Resource leaks, corrupt state | Graceful shutdown with cleanup |
| No structured logging | Logs are unstructured text | Can't search, filter, or aggregate | JSON structured logging (pino) |
| Console.log in production | No log levels, no structure | Can't filter by severity | Use logger with levels (debug/info/warn/error) |
| No Dockerfile | "Works on my machine" | Can't deploy, inconsistent environments | Multi-stage Dockerfile in template |
| Root user in container | Security vulnerability | Container escape risk | Non-root user (UID 1001) |

---

## 14. Enforcement Checklist

- [ ] Template exists -- NEVER create services from scratch
- [ ] Template builds and tests pass -- CI on template repo
- [ ] Dockerfile included -- multi-stage, non-root, dumb-init, HEALTHCHECK
- [ ] CI/CD pipeline included -- lint, test, build, deploy stages
- [ ] Health endpoints -- /health (liveness) and /ready (readiness)
- [ ] Graceful shutdown -- SIGTERM/SIGINT handlers with cleanup and timeout
- [ ] Structured logging -- JSON to stdout, correlation IDs, PII redaction
- [ ] Error handling -- global handler, custom error hierarchy, proper HTTP codes
- [ ] Correlation ID -- x-correlation-id propagation across services
- [ ] Configuration validation -- Zod schema for all env vars
- [ ] Test framework configured -- Vitest with health check test
- [ ] K8s manifests -- deployment, service, HPA, PDB, kustomize overlays
- [ ] Security -- helmet, non-root user, read-only filesystem, rate limiting
- [ ] .env.example -- documents ALL environment variables
- [ ] README -- setup, running, testing, deploying, architecture
- [ ] CHANGELOG.md -- tracks changes
- [ ] Template versioned -- tagged releases with semantic versioning
- [ ] Update mechanism -- Copier/cruft for propagating template changes
- [ ] 12-factor compliance -- stateless, config from env, logs to stdout
- [ ] Observability -- logging + tracing + metrics endpoints
