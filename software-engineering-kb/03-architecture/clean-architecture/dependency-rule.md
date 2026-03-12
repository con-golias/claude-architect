# Clean Architecture: The Dependency Rule — Complete Specification

> **AI Plugin Directive:** The Dependency Rule is the MOST IMPORTANT rule in clean architecture. Every import statement, every function call, every type reference MUST be validated against this rule. Violations here cascade into unmaintainable, untestable code.

---

## 1. The Core Rule

**Source code dependencies MUST point inward only. Nothing in an inner circle can know anything at all about something in an outer circle. No name, no function, no class, no data format, no type from an outer circle may be mentioned by code in an inner circle.**

### The Concentric Circles

```
┌─────────────────────────────────────────────────────────────┐
│  FRAMEWORKS & DRIVERS (outermost)                           │
│  Web framework, DB driver, UI library, external APIs        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  INTERFACE ADAPTERS                                  │    │
│  │  Controllers, Presenters, Gateways, Mappers         │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │  APPLICATION BUSINESS RULES (Use Cases)      │    │    │
│  │  │  Application-specific orchestration          │    │    │
│  │  │  ┌─────────────────────────────────────┐    │    │    │
│  │  │  │  ENTERPRISE BUSINESS RULES           │    │    │    │
│  │  │  │  Entities, Value Objects, Domain      │    │    │    │
│  │  │  │  Events, Business Invariants          │    │    │    │
│  │  │  └─────────────────────────────────────┘    │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

Dependencies: ONLY point INWARD →→→→→→→→→→→→→→→→→→→→→→→
```

### Layer Reference Table

| Layer | Also Called | Can Depend On | CANNOT Depend On |
|-------|-----------|---------------|------------------|
| **Entities** | Domain, Core, Enterprise Rules | Standard library only | Use Cases, Adapters, Frameworks |
| **Use Cases** | Application, Interactors | Entities, port interfaces defined in this layer | Adapter implementations, Frameworks |
| **Adapters** | Interface Adapters, Ports & Adapters | Use Case interfaces, Entities (for mapping) | Other adapter implementations directly |
| **Frameworks** | Infrastructure, Drivers, External | Everything above (but keep logic minimal) | N/A (outermost) |

---

## 2. Dependency Inversion in Practice

### The Plugin Model

**Outer layers implement interfaces defined by inner layers. Inner layers define the PORT (what they need); outer layers provide the ADAPTER (how it's done).**

### 2.1 Database Port/Adapter

```typescript
// ────────────────────────────────────────────
// INNER LAYER: Domain defines WHAT it needs
// domain/ports/order.repository.ts
// ────────────────────────────────────────────
export interface OrderRepository {
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | null>;
  findByCustomerId(customerId: CustomerId): Promise<Order[]>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
  delete(id: OrderId): Promise<void>;
  nextId(): OrderId;
  existsWithId(id: OrderId): Promise<boolean>;
}

// ────────────────────────────────────────────
// OUTER LAYER: Infrastructure provides HOW
// infrastructure/persistence/typeorm-order.repository.ts
// ────────────────────────────────────────────
import { Repository, DataSource } from 'typeorm';
import { OrderRepository } from '../../domain/ports/order.repository';
import { Order } from '../../domain/entities/order';
import { OrderOrmEntity } from './entities/order.orm-entity';
import { OrderMapper } from './mappers/order.mapper';

export class TypeOrmOrderRepository implements OrderRepository {
  private ormRepo: Repository<OrderOrmEntity>;

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

  async findByCustomerId(customerId: CustomerId): Promise<Order[]> {
    const ormEntities = await this.ormRepo.find({
      where: { customerId: customerId.value },
      relations: ['items'],
    });
    return ormEntities.map(OrderMapper.toDomain);
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
    return OrderId.generate(); // UUID generation
  }

  async existsWithId(id: OrderId): Promise<boolean> {
    return await this.ormRepo.exist({ where: { id: id.value } });
  }
}
```

```python
# Python: Domain Port
# domain/ports/order_repository.py
from abc import ABC, abstractmethod
from domain.entities.order import Order
from domain.value_objects import OrderId, CustomerId, OrderStatus

class OrderRepository(ABC):
    @abstractmethod
    async def save(self, order: Order) -> None: ...

    @abstractmethod
    async def find_by_id(self, id: OrderId) -> Order | None: ...

    @abstractmethod
    async def find_by_customer_id(self, customer_id: CustomerId) -> list[Order]: ...

    @abstractmethod
    async def delete(self, id: OrderId) -> None: ...

    @abstractmethod
    def next_id(self) -> OrderId: ...

# infrastructure/persistence/sqlalchemy_order_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from domain.ports.order_repository import OrderRepository
from infrastructure.persistence.models import OrderModel
from infrastructure.persistence.mappers import OrderMapper

class SqlAlchemyOrderRepository(OrderRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, order: Order) -> None:
        model = OrderMapper.to_persistence(order)
        self._session.add(model)
        await self._session.flush()

    async def find_by_id(self, id: OrderId) -> Order | None:
        model = await self._session.get(OrderModel, str(id))
        return OrderMapper.to_domain(model) if model else None

    async def find_by_customer_id(self, customer_id: CustomerId) -> list[Order]:
        result = await self._session.execute(
            select(OrderModel).where(OrderModel.customer_id == str(customer_id))
        )
        return [OrderMapper.to_domain(m) for m in result.scalars()]

    async def delete(self, id: OrderId) -> None:
        model = await self._session.get(OrderModel, str(id))
        if model:
            await self._session.delete(model)

    def next_id(self) -> OrderId:
        return OrderId.generate()
```

### 2.2 HTTP Client Port/Adapter

```typescript
// domain/ports/exchange-rate.provider.ts
export interface ExchangeRateProvider {
  getRate(from: CurrencyCode, to: CurrencyCode): Promise<ExchangeRate>;
  getSupportedCurrencies(): Promise<CurrencyCode[]>;
}

// infrastructure/external/open-exchange-rates.provider.ts
export class OpenExchangeRatesProvider implements ExchangeRateProvider {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly apiKey: string
  ) {}

  async getRate(from: CurrencyCode, to: CurrencyCode): Promise<ExchangeRate> {
    const response = await this.httpClient.get(
      `https://openexchangerates.org/api/latest.json?app_id=${this.apiKey}&base=${from.value}`
    );
    const rate = response.data.rates[to.value];
    if (!rate) throw new UnsupportedCurrencyError(to);
    return ExchangeRate.create(from, to, rate);
  }
}
```

### 2.3 Email Service Port/Adapter

```typescript
// domain/ports/email.service.ts
export interface EmailService {
  send(email: Email): Promise<EmailResult>;
  sendBulk(emails: Email[]): Promise<BulkEmailResult>;
}

