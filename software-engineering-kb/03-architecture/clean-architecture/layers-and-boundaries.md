# Clean Architecture: Layers & Boundaries — Complete Specification

> **AI Plugin Directive:** When structuring ANY application, follow this exact layer specification. Every class, every file, every import MUST be placed in the correct layer. Use the placement rules and checklists below to verify every decision.

---

## 1. Enterprise Business Rules Layer (Entities)

### What Goes Here

This is the **innermost layer** — the heart of the application. It contains rules that would exist even if there was no software. These are the rules of the business itself.

### Placement Rules

| Belongs Here | Does NOT Belong Here |
|-------------|---------------------|
| Domain entities with behavior | ORM/database entities |
| Value objects with validation | DTOs (data transfer objects) |
| Domain events | Framework decorators (@Entity, @Injectable) |
| Business invariants and rules | HTTP/API concerns |
| Enumerations representing domain concepts | Configuration reading |
| Domain service interfaces | Logging implementation |
| Factory methods for complex entity creation | Serialization logic |
| Specification pattern implementations | File I/O operations |

### Entity Implementation

**Rule: Entities MUST be rich domain models with behavior, NOT anemic data bags. Put business logic IN the entity.**

```typescript
// ✅ CORRECT: Rich domain entity
export class Order extends AggregateRoot {
  private readonly _id: OrderId;
  private readonly _customerId: CustomerId;
  private _items: OrderItem[];
  private _status: OrderStatus;
  private _shippingAddress: Address | null;
  private _discountCode: DiscountCode | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: OrderProps) {
    super();
    this._id = props.id;
    this._customerId = props.customerId;
    this._items = props.items;
    this._status = props.status;
    this._shippingAddress = props.shippingAddress;
    this._discountCode = props.discountCode;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  // Factory method for NEW orders
  static create(id: OrderId, customerId: CustomerId): Order {
    const order = new Order({
      id,
      customerId,
      items: [],
      status: OrderStatus.DRAFT,
      shippingAddress: null,
      discountCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    order.addDomainEvent(new OrderCreatedEvent(id, customerId));
    return order;
  }

  // Factory method for RECONSTITUTING from persistence
  static reconstitute(props: OrderProps): Order {
    return new Order(props); // No events — this is loading, not creating
  }

  // ═══ BUSINESS RULES — All domain logic lives here ═══

  addItem(product: Product, quantity: Quantity): void {
    this.assertDraft();
    if (this._items.length >= Order.MAX_ITEMS) {
      throw new MaxItemsExceededError(this._id, Order.MAX_ITEMS);
    }

    const existingItem = this._items.find(i => i.productId.equals(product.id));
    if (existingItem) {
      existingItem.increaseQuantity(quantity);
    } else {
      this._items.push(OrderItem.create(product, quantity));
    }
    this.recalculate();
  }

  removeItem(productId: ProductId): void {
    this.assertDraft();
    const index = this._items.findIndex(i => i.productId.equals(productId));
    if (index === -1) throw new ItemNotFoundError(this._id, productId);
    this._items.splice(index, 1);
    this.recalculate();
  }

  applyDiscount(code: DiscountCode, discount: Discount): void {
    this.assertDraft();
    if (this._discountCode) throw new DiscountAlreadyAppliedError(this._id);
    if (!discount.isApplicableTo(this)) throw new DiscountNotApplicableError(code);
    this._discountCode = code;
    this.recalculate();
  }

  setShippingAddress(address: Address): void {
    this.assertModifiable();
    this._shippingAddress = address;
    this._updatedAt = new Date();
  }

  submit(): void {
    this.assertDraft();
    if (this._items.length === 0) throw new EmptyOrderError(this._id);
    if (!this._shippingAddress) throw new MissingShippingAddressError(this._id);
    if (this.totalAmount.isLessThan(Order.MINIMUM_ORDER_AMOUNT)) {
      throw new MinimumOrderAmountError(this._id, Order.MINIMUM_ORDER_AMOUNT);
    }
    this._status = OrderStatus.SUBMITTED;
    this._updatedAt = new Date();
    this.addDomainEvent(new OrderSubmittedEvent(this._id, this.totalAmount));
  }

  cancel(reason: CancellationReason): void {
    if (!this._status.isCancellable()) {
      throw new OrderNotCancellableError(this._id, this._status);
    }
    this._status = OrderStatus.CANCELLED;
    this._updatedAt = new Date();
    this.addDomainEvent(new OrderCancelledEvent(this._id, reason));
  }

  confirm(): void {
    if (this._status !== OrderStatus.SUBMITTED) {
      throw new InvalidOrderTransitionError(this._id, this._status, OrderStatus.CONFIRMED);
    }
    this._status = OrderStatus.CONFIRMED;
    this._updatedAt = new Date();
    this.addDomainEvent(new OrderConfirmedEvent(this._id));
  }

  // ═══ COMPUTED PROPERTIES ═══

  get totalAmount(): Money {
    const subtotal = this._items.reduce(
      (sum, item) => sum.add(item.subtotal),
      Money.zero(Currency.USD)
    );
    if (this._discountCode) {
      return subtotal.applyDiscount(this._discountCode.percentage);
    }
    return subtotal;
  }

  get itemCount(): number {
    return this._items.reduce((count, item) => count + item.quantity.value, 0);
  }

  get isModifiable(): boolean {
    return this._status === OrderStatus.DRAFT || this._status === OrderStatus.SUBMITTED;
  }

  // ═══ INVARIANT CHECKS ═══

  private assertDraft(): void {
    if (this._status !== OrderStatus.DRAFT) {
      throw new OrderNotModifiableError(this._id, this._status);
    }
  }

  private assertModifiable(): void {
    if (!this.isModifiable) {
      throw new OrderNotModifiableError(this._id, this._status);
    }
  }

  private recalculate(): void {
    this._updatedAt = new Date();
  }

  private static readonly MAX_ITEMS = 50;
  private static readonly MINIMUM_ORDER_AMOUNT = Money.of(1, Currency.USD);
}
```

