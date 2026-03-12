# Clean Architecture: Web Implementation — Complete Guide

> **AI Plugin Directive:** When building ANY web application, follow these exact patterns. This covers both backend APIs and frontend SPAs. Every code example is production-ready and follows enterprise best practices.

---

## 1. Project Structure for Web Applications

### NestJS (TypeScript) — Backend

```
src/
├── modules/
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
│   │   │   │   └── order-status.ts
│   │   │   ├── events/
│   │   │   │   └── order.events.ts
│   │   │   ├── errors/
│   │   │   │   └── order.errors.ts
│   │   │   └── ports/
│   │   │       └── order.repository.ts
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   ├── create-order.handler.ts
│   │   │   │   ├── submit-order.handler.ts
│   │   │   │   └── cancel-order.handler.ts
│   │   │   ├── queries/
│   │   │   │   ├── get-order.handler.ts
│   │   │   │   └── list-orders.handler.ts
│   │   │   └── ports/
│   │   │       ├── payment.gateway.ts
│   │   │       └── event-bus.ts
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   │   ├── order.orm-entity.ts
│   │   │   │   ├── order.mapper.ts
│   │   │   │   ├── typeorm-order.repository.ts
│   │   │   │   └── migrations/
│   │   │   ├── http/
│   │   │   │   ├── order.controller.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-order.request.ts
│   │   │   │   │   ├── update-order.request.ts
│   │   │   │   │   └── order.response.ts
│   │   │   │   └── filters/
│   │   │   │       └── order-exception.filter.ts
│   │   │   └── payment/
│   │   │       └── stripe-payment.gateway.ts
│   │   └── ordering.module.ts                # NestJS module wiring
│   ├── catalog/
│   ├── customer/
│   └── shared/
├── shared/
│   ├── domain/
│   │   ├── aggregate-root.ts
│   │   ├── entity.ts
│   │   ├── value-object.ts
│   │   └── domain-event.ts
│   └── infrastructure/
│       ├── filters/
│       │   └── global-exception.filter.ts
│       ├── interceptors/
│       │   ├── logging.interceptor.ts
│       │   └── transform.interceptor.ts
│       ├── guards/
│       │   ├── auth.guard.ts
│       │   └── roles.guard.ts
│       └── pipes/
│           └── validation.pipe.ts
├── config/
│   ├── database.config.ts
│   ├── app.config.ts
│   └── auth.config.ts
├── app.module.ts
└── main.ts
```

### FastAPI (Python) — Backend

```
src/
├── modules/
│   ├── ordering/
│   │   ├── __init__.py
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   ├── order.py
│   │   │   │   └── order_item.py
│   │   │   ├── value_objects/
│   │   │   │   ├── money.py
│   │   │   │   └── order_status.py
│   │   │   ├── events/
│   │   │   │   └── order_events.py
│   │   │   ├── errors/
│   │   │   │   └── order_errors.py
│   │   │   └── ports/
│   │   │       └── order_repository.py
│   │   ├── application/
│   │   │   ├── commands/
│   │   │   │   ├── create_order.py
│   │   │   │   └── submit_order.py
│   │   │   ├── queries/
│   │   │   │   └── get_order.py
│   │   │   └── ports/
│   │   │       ├── payment_gateway.py
│   │   │       └── event_bus.py
│   │   └── infrastructure/
│   │       ├── persistence/
│   │       │   ├── models.py
│   │       │   ├── mappers.py
│   │       │   └── sqlalchemy_order_repo.py
│   │       ├── http/
│   │       │   ├── order_router.py
│   │       │   ├── schemas.py
│   │       │   └── error_handlers.py
│   │       └── payment/
│   │           └── stripe_gateway.py
│   ├── catalog/
│   └── customer/
├── shared/
│   ├── domain/
│   └── infrastructure/
├── config/
│   └── settings.py
└── main.py
```

### ASP.NET Core (C#) — Backend

```
Solution/
├── src/
│   ├── Ordering.Domain/
│   │   ├── Ordering.Domain.csproj      # Zero dependencies
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   ├── Errors/
│   │   └── Ports/
│   ├── Ordering.Application/
│   │   ├── Ordering.Application.csproj  # Depends on Domain only
│   │   ├── Commands/
│   │   ├── Queries/
│   │   ├── Ports/
│   │   └── DTOs/
│   ├── Ordering.Infrastructure/
│   │   ├── Ordering.Infrastructure.csproj # Depends on Domain + Application
│   │   ├── Persistence/
│   │   ├── Payment/
│   │   └── Messaging/
│   └── WebApi/
│       ├── WebApi.csproj                 # Depends on all
│       ├── Controllers/
│       ├── DTOs/
│       ├── Middleware/
│       └── Program.cs
└── tests/
```

