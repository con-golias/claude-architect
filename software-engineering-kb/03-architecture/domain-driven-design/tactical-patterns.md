# DDD: Tactical Patterns — Complete Specification

> **AI Plugin Directive:** Tactical patterns are the implementation-level building blocks of DDD. Use these patterns to translate domain knowledge into working code. Every complex domain MUST use these patterns to maintain a clean, expressive domain model.

---

## 1. Domain Events

### What They Are
**A record of something significant that happened in the domain. Events are named in past tense using domain language.**

### Rules
1. Events are IMMUTABLE — once created, they never change
2. Events are named in PAST TENSE — `OrderSubmitted`, not `SubmitOrder`
3. Events contain ONLY the data needed to describe what happened
4. Events are raised BY entities/aggregates, handled BY application/infrastructure

### Implementation

```typescript
// Base domain event
export abstract class DomainEvent {
  public readonly eventId: string;
  public readonly occurredAt: Date;

  constructor(public readonly aggregateId: string) {
    this.eventId = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  abstract get eventType(): string;
}

// Concrete events
export class OrderSubmittedEvent extends DomainEvent {
  get eventType() { return 'order.submitted'; }

  constructor(
    orderId: OrderId,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly itemCount: number,
  ) {
    super(orderId.value);
  }
}

export class OrderCancelledEvent extends DomainEvent {
  get eventType() { return 'order.cancelled'; }

  constructor(
    orderId: OrderId,
    public readonly reason: string,
    public readonly cancelledBy: string,
  ) {
    super(orderId.value);
  }
}

// Aggregate Root collects events
export abstract class AggregateRoot {
  private _domainEvents: DomainEvent[] = [];

  get domainEvents(): ReadonlyArray<DomainEvent> {
    return [...this._domainEvents];
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }

  clearDomainEvents(): void {
    this._domainEvents = [];
  }
}

// Entity raises events through business methods
class Order extends AggregateRoot {
  submit(): void {
    // Business logic first
    if (this._items.length === 0) throw new EmptyOrderError(this._id);
    this._status = OrderStatus.SUBMITTED;

    // Then raise event
    this.addDomainEvent(new OrderSubmittedEvent(
      this._id,
      this._customerId.value,
      this.totalAmount.amount,
      this.totalAmount.currency.code,
      this.itemCount,
    ));
  }
}

// Use case publishes events after saving
class SubmitOrderHandler {
  async execute(input: SubmitOrderInput): Promise<void> {
    const order = await this.orderRepo.findById(OrderId.from(input.orderId));
    order.submit();
    await this.orderRepo.save(order);

    // Publish events AFTER successful save
    await this.eventBus.publishAll(order.domainEvents);
    order.clearDomainEvents();
  }
}
```

### Event Handler Types

```typescript
// 1. SAME CONTEXT handler — reacts to event within the same bounded context
class SendOrderConfirmationEmail implements EventHandler<OrderSubmittedEvent> {
  constructor(private readonly emailService: EmailService) {}

  async handle(event: OrderSubmittedEvent): Promise<void> {
    await this.emailService.send({
      to: event.customerEmail,
      template: 'order-submitted',
      data: { orderId: event.aggregateId, total: event.totalAmount },
    });
  }
}

// 2. CROSS-CONTEXT handler — reacts to event from another bounded context
class CreateShipmentOnOrderConfirmed implements EventHandler<OrderConfirmedEvent> {
  constructor(private readonly createShipment: CreateShipmentHandler) {}

  async handle(event: OrderConfirmedEvent): Promise<void> {
    await this.createShipment.execute({
      referenceId: event.aggregateId,
      items: event.items,
      address: event.shippingAddress,
    });
  }
}

// 3. PROJECTION handler — updates read model
class UpdateOrderDashboard implements EventHandler<OrderSubmittedEvent> {
  constructor(private readonly dashboardRepo: DashboardRepository) {}

  async handle(event: OrderSubmittedEvent): Promise<void> {
    await this.dashboardRepo.incrementDailyOrderCount(event.occurredAt);
    await this.dashboardRepo.addToRevenue(event.totalAmount, event.currency);
  }
}
```