export interface Email {
  to: EmailAddress;
  subject: string;
  body: EmailBody;
  attachments?: Attachment[];
}

// infrastructure/email/sendgrid-email.service.ts
export class SendGridEmailService implements EmailService {
  constructor(private readonly client: SendGridClient) {}

  async send(email: Email): Promise<EmailResult> {
    try {
      await this.client.send({
        to: email.to.value,
        from: this.senderAddress,
        subject: email.subject,
        html: email.body.toHtml(),
        attachments: email.attachments?.map(this.mapAttachment),
      });
      return EmailResult.success();
    } catch (error) {
      return EmailResult.failure(error.message);
    }
  }
}

// infrastructure/email/ses-email.service.ts
export class SesEmailService implements EmailService {
  constructor(private readonly ses: SESClient) {}
  // AWS SES implementation — same interface
}
```

### 2.4 File Storage Port/Adapter

```typescript
// domain/ports/file-storage.ts
export interface FileStorage {
  upload(file: FileData, path: StoragePath): Promise<StoredFile>;
  download(path: StoragePath): Promise<FileData>;
  delete(path: StoragePath): Promise<void>;
  getPublicUrl(path: StoragePath): Promise<string>;
  getSignedUrl(path: StoragePath, expiresIn: Seconds): Promise<string>;
}

// infrastructure/storage/s3-file-storage.ts
export class S3FileStorage implements FileStorage {
  constructor(private readonly s3Client: S3Client, private readonly bucket: string) {}

  async upload(file: FileData, path: StoragePath): Promise<StoredFile> {
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: path.value,
      Body: file.buffer,
      ContentType: file.mimeType,
    }));
    return StoredFile.create(path, file.size, file.mimeType);
  }

  async download(path: StoragePath): Promise<FileData> {
    const response = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: path.value,
    }));
    return FileData.fromStream(response.Body, response.ContentType);
  }
}

// infrastructure/storage/local-file-storage.ts
export class LocalFileStorage implements FileStorage {
  constructor(private readonly basePath: string) {}
  // Local filesystem implementation — same interface, for development
}

// infrastructure/storage/gcs-file-storage.ts
export class GcsFileStorage implements FileStorage {
  // Google Cloud Storage implementation — same interface
}
```

### 2.5 Message Queue Port/Adapter

```typescript
// domain/ports/event-bus.ts
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}

export interface EventSubscriber<T extends DomainEvent> {
  handle(event: T): Promise<void>;
}

// infrastructure/messaging/rabbitmq-event-bus.ts
export class RabbitMQEventBus implements EventBus {
  constructor(private readonly channel: Channel) {}

  async publish(event: DomainEvent): Promise<void> {
    const exchange = this.getExchangeForEvent(event);
    const routingKey = event.type;
    this.channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify({
        type: event.type,
        payload: event.payload,
        timestamp: event.occurredAt.toISOString(),
        id: event.id,
      }))
    );
  }
}

// infrastructure/messaging/sqs-event-bus.ts
export class SqsEventBus implements EventBus {
  constructor(private readonly sqsClient: SQSClient, private readonly queueUrl: string) {}

  async publish(event: DomainEvent): Promise<void> {
    await this.sqsClient.send(new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(event),
      MessageGroupId: event.aggregateId,
    }));
  }
}

// infrastructure/messaging/in-memory-event-bus.ts (for testing)
export class InMemoryEventBus implements EventBus {
  private published: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
  }

  getPublished(): DomainEvent[] {
    return [...this.published];
  }

  clear(): void {
    this.published = [];
  }
}
```

### 2.6 Cache Port/Adapter

```typescript
// domain/ports/cache.ts
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: Seconds): Promise<void>;
  delete(key: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
}

// infrastructure/cache/redis-cache.ts
export class RedisCache implements Cache {
  constructor(private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) as T : null;
  }

  async set<T>(key: string, value: T, ttl?: Seconds): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await this.redis.setex(key, ttl.value, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }
}

// infrastructure/cache/memory-cache.ts
export class MemoryCache implements Cache {
  private store = new Map<string, { value: string; expiresAt?: number }>();
  // In-memory implementation for development/testing
}
```

### 2.7 External API Port/Adapter

```typescript
// domain/ports/payment.gateway.ts
export interface PaymentGateway {
  createPaymentIntent(amount: Money, metadata: PaymentMetadata): Promise<PaymentIntent>;
  capturePayment(intentId: PaymentIntentId): Promise<PaymentCapture>;
  refund(paymentId: PaymentId, amount?: Money): Promise<Refund>;
  getPaymentStatus(paymentId: PaymentId): Promise<PaymentStatus>;
}

