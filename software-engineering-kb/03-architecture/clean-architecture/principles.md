# Clean Architecture: Core Principles

> **AI Plugin Directive:** When building or restructuring ANY application, apply these principles as non-negotiable rules. Every architectural decision MUST be evaluated against these principles.

---

## 1. Separation of Concerns

### Rule
**Divide every application into distinct layers, each with a single, well-defined responsibility. NEVER mix business logic with infrastructure, UI, or framework code.**

### What Goes Where

| Layer | Responsibility | Contains | NEVER Contains |
|-------|---------------|----------|----------------|
| **Entities** | Enterprise business rules | Domain models, value objects, domain events, business invariants | Framework imports, DB annotations, HTTP concerns, logging frameworks |
| **Use Cases** | Application business rules | Orchestration logic, input/output ports, application services | Direct DB calls, HTTP handling, UI logic, framework decorators |
| **Interface Adapters** | Data conversion | Controllers, presenters, gateways, repository implementations, mappers | Business rules, domain validation, direct framework coupling |
| **Frameworks & Drivers** | External tools | DB config, web server, UI framework, message queues, external APIs | Business logic, complex data transformations |

### Correct Implementation

```typescript
// CORRECT: Entity contains ONLY business logic
class Order {
  private items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.DRAFT;

  addItem(product: Product, quantity: number): void {
    if (quantity <= 0) throw new InvalidQuantityError(quantity);
    if (this.status !== OrderStatus.DRAFT) {
      throw new OrderNotModifiableError(this.id);
    }
    const existingItem = this.items.find(i => i.productId === product.id);
    if (existingItem) {
      existingItem.increaseQuantity(quantity);
    } else {
      this.items.push(OrderItem.create(product, quantity));
    }
  }

  get totalAmount(): Money {
    return this.items.reduce(
      (sum, item) => sum.add(item.subtotal),
      Money.zero(this.currency)
    );
  }

  submit(): void {
    if (this.items.length === 0) throw new EmptyOrderError(this.id);
    if (this.totalAmount.isLessThan(Money.of(1, this.currency))) {
      throw new MinimumOrderAmountError(this.id);
    }
    this.status = OrderStatus.SUBMITTED;
    this.addDomainEvent(new OrderSubmittedEvent(this.id, this.totalAmount));
  }
}
```

### Violation and Fix

```typescript
// VIOLATION: Entity mixed with infrastructure
class Order {
  @Column() name: string;           // ❌ ORM annotation in entity
  @ManyToOne() customer: Customer;  // ❌ ORM relationship

  async save(): Promise<void> {     // ❌ Persistence in entity
    await database.save(this);
  }

  toJSON(): object {                // ❌ Serialization in entity
    return { id: this.id, name: this.name };
  }
}

// FIX: Separate domain entity from persistence
// domain/entities/order.ts
class Order {
  constructor(
    public readonly id: OrderId,
    private items: OrderItem[],
    private status: OrderStatus
  ) {}
  // Only business logic here
}

// infrastructure/persistence/order.orm-entity.ts
@Entity()
class OrderOrmEntity {
  @PrimaryColumn() id: string;
  @Column() status: string;
  @OneToMany(() => OrderItemOrmEntity, item => item.order)
  items: OrderItemOrmEntity[];
}

// infrastructure/persistence/order.mapper.ts
class OrderMapper {
  static toDomain(orm: OrderOrmEntity): Order {
    return new Order(
      OrderId.from(orm.id),
      orm.items.map(OrderItemMapper.toDomain),
      OrderStatus.from(orm.status)
    );
  }
  static toPersistence(domain: Order): OrderOrmEntity { /* ... */ }
}
```

### Decision Guide

| Scenario | Apply Full Separation | Simplify |
|----------|----------------------|----------|
| Enterprise app with complex domain | Always | Never |
| Microservice with >3 entities | Always | Never |
| Simple CRUD API (<3 entities, no logic) | Optional | Use repository pattern only |
| Prototype / MVP | Separate domain from infra at minimum | Skip presenters |
| CLI tool / script | Not needed | Not needed |

---

## 2. Independence Rules

### 2.1 Framework Independence

**Rule: Business logic MUST compile and run without ANY framework. If you delete the framework, only the outer layer should break.**

