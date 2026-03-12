# CQRS and Event Sourcing

> **Domain:** Fundamentals > Design Patterns > Architectural
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

**CQRS (Command Query Responsibility Segregation)** separates read and write operations into different models. Commands (writes) mutate state; Queries (reads) return data. Each side can be optimized independently.

**Event Sourcing** stores state as a sequence of **immutable events** rather than overwriting current state. The current state is derived by replaying events. Combined with CQRS, events from the write side project into optimized read models.

**Origin:** CQRS was formalized by Greg Young (~2010), building on Bertrand Meyer's CQS principle (1988). Event Sourcing was popularized alongside CQRS and is deeply connected to Domain-Driven Design (DDD).

## How It Works

### CQRS Architecture

```
                    ┌─── Command ───→  Write Model  ───→  Event Store
                    │                  (domain logic)      (source of truth)
   Client ─────────┤                                           │
                    │                                      projections
                    └─── Query ────→  Read Model   ←───────────┘
                                     (denormalized,
                                      optimized views)
```

### Event Sourcing — TypeScript

```typescript
// Events — immutable facts that happened
type AccountEvent =
  | { type: "AccountOpened"; accountId: string; owner: string; timestamp: Date }
  | { type: "MoneyDeposited"; accountId: string; amount: number; timestamp: Date }
  | { type: "MoneyWithdrawn"; accountId: string; amount: number; timestamp: Date }
  | { type: "AccountClosed"; accountId: string; timestamp: Date };

// Aggregate — rebuilds state from events
class BankAccount {
  private balance = 0;
  private isOpen = false;
  private pendingEvents: AccountEvent[] = [];

  // Rebuild state from history
  static fromEvents(events: AccountEvent[]): BankAccount {
    const account = new BankAccount();
    for (const event of events) {
      account.apply(event);
    }
    return account;
  }

  // Command — validates and produces events
  deposit(amount: number): void {
    if (!this.isOpen) throw new Error("Account is closed");
    if (amount <= 0) throw new Error("Amount must be positive");
    this.addEvent({ type: "MoneyDeposited", accountId: this.id, amount, timestamp: new Date() });
  }

  withdraw(amount: number): void {
    if (!this.isOpen) throw new Error("Account is closed");
    if (amount > this.balance) throw new Error("Insufficient funds");
    this.addEvent({ type: "MoneyWithdrawn", accountId: this.id, amount, timestamp: new Date() });
  }

  // Apply event to state (no validation — events are facts)
  private apply(event: AccountEvent): void {
    switch (event.type) {
      case "AccountOpened":
        this.isOpen = true;
        this.id = event.accountId;
        break;
      case "MoneyDeposited":
        this.balance += event.amount;
        break;
      case "MoneyWithdrawn":
        this.balance -= event.amount;
        break;
      case "AccountClosed":
        this.isOpen = false;
        break;
    }
  }

  private addEvent(event: AccountEvent): void {
    this.apply(event);
    this.pendingEvents.push(event);
  }

  getPendingEvents(): AccountEvent[] { return [...this.pendingEvents]; }
  getBalance(): number { return this.balance; }
}
```

### CQRS Command and Query Sides

```typescript
// Event Store — append-only
class EventStore {
  private events: Map<string, AccountEvent[]> = new Map();

  append(streamId: string, events: AccountEvent[]): void {
    const existing = this.events.get(streamId) || [];
    this.events.set(streamId, [...existing, ...events]);
    // Publish to projections
    events.forEach(e => this.publish(e));
  }

  getStream(streamId: string): AccountEvent[] {
    return this.events.get(streamId) || [];
  }

  private subscribers: ((event: AccountEvent) => void)[] = [];
  subscribe(handler: (event: AccountEvent) => void): void {
    this.subscribers.push(handler);
  }
  private publish(event: AccountEvent): void {
    this.subscribers.forEach(sub => sub(event));
  }
}

// Command Handler (Write Side)
class AccountCommandHandler {
  constructor(private eventStore: EventStore) {}

  handle(command: DepositCommand): void {
    // Load aggregate from events
    const events = this.eventStore.getStream(command.accountId);
    const account = BankAccount.fromEvents(events);

    // Execute command (validates + produces new events)
    account.deposit(command.amount);

    // Persist new events
    this.eventStore.append(command.accountId, account.getPendingEvents());
  }
}

// Read Model — Projection (Query Side)
class AccountBalanceProjection {
  private balances = new Map<string, { owner: string; balance: number }>();

  constructor(eventStore: EventStore) {
    eventStore.subscribe(event => this.handleEvent(event));
  }

  private handleEvent(event: AccountEvent): void {
    switch (event.type) {
      case "AccountOpened":
        this.balances.set(event.accountId, { owner: event.owner, balance: 0 });
        break;
      case "MoneyDeposited":
        const acc = this.balances.get(event.accountId)!;
        acc.balance += event.amount;
        break;
      case "MoneyWithdrawn":
        const acc2 = this.balances.get(event.accountId)!;
        acc2.balance -= event.amount;
        break;
    }
  }

  // Query — fast direct lookup
  getBalance(accountId: string): number {
    return this.balances.get(accountId)?.balance ?? 0;
  }

  getAccountsAbove(threshold: number): string[] {
    return [...this.balances.entries()]
      .filter(([, v]) => v.balance > threshold)
      .map(([id]) => id);
  }
}
```

