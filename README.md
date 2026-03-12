# Claude Architect

**Knowledge-guided architecture plugin for Claude Code — transforms AI coding from guesswork into expertise-driven development.**

Claude Architect gives Claude Code access to a curated knowledge base of 1009 software engineering articles. Instead of relying on training data alone, Claude consults proven best practices, security guidelines, and design patterns before writing code. The result: code that's correct from the start.

## How It Works

```
You: "Build a notes app with authentication"

Claude Code (with Claude Architect):
  1. Reads your code thoroughly
  2. Searches 1009 KB articles for relevant guidance
  3. Applies best practices from KB (marked with [KB])
  4. Uses own expertise for everything else
  5. Shows you what was KB-guided vs own judgment
```

## Features

| Feature | Description |
|---------|-------------|
| **Knowledge Base (1009 articles)** | Curated software engineering guidance covering security, architecture, frontend, backend, databases, testing, DevOps, accessibility, and more |
| **Smart KB Lookup** | Multi-signal ranking engine matches articles to your code context using file extension, path patterns, content analysis, and query terms |
| **PreToolUse Hook** | Automatically injects relevant KB guidance before every file write/edit |
| **Architecture Enforcement** | 31 rule files (26 auto, 5 manual) covering clean architecture, SOLID, security, testing, API design |
| **Compliance Scoring** | 0-100 weighted score with category breakdown (dependency, structure, security, quality, docs) |
| **Violation Detection** | 12 validators catch security anti-patterns, dependency violations, accessibility issues, and more |
| **Decision Tracking** | Persistent ADR database — every architectural decision is recorded and searchable |
| **Feature Scaffolding** | Generate clean architecture structure (domain/application/infrastructure) |
| **Web Dashboard** | Live dashboard at `http://localhost:37778` showing scores, violations, decisions |
| **Self-Improvement** | Learns from violation patterns and suggests rule modifications after 5+ sessions |

## Quick Start

### Development

```bash
# Clone the repository
git clone https://github.com/con-golias/claude-architect.git
cd claude-architect

# Install dependencies
bun install

# Build (produces MCP server + Worker + KB index)
bun run build

# Load as plugin for current session
claude --plugin-dir /path/to/claude-architect
```

### Permanent Installation

```bash
/plugin marketplace add /path/to/claude-architect
/plugin install claude-architect
```

### Usage

```bash
# Open any project with Claude Code
claude

# The plugin activates automatically:
# - KB system loads (1009 articles)
# - Dashboard starts at http://localhost:37778
# - Every code analysis consults the KB

# Initialize architecture rules for your project
/architect-init

# Check compliance
/architect-check

# Manually search the KB
# (Claude also does this automatically)
kb_lookup(query: "authentication best practices")
kb_read(id: "08-security/authentication/jwt-tokens")
```

## Knowledge Base

The KB contains 1009 markdown articles organized in 17 categories:

| Category | Articles | Covers |
|----------|----------|--------|
| Fundamentals | 186 | Clean code, SOLID, design patterns, data structures |
| Backend | 129 | REST, GraphQL, gRPC, WebSockets, microservices |
| Security | 95 | OWASP, XSS prevention, injection, authentication, encryption |
| Project Structure | 84 | Express, Next.js, Django, Flutter, mobile, desktop |
| Frontend | 80 | React, Angular, Vue, state management, accessibility |
| Database | 75 | SQL, NoSQL, data modeling, migrations, query optimization |
| Languages | 56 | TypeScript, Python, Go, Rust, Java, C#, Swift |
| DevOps | 50 | CI/CD, Docker, Kubernetes, monitoring, infrastructure |
| Performance | 49 | Caching, lazy loading, N+1 prevention, profiling |
| Architecture | 42 | Clean architecture, DDD, event-driven, CQRS |
| Testing | 34 | Unit, integration, E2E, TDD, mocking strategies |
| Scalability | 34 | Horizontal scaling, load balancing, message queues |
| Code Quality | 29 | Linting, formatting, code review, refactoring |
| Product | 21 | Requirements, user stories, agile, documentation |
| Case Studies | 20 | Real-world architecture decisions and patterns |
| AI | 13 | AI-generated code security, prompt engineering |
| Accessibility | 10 | WCAG compliance, semantic HTML, ARIA |

### KB Workflow

The plugin follows a strict workflow to ensure thorough analysis:

1. **Analyze first** — Claude examines your code thoroughly, finding ALL issues
2. **Consult KB** — Searches for guidance on the specific issues found
3. **Fix with KB** — Applies KB recommendations (marked with `[KB]`)
4. **Fix with expertise** — Handles remaining issues using own judgment

This order is critical. The KB enhances Claude's analysis — it doesn't replace it.

## MCP Tools

