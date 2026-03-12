# DDD: Aggregates, Entities & Value Objects — Complete Specification

> **AI Plugin Directive:** These are the building blocks of every domain model. EVERY piece of business data MUST be modeled as either an Entity, Value Object, or Aggregate. Wrong choices here lead to data corruption, performance problems, and tangled code.

---

## 1. Entity vs Value Object — Decision Rules

### Entities
**Objects with a unique identity that persists over time. Two entities with the same attributes but different IDs are DIFFERENT objects.**

### Value Objects
**Objects defined by their attributes, not by identity. Two value objects with the same attributes are EQUAL and interchangeable.**

### Decision Matrix

| Question | Entity | Value Object |
|----------|--------|-------------|
| Does it have a lifecycle? (created, modified, deleted) | Yes | No |
| Do you track it by ID? | Yes | No |
| Can two instances with the same attributes exist? | Yes (different IDs) | No (they're equal) |
| Is it immutable? | Usually not | ALWAYS |
| Does it have its own table in the DB? | Usually yes | Usually embedded |
| Would you show it in a list with an ID column? | Yes | No |

### Common Examples

```
ENTITIES                    VALUE OBJECTS
─────────────────────       ─────────────────────
Customer                    EmailAddress
Order                       Money
Product                     Address
Employee                    DateRange
Account                     PhoneNumber
Shipment                    Quantity
Invoice                     Color
Reservation                 Coordinates (lat/lng)
User                        Temperature
Project                     Weight
```

---

## 2. Entity Implementation

### Rules for Entities

1. **Every entity MUST have a unique, immutable ID**
2. **Entities are compared by ID, not by attributes**
3. **Entities encapsulate business logic — they are NOT data bags**
4. **Entity state changes ONLY through named business methods**
5. **Entities guard their invariants — invalid state is impossible**

### Complete Entity Example

```typescript
export class Order extends AggregateRoot {
  private readonly _id: OrderId;
  private _customerId: CustomerId;
  private _items: OrderItem[];
  private _status: OrderStatus;
  private _shippingAddress: Address | null;
  private _notes: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  // Private constructor — creation ONLY through factory methods
  private constructor(props: OrderProps) {
    super();
    this._id = props.id;
    this._customerId = props.customerId;
    this._items = [...props.items]; // Defensive copy
    this._status = props.status;
    this._shippingAddress = props.shippingAddress;
    this._notes = props.notes;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // Factory: Create NEW order
  static create(id: OrderId, customerId: CustomerId): Order {
    const order = new Order({
      id,
      customerId,
      items: [],
      status: OrderStatus.DRAFT,
      shippingAddress: null,
      notes: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    order.addDomainEvent(new OrderCreatedEvent(id, customerId));
    return order;
  }

  // Factory: Reconstitute from persistence (no events)
  static reconstitute(props: OrderProps): Order {
    return new Order(props);
  }

  // ═══ BUSINESS METHODS ═══
  // State changes ONLY through these methods — setters are FORBIDDEN

  addItem(product: Product, quantity: Quantity): void {
    this.ensureModifiable();
    if (this._items.length >= Order.MAX_ITEMS) {
      throw new MaxItemsExceededError(this._id, Order.MAX_ITEMS);
    }

    const existing = this._items.find(i => i.productId.equals(product.id));
    if (existing) {
      existing.increaseQuantity(quantity);
    } else {
      this._items.push(OrderItem.create(
        OrderItemId.generate(),
        product.id,
        product.name,
        product.currentPrice,
        quantity,
      ));
    }
    this.touch();
  }

  removeItem(itemId: OrderItemId): void {
    this.ensureModifiable();
    const index = this._items.findIndex(i => i.id.equals(itemId));
    if (index === -1) throw new ItemNotFoundError(this._id, itemId);
    this._items.splice(index, 1);
    this.touch();
  }

  submit(): void {
    this.ensureStatus(OrderStatus.DRAFT);
    if (this._items.length === 0) throw new EmptyOrderError(this._id);
    if (!this._shippingAddress) throw new MissingAddressError(this._id);
    if (this.totalAmount.isLessThan(Order.MINIMUM_AMOUNT)) {
      throw new BelowMinimumAmountError(this._id, Order.MINIMUM_AMOUNT);
    }

    this._status = OrderStatus.SUBMITTED;
    this.touch();
    this.addDomainEvent(new OrderSubmittedEvent(this._id, this.totalAmount));
  }

  cancel(reason: CancellationReason): void {
    if (!this._status.isCancellable()) {
      throw new OrderNotCancellableError(this._id, this._status);
    }
    this._status = OrderStatus.CANCELLED;
    this.touch();
    this.addDomainEvent(new OrderCancelledEvent(this._id, reason));
  }

  // ═══ COMPUTED PROPERTIES ═══

  get totalAmount(): Money {
    return this._items.reduce(
      (sum, item) => sum.add(item.subtotal),
      Money.zero(Currency.USD)
    );
  }

  get itemCount(): number {
    return this._items.reduce((count, item) => count + item.quantity.value, 0);
  }

  // ═══ IDENTITY ═══

  get id(): OrderId { return this._id; }

  equals(other: Order): boolean {
    return this._id.equals(other._id); // Entities compare by ID
  }

  // ═══ INVARIANT GUARDS ═══

  private ensureModifiable(): void {
    if (this._status !== OrderStatus.DRAFT) {
      throw new OrderNotModifiableError(this._id, this._status);
    }
  }

  private ensureStatus(expected: OrderStatus): void {
    if (this._status !== expected) {
      throw new InvalidStatusTransitionError(this._id, this._status, expected);
    }
  }

  private touch(): void {
    this._updatedAt = new Date();
  }

  private static readonly MAX_ITEMS = 50;
  private static readonly MINIMUM_AMOUNT = Money.of(1, Currency.USD);
}
```

```python
# Python Entity
@dataclass
class Order:
    _id: OrderId
    _customer_id: CustomerId
    _items: list[OrderItem]
    _status: OrderStatus
    _shipping_address: Address | None
    _created_at: datetime
    _updated_at: datetime
    _domain_events: list[DomainEvent] = field(default_factory=list, repr=False)

    @classmethod
    def create(cls, id: OrderId, customer_id: CustomerId) -> 'Order':
        order = cls(
            _id=id,
            _customer_id=customer_id,
            _items=[],
            _status=OrderStatus.DRAFT,
            _shipping_address=None,
            _created_at=datetime.utcnow(),
            _updated_at=datetime.utcnow(),
        )
        order._domain_events.append(OrderCreatedEvent(id, customer_id))
        return order

    def add_item(self, product: Product, quantity: Quantity) -> None:
        self._ensure_modifiable()
        if len(self._items) >= self.MAX_ITEMS:
            raise MaxItemsExceededError(self._id, self.MAX_ITEMS)
        self._items.append(OrderItem.create(product, quantity))
        self._touch()

    def submit(self) -> None:
        if not self._items:
            raise EmptyOrderError(self._id)
        if not self._shipping_address:
            raise MissingAddressError(self._id)
        self._status = OrderStatus.SUBMITTED
        self._touch()
        self._domain_events.append(OrderSubmittedEvent(self._id, self.total_amount))

    @property
    def total_amount(self) -> Money:
        return sum((item.subtotal for item in self._items), Money.zero(Currency.USD))

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Order):
            return False
        return self._id == other._id  # Entities compare by ID

    def __hash__(self) -> int:
        return hash(self._id)

    MAX_ITEMS = 50
```

---

## 3. Value Object Implementation

### Rules for Value Objects

1. **Value Objects are ALWAYS immutable** — once created, they never change
2. **Compared by attributes, not identity** — no ID field
3. **Self-validating** — constructor rejects invalid state
4. **Operations return NEW instances** — never modify in place
5. **Replace primitives** — use `Money` instead of `number`, `Email` instead of `string`

### Core Value Objects Every Project Needs

```typescript
// ═══ MONEY ═══
export class Money {
  private constructor(
    private readonly _amount: number,
    private readonly _currency: Currency,
  ) {
    if (!Number.isFinite(_amount)) throw new InvalidMoneyError('Amount must be finite');
  }

  static of(amount: number, currency: Currency | string): Money {
    const cur = typeof currency === 'string' ? Currency.from(currency) : currency;
    return new Money(Math.round(amount * 100) / 100, cur);
  }

  static zero(currency: Currency): Money { return new Money(0, currency); }

  get amount(): number { return this._amount; }
  get currency(): Currency { return this._currency; }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this._amount + other._amount, this._currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this._amount - other._amount, this._currency);
  }

  multiply(factor: number): Money {
    return Money.of(this._amount * factor, this._currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount > other._amount;
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount < other._amount;
  }

  isNegative(): boolean { return this._amount < 0; }
  isZero(): boolean { return this._amount === 0; }

  toCents(): number { return Math.round(this._amount * 100); }

  equals(other: Money): boolean {
    return this._amount === other._amount && this._currency.equals(other._currency);
  }

  toString(): string {
    return `${this._currency.symbol}${this._amount.toFixed(2)}`;
  }

  private assertSameCurrency(other: Money): void {
    if (!this._currency.equals(other._currency)) {
      throw new CurrencyMismatchError(this._currency, other._currency);
    }
  }
}

// ═══ EMAIL ADDRESS ═══
export class EmailAddress {
  private static readonly PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(private readonly _value: string) {}

  static create(value: string): EmailAddress {
    const trimmed = value.trim().toLowerCase();
    if (!EmailAddress.PATTERN.test(trimmed)) {
      throw new InvalidEmailError(value);
    }
    if (trimmed.length > 254) {
      throw new InvalidEmailError(`Email too long: ${value}`);
    }
    return new EmailAddress(trimmed);
  }

  get value(): string { return this._value; }
  get domain(): string { return this._value.split('@')[1]; }
  get localPart(): string { return this._value.split('@')[0]; }

  equals(other: EmailAddress): boolean { return this._value === other._value; }
  toString(): string { return this._value; }
}

// ═══ ADDRESS ═══
export class Address {
  private constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly state: string,
    public readonly postalCode: string,
    public readonly country: CountryCode,
  ) {}

  static create(props: AddressProps): Address {
    if (!props.street?.trim()) throw new InvalidAddressError('Street is required');
    if (!props.city?.trim()) throw new InvalidAddressError('City is required');
    if (!props.postalCode?.trim()) throw new InvalidAddressError('Postal code is required');

    return new Address(
      props.street.trim(),
      props.city.trim(),
      (props.state ?? '').trim(),
      props.postalCode.trim(),
      CountryCode.from(props.country),
    );
  }

  equals(other: Address): boolean {
    return this.street === other.street
      && this.city === other.city
      && this.state === other.state
      && this.postalCode === other.postalCode
      && this.country.equals(other.country);
  }

  format(): string {
    return `${this.street}, ${this.city}, ${this.state} ${this.postalCode}, ${this.country.value}`;
  }
}

// ═══ DATE RANGE ═══
export class DateRange {
  private constructor(
    public readonly start: Date,
    public readonly end: Date,
  ) {}

  static create(start: Date, end: Date): DateRange {
    if (end <= start) throw new InvalidDateRangeError(start, end);
    return new DateRange(start, end);
  }

  contains(date: Date): boolean {
    return date >= this.start && date <= this.end;
  }

  overlaps(other: DateRange): boolean {
    return this.start < other.end && other.start < this.end;
  }

  get durationInDays(): number {
    return Math.ceil((this.end.getTime() - this.start.getTime()) / (1000 * 60 * 60 * 24));
  }

  equals(other: DateRange): boolean {
    return this.start.getTime() === other.start.getTime()
      && this.end.getTime() === other.end.getTime();
  }
}

// ═══ TYPED ID ═══
export class OrderId {
  private constructor(private readonly _value: string) {}

  static generate(): OrderId {
    return new OrderId(crypto.randomUUID());
  }

  static from(value: string): OrderId {
    if (!value?.trim()) throw new InvalidIdError('OrderId cannot be empty');
    return new OrderId(value.trim());
  }

  get value(): string { return this._value; }

  equals(other: OrderId): boolean { return this._value === other._value; }
  toString(): string { return this._value; }
}
```

---

## 4. Aggregate Implementation

### What Is an Aggregate?

**An Aggregate is a cluster of entities and value objects treated as a single unit for data changes. It has a single entry point called the Aggregate Root.**

### Aggregate Rules

1. **ONE Aggregate Root per aggregate** — all external access goes through the root
2. **Reference other aggregates by ID only** — NEVER hold direct references
3. **One transaction = one aggregate** — NEVER modify multiple aggregates in one transaction
4. **Keep aggregates SMALL** — large aggregates cause contention and performance issues
5. **Enforce invariants WITHIN the aggregate boundary**

### Aggregate Design Decision Guide

```
Should X be part of Aggregate A?
├── Is there an invariant between A and X that MUST be consistent at all times?
│   ├── YES → X is INSIDE Aggregate A
│   └── NO → X is a SEPARATE aggregate, referenced by ID
├── Does X need to be loaded every time A is loaded?
│   ├── YES → X is likely inside A
│   └── NO → X should be separate
└── Can X be modified independently of A?
    ├── YES → X is a SEPARATE aggregate
    └── NO → X is inside A
```

### Correct Aggregate Design

```typescript
// ═══ ORDER AGGREGATE ═══
// Root: Order
// Inside aggregate: OrderItem (can't exist without Order)
// Outside aggregate: Product, Customer (referenced by ID)

export class Order extends AggregateRoot {
  private _items: OrderItem[];  // INSIDE the aggregate

  // ✅ Reference other aggregates by ID
  private _customerId: CustomerId;  // ID reference, NOT Customer object

  // ❌ WRONG: Holding direct reference to another aggregate
  // private _customer: Customer;  // NEVER do this

  addItem(productId: ProductId, productName: string, price: Money, quantity: Quantity): void {
    // ✅ Receives product DATA, not the Product aggregate itself
    this._items.push(OrderItem.create(
      OrderItemId.generate(),
      productId,    // ID reference to Product aggregate
      productName,
      price,
      quantity,
    ));
  }
}

// OrderItem is an Entity INSIDE the Order aggregate
// It cannot exist without an Order
export class OrderItem {
  private constructor(
    private readonly _id: OrderItemId,
    private readonly _productId: ProductId,  // Reference by ID
    private readonly _productName: string,
    private readonly _unitPrice: Money,
    private _quantity: Quantity,
  ) {}

  static create(
    id: OrderItemId,
    productId: ProductId,
    productName: string,
    unitPrice: Money,
    quantity: Quantity,
  ): OrderItem {
    return new OrderItem(id, productId, productName, unitPrice, quantity);
  }

  increaseQuantity(amount: Quantity): void {
    this._quantity = this._quantity.add(amount);
  }

  get subtotal(): Money {
    return this._unitPrice.multiply(this._quantity.value);
  }

  get id(): OrderItemId { return this._id; }
  get productId(): ProductId { return this._productId; }
  get quantity(): Quantity { return this._quantity; }
  get unitPrice(): Money { return this._unitPrice; }
}
```

### Aggregate Size: Small Is Beautiful

```typescript
// ❌ WRONG: Fat aggregate with too much inside
class Order extends AggregateRoot {
  private customer: Customer;           // ❌ Another aggregate embedded
  private items: OrderItem[];
  private payments: Payment[];          // ❌ Separate concern
  private shipments: Shipment[];        // ❌ Separate concern
  private invoices: Invoice[];          // ❌ Separate concern
  private reviews: Review[];            // ❌ Separate concern
  private returnRequests: ReturnRequest[]; // ❌ Separate concern
}

// ✅ CORRECT: Small, focused aggregates
class Order extends AggregateRoot {
  private _customerId: CustomerId;      // Reference by ID
  private _items: OrderItem[];          // Belongs inside Order
  private _status: OrderStatus;
  private _shippingAddress: Address;    // Value object
}

class Payment extends AggregateRoot {
  private _orderId: OrderId;            // Reference by ID
  private _amount: Money;
  private _method: PaymentMethod;
  private _status: PaymentStatus;
}

class Shipment extends AggregateRoot {
  private _orderId: OrderId;            // Reference by ID
  private _trackingNumber: TrackingNumber;
  private _carrier: Carrier;
  private _status: ShipmentStatus;
}
```

### Cross-Aggregate Communication: Domain Events

```typescript
// When modifying aggregate A requires something to happen to aggregate B,
// use domain events — NEVER modify both in the same transaction

// Order aggregate publishes event
class Order {
  submit(): void {
    this._status = OrderStatus.SUBMITTED;
    this.addDomainEvent(new OrderSubmittedEvent(
      this._id,
      this._customerId,
      this.totalAmount,
    ));
  }
}

// Separate handler creates Payment aggregate
class OnOrderSubmittedHandler {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly paymentGateway: PaymentGateway,
  ) {}

  async handle(event: OrderSubmittedEvent): Promise<void> {
    const payment = Payment.initiate(
      this.paymentRepo.nextId(),
      OrderId.from(event.orderId),
      Money.of(event.totalAmount, event.currency),
    );
    await this.paymentRepo.save(payment);
  }
}

// ❌ WRONG: Modifying both Order and Payment in one transaction
class SubmitOrderHandler {
  async execute(input: SubmitOrderInput): Promise<void> {
    const order = await this.orderRepo.findById(input.orderId);
    order.submit();

    // ❌ Creating and saving a different aggregate in the same transaction
    const payment = Payment.initiate(...);
    await this.paymentRepo.save(payment);

    await this.orderRepo.save(order);
    // If payment save fails but order save succeeds → inconsistent state!
  }
}
```

---

## 5. Repository Per Aggregate

**Rule: ONE repository per aggregate root. NEVER create repositories for entities inside an aggregate.**

```typescript
// ✅ CORRECT: Repository for aggregate root
interface OrderRepository {
  save(order: Order): Promise<void>;        // Saves entire aggregate (Order + OrderItems)
  findById(id: OrderId): Promise<Order | null>; // Loads entire aggregate
  delete(id: OrderId): Promise<void>;       // Deletes entire aggregate
}

// ❌ WRONG: Repository for entity inside aggregate
interface OrderItemRepository {             // ❌ OrderItem is not an aggregate root
  save(item: OrderItem): Promise<void>;
  findByOrderId(orderId: OrderId): Promise<OrderItem[]>;
}
// OrderItems are saved/loaded as part of the Order aggregate through OrderRepository
```

---

## 6. Anti-Pattern Quick Reference

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| **Anemic Entity** | Entity with only getters/setters, logic in services | Move business logic INTO the entity |
| **Fat Aggregate** | Aggregate with 10+ entities inside | Split into smaller aggregates connected by ID |
| **Direct Aggregate Reference** | Holding `Customer` object inside `Order` | Use `CustomerId` reference instead |
| **Cross-Aggregate Transaction** | Saving 2+ aggregates in one DB transaction | Use domain events for eventual consistency |
| **Primitive Obsession** | `email: string`, `price: number` | Use value objects: `Email`, `Money` |
| **Mutable Value Object** | Value object with setter methods | Make ALL value objects immutable |
| **Missing Factory** | Creating entities with `new Entity()` | Use `Entity.create()` factory methods |
| **Repository for Non-Root** | `OrderItemRepository` | Only `OrderRepository` — items load with order |
| **ID-less Entity** | Entity without a unique identifier | Every entity MUST have an ID |
| **Logic in Constructor** | Business rules in constructor | Constructor validates; factory methods apply rules |
