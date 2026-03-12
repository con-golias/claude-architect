# Meta Engineering Case Study

| Attribute | Value |
|-----------|-------|
| Domain | Case Studies > By Company |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [React Ecosystem](../../06-backend/), [Mobile](../../09-performance/frontend-performance/) |

---

## Company Engineering Profile

Meta (formerly Facebook) operates social platforms serving 3+ billion monthly active users across Facebook, Instagram, WhatsApp, and Messenger. The engineering organization (~30,000 engineers) is known for the "move fast" philosophy, massive monorepo, open-source frameworks (React, GraphQL), and infrastructure innovations.

### Scale Metrics

- 3+ billion monthly active users across the family of apps
- 100+ petabytes of data in storage
- Millions of servers across global data centers
- Monorepo: one of the largest in the world (hundreds of millions of lines)
- Thousands of deployments per day

### Core Tech Stack

- **Languages**: Hack (evolved from PHP), C++, Python, Rust, Java
- **Frontend**: React, Relay (GraphQL client)
- **Mobile**: React Native, native iOS/Android, Hermes (JS engine)
- **Data**: TAO (graph store), MySQL (heavily customized), Scuba (real-time analytics)
- **Infrastructure**: Custom data centers, Tupperware (container orchestrator)

---

## Architecture & Infrastructure

### PHP to Hack Migration

Meta's most consequential language decision was evolving PHP into Hack.

**The Problem**:
- Facebook was built on PHP, which lacked static typing
- At scale (thousands of engineers, millions of lines), PHP's dynamic nature caused production bugs
- PHP performance was insufficient for Meta's scale

**The Solution Path**:
1. **HipHop (2010)**: PHP-to-C++ transpiler for performance
2. **HHVM (2013)**: Custom PHP virtual machine (JIT compilation), 5-10x speedup
3. **Hack (2014)**: Gradual typing added to PHP, running on HHVM
4. **Full migration**: Entire codebase migrated from PHP to Hack incrementally

```hack
// Hack: PHP with static typing
function processUser(User $user): ProcessResult {
  $name = $user->getName(); // Type-checked at compile time

  // Async/await built into the language
  $profile = await fetchProfile($user->getId());

  return new ProcessResult($name, $profile);
}
```

**Key Insight**: Rather than rewriting in a completely different language, Meta evolved their existing language. This preserved institutional knowledge and enabled gradual migration.

### TAO: The Social Graph Database

TAO (The Associations and Objects) is Meta's custom graph database serving the social graph.

**Design Principles**:
- **Object-Association model**: Objects (users, posts, photos) connected by associations (friendships, likes)
- **Read-optimized**: Heavily cached, read-to-write ratio is ~500:1
- **Geographically distributed**: Multi-region with eventual consistency
- **Cache-through architecture**: TAO sits in front of MySQL, caching graph queries

**Architecture**:
```
Application --> TAO Cache (memcache tier)
                  |
                  v
                TAO Leader (per shard)
                  |
                  v
                MySQL (persistent storage)
```

- Handles billions of reads per second through aggressive caching
- Write-through cache ensures consistency between cache and storage
- Sharded by object ID for horizontal scalability
- Replaced ad-hoc MySQL queries with a unified graph API

### Memcache at Scale

Meta operates one of the world's largest memcache deployments:

- Trillions of cache items
- Billions of requests per second
- Custom extensions: lease mechanism (prevents thundering herds), regional pools
- McRouter: custom memcache protocol router for connection pooling and failover

---

## The React Ecosystem

Meta created and open-sourced a suite of frontend tools that reshaped web development.

### React (2013)

- **Innovation**: Virtual DOM, component-based architecture, declarative UI
- **Origin**: Built for Facebook's News Feed, then Instagram
- **Impact**: Became the dominant frontend framework, influencing Vue, Svelte, and others
- **Evolution**: Class components -> Hooks (2019) -> Server Components (2023+)