```typescript
// ❌ VIOLATION: Business logic depends on NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class CreateOrderService {
  constructor(
    @InjectRepository(OrderEntity)
    private orderRepo: Repository<OrderEntity>
  ) {}
}

// ✅ CORRECT: Business logic is framework-free
// domain/ports/order.repository.ts
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCustomer(customerId: CustomerId): Promise<Order[]>;
  nextId(): OrderId;
}

// application/use-cases/create-order.ts
class CreateOrderUseCase {
  constructor(private readonly orderRepo: OrderRepository) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const order = Order.create(
      this.orderRepo.nextId(),
      CustomerId.from(input.customerId),
      input.items.map(i => OrderItem.create(i.productId, i.quantity))
    );
    await this.orderRepo.save(order);
    return { orderId: order.id.value };
  }
}

// infrastructure/nestjs/order.module.ts  ← Framework stays here
@Module({
  providers: [
    CreateOrderUseCase,
    { provide: 'OrderRepository', useClass: TypeOrmOrderRepository }
  ]
})
export class OrderModule {}
```

```python
# ❌ VIOLATION: Business logic depends on Django
from django.db import models

class Order(models.Model):  # Domain entity tied to Django ORM
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    status = models.CharField(max_length=20)

# ✅ CORRECT: Framework-free domain
# domain/entities/order.py
from dataclasses import dataclass, field
from domain.value_objects import OrderId, Money, OrderStatus

@dataclass
class Order:
    id: OrderId
    customer_id: str
    items: list[OrderItem] = field(default_factory=list)
    status: OrderStatus = OrderStatus.DRAFT

    def submit(self) -> None:
        if not self.items:
            raise EmptyOrderError(self.id)
        self.status = OrderStatus.SUBMITTED

# infrastructure/django/models.py  ← Django stays here
from django.db import models

class OrderModel(models.Model):
    class Meta:
        db_table = 'orders'
    id = models.UUIDField(primary_key=True)
    customer_id = models.UUIDField()
    status = models.CharField(max_length=20)
```

### 2.2 UI Independence

**Rule: Business rules MUST work without any UI. The same use cases MUST be callable from a REST API, CLI, GraphQL, gRPC, or message queue without changing business logic.**

```typescript
// The use case doesn't know or care about HTTP, CLI, or GraphQL
class SubmitOrderUseCase {
  async execute(input: SubmitOrderInput): Promise<SubmitOrderOutput> {
    const order = await this.orderRepo.findById(OrderId.from(input.orderId));
    if (!order) throw new OrderNotFoundError(input.orderId);
    order.submit();
    await this.orderRepo.save(order);
    return { orderId: order.id.value, status: order.status.value };
  }
}

// REST Controller - one adapter
class OrderController {
  async submitOrder(req: Request, res: Response) {
    const result = await this.submitOrderUseCase.execute({
      orderId: req.params.id
    });
    res.status(200).json(result);
  }
}

// CLI Command - another adapter, same use case
class SubmitOrderCommand {
  async run(args: string[]) {
    const result = await this.submitOrderUseCase.execute({
      orderId: args[0]
    });
    console.log(`Order ${result.orderId} submitted`);
  }
}

// GraphQL Resolver - yet another adapter, same use case
class OrderResolver {
  @Mutation()
  async submitOrder(@Arg('orderId') orderId: string) {
    return this.submitOrderUseCase.execute({ orderId });
  }
}

// Message Queue Consumer - yet another adapter, same use case
class OrderEventConsumer {
  async handleSubmitOrder(message: QueueMessage) {
    await this.submitOrderUseCase.execute({
      orderId: message.body.orderId
    });
  }
}
```

### 2.3 Database Independence

**Rule: Business rules MUST NOT know which database is used. Switching from PostgreSQL to MongoDB to an in-memory store MUST require changes ONLY in the infrastructure layer.**

