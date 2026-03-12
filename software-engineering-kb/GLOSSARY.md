# Glossary — A-Z

A comprehensive glossary of software engineering terms covered in this knowledge base.
Each term includes a brief definition and a reference to the relevant section.

---

## A

**Abstraction** — Hiding complexity behind a simplified interface. One of the core concepts of OOP.
→ `01-fundamentals/clean-code/01-principles/abstraction`

**Abstract Factory** — Creational design pattern that creates families of related objects without specifying their concrete classes.
→ `01-fundamentals/design-patterns/02-creational/abstract-factory`

**Accessibility (A11y)** — Designing applications usable by people with disabilities: screen readers, keyboard navigation, color contrast, etc.
→ `14-accessibility-i18n/accessibility`

**Actor Model** — Concurrent programming model where independent actors communicate via messages, without shared state.
→ `01-fundamentals/programming-paradigms/06-concurrent-and-parallel/actor-model`

**Adapter Pattern** — Structural pattern that converts one interface into another expected by the client.
→ `01-fundamentals/design-patterns/03-structural/adapter`

**ADR (Architecture Decision Record)** — Documentation of architectural decisions: context, decision, consequences.
→ `03-architecture/decision-records`

**Algebraic Data Types** — Composite types (sum types, product types) used primarily in functional languages.
→ `01-fundamentals/programming-paradigms/09-generic-and-type-level/algebraic-data-types`

**Angular** — TypeScript-based frontend framework by Google with an opinionated structure (modules, components, services, DI).
→ `05-frontend/web/frameworks/angular`

**Anti-Patterns** — Commonly used but ineffective solutions to recurring problems — the opposite of design patterns.
→ `01-fundamentals/design-patterns/07-anti-patterns`

**API (Application Programming Interface)** — A contract for communication between software components. REST, GraphQL, gRPC, WebSockets.
→ `06-backend/api-design`

**API Testing** — Automated verification of API endpoints for correctness, performance, and security.
→ `06-backend/testing/api-testing`

**AOP (Aspect-Oriented Programming)** — Paradigm that separates cross-cutting concerns (logging, security) from business logic.
→ `01-fundamentals/programming-paradigms/10-aspect-oriented`

**Async Programming** — Technique for executing non-blocking operations (async/await, Promises, callbacks, futures).
→ `01-fundamentals/programming-paradigms/06-concurrent-and-parallel/async-programming`

**Authentication** — Verifying the identity of a user (login, tokens, biometrics).
→ `06-backend/authentication-authorization`

**Authorization** — Controlling permissions: what an authenticated user is allowed to do.
→ `06-backend/authentication-authorization`

**AVL Tree** — Self-balancing BST where the height difference between left and right subtrees never exceeds 1.
→ `01-fundamentals/data-structures/04-trees/balanced-trees/avl-trees`

**AWS (Amazon Web Services)** — Amazon's cloud platform. EC2, S3, Lambda, RDS, DynamoDB, etc.
→ `12-devops-infrastructure/cloud-providers/aws`

**Azure** — Microsoft's cloud platform. App Services, Azure Functions, Cosmos DB, etc.
→ `12-devops-infrastructure/cloud-providers/azure`

---

## B

**Backtracking** — Algorithmic technique that tries solutions step by step, undoing (backtracking) when it hits a dead end.
→ `01-fundamentals/algorithms/10-backtracking`

**Background Jobs** — Tasks executed asynchronously outside the request-response cycle (job queues, scheduled tasks).
→ `06-backend/background-jobs`

**Benchmarking** — Measuring and comparing performance across implementations, tools, or versions.
→ `09-performance/benchmarking`

**Big O Notation** — Mathematical notation for the asymptotic complexity of an algorithm: O(1), O(n), O(n log n), O(n²).
→ `01-fundamentals/data-structures/07-complexity-and-selection/big-o-cheatsheet`

**Binary Search Tree (BST)** — A tree where each node is greater than its left children and less than its right children.
→ `01-fundamentals/data-structures/04-trees/binary-search-trees`

**Binary Tree** — A tree where each node has at most two children.
→ `01-fundamentals/data-structures/04-trees/binary-trees`

**Bit Manipulation** — Techniques for operating on bits (AND, OR, XOR, shift) for efficient computations.
→ `01-fundamentals/algorithms/14-bit-manipulation`

**Bloom Filter** — Probabilistic data structure: can say "definitely not present" or "probably present."
→ `01-fundamentals/data-structures/06-advanced/bloom-filters`

**Boy Scout Rule** — "Leave the code better than you found it."
→ `01-fundamentals/clean-code/01-principles/boy-scout-rule`

**Bridge Pattern** — Structural pattern that separates abstraction from implementation so they can evolve independently.
→ `01-fundamentals/design-patterns/03-structural/bridge`