---

## 2. API Layer (Controllers/Routes)

### Controller Responsibilities

**Controllers do EXACTLY three things:**
1. **Parse** the incoming request (extract data from body, params, headers)
2. **Call** the appropriate use case with a plain input DTO
3. **Format** the use case output into an HTTP response

**Controllers NEVER contain business logic, database calls, or complex data transformations.**

### Complete NestJS Controller

```typescript
// infrastructure/http/order.controller.ts
@Controller('api/v1/orders')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor)
export class OrderController {
  constructor(
    private readonly createOrder: CreateOrderHandler,
    private readonly submitOrder: SubmitOrderHandler,
    private readonly cancelOrder: CancelOrderHandler,
    private readonly getOrder: GetOrderHandler,
    private readonly listOrders: ListOrdersHandler,
  ) {}

  @Post()
  @HttpCode(201)
  async create(
    @Body(new ValidationPipe()) body: CreateOrderRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<OrderResponseDto>> {
    const result = await this.createOrder.execute({
      customerId: user.id,
      items: body.items.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    });

    return {
      data: OrderResponseDto.from(result),
      links: {
        self: `/api/v1/orders/${result.orderId}`,
        submit: `/api/v1/orders/${result.orderId}/submit`,
      },
    };
  }

  @Post(':id/submit')
  async submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<OrderResponseDto>> {
    const result = await this.submitOrder.execute({
      orderId: id,
      submittedBy: user.id,
    });
    return { data: OrderResponseDto.from(result) };
  }

  @Delete(':id')
  @HttpCode(204)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelOrderRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.cancelOrder.execute({
      orderId: id,
      cancelledBy: user.id,
      reason: body.reason,
    });
  }

  @Get(':id')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiResponse<OrderDetailResponseDto>> {
    const result = await this.getOrder.execute({
      orderId: id,
      requestedBy: user.id,
    });
    return { data: OrderDetailResponseDto.from(result) };
  }

  @Get()
  async list(
    @Query() query: ListOrdersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResponse<OrderResponseDto>> {
    const result = await this.listOrders.execute({
      customerId: user.id,
      status: query.status,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      sortBy: query.sortBy ?? 'createdAt',
      sortDirection: query.sortDirection ?? 'desc',
    });

    return {
      data: result.items.map(OrderResponseDto.from),
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }
}
```

### FastAPI Router

```python
# infrastructure/http/order_router.py
router = APIRouter(prefix="/api/v1/orders", tags=["orders"])

@router.post("", status_code=201, response_model=ApiResponse[OrderResponse])
async def create_order(
    body: CreateOrderRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    create_order_handler: CreateOrderHandler = Depends(get_create_order_handler),
):
    result = await create_order_handler.execute(
        CreateOrderInput(
            customer_id=user.id,
            items=[
                OrderItemInput(product_id=item.product_id, quantity=item.quantity)
                for item in body.items
            ],
        )
    )
    return ApiResponse(
        data=OrderResponse.from_result(result),
        links={"self": f"/api/v1/orders/{result.order_id}"},
    )

@router.post("/{order_id}/submit", response_model=ApiResponse[OrderResponse])
async def submit_order(
    order_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    submit_order_handler: SubmitOrderHandler = Depends(get_submit_order_handler),
):
    result = await submit_order_handler.execute(
        SubmitOrderInput(order_id=str(order_id), submitted_by=user.id)
    )
    return ApiResponse(data=OrderResponse.from_result(result))

@router.get("", response_model=PaginatedResponse[OrderResponse])
async def list_orders(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None),
    user: AuthenticatedUser = Depends(get_current_user),
    list_orders_handler: ListOrdersHandler = Depends(get_list_orders_handler),
):
    result = await list_orders_handler.execute(
        ListOrdersInput(
            customer_id=user.id,
            status=status,
            page=page,
            limit=limit,
        )
    )
    return PaginatedResponse(
        data=[OrderResponse.from_result(item) for item in result.items],
        pagination=Pagination(
            total=result.total,
            page=result.page,
            limit=result.limit,
            total_pages=math.ceil(result.total / result.limit),
        ),
    )
```

### Request Validation