```typescript
// domain/ports/order.repository.ts — defines WHAT, not HOW
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCustomer(customerId: CustomerId, options?: PaginationOptions): Promise<PaginatedResult<Order>>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
  delete(id: OrderId): Promise<void>;
}

// infrastructure/persistence/postgresql/pg-order.repository.ts
class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly pool: Pool) {}

  async save(order: Order): Promise<void> {
    const data = OrderMapper.toPersistence(order);
    await this.pool.query(
      'INSERT INTO orders (id, customer_id, status, total) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET status=$3, total=$4',
      [data.id, data.customerId, data.status, data.total]
    );
  }

  async findById(id: OrderId): Promise<Order | null> {
    const result = await this.pool.query('SELECT * FROM orders WHERE id = $1', [id.value]);
    return result.rows[0] ? OrderMapper.toDomain(result.rows[0]) : null;
  }
}

// infrastructure/persistence/mongodb/mongo-order.repository.ts
class MongoOrderRepository implements OrderRepository {
  constructor(private readonly collection: Collection) {}

  async save(order: Order): Promise<void> {
    const data = OrderMapper.toPersistence(order);
    await this.collection.replaceOne({ _id: data.id }, data, { upsert: true });
  }
}

// infrastructure/persistence/in-memory/memory-order.repository.ts
class InMemoryOrderRepository implements OrderRepository {
  private store = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    this.store.set(order.id.value, order);
  }

  async findById(id: OrderId): Promise<Order | null> {
    return this.store.get(id.value) ?? null;
  }
}
```

### 2.4 External Agency Independence

**Rule: Business rules MUST NOT know about ANY external system—email providers, payment gateways, SMS services, cloud storage, third-party APIs. ALL external interactions go through port interfaces.**

```typescript
// domain/ports — define what external capabilities you need
interface PaymentGateway {
  charge(amount: Money, paymentMethod: PaymentMethodId): Promise<PaymentResult>;
  refund(paymentId: PaymentId, amount: Money): Promise<RefundResult>;
}

interface NotificationService {
  send(notification: Notification): Promise<void>;
}

interface FileStorage {
  upload(file: FileData, path: StoragePath): Promise<FileUrl>;
  delete(path: StoragePath): Promise<void>;
  getSignedUrl(path: StoragePath, expiresIn: Duration): Promise<FileUrl>;
}

// infrastructure/payment/stripe-payment.gateway.ts
class StripePaymentGateway implements PaymentGateway {
  constructor(private readonly stripe: Stripe) {}

  async charge(amount: Money, paymentMethodId: PaymentMethodId): Promise<PaymentResult> {
    const intent = await this.stripe.paymentIntents.create({
      amount: amount.toCents(),
      currency: amount.currency.code,
      payment_method: paymentMethodId.value,
      confirm: true,
    });
    return PaymentResult.success(PaymentId.from(intent.id));
  }
}

// Swap to different provider — ZERO changes to business logic
class BraintreePaymentGateway implements PaymentGateway {
  async charge(amount: Money, paymentMethodId: PaymentMethodId): Promise<PaymentResult> {
    // Braintree-specific implementation
  }
}
```

---

## 3. The Dependency Rule (Summary)

> **Full specification: [dependency-rule.md](./dependency-rule.md)**

### Core Rule
**Source code dependencies MUST point inward only. Nothing in an inner circle can know anything about something in an outer circle.**

```
Frameworks & Drivers → Interface Adapters → Use Cases → Entities
         ↑                    ↑                 ↑          ↑
     (outermost)                                      (innermost)

Dependencies flow INWARD →→→→→→→→→→→→→→→→→→→→→→→→→→→ ONLY
```

### Quick Reference: Who Can Import What

| Layer | Can Import | CANNOT Import |
|-------|-----------|---------------|
| **Entities** | Other entities, value objects, standard library | Use cases, adapters, frameworks, ANY external package |
| **Use Cases** | Entities, port interfaces (defined in use case layer) | Adapter implementations, frameworks, DB libraries |
| **Adapters** | Use case interfaces, entities (for mapping only) | Other adapter implementations, framework internals |
| **Frameworks** | Everything (but keep logic minimal) | N/A |

---

## 4. Testability Principle

### Rule
**Every layer MUST be testable in complete isolation. If you cannot test a class without starting a database, web server, or external service, you have violated clean architecture.**

### Testing Strategy Per Layer