### Value Object Implementation

**Rule: Value Objects MUST be immutable, compared by value, and self-validating.**

```typescript
export class Money {
  private constructor(
    private readonly _amount: number,
    private readonly _currency: Currency
  ) {
    if (!Number.isFinite(_amount)) throw new InvalidMoneyError('Amount must be finite');
    if (_amount < 0) throw new InvalidMoneyError('Amount cannot be negative');
  }

  static of(amount: number, currency: Currency | string): Money {
    const cur = typeof currency === 'string' ? Currency.from(currency) : currency;
    return new Money(Math.round(amount * 100) / 100, cur); // Round to 2 decimals
  }

  static zero(currency: Currency): Money {
    return new Money(0, currency);
  }

  get amount(): number { return this._amount; }
  get currency(): Currency { return this._currency; }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this._amount + other._amount, this._currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this._amount - other._amount;
    if (result < 0) throw new InsufficientAmountError(this, other);
    return Money.of(result, this._currency);
  }

  multiply(factor: number): Money {
    return Money.of(this._amount * factor, this._currency);
  }

  applyDiscount(percentage: Percentage): Money {
    const discountAmount = this._amount * (percentage.value / 100);
    return Money.of(this._amount - discountAmount, this._currency);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount > other._amount;
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this._amount < other._amount;
  }

  equals(other: Money): boolean {
    return this._amount === other._amount && this._currency.equals(other._currency);
  }

  toCents(): number {
    return Math.round(this._amount * 100);
  }

  private assertSameCurrency(other: Money): void {
    if (!this._currency.equals(other._currency)) {
      throw new CurrencyMismatchError(this._currency, other._currency);
    }
  }
}

export class Email {
  private static readonly PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  private constructor(private readonly _value: string) {}

  static create(value: string): Email {
    const trimmed = value.trim().toLowerCase();
    if (!Email.PATTERN.test(trimmed)) {
      throw new InvalidEmailError(value);
    }
    return new Email(trimmed);
  }

  get value(): string { return this._value; }
  get domain(): string { return this._value.split('@')[1]; }

  equals(other: Email): boolean {
    return this._value === other._value;
  }
}

export class Address {
  private constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly state: string,
    public readonly postalCode: string,
    public readonly country: CountryCode,
  ) {
    if (!street.trim()) throw new InvalidAddressError('Street is required');
    if (!city.trim()) throw new InvalidAddressError('City is required');
    if (!postalCode.trim()) throw new InvalidAddressError('Postal code is required');
  }

  static create(props: AddressProps): Address {
    return new Address(
      props.street.trim(),
      props.city.trim(),
      props.state.trim(),
      props.postalCode.trim(),
      CountryCode.from(props.country)
    );
  }

  equals(other: Address): boolean {
    return (
      this.street === other.street &&
      this.city === other.city &&
      this.state === other.state &&
      this.postalCode === other.postalCode &&
      this.country.equals(other.country)
    );
  }
}
```

### Domain Event Implementation