---

## 2. Domain Services

### What They Are
**Logic that doesn't naturally belong to any single entity. Domain services contain business rules that span multiple entities or require external information.**

### When to Use Domain Services

```
Does this logic belong to a single entity?
├── YES → Put it IN the entity
└── NO → Does it involve multiple entities?
    ├── YES → Domain Service
    └── NO → Does it require external information (exchange rates, tax rules)?
        ├── YES → Domain Service (with port interface for external data)
        └── NO → Re-evaluate — it probably belongs in an entity
```

### Rules
1. Domain services are STATELESS
2. They contain business logic that doesn't fit in entities
3. They operate on domain objects, not infrastructure
4. They are named after the business operation they perform

### Implementation

```typescript
// ═══ EXAMPLE 1: Cross-Entity Logic ═══
// Pricing involves Product, Customer, and DiscountRules — no single entity owns it
export class PricingService {
  constructor(
    private readonly discountPolicies: DiscountPolicy[],
    private readonly taxCalculator: TaxCalculator,
  ) {}

  calculateOrderTotal(order: Order, customer: Customer): OrderPricing {
    let subtotal = order.totalAmount;

    // Apply applicable discounts
    for (const policy of this.discountPolicies) {
      if (policy.isApplicable(order, customer)) {
        const discount = policy.calculateDiscount(order, customer);
        subtotal = subtotal.subtract(discount.amount);
      }
    }

    // Calculate tax
    const tax = this.taxCalculator.calculate(subtotal, order.shippingAddress);

    return OrderPricing.create(
      order.totalAmount,
      subtotal,
      tax,
      subtotal.add(tax.amount),
    );
  }
}

// ═══ EXAMPLE 2: Transfer Between Aggregates ═══
// Transferring money between accounts — neither Account owns this logic
export class FundsTransferService {
  transfer(
    from: Account,
    to: Account,
    amount: Money,
    description: string,
  ): TransferResult {
    // Business rule: both accounts must be active
    if (!from.isActive) throw new InactiveAccountError(from.id);
    if (!to.isActive) throw new InactiveAccountError(to.id);

    // Business rule: sufficient funds
    if (from.balance.isLessThan(amount)) {
      throw new InsufficientFundsError(from.id, amount, from.balance);
    }

    // Business rule: daily transfer limit
    if (from.dailyTransferTotal.add(amount).isGreaterThan(from.dailyLimit)) {
      throw new DailyLimitExceededError(from.id, from.dailyLimit);
    }

    // Execute on both aggregates
    from.debit(amount, description);
    to.credit(amount, description);

    return TransferResult.success(from.id, to.id, amount);
  }
}

// ═══ EXAMPLE 3: Complex Validation Across Entities ═══
export class ReservationValidator {
  canReserve(
    room: Room,
    guest: Guest,
    dateRange: DateRange,
    existingReservations: Reservation[],
  ): ValidationResult {
    const errors: ValidationError[] = [];

    // Room availability check
    const conflicts = existingReservations.filter(r =>
      r.roomId.equals(room.id) && r.dateRange.overlaps(dateRange)
    );
    if (conflicts.length > 0) {
      errors.push(new RoomNotAvailableError(room.id, dateRange));
    }

    // Guest eligibility check
    if (guest.hasOutstandingBalance) {
      errors.push(new GuestHasBalanceError(guest.id));
    }

    // Blackout date check
    if (room.hasBlackoutDates(dateRange)) {
      errors.push(new BlackoutDateError(room.id, dateRange));
    }

    // Minimum stay check
    if (dateRange.durationInDays < room.minimumStay) {
      errors.push(new MinimumStayError(room.id, room.minimumStay, dateRange.durationInDays));
    }

    return errors.length === 0
      ? ValidationResult.valid()
      : ValidationResult.invalid(errors);
  }
}
```

---

## 3. Specifications (Business Rule Objects)

### What They Are
**Encapsulated business rules that can be combined using logical operators. Use specifications when business rules need to be reused, combined, or persisted.**