**B-Tree** — Self-balancing search tree, fundamental to databases and file systems.
→ `01-fundamentals/data-structures/04-trees/b-trees`

**Builder Pattern** — Creational pattern that constructs complex objects step by step.
→ `01-fundamentals/design-patterns/02-creational/builder`

---

## C

**Caching** — Storing data in a fast layer (memory, CDN, Redis) to reduce latency and load.
→ `06-backend/caching`, `09-performance/caching-strategies`

**Capacity Planning** — Forecasting resource needs (CPU, RAM, storage, bandwidth) for a system.
→ `10-scalability/capacity-planning`

**CDC (Change Data Capture)** — Technique for capturing database changes in real time.
→ `07-database/change-data-capture`

**CDN (Content Delivery Network)** — Network of edge servers that serve static/cached content close to the user.
→ `10-scalability/cdn-and-edge`

**Chain of Responsibility** — Behavioral pattern: a chain of handlers processes a request sequentially.
→ `01-fundamentals/design-patterns/04-behavioral/chain-of-responsibility`

**CI/CD (Continuous Integration / Continuous Delivery)** — Automated build, test, and deploy pipeline.
→ `12-devops-infrastructure/ci-cd`

**Circular Buffer** — Fixed-size buffer that works as a ring: overwrites the oldest data.
→ `01-fundamentals/data-structures/02-stacks-and-queues/circular-buffer`

**Clean Architecture** — Architectural model (Robert C. Martin) with concentric layers: Entities → Use Cases → Interface Adapters → Frameworks.
→ `03-architecture/clean-architecture`

**Closure** — A function that "remembers" the lexical scope in which it was declared.
→ `01-fundamentals/programming-paradigms/04-functional/closures-and-currying`

**Code Review** — Systematic examination of code by peers to find bugs and improve quality.
→ `13-code-quality/code-review`

**Code Smells** — Indicators in code that suggest deeper design problems.
→ `01-fundamentals/clean-code/08-code-smells`

**Cohesion** — The degree to which elements of a module relate to each other. High cohesion = good.
→ `01-fundamentals/clean-code/04-classes-and-objects/cohesion`

**Collision Resolution** — Techniques for handling hash collisions: chaining, open addressing, Robin Hood hashing.
→ `01-fundamentals/data-structures/03-hash-based/collision-resolution`

**Command Pattern** — Behavioral pattern that encapsulates a request as an object, supporting undo/redo.
→ `01-fundamentals/design-patterns/04-behavioral/command`

**Compliance** — Conformance with regulations: GDPR, HIPAA, SOC 2, PCI-DSS.
→ `08-security/compliance`

**Composite Pattern** — Structural pattern for tree structures, where leaf and composite nodes are treated uniformly.
→ `01-fundamentals/design-patterns/03-structural/composite`

**Composition over Inheritance** — Principle that favors object composition over deep inheritance hierarchies.
→ `01-fundamentals/clean-code/01-principles/composition-over-inheritance`

**Concurrency** — Executing multiple tasks with overlapping time periods (threads, coroutines, processes).
→ `01-fundamentals/programming-paradigms/06-concurrent-and-parallel/concurrency-fundamentals`

**Constraint Programming** — Declarative paradigm: declare constraints, the solver finds solutions.
→ `01-fundamentals/programming-paradigms/05-declarative/constraint-programming`

**Contract Testing** — Tests that verify two services adhere to an agreed-upon API contract.
→ `11-testing/contract-testing`

**Coupling** — The degree of interdependence between modules. Loose coupling = good.
→ `01-fundamentals/clean-code/04-classes-and-objects/coupling`

**CQRS (Command Query Responsibility Segregation)** — Separating read/write models for scalability and clarity.
→ `01-fundamentals/design-patterns/05-architectural/cqrs-event-sourcing`

**Cross-Platform Mobile** — Building mobile apps from a single codebase: Flutter, React Native, MAUI.
→ `05-frontend/mobile/cross-platform`

**Cryptography** — Encryption, hashing, digital signatures, key management.
→ `06-backend/security/cryptography`

**CSP (Communicating Sequential Processes)** — Concurrency model based on channels (Go, Clojure core.async).
→ `01-fundamentals/programming-paradigms/06-concurrent-and-parallel/csp-and-channels`

**Currying** — Transforming a function with multiple parameters into a sequence of single-parameter functions.
→ `01-fundamentals/programming-paradigms/04-functional/closures-and-currying`

---

## D

**Dart** — Google's language, the primary language for the Flutter framework.
→ `02-languages-and-runtimes/dart`

**Data Modeling** — Designing data structures: ER diagrams, normalization, denormalization.
→ `07-database/data-modeling`

**Data Pipelines** — ETL/ELT workflows for transferring and transforming data.
→ `07-database/data-pipelines`

