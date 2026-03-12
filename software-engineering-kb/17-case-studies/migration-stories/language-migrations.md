# Programming Language Migration Stories

| Attribute | Value |
|-----------|-------|
| Domain | Case Studies > Migration Stories |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Coding Standards](../../13-code-quality/coding-standards/), [Code Quality](../../13-code-quality/) |

---

## Core Concepts

### Why Teams Migrate Languages

| Motivation | Signal | Example |
|---|---|---|
| **Performance** | Latency/throughput limits despite optimization | Discord: Go → Rust for predictable latency |
| **Hiring** | Cannot find engineers for current stack | COBOL/Perl shops struggling to recruit |
| **Type safety** | Bug rates from runtime type errors | Airbnb: JavaScript → TypeScript (38% fewer bugs) |
| **Ecosystem** | Libraries, tooling, community maturity | Python's ML ecosystem pulling teams from R/Java |
| **Concurrency** | GIL limitations, threading complexity | Uber: Python → Go for concurrent microservices |
| **Maintenance cost** | Codebase too complex to evolve safely | Meta: PHP → Hack for gradual typing |
| **Runtime cost** | Compute bills from interpreted language overhead | Figma: Ruby → Rust for multiplayer server (10x CPU reduction) |

### Common Migration Paths

**JavaScript → TypeScript** (most common, lowest risk):
- Airbnb, Slack, Stripe, Bloomberg, Shopify, Google (Angular)
- Incremental adoption possible — TypeScript compiles alongside JavaScript
- Typical timeline: 6-18 months for full codebase conversion

**Python → Go** (performance and concurrency):
- Uber, Dropbox, Cloudflare, Twitch
- Service-by-service extraction — rewrite individual microservices
- Typical motivation: CPU-bound processing, high-concurrency requirements

**Ruby → Rust/Go** (performance-critical paths):
- Shopify: Ruby → Lua → Rust (Storefront Renderer)
- Discord: Go → Rust (message handling service)
- Figma: Ruby → Rust (multiplayer collaboration server)

**PHP → Hack/Modern alternatives:**
- Meta: PHP → Hack (2014) — gradual typing, async/await, generics
- Wikipedia: PHP maintained but with strict typing and modern patterns
- Slack: PHP → Java/Kotlin for backend services

**Java → Kotlin** (Android and backend):
- Google: official Android development language since 2019
- Gradle, Atlassian, Pinterest — backend services migration
- 100% interop with Java — gradual file-by-file conversion

### Migration Strategies

**Gradual rewrite (preferred for most teams):**
- Convert file by file within the same codebase (TypeScript, Kotlin)
- No big-bang switch — every commit leaves the codebase in a working state
- CI enforces that new files use the target language, legacy files convert incrementally
- Best for: same-runtime migrations (JS→TS, Java→Kotlin, PHP→Hack)

**Service-by-service extraction:**
- Rewrite individual microservices in the new language when they need changes
- Leave stable, low-change services in the original language indefinitely
- New services always use the target language
- Best for: cross-runtime migrations (Python→Go, Ruby→Rust)

**Strangler fig for monoliths:**
- Route specific endpoints to new service written in target language
- Gradually expand routing until monolith has no remaining traffic
- Keep monolith running as fallback during transition
- Best for: monolith modernization combined with language migration

**FFI bridge (Foreign Function Interface):**
- Call new language code from old language via C FFI, gRPC, or shared memory
- Useful for extracting performance-critical hot paths
- Python → Rust via PyO3/maturin; Ruby → Rust via FFI; Node.js → Rust via napi-rs
- Best for: extracting computational bottlenecks without full service extraction

**Compile-to-target:**
- Use transpilers or compilation to bridge languages (TypeScript → JavaScript, Kotlin → JVM)
- Some teams use automated translators for initial conversion, then manual cleanup
- Meta's Hacklang transpiled PHP → Hack as a starting point

### JavaScript → TypeScript Deep Dive

**Incremental adoption strategy:**
1. Add `tsconfig.json` with `allowJs: true` and `strict: false`
2. Rename files from `.js` to `.ts` one module at a time, starting with leaf modules
3. Add type annotations to public APIs first (function signatures, exports)
4. Enable strict checks incrementally: `noImplicitAny` → `strictNullChecks` → `strict: true`
5. Convert shared libraries and utilities first (highest type-safety ROI)