```typescript
// ENTITIES: Test without ANY mocks — pure logic
describe('Order', () => {
  it('should reject submission of empty order', () => {
    const order = Order.create(OrderId.generate(), customerId);
    expect(() => order.submit()).toThrow(EmptyOrderError);
  });

  it('should calculate total from items', () => {
    const order = Order.create(OrderId.generate(), customerId);
    order.addItem(product, 2);  // product price: $10
    expect(order.totalAmount).toEqual(Money.of(20, 'USD'));
  });

  it('should emit OrderSubmittedEvent on submission', () => {
    const order = createOrderWithItems();
    order.submit();
    expect(order.domainEvents).toContainEqual(
      expect.objectContaining({ type: 'OrderSubmitted' })
    );
  });
});

// USE CASES: Mock ONLY ports (repositories, gateways)
describe('CreateOrderUseCase', () => {
  let useCase: CreateOrderUseCase;
  let orderRepo: jest.Mocked<OrderRepository>;
  let productRepo: jest.Mocked<ProductRepository>;

  beforeEach(() => {
    orderRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      nextId: jest.fn().mockReturnValue(OrderId.from('order-1')),
    };
    productRepo = {
      findById: jest.fn(),
    };
    useCase = new CreateOrderUseCase(orderRepo, productRepo);
  });

  it('should create order with valid items', async () => {
    productRepo.findById.mockResolvedValue(aProduct({ price: Money.of(10, 'USD') }));

    const result = await useCase.execute({
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2 }]
    });

    expect(result.orderId).toBe('order-1');
    expect(orderRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: OrderId.from('order-1'),
        status: OrderStatus.DRAFT
      })
    );
  });
});

// ADAPTERS: Integration tests with real infrastructure (but isolated)
describe('PostgresOrderRepository', () => {
  let repo: PostgresOrderRepository;
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await TestDatabase.create(); // Testcontainers or in-memory
    repo = new PostgresOrderRepository(testDb.pool);
  });

  afterAll(() => testDb.destroy());

  it('should persist and retrieve order', async () => {
    const order = createTestOrder();
    await repo.save(order);
    const found = await repo.findById(order.id);
    expect(found).toEqual(order);
  });
});
```

```python
# Python testing examples
# ENTITIES: Pure unit tests
class TestOrder:
    def test_submit_empty_order_raises(self):
        order = Order(id=OrderId.generate(), customer_id="cust-1")
        with pytest.raises(EmptyOrderError):
            order.submit()

    def test_add_item_calculates_total(self):
        order = Order(id=OrderId.generate(), customer_id="cust-1")
        order.add_item(product=product_fixture(), quantity=3)
        assert order.total_amount == Money(30, "USD")

# USE CASES: Mock ports
class TestCreateOrderUseCase:
    def setup_method(self):
        self.order_repo = Mock(spec=OrderRepository)
        self.order_repo.next_id.return_value = OrderId("order-1")
        self.use_case = CreateOrderUseCase(self.order_repo)

    async def test_creates_order(self):
        result = await self.use_case.execute(CreateOrderInput(
            customer_id="cust-1",
            items=[OrderItemInput(product_id="prod-1", quantity=2)]
        ))
        assert result.order_id == "order-1"
        self.order_repo.save.assert_called_once()
```

---

## 5. Screaming Architecture

### Rule
**The top-level folder structure MUST tell a reader what the application DOES, not what framework it uses. When someone opens the project, they should immediately see the business domain, not "controllers", "models", "views".**

### Violation: Framework-Screaming Structure

```
❌ BAD: This screams "I use NestJS/Express/Django"
src/
├── controllers/
│   ├── order.controller.ts
│   ├── user.controller.ts
│   └── product.controller.ts
├── services/
│   ├── order.service.ts
│   └── user.service.ts
├── models/
│   ├── order.model.ts
│   └── user.model.ts
├── repositories/
│   └── order.repository.ts
└── middlewares/
```

### Correct: Domain-Screaming Structure

