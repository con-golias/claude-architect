# Order

order management

## Structure

```
order/
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
| POST | /api/order | Create Order |
| GET | /api/order/:id | Get by ID |