### Implementation

```typescript
// Base specification
export abstract class Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends Specification<T> {
  constructor(private left: Specification<T>, private right: Specification<T>) { super(); }
  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

class OrSpecification<T> extends Specification<T> {
  constructor(private left: Specification<T>, private right: Specification<T>) { super(); }
  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

class NotSpecification<T> extends Specification<T> {
  constructor(private spec: Specification<T>) { super(); }
  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}

// Concrete specifications
class IsEligibleForDiscount extends Specification<Customer> {
  isSatisfiedBy(customer: Customer): boolean {
    return customer.totalOrders > 5 && customer.accountAge.isGreaterThan(Duration.months(3));
  }
}

class HasVerifiedEmail extends Specification<Customer> {
  isSatisfiedBy(customer: Customer): boolean {
    return customer.emailVerified;
  }
}

class IsInGoodStanding extends Specification<Customer> {
  isSatisfiedBy(customer: Customer): boolean {
    return !customer.hasOutstandingBalance && !customer.isSuspended;
  }
}

// Compose specifications
const canReceiveLoyaltyRewards = new IsEligibleForDiscount()
  .and(new HasVerifiedEmail())
  .and(new IsInGoodStanding());

// Use in code
if (canReceiveLoyaltyRewards.isSatisfiedBy(customer)) {
  order.applyLoyaltyDiscount();
}

// Use for querying (repository integration)
interface OrderRepository {
  findBySpecification(spec: Specification<Order>): Promise<Order[]>;
}
```

---

## 4. Factories

### What They Are
**Encapsulate complex object creation logic. Use factories when creating an object requires more than a simple constructor call.**

### When to Use Factories

```
Is creation simple (just assigning values)?
├── YES → Use constructor or static factory method on the entity
└── NO → Is creation complex (multiple steps, conditional logic, loading data)?
    ├── YES → Use a Factory class
    └── NO → Use a static factory method
```

### Implementation

```typescript
// 1. SIMPLE: Static factory method on the entity itself
class Order {
  static create(id: OrderId, customerId: CustomerId): Order {
    return new Order({ id, customerId, items: [], status: OrderStatus.DRAFT });
  }

  static reconstitute(props: OrderProps): Order {
    return new Order(props); // No validation, no events — loading from DB
  }
}

// 2. COMPLEX: Separate Factory class
class OrderFactory {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly productRepo: ProductRepository,
    private readonly pricingService: PricingService,
  ) {}

  async createFromCart(cart: ShoppingCart, customer: Customer): Promise<Order> {
    const orderId = this.orderRepo.nextId();
    const order = Order.create(orderId, customer.id);

    // Complex creation logic
    for (const cartItem of cart.items) {
      const product = await this.productRepo.findById(cartItem.productId);
      if (!product) throw new ProductNotFoundError(cartItem.productId);
      if (!product.isAvailable) throw new ProductUnavailableError(product.id);

      // Get personalized pricing
      const price = await this.pricingService.getPrice(product, customer);
      order.addItem(product.id, product.name, price, cartItem.quantity);
    }

    // Apply customer-specific rules
    if (customer.isVip) {
      order.enablePriorityProcessing();
    }

    return order;
  }

  async createRepeatOrder(previousOrderId: OrderId, customer: Customer): Promise<Order> {
    const previous = await this.orderRepo.findById(previousOrderId);
    if (!previous) throw new OrderNotFoundError(previousOrderId);

    const order = Order.create(this.orderRepo.nextId(), customer.id);

    for (const item of previous.items) {
      const product = await this.productRepo.findById(item.productId);
      if (product?.isAvailable) {
        const currentPrice = await this.pricingService.getPrice(product, customer);
        order.addItem(product.id, product.name, currentPrice, item.quantity);
      }
    }

    if (previous.shippingAddress) {
      order.setShippingAddress(previous.shippingAddress);
    }

    return order;
  }
}
```

---

## 5. Domain Events vs Integration Events

### The Distinction