// infrastructure/payment/stripe.gateway.ts
export class StripePaymentGateway implements PaymentGateway {
  constructor(private readonly stripe: Stripe) {}

  async createPaymentIntent(amount: Money, metadata: PaymentMetadata): Promise<PaymentIntent> {
    const intent = await this.stripe.paymentIntents.create({
      amount: amount.toCents(),
      currency: amount.currency.code.toLowerCase(),
      metadata: { orderId: metadata.orderId, customerId: metadata.customerId },
    });
    return PaymentIntent.create(
      PaymentIntentId.from(intent.id),
      intent.client_secret!,
      PaymentStatus.from(intent.status)
    );
  }
}

// infrastructure/payment/square.gateway.ts
export class SquarePaymentGateway implements PaymentGateway {
  // Square implementation — same interface
}
```

### Complete DI Container Configuration

```typescript
// TypeScript with tsyringe
// composition-root/container.ts
import { container } from 'tsyringe';

// Repositories
container.register<OrderRepository>('OrderRepository', {
  useClass: TypeOrmOrderRepository
});
container.register<ProductRepository>('ProductRepository', {
  useClass: TypeOrmProductRepository
});

// External services
container.register<PaymentGateway>('PaymentGateway', {
  useClass: StripePaymentGateway
});
container.register<EmailService>('EmailService', {
  useClass: SendGridEmailService
});
container.register<FileStorage>('FileStorage', {
  useClass: S3FileStorage
});
container.register<Cache>('Cache', {
  useClass: RedisCache
});
container.register<EventBus>('EventBus', {
  useClass: RabbitMQEventBus
});

// Use cases (auto-resolved via constructor injection)
container.register(CreateOrderUseCase, { useClass: CreateOrderUseCase });
container.register(SubmitOrderUseCase, { useClass: SubmitOrderUseCase });
```

```python
# Python with dependency-injector
# composition_root/container.py
from dependency_injector import containers, providers
from domain.ports.order_repository import OrderRepository
from infrastructure.persistence.sqlalchemy_order_repository import SqlAlchemyOrderRepository

class Container(containers.DeclarativeContainer):
    config = providers.Configuration()

    # Database
    db_session = providers.Singleton(
        create_async_session,
        url=config.database.url
    )

    # Repositories
    order_repository = providers.Factory(
        SqlAlchemyOrderRepository,
        session=db_session
    )

    # External Services
    payment_gateway = providers.Singleton(
        StripePaymentGateway,
        api_key=config.stripe.api_key
    )

    email_service = providers.Singleton(
        SendGridEmailService,
        api_key=config.sendgrid.api_key
    )

    # Use Cases
    create_order = providers.Factory(
        CreateOrderUseCase,
        order_repo=order_repository,
        payment=payment_gateway,
        notifications=email_service
    )
```

```csharp
// C# with built-in DI
// Program.cs or Startup.cs
public static IServiceCollection AddApplicationServices(this IServiceCollection services)
{
    // Repositories
    services.AddScoped<IOrderRepository, EfCoreOrderRepository>();
    services.AddScoped<IProductRepository, EfCoreProductRepository>();

    // External Services
    services.AddSingleton<IPaymentGateway, StripePaymentGateway>();
    services.AddSingleton<IEmailService, SendGridEmailService>();
    services.AddSingleton<IFileStorage, S3FileStorage>();
    services.AddSingleton<ICache, RedisCache>();
    services.AddSingleton<IEventBus, RabbitMqEventBus>();

    // Use Cases
    services.AddScoped<CreateOrderUseCase>();
    services.AddScoped<SubmitOrderUseCase>();
    services.AddScoped<CancelOrderUseCase>();

    return services;
}
```

---

## 3. Import Rules — What Can Import What

### TypeScript Import Rules

```typescript
// ═══════════════════════════════════════════
// ENTITIES LAYER — Can import: NOTHING external
// ═══════════════════════════════════════════

// ✅ VALID imports in entities
import { OrderItem } from './order-item';           // Same layer entity
import { Money } from '../value-objects/money';      // Same layer value object
import { OrderId } from '../value-objects/order-id'; // Same layer value object
import { DomainEvent } from '../events/domain-event'; // Same layer base class
import { v4 as uuid } from 'uuid';                  // Standard library utility (acceptable)

// ❌ INVALID imports in entities
import { Injectable } from '@nestjs/common';         // ❌ Framework
import { Column, Entity } from 'typeorm';            // ❌ ORM
import { IsString } from 'class-validator';          // ❌ Validation library
import { OrderRepository } from '../ports/order.repository'; // ❌ Port (use case layer)
import { CreateOrderUseCase } from '../../application/...';  // ❌ Use case layer
import { OrderController } from '../../infrastructure/...';  // ❌ Infrastructure

// ═══════════════════════════════════════════
// USE CASES LAYER — Can import: Entities + Port interfaces
// ═══════════════════════════════════════════

// ✅ VALID imports in use cases
import { Order } from '../../domain/entities/order';          // Entity
import { OrderId } from '../../domain/value-objects/order-id'; // Value object
import { OrderRepository } from '../ports/order.repository';   // Port interface (defined HERE)
import { EventBus } from '../ports/event-bus';                 // Port interface (defined HERE)
import { CreateOrderInput, CreateOrderOutput } from './create-order.types'; // Own types

// ❌ INVALID imports in use cases
import { TypeOrmOrderRepository } from '../../infrastructure/...';  // ❌ Concrete implementation
import { Request, Response } from 'express';                        // ❌ Framework
import { PrismaClient } from '@prisma/client';                      // ❌ ORM
import { OrderController } from '../../infrastructure/...';         // ❌ Controller

