# Feature: Notification

## Purpose
Push notification system for user alerts

## Public API

### Exports
| Export | Type | Description |
|--------|------|-------------|
| `Notification` | class | Notification domain entity |
| `CreateNotificationUseCase` | function | Creates a new Notification |
| `NotificationOutput` | interface | Output DTO |

### API Endpoints (if applicable)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/notification | Create new Notification |
| GET | /api/v1/notification/:id | Get Notification by ID |

## Dependencies

### Internal
- None (new feature)

### External
- None yet

### Forbidden Dependencies
- NEVER import from other features' internal code directly

## Data Flow
```
Controller → Validate Input → Use Case → Domain Entity → Repository Port → Database
```

## Testing
```bash
bun test -- --filter=notification
```