**Rule: Validate FORMAT at the controller/API level. Validate BUSINESS RULES in the domain layer.**

```typescript
// infrastructure/http/dto/create-order.request.ts
// HTTP-level validation (format only)
export class CreateOrderRequestDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one item is required' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemRequestDto)
  items: OrderItemRequestDto[];
}

export class OrderItemRequestDto {
  @IsUUID(4, { message: 'Product ID must be a valid UUID' })
  productId: string;

  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(9999, { message: 'Quantity cannot exceed 9999' })
  quantity: number;
}

// Domain-level validation (business rules) — in entity
class Order {
  addItem(product: Product, quantity: Quantity): void {
    // Business rule: max 50 items per order
    if (this.items.length >= 50) {
      throw new MaxItemsExceededError(this.id, 50);
    }
    // Business rule: can only add items to draft orders
    if (this.status !== OrderStatus.DRAFT) {
      throw new OrderNotModifiableError(this.id);
    }
  }
}
```

### Global Error Handling

```typescript
// shared/infrastructure/filters/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.mapToResponse(exception);

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${errorResponse.statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(errorResponse.statusCode).json({
      error: {
        code: errorResponse.code,
        message: errorResponse.message,
        ...(errorResponse.details && { details: errorResponse.details }),
      },
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.headers['x-request-id'],
    });
  }

  private mapToResponse(exception: unknown): ErrorResponse {
    // Domain errors → 4xx
    if (exception instanceof OrderNotFoundError) {
      return { statusCode: 404, code: 'ORDER_NOT_FOUND', message: exception.message };
    }
    if (exception instanceof EmptyOrderError) {
      return { statusCode: 400, code: 'ORDER_EMPTY', message: exception.message };
    }
    if (exception instanceof OrderNotModifiableError) {
      return { statusCode: 409, code: 'ORDER_NOT_MODIFIABLE', message: exception.message };
    }
    if (exception instanceof InvalidQuantityError) {
      return { statusCode: 400, code: 'INVALID_QUANTITY', message: exception.message };
    }
    if (exception instanceof UnauthorizedAccessError) {
      return { statusCode: 403, code: 'FORBIDDEN', message: exception.message };
    }
    if (exception instanceof PaymentFailedError) {
      return { statusCode: 422, code: 'PAYMENT_FAILED', message: exception.message };
    }

    // Framework errors
    if (exception instanceof BadRequestException) {
      return { statusCode: 400, code: 'BAD_REQUEST', message: exception.message };
    }
    if (exception instanceof UnauthorizedException) {
      return { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required' };
    }

    // Unknown errors → 500
    return {
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
  }
}
```

### API Versioning

```typescript
// Strategy 1: URL-based versioning (recommended for public APIs)
@Controller('api/v1/orders')
export class OrderV1Controller { /* ... */ }

@Controller('api/v2/orders')
export class OrderV2Controller { /* ... */ }

// Strategy 2: Header-based versioning (for internal APIs)
@Controller('api/orders')
@Version('1')
export class OrderV1Controller { /* ... */ }

// Rule: NEVER break existing API versions. Add new versions for breaking changes.
// Use cases remain the same — only controllers and DTOs change between versions.
```

---

## 3. Use Case Layer for Web

### Handling Pagination in Use Cases

```typescript
// application/queries/list-orders/list-orders.handler.ts
export interface ListOrdersInput {
  readonly customerId: string;
  readonly status?: string;
  readonly page: number;
  readonly limit: number;
  readonly sortBy: string;
  readonly sortDirection: 'asc' | 'desc';
}

export interface ListOrdersOutput {
  readonly items: OrderSummary[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
}

export class ListOrdersHandler {
  constructor(private readonly orderRepo: OrderRepository) {}

  async execute(input: ListOrdersInput): Promise<ListOrdersOutput> {
    const pagination: Pagination = {
      offset: (input.page - 1) * input.limit,
      limit: Math.min(input.limit, 100), // Enforce max limit
      sortBy: this.validateSortField(input.sortBy),
      sortDirection: input.sortDirection,
    };

    const filters: OrderFilters = {
      customerId: CustomerId.from(input.customerId),
      ...(input.status && { status: OrderStatus.from(input.status) }),
    };

    const result = await this.orderRepo.findByFilters(filters, pagination);

    return {
      items: result.items.map(order => ({
        orderId: order.id.value,
        status: order.status.value,
        totalAmount: order.totalAmount.amount,
        currency: order.totalAmount.currency.code,
        itemCount: order.itemCount,
        createdAt: order.createdAt.toISOString(),
      })),
      total: result.total,
      page: input.page,
      limit: input.limit,
    };
  }

  private validateSortField(field: string): string {
    const allowed = ['createdAt', 'totalAmount', 'status'];
    if (!allowed.includes(field)) throw new InvalidSortFieldError(field, allowed);
    return field;
  }
}
```

