# NestJS Project Structure — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I structure a NestJS project?", "NestJS modules vs features?", "NestJS folder organization?", "NestJS guards and interceptors?", "NestJS microservices structure?", or "NestJS enterprise architecture?", use this directive. NestJS is an opinionated Node.js framework inspired by Angular. It provides built-in dependency injection, modules, decorators, and a clear architectural pattern. NestJS projects MUST follow the module-per-feature pattern. Every feature is a self-contained module with its own controllers, services, DTOs, and entities. The NestJS CLI is the PRIMARY tool for code generation.

---

## 1. The Core Rule

**NestJS projects MUST be organized by feature modules. Each module encapsulates its controllers, services, repositories/entities, DTOs, guards, and pipes. Modules define explicit boundaries — they declare what they provide and what they export. Cross-cutting concerns (auth, logging, caching) are separate modules or global pipes/guards/interceptors. Use the NestJS CLI (`nest generate`) for ALL code generation. Follow NestJS naming conventions: `feature-name.type.ts` (kebab-case with dot-separated type suffix).**

```
❌ WRONG: Flat structure without modules
src/
├── controllers/
│   ├── users.controller.ts
│   ├── orders.controller.ts
│   └── auth.controller.ts
├── services/
│   ├── users.service.ts
│   └── orders.service.ts
├── entities/
├── dto/
└── app.module.ts

✅ CORRECT: Module-per-feature
src/
├── modules/
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   └── users.controller.spec.ts
│   ├── orders/
│   │   ├── orders.module.ts
│   │   └── ...
│   └── auth/
│       ├── auth.module.ts
│       └── ...
├── common/                    ← Cross-cutting: guards, pipes, interceptors
├── config/
└── app.module.ts
```

---

## 2. Enterprise Structure

```
my-nestjs-api/
├── src/
│   ├── modules/                           ← Feature modules
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/                ← Passport strategies
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── local.strategy.ts
│   │   │   │   └── google.strategy.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── local-auth.guard.ts
│   │   │   ├── decorators/
│   │   │   │   ├── current-user.decorator.ts
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   └── public.decorator.ts
│   │   │   ├── dto/
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── register.dto.ts
│   │   │   │   └── token-response.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   └── jwt-payload.interface.ts
│   │   │   └── __tests__/
│   │   │       ├── auth.controller.spec.ts
│   │   │       └── auth.service.spec.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── users.repository.ts        ← Custom repository (optional)
│   │   │   ├── entities/
│   │   │   │   └── user.entity.ts         ← TypeORM/Prisma entity
│   │   │   ├── dto/
│   │   │   │   ├── create-user.dto.ts
│   │   │   │   ├── update-user.dto.ts
│   │   │   │   └── user-response.dto.ts
│   │   │   ├── interfaces/
│   │   │   │   └── user.interface.ts
│   │   │   ├── enums/
│   │   │   │   └── user-role.enum.ts
│   │   │   └── __tests__/
│   │   │       ├── users.controller.spec.ts
│   │   │       └── users.service.spec.ts
│   │   │
│   │   ├── orders/
│   │   │   ├── orders.module.ts
│   │   │   ├── orders.controller.ts
│   │   │   ├── orders.service.ts
│   │   │   ├── entities/
│   │   │   │   ├── order.entity.ts
│   │   │   │   └── order-item.entity.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-order.dto.ts
│   │   │   │   └── update-order-status.dto.ts
│   │   │   ├── events/
│   │   │   │   ├── order-created.event.ts
│   │   │   │   └── order-shipped.event.ts
│   │   │   ├── subscribers/
│   │   │   │   └── order.subscriber.ts
│   │   │   └── __tests__/
│   │   │
│   │   ├── products/
│   │   │   ├── products.module.ts
│   │   │   ├── products.controller.ts
│   │   │   ├── products.service.ts
│   │   │   ├── entities/
│   │   │   ├── dto/
│   │   │   └── __tests__/
│   │   │
│   │   ├── notifications/                 ← Cross-cutting feature module
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.service.ts
│   │   │   ├── email/
│   │   │   │   ├── email.service.ts
│   │   │   │   └── templates/
│   │   │   ├── push/
│   │   │   │   └── push.service.ts
│   │   │   └── __tests__/
│   │   │
│   │   └── health/                        ← Health check module
│   │       ├── health.module.ts
│   │       └── health.controller.ts
│   │
│   ├── common/                            ← Shared cross-cutting concerns
│   │   ├── decorators/
│   │   │   ├── api-paginated-response.decorator.ts
│   │   │   └── serialize.decorator.ts
│   │   ├── dto/
│   │   │   ├── pagination-query.dto.ts
│   │   │   └── paginated-response.dto.ts
│   │   ├── exceptions/
│   │   │   ├── all-exceptions.filter.ts
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   └── throttler.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   ├── timeout.interceptor.ts
│   │   │   └── cache.interceptor.ts
│   │   ├── pipes/
│   │   │   ├── parse-uuid.pipe.ts
│   │   │   └── trim-strings.pipe.ts
│   │   ├── middleware/
│   │   │   ├── logger.middleware.ts
│   │   │   └── correlation-id.middleware.ts
│   │   └── interfaces/
│   │       └── paginated-result.interface.ts
│   │
│   ├── database/                          ← Database configuration
│   │   ├── database.module.ts
│   │   ├── migrations/
│   │   │   ├── 1700000000000-CreateUsers.ts
│   │   │   └── 1700000001000-CreateOrders.ts
│   │   ├── seeds/
│   │   │   ├── seed.ts
│   │   │   └── user.seed.ts
│   │   └── data-source.ts                ← TypeORM DataSource config
│   │
│   ├── config/                            ← Configuration
│   │   ├── config.module.ts
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── auth.config.ts
│   │   ├── cache.config.ts
│   │   └── configuration.ts              ← Config factory
│   │
│   ├── app.module.ts                      ← Root module
│   └── main.ts                            ← Application entry point
│
├── test/                                  ← E2E tests
│   ├── app.e2e-spec.ts
│   ├── users.e2e-spec.ts
│   └── jest-e2e.json
│
├── .env
├── .env.example
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── docker-compose.yml
└── package.json
```

