# Project Map

> Last updated: YYYY-MM-DD

## Overview
[One sentence: what this application does]

## Architecture
Clean Architecture with Feature-Based Organization

## Technology Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Language | | |
| Framework | | |
| Database | | |
| Cache | | |
| Auth | | |
| Testing | | |

## Directory Structure
```
src/
├── features/
│   ├── auth/              # Authentication & authorization
│   ├── users/             # User management
│   └── ...
├── shared/
│   ├── types/             # Shared type definitions
│   ├── utils/             # Cross-cutting utilities
│   └── middleware/         # Shared middleware
├── config/                # Application configuration
└── app.ts                 # Application entry point
```

## Module Registry
| Module | Purpose | Dependencies | Owner | Status |
|--------|---------|-------------|-------|--------|
| auth | Authentication & sessions | shared/types | — | Active |
| users | User CRUD & profiles | auth, shared/types | — | Active |

## API Surface
| Base Path | Feature | Auth Required |
|-----------|---------|---------------|
| /api/v1/auth | auth | No (login), Yes (logout) |
| /api/v1/users | users | Yes |

## Environment Requirements
- Node.js >= 20 / Python >= 3.12
- PostgreSQL >= 15
- Redis >= 7 (optional, for caching)

## Getting Started
```bash
cp .env.example .env
# Edit .env with your values
npm install
npm run migrate
npm run dev
```