**Managing the `any` escape hatch:**
- Use `// @ts-expect-error` instead of `any` where possible — fails if error is fixed
- Track `any` count as a metric: create a CI check that counts `any` occurrences
- Establish a rule: new code must not introduce new `any` types
- Budget time specifically for `any` reduction sprints (1-2 weeks per quarter)

**tsconfig progression:**

```jsonc
// Phase 1: Coexistence
{ "compilerOptions": { "allowJs": true, "strict": false, "target": "ES2020" } }

// Phase 2: Strictening
{ "compilerOptions": { "allowJs": true, "noImplicitAny": true, "strictNullChecks": true } }

// Phase 3: Full strict
{ "compilerOptions": { "allowJs": false, "strict": true } }
```

**Airbnb results:** migrated 6M+ lines from JavaScript to TypeScript — reported 38% reduction in production bugs attributable to type errors. Migration took approximately 18 months with dedicated tooling team.

### Python → Go Migration

**When performance matters:**
- Python's GIL limits true parallelism for CPU-bound workloads
- Go delivers 10-40x throughput improvement for concurrent network services
- Garbage collection in Go is designed for low-latency (sub-millisecond pauses)

**Service extraction pattern:**
1. Identify the highest-CPU or highest-concurrency Python service
2. Define the service API contract (protobuf/gRPC or OpenAPI)
3. Implement in Go with comprehensive test coverage
4. Run shadow traffic: both Python and Go services process requests, compare results
5. Gradually shift production traffic via load balancer weights
6. Decommission Python service after 2-4 weeks of Go-only production traffic

**Uber's experience:**
- Migrated hundreds of microservices from Python to Go (2015-2018)
- Primary motivation: concurrency model and CPU efficiency
- Built internal Go framework (TChannel → gRPC) for service consistency
- Invested heavily in Go developer tooling, linting, and code generation
- Result: 5-10x reduction in compute costs for migrated services

### Ruby/Python → Rust Migration

**Shopify Storefront Renderer (Ruby → Lua → Rust):**
- Original: Ruby-based Liquid template rendering — high CPU cost per request
- First attempt: rewrote hot path in Lua (embedded in Ruby via FFI) — 5x improvement
- Final solution: full Rust rewrite of the renderer — 10x improvement over Lua
- Key insight: each migration step was validated independently before proceeding

**Figma Multiplayer Server (TypeScript → Rust):**
- Original: TypeScript/Node.js handling real-time collaboration
- Problem: garbage collection pauses caused jitter in multiplayer cursor positions
- Rust eliminated GC pauses entirely, provided deterministic memory management
- Result: 10x reduction in server CPU costs, consistent sub-millisecond latency

**Discord — Go → Rust (2020):**
- Read States service processing millions of concurrent connections
- Go's garbage collector caused latency spikes every 2 minutes (stop-the-world GC)
- Rust version: zero GC pauses, memory usage dropped 10x
- Result: p99 latency dropped from 130ms to 5ms; CPU and memory usage significantly reduced

### Measuring Migration Success

Track these metrics throughout the migration:

**Performance metrics:**
- Latency: p50, p95, p99 before and after (target: maintain or improve)
- Throughput: requests/second per instance
- Resource efficiency: CPU and memory per request
- Cold start time (relevant for serverless/container migrations)

**Developer experience metrics:**
- Build time: faster builds improve developer iteration speed
- Type error catch rate: bugs caught at compile time vs. runtime
- Developer satisfaction surveys (quarterly): language preference, productivity perception
- Time to onboard new engineers in the new language

**Business metrics:**
- Bug rate: production incidents attributable to language-related issues
- Deployment frequency: how often teams deploy (new language should not slow this)
- Hiring funnel: applicant volume and quality for positions using new language
- Infrastructure cost: compute spend before and after migration

### Common Failures

**Big-bang rewrite (Netscape Syndrome):**
- Netscape rewrote their browser from scratch in 1998-2000 — took 3 years, lost market to IE
- During rewrite: no features shipped, no bugs fixed, competitors advanced
- Joel Spolsky's law: "the single worst strategic mistake that any software company can make"
- Fix: always incremental migration; the old system must continue evolving during migration