---

## 3. Module Pattern

```typescript
// modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // Export for other modules to use
})
export class UsersModule {}

// app.module.ts — Root module
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrdersModule } from './modules/orders/orders.module';
import { HealthModule } from './modules/health/health.module';
import { configuration } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    AuthModule,
    UsersModule,
    OrdersModule,
    HealthModule,
  ],
})
export class AppModule {}
```

```
Module Dependency Rules:
┌──────────────────────┬──────────────────────────────────────────────────┐
│ Module Type          │ Rules                                             │
├──────────────────────┼──────────────────────────────────────────────────┤
│ Feature Module       │ Encapsulates one business domain.                 │
│ (UsersModule)        │ Imports: TypeORM entities, other feature modules. │
│                      │ Exports: Services needed by other modules.        │
├──────────────────────┼──────────────────────────────────────────────────┤
│ Shared Module        │ Cross-cutting concerns.                           │
│ (common/)            │ Guards, interceptors, pipes, decorators.          │
│                      │ Registered globally in AppModule.                 │
├──────────────────────┼──────────────────────────────────────────────────┤
│ Infrastructure Module│ External integrations.                            │
│ (DatabaseModule)     │ Database, cache, queue, email.                    │
│                      │ Configured once, imported by features.            │
├──────────────────────┼──────────────────────────────────────────────────┤
│ Config Module        │ Environment configuration.                        │
│ (ConfigModule)       │ Always global. Provides typed config.             │
└──────────────────────┴──────────────────────────────────────────────────┘

RULE: Feature modules NEVER import from other feature modules' internal files.
RULE: Feature modules import other modules via NestJS module system (imports array).
RULE: Only exported services are accessible to other modules.
RULE: ConfigModule is ALWAYS global (isGlobal: true).
```

---

## 4. Controller, Service, DTO Pattern

```typescript
// modules/users/users.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from './enums/user-role.enum';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  findAll(@Query() query: PaginationQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
```

```typescript
// modules/users/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole = UserRole.USER;
}
```

