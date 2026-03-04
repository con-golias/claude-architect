# Claude Architect

**Enterprise architecture enforcement plugin for Claude Code — transforms vibe coding into professional-grade development.**

Stop producing spaghetti code with AI. Claude Architect enforces clean architecture, tracks architectural decisions, validates compliance, and self-improves — all automatically, on every session.

## Features

| Feature | Description |
|---------|-------------|
| **Architecture Enforcement** | 16 rule files covering clean architecture, SOLID, security, testing, API design, and more |
| **Compliance Scoring** | 0-100 score with category breakdown (architecture, security, quality, docs) |
| **Violation Detection** | Catches dependency direction violations, security anti-patterns, missing tests and docs |
| **Decision Tracking** | Persistent ADR database — every architectural decision is recorded and searchable |
| **Feature Scaffolding** | Generate correct clean architecture structure (domain/application/infrastructure) |
| **Project Memory** | SQLite database stores decisions, violations, compliance history per project |
| **Self-Improvement** | Learns from violation patterns and suggests rule modifications |
| **Web Dashboard** | Localhost UI showing compliance trends, violations, decisions timeline |
| **Lifecycle Hooks** | Automatic context loading, violation detection on file writes, session summaries |

## Quick Start

### Install as Claude Code Plugin

```bash
# Install from the Claude Code plugin marketplace
claude plugin install claude-architect
```

### Or Install Manually

```bash
# Clone the repository
git clone https://github.com/GoliathReigns/claude-architect.git

# Install as a local plugin
claude plugin install --local /path/to/claude-architect
```

### Then

```bash
# Open any project with Claude Code
claude

# Initialize architecture for your project
/architect-init

# Check compliance at any time
/architect-check

# Create a new feature with proper structure
/architect-scaffold
```

## Skills (Slash Commands)

| Command | Description |
|---------|-------------|
| `/architect-init` | Initialize clean architecture for new or existing projects |
| `/architect-check` | Run full compliance check with score and violations |
| `/architect-plan` | Create architecture-aware implementation plans |
| `/architect-history` | View decisions, compliance trends, violation patterns |
| `/architect-scaffold` | Generate feature with domain/application/infrastructure layers |

## MCP Tools

| Tool | Description |
|------|-------------|
| `architect_check` | Validate project compliance (score + violations) |
| `architect_scaffold` | Generate feature folder structure |
| `architect_log_decision` | Record an architectural decision (ADR) |
| `architect_search` | Search decisions, violations, history |
| `architect_timeline` | Get chronological context around events |
| `architect_get_details` | Fetch full details for specific IDs |
| `architect_get_status` | Project health dashboard |
| `architect_get_rules` | Get relevant rules for current context |
| `architect_improve` | Self-improvement analysis |

## Architecture Rules (16 Rule Files)

| Rule | Domain |
|------|--------|
| 00-constitution | Root architecture rules, SOLID principles, mandatory checklist |
| 01-architecture | Clean architecture layers, feature structure, use case pattern |
| 02-security | OWASP Top 10, input validation, auth, secrets management |
| 03-testing | Testing pyramid (70/20/10), coverage standards |
| 04-api-design | REST standards, pagination, versioning, error formats |
| 05-database | Migrations, query safety, schema design, connection pooling |
| 06-documentation | JSDoc, ADRs, module READMEs, PROJECT_MAP, CHANGELOG |
| 07-performance | N+1 prevention, caching, timeouts, lazy loading |
| 08-error-handling | Error hierarchy, structured logging, correlation IDs |
| 09-git-workflow | Conventional commits, branch strategy, PR standards |
| 10-frontend | Component architecture, state management, accessibility |
| 11-auth-patterns | JWT, OAuth, RBAC, password security, session management |
| 12-monitoring | Health checks, metrics, alerting, distributed tracing |
| 13-environment | Config management, feature flags, Docker standards |
| 14-dependency-management | Version pinning, security auditing, wrapper patterns |
| 15-code-style | Naming conventions, file limits, function rules, type safety |
| 16-ci-cd | Pipeline stages, Docker builds, deployment strategy |

## How It Works

### Three-Layer Architecture

```
Plugin Layer (always active)
├── .claude-plugin/CLAUDE.md    ← Plugin instructions for Claude
├── hooks/hooks.json            ← Lifecycle hooks (4 hook points)
├── .mcp.json                   ← MCP server registration (10 tools)
└── skills/*/SKILL.md           ← 5 slash commands

Rule Layer (installed to target project)
├── .claude/rules/*.md          ← 16 rule files with path-scoped activation
├── CLAUDE.md                   ← Project constitution
└── docs/templates/             ← Document templates (ADR, README, etc.)

Data Layer (persistent, local)
└── ~/.claude-architect/
    └── architect.sqlite        ← SQLite database (decisions, violations, scores)
```

### Lifecycle Integration

| Event | What Happens |
|-------|-------------|
| **Session Start** | Load project context, show compliance score and open violations |
| **User Prompt** | Inject relevant architecture rules for current working area |
| **File Write/Edit** | Run quick validation on changed file, detect violations |
| **Session End** | Summarize changes, update compliance score, trigger self-improvement |

### Compliance Scoring

Score ranges from 0-100, weighted by category:
- **Architecture** (30%): Dependency direction, feature structure
- **Security** (25%): Anti-patterns, hardcoded secrets, SQL safety
- **Quality** (20%): File size, test coverage, documentation
- **Testing** (15%): Test file existence, co-location
- **Documentation** (10%): README, PROJECT_MAP, JSDoc

### Self-Improvement Engine

After 5+ sessions, the engine analyzes patterns:
- **High ignore rate** → Suggests relaxing the rule
- **Fast resolution** → Suggests adding auto-fix
- **High frequency** → Suggests splitting the rule
- **Zero violations** → Suggests removing (save tokens)

## Web Dashboard

Open `http://localhost:37778` to view:
- Compliance score gauge with trend
- Violation summary cards (critical/warning/info)
- Compliance trend chart (last 20 sessions)
- Open violations table
- Recent decisions timeline
- Improvement suggestions

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Bun (TypeScript) |
| Database | SQLite via bun:sqlite |
| MCP Server | @modelcontextprotocol/sdk (stdio) |
| Worker API | Express.js (port 37778) |
| Dashboard | Vanilla HTML/CSS/JS + Chart.js |

## Project Structure

```
claude-architect/
├── .claude-plugin/     Plugin manifest and instructions
├── hooks/              Lifecycle hook configuration
├── skills/             5 slash command definitions
├── scripts/            Compiled server bundles
├── rules/              16 architecture rule files
├── templates/          6 document templates
├── ui/                 Web dashboard (HTML/CSS/JS)
└── src/
    ├── servers/        MCP server (stdio)
    ├── services/
    │   ├── sqlite/     Database layer (8 tables)
    │   ├── worker/     HTTP API server
    │   ├── validator/  Architecture validation engine
    │   ├── scaffolder/ Feature generator
    │   └── improver/   Self-improvement engine
    ├── cli/handlers/   Hook event handlers
    ├── types/          TypeScript type definitions
    └── utils/          Logging, paths, config
```

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feat/your-feature`
3. Commit using conventional commits: `git commit -m "feat(rules): add GraphQL rules"`
4. Push and create a Pull Request

## License

MIT License — use it, modify it, share it.