### File Upload Use Case

```typescript
// application/commands/upload-product-image/upload-product-image.handler.ts
export interface UploadProductImageInput {
  readonly productId: string;
  readonly file: {
    readonly buffer: Buffer;
    readonly mimeType: string;
    readonly originalName: string;
    readonly sizeBytes: number;
  };
  readonly uploadedBy: string;
}

export class UploadProductImageHandler {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly fileStorage: FileStorage,
    private readonly imageProcessor: ImageProcessor,
  ) {}

  async execute(input: UploadProductImageInput): Promise<UploadImageOutput> {
    // 1. Validate
    const product = await this.productRepo.findById(ProductId.from(input.productId));
    if (!product) throw new ProductNotFoundError(input.productId);

    this.validateFile(input.file);

    // 2. Process image (resize, optimize)
    const processed = await this.imageProcessor.process(input.file.buffer, {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 85,
      format: 'webp',
    });

    // 3. Generate thumbnail
    const thumbnail = await this.imageProcessor.process(input.file.buffer, {
      maxWidth: 300,
      maxHeight: 300,
      quality: 80,
      format: 'webp',
    });

    // 4. Upload to storage
    const basePath = `products/${input.productId}`;
    const [mainImage, thumbImage] = await Promise.all([
      this.fileStorage.upload(
        FileData.from(processed, 'image/webp'),
        StoragePath.from(`${basePath}/main.webp`)
      ),
      this.fileStorage.upload(
        FileData.from(thumbnail, 'image/webp'),
        StoragePath.from(`${basePath}/thumb.webp`)
      ),
    ]);

    // 5. Update product
    product.setImage(mainImage.url, thumbImage.url);
    await this.productRepo.save(product);

    return {
      productId: product.id.value,
      imageUrl: mainImage.url,
      thumbnailUrl: thumbImage.url,
    };
  }

  private validateFile(file: UploadProductImageInput['file']): void {
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (file.sizeBytes > maxSizeBytes) throw new FileTooLargeError(file.sizeBytes, maxSizeBytes);
    if (!allowedTypes.includes(file.mimeType)) throw new InvalidFileTypeError(file.mimeType, allowedTypes);
  }
}
```

### Transaction Management

```typescript
// application/ports/unit-of-work.ts
export interface UnitOfWork {
  execute<T>(work: (uow: UnitOfWorkContext) => Promise<T>): Promise<T>;
}

export interface UnitOfWorkContext {
  readonly orderRepo: OrderRepository;
  readonly productRepo: ProductRepository;
  readonly paymentRepo: PaymentRepository;
}

// Usage in use case
export class PlaceOrderHandler {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: PlaceOrderInput): Promise<PlaceOrderOutput> {
    const result = await this.unitOfWork.execute(async (uow) => {
      const order = await uow.orderRepo.findById(OrderId.from(input.orderId));
      if (!order) throw new OrderNotFoundError(input.orderId);

      // Decrease stock
      for (const item of order.items) {
        const product = await uow.productRepo.findById(item.productId);
        if (!product) throw new ProductNotFoundError(item.productId.value);
        product.decreaseStock(item.quantity);
        await uow.productRepo.save(product);
      }

      // Submit order
      order.submit();
      await uow.orderRepo.save(order);

      return order;
    });
    // Transaction committed — now publish events
    await this.eventBus.publishAll(result.domainEvents);

    return { orderId: result.id.value, status: result.status.value };
  }
}

// infrastructure/persistence/typeorm-unit-of-work.ts
export class TypeOrmUnitOfWork implements UnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T>(work: (uow: UnitOfWorkContext) => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const context: UnitOfWorkContext = {
        orderRepo: new TypeOrmOrderRepository(queryRunner.manager),
        productRepo: new TypeOrmProductRepository(queryRunner.manager),
        paymentRepo: new TypeOrmPaymentRepository(queryRunner.manager),
      };

      const result = await work(context);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

---

## 4. Database Integration

### Repository Pattern with TypeORM

```typescript
// infrastructure/persistence/typeorm-order.repository.ts
export class TypeOrmOrderRepository implements OrderRepository {
  constructor(private readonly manager: EntityManager) {}