```python
# Python — simplified CQRS with FastAPI
from dataclasses import dataclass
from datetime import datetime

# Events
@dataclass(frozen=True)
class OrderPlaced:
    order_id: str
    customer_id: str
    items: list[dict]
    total: float
    timestamp: datetime

@dataclass(frozen=True)
class OrderShipped:
    order_id: str
    tracking_number: str
    timestamp: datetime

# Write side — command handler
class OrderCommandHandler:
    def __init__(self, event_store: EventStore):
        self.event_store = event_store

    def place_order(self, cmd: PlaceOrderCommand) -> str:
        order_id = str(uuid4())
        event = OrderPlaced(
            order_id=order_id,
            customer_id=cmd.customer_id,
            items=cmd.items,
            total=sum(item["price"] * item["qty"] for item in cmd.items),
            timestamp=datetime.now(),
        )
        self.event_store.append(order_id, event)
        return order_id

# Read side — optimized query model
class OrderSummaryProjection:
    def __init__(self):
        self.summaries: dict[str, dict] = {}

    def handle(self, event):
        match event:
            case OrderPlaced():
                self.summaries[event.order_id] = {
                    "status": "placed",
                    "total": event.total,
                    "item_count": len(event.items),
                }
            case OrderShipped():
                self.summaries[event.order_id]["status"] = "shipped"
                self.summaries[event.order_id]["tracking"] = event.tracking_number

    def get_summary(self, order_id: str) -> dict:
        return self.summaries.get(order_id)
```

### When to Use and When Not To

```
Use CQRS when:
  - Read and write workloads have very different scaling needs
  - Complex domain logic on the write side
  - Multiple read models needed (dashboard, search, reports)
  - Event-driven architecture is already in place

Use Event Sourcing when:
  - Full audit trail is required (finance, healthcare, legal)
  - Need to reconstruct state at any point in time
  - Complex event-driven workflows
  - Domain events are a natural fit (DDD aggregates)

Avoid when:
  - Simple CRUD application — CQRS adds unnecessary complexity
  - Small team — operational overhead of dual models
  - No audit/temporal requirements — traditional state storage is simpler
  - Eventual consistency is not acceptable
```

## Real-world Examples

- **Banking/Finance** — ledger systems store transactions (events), not just balances.
- **EventStoreDB** — purpose-built database for event sourcing by Greg Young.
- **Apache Kafka** — append-only log used as event store with consumer projections.
- **Axon Framework** — Java CQRS/ES framework with saga support.
- **Marten** — .NET library for event sourcing with PostgreSQL.
- **Git** — stores commits (events), current state derived by replaying diffs.
- **Redux** — actions are events, reducers rebuild state (client-side event sourcing).

## Sources

- Young, G. (2010). *CQRS Documents*. [cqrs.files.wordpress.com](https://cqrs.files.wordpress.com/2010/11/cqrs_documents.pdf)
- Fowler, M. (2011). [CQRS](https://martinfowler.com/bliki/CQRS.html). martinfowler.com.
- Fowler, M. (2005). [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html). martinfowler.com.
- Vernon, V. (2013). *Implementing Domain-Driven Design*. Addison-Wesley. Chapters 8, 12.
