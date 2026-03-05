---
mode: manual
---
## Microservices Architecture

### Service Boundaries (Bounded Contexts)
- Define each service around a single bounded context from domain-driven design
- A service MUST own its entire domain: data, business logic, and API — no sharing of internals
- If two services constantly need to change together, they belong in the same service
- Services communicate through public API contracts only — never bypass via shared libraries containing business logic
- Start with a modular monolith — extract to microservices only when you have proven boundary stability

### Data Ownership
- Each service MUST own its database — NEVER share a database between services
- Other services access data ONLY through the owning service's API — no cross-service direct queries
- Duplicate data across services when needed — accept eventual consistency over tight coupling
- Each service defines its own schema and migrates independently
- Shared reference data (countries, currencies) is replicated via events, not shared tables

### Inter-Service Communication
- Prefer asynchronous messaging (events/queues) for operations that do not require an immediate response
- Use synchronous calls (HTTP/gRPC) only when the caller cannot proceed without the response
- Define explicit API contracts (OpenAPI, Protobuf) for all service-to-service interfaces
- Version all service APIs — consumers MUST specify which version they depend on
- NEVER chain more than 3 synchronous calls in a single request path — redesign with async if deeper

### Event-Driven Patterns
- Publish domain events for state changes that other services need to know about
- Events MUST be immutable facts about what happened — not commands telling others what to do
- Use a schema registry to validate event formats across producers and consumers
- Design consumers to be idempotent — events may be delivered more than once
- Include event metadata: eventId, timestamp, source, correlationId, schema version

### Distributed Transactions (Saga Pattern)
- NEVER use distributed two-phase commit (2PC) across services — it creates tight coupling and fragility
- Use the Saga pattern: a sequence of local transactions with compensating actions for rollback
- Prefer choreography (event-driven) for simple sagas with few steps
- Use orchestration (central coordinator) for complex sagas with branching or conditional logic
- Every saga step MUST have a defined compensating action — document the rollback for each step
- Test saga failure at every step — verify compensating actions restore consistent state

### API Gateway
- Route all external traffic through an API gateway — services are never exposed directly
- Centralize cross-cutting concerns at the gateway: authentication, rate limiting, request logging
- The gateway performs routing and policy enforcement only — NEVER put business logic in the gateway
- Implement request aggregation at the gateway for client-facing endpoints that need data from multiple services

### Service Discovery & Networking
- Use service discovery (DNS, Consul, Kubernetes Services) — never hardcode service URLs
- Implement client-side or server-side load balancing for all inter-service calls
- Use service mesh (Istio, Linkerd) for observability, mTLS, and traffic management at scale
- Design for network partitions — services MUST handle unreachable peers gracefully

### Observability Across Services
- Propagate correlation IDs (W3C Trace Context) through all service calls — required for debugging
- Centralize logs from all services into a single searchable system
- Track inter-service latency and error rates per endpoint pair
- Implement distributed tracing to visualize request flow across service boundaries

### Deployment Independence
- Each service MUST be independently deployable — deploying service A should never require deploying service B
- Use backward-compatible API changes (additive only) — breaking changes require versioned endpoints
- Run contract tests between services to catch integration breaks before deployment
- Each service has its own CI/CD pipeline, version number, and release cadence