### GraphQL (2015)

- **Problem**: REST APIs returned too much or too little data for mobile clients
- **Solution**: Query language where clients specify exactly what data they need
- **Internal use**: Every Meta app uses GraphQL as the data layer
- **Open-sourced**: Became industry standard for flexible API design

```graphql
# Client specifies exactly what it needs
query UserProfile($id: ID!) {
  user(id: $id) {
    name
    profilePicture(size: 200) {
      url
    }
    friends(first: 10) {
      name
    }
  }
}
```

### Relay (GraphQL Client)

- Colocates data requirements with components
- Automatic query batching and caching
- Compiler optimizes queries at build time
- Handles pagination, optimistic updates, and garbage collection

### Jest (Testing Framework)

- Built for testing React components
- Snapshot testing, mocking, parallel test execution
- Zero-configuration for most JavaScript projects
- Became the most popular JavaScript testing framework

### Flow and the TypeScript Transition

- **Flow (2014)**: Meta built Flow as a static type checker for JavaScript
- **TypeScript dominance**: TypeScript gained wider adoption and ecosystem support
- **Transition**: Meta gradually adopted TypeScript for new projects while maintaining Flow for legacy
- **Lesson**: Even the creators of a tool will migrate if the ecosystem moves elsewhere

---

## Mobile Engineering

### React Native

Meta built React Native to enable cross-platform mobile development:

- **Principle**: "Learn once, write anywhere" (not "write once, run everywhere")
- **Architecture**: JavaScript bridge communicating with native modules
- **New Architecture (2022+)**: JSI (JavaScript Interface), Fabric renderer, TurboModules
- **Usage at Meta**: Instagram, Facebook Marketplace, Ads Manager

### Hermes JavaScript Engine

- Custom JavaScript engine optimized for React Native
- **Bytecode compilation**: JS compiled to bytecode at build time, not runtime
- **Reduced startup time**: 50%+ faster app startup compared to JavaScriptCore
- **Smaller memory footprint**: Optimized garbage collector for mobile devices
- Open-sourced and became the default engine for React Native

### Mobile Performance

| Technique | Implementation |
|-----------|---------------|
| Bytecode precompilation | Hermes compiles JS to bytecode at build time |
| Code splitting | Load only the code needed for the current screen |
| Image optimization | Progressive loading, appropriate resolution per device |
| Network optimization | GraphQL batching, prefetching, offline support |
| Startup optimization | Deferred initialization, lazy module loading |

---

## Engineering Practices

### Move Fast Philosophy (with Guardrails)

Meta's "Move Fast and Break Things" evolved into "Move Fast with Stable Infrastructure":

- **Bootcamp**: Every new engineer (regardless of seniority) goes through 6-week bootcamp
- **Diff-based workflow**: Changes submitted as "diffs" (similar to PRs), reviewed by peers
- **Continuous deployment**: Code lands in production within hours of approval
- **Feature flags**: Gatekeeper system controls feature rollout to percentage of users
- **Automated testing**: Sandcastle CI runs tests on every diff

### Massive Monorepo

Meta uses one of the world's largest monorepos:

- Hundreds of millions of lines of code
- Custom source control (Sapling, evolved from Mercurial)
- **Diff-based CI (Sandcastle)**: Only runs tests affected by the changed code
- **Buck/Buck2**: Custom build system (open-sourced) for fast incremental builds
- **Code review**: Every diff requires at least one reviewer approval

### CI/CD Pipeline

```
Engineer submits diff
      |
      v
Sandcastle (CI) runs affected tests
      |
      v
Code review (peer approval required)
      |
      v
Land to monorepo trunk
      |
      v
Continuous push to canary servers
      |
      v
Automated metric monitoring
      |
      v
Full production rollout
```

- **Push frequency**: Multiple pushes per day for server code
- **Mobile releases**: Weekly train model with cherry-pick hotfixes
- **Canary monitoring**: Automated regression detection on key metrics
- **Rollback**: Automated rollback if metrics degrade past thresholds