```typescript
export abstract class DomainEvent {
  public readonly id: string;
  public readonly occurredAt: Date;

  constructor(
    public readonly aggregateId: string,
    public readonly type: string
  ) {
    this.id = crypto.randomUUID();
    this.occurredAt = new Date();
  }
}

export class OrderSubmittedEvent extends DomainEvent {
  constructor(
    orderId: OrderId,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly customerId: string,
  ) {
    super(orderId.value, 'order.submitted');
  }
}

export class OrderCancelledEvent extends DomainEvent {
  constructor(
    orderId: OrderId,
    public readonly reason: string,
    public readonly cancelledBy: string,
  ) {
    super(orderId.value, 'order.cancelled');
  }
}
```

### Rich vs Anemic Domain Model Decision

| Use Rich Domain Model When | Use Anemic Model When |
|---------------------------|----------------------|
| Complex business rules exist | Pure CRUD operations only |
| Multiple state transitions with invariants | No state machine logic |
| Business logic is the core value proposition | Logic is trivial (set value, save) |
| Domain experts can validate the rules | No domain expert exists |
| Multiple teams work on the domain | Single developer, small project |

**Default: Always start with rich domain models. Anemic models are a code smell unless you have simple CRUD.**

---

## 2. Application Business Rules Layer (Use Cases / Interactors)

### What Goes Here

Application-specific business rules. This layer orchestrates the flow of data to and from entities, directing them to use their enterprise-wide business rules to achieve the goals of the use case.

### Placement Rules

| Belongs Here | Does NOT Belong Here |
|-------------|---------------------|
| Use case / interactor classes | Domain entity business logic |
| Input/Output port interfaces | HTTP request/response handling |
| Application services (orchestration) | Database query building |
| Port interfaces (repository, gateway, service) | Framework decorators |
| Application-level error types | UI formatting logic |
| Command/Query handlers | Direct infrastructure calls |
| Application event handlers | Serialization/deserialization |
| Input validation (application rules) | Configuration reading |

### Use Case Structure

**Rule: One use case = one class = one public method. Follow the Command/Query pattern.**

```typescript
// ═══ COMMAND: Changes state ═══
// application/commands/submit-order/submit-order.command.ts
export interface SubmitOrderCommand {
  readonly orderId: string;
  readonly submittedBy: string;
}

// application/commands/submit-order/submit-order.handler.ts
export class SubmitOrderHandler {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly paymentGateway: PaymentGateway,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: SubmitOrderCommand): Promise<SubmitOrderResult> {
    // 1. Load aggregate
    const order = await this.orderRepo.findById(OrderId.from(command.orderId));
    if (!order) throw new OrderNotFoundError(command.orderId);

    // 2. Execute domain logic
    order.submit();

    // 3. Process payment
    const paymentResult = await this.paymentGateway.charge(
      order.totalAmount,
      order.paymentMethodId
    );
    if (!paymentResult.isSuccessful) {
      throw new PaymentFailedError(order.id, paymentResult.failureReason);
    }

    // 4. Persist changes
    await this.orderRepo.save(order);

    // 5. Publish domain events
    await this.eventBus.publishAll(order.domainEvents);

    // 6. Return result
    return {
      orderId: order.id.value,
      status: order.status.value,
      totalCharged: order.totalAmount.amount,
      currency: order.totalAmount.currency.code,
    };
  }
}

// ═══ QUERY: Reads state, no side effects ═══
// application/queries/get-order/get-order.query.ts
export interface GetOrderQuery {
  readonly orderId: string;
  readonly requestedBy: string;
}

// application/queries/get-order/get-order.handler.ts
export class GetOrderHandler {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly productRepo: ProductRepository,
  ) {}

  async execute(query: GetOrderQuery): Promise<OrderDetailResult> {
    const order = await this.orderRepo.findById(OrderId.from(query.orderId));
    if (!order) throw new OrderNotFoundError(query.orderId);

    // Map to output — NEVER return domain entity
    return {
      orderId: order.id.value,
      customerId: order.customerId.value,
      status: order.status.value,
      items: order.items.map(item => ({
        productId: item.productId.value,
        productName: item.productName,
        unitPrice: item.unitPrice.amount,
        quantity: item.quantity.value,
        subtotal: item.subtotal.amount,
      })),
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency.code,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
```

### Port Interfaces (Defined HERE, Implemented in Infrastructure)

```typescript
// application/ports/order.repository.ts
export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: CustomerId, pagination?: Pagination): Promise<PaginatedResult<Order>>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
  delete(id: OrderId): Promise<void>;
  nextId(): OrderId;
}

// application/ports/event-bus.ts
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}

// application/ports/payment.gateway.ts
export interface PaymentGateway {
  charge(amount: Money, paymentMethodId: PaymentMethodId): Promise<PaymentResult>;
  refund(paymentId: PaymentId, amount?: Money): Promise<RefundResult>;
}

// application/ports/unit-of-work.ts
export interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  getOrderRepository(): OrderRepository;
  getProductRepository(): ProductRepository;
}
```

