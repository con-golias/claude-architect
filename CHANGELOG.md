# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-03-04

### Added
- Full Claude Code plugin architecture with MCP server, hooks, and skills
- 16 architecture rule files (clean architecture, security, testing, API, database, etc.)
- 6 document templates (ADR, MODULE-README, PROJECT_MAP, CHANGELOG, DEPENDENCY_RULES, UBIQUITOUS-LANGUAGE)
- SQLite database with 8 tables for persistent project memory
- Architecture validation engine with 4 checkers (dependency, structure, security, quality)
- Compliance scoring system (0-100) with category breakdown
- 10 MCP tools for architecture management
- 5 user-invocable skills (/architect-init, /architect-check, /architect-plan, /architect-history, /architect-scaffold)
- 4 lifecycle hooks (SessionStart, UserPromptSubmit, PostToolUse, Stop)
- Feature scaffolding generator with full clean architecture structure
- Self-improvement engine analyzing violation patterns
- Web dashboard on localhost:37778 with compliance trends and violation tracking
- Cross-platform installer (Node.js)
- CI/CD pipeline standards (rule 16)