**Data Validation** — Verifying incoming data: schema validation, DTOs, sanitization.
→ `06-backend/data-validation`

**DDD (Domain-Driven Design)** — Software design methodology centered around the business domain: Bounded Contexts, Aggregates, Entities, Value Objects.
→ `03-architecture/domain-driven-design`

**Decorator Pattern** — Structural pattern that adds behavior to objects dynamically, without subclassing.
→ `01-fundamentals/design-patterns/03-structural/decorator`

**Decorators (Metaprogramming)** — Annotations/decorators in languages (Python, TypeScript, Java) for cross-cutting concerns.
→ `01-fundamentals/programming-paradigms/08-metaprogramming/decorators-and-annotations`

**Defensive Programming** — Code that proactively handles edge cases, invalid inputs, and unexpected states.
→ `01-fundamentals/clean-code/07-error-handling/defensive-programming`

**Dependency Injection (DI)** — Technique where dependencies are provided externally rather than created inside the component.
→ `01-fundamentals/design-patterns/05-architectural/dependency-injection`

**Dependency Inversion Principle (DIP)** — SOLID principle: high-level modules should not depend on low-level modules; both should depend on abstractions.
→ `01-fundamentals/solid-principles/06-dependency-inversion`

**Deque (Double-ended Queue)** — Data structure supporting insertion/removal from both ends.
→ `01-fundamentals/data-structures/02-stacks-and-queues/deques`

**Design Systems** — Reusable UI component systems, tokens, and guidelines (Material, Ant Design, custom).
→ `05-frontend/design-systems`

**DevSecOps** — Integrating security at every stage of the DevOps lifecycle.
→ `08-security/devsecops`

**DIP** — See **Dependency Inversion Principle**.

**Disjoint Sets (Union-Find)** — Data structure for efficient grouping/union-find operations.
→ `01-fundamentals/data-structures/06-advanced/disjoint-sets`

**Distributed Databases** — Databases distributed across multiple nodes: replication, sharding, consensus.
→ `07-database/distributed-databases`

**Divide and Conquer** — Algorithmic strategy: split the problem, solve the parts, combine the results.
→ `01-fundamentals/algorithms/09-divide-and-conquer`

**Docker** — Container platform: packaging applications into lightweight, portable containers.
→ `12-devops-infrastructure/containers/docker`

**Document Stores** — NoSQL databases (MongoDB, Firestore) that store data as JSON-like documents.
→ `07-database/nosql/document-stores`