### Error Handling Strategy

```typescript
// Domain errors (thrown by entities)
export class DomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export class EmptyOrderError extends DomainError {
  constructor(orderId: OrderId) {
    super(`Order ${orderId.value} has no items`, 'ORDER_EMPTY');
  }
}

export class OrderNotModifiableError extends DomainError {
  constructor(orderId: OrderId, currentStatus: OrderStatus) {
    super(
      `Order ${orderId.value} is ${currentStatus.value} and cannot be modified`,
      'ORDER_NOT_MODIFIABLE'
    );
  }
}

// Application errors (thrown by use cases)
export class ApplicationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export class OrderNotFoundError extends ApplicationError {
  constructor(orderId: string) {
    super(`Order ${orderId} not found`, 'ORDER_NOT_FOUND');
  }
}

export class UnauthorizedAccessError extends ApplicationError {
  constructor(userId: string, resource: string) {
    super(`User ${userId} is not authorized to access ${resource}`, 'UNAUTHORIZED');
  }
}

// Error mapping: domain/application errors → HTTP status codes (done in adapter layer)
```

---

## 3. Interface Adapters Layer (Controllers, Presenters, Gateways)

### What Goes Here

This layer converts data between the format most convenient for use cases and entities, and the format most convenient for external agencies (database, web, etc.).

### Placement Rules

| Belongs Here | Does NOT Belong Here |
|-------------|---------------------|
| Controllers / Route handlers | Business logic / domain rules |
| Presenters / Response formatters | Direct DB queries |
| Repository implementations | Domain validation |
| API Gateway implementations | Framework configuration |
| Data mappers (domain ↔ persistence) | Server setup code |
| View models | Business rule evaluation |
| Input validators (format validation) | Complex data processing |
| Error mappers (domain error → HTTP error) | External API client setup |

### Controller Implementation

**Rule: Controllers do THREE things only: (1) Parse input, (2) Call use case, (3) Format output. NO business logic.**

```typescript
// infrastructure/http/controllers/order.controller.ts
export class OrderController {
  constructor(
    private readonly createOrder: CreateOrderHandler,
    private readonly submitOrder: SubmitOrderHandler,
    private readonly getOrder: GetOrderHandler,
    private readonly listOrders: ListOrdersHandler,
    private readonly cancelOrder: CancelOrderHandler,
  ) {}

  // POST /api/orders
  async create(req: Request, res: Response): Promise<void> {
    // 1. Parse & validate input
    const body = req.body as CreateOrderRequestDto;
    const validationErrors = validateCreateOrderRequest(body);
    if (validationErrors.length > 0) {
      res.status(400).json({ errors: validationErrors });
      return;
    }

    try {
      // 2. Call use case
      const result = await this.createOrder.execute({
        customerId: body.customerId,
        items: body.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      });

      // 3. Format output
      res.status(201).json({
        data: {
          id: result.orderId,
          status: result.status,
          totalAmount: result.totalAmount,
          currency: result.currency,
        },
        links: {
          self: `/api/orders/${result.orderId}`,
          submit: `/api/orders/${result.orderId}/submit`,
        },
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // POST /api/orders/:id/submit
  async submit(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.submitOrder.execute({
        orderId: req.params.id,
        submittedBy: req.user.id, // From auth middleware
      });
      res.status(200).json({ data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // GET /api/orders/:id
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.getOrder.execute({
        orderId: req.params.id,
        requestedBy: req.user.id,
      });
      res.status(200).json({ data: result });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // Error mapping: domain errors → HTTP responses
  private handleError(error: unknown, res: Response): void {
    if (error instanceof OrderNotFoundError) {
      res.status(404).json({ error: { code: error.code, message: error.message } });
    } else if (error instanceof EmptyOrderError || error instanceof InvalidQuantityError) {
      res.status(400).json({ error: { code: error.code, message: error.message } });
    } else if (error instanceof OrderNotModifiableError) {
      res.status(409).json({ error: { code: error.code, message: error.message } });
    } else if (error instanceof UnauthorizedAccessError) {
      res.status(403).json({ error: { code: error.code, message: error.message } });
    } else if (error instanceof PaymentFailedError) {
      res.status(422).json({ error: { code: error.code, message: error.message } });
    } else {
      console.error('Unhandled error:', error);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }
}
```

### Repository Implementation (Adapter)

