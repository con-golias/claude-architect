# Stripe Engineering Case Study

| Attribute | Value |
|-----------|-------|
| Domain | Case Studies > By Company |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [API Security](../../08-security/api-security/), [Reliability](../../10-scalability/patterns/) |

---

## Company Engineering Profile

Stripe processes hundreds of billions of dollars in payments annually for millions of businesses worldwide. The engineering organization (~3,000 engineers) builds financial infrastructure that demands extreme reliability, correctness, and backwards compatibility.

### Scale Metrics

- Hundreds of millions of API calls per day
- 99.999% uptime target for payment processing
- API serves 250+ countries and territories
- Supports 135+ currencies
- Thousands of deployments per week

### Core Tech Stack

- **Backend**: Ruby (legacy), Java (newer services), Go (infrastructure)
- **API**: REST with meticulous versioning and backwards compatibility
- **Data**: Apache Kafka, Apache Flink, custom reconciliation systems
- **Infrastructure**: Kubernetes, custom deployment platform
- **Type safety**: Sorbet (Ruby type checker built at Stripe)

---

## Architecture & Infrastructure

### API-First Design Philosophy

Stripe's API is its product. Every design decision revolves around developer experience.

**API Versioning Strategy**:
- Every API response is tied to a specific API version (date-based: `2024-06-20`)
- New accounts default to the latest version
- Existing accounts are pinned to their version indefinitely
- Stripe maintains backwards compatibility across all active versions simultaneously
- Internal translation layer converts between versions

```python
# Stripe API versioning — the header pins behavior
import stripe
stripe.api_version = "2024-06-20"

# Idempotency keys prevent duplicate operations
charge = stripe.Charge.create(
    amount=2000,
    currency="usd",
    source="tok_visa",
    idempotency_key="unique-key-per-request-abc123"
)
```

**Idempotency Keys**:
- Every mutating API call accepts an `Idempotency-Key` header
- Stripe stores the result of the first request with that key
- Subsequent requests with the same key return the stored result
- Critical for financial systems — prevents double charges on network retries

**API Design Principles**:
- Consistent naming conventions across all endpoints
- Predictable error format with machine-readable error codes
- Expandable objects — fetch related data without separate calls
- Pagination with cursor-based approach for stable iteration

### Ruby to Java Migration

Stripe's original API was built entirely in Ruby. As scale grew, they undertook a gradual migration.

**Why Migrate**:
- Ruby's performance characteristics limited throughput at scale
- Lack of static typing made large-scale refactoring risky
- JVM ecosystem offered better concurrency primitives for financial workloads

**Migration Strategy**:
- Service-by-service extraction, not big-bang rewrite
- New services written in Java; existing Ruby services migrated incrementally
- Built Sorbet (Ruby type checker) to make Ruby codebase safer during migration
- Maintained a Ruby API layer for backwards compatibility while backends migrated
- Migration took years — some Ruby services still run in production

**Key Lesson**: Build type safety into your existing language before migrating. Sorbet made Ruby safer immediately, buying time for a careful Java migration.

### Exactly-Once Processing

Financial systems cannot tolerate duplicate or lost transactions. Stripe implements exactly-once semantics through multiple mechanisms.

**Reconciliation System**:
- Every transaction flows through a reconciliation pipeline
- Compares expected state (what should have happened) with actual state (what did happen)
- Discrepancies trigger alerts and automatic investigation
- Runs continuously, not just end-of-day batch

**Idempotency at Every Layer**:
- API layer: idempotency keys from clients
- Service layer: deduplication tokens between internal services
- Database layer: unique constraints and conditional writes
- Queue layer: exactly-once delivery with consumer acknowledgment tracking

---

## Engineering Practices

### Developer Experience as Product

Stripe treats developer experience with the same rigor as user-facing product.

**Documentation**:
- Interactive API reference with runnable examples
- Every endpoint documented with request/response examples
- Changelog published for every API version change
- Client libraries in 7+ languages, all auto-generated from API spec

**Testing Philosophy**:

| Practice | Implementation |
|----------|---------------|
| Contract testing | API contracts verified across all supported versions |
| Property-based testing | Financial calculations tested with randomized inputs |
| Chaos testing | Controlled failure injection in staging |
| Reconciliation testing | End-to-end money flow verification |
| Canary deployments | Financial-grade canaries with automatic rollback |

### Sorbet: Ruby Type Checker