  async save(order: Order): Promise<void> {
    const ormEntity = OrderMapper.toPersistence(order);
    await this.manager.save(OrderOrmEntity, ormEntity);
  }

  async findById(id: OrderId): Promise<Order | null> {
    const orm = await this.manager.findOne(OrderOrmEntity, {
      where: { id: id.value },
      relations: { items: true },
    });
    return orm ? OrderMapper.toDomain(orm) : null;
  }

  async findByFilters(
    filters: OrderFilters,
    pagination: Pagination
  ): Promise<PaginatedResult<Order>> {
    const qb = this.manager.createQueryBuilder(OrderOrmEntity, 'order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.customer_id = :customerId', { customerId: filters.customerId.value });

    if (filters.status) {
      qb.andWhere('order.status = :status', { status: filters.status.value });
    }
    if (filters.dateFrom) {
      qb.andWhere('order.created_at >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('order.created_at <= :dateTo', { dateTo: filters.dateTo });
    }

    qb.orderBy(`order.${pagination.sortBy}`, pagination.sortDirection.toUpperCase() as 'ASC' | 'DESC')
      .skip(pagination.offset)
      .take(pagination.limit);

    const [ormEntities, total] = await qb.getManyAndCount();

    return {
      items: ormEntities.map(OrderMapper.toDomain),
      total,
      offset: pagination.offset,
      limit: pagination.limit,
    };
  }

  nextId(): OrderId {
    return OrderId.generate();
  }
}
```

### Repository Pattern with Prisma

```typescript
// infrastructure/persistence/prisma-order.repository.ts
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(order: Order): Promise<void> {
    const data = OrderMapper.toPrisma(order);
    await this.prisma.order.upsert({
      where: { id: data.id },
      create: {
        ...data,
        items: { create: data.items },
      },
      update: {
        ...data,
        items: {
          deleteMany: {},
          create: data.items,
        },
      },
    });
  }

  async findById(id: OrderId): Promise<Order | null> {
    const record = await this.prisma.order.findUnique({
      where: { id: id.value },
      include: { items: true },
    });
    return record ? OrderMapper.fromPrisma(record) : null;
  }

