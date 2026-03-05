# Event Schema Definition

## Event Metadata (Required for All Events)

```typescript
interface DomainEvent {
  eventId: string;        // UUID v4
  eventType: string;      // e.g., "order.created"
  aggregateId: string;    // Entity this event belongs to
  aggregateType: string;  // e.g., "Order"
  version: number;        // Schema version
  timestamp: string;      // ISO 8601
  correlationId: string;  // Request trace ID
  causationId?: string;   // Parent event ID
  payload: unknown;       // Event-specific data
}
```

## Event Naming Convention
- Format: `{aggregate}.{past_tense_verb}`
- Examples: `order.created`, `payment.processed`, `user.email_verified`

## Event Catalog

### [Aggregate Name]

| Event Type | Description | Payload Schema |
|-----------|-------------|----------------|
| `[aggregate].[verb]` | When [condition] | `{ field: type }` |

## Event Flow Diagram

```
[Producer] --publish--> [Event Bus] --subscribe--> [Consumer]
                              |
                              +--> [Dead Letter Queue]
```

## Idempotency
- Consumers MUST be idempotent (handle duplicate events safely)
- Use `eventId` as deduplication key
- Store processed event IDs for at least 7 days

## Ordering Guarantees
- Events for the same `aggregateId` are ordered by `version`
- No global ordering across different aggregates
- Use saga pattern for cross-aggregate coordination

## Schema Evolution
- Add new fields with defaults (backward compatible)
- Never remove or rename fields in existing versions
- Use `version` field for breaking changes
