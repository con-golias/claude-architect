# Claude Architect — Development Instructions

This is the claude-architect plugin source code. When working on this project:

## Project Structure
- `src/` — TypeScript source code (Bun runtime)
- `rules/` — Architecture rule files (installed to user projects)
- `templates/` — Document templates (installed to user projects)
- `skills/` — Slash command definitions (SKILL.md)
- `hooks/` — Lifecycle hook configuration
- `ui/` — Web dashboard (vanilla HTML/CSS/JS)
- `scripts/` — Compiled bundles and runtime helpers

## Build
```bash
bun run build    # Produces scripts/mcp-server.cjs and worker-service.cjs
bun test         # Run tests
```

## Key Architecture
- MCP server (`src/servers/mcp-server.ts`) is a thin wrapper that delegates to Worker API
- Worker server (`src/services/worker/WorkerServer.ts`) runs on port 37778
- Database (`~/.claude-architect/architect.sqlite`) stores all persistent data
- Validation engine (`src/services/validator/`) runs 4 checkers
- Self-improvement (`src/services/improver/`) analyzes violation patterns

## Conventions
- TypeScript strict mode
- JSDoc on all exported functions
- Files under 200 lines
- Conventional commits