```typescript
// infrastructure/persistence/typeorm/typeorm-order.repository.ts
export class TypeOrmOrderRepository implements OrderRepository {
  private readonly ormRepo: Repository<OrderOrmEntity>;

  constructor(dataSource: DataSource) {
    this.ormRepo = dataSource.getRepository(OrderOrmEntity);
  }

  async save(order: Order): Promise<void> {
    const ormEntity = OrderMapper.toPersistence(order);
    await this.ormRepo.save(ormEntity);
  }

  async findById(id: OrderId): Promise<Order | null> {
    const ormEntity = await this.ormRepo.findOne({
      where: { id: id.value },
      relations: ['items'],
    });
    return ormEntity ? OrderMapper.toDomain(ormEntity) : null;
  }

  async findByCustomerId(
    customerId: CustomerId,
    pagination?: Pagination
  ): Promise<PaginatedResult<Order>> {
    const [ormEntities, total] = await this.ormRepo.findAndCount({
      where: { customer_id: customerId.value },
      relations: ['items'],
      skip: pagination?.offset ?? 0,
      take: pagination?.limit ?? 20,
      order: { created_at: 'DESC' },
    });

    return {
      items: ormEntities.map(OrderMapper.toDomain),
      total,
      offset: pagination?.offset ?? 0,
      limit: pagination?.limit ?? 20,
    };
  }

  async findByStatus(status: OrderStatus): Promise<Order[]> {
    const ormEntities = await this.ormRepo.find({
      where: { status: status.value },
      relations: ['items'],
    });
    return ormEntities.map(OrderMapper.toDomain);
  }

  async delete(id: OrderId): Promise<void> {
    await this.ormRepo.delete(id.value);
  }

  nextId(): OrderId {
    return OrderId.generate();
  }
}
```

### Data Mapper Implementation

```typescript
// infrastructure/persistence/mappers/order.mapper.ts
export class OrderMapper {
  static toDomain(orm: OrderOrmEntity): Order {
    return Order.reconstitute({
      id: OrderId.from(orm.id),
      customerId: CustomerId.from(orm.customer_id),
      items: orm.items.map(item => OrderItem.reconstitute({
        id: OrderItemId.from(item.id),
        productId: ProductId.from(item.product_id),
        productName: item.product_name,
        unitPrice: Money.of(item.unit_price, Currency.from(orm.currency)),
        quantity: Quantity.of(item.quantity),
      })),
      status: OrderStatus.from(orm.status),
      shippingAddress: orm.shipping_street
        ? Address.create({
            street: orm.shipping_street,
            city: orm.shipping_city,
            state: orm.shipping_state,
            postalCode: orm.shipping_postal_code,
            country: orm.shipping_country,
          })
        : null,
      discountCode: orm.discount_code
        ? DiscountCode.from(orm.discount_code)
        : null,
      createdAt: orm.created_at,
      updatedAt: orm.updated_at,
    });
  }

  static toPersistence(domain: Order): Partial<OrderOrmEntity> {
    const address = domain.shippingAddress;
    return {
      id: domain.id.value,
      customer_id: domain.customerId.value,
      status: domain.status.value,
      total_amount: domain.totalAmount.amount,
      currency: domain.totalAmount.currency.code,
      discount_code: domain.discountCode?.value ?? null,
      shipping_street: address?.street ?? null,
      shipping_city: address?.city ?? null,
      shipping_state: address?.state ?? null,
      shipping_postal_code: address?.postalCode ?? null,
      shipping_country: address?.country.value ?? null,
      created_at: domain.createdAt,
      updated_at: domain.updatedAt,
      items: domain.items.map(item => ({
        id: item.id.value,
        product_id: item.productId.value,
        product_name: item.productName,
        unit_price: item.unitPrice.amount,
        quantity: item.quantity.value,
      })),
    };
  }
}
```

---

## 4. Frameworks & Drivers Layer (External)

### What Goes Here

This is the **outermost layer** — glue code that wires everything together. It should contain NO business logic.

### Placement Rules

| Belongs Here | Does NOT Belong Here |
|-------------|---------------------|
| Web server configuration | Business logic |
| Database connection setup | Domain validation |
| ORM entity definitions | Data transformation logic |
| DI container configuration | Use case orchestration |
| Middleware registration | Complex error handling logic |
| External API client setup | Decision-making logic |
| Message queue connection | State management |
| Third-party SDK initialization | Domain event definitions |

### ORM Entity (Persistence Model)

```typescript
// infrastructure/persistence/entities/order.orm-entity.ts
@Entity('orders')
export class OrderOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  customer_id: string;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  discount_code: string | null;

  @Column({ type: 'varchar', nullable: true }) shipping_street: string | null;
  @Column({ type: 'varchar', nullable: true }) shipping_city: string | null;
  @Column({ type: 'varchar', nullable: true }) shipping_state: string | null;
  @Column({ type: 'varchar', nullable: true }) shipping_postal_code: string | null;
  @Column({ type: 'varchar', nullable: true }) shipping_country: string | null;

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;

  @OneToMany(() => OrderItemOrmEntity, item => item.order, { cascade: true, eager: true })
  items: OrderItemOrmEntity[];
}
```