**Underestimating timeline:**
- Teams consistently estimate 6 months, deliver in 18-24 months
- Root cause: the last 20% of migration takes 80% of the time (edge cases, rarely-used features)
- Fix: multiply initial estimate by 2-3x; plan for a long tail of legacy code

**Losing institutional knowledge:**
- Original authors leave during multi-year migration
- Business logic embedded in old code is not documented
- New implementation accidentally drops features or changes behavior
- Fix: pair original authors with new-language developers; comprehensive test suites as behavior documentation

**Second-system effect:**
- Team over-engineers the new implementation with features the old system never needed
- Migration scope creeps as developers want to "do it right this time"
- Fix: first goal is feature parity — improvements come after migration is complete

---

## 10 Key Lessons

1. **Never do a big-bang rewrite.** Netscape, Perl 6, and countless internal projects prove that full rewrites fail — migrate incrementally while the old system continues serving users.

2. **Start with the language's strongest use case.** Migrate the workload that benefits most from the new language first (CPU-bound service for Go/Rust, type-heavy module for TypeScript).

3. **Invest in automated conversion tooling.** Airbnb built custom codemods for JS→TS; Meta built transpilers for PHP→Hack — tooling investment pays for itself at scale.

4. **Measure with metrics, not feelings.** Track latency, bug rates, developer satisfaction, and hiring impact — "the new language is better" is not a business justification.

5. **Accept long-term polyglot reality.** Most teams will run both languages for years — build CI, deployment, and observability to support both simultaneously.

6. **New services always use the target language.** Stop writing new code in the old language immediately — this is the single most impactful rule.

7. **Feature parity first, improvements second.** Resist the urge to redesign during migration — achieve behavioral equivalence, then improve in a separate phase.

8. **Pair legacy experts with new-language developers.** Institutional knowledge transfers through pairing, not documentation — budget for knowledge transfer time.

9. **TypeScript migration has the best risk-reward ratio.** Same runtime, incremental adoption, immediate type-safety benefits, massive ecosystem — start here if applicable.

10. **Plan for 2-3x your initial timeline.** The long tail of migration (edge cases, rarely-used features, team rotation) consistently extends timelines beyond initial estimates.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Big-bang rewrite | Years of no feature delivery, market share loss | Incremental migration: file-by-file, service-by-service |
| Rewriting for resume-driven development | Wrong language choice, team churn when novelty fades | Justify migration with measurable business metrics |
| Allowing new code in old language | Migration never completes, codebase grows in both | Enforce "new code in target language" rule in CI |
| No automated conversion tooling | Manual conversion is slow, error-prone, inconsistent | Build codemods, transpilers, or type-stub generators |
| Skipping the shadow traffic phase | Production bugs discovered after full cutover | Run both implementations in parallel, compare outputs |
| Over-engineering the new implementation | Scope creep, timeline explosion, feature gap with old system | Feature parity first, improvements in separate phase |
| Ignoring developer training | Developers write old-language patterns in new language | Invest in language training, code review, and mentorship |
| Migrating stable, unchanging services | Effort with no benefit — those services work fine | Only migrate services that need active development or scaling |

---

## Checklist

- [ ] Document business justification with measurable success criteria
- [ ] Select migration strategy: gradual rewrite, service-by-service, or strangler fig
- [ ] Establish "new code in target language" rule and enforce in CI
- [ ] Build or adopt automated conversion tooling (codemods, transpilers)
- [ ] Create comprehensive test suite for the migrating component (behavior documentation)
- [ ] Set up CI/CD pipeline supporting both languages simultaneously
- [ ] Pair legacy experts with new-language developers for knowledge transfer
- [ ] Implement shadow traffic comparison for service-by-service migrations
- [ ] Track migration progress metrics: percentage migrated, bug rate, developer satisfaction
- [ ] Plan for 2-3x initial timeline estimate with explicit long-tail budget
- [ ] Measure performance (latency, throughput, cost) before and after each migrated component
- [ ] Schedule retrospective after each major migration milestone