// ═══════════════════════════════════════════
// ADAPTERS LAYER — Can import: Use Case interfaces + Entities (for mapping)
// ═══════════════════════════════════════════

// ✅ VALID imports in adapters (controller)
import { CreateOrderUseCase } from '../../application/use-cases/create-order'; // Use case
import { CreateOrderInput } from '../../application/use-cases/create-order.types'; // Use case types
import { Order } from '../../domain/entities/order';    // Entity (for mapping)
import { Request, Response } from 'express';             // Framework (allowed at this layer)
import { body, validationResult } from 'express-validator'; // Validation lib (this layer)

// ❌ INVALID imports in adapters
import { TypeOrmOrderRepository } from '../persistence/...';  // ❌ Another adapter (lateral dependency)

// ═══════════════════════════════════════════
// FRAMEWORKS LAYER — Can import: Everything (but keep logic minimal)
// ═══════════════════════════════════════════

// ✅ VALID imports in frameworks layer
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateOrderUseCase } from '../../application/...';
import { TypeOrmOrderRepository } from '../persistence/...';
// Everything is allowed here — this is glue code
```

### Python Import Rules

```python
# ═══════════════════════════════════════════
# ENTITIES LAYER
# ═══════════════════════════════════════════

# ✅ VALID
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from domain.value_objects.money import Money        # Same layer
from domain.value_objects.order_id import OrderId   # Same layer
from domain.events.base import DomainEvent          # Same layer
import uuid                                          # Standard library

# ❌ INVALID
from django.db import models                        # ❌ Framework
from sqlalchemy import Column, Integer              # ❌ ORM
from pydantic import BaseModel                      # ❌ Validation library
from application.use_cases.create_order import ...  # ❌ Outer layer
from infrastructure.persistence import ...          # ❌ Infrastructure

# ═══════════════════════════════════════════
# USE CASES LAYER
# ═══════════════════════════════════════════

# ✅ VALID
from domain.entities.order import Order
from domain.value_objects.order_id import OrderId
from application.ports.order_repository import OrderRepository  # Port (defined here)
from application.ports.event_bus import EventBus                # Port (defined here)

# ❌ INVALID
from infrastructure.persistence.sqlalchemy_repo import ...  # ❌ Concrete implementation
from fastapi import Request                                  # ❌ Framework
from sqlalchemy.ext.asyncio import AsyncSession             # ❌ ORM

# ═══════════════════════════════════════════
# ADAPTERS / INFRASTRUCTURE LAYER
# ═══════════════════════════════════════════

# ✅ VALID
from application.use_cases.create_order import CreateOrderUseCase
from domain.entities.order import Order              # For mapping
from fastapi import APIRouter, Depends               # Framework
from sqlalchemy import select                        # ORM
from infrastructure.persistence.mappers import OrderMapper  # Own mapper
```

### C# Import Rules

```csharp
// ═══════════════════════════════════════════
// ENTITIES (Domain project)
// ═══════════════════════════════════════════

// ✅ VALID
using System;
using System.Collections.Generic;
using Domain.ValueObjects;
using Domain.Events;

// ❌ INVALID
using Microsoft.EntityFrameworkCore;       // ❌ Framework
using System.ComponentModel.DataAnnotations; // ❌ Data annotations
using Application.UseCases;                // ❌ Outer layer
using Infrastructure.Persistence;          // ❌ Infrastructure

// ═══════════════════════════════════════════
// USE CASES (Application project)
// ═══════════════════════════════════════════

// ✅ VALID
using Domain.Entities;
using Domain.ValueObjects;
using Application.Ports;

// ❌ INVALID
using Infrastructure.Persistence;          // ❌ Concrete implementation
using Microsoft.AspNetCore.Mvc;            // ❌ Web framework
using Microsoft.EntityFrameworkCore;       // ❌ ORM
```

---

## 4. Data Crossing Boundaries

### The Complete Transformation Chain

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  HTTP Request │────▶│  Controller  │────▶│   Use Case   │────▶│   Entity     │
│  (raw JSON)   │     │  Request DTO │     │  Input DTO   │     │(Value Objects)│
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                                                                       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ HTTP Response │◀────│  Presenter   │◀────│   Use Case   │◀────│  Repository  │
│  (raw JSON)   │     │ Response DTO │     │  Output DTO  │     │(DB Row/Model)│
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

### Full Implementation Example

```typescript
// STEP 1: HTTP Request arrives — raw JSON body
// POST /api/orders
// { "customerId": "cust-123", "items": [{ "productId": "prod-456", "quantity": 2 }] }

// STEP 2: Controller — Validates HTTP input, maps to Use Case Input
// infrastructure/http/controllers/order.controller.ts
class OrderController {
  constructor(private readonly createOrder: CreateOrderUseCase) {}

  @Post('/orders')
  async create(@Body() body: CreateOrderRequestDto): Promise<OrderResponseDto> {
    // Validate HTTP-level concerns (format, required fields)
    // Map HTTP DTO → Use Case Input (strip HTTP concerns)
    const input: CreateOrderInput = {
      customerId: body.customerId,
      items: body.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };

    // Call use case — controller doesn't know what happens inside
    const output = await this.createOrder.execute(input);

    // Map Use Case Output → HTTP Response DTO
    return {
      id: output.orderId,
      total: output.totalAmount,
      currency: output.currency,
      status: output.status,
      createdAt: output.createdAt.toISOString(),
      _links: {
        self: `/api/orders/${output.orderId}`,
        submit: `/api/orders/${output.orderId}/submit`,
      },
    };
  }
}