### Composition Root (Wiring Everything Together)

```typescript
// main.ts — The ONLY place that knows about ALL layers
import { Container } from 'tsyringe';
import { DataSource } from 'typeorm';

// Infrastructure
import { TypeOrmOrderRepository } from './infrastructure/persistence/typeorm-order.repository';
import { StripePaymentGateway } from './infrastructure/payment/stripe.gateway';
import { RabbitMQEventBus } from './infrastructure/messaging/rabbitmq-event-bus';
import { SendGridEmailService } from './infrastructure/email/sendgrid-email.service';

// Application
import { CreateOrderHandler } from './application/commands/create-order/create-order.handler';
import { SubmitOrderHandler } from './application/commands/submit-order/submit-order.handler';
import { GetOrderHandler } from './application/queries/get-order/get-order.handler';

async function bootstrap() {
  // Database
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [OrderOrmEntity, OrderItemOrmEntity],
    synchronize: false,
  });
  await dataSource.initialize();

  // Register infrastructure
  Container.register('DataSource', { useValue: dataSource });
  Container.register('OrderRepository', { useClass: TypeOrmOrderRepository });
  Container.register('PaymentGateway', { useClass: StripePaymentGateway });
  Container.register('EventBus', { useClass: RabbitMQEventBus });
  Container.register('EmailService', { useClass: SendGridEmailService });

  // Register use cases
  Container.register(CreateOrderHandler, { useClass: CreateOrderHandler });
  Container.register(SubmitOrderHandler, { useClass: SubmitOrderHandler });
  Container.register(GetOrderHandler, { useClass: GetOrderHandler });

  // Start server
  const app = express();
  app.use(express.json());
  app.use('/api/orders', createOrderRoutes(Container));
  app.listen(3000);
}

bootstrap();
```

---

## 5. Complete Folder Structure Templates

### TypeScript / Node.js Project

```
src/
├── modules/                              # Feature modules (screaming architecture)
│   ├── ordering/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── order.ts
│   │   │   │   ├── order-item.ts
│   │   │   │   └── index.ts
│   │   │   ├── value-objects/
│   │   │   │   ├── order-id.ts
│   │   │   │   ├── money.ts
│   │   │   │   ├── quantity.ts
│   │   │   │   ├── order-status.ts
│   │   │   │   └── index.ts
│   │   │   ├── events/
│   │   │   │   ├── order-created.event.ts
│   │   │   │   ├── order-submitted.event.ts
│   │   │   │   ├── order-cancelled.event.ts
│   │   │   │   └── index.ts
│   │   │   ├── errors/
│   │   │   │   ├── empty-order.error.ts
│   │   │   │   ├── invalid-quantity.error.ts
│   │   │   │   ├── order-not-modifiable.error.ts
│   │   │   │   └── index.ts
│   │   │   └── ports/
│   │   │       ├── order.repository.ts
│   │   │       └── index.ts
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   ├── create-order/
│   │   │   │   │   ├── create-order.command.ts
│   │   │   │   │   ├── create-order.handler.ts
│   │   │   │   │   └── create-order.handler.spec.ts
│   │   │   │   ├── submit-order/
│   │   │   │   │   ├── submit-order.command.ts
│   │   │   │   │   ├── submit-order.handler.ts
│   │   │   │   │   └── submit-order.handler.spec.ts
│   │   │   │   └── cancel-order/
│   │   │   │       ├── cancel-order.command.ts
│   │   │   │       ├── cancel-order.handler.ts
│   │   │   │       └── cancel-order.handler.spec.ts
│   │   │   ├── queries/
│   │   │   │   ├── get-order/
│   │   │   │   │   ├── get-order.query.ts
│   │   │   │   │   ├── get-order.handler.ts
│   │   │   │   │   └── get-order.handler.spec.ts
│   │   │   │   └── list-orders/
│   │   │   │       ├── list-orders.query.ts
│   │   │   │       ├── list-orders.handler.ts
│   │   │   │       └── list-orders.handler.spec.ts
│   │   │   ├── ports/
│   │   │   │   ├── payment.gateway.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   ├── event-bus.ts
│   │   │   │   └── index.ts
│   │   │   └── event-handlers/
│   │   │       ├── on-order-submitted.handler.ts
│   │   │       └── on-order-cancelled.handler.ts
│   │   └── infrastructure/
│   │       ├── persistence/
│   │       │   ├── entities/
│   │       │   │   ├── order.orm-entity.ts
│   │       │   │   └── order-item.orm-entity.ts
│   │       │   ├── mappers/
│   │       │   │   └── order.mapper.ts
│   │       │   ├── repositories/
│   │       │   │   └── typeorm-order.repository.ts
│   │       │   └── migrations/
│   │       │       └── 001-create-orders.ts
│   │       ├── http/
│   │       │   ├── controllers/
│   │       │   │   └── order.controller.ts
│   │       │   ├── dto/
│   │       │   │   ├── create-order.request.dto.ts
│   │       │   │   ├── order.response.dto.ts
│   │       │   │   └── order-list.response.dto.ts
│   │       │   ├── middleware/
│   │       │   │   └── order-auth.middleware.ts
│   │       │   └── routes/
│   │       │       └── order.routes.ts
│   │       ├── payment/
│   │       │   └── stripe-payment.gateway.ts
│   │       └── messaging/
│   │           └── order-event.publisher.ts
│   ├── catalog/
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   └── customer/
│       ├── domain/
│       ├── application/
│       └── infrastructure/
├── shared/
│   ├── domain/
│   │   ├── base/
│   │   │   ├── aggregate-root.ts
│   │   │   ├── entity.ts
│   │   │   ├── value-object.ts
│   │   │   └── domain-event.ts
│   │   ├── errors/
│   │   │   ├── domain.error.ts
│   │   │   └── application.error.ts
│   │   └── types/
│   │       ├── pagination.ts
│   │       └── result.ts
│   └── infrastructure/
│       ├── database/
│       │   └── data-source.ts
│       ├── logging/
│       │   └── logger.ts
│       └── middleware/
│           ├── error-handler.middleware.ts
│           ├── auth.middleware.ts
│           └── request-id.middleware.ts
├── config/
│   ├── database.config.ts
│   ├── app.config.ts
│   └── index.ts
└── main.ts                               # Composition root
```