  async findByFilters(
    filters: OrderFilters,
    pagination: Pagination
  ): Promise<PaginatedResult<Order>> {
    const where: Prisma.OrderWhereInput = {
      customer_id: filters.customerId.value,
      ...(filters.status && { status: filters.status.value }),
      ...(filters.dateFrom && { created_at: { gte: filters.dateFrom } }),
      ...(filters.dateTo && { created_at: { lte: filters.dateTo } }),
    };

    const [records, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { [pagination.sortBy]: pagination.sortDirection },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: records.map(OrderMapper.fromPrisma),
      total,
      offset: pagination.offset,
      limit: pagination.limit,
    };
  }
}
```

### Repository Pattern with SQLAlchemy (Python)

```python
# infrastructure/persistence/sqlalchemy_order_repository.py
class SqlAlchemyOrderRepository(OrderRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, order: Order) -> None:
        existing = await self._session.get(OrderModel, str(order.id))
        if existing:
            model = OrderMapper.update_model(existing, order)
        else:
            model = OrderMapper.to_model(order)
            self._session.add(model)
        await self._session.flush()

    async def find_by_id(self, id: OrderId) -> Order | None:
        stmt = (
            select(OrderModel)
            .options(selectinload(OrderModel.items))
            .where(OrderModel.id == str(id))
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return OrderMapper.to_domain(model) if model else None

    async def find_by_filters(
        self, filters: OrderFilters, pagination: Pagination
    ) -> PaginatedResult[Order]:
        stmt = (
            select(OrderModel)
            .options(selectinload(OrderModel.items))
            .where(OrderModel.customer_id == str(filters.customer_id))
        )

        if filters.status:
            stmt = stmt.where(OrderModel.status == filters.status.value)
        if filters.date_from:
            stmt = stmt.where(OrderModel.created_at >= filters.date_from)
        if filters.date_to:
            stmt = stmt.where(OrderModel.created_at <= filters.date_to)

        # Count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = (await self._session.execute(count_stmt)).scalar_one()

        # Paginate
        sort_column = getattr(OrderModel, pagination.sort_by)
        direction = asc if pagination.sort_direction == "asc" else desc
        stmt = stmt.order_by(direction(sort_column))
        stmt = stmt.offset(pagination.offset).limit(pagination.limit)

        result = await self._session.execute(stmt)
        models = result.scalars().all()

        return PaginatedResult(
            items=[OrderMapper.to_domain(m) for m in models],
            total=total,
            offset=pagination.offset,
            limit=pagination.limit,
        )
```

---

## 5. Frontend Clean Architecture (SPA)

### React/Next.js Project Structure

```
src/
├── features/                              # Feature-based organization
│   ├── ordering/
│   │   ├── domain/
│   │   │   ├── types/
│   │   │   │   ├── order.ts               # Domain types (no React)
│   │   │   │   └── order-status.ts
│   │   │   └── validation/
│   │   │       └── order.validation.ts     # Business validation rules
│   │   ├── application/
│   │   │   ├── hooks/
│   │   │   │   ├── useCreateOrder.ts       # Use case as hook
│   │   │   │   ├── useOrders.ts
│   │   │   │   └── useOrderDetail.ts
│   │   │   └── services/
│   │   │       └── order.service.ts        # API client abstraction
│   │   ├── infrastructure/
│   │   │   └── api/
│   │   │       └── order.api.ts            # Actual HTTP calls
│   │   └── presentation/
│   │       ├── components/
│   │       │   ├── OrderList.tsx
│   │       │   ├── OrderForm.tsx
│   │       │   ├── OrderDetail.tsx
│   │       │   └── OrderStatusBadge.tsx
│   │       ├── pages/
│   │       │   ├── OrdersPage.tsx
│   │       │   └── OrderDetailPage.tsx
│   │       └── hooks/
│   │           └── useOrderForm.ts         # UI-specific hook
│   ├── catalog/
│   │   ├── domain/
│   │   ├── application/
│   │   ├── infrastructure/
│   │   └── presentation/
│   └── auth/
│       ├── domain/
│       ├── application/
│       ├── infrastructure/
│       └── presentation/
├── shared/
│   ├── domain/
│   │   └── types/
│   │       ├── pagination.ts
│   │       ├── api-response.ts
│   │       └── money.ts
│   ├── infrastructure/
│   │   ├── api/
│   │   │   ├── http-client.ts             # Axios/fetch wrapper
│   │   │   └── interceptors.ts
│   │   └── storage/
│   │       └── local-storage.ts
│   └── presentation/
│       ├── components/
│       │   ├── Button.tsx
│       │   ├── Input.tsx
│       │   ├── Modal.tsx
│       │   └── DataTable.tsx
│       ├── hooks/
│       │   ├── usePagination.ts
│       │   └── useDebounce.ts
│       └── layouts/
│           └── MainLayout.tsx
├── config/
│   └── env.ts
└── app/                                   # Next.js App Router pages
    ├── layout.tsx
    ├── orders/
    │   ├── page.tsx
    │   └── [id]/
    │       └── page.tsx
    └── providers.tsx
```

### API Client Abstraction

```typescript
// features/ordering/application/services/order.service.ts
// This is the PORT — defines what the feature needs
export interface OrderService {
  create(input: CreateOrderInput): Promise<OrderResult>;
  submit(orderId: string): Promise<OrderResult>;
  cancel(orderId: string, reason: string): Promise<void>;
  getById(orderId: string): Promise<OrderDetail>;
  list(params: ListOrdersParams): Promise<PaginatedResult<OrderSummary>>;
}

// features/ordering/infrastructure/api/order.api.ts
// This is the ADAPTER — implements the port using HTTP
export class HttpOrderService implements OrderService {
  constructor(private readonly http: HttpClient) {}

  async create(input: CreateOrderInput): Promise<OrderResult> {
    const response = await this.http.post<ApiResponse<OrderResult>>('/api/v1/orders', {
      items: input.items,
    });
    return response.data.data;
  }

  async submit(orderId: string): Promise<OrderResult> {
    const response = await this.http.post<ApiResponse<OrderResult>>(
      `/api/v1/orders/${orderId}/submit`
    );
    return response.data.data;
  }

  async list(params: ListOrdersParams): Promise<PaginatedResult<OrderSummary>> {
    const response = await this.http.get<PaginatedApiResponse<OrderSummary>>(
      '/api/v1/orders',
      { params }
    );
    return {
      items: response.data.data,
      ...response.data.pagination,
    };
  }
}
```

### Use Case as React Hook

```typescript
// features/ordering/application/hooks/useCreateOrder.ts
export function useCreateOrder() {
  const orderService = useOrderService(); // DI via context
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOrderInput) => orderService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// features/ordering/application/hooks/useOrders.ts
export function useOrders(params: ListOrdersParams) {
  const orderService = useOrderService();

  return useQuery({
    queryKey: ['orders', params],
    queryFn: () => orderService.list(params),
    staleTime: 30_000,
  });
}

// features/ordering/application/hooks/useOrderDetail.ts
export function useOrderDetail(orderId: string) {
  const orderService = useOrderService();

  return useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => orderService.getById(orderId),
    enabled: !!orderId,
  });
}

