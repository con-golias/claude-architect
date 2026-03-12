# Backend

> **Domain:** Software Engineering > Backend
> **Difficulty:** Intermediate–Advanced
> **Last Updated:** —

Comprehensive backend engineering knowledge base covering API design, authentication, data management, infrastructure patterns, and production operations.

## Contents

### API Design
| Folder | Files | Description |
|--------|--------|-----------|
| `api-design/grpc/` | overview, protobuf, when-to-use | gRPC architecture, Protocol Buffers, decision framework |
| `api-design/rest/` | principles | RESTful API design principles and patterns |
| `api-design/websockets/` | overview, patterns, scaling-websockets | WebSocket protocol, messaging patterns, horizontal scaling |

### Authentication & Authorization
| Folder | Files | Description |
|--------|--------|-----------|
| `authentication-authorization/` | auth-fundamentals, jwt-tokens, session-management, rbac-abac, auth-providers, multi-tenancy | Authentication flows, JWT, sessions, RBAC/ABAC |
| `authentication-authorization/oauth2-oidc/` | oauth2-flows, openid-connect | OAuth 2.0 grants, OpenID Connect integration |

### Data Processing & Validation
| Folder | Files | Description |
|--------|--------|-----------|
| `data-validation/` | input-validation, sanitization | Input validation rules, sanitization strategies |
| `data-validation/schema-validation/` | schema-definition, advanced-patterns, error-handling | JSON Schema, Zod, validation error formatting |
| `data-validation/dto-serialization/` | dto-patterns, serialization-formats, mapping-transforms | DTO design, serialization, object mapping |

### Caching
| Folder | Files | Description |
|--------|--------|-----------|
| `caching/caching-strategies/` | core-patterns, eviction-ttl | Cache-aside, write-through, eviction policies |
| `caching/` | cache-invalidation, distributed-caching, http-caching | Invalidation strategies, distributed cache, HTTP cache headers |
| `caching/redis-in-practice/` | data-structures, operational-patterns | Redis data types, persistence, clustering |

### Messaging & Background Processing
| Folder | Files | Description |
|--------|--------|-----------|
| `message-queues/` | overview, kafka, rabbitmq, redis-streams, sqs-sns | Message queue comparison and implementations |
| `message-queues/patterns/` | messaging-patterns, error-handling-dlq | Pub/sub, fan-out, dead letter queues |
| `background-jobs/job-queues/` | architecture, implementations | Job queue design, BullMQ, Celery, Asynq |
| `background-jobs/` | retry-strategies, idempotency | Exponential backoff, idempotency keys |
| `background-jobs/scheduled-tasks/` | scheduling-patterns, cron-orchestration | Cron scheduling, distributed task orchestration |

### Webhooks
| Folder | Files | Description |
|--------|--------|-----------|
| `webhooks/` | webhook-design, webhook-delivery, webhook-security | Event schemas, retry/DLQ, HMAC signing, SSRF prevention |

### Error Handling & Resilience
| Folder | Files | Description |
|--------|--------|-----------|
| `error-handling/error-strategies/` | error-types-hierarchy, error-responses, logging-monitoring | Error classification, response formatting |
| `error-handling/` | circuit-breakers, retry-patterns, graceful-degradation, timeout-management | Circuit breaker, retry, degradation, timeouts |
| `health-resilience/` | health-checks, graceful-shutdown | Liveness/readiness probes, graceful shutdown |
| `health-resilience/resilience-patterns/` | stability-patterns, load-management, chaos-engineering | Bulkheads, load shedding, chaos testing |

### Security
| Folder | Files | Description |
|--------|--------|-----------|
| `security/` | web-security, injection-prevention, api-security | Security headers, CSRF, XSS, SQL injection, OWASP API Top 10 |
| `security/cryptography/` | hashing-encryption, tls-certificates | Argon2id, AES-256-GCM, envelope encryption, TLS 1.3, mTLS, cert management |
| `security/security-testing/` | sast-dast, devsecops-pipeline | Semgrep, CodeQL, OWASP ZAP, SCA, secret scanning, CI/CD security gates |
| `security/data-protection/` | pii-handling, compliance-frameworks | PII classification, data masking, GDPR, PCI DSS, SOC 2, audit logging |

### Observability
| Folder | Files | Description |
|--------|--------|-----------|
| `logging-observability/structured-logging/` | log-architecture, correlation-context | Structured logging, correlation IDs |
| `logging-observability/` | distributed-tracing, error-tracking | OpenTelemetry tracing, Sentry integration |
| `logging-observability/metrics/` | application-metrics, alerting-slos | Prometheus metrics, SLO/SLI alerting |

### Infrastructure Patterns
| Folder | Files | Description |
|--------|--------|-----------|
| `middleware-pipeline/` | middleware-patterns, request-lifecycle, interceptors-guards | Middleware ordering, request pipeline, guards |
| `rate-limiting/` | algorithms, api-quotas, distributed-rate-limiting | Token bucket, sliding window, Redis-based limiting |
| `configuration/` | environment-management, feature-flags, secrets-management, validation-schemas | Env vars, feature toggles, vault, config validation |

### File & Email
| Folder | Files | Description |
|--------|--------|-----------|
| `file-handling/upload-strategies/` | multipart-uploads, presigned-urls, chunked-resumable | Upload patterns, S3 presigned URLs, resumable uploads |
| `file-handling/` | storage-s3-gcs, streaming | Cloud storage, file streaming |
| `file-handling/image-processing/` | image-pipeline, optimization-formats | Image pipeline, Sharp/libvips, WebP/AVIF |
| `email-notifications/` | transactional-email, delivery-reliability, webhook-events | Email sending, deliverability, status webhooks |
| `email-notifications/notification-systems/` | architecture, channels-routing, templates-preferences | Multi-channel notifications, routing, templates |

### Real-time & Search
| Folder | Files | Description |
|--------|--------|-----------|
| `real-time/` | websockets, server-sent-events, long-polling, real-time-at-scale | Real-time protocol comparison and scaling |
| `search/` | full-text-search, elasticsearch, search-patterns | Inverted indexes, Elasticsearch, search API patterns |

### Server Frameworks
| Folder | Files | Description |
|--------|--------|-----------|
| `server-frameworks/` | comparison, express-fastify-node, gin-fiber-go, spring-boot-java, aspnet-csharp, django-fastapi-python | Framework comparison, production setup per language |

### Testing
| Folder | Files | Description |
|--------|--------|-----------|
| `testing/unit-integration/` | unit-testing, integration-testing, mocking-strategies | Unit tests, Testcontainers, mocking patterns |
| `testing/api-testing/` | endpoint-testing, contract-testing | API tests, Pact consumer-driven contracts |
| `testing/test-architecture/` | test-strategy, test-patterns | Test pyramid, CI/CD, property-based testing, load testing |

## How It Connects to Other Topics

- **Fundamentals** (`01-fundamentals/`) — Algorithms, data structures, design patterns used throughout backend code
- **Databases** (`05-databases/`) — SQL, NoSQL, ORMs referenced in caching, search, and data validation
- **DevOps** (`07-devops/`) — CI/CD pipelines, Docker, Kubernetes for deployment of backend services
- **System Design** (`08-system-design/`) — Distributed system patterns, scalability, and architecture decisions
- **Frontend** (`03-frontend/`) — API consumers, real-time connections, authentication flows