### Python Project

```
src/
├── modules/
│   ├── ordering/
│   │   ├── __init__.py
│   │   ├── domain/
│   │   │   ├── __init__.py
│   │   │   ├── entities/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── order.py
│   │   │   │   └── order_item.py
│   │   │   ├── value_objects/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── order_id.py
│   │   │   │   ├── money.py
│   │   │   │   └── order_status.py
│   │   │   ├── events/
│   │   │   │   ├── __init__.py
│   │   │   │   └── order_events.py
│   │   │   ├── errors/
│   │   │   │   ├── __init__.py
│   │   │   │   └── order_errors.py
│   │   │   └── ports/
│   │   │       ├── __init__.py
│   │   │       └── order_repository.py
│   │   ├── application/
│   │   │   ├── __init__.py
│   │   │   ├── commands/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── create_order.py
│   │   │   │   └── submit_order.py
│   │   │   ├── queries/
│   │   │   │   ├── __init__.py
│   │   │   │   └── get_order.py
│   │   │   └── ports/
│   │   │       ├── __init__.py
│   │   │       ├── payment_gateway.py
│   │   │       └── event_bus.py
│   │   └── infrastructure/
│   │       ├── __init__.py
│   │       ├── persistence/
│   │       │   ├── __init__.py
│   │       │   ├── models.py           # SQLAlchemy models
│   │       │   ├── mappers.py
│   │       │   └── sqlalchemy_order_repository.py
│   │       ├── http/
│   │       │   ├── __init__.py
│   │       │   ├── order_router.py     # FastAPI router
│   │       │   ├── order_schemas.py    # Pydantic schemas
│   │       │   └── error_handlers.py
│   │       └── payment/
│   │           └── stripe_gateway.py
│   ├── catalog/
│   └── customer/
├── shared/
│   ├── __init__.py
│   ├── domain/
│   │   ├── base_entity.py
│   │   ├── aggregate_root.py
│   │   ├── value_object.py
│   │   └── domain_event.py
│   └── infrastructure/
│       ├── database.py
│       └── middleware.py
├── config/
│   └── settings.py
└── main.py
```

### C# / .NET Project