// Dependency injection via React Context
const OrderServiceContext = createContext<OrderService | null>(null);

export function OrderServiceProvider({ children }: { children: React.ReactNode }) {
  const httpClient = useHttpClient();
  const service = useMemo(() => new HttpOrderService(httpClient), [httpClient]);

  return (
    <OrderServiceContext.Provider value={service}>
      {children}
    </OrderServiceContext.Provider>
  );
}

export function useOrderService(): OrderService {
  const service = useContext(OrderServiceContext);
  if (!service) throw new Error('OrderServiceProvider not found');
  return service;
}
```

### Frontend State Management

```typescript
// Rule: UI state and domain state are SEPARATE concerns

// Domain state (server data) — managed by React Query/SWR
// This is the "single source of truth" from the server
const { data: orders, isLoading, error } = useOrders({ page: 1, limit: 20 });

// UI state (local) — managed by React useState/useReducer
// This is temporary, client-only state
const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);
const [filterStatus, setFilterStatus] = useState<string>('all');

// NEVER duplicate server state in local state
// ❌ BAD
const [orders, setOrders] = useState([]);
useEffect(() => {
  fetchOrders().then(setOrders); // Duplicating server state
}, []);

// ✅ GOOD
const { data: orders } = useOrders(params); // React Query manages server state
```

---

## 6. Caching Strategy

### Cache as Infrastructure Concern

```typescript
// application/ports/cache.ts (port)
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
}

// Caching decorator for repositories
export class CachedOrderRepository implements OrderRepository {
  constructor(
    private readonly inner: OrderRepository,
    private readonly cache: Cache,
  ) {}

  async findById(id: OrderId): Promise<Order | null> {
    const cacheKey = `order:${id.value}`;

    // Try cache first
    const cached = await this.cache.get<OrderCacheData>(cacheKey);
    if (cached) return OrderMapper.fromCacheData(cached);

    // Cache miss — load from DB
    const order = await this.inner.findById(id);
    if (order) {
      await this.cache.set(cacheKey, OrderMapper.toCacheData(order), 300); // 5 min TTL
    }

    return order;
  }

  async save(order: Order): Promise<void> {
    await this.inner.save(order);
    // Invalidate cache on write
    await this.cache.invalidate(`order:${order.id.value}`);
    await this.cache.invalidatePattern(`orders:list:*`);
  }
}

// Wiring in composition root
const orderRepo = new CachedOrderRepository(
  new TypeOrmOrderRepository(dataSource),
  new RedisCache(redisClient)
);
```

---

## 7. Real-time Features

### WebSocket Integration

```typescript
// application/ports/real-time.gateway.ts (port)
export interface RealTimeGateway {
  notifyUser(userId: string, event: RealTimeEvent): Promise<void>;
  notifyRoom(room: string, event: RealTimeEvent): Promise<void>;
  broadcast(event: RealTimeEvent): Promise<void>;
}

// infrastructure/websocket/socket-io.gateway.ts (adapter)
export class SocketIOGateway implements RealTimeGateway {
  constructor(private readonly io: Server) {}

  async notifyUser(userId: string, event: RealTimeEvent): Promise<void> {
    this.io.to(`user:${userId}`).emit(event.type, event.payload);
  }

  async notifyRoom(room: string, event: RealTimeEvent): Promise<void> {
    this.io.to(room).emit(event.type, event.payload);
  }
}

// Usage in event handler (application layer)
export class OnOrderStatusChangedHandler {
  constructor(private readonly realTime: RealTimeGateway) {}

  async handle(event: OrderStatusChangedEvent): Promise<void> {
    await this.realTime.notifyUser(event.customerId, {
      type: 'order.status_changed',
      payload: {
        orderId: event.orderId,
        oldStatus: event.oldStatus,
        newStatus: event.newStatus,
      },
    });
  }
}
```

---

## 8. Complete Working Examples

### Full User Registration Flow

```typescript
// 1. HTTP Request → Controller
@Post('auth/register')
async register(@Body() body: RegisterRequestDto): Promise<ApiResponse<AuthResponseDto>> {
  const result = await this.registerUser.execute({
    email: body.email,
    password: body.password,
    name: body.name,
  });
  return { data: AuthResponseDto.from(result) };
}