```
✅ GOOD: This screams "I'm an e-commerce system"
src/
├── ordering/                          ← Business capability
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── order.ts
│   │   │   ├── order-item.ts
│   │   │   └── order-status.ts
│   │   ├── value-objects/
│   │   │   ├── money.ts
│   │   │   ├── quantity.ts
│   │   │   └── order-id.ts
│   │   ├── events/
│   │   │   ├── order-submitted.event.ts
│   │   │   └── order-cancelled.event.ts
│   │   ├── errors/
│   │   │   ├── empty-order.error.ts
│   │   │   └── invalid-quantity.error.ts
│   │   └── ports/
│   │       ├── order.repository.ts
│   │       └── payment.gateway.ts
│   ├── application/
│   │   ├── commands/
│   │   │   ├── create-order/
│   │   │   │   ├── create-order.command.ts
│   │   │   │   ├── create-order.handler.ts
│   │   │   │   └── create-order.handler.spec.ts
│   │   │   └── submit-order/
│   │   │       ├── submit-order.command.ts
│   │   │       ├── submit-order.handler.ts
│   │   │       └── submit-order.handler.spec.ts
│   │   └── queries/
│   │       ├── get-order/
│   │       │   ├── get-order.query.ts
│   │       │   ├── get-order.handler.ts
│   │       │   └── get-order.handler.spec.ts
│   │       └── list-orders/
│   │           ├── list-orders.query.ts
│   │           └── list-orders.handler.ts
│   └── infrastructure/
│       ├── persistence/
│       │   ├── typeorm/
│       │   │   ├── order.orm-entity.ts
│       │   │   ├── order.mapper.ts
│       │   │   └── typeorm-order.repository.ts
│       │   └── migrations/
│       ├── http/
│       │   ├── order.controller.ts
│       │   ├── order.routes.ts
│       │   └── dto/
│       │       ├── create-order.request.dto.ts
│       │       └── order.response.dto.ts
│       └── payment/
│           └── stripe-payment.gateway.ts
├── catalog/                           ← Another business capability
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── customer-management/               ← Another business capability
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── shared/                            ← Shared kernel
│   ├── domain/
│   │   ├── value-objects/
│   │   │   ├── money.ts
│   │   │   └── email.ts
│   │   └── base/
│   │       ├── entity.ts
│   │       ├── aggregate-root.ts
│   │       ├── value-object.ts
│   │       └── domain-event.ts
│   └── infrastructure/
│       ├── database/
│       ├── logging/
│       └── messaging/
└── main.ts                            ← Composition root
```

```python
# Python equivalent (Django + Clean Architecture)
src/
├── ordering/
│   ├── domain/
│   │   ├── __init__.py
│   │   ├── entities/
│   │   │   ├── order.py
│   │   │   └── order_item.py
│   │   ├── value_objects/
│   │   │   └── money.py
│   │   ├── events/
│   │   │   └── order_submitted.py
│   │   └── ports/
│   │       └── order_repository.py
│   ├── application/
│   │   ├── commands/
│   │   │   └── create_order.py
│   │   └── queries/
│   │       └── get_order.py
│   └── infrastructure/
│       ├── django_models/
│       │   ├── models.py
│       │   └── mapper.py
│       ├── views/
│       │   └── order_views.py
│       └── serializers/
│           └── order_serializer.py
├── catalog/
├── shared/
└── manage.py
```

---

## 6. Plugin Architecture

### Rule
**External concerns (database, UI, web framework, email, payment) are PLUGINS to business rules. Business rules define the interfaces; external systems implement them. You MUST be able to swap any plugin without touching business code.**

### Implementation Pattern

```typescript
// Step 1: Domain defines WHAT it needs (ports)
// domain/ports/notification.service.ts
interface NotificationService {
  notify(recipient: UserId, notification: DomainNotification): Promise<void>;
}

// domain/ports/file-storage.ts
interface FileStorage {
  store(file: FileData, path: string): Promise<StoredFile>;
  retrieve(path: string): Promise<FileData>;
  delete(path: string): Promise<void>;
}

// Step 2: Multiple plugins implement the port
// infrastructure/notifications/email-notification.service.ts
class EmailNotificationService implements NotificationService {
  constructor(private readonly mailer: SendGridMailer) {}
  async notify(recipient: UserId, notification: DomainNotification): Promise<void> {
    const user = await this.userRepo.findById(recipient);
    await this.mailer.send({
      to: user.email.value,
      subject: notification.title,
      body: notification.message,
    });
  }
}

// infrastructure/notifications/sms-notification.service.ts
class SmsNotificationService implements NotificationService {
  constructor(private readonly twilioClient: TwilioClient) {}
  async notify(recipient: UserId, notification: DomainNotification): Promise<void> {
    const user = await this.userRepo.findById(recipient);
    await this.twilioClient.sendSms(user.phone.value, notification.message);
  }
}

// infrastructure/notifications/slack-notification.service.ts
class SlackNotificationService implements NotificationService {
  // ... Slack webhook implementation
}

// infrastructure/notifications/composite-notification.service.ts
class CompositeNotificationService implements NotificationService {
  constructor(private readonly services: NotificationService[]) {}
  async notify(recipient: UserId, notification: DomainNotification): Promise<void> {
    await Promise.all(
      this.services.map(s => s.notify(recipient, notification))
    );
  }
}

// Step 3: Composition root wires the chosen plugin
// main.ts (or DI module)
const notificationService = new CompositeNotificationService([
  new EmailNotificationService(sendGridClient),
  new SlackNotificationService(slackWebhook),
]);
container.register('NotificationService', { useValue: notificationService });
```