```
Solution/
├── src/
│   ├── Domain/                          # Class library project
│   │   ├── Domain.csproj               # Zero dependencies
│   │   ├── Entities/
│   │   │   ├── Order.cs
│   │   │   └── OrderItem.cs
│   │   ├── ValueObjects/
│   │   │   ├── OrderId.cs
│   │   │   ├── Money.cs
│   │   │   └── OrderStatus.cs
│   │   ├── Events/
│   │   │   ├── OrderCreatedEvent.cs
│   │   │   └── OrderSubmittedEvent.cs
│   │   ├── Errors/
│   │   │   ├── DomainError.cs
│   │   │   └── EmptyOrderError.cs
│   │   └── Ports/
│   │       └── IOrderRepository.cs
│   ├── Application/                     # Class library project
│   │   ├── Application.csproj          # References: Domain only
│   │   ├── Commands/
│   │   │   ├── CreateOrder/
│   │   │   │   ├── CreateOrderCommand.cs
│   │   │   │   └── CreateOrderHandler.cs
│   │   │   └── SubmitOrder/
│   │   │       ├── SubmitOrderCommand.cs
│   │   │       └── SubmitOrderHandler.cs
│   │   ├── Queries/
│   │   │   └── GetOrder/
│   │   │       ├── GetOrderQuery.cs
│   │   │       └── GetOrderHandler.cs
│   │   ├── Ports/
│   │   │   ├── IPaymentGateway.cs
│   │   │   ├── IEventBus.cs
│   │   │   └── IUnitOfWork.cs
│   │   └── DTOs/
│   │       ├── OrderDetailResult.cs
│   │       └── CreateOrderResult.cs
│   ├── Infrastructure/                  # Class library project
│   │   ├── Infrastructure.csproj       # References: Domain, Application + NuGet packages
│   │   ├── Persistence/
│   │   │   ├── AppDbContext.cs
│   │   │   ├── Configurations/
│   │   │   │   └── OrderConfiguration.cs
│   │   │   ├── Repositories/
│   │   │   │   └── EfCoreOrderRepository.cs
│   │   │   └── Migrations/
│   │   ├── Payment/
│   │   │   └── StripePaymentGateway.cs
│   │   └── Messaging/
│   │       └── RabbitMqEventBus.cs
│   └── WebApi/                          # ASP.NET Core project (entry point)
│       ├── WebApi.csproj               # References: All projects
│       ├── Controllers/
│       │   └── OrderController.cs
│       ├── DTOs/
│       │   ├── CreateOrderRequest.cs
│       │   └── OrderResponse.cs
│       ├── Middleware/
│       │   └── ExceptionHandlerMiddleware.cs
│       ├── Program.cs                  # Composition root
│       └── appsettings.json
└── tests/
    ├── Domain.Tests/
    ├── Application.Tests/
    ├── Infrastructure.Tests/
    └── WebApi.Tests/
```

---

## 6. Testing Strategy Per Layer

### Layer-Specific Testing Rules

| Layer | Test Type | Mocks Needed | Database Needed | Framework Needed |
|-------|-----------|-------------|-----------------|-----------------|
| **Entities** | Unit | None | No | No |
| **Value Objects** | Unit | None | No | No |
| **Use Cases** | Unit | Port interfaces only | No | No |
| **Adapters (Repos)** | Integration | None | Yes (test container) | Yes (ORM) |
| **Adapters (Controllers)** | Integration | Use cases | No | Yes (HTTP) |
| **Composition Root** | E2E | None | Yes | Yes |

### Testing Quick Reference

```
Entity tests:      Pure logic → instant, no setup
Use case tests:    Mock ports → fast, isolated
Repository tests:  Real DB (testcontainers) → slower, realistic
Controller tests:  Mock use cases → test HTTP mapping
E2E tests:         Full stack → slowest, highest confidence
```

---

## Layer Interaction Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPOSITION ROOT                              │
│  (Wires everything together. The ONLY file that knows all.)     │
└─────┬───────────────────────────────────────────────────┬───────┘
      │ creates                                           │ creates
      ▼                                                   ▼
┌─────────────────┐                            ┌────────────────────┐
│   CONTROLLER    │                            │   REPOSITORY IMPL  │
│  (Adapter)      │                            │   (Adapter)        │
│                 │                            │                    │
│ Parses request  │                            │ Maps domain↔DB     │
│ Calls use case  │                            │ Executes queries   │
│ Formats response│                            │                    │
└────────┬────────┘                            └────────┬───────────┘
         │ calls                                        │ implements
         ▼                                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       USE CASE                                   │
│  (Application Layer)                                             │
│                                                                  │
│  Orchestrates domain entities                                    │
│  Calls port interfaces (repository, gateway, event bus)          │
│  Returns output DTOs                                             │
│                                                                  │
│  DEFINES: Port interfaces (OrderRepository, PaymentGateway)      │
└────────────────────────────┬────────────────────────────────────┘
                             │ uses
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ENTITIES                                   │
│  (Domain Layer)                                                  │
│                                                                  │
│  Contains ALL business rules                                     │
│  Value objects, domain events, invariants                        │
│  ZERO external dependencies                                      │
└─────────────────────────────────────────────────────────────────┘
```