// 2. Use Case
export class RegisterUserHandler {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    // Check uniqueness
    const existingUser = await this.userRepo.findByEmail(Email.create(input.email));
    if (existingUser) throw new EmailAlreadyExistsError(input.email);

    // Create user (domain logic)
    const hashedPassword = await this.passwordHasher.hash(Password.create(input.password));
    const user = User.register(
      this.userRepo.nextId(),
      Email.create(input.email),
      hashedPassword,
      Name.create(input.name)
    );

    await this.userRepo.save(user);

    // Generate token
    const token = await this.tokenService.generate({
      userId: user.id.value,
      email: user.email.value,
      roles: user.roles.map(r => r.value),
    });

    await this.eventBus.publishAll(user.domainEvents);

    return {
      userId: user.id.value,
      email: user.email.value,
      name: user.name.value,
      token: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt.toISOString(),
    };
  }
}

// 3. Entity (domain)
export class User extends AggregateRoot {
  static register(id: UserId, email: Email, hashedPassword: HashedPassword, name: Name): User {
    const user = new User({
      id,
      email,
      hashedPassword,
      name,
      roles: [UserRole.USER],
      status: UserStatus.ACTIVE,
      createdAt: new Date(),
    });
    user.addDomainEvent(new UserRegisteredEvent(id, email));
    return user;
  }
}
```

### Full Order Processing Flow

```typescript
// Complete flow: Create → Add Items → Apply Discount → Submit → Confirm

// Step 1: Create Order
const createResult = await createOrder.execute({
  customerId: 'cust-123',
  items: [
    { productId: 'prod-1', quantity: 2 },
    { productId: 'prod-2', quantity: 1 },
  ],
});

// Step 2: Apply Discount (separate use case)
await applyDiscount.execute({
  orderId: createResult.orderId,
  discountCode: 'SUMMER20',
});

// Step 3: Set Shipping Address (separate use case)
await setShippingAddress.execute({
  orderId: createResult.orderId,
  address: {
    street: '123 Main St',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
  },
});

// Step 4: Submit Order (triggers payment)
const submitResult = await submitOrder.execute({
  orderId: createResult.orderId,
  submittedBy: 'cust-123',
});
// Returns: { orderId, status: 'submitted', totalCharged: 45.60, currency: 'USD' }

// Step 5: Confirm Order (after payment verification — usually triggered by webhook)
await confirmOrder.execute({
  orderId: createResult.orderId,
  paymentId: 'pay-456',
});
```

---

## Authentication / Authorization Placement

### Rule: Auth is an infrastructure/adapter concern, NOT a domain concern

```typescript
// Middleware layer (infrastructure)
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokenService: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.tokenService.verify(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}

// Role-based authorization (infrastructure)
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const user = context.switchToHttp().getRequest().user;
    return requiredRoles.some(role => user.roles.includes(role));
  }
}

// Controller uses guards (infrastructure layer)
@Controller('api/v1/admin/orders')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class AdminOrderController {
  // Only admins can access these endpoints
}

// Use case level authorization (if business rule)
export class CancelOrderHandler {
  async execute(input: CancelOrderInput): Promise<void> {
    const order = await this.orderRepo.findById(OrderId.from(input.orderId));
    if (!order) throw new OrderNotFoundError(input.orderId);

    // Business rule: only the customer who created the order can cancel it
    if (order.customerId.value !== input.cancelledBy) {
      throw new UnauthorizedAccessError(input.cancelledBy, `order:${input.orderId}`);
    }

    order.cancel(CancellationReason.from(input.reason));
    await this.orderRepo.save(order);
  }
}
```

---

## Security Headers and Middleware Placement

**Rule: All cross-cutting concerns live in the infrastructure/framework layer.**

```typescript
// main.ts — Framework layer
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(','),
    credentials: true,
  });

  // Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
  }));

  // Request ID
  app.use((req, res, next) => {
    req.headers['x-request-id'] = req.headers['x-request-id'] || crypto.randomUUID();
    next();
  });

  // Global pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new RequestLoggingInterceptor(),
    new ResponseTransformInterceptor(),
  );

  await app.listen(3000);
}
```