// STEP 3: Use Case Input — Plain data, no framework types
// application/use-cases/create-order/create-order.types.ts
interface CreateOrderInput {
  readonly customerId: string;
  readonly items: ReadonlyArray<{
    readonly productId: string;
    readonly quantity: number;
  }>;
}

interface CreateOrderOutput {
  readonly orderId: string;
  readonly totalAmount: number;
  readonly currency: string;
  readonly status: string;
  readonly createdAt: Date;
}

// STEP 4: Use Case — Works with domain entities
// application/use-cases/create-order/create-order.handler.ts
class CreateOrderUseCase {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly productRepo: ProductRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    // Create domain value objects from raw input
    const customerId = CustomerId.from(input.customerId);
    const orderId = this.orderRepo.nextId();

    // Create domain entity
    const order = Order.create(orderId, customerId);

    // Add items using domain logic
    for (const item of input.items) {
      const product = await this.productRepo.findById(ProductId.from(item.productId));
      if (!product) throw new ProductNotFoundError(item.productId);
      order.addItem(product, Quantity.of(item.quantity));
    }

    // Persist using repository port
    await this.orderRepo.save(order);

    // Publish domain events
    await this.eventBus.publishAll(order.domainEvents);

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

// STEP 5: Repository maps between domain and persistence
// infrastructure/persistence/mappers/order.mapper.ts
class OrderMapper {
  static toDomain(orm: OrderOrmEntity): Order {
    return Order.reconstitute({
      id: OrderId.from(orm.id),
      customerId: CustomerId.from(orm.customer_id),
      items: orm.items.map(item => OrderItem.reconstitute({
        id: OrderItemId.from(item.id),
        productId: ProductId.from(item.product_id),
        productName: item.product_name,
        unitPrice: Money.of(item.unit_price, orm.currency),
        quantity: Quantity.of(item.quantity),
      })),
      status: OrderStatus.from(orm.status),
      totalAmount: Money.of(orm.total_amount, orm.currency),
      createdAt: orm.created_at,
      updatedAt: orm.updated_at,
    });
  }

