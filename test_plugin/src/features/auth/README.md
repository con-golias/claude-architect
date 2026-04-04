# Auth

auth management

## Structure

```
auth/
├── domain/          Business rules and entities
├── application/     Use cases and DTOs
├── infrastructure/  Controllers and repository implementations
└── __tests__/       Integration and e2e tests
```

## Data Flow

```
Request → Controller → Use Case → Entity → Repository → Database
```

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth | Create Auth |
| GET | /api/auth/:id | Get by ID |