**DRY (Don't Repeat Yourself)** — Principle of avoiding duplication of code and knowledge.
→ `01-fundamentals/clean-code/01-principles/dry`

**DSL (Domain-Specific Language)** — A language designed for a specific domain: SQL, regex, Terraform HCL.
→ `01-fundamentals/programming-paradigms/05-declarative/domain-specific-languages`

**DTO (Data Transfer Object)** — An object that carries data between layers without business logic.
→ `06-backend/data-validation/dto-serialization`

**Dynamic Arrays** — Arrays that automatically resize (ArrayList, Vec, list).
→ `01-fundamentals/data-structures/01-arrays-and-lists/dynamic-arrays`

**Dynamic Programming (DP)** — Problem-solving technique using stored subproblem results (memoization/tabulation).
→ `01-fundamentals/algorithms/07-dynamic-programming`

---

## E

**E2E Testing (End-to-End)** — Automated tests of full user flows: Cypress, Playwright, Selenium.
→ `11-testing/e2e-testing`

**Email & Notifications** — Sending email (SMTP, SendGrid) and push/in-app notifications.
→ `06-backend/email-notifications`

**Encapsulation** — Hiding internal state, exposing only through a controlled interface.
→ `01-fundamentals/clean-code/01-principles/encapsulation`

**Error Handling** — Strategies for managing errors: exceptions, Result types, error boundaries.
→ `01-fundamentals/clean-code/07-error-handling`, `06-backend/error-handling`

**Error Tracking** — Tools (Sentry, Bugsnag) for automatically capturing and reporting production errors.
→ `12-devops-infrastructure/monitoring-observability/error-tracking`

**Estimation** — Effort estimation techniques: story points, t-shirt sizing, PERT.
→ `15-product-engineering/estimation`

**Event-Driven Architecture** — A system where components communicate via events instead of direct calls.
→ `03-architecture/architectural-patterns/event-driven`

**Event Sourcing** — Storing state as a sequence of immutable events instead of a current snapshot.
→ `01-fundamentals/design-patterns/05-architectural/cqrs-event-sourcing`

---

## F

**Facade Pattern** — Structural pattern that provides a simplified interface to a complex subsystem.
→ `01-fundamentals/design-patterns/03-structural/facade`

**Factory Method** — Creational pattern: creating objects via a method instead of direct instantiation.
→ `01-fundamentals/design-patterns/02-creational/factory-method`

**Fenwick Tree (Binary Indexed Tree)** — Data structure for efficient prefix sum queries and updates.
→ `01-fundamentals/data-structures/06-advanced/fenwick-trees`

**File Handling** — Upload strategies, image processing, storage (local, S3, CDN).
→ `06-backend/file-handling`

**Flyweight Pattern** — Structural pattern that shares state among many objects to save memory.
→ `01-fundamentals/design-patterns/03-structural/flyweight`

**Forms & Validation** — Client-side form handling: validation rules, error messages, UX.
→ `05-frontend/web/forms-validation`

**Frontend Performance** — Web performance optimization: bundle size, lazy loading, Core Web Vitals.
→ `09-performance/frontend-performance`

**Functional Programming** — Paradigm based on pure functions, immutability, composition, and higher-order functions.
→ `01-fundamentals/programming-paradigms/04-functional`

---

## G

**GCP (Google Cloud Platform)** — Google's cloud platform. GKE, Cloud Run, BigQuery, Firestore, etc.
→ `12-devops-infrastructure/cloud-providers/gcp`

**Generic Programming** — Writing code that works with multiple types via generics/templates.
→ `01-fundamentals/programming-paradigms/09-generic-and-type-level/generic-programming`

**Go (Golang)** — Compiled language by Google. Goroutines, channels, simplicity, fast compilation.
→ `02-languages-and-runtimes/go`

**Graph** — Data structure: vertices (nodes) connected by edges. Directed, undirected, weighted.
→ `01-fundamentals/data-structures/05-graphs`

**Graph Algorithms** — BFS, DFS, Dijkstra, Bellman-Ford, Kruskal, Prim, topological sort.
→ `01-fundamentals/algorithms/06-graph-algorithms`

**GraphQL** — Query language for APIs: the client requests exactly the data it needs.
→ `06-backend/api-design/graphql`

**Greedy Algorithms** — Algorithms that make the locally optimal choice at each step.
→ `01-fundamentals/algorithms/08-greedy`

**gRPC** — High-performance RPC framework (Google) based on Protocol Buffers and HTTP/2.
→ `06-backend/api-design/grpc`

---

## H

**Hash Function** — A function that converts input into a fixed-size hash value.
→ `01-fundamentals/data-structures/03-hash-based/hash-functions`

**Hash Set** — A set of unique elements based on a hash table. O(1) lookup.
→ `01-fundamentals/data-structures/03-hash-based/hash-sets`

**Hash Table (HashMap)** — Key-value data structure with O(1) average lookup. A fundamental data structure.
→ `01-fundamentals/data-structures/03-hash-based/hash-tables`

**Health Checks & Resilience** — Patterns: circuit breaker, retry, bulkhead, health endpoints.
→ `06-backend/health-resilience`

**Heap** — Tree-based data structure: min-heap or max-heap. The basis for priority queues.
→ `01-fundamentals/data-structures/04-trees/heaps`

**Higher-Order Functions** — Functions that accept or return other functions (map, filter, reduce).
→ `01-fundamentals/programming-paradigms/04-functional/higher-order-functions`

**Horizontal Scaling (Scale Out)** — Adding more machines instead of upgrading a single one.
→ `10-scalability/horizontal-scaling`

---

## I

**i18n (Internationalization)** — Designing software to support multiple languages, locales, and currencies.
→ `14-accessibility-i18n/internationalization`

**IaC (Infrastructure as Code)** — Declaring infrastructure through code: Terraform, Pulumi, CloudFormation.
→ `12-devops-infrastructure/infrastructure-as-code`

**Image Processing** — Server-side image manipulation: resize, crop, optimize, format conversion.
→ `06-backend/file-handling/image-processing`

**Immutability** — Data that cannot be changed after creation. Fundamental in functional programming.
→ `01-fundamentals/programming-paradigms/04-functional/immutability`

**Incident Management** — Processes for handling production incidents: on-call, postmortems, runbooks.
→ `12-devops-infrastructure/incident-management`

**Inheritance** — OOP mechanism: a class inherits properties/methods from a parent class.
→ `01-fundamentals/programming-paradigms/03-object-oriented/inheritance`

**Integration Testing** — Tests for the interaction between components/services.
→ `11-testing/integration-testing`

**Interface Segregation Principle (ISP)** — SOLID principle: clients should not depend on interfaces they don't use.
→ `01-fundamentals/solid-principles/05-interface-segregation`

**Interpreter Pattern** — Behavioral pattern for evaluating language expressions or DSLs.
→ `01-fundamentals/design-patterns/04-behavioral/interpreter`

**Iterator Pattern** — Behavioral pattern: sequential access to collection elements without exposing internal structure.
→ `01-fundamentals/design-patterns/04-behavioral/iterator`

---

## J

**Java** — Object-oriented, strongly-typed language. JVM, enterprise ecosystems, Android (legacy).
→ `02-languages-and-runtimes/java-kotlin`

**JavaScript** — The language of the web. Dynamic, prototype-based, single-threaded (event loop).
→ `02-languages-and-runtimes/javascript-typescript`

**Job Queues** — Task queues (BullMQ, Sidekiq, Celery) for asynchronous processing.
→ `06-backend/background-jobs/job-queues`

---

## K

**Key-Value Stores** — NoSQL databases (Redis, DynamoDB) that store data as key-value pairs.
→ `07-database/nosql/key-value`

**KISS (Keep It Simple, Stupid)** — Principle: prefer simple solutions. Complexity is the enemy.
→ `01-fundamentals/clean-code/01-principles/kiss`

**Kotlin** — Modern JVM language (JetBrains). Null safety, coroutines, concise syntax. Official for Android.
→ `02-languages-and-runtimes/java-kotlin`

**Kubernetes (K8s)** — Container orchestration platform: pods, services, deployments, auto-scaling.
→ `12-devops-infrastructure/containers/orchestration/kubernetes`

---

## L

**Law of Demeter** — "Only talk to your immediate friends." Avoid train wrecks (a.b.c.d).
→ `01-fundamentals/clean-code/01-principles/law-of-demeter`

**Linters & Formatters** — Automated style/quality checking tools: ESLint, Prettier, Ruff, dotnet format.
→ `13-code-quality/linting-formatting`

**Linked List** — Data structure: a chain of nodes, each pointing to the next (singly, doubly, circular).
→ `01-fundamentals/data-structures/01-arrays-and-lists/linked-lists`

**Liskov Substitution Principle (LSP)** — SOLID principle: subtype objects must be substitutable for their parent type without side effects.
→ `01-fundamentals/solid-principles/04-liskov-substitution`

**LLM (Large Language Model)** — AI models (GPT, Claude, Gemini) for text generation, code completion, reasoning.
→ `16-ai-integration/llm-integration`

**Logging** — Recording events: structured logging, log levels, log aggregation (ELK, Loki).
→ `06-backend/logging-observability`, `12-devops-infrastructure/monitoring-observability/logging`

**Logic Programming** — Declarative paradigm (Prolog): declare facts and rules, the engine finds solutions.
→ `01-fundamentals/programming-paradigms/05-declarative/logic-programming`

---

## M

**Macros & Code Generation** — Metaprogramming: compile-time code generation (Rust macros, C preprocessor, Lisp macros).
→ `01-fundamentals/programming-paradigms/08-metaprogramming/macros-and-code-generation`

**Mediator Pattern** — Behavioral pattern: a central object that coordinates communication between objects.
→ `01-fundamentals/design-patterns/04-behavioral/mediator`

**Memento Pattern** — Behavioral pattern: saving/restoring an object's internal state (undo).
→ `01-fundamentals/design-patterns/04-behavioral/memento`

**Message Queues** — Middleware for asynchronous communication: RabbitMQ, Kafka, SQS, NATS.
→ `06-backend/message-queues`

**Methodologies** — Agile, Scrum, Kanban, XP, Lean. Software development processes.
→ `15-product-engineering/methodologies`

**Metrics** — Numerical performance data: Prometheus, Grafana, custom metrics.
→ `06-backend/logging-observability/metrics`, `12-devops-infrastructure/monitoring-observability/metrics`

**Micro-Frontends** — Splitting the frontend into independently deployable pieces.
→ `05-frontend/web/micro-frontends`

**Microservices** — Architectural pattern: small, independently deployable services with bounded contexts.
→ `03-architecture/architectural-patterns/microservices`

**Middleware** — Code that sits in the request pipeline: auth, logging, CORS, rate limiting.
→ `06-backend/middleware-pipeline`

**Migrations** — Database schema versioning: up/down migrations, tools (Flyway, Alembic, EF Migrations).
→ `07-database/migrations`

**ML in Production** — Deploying ML models: serving, monitoring, A/B testing, feature stores.
→ `16-ai-integration/ml-in-production`

**Modular Monolith** — A monolith organized into clear modules with boundaries, facilitating future migration to microservices.
→ `03-architecture/architectural-patterns/modular-monolith`

**Monad** — Functional programming abstraction: wrapping values with context (Maybe/Option, Either/Result, IO).
→ `01-fundamentals/programming-paradigms/04-functional/monads-and-functors`

**Monitoring & Observability** — Logs + Metrics + Traces = Observability. Dashboards, alerts.
→ `12-devops-infrastructure/monitoring-observability`

**Monolith** — A single deployed application. Simplicity vs. scaling limitations.
→ `03-architecture/architectural-patterns/monolith`

**Monorepo** — A single repository containing multiple projects/packages (Nx, Turborepo, Bazel).
→ `04-project-structure/monorepo`

**MVC (Model-View-Controller)** — Architectural pattern: separation of data, presentation, and user interaction.
→ `01-fundamentals/design-patterns/05-architectural/mvc`

**MVVM (Model-View-ViewModel)** — Variant of MVC: ViewModel acts as a data-binding intermediary.
→ `01-fundamentals/design-patterns/05-architectural/mvvm`

**MySQL** — Popular open-source relational database. InnoDB engine, replication.
→ `07-database/relational/mysql`

---

## N

**Naming Conventions** — Naming rules: camelCase, PascalCase, snake_case, Hungarian notation.
→ `01-fundamentals/clean-code/02-naming/naming-conventions`

**Network Performance** — Network optimization: compression, HTTP/2, connection pooling, DNS.
→ `09-performance/network-performance`

**NoSQL** — Non-relational databases: document, key-value, graph, wide-column, time-series.
→ `07-database/nosql`

**Notification Systems** — Push notifications, in-app, SMS, email notification pipelines.
→ `06-backend/email-notifications/notification-systems`

**Null Object Pattern** — A pattern where an object represents "nothing" instead of null, avoiding NullPointerException.
→ `01-fundamentals/design-patterns/06-modern/null-object`

---

## O

**OAuth 2.0 / OIDC** — Authorization framework (OAuth) and identity layer (OpenID Connect).
→ `06-backend/authentication-authorization/oauth2-oidc`

**Observables & Streams** — Reactive programming: async data streams (RxJS, Project Reactor, Akka Streams).
→ `01-fundamentals/programming-paradigms/07-reactive/observables-and-streams`

**Observer Pattern** — Behavioral pattern: one-to-many dependency, publishers notify subscribers.
→ `01-fundamentals/design-patterns/04-behavioral/observer`

**OCP** — See **Open/Closed Principle**.

**OOP (Object-Oriented Programming)** — Paradigm: encapsulation, inheritance, polymorphism, abstraction.
→ `01-fundamentals/programming-paradigms/03-object-oriented`

**Open/Closed Principle (OCP)** — SOLID principle: open for extension, closed for modification.
→ `01-fundamentals/solid-principles/03-open-closed`

**ORM (Object-Relational Mapping)** — Mapping database tables to objects: Entity Framework, Hibernate, Prisma, SQLAlchemy.
→ `07-database/orm-and-query-builders`

**OWASP** — Open Web Application Security Project. Top 10 vulnerabilities, guidelines.
→ `08-security/owasp-references`

---

## P

**Performance Culture** — Organizational culture: budgets, profiling, and benchmarking as standard practice.
→ `09-performance/performance-culture`

**Polymorphism** — OOP: same interface, different behavior. Compile-time (overloading) or runtime (overriding).
→ `01-fundamentals/programming-paradigms/03-object-oriented/polymorphism`

**Postmortems** — Post-incident analysis: root cause, timeline, lessons learned.
→ `17-case-studies/postmortems`

**PostgreSQL** — Advanced open-source relational database. JSONB, CTEs, extensions, full-text search.
→ `07-database/relational/postgresql`

**Priority Queue** — A queue where elements are dequeued by priority, not FIFO. Typically implemented with a heap.
→ `01-fundamentals/data-structures/02-stacks-and-queues/priority-queues`

**Procedural Programming** — Imperative paradigm: sequential instructions grouped into procedures/functions.
→ `01-fundamentals/programming-paradigms/02-imperative/procedural`

**Profiling** — Analyzing performance bottlenecks: CPU, memory, I/O profilers.
→ `09-performance/profiling-tools`

**Prototype Pattern** — Creational pattern: creating new objects by cloning existing ones.
→ `01-fundamentals/design-patterns/02-creational/prototype`

**Proxy Pattern** — Structural pattern: a placeholder object that controls access to the real object.
→ `01-fundamentals/design-patterns/03-structural/proxy`

**Pub/Sub (Publish-Subscribe)** — Messaging pattern: publishers send messages to topics, subscribers receive them.
→ `01-fundamentals/design-patterns/06-modern/pub-sub`

**Pure Functions** — Functions without side effects: same input always produces the same output.
→ `01-fundamentals/programming-paradigms/04-functional/pure-functions`

**Python** — Interpreted, dynamically-typed, general-purpose language. Data science, web (Django, FastAPI), scripting.
→ `02-languages-and-runtimes/python`

---

## Q

**Query Optimization** — Optimizing SQL queries: indexes, EXPLAIN plans, query rewriting.
→ `07-database/query-optimization`

**Queue** — FIFO data structure: First In, First Out.
→ `01-fundamentals/data-structures/02-stacks-and-queues/queues`

---

## R

**Rate Limiting** — Restricting the number of requests per time unit: token bucket, sliding window, leaky bucket.
→ `06-backend/rate-limiting`

**React** — UI library (Meta) for component-based development. Hooks, JSX, virtual DOM.
→ `05-frontend/web/frameworks/react`

**Reactive Programming** — Paradigm: data streams and change propagation.
→ `01-fundamentals/programming-paradigms/07-reactive`

**Real-Time** — Bidirectional communication: WebSockets, SSE, Socket.IO, SignalR.
→ `06-backend/real-time`

**Recursion** — Technique: a function calls itself. Base case + recursive case.
→ `01-fundamentals/algorithms/03-recursion`

**Red-Black Tree** — Self-balancing BST with colored nodes. The basis for many stdlib implementations (TreeMap, std::map).
→ `01-fundamentals/data-structures/04-trees/balanced-trees/red-black-trees`

**Redis** — In-memory data store: caching, pub/sub, queues, leaderboards.
→ `06-backend/caching/redis-in-practice`

**Refactoring** — Improving the internal structure of code without changing its external behavior.
→ `01-fundamentals/clean-code/10-refactoring`, `13-code-quality/refactoring`

**Reflection** — Runtime inspection/modification of code: types, methods, attributes.
→ `01-fundamentals/programming-paradigms/08-metaprogramming/reflection`

**Rendering Strategies** — SSR, SSG, ISR, CSR — how and when a page gets rendered.
→ `05-frontend/web/rendering-strategies`

**Repository Pattern** — Abstraction layer between domain logic and data access.
→ `01-fundamentals/design-patterns/05-architectural/repository`

**Resilience Patterns** — Circuit breaker, retry, timeout, bulkhead, fallback.
→ `06-backend/health-resilience/resilience-patterns`

**REST (Representational State Transfer)** — Architectural style for APIs: resources, HTTP verbs, statelessness.
→ `06-backend/api-design/rest`

**Rust** — Systems language: memory safety without a garbage collector (ownership, borrowing, lifetimes).
→ `02-languages-and-runtimes/rust`

---

## S

**Scheduled Tasks** — Cron jobs, recurring tasks, scheduler patterns.
→ `06-backend/background-jobs/scheduled-tasks`

**Schema Validation** — Validating input data against a schema: Zod, Joi, JSON Schema, Pydantic.
→ `06-backend/data-validation/schema-validation`

**Search** — Full-text search, Elasticsearch, Algolia, vector search.
→ `06-backend/search`

**Search Engines (DB)** — Elasticsearch, OpenSearch, Solr for indexing/search.
→ `07-database/nosql/search-engines`

**Security Testing** — SAST, DAST, penetration testing, fuzzing.
→ `08-security/security-testing`, `11-testing/security-testing`

**Segment Tree** — Data structure: range queries (min, max, sum) in O(log n).
→ `01-fundamentals/data-structures/06-advanced/segment-trees`

**Separation of Concerns** — Principle: each module handles a single responsibility.
→ `01-fundamentals/clean-code/01-principles/separation-of-concerns`

**Serverless** — Cloud execution model: functions as a service (Lambda, Cloud Functions, Azure Functions).
→ `03-architecture/architectural-patterns/serverless`

**Singleton Pattern** — Creational pattern: a single global instance.
→ `01-fundamentals/design-patterns/02-creational/singleton`

**Single Responsibility Principle (SRP)** — SOLID principle: a class should have only one reason to change.
→ `01-fundamentals/solid-principles/02-single-responsibility`

**Skip List** — Probabilistic data structure: layered linked lists for O(log n) search.
→ `01-fundamentals/data-structures/06-advanced/skip-lists`

**SOLID** — Five OOP design principles: SRP, OCP, LSP, ISP, DIP.
→ `01-fundamentals/solid-principles`

**Sorting Algorithms** — Bubble, Selection, Insertion, Merge, Quick, Heap, Radix, Counting, Bucket.
→ `01-fundamentals/algorithms/04-sorting`

**SQLite** — Embedded relational database. Serverless, zero-configuration, file-based.
→ `07-database/relational/sqlite`

**SRP** — See **Single Responsibility Principle**.

**Stack** — LIFO data structure: Last In, First Out.
→ `01-fundamentals/data-structures/02-stacks-and-queues/stacks`

**State Management** — Frontend state: Redux, Zustand, Pinia, MobX, signals.
→ `05-frontend/web/state-management`

**State Pattern** — Behavioral pattern: an object changes behavior when its internal state changes.
→ `01-fundamentals/design-patterns/04-behavioral/state`

**Static Analysis** — Analyzing code without executing it: SonarQube, CodeQL, type checkers.
→ `13-code-quality/static-analysis`

**Static Arrays** — Fixed-size arrays. Contiguous memory, O(1) index access.
→ `01-fundamentals/data-structures/01-arrays-and-lists/static-arrays`

**Strategy Pattern** — Behavioral pattern: swapping algorithms at runtime via interchangeable strategies.
→ `01-fundamentals/design-patterns/04-behavioral/strategy`

**String Matching** — Pattern searching algorithms in strings: KMP, Rabin-Karp, Boyer-Moore, Aho-Corasick.
→ `01-fundamentals/algorithms/11-string-algorithms`

**Structured Logging** — Logs in structured format (JSON) instead of plain text. Easy parsing and filtering.
→ `06-backend/logging-observability/structured-logging`

**Svelte** — Compiler-based frontend framework: no virtual DOM, reactive by default.
→ `05-frontend/web/frameworks/svelte`

**Swift** — Apple's language for iOS/macOS. Protocol-oriented, value types, optionals.
→ `02-languages-and-runtimes/swift`

**System Design** — Designing large-scale systems: load balancers, databases, caches, queues.
→ `03-architecture/system-design`

---

## T

**TDD (Test-Driven Development)** — Red → Green → Refactor. Write the tests first.
→ `01-fundamentals/clean-code/09-testing/tdd`

**Team Organization** — Team structures: Conway's Law, cross-functional teams, platform teams.
→ `15-product-engineering/team-organization`

**Technical Debt** — The accumulated cost of shortcuts and poor design decisions in code.
→ `01-fundamentals/clean-code/08-code-smells/technical-debt`, `13-code-quality/technical-debt`

**Template Method** — Behavioral pattern: defines the skeleton of an algorithm, subclasses override the steps.
→ `01-fundamentals/design-patterns/04-behavioral/template-method`

**Testing Philosophy** — Test pyramid, testing trophy, what/when/how to test.
→ `11-testing/testing-philosophy`

**Threads & Locks** — Low-level concurrency: mutex, semaphore, deadlock, race conditions.
→ `01-fundamentals/programming-paradigms/06-concurrent-and-parallel/threads-and-locks`

**Time-Series Databases** — Databases optimized for time-stamped data: InfluxDB, TimescaleDB.
→ `07-database/nosql/time-series`

**Tracing** — Distributed tracing: OpenTelemetry, Jaeger, Zipkin. Tracking requests across services.
→ `12-devops-infrastructure/monitoring-observability/tracing`

**Transactions** — ACID properties: Atomicity, Consistency, Isolation, Durability.
→ `07-database/transactions`

**Tree Traversal** — In-order, pre-order, post-order, level-order (BFS) tree traversal.
→ `01-fundamentals/algorithms/12-tree-algorithms/tree-traversal-and-bst`

**Trie (Prefix Tree)** — Tree structure: storing strings character by character. Autocomplete, spell check.
→ `01-fundamentals/data-structures/04-trees/tries`

**TypeScript** — Typed superset of JavaScript. Interfaces, generics, type inference, enums.
→ `02-languages-and-runtimes/javascript-typescript`

**Type Systems** — Static vs dynamic, strong vs weak, nominal vs structural, gradual typing.
→ `01-fundamentals/programming-paradigms/09-generic-and-type-level/type-systems`

---

## U

**Unit Testing** — Testing individual code units in isolation.
→ `11-testing/unit-testing`, `01-fundamentals/clean-code/09-testing/unit-testing`

---

## V

**Vector Databases** — Databases for similarity search on embeddings: Pinecone, Weaviate, Milvus, pgvector.
→ `07-database/vector-databases`

**Vertical Scaling (Scale Up)** — Upgrading a machine: more CPU, RAM, storage.
→ `10-scalability/vertical-scaling`

**Visitor Pattern** — Behavioral pattern: new operations on objects without modifying their classes.
→ `01-fundamentals/design-patterns/04-behavioral/visitor`

**Vue** — Progressive frontend framework. Composition API, reactivity system, single-file components.
→ `05-frontend/web/frameworks/vue`

---

## W

**Webhooks** — HTTP callbacks: one service notifies another via POST request when something happens.
→ `06-backend/webhooks`

**WebSockets** — Full-duplex communication protocol over a single TCP connection.
→ `06-backend/api-design/websockets`

**Wide-Column Stores** — NoSQL databases (Cassandra, HBase, ScyllaDB) with column families.
→ `07-database/nosql/wide-column`

---

## X

**XP (Extreme Programming)** — Agile methodology: pair programming, TDD, continuous integration, small releases.
→ `15-product-engineering/methodologies`

---

## Y

**YAGNI (You Aren't Gonna Need It)** — Principle: don't implement something you don't need right now.
→ `01-fundamentals/clean-code/01-principles/yagni`

---

## Z

**Zero-Trust Architecture** — Security model: "never trust, always verify." Every request is authenticated.
→ `08-security/foundations`