| Tool | Description |
|------|-------------|
| `kb_lookup` | Find relevant KB articles by file path, query, category, or language |
| `kb_read` | Read full content of a specific KB article |
| `architect_check` | Validate project compliance (score + violations) |
| `architect_scaffold` | Generate feature folder structure |
| `architect_log_decision` | Record an architectural decision (ADR) |
| `architect_search` | Search decisions, violations, history |
| `architect_timeline` | Get chronological context around events |
| `architect_get_details` | Fetch full details for specific IDs |
| `architect_get_status` | Project health dashboard |
| `architect_get_rules` | Get relevant rules for current context |
| `architect_improve` | Self-improvement analysis |
| `architect_get_templates` | List or retrieve document templates |
| `architect_configure_rules` | Enable/disable manual architecture rules |

## Skills (Slash Commands)

| Command | Description |
|---------|-------------|
| `/architect-init` | Initialize clean architecture for new or existing projects |
| `/architect-check` | Run full compliance check with score and violations |
| `/architect-plan` | Create architecture-aware implementation plans |
| `/architect-history` | View decisions, compliance trends, violation patterns |
| `/architect-scaffold` | Generate feature with domain/application/infrastructure layers |
| `/architect-templates` | List and retrieve architecture document templates |
| `/architect-configure-rules` | Configure which rules are active |

## Lifecycle Hooks

| Event | What Happens |
|-------|-------------|
| **Session Start** | Starts worker, loads project context, sets KB workflow instructions |
| **User Prompt** | Reminds Claude of KB workflow and dashboard link |
| **Pre-Tool Use** | Before Write/Edit — queries KB index, injects relevant guidance |
| **Post-Tool Use** | After Write/Edit — validates changed file, detects violations |
| **Session End** | Summarizes changes, updates compliance score, triggers self-improvement |

## Architecture

```
claude-architect/
├── software-engineering-kb/   1009 curated KB articles (markdown)
├── hooks/                     Lifecycle hook configuration
├── skills/                    Slash command definitions
├── rules/                     31 architecture rule files
├── templates/                 Document templates (ADR, README, etc.)
├── ui/                        Web dashboard (HTML/CSS/JS + Chart.js)
├── scripts/                   Compiled bundles (mcp-server.cjs, worker-service.cjs)
└── src/
    ├── servers/               MCP server (stdio) + tool definitions
    ├── services/
    │   ├── kb/                KB engine (index builder, lookup, ranker, types)
    │   ├── sqlite/            Database layer (SQLite, WAL mode)
    │   ├── worker/            HTTP API server (Express, port 37778)
    │   ├── validator/         12 architecture validators
    │   ├── scaffolder/        Feature generator
    │   └── improver/          Self-improvement engine
    ├── cli/handlers/          Hook event handlers
    └── utils/                 Logging, paths, config

Data (persistent, per-user):
~/.claude-architect/
├── architect.sqlite           SQLite database (decisions, violations, scores)
└── kb-index.json              KB search index (6.3MB, 1009 entries)
```

### System Flow

```
MCP Server (Node.js, stdio)
    ↓ delegates via HTTP
Worker API (Bun, Express, port 37778)
    ├── /api/check         → Compliance scoring (12 validators)
    ├── /api/kb/lookup     → KB search (multi-signal ranking)
    ├── /api/kb/read/:id   → Full article content
    ├── /api/kb/stats      → Index statistics
    ├── /api/search        → Decision/violation search
    └── /api/scaffold      → Feature generation
    ↓ serves
Web Dashboard (http://localhost:37778)
    └── Compliance gauge, violation cards, trend chart, decisions timeline
```

## Compliance Scoring

Score ranges from 0-100, calculated as weighted average of category scores:

| Category | Weight | What It Checks |
|----------|--------|----------------|
| Dependency | 25% | Dependency direction violations, circular imports |
| Structure | 20% | Feature organization, file size limits |
| Security | 25% | OWASP anti-patterns, hardcoded secrets, SQL safety, XSS |
| Quality | 20% | Code complexity, test coverage, naming conventions |
| Documentation | 10% | README, JSDoc, changelog |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Bun (TypeScript) |
| Database | SQLite via bun:sqlite (WAL mode) |
| MCP Server | @modelcontextprotocol/sdk (stdio, target: node) |
| Worker API | Express.js (port 37778, target: bun) |
| KB Index | JSON with multi-dimensional inverted indices |
| Dashboard | Vanilla HTML/CSS/JS + Chart.js |
| Tests | bun:test (234 tests) |

## Build

```bash
bun install          # Install dependencies
bun run build        # Build MCP server + Worker + KB index
bun test             # Run all 234 tests
```

Build produces 3 artifacts:
- `scripts/mcp-server.cjs` — MCP server (runs with Node.js)
- `scripts/worker-service.cjs` — Worker API (runs with Bun)
- `~/.claude-architect/kb-index.json` — KB search index (1009 entries)

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/your-feature`
3. Commit using conventional commits: `git commit -m "feat(kb): add new articles"`
4. Push and create a Pull Request

## License

MIT License — use it, modify it, share it.