  static toPersistence(domain: Order): Partial<OrderOrmEntity> {
    return {
      id: domain.id.value,
      customer_id: domain.customerId.value,
      status: domain.status.value,
      total_amount: domain.totalAmount.amount,
      currency: domain.totalAmount.currency.code,
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

### Rules for Boundary Data

| Rule | Description |
|------|-------------|
| **Never pass entities across boundaries** | Always map to DTOs. Entities are internal to the domain. |
| **Input models are immutable** | Use `readonly` (TS), `@dataclass(frozen=True)` (Python), `record` (C#) |
| **Output models use primitives only** | `string`, `number`, `boolean`, `Date`, arrays of these. No value objects. |
| **Never reuse models across boundaries** | `CreateOrderRequestDto` ≠ `CreateOrderInput` ≠ `OrderOrmEntity` |
| **Inner circle dictates format** | Data crossing inward is transformed to what the inner circle expects |
| **Each boundary has its own validation** | HTTP validates format; domain validates business rules |

---

## 5. Common Violations and How to Fix Them

### Violation 1: ORM Entities as Domain Entities

```typescript
// ❌ VIOLATION: Domain entity IS the ORM entity
@Entity('orders')
class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() customerId: string;
  @Column() status: string;
  @Column('decimal') total: number;
  @OneToMany(() => OrderItem, item => item.order)
  items: OrderItem[];

  submit(): void {
    this.status = 'submitted';
  }
}

// ✅ FIX: Separate domain entity from ORM entity
// domain/entities/order.ts — NO ORM decorators
class Order {
  constructor(
    public readonly id: OrderId,
    private readonly customerId: CustomerId,
    private items: OrderItem[],
    private status: OrderStatus,
    private readonly createdAt: Date,
  ) {}

  submit(): void {
    if (this.items.length === 0) throw new EmptyOrderError(this.id);
    this.status = OrderStatus.SUBMITTED;
    this.addDomainEvent(new OrderSubmittedEvent(this.id));
  }
}

// infrastructure/persistence/entities/order.orm-entity.ts — ORM only
@Entity('orders')
class OrderOrmEntity {
  @PrimaryColumn('uuid') id: string;
  @Column() customer_id: string;
  @Column() status: string;
  @Column('decimal', { precision: 10, scale: 2 }) total_amount: number;
  @OneToMany(() => OrderItemOrmEntity, item => item.order, { cascade: true })
  items: OrderItemOrmEntity[];
}
```

### Violation 2: Framework Decorators in Domain

```typescript
// ❌ VIOLATION: NestJS decorators in domain entity
import { Injectable } from '@nestjs/common';
import { IsNotEmpty, IsPositive } from 'class-validator';

@Injectable()
class OrderService {
  @IsNotEmpty() name: string;
  @IsPositive() amount: number;
}

// ✅ FIX: Domain is decorator-free
class OrderService {
  constructor(
    private readonly name: string,
    private readonly amount: number
  ) {
    if (!name || name.trim().length === 0) throw new InvalidNameError();
    if (amount <= 0) throw new InvalidAmountError(amount);
  }
}
```

### Violation 3: Use Case Directly Calling Infrastructure

```typescript
// ❌ VIOLATION: Use case calls database directly
import { Pool } from 'pg';

class CreateOrderUseCase {
  constructor(private readonly pool: Pool) {}

  async execute(input: CreateOrderInput): Promise<void> {
    await this.pool.query(
      'INSERT INTO orders (id, customer_id, status) VALUES ($1, $2, $3)',
      [uuid(), input.customerId, 'draft']
    );
  }
}

// ✅ FIX: Use case uses port interface
class CreateOrderUseCase {
  constructor(private readonly orderRepo: OrderRepository) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const order = Order.create(this.orderRepo.nextId(), CustomerId.from(input.customerId));
    await this.orderRepo.save(order);
    return { orderId: order.id.value };
  }
}
```

### Violation 4: Leaking Database Concepts into Ports

```typescript
// ❌ VIOLATION: Port exposes database-specific concepts
interface OrderRepository {
  findByQuery(query: QueryBuilder): Promise<Order[]>;     // ❌ QueryBuilder is DB
  findWithJoin(joins: string[]): Promise<Order[]>;         // ❌ JOIN is SQL
  findRaw(sql: string, params: any[]): Promise<Order[]>;   // ❌ Raw SQL
  transaction<T>(fn: (trx: Transaction) => T): Promise<T>; // ❌ Transaction is DB
}

// ✅ FIX: Port uses domain language
interface OrderRepository {
  findByCustomer(customerId: CustomerId): Promise<Order[]>;
  findByStatus(status: OrderStatus): Promise<Order[]>;
  findByDateRange(from: Date, to: Date): Promise<Order[]>;
  findPending(): Promise<Order[]>;
  save(order: Order): Promise<void>;
}

// Transaction management: use Unit of Work pattern at infrastructure level
interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  getOrderRepository(): OrderRepository;
  getProductRepository(): ProductRepository;
}
```

### Violation 5: Controller Contains Business Logic

```typescript
// ❌ VIOLATION: Business rules in controller
class OrderController {
  @Post('/orders/:id/submit')
  async submit(@Param('id') id: string, @Res() res: Response) {
    const order = await this.orderRepo.findById(id);
    if (!order) return res.status(404).json({ error: 'Not found' });

    // ❌ Business logic in controller
    if (order.items.length === 0) {
      return res.status(400).json({ error: 'Cannot submit empty order' });
    }
    if (order.total < 1) {
      return res.status(400).json({ error: 'Minimum order amount is $1' });
    }
    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Order already submitted' });
    }

    order.status = 'submitted';
    await this.orderRepo.save(order);
    await this.emailService.send(order.customerEmail, 'Order submitted');

    return res.status(200).json(order);
  }
}

// ✅ FIX: Controller delegates to use case
class OrderController {
  @Post('/orders/:id/submit')
  async submit(@Param('id') id: string): Promise<OrderResponseDto> {
    try {
      const output = await this.submitOrderUseCase.execute({ orderId: id });
      return OrderResponseDto.from(output);
    } catch (error) {
      // Error mapping is the only logic allowed here
      if (error instanceof OrderNotFoundError) throw new NotFoundException();
      if (error instanceof EmptyOrderError) throw new BadRequestException(error.message);
      if (error instanceof OrderNotModifiableError) throw new ConflictException(error.message);
      throw error;
    }
  }
}
```

### Violation 6: Using Framework-Specific Types in Domain

```typescript
// ❌ VIOLATION: Domain uses Express Request/Response
import { Request } from 'express';

class ProcessPaymentUseCase {
  async execute(req: Request): Promise<void> {  // ❌ Express type in use case
    const amount = req.body.amount;
    const customerId = req.headers['x-customer-id'];
  }
}

// ✅ FIX: Use case uses plain input
interface ProcessPaymentInput {
  readonly amount: number;
  readonly currency: string;
  readonly customerId: string;
  readonly paymentMethodId: string;
}

class ProcessPaymentUseCase {
  async execute(input: ProcessPaymentInput): Promise<ProcessPaymentOutput> {
    // Works with plain data — doesn't know about HTTP
  }
}
```

### Violation 7: Domain Events Contain Infrastructure Details

```typescript
// ❌ VIOLATION: Domain event contains HTTP/DB concerns
class OrderCreatedEvent {
  constructor(
    public readonly httpStatusCode: number,    // ❌ HTTP concern
    public readonly dbTransactionId: string,   // ❌ DB concern
    public readonly kafkaPartition: number,    // ❌ Messaging concern
  ) {}
}

// ✅ FIX: Domain event contains only domain data
class OrderCreatedEvent implements DomainEvent {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}
```

### Violation 8: Repository Returns ORM Entities

```typescript
// ❌ VIOLATION: Repository returns ORM entity to use case
class TypeOrmOrderRepository implements OrderRepository {
  async findById(id: string): Promise<OrderOrmEntity | null> {  // ❌ Returns ORM entity
    return this.ormRepo.findOne({ where: { id } });
  }
}

// ✅ FIX: Repository returns domain entity
class TypeOrmOrderRepository implements OrderRepository {
  async findById(id: OrderId): Promise<Order | null> {  // ✅ Returns domain entity
    const ormEntity = await this.ormRepo.findOne({
      where: { id: id.value },
      relations: ['items'],
    });
    return ormEntity ? OrderMapper.toDomain(ormEntity) : null;
  }
}
```

### Violation 9: Shared Models Across Layers

```typescript
// ❌ VIOLATION: Same model used everywhere
class OrderDto {
  id: string;
  customerId: string;
  items: OrderItemDto[];
  status: string;
  total: number;
}
// Used as: HTTP request body, use case input, use case output, HTTP response

// ✅ FIX: Separate models per boundary
// HTTP layer
class CreateOrderRequest { customerId: string; items: OrderItemInput[]; }
class OrderResponse { id: string; total: number; status: string; links: HateoasLinks; }

// Application layer
interface CreateOrderInput { customerId: string; items: { productId: string; quantity: number }[]; }
interface CreateOrderOutput { orderId: string; totalAmount: number; currency: string; status: string; }

// Domain layer
class Order { /* Rich domain model with behavior */ }

// Persistence layer
class OrderOrmEntity { /* Database mapping model */ }
```

### Violation 10: Circular Dependencies Between Layers

```typescript
// ❌ VIOLATION: Entity imports from use case layer
// domain/entities/order.ts
import { OrderNotificationService } from '../../application/services/order-notification';

class Order {
  async submit(): Promise<void> {
    this.status = OrderStatus.SUBMITTED;
    await OrderNotificationService.notify(this);  // ❌ Entity calls application layer
  }
}

// ✅ FIX: Entity raises event, application layer handles it
// domain/entities/order.ts
class Order {
  submit(): void {
    this.status = OrderStatus.SUBMITTED;
    this.addDomainEvent(new OrderSubmittedEvent(this.id, this.totalAmount));
  }
}

// application/event-handlers/order-submitted.handler.ts
class OrderSubmittedHandler implements EventHandler<OrderSubmittedEvent> {
  constructor(private readonly notifications: NotificationService) {}

  async handle(event: OrderSubmittedEvent): Promise<void> {
    await this.notifications.notifyOrderSubmitted(event.orderId);
  }
}
```

### Violation 11: Test Mocking Infrastructure Instead of Ports

```typescript
// ❌ VIOLATION: Test mocks specific infrastructure
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn().mockResolvedValue({ rows: [mockOrder] })
  }))
}));

// ✅ FIX: Test mocks the port interface
const orderRepo: jest.Mocked<OrderRepository> = {
  save: jest.fn(),
  findById: jest.fn().mockResolvedValue(mockOrder),
  nextId: jest.fn().mockReturnValue(OrderId.from('test-id')),
};
const useCase = new CreateOrderUseCase(orderRepo);
```

### Violation 12: Configuration Leaking into Domain

```typescript
// ❌ VIOLATION: Domain reads environment variables
class PricingService {
  calculateDiscount(order: Order): Money {
    const maxDiscount = parseFloat(process.env.MAX_DISCOUNT_PERCENT!); // ❌
    const taxRate = parseFloat(process.env.TAX_RATE!);                  // ❌
  }
}

// ✅ FIX: Configuration injected through constructor
class PricingService {
  constructor(private readonly config: PricingConfig) {}

  calculateDiscount(order: Order): Money {
    // PricingConfig is a domain type, populated from infra
  }
}

interface PricingConfig {
  maxDiscountPercent: Percentage;
  taxRate: Percentage;
  freeShippingThreshold: Money;
}
```

---

## 6. Enforcement Strategies

### 6.1 Project Structure That Prevents Violations

```
# Monorepo with separate packages — physically impossible to import wrong
packages/
├── domain/                    # Package: @app/domain
│   ├── package.json           # dependencies: {} (NOTHING)
│   └── src/
│       ├── entities/
│       ├── value-objects/
│       └── events/
├── application/               # Package: @app/application
│   ├── package.json           # dependencies: { "@app/domain": "*" } (domain ONLY)
│   └── src/
│       ├── use-cases/
│       └── ports/
├── infrastructure/            # Package: @app/infrastructure
│   ├── package.json           # dependencies: { "@app/domain": "*", "@app/application": "*", "typeorm": "*" }
│   └── src/
│       ├── persistence/
│       ├── http/
│       └── messaging/
└── main/                      # Package: @app/main
    ├── package.json           # dependencies: ALL packages
    └── src/
        └── composition-root.ts
```

### 6.2 ESLint Boundaries Configuration

```javascript
// .eslintrc.js
module.exports = {
  plugins: ['boundaries'],
  settings: {
    'boundaries/elements': [
      { type: 'domain', pattern: 'src/domain/*' },
      { type: 'application', pattern: 'src/application/*' },
      { type: 'infrastructure', pattern: 'src/infrastructure/*' },
    ],
  },
  rules: {
    'boundaries/element-types': [2, {
      default: 'disallow',
      rules: [
        // Domain can only import from domain
        { from: 'domain', allow: ['domain'] },
        // Application can import from domain and application
        { from: 'application', allow: ['domain', 'application'] },
        // Infrastructure can import from all
        { from: 'infrastructure', allow: ['domain', 'application', 'infrastructure'] },
      ],
    }],
  },
};
```

### 6.3 Architecture Tests

```typescript
// TypeScript with ts-arch
import { projectFiles } from 'ts-arch';

describe('Architecture Rules', () => {
  it('domain should not depend on application', async () => {
    const rule = projectFiles()
      .inFolder('domain')
      .shouldNot()
      .dependOnFiles()
      .inFolder('application');
    await expect(rule).toPassAsync();
  });

  it('domain should not depend on infrastructure', async () => {
    const rule = projectFiles()
      .inFolder('domain')
      .shouldNot()
      .dependOnFiles()
      .inFolder('infrastructure');
    await expect(rule).toPassAsync();
  });

  it('application should not depend on infrastructure', async () => {
    const rule = projectFiles()
      .inFolder('application')
      .shouldNot()
      .dependOnFiles()
      .inFolder('infrastructure');
    await expect(rule).toPassAsync();
  });
});
```

```python
# Python with import-linter
# .importlinter configuration
[importlinter]
root_packages = app

[importlinter:contract:layers]
name = Clean architecture layers
type = layers
layers =
    app.infrastructure
    app.application
    app.domain
```

```csharp
// C# with NetArchTest
[Fact]
public void Domain_Should_Not_Depend_On_Application()
{
    var result = Types.InAssembly(typeof(Order).Assembly)
        .ShouldNot()
        .HaveDependencyOn("Application")
        .GetResult();
    Assert.True(result.IsSuccessful);
}

[Fact]
public void Domain_Should_Not_Depend_On_Infrastructure()
{
    var result = Types.InAssembly(typeof(Order).Assembly)
        .ShouldNot()
        .HaveDependencyOn("Infrastructure")
        .GetResult();
    Assert.True(result.IsSuccessful);
}

[Fact]
public void Application_Should_Not_Depend_On_Infrastructure()
{
    var result = Types.InAssembly(typeof(CreateOrderUseCase).Assembly)
        .ShouldNot()
        .HaveDependencyOn("Infrastructure")
        .GetResult();
    Assert.True(result.IsSuccessful);
}
```

### 6.4 CI/CD Pipeline Integration

```yaml
# .github/workflows/architecture.yml
name: Architecture Validation
on: [push, pull_request]

jobs:
  architecture-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Run architecture tests
        run: npm run test:architecture

      - name: Check import boundaries
        run: npx eslint --rule 'boundaries/element-types: error' src/

      - name: Verify domain has no external deps
        run: |
          # Fail if domain/ imports from infrastructure/ or application/
          if grep -r "from.*infrastructure" src/domain/ || \
             grep -r "from.*application" src/domain/; then
            echo "❌ Domain layer has forbidden imports!"
            exit 1
          fi
```

### 6.5 Code Review Checklist

| Check | Question |
|-------|----------|
| **Imports** | Does any domain file import from infrastructure or application? |
| **Framework leakage** | Are there framework decorators (@Injectable, @Entity) in domain? |
| **ORM in domain** | Are ORM entities used as domain entities? |
| **Direct infra calls** | Does any use case directly call a database, HTTP client, or external service? |
| **Business logic placement** | Is there business logic in a controller, repository, or middleware? |
| **Boundary models** | Are request DTOs, domain entities, and response DTOs separate types? |
| **Port interface** | Does every external dependency have a corresponding port interface? |
| **Configuration** | Does domain code read environment variables or config files directly? |
| **Test independence** | Can domain and use case tests run without any infrastructure? |

---

## 7. Flow of Control vs Dependency Direction

### The Key Insight

**The flow of control goes OUTWARD → INWARD → OUTWARD at runtime, but source code dependencies ALWAYS point INWARD. Interfaces make this possible.**

### Visual Diagram

```
RUNTIME FLOW (how data moves):
HTTP Request → Controller → Use Case → Entity → Repository → Database
                                                    ↑
                                                 (returns)
Database → Repository → Entity → Use Case → Presenter → HTTP Response

DEPENDENCY DIRECTION (how code is organized):
Controller ──depends on──▶ Use Case Interface
                          Use Case ──depends on──▶ Entity
                          Use Case ──depends on──▶ Repository Interface
Repository Implementation ──depends on──▶ Repository Interface
                                          (defined in USE CASE layer)
```

### How It Works In Code

```typescript
// STEP 1: Controller calls Use Case (flow goes inward)
// The controller DEPENDS ON the use case interface — dependency points inward ✅
class OrderController {
  constructor(private readonly createOrder: CreateOrderUseCase) {} // Depends on inner layer
  async handle(req: Request): Promise<Response> {
    const output = await this.createOrder.execute(input); // Flow goes inward
    return this.formatResponse(output);                    // Flow goes outward
  }
}

// STEP 2: Use Case calls Repository (flow goes outward, but dependency is inverted)
// The use case defines the interface — dependency points inward ✅
// But at runtime, the flow goes outward to the database
class CreateOrderHandler implements CreateOrderUseCase {
  constructor(private readonly orderRepo: OrderRepository) {} // Depends on interface (same layer)

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const order = Order.create(this.orderRepo.nextId(), input.customerId);
    await this.orderRepo.save(order);  // Runtime: flow goes outward to DB
    return { orderId: order.id.value }; // Runtime: flow returns inward
  }
}

// STEP 3: Repository implements the interface (outer layer depends on inner layer's interface)
// TypeOrmOrderRepository DEPENDS ON OrderRepository interface — dependency points inward ✅
class TypeOrmOrderRepository implements OrderRepository {
  // This class lives in infrastructure but IMPLEMENTS an interface from application layer
  // Dependency: Infrastructure → Application (inward) ✅
  async save(order: Order): Promise<void> {
    // Runtime: actually talks to the database (outward)
  }
}

// At runtime: Controller → UseCase → Repository → Database → Repository → UseCase → Controller
// Dependencies: Controller → UseCase ← Repository (UseCase doesn't know about Repository impl)
```

### Decision Tree: Where Does This Code Belong?

```
Does it contain business rules?
├── YES → Does it apply to ALL applications using this entity?
│   ├── YES → ENTITIES layer
│   └── NO → USE CASES layer (application-specific rules)
└── NO → Does it convert data between formats?
    ├── YES → INTERFACE ADAPTERS layer
    └── NO → Does it interact with external systems?
        ├── YES → FRAMEWORKS & DRIVERS layer
        └── NO → Re-evaluate: is this code necessary?
```

### Violation Detection Quick Reference

| Symptom | Likely Violation | Layer to Check |
|---------|-----------------|----------------|
| Cannot test without database | Use case depends on concrete repository | Use case imports |
| Framework upgrade breaks business logic | Domain depends on framework | Entity imports |
| Adding a feature requires touching 5+ files across layers | Missing abstraction or wrong layer assignment | Architecture review |
| Two teams stepping on each other's code | Module boundaries not aligned with team boundaries | Module structure |
| Cannot add new delivery mechanism (CLI, GraphQL) without changing logic | Business logic is in controller | Controller code |
| Database migration breaks domain tests | Domain entities are ORM entities | Entity class definition |