### Plugin Swap Checklist

When swapping an external system:
1. **Create new implementation** of the existing port interface
2. **Update ONLY the composition root** (DI configuration)
3. **Run existing tests** — all use case tests must pass without changes
4. **Add integration tests** for the new implementation
5. **ZERO changes** to domain or application layers

---

## 7. Boundary Crossing Rules

### Rule
**Data that crosses a boundary MUST be transformed into the format most convenient for the INNER circle. NEVER pass raw database rows, HTTP request objects, or ORM entities across boundaries.**

### Complete Data Flow

```
HTTP Request → [Controller] → Request DTO → [Mapper] → Use Case Input
                                                            ↓
                                                      [Use Case]
                                                            ↓
                                                    Use Case Output → [Presenter] → Response DTO → HTTP Response
```

### Implementation

```typescript
// 1. HTTP Request arrives at Controller
// infrastructure/http/dto/create-order.request.ts
class CreateOrderRequestDto {
  @IsString() customerId: string;
  @IsArray() @ValidateNested({ each: true })
  items: CreateOrderItemDto[];
}

// 2. Controller maps to Use Case Input
// infrastructure/http/order.controller.ts
class OrderController {
  async create(req: CreateOrderRequestDto): Promise<OrderResponseDto> {
    // Map HTTP DTO → Use Case Input (plain data, no framework types)
    const input: CreateOrderInput = {
      customerId: req.customerId,
      items: req.items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    };

    const output = await this.createOrderUseCase.execute(input);

    // Map Use Case Output → HTTP Response DTO
    return OrderResponseDto.from(output);
  }
}

// 3. Use Case Input/Output are plain data structures
// application/commands/create-order/create-order.types.ts
interface CreateOrderInput {
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
}

interface CreateOrderOutput {
  orderId: string;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: Date;
}

// 4. Use Case works with domain entities internally
// application/commands/create-order/create-order.handler.ts
class CreateOrderHandler {
  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const customerId = CustomerId.from(input.customerId);
    const order = Order.create(this.orderRepo.nextId(), customerId);

    for (const item of input.items) {
      const product = await this.productRepo.findById(ProductId.from(item.productId));
      if (!product) throw new ProductNotFoundError(item.productId);
      order.addItem(product, item.quantity);
    }

    await this.orderRepo.save(order);

    // Map domain entity → Use Case Output (plain data)
    return {
      orderId: order.id.value,
      totalAmount: order.totalAmount.amount,
      currency: order.totalAmount.currency.code,
      status: order.status.value,
      createdAt: order.createdAt,
    };
  }
}

// 5. Repository maps between domain and persistence
// infrastructure/persistence/order.mapper.ts
class OrderMapper {
  static toDomain(row: OrderRow): Order {
    return Order.reconstitute({
      id: OrderId.from(row.id),
      customerId: CustomerId.from(row.customer_id),
      items: row.items.map(i => OrderItem.reconstitute({
        productId: ProductId.from(i.product_id),
        productName: i.product_name,
        unitPrice: Money.of(i.unit_price, row.currency),
        quantity: Quantity.of(i.quantity),
      })),
      status: OrderStatus.from(row.status),
      createdAt: row.created_at,
    });
  }

  static toPersistence(order: Order): OrderRow {
    return {
      id: order.id.value,
      customer_id: order.customerId.value,
      status: order.status.value,
      total_amount: order.totalAmount.amount,
      currency: order.totalAmount.currency.code,
      created_at: order.createdAt,
    };
  }
}
```

### Boundary Crossing Cheat Sheet

| From → To | Data Format | Transformer |
|-----------|------------|-------------|
| HTTP → Controller | Raw body / params | Framework deserializer |
| Controller → Use Case | Plain input DTO (no framework types) | Controller mapping code |
| Use Case → Entity | Value Objects | Use case creates/loads entities |
| Entity → Repository | ORM entity / DB row | Entity Mapper |
| Repository → Use Case | Domain Entity | Entity Mapper |
| Use Case → Controller | Plain output DTO | Use case return value |
| Controller → HTTP | Response DTO (JSON-serializable) | Framework serializer |

### Rules for Boundary Models