```typescript
// modules/users/users.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(query: { page: number; limit: number }) {
    const [users, total] = await this.userRepository.findAndCount({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      order: { createdAt: 'DESC' },
    });
    return { data: users, meta: { total, page: query.page, limit: query.limit } };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.userRepository.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({ ...dto, password: hashedPassword });
    return this.userRepository.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.userRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }
}
```

---

## 5. Swagger Documentation

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/exceptions/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,           // Strip unknown properties
    forbidNonWhitelisted: true, // Throw on unknown properties
    transform: true,           // Auto-transform to DTO classes
    transformOptions: { enableImplicitConversion: true },
  }));

  // Global filters, interceptors
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // CORS
  app.enableCors({ origin: process.env.CORS_ORIGIN });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
```

```
RULE: EVERY endpoint MUST have Swagger decorators (@ApiTags, @ApiOperation, @ApiResponse).
RULE: ValidationPipe MUST be global with whitelist: true and forbidNonWhitelisted: true.
RULE: Global prefix: app.setGlobalPrefix('api/v1').
RULE: DTOs use class-validator decorators for validation.
RULE: Swagger docs auto-generated from decorators — no manual OpenAPI file needed.
```

---

## 6. NestJS CLI Commands

```bash
# Generate module
nest generate module modules/users

# Generate controller
nest generate controller modules/users

# Generate service
nest generate service modules/users

# Generate complete resource (CRUD)
nest generate resource modules/users
# Creates: module, controller, service, dto, entities — ALL at once

# Generate guard
nest generate guard common/guards/roles

# Generate interceptor
nest generate interceptor common/interceptors/logging

# Generate pipe
nest generate pipe common/pipes/parse-uuid

# Generate filter
nest generate filter common/exceptions/all-exceptions

# Generate middleware
nest generate middleware common/middleware/logger
```

```
RULE: ALWAYS use `nest generate` (ng g) for creating files.
RULE: `nest generate resource` creates a COMPLETE CRUD feature in one command.
RULE: CLI places files in correct locations and updates module imports.
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **No modules** | All controllers/services in app.module | One module per feature domain |
| **Business logic in controller** | 100-line controller methods with if/else | Move logic to service layer |
| **No DTOs** | `@Body() body: any` — no validation | class-validator DTOs on every endpoint |
| **No Swagger decorators** | Swagger page shows no documentation | @ApiTags, @ApiOperation, @ApiResponse on everything |
| **Circular dependencies** | Module A imports Module B imports Module A | Use forwardRef() or restructure module boundaries |
| **Service imports service directly** | UserService imports from OrderService file | Import OrdersModule, use exported OrdersService |
| **No global ValidationPipe** | Invalid data reaches services | Global ValidationPipe with whitelist: true |
| **Manual file creation** | Creating files without CLI | ALWAYS use `nest generate` |
| **Flat file structure** | All files in src/ root directory | modules/{feature}/ with co-located files |
| **No exception filters** | Default NestJS error format leaks internals | Custom AllExceptionsFilter |
| **God module** | AppModule imports 50 services directly | Feature modules encapsulate their own providers |
| **Config via process.env** | process.env.JWT_SECRET scattered throughout | ConfigModule with typed config factories |

---

## 8. Enforcement Checklist

- [ ] **Module-per-feature** — each domain has its own NestJS module
- [ ] **Controller → Service** — controllers delegate to services, never contain logic
- [ ] **class-validator DTOs** — every input validated with DTO decorators
- [ ] **Swagger decorators** — @ApiTags, @ApiOperation, @ApiResponse on all endpoints
- [ ] **Global ValidationPipe** — whitelist: true, forbidNonWhitelisted: true
- [ ] **Global prefix** — app.setGlobalPrefix('api/v1')
- [ ] **CLI used** — all files generated with `nest generate`
- [ ] **common/ for cross-cutting** — guards, interceptors, pipes, filters
- [ ] **Config module** — typed configuration via @nestjs/config
- [ ] **Exception filters** — custom AllExceptionsFilter for consistent error format
- [ ] **Module exports** — only exported services accessible to other modules
- [ ] **No circular dependencies** — module graph is acyclic
- [ ] **Co-located tests** — .spec.ts next to source files
- [ ] **E2E tests** — test/ directory with .e2e-spec.ts files