| Domain Event | Integration Event |
|-------------|-------------------|
| Within ONE bounded context | Between bounded contexts |
| Rich domain types | Primitive types (serializable) |
| Synchronous or async | Always async (message queue) |
| Strong consistency | Eventual consistency |
| May contain domain objects | Contains only primitives/DTOs |

### Implementation

```typescript
// DOMAIN EVENT — used within the context
class OrderSubmittedEvent extends DomainEvent {
  constructor(
    public readonly orderId: OrderId,        // Domain type
    public readonly totalAmount: Money,      // Domain type
    public readonly customer: Customer,      // Domain entity reference
  ) {
    super(orderId.value);
  }
}

// INTEGRATION EVENT — published to other contexts
interface OrderSubmittedIntegrationEvent {
  eventId: string;
  eventType: 'ordering.order.submitted';
  timestamp: string;
  version: '1.0';
  payload: {
    orderId: string;           // Primitive
    customerId: string;        // Primitive
    totalAmount: number;       // Primitive
    currency: string;          // Primitive
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
    }>;
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
  };
}

// Mapper: Domain Event → Integration Event
class OrderEventMapper {
  static toIntegration(domainEvent: OrderSubmittedEvent): OrderSubmittedIntegrationEvent {
    return {
      eventId: domainEvent.eventId,
      eventType: 'ordering.order.submitted',
      timestamp: domainEvent.occurredAt.toISOString(),
      version: '1.0',
      payload: {
        orderId: domainEvent.orderId.value,
        customerId: domainEvent.customer.id.value,
        totalAmount: domainEvent.totalAmount.amount,
        currency: domainEvent.totalAmount.currency.code,
        items: domainEvent.items.map(i => ({
          productId: i.productId.value,
          quantity: i.quantity.value,
          unitPrice: i.unitPrice.amount,
        })),
        shippingAddress: {
          street: domainEvent.shippingAddress.street,
          city: domainEvent.shippingAddress.city,
          state: domainEvent.shippingAddress.state,
          postalCode: domainEvent.shippingAddress.postalCode,
          country: domainEvent.shippingAddress.country.value,
        },
      },
    };
  }
}
```

---

## 6. Repository Pattern in DDD

### Rules

1. One repository per AGGREGATE ROOT
2. Repository interface defined in DOMAIN layer
3. Repository implementation in INFRASTRUCTURE layer
4. Repository returns DOMAIN entities, never ORM entities
5. Repository does NOT contain business logic

### Complete Repository Pattern

```typescript
// Domain layer: defines the interface
// domain/ports/order.repository.ts
export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: CustomerId): Promise<Order[]>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
  delete(id: OrderId): Promise<void>;
  nextId(): OrderId;
}

// Infrastructure layer: implements the interface
// infrastructure/persistence/typeorm-order.repository.ts
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly dataSource: DataSource) {}

  async save(order: Order): Promise<void> {
    const ormEntity = OrderMapper.toPersistence(order);
    const repo = this.dataSource.getRepository(OrderOrmEntity);
    await repo.save(ormEntity);
  }

  async findById(id: OrderId): Promise<Order | null> {
    const repo = this.dataSource.getRepository(OrderOrmEntity);
    const orm = await repo.findOne({
      where: { id: id.value },
      relations: { items: true },
    });
    return orm ? OrderMapper.toDomain(orm) : null;
  }

  nextId(): OrderId {
    return OrderId.generate();
  }
}

// Testing: In-memory implementation
export class InMemoryOrderRepository implements OrderRepository {
  private store = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    // Deep clone to simulate persistence
    this.store.set(order.id.value, structuredClone(order));
  }

  async findById(id: OrderId): Promise<Order | null> {
    const order = this.store.get(id.value);
    return order ? structuredClone(order) : null;
  }

  nextId(): OrderId {
    return OrderId.generate();
  }

  // Test helper methods
  clear(): void { this.store.clear(); }
  count(): number { return this.store.size; }
  getAll(): Order[] { return [...this.store.values()]; }
}
```

---

## 7. Tactical Pattern Selection Guide