1. **NEVER reuse the same model across boundaries** — Create separate models for each boundary crossing
2. **Input models are immutable** — Use readonly properties or frozen objects
3. **Output models contain ONLY primitive types** — strings, numbers, booleans, dates, arrays of these
4. **Domain entities NEVER cross boundaries** — Always map to/from plain DTOs
5. **Validation at each boundary** — HTTP validation (format), domain validation (business rules)

---

## 8. SOLID Principles in Clean Architecture Context

### SRP — Single Responsibility

**Each class has one reason to change. In clean architecture, the "reason" is tied to the layer.**

```typescript
// ❌ VIOLATION: Use case does validation, business logic, AND persistence
class CreateOrderUseCase {
  async execute(input: any) {
    // Validation (controller concern)
    if (!input.customerId) throw new Error('Customer ID required');
    if (!input.items?.length) throw new Error('Items required');

    // Business logic (correct)
    const order = new Order(input.customerId, input.items);

    // Persistence (infrastructure concern)
    await this.db.query('INSERT INTO orders...', [order]);

    // Notification (infrastructure concern)
    await this.emailService.send(order.customerEmail, 'Order created');
  }
}

// ✅ CORRECT: Each concern in its own class/layer
class CreateOrderHandler {
  constructor(
    private orderRepo: OrderRepository,
    private eventBus: EventBus
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const order = Order.create(this.orderRepo.nextId(), input.customerId);
    // Only orchestration logic here
    for (const item of input.items) {
      order.addItem(item.productId, item.quantity);
    }
    await this.orderRepo.save(order);
    await this.eventBus.publish(order.domainEvents);
    return { orderId: order.id.value };
  }
}
// Validation: in controller or input validator
// Persistence: in repository implementation
// Notification: in event handler reacting to OrderCreatedEvent
```

### OCP — Open/Closed

**Extend behavior without modifying existing code. In clean architecture, use the plugin pattern.**

```typescript
// ✅ New payment method = new class, zero changes to existing code
interface PaymentProcessor {
  supports(method: PaymentMethod): boolean;
  process(payment: Payment): Promise<PaymentResult>;
}

class CreditCardProcessor implements PaymentProcessor {
  supports(method: PaymentMethod) { return method === PaymentMethod.CREDIT_CARD; }
  async process(payment: Payment) { /* Stripe logic */ }
}

class PayPalProcessor implements PaymentProcessor {
  supports(method: PaymentMethod) { return method === PaymentMethod.PAYPAL; }
  async process(payment: Payment) { /* PayPal logic */ }
}

// Adding CryptoProcessor requires ZERO changes to existing code
class CryptoProcessor implements PaymentProcessor {
  supports(method: PaymentMethod) { return method === PaymentMethod.CRYPTO; }
  async process(payment: Payment) { /* Crypto logic */ }
}

// Use case uses all processors without knowing specifics
class ProcessPaymentUseCase {
  constructor(private processors: PaymentProcessor[]) {}

  async execute(input: ProcessPaymentInput): Promise<PaymentResult> {
    const processor = this.processors.find(p => p.supports(input.method));
    if (!processor) throw new UnsupportedPaymentMethodError(input.method);
    return processor.process(Payment.create(input));
  }
}
```

### LSP — Liskov Substitution

**Every implementation of a port MUST be interchangeable without breaking behavior.**

```typescript
// All OrderRepository implementations MUST behave identically:
// - save() then findById() returns the same entity
// - findById() with non-existent ID returns null (not throw)
// - findByCustomer() returns empty array (not null) when no orders exist

// ✅ Write contract tests that ALL implementations must pass
abstract class OrderRepositoryContractTest {
  abstract createRepository(): OrderRepository;

  test('save and retrieve order', async () => {
    const repo = this.createRepository();
    const order = createTestOrder();
    await repo.save(order);
    const found = await repo.findById(order.id);
    expect(found).toEqual(order);
  });

  test('return null for non-existent order', async () => {
    const repo = this.createRepository();
    const found = await repo.findById(OrderId.from('non-existent'));
    expect(found).toBeNull();
  });

  test('return empty array when no orders for customer', async () => {
    const repo = this.createRepository();
    const orders = await repo.findByCustomer(CustomerId.from('no-orders'));
    expect(orders).toEqual([]);
  });
}

// Each implementation runs the SAME contract tests
class PostgresOrderRepositoryTest extends OrderRepositoryContractTest {
  createRepository() { return new PostgresOrderRepository(testDb); }
}

class MongoOrderRepositoryTest extends OrderRepositoryContractTest {
  createRepository() { return new MongoOrderRepository(testCollection); }
}
```