Stripe built Sorbet because they needed static typing in Ruby before completing the Java migration.

```ruby
# typed: strict
class PaymentProcessor
  extend T::Sig

  sig { params(amount: Integer, currency: String).returns(T::Boolean) }
  def process_payment(amount, currency)
    raise ArgumentError if amount <= 0
    # Process payment logic
    true
  end
end
```

- Gradual type adoption: files opt in with `# typed:` annotations
- Catches type errors at development time, not production
- Enabled large-scale automated refactoring with confidence
- Open-sourced for the Ruby community

### CI/CD for Financial Systems

Stripe's deployment pipeline prioritizes safety over speed.

- **Pre-deploy**: Automated test suite including contract tests across API versions
- **Canary**: Deploy to a small percentage of traffic, monitor financial metrics
- **Metric gates**: Automated checks on error rates, latency, and payment success rates
- **Rollback**: Automatic rollback if any financial metric degrades
- **Post-deploy**: Reconciliation runs verify no transactions were affected
- **Deploy windows**: Avoid deployments during peak financial processing periods

---

## Key Engineering Decisions

### 1. API Versioning Over Breaking Changes

Stripe chose to maintain backwards compatibility indefinitely rather than force migrations. This created internal complexity (version translation layers) but built trust with developers who could depend on API stability.

### 2. Building Sorbet Before Migrating From Ruby

Rather than immediately rewriting in Java, Stripe invested in making Ruby safer first. Sorbet provided immediate value (fewer production bugs) and made the gradual migration less risky.

### 3. Idempotency as a Core Primitive

Making idempotency a first-class API feature (not an afterthought) prevented entire categories of financial bugs. Every mutating endpoint supports idempotency keys from day one.

### 4. Reconciliation as Continuous Process

Rather than trusting any single system, Stripe continuously reconciles expected state against actual state. This defense-in-depth approach catches bugs that testing alone cannot.

### 5. Documentation as Engineering Output

Stripe treats documentation changes as engineering work, reviewed with the same rigor as code changes. Documentation PRs require approval from both engineering and developer relations.

---

## Lessons Learned

### What Worked

1. **API design is product design.** The API is the interface — invest in it like a product.
2. **Backwards compatibility builds trust.** Developers chose Stripe because APIs do not break.
3. **Gradual migration with safety nets.** Sorbet + service extraction > big-bang rewrite.
4. **Reconciliation catches everything.** Testing prevents known bugs; reconciliation catches unknown ones.

### What Did Not Work

1. **Ruby at extreme scale.** Performance limitations became blockers for growth.
2. **Monolithic Ruby service.** The initial monolith made independent scaling impossible.
3. **Manual API documentation.** Early manual docs fell out of sync; auto-generation solved it.

---

## Key Takeaways

1. **Backwards compatibility is sacred in API design.** Never break existing integrations — version instead.
2. **Idempotency is not optional for financial systems.** Build it into every mutating endpoint from day one.
3. **Invest in type safety for dynamic languages.** Sorbet's ROI in bug prevention far exceeded its build cost.
4. **Reconciliation is your ultimate safety net.** Continuously verify expected state matches actual state.
5. **Developer experience drives adoption.** Stripe's documentation and API design are competitive advantages.
6. **Gradual migration beats big-bang rewrite.** Extract services incrementally while maintaining production stability.

---

## Anti-Patterns to Avoid

| Anti-Pattern | What Happened | Lesson |
|---|---|---|
| Breaking API changes | Competitors broke APIs, losing developer trust | Version APIs; never remove fields from existing versions |
| Big-bang rewrite | Teams that attempted full rewrites faced multi-year delays | Migrate service-by-service with dual-running during transition |
| Trusting a single system | Individual services can have bugs that pass all tests | Reconciliation across systems catches what unit tests cannot |
| Skipping idempotency | Duplicate payment bugs in early competitors | Build idempotency into every mutating endpoint from the start |
| Manual documentation | Docs fell out of sync with API behavior | Auto-generate from API specifications; treat docs as code |
| Deploying during peak hours | Higher risk window for financial transactions | Establish deploy windows that avoid peak processing times |
| Type-unsafe refactoring | Large Ruby refactors caused production regressions | Add gradual types (Sorbet) before attempting large-scale changes |
| Optimizing for deploy speed over safety | Financial systems need slower, safer rollouts | Use metric-gated canaries with automatic rollback for financial services |
