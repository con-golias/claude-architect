# Feature: {Feature Name}

## Purpose
What business problem does this feature solve? (1-2 sentences)

## Public API

### Exports
| Export | Type | Description |
|--------|------|-------------|
| `CreateUserUseCase` | class | Creates a new user account |
| `UserDTO` | interface | User data transfer object |

### API Endpoints (if applicable)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/users | Create new user |
| GET | /api/v1/users/:id | Get user by ID |

## Dependencies

### Internal
- `src/shared/types` — shared type definitions
- `src/features/auth` — authentication service (via port injection)

### External
- `bcrypt` — password hashing
- `zod` — input validation

### Forbidden Dependencies
- NEVER import from `src/features/payments` directly
- NEVER import from any infrastructure layer outside this feature

## Data Flow
```
Controller → Validate Input → Use Case → Domain Entity → Repository Port → Database
```

## Testing
```bash
# Unit tests
npm test -- --filter=users

# Integration tests
npm run test:integration -- --filter=users
```

## Key Decisions
- Uses UUID v7 for user IDs — see [ADR-0003](../../docs/decisions/0003-uuid-v7.md)