### ISP — Interface Segregation

**Clients should not depend on methods they don't use. Split large port interfaces into focused ones.**

```typescript
// ❌ VIOLATION: Fat interface forces unnecessary dependencies
interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<User>>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  updateLastLogin(id: UserId, date: Date): Promise<void>;
  findInactive(since: Date): Promise<User[]>;
  countByRole(role: UserRole): Promise<number>;
  exportToCsv(): Promise<Buffer>;
}

// ✅ CORRECT: Segregated interfaces per use case needs
interface UserReader {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
}

interface UserWriter {
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
}

interface UserQueryService {
  findAll(options: PaginationOptions): Promise<PaginatedResult<User>>;
  findInactive(since: Date): Promise<User[]>;
  countByRole(role: UserRole): Promise<number>;
}

// Use cases depend ONLY on what they need
class GetUserUseCase {
  constructor(private users: UserReader) {} // Only needs read
}

class DeleteUserUseCase {
  constructor(
    private users: UserReader & UserWriter // Needs read + write
  ) {}
}
```

### DIP — Dependency Inversion

**High-level modules (use cases) MUST NOT depend on low-level modules (infrastructure). Both depend on abstractions (ports). This is the FOUNDATION of clean architecture.**

```typescript
// ❌ VIOLATION: Use case depends directly on infrastructure
import { PrismaClient } from '@prisma/client';  // ❌ Framework import
import { SendGridClient } from '@sendgrid/mail'; // ❌ External service import

class CreateOrderUseCase {
  constructor(
    private prisma: PrismaClient,        // ❌ Concrete dependency
    private sendgrid: SendGridClient      // ❌ Concrete dependency
  ) {}
}

// ✅ CORRECT: Use case depends on abstractions defined in its own layer
// application/ports/order.repository.ts (defined BY the use case layer)
interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
}

// application/ports/notification.service.ts (defined BY the use case layer)
interface NotificationService {
  notifyOrderCreated(order: Order): Promise<void>;
}

// application/use-cases/create-order.ts
class CreateOrderUseCase {
  constructor(
    private orderRepo: OrderRepository,        // ✅ Abstraction
    private notifications: NotificationService  // ✅ Abstraction
  ) {}
}

// infrastructure/ provides implementations
// Wired at composition root — use case never knows the concrete types
```

---

## Principle Interaction Map

```
SOLID Principles ←→ Clean Architecture Layers
═══════════════════════════════════════════════
SRP     → Each layer has one reason to change
OCP     → Plugin architecture (new implementations, no modifications)
LSP     → All port implementations are interchangeable
ISP     → Ports are small, focused interfaces
DIP     → Inner layers define interfaces, outer layers implement them

Separation of Concerns → Layers exist
Dependency Rule        → Layers have direction
Independence          → Layers are swappable
Testability           → Layers are mockable
Screaming Architecture → Layers are organized by domain
Plugin Architecture    → External systems are replaceable
Boundary Crossing     → Data transforms at each boundary
```

## Anti-Pattern Quick Reference

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| **Smart Entity** | Entity calls database, sends emails | Extract to use case + ports |
| **Anemic Domain** | Entity is just data, logic in services | Move business logic INTO entity |
| **God Use Case** | One use case does everything | Split into focused use cases |
| **Leaky Abstraction** | Port interface exposes DB concepts (query builder, SQL) | Redesign port with domain terms |
| **Shared Model** | Same class used as Entity, ORM model, AND API response | Create separate models per boundary |
| **Framework Creep** | Framework annotations (@Entity, @Injectable) in domain | Move annotations to infrastructure |
| **Circular Dependency** | Two layers import each other | Introduce port interface, invert dependency |
| **Missing Boundary** | Controller directly calls repository, skipping use case | Add use case layer even for simple CRUD |

## Enforcement Checklist

Before every PR, verify:

- [ ] **No framework imports in domain/entities layer**
- [ ] **No framework imports in application/use-cases layer**
- [ ] **All external interactions go through port interfaces**
- [ ] **Every use case has corresponding unit tests with mocked ports**
- [ ] **Entity tests require zero mocks**
- [ ] **No ORM entities used as domain entities**
- [ ] **Separate DTOs at each boundary crossing**
- [ ] **Folder structure organized by business domain, not technical concern**
- [ ] **DI configuration exists in composition root only**
- [ ] **No business logic in controllers or repositories**