```
What am I modeling?
├── A thing with unique identity and lifecycle?
│   └── ENTITY (with typed ID value object)
├── A descriptive concept without identity?
│   └── VALUE OBJECT (immutable, compared by attributes)
├── A cluster of entities that change together?
│   └── AGGREGATE (with aggregate root)
├── Something significant that happened?
│   └── DOMAIN EVENT (past tense, immutable)
├── Logic spanning multiple entities?
│   └── DOMAIN SERVICE (stateless)
├── A complex business rule that needs composition?
│   └── SPECIFICATION (can be AND/OR/NOT combined)
├── Complex object creation?
│   └── FACTORY (separate class or static method)
├── Persistence of aggregates?
│   └── REPOSITORY (one per aggregate root)
└── External system integration?
    └── PORT INTERFACE (defined in domain, implemented in infrastructure)
```

---

## 8. Complete Example: Applying All Patterns

```typescript
// A complete bounded context using all tactical patterns

// 1. VALUE OBJECTS
class ReservationId extends TypedId { }
class GuestId extends TypedId { }
class RoomNumber {
  private constructor(private readonly _value: string) {}
  static from(value: string): RoomNumber {
    if (!/^[A-Z]\d{3}$/.test(value)) throw new InvalidRoomNumberError(value);
    return new RoomNumber(value);
  }
}
class StayDuration {
  static create(checkIn: Date, checkOut: Date): StayDuration {
    if (checkOut <= checkIn) throw new InvalidStayDurationError();
    return new StayDuration(checkIn, checkOut);
  }
  get nights(): number {
    return Math.ceil((this.checkOut.getTime() - this.checkIn.getTime()) / (1000 * 60 * 60 * 24));
  }
}

// 2. ENTITY (inside aggregate)
class RoomCharge {
  constructor(
    public readonly id: ChargeId,
    public readonly description: string,
    public readonly amount: Money,
    public readonly chargedAt: Date,
  ) {}
}

// 3. AGGREGATE ROOT
class Reservation extends AggregateRoot {
  private _guestId: GuestId;           // Reference by ID
  private _roomNumber: RoomNumber;      // Value object
  private _stay: StayDuration;          // Value object
  private _status: ReservationStatus;
  private _charges: RoomCharge[];       // Entity inside aggregate
  private _specialRequests: string;

  static create(id: ReservationId, guestId: GuestId, room: RoomNumber, stay: StayDuration): Reservation {
    const reservation = new Reservation({ id, guestId, room, stay, status: ReservationStatus.PENDING, charges: [] });
    reservation.addDomainEvent(new ReservationCreatedEvent(id, guestId, room, stay));
    return reservation;
  }

  confirm(): void { /* 4. DOMAIN EVENT raised */ }
  checkIn(): void { /* state transition + event */ }
  addCharge(description: string, amount: Money): void { /* adds RoomCharge entity */ }
  checkOut(): void { /* state transition + event */ }
  cancel(reason: CancellationReason): void { /* state transition + event */ }
}

// 5. DOMAIN SERVICE
class RoomAvailabilityService {
  isAvailable(room: RoomNumber, stay: StayDuration, existing: Reservation[]): boolean {
    return !existing.some(r =>
      r.roomNumber.equals(room) && r.stay.overlaps(stay) && r.isActive
    );
  }
}

// 6. SPECIFICATION
class IsEligibleForUpgrade extends Specification<Reservation> {
  isSatisfiedBy(reservation: Reservation): boolean {
    return reservation.stay.nights >= 3 && reservation.status === ReservationStatus.CONFIRMED;
  }
}

// 7. FACTORY
class ReservationFactory {
  async createFromBookingRequest(request: BookingRequest): Promise<Reservation> {
    // Complex creation with validation and external checks
  }
}

// 8. REPOSITORY
interface ReservationRepository {
  save(reservation: Reservation): Promise<void>;
  findById(id: ReservationId): Promise<Reservation | null>;
  findByRoom(room: RoomNumber, dateRange: StayDuration): Promise<Reservation[]>;
  nextId(): ReservationId;
}
```