---

## Key Engineering Decisions

### 1. Evolving PHP Rather Than Rewriting

Meta chose to evolve PHP into Hack rather than rewrite in Java or Go. This preserved existing code, institutional knowledge, and engineer productivity during the transition.

### 2. Building and Open-Sourcing React

Creating React (and later React Native, GraphQL, Jest) as open-source projects built an ecosystem that Meta both contributes to and benefits from.

### 3. Custom Infrastructure at Every Layer

TAO, Memcache extensions, Tupperware, Sapling — Meta builds custom infrastructure when off-the-shelf solutions cannot handle their scale. This is expensive but necessary.

### 4. GraphQL Over REST

Adopting GraphQL solved the mobile data-fetching problem (over-fetching/under-fetching) and enabled client teams to iterate independently of backend API changes.

### 5. Monorepo with Custom Tooling

Like Google, Meta committed to a monorepo approach, building Sapling (source control) and Buck2 (build system) to make it work at massive scale.

---

## Lessons Learned

### What Worked

1. **Open-sourcing creates ecosystems.** React, GraphQL, and Jest reshaped web development and attracted talent to Meta.
2. **Evolving languages beats rewriting.** PHP -> Hack preserved productivity while adding safety.
3. **Bootcamp builds culture.** Every engineer shipping code in their first week creates shared understanding.
4. **GraphQL for mobile.** Client-driven data fetching eliminated the API mismatch problem.

### What Did Not Work

1. **Flow vs. TypeScript.** Maintaining a competing type system while the ecosystem chose TypeScript was costly.
2. **React Native bridge overhead.** The original bridge architecture created performance bottlenecks; the New Architecture was needed.
3. **"Move fast and break things" literally.** The original motto caused real reliability problems before guardrails were added.

---

## Key Takeaways

1. **Open-source frameworks create compounding value.** React's ecosystem benefits Meta through community contributions, hiring pipeline, and ecosystem tooling.
2. **Evolve existing languages when possible.** PHP -> Hack was cheaper and less risky than a full rewrite.
3. **Developer tools compound across every engineer.** Buck2, Sandcastle, and Sapling multiply productivity across 30,000 engineers.
4. **Move fast requires guardrails.** Feature flags, automated testing, canary deployments, and metric monitoring make speed safe.
5. **Custom infrastructure is justified at extreme scale.** TAO, Memcache extensions, and Hermes solve problems no off-the-shelf tool can.
6. **Follow the ecosystem, even if you started the alternative.** Meta's Flow-to-TypeScript transition shows pragmatism over pride.

---

## Anti-Patterns to Avoid

| Anti-Pattern | What Happened | Lesson |
|---|---|---|
| "Move fast and break things" literally | Frequent outages and reliability issues in early years | Add guardrails (feature flags, canaries, automated rollback) before optimizing for speed |
| Maintaining competing tools | Flow competed with TypeScript; ecosystem chose TypeScript | Follow ecosystem momentum; do not maintain alternatives that the community has rejected |
| Bridge-heavy mobile architecture | React Native's original bridge caused performance bottlenecks | Design for direct native communication; avoid serialization overhead on hot paths |
| Not-invented-here syndrome | Building custom when open-source would suffice | Custom infrastructure is justified only at extreme scale; evaluate existing solutions first |
| Monorepo without build system investment | Other companies adopted monorepo without Buck-level tooling | Monorepo requires custom build systems, CI optimization, and source control |
| Skipping bootcamp/onboarding | Engineers without context make costly mistakes | Invest in structured onboarding that teaches codebase, tools, and culture |
| Ignoring mobile performance from the start | Hermes was built years after React Native shipped | Optimize runtime performance early; building a custom engine later is expensive |
| Open-sourcing without maintenance commitment | Abandoned projects damage community trust | Only open-source what you commit to maintaining or explicitly sunset |
