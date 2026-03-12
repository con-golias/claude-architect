# .NET Web API Project Structure

> **AI Plugin Directive:** When generating a .NET Web API project, ALWAYS use this structure. Apply Clean Architecture with vertical slices or layered projects. This guide covers .NET 8+ with Minimal API or Controller-based API, Entity Framework Core, and modern C# patterns.

**Core Rule: Organize .NET API projects using Clean Architecture with separate projects per layer. Domain has ZERO external dependencies. Application depends only on Domain. Infrastructure depends on Application. API is the composition root.**

---

## 1. Enterprise Project Structure (Clean Architecture)

### Multi-Project Solution

```
MyApp/
├── src/
│   ├── MyApp.Domain/                      # Innermost layer — ZERO dependencies
│   │   ├── Entities/
│   │   │   ├── User.cs
│   │   │   ├── Order.cs
│   │   │   └── OrderItem.cs
│   │   ├── ValueObjects/
│   │   │   ├── Email.cs
│   │   │   ├── Money.cs
│   │   │   └── Address.cs
│   │   ├── Enums/
│   │   │   ├── Role.cs
│   │   │   └── OrderStatus.cs
│   │   ├── Exceptions/
│   │   │   ├── DomainException.cs
│   │   │   └── BusinessRuleViolationException.cs
│   │   ├── Interfaces/                    # Repository contracts
│   │   │   ├── IUserRepository.cs
│   │   │   ├── IOrderRepository.cs
│   │   │   └── IUnitOfWork.cs
│   │   ├── Events/
│   │   │   ├── UserCreatedEvent.cs
│   │   │   └── OrderPlacedEvent.cs
│   │   ├── Common/
│   │   │   ├── BaseEntity.cs
│   │   │   ├── AuditableEntity.cs
│   │   │   └── IDomainEvent.cs
│   │   └── MyApp.Domain.csproj
│   │
│   ├── MyApp.Application/                # Use cases — depends only on Domain
│   │   ├── Common/
│   │   │   ├── Interfaces/
│   │   │   │   ├── IApplicationDbContext.cs
│   │   │   │   ├── ICurrentUserService.cs
│   │   │   │   ├── IEmailService.cs
│   │   │   │   └── IDateTimeProvider.cs
│   │   │   ├── Behaviours/               # MediatR pipeline
│   │   │   │   ├── ValidationBehaviour.cs
│   │   │   │   ├── LoggingBehaviour.cs
│   │   │   │   └── PerformanceBehaviour.cs
│   │   │   ├── Mappings/
│   │   │   │   └── MappingProfile.cs
│   │   │   ├── Models/
│   │   │   │   ├── PaginatedList.cs
│   │   │   │   └── Result.cs
│   │   │   └── Exceptions/
│   │   │       ├── ValidationException.cs
│   │   │       └── NotFoundException.cs
│   │   │
│   │   ├── Users/                         # Feature: Users
│   │   │   ├── Commands/
│   │   │   │   ├── CreateUser/
│   │   │   │   │   ├── CreateUserCommand.cs
│   │   │   │   │   ├── CreateUserCommandHandler.cs
│   │   │   │   │   └── CreateUserCommandValidator.cs
│   │   │   │   ├── UpdateUser/
│   │   │   │   │   ├── UpdateUserCommand.cs
│   │   │   │   │   ├── UpdateUserCommandHandler.cs
│   │   │   │   │   └── UpdateUserCommandValidator.cs
│   │   │   │   └── DeleteUser/
│   │   │   │       ├── DeleteUserCommand.cs
│   │   │   │       └── DeleteUserCommandHandler.cs
│   │   │   └── Queries/
│   │   │       ├── GetUser/
│   │   │       │   ├── GetUserQuery.cs
│   │   │       │   ├── GetUserQueryHandler.cs
│   │   │       │   └── UserDto.cs
│   │   │       └── GetUsers/
│   │   │           ├── GetUsersQuery.cs
│   │   │           ├── GetUsersQueryHandler.cs
│   │   │           └── UserListDto.cs
│   │   │
│   │   ├── Orders/                        # Feature: Orders
│   │   │   ├── Commands/
│   │   │   │   └── CreateOrder/
│   │   │   │       ├── CreateOrderCommand.cs
│   │   │   │       ├── CreateOrderCommandHandler.cs
│   │   │   │       └── CreateOrderCommandValidator.cs
│   │   │   ├── Queries/
│   │   │   │   └── GetOrders/
│   │   │   │       ├── GetOrdersQuery.cs
│   │   │   │       └── GetOrdersQueryHandler.cs
│   │   │   └── EventHandlers/
│   │   │       └── OrderPlacedEventHandler.cs
│   │   │
│   │   ├── DependencyInjection.cs         # IServiceCollection extensions
│   │   └── MyApp.Application.csproj
│   │
│   ├── MyApp.Infrastructure/             # External concerns — implements interfaces
│   │   ├── Data/
│   │   │   ├── ApplicationDbContext.cs
│   │   │   ├── Configurations/            # EF Core Fluent API
│   │   │   │   ├── UserConfiguration.cs
│   │   │   │   └── OrderConfiguration.cs
│   │   │   ├── Repositories/
│   │   │   │   ├── UserRepository.cs
│   │   │   │   └── OrderRepository.cs
│   │   │   ├── Migrations/                # EF Core migrations
│   │   │   ├── Interceptors/
│   │   │   │   └── AuditableEntityInterceptor.cs
│   │   │   └── Seed/
│   │   │       └── ApplicationDbContextSeed.cs
│   │   ├── Identity/
│   │   │   ├── IdentityService.cs
│   │   │   └── JwtTokenGenerator.cs
│   │   ├── Services/
│   │   │   ├── DateTimeProvider.cs
│   │   │   ├── EmailService.cs
│   │   │   └── CurrentUserService.cs
│   │   ├── DependencyInjection.cs
│   │   └── MyApp.Infrastructure.csproj
│   │
│   └── MyApp.Api/                         # Composition root — wires everything
│       ├── Controllers/
│       │   ├── UsersController.cs
│       │   ├── OrdersController.cs
│       │   └── AuthController.cs
│       ├── Endpoints/                     # Minimal API (alternative to controllers)
│       │   ├── UserEndpoints.cs
│       │   └── OrderEndpoints.cs
│       ├── Filters/
│       │   └── ApiExceptionFilterAttribute.cs
│       ├── Middleware/
│       │   ├── ExceptionHandlingMiddleware.cs
│       │   └── RequestLoggingMiddleware.cs
│       ├── Program.cs                     # Composition root
│       ├── appsettings.json
│       ├── appsettings.Development.json
│       ├── appsettings.Production.json
│       └── MyApp.Api.csproj
│
├── tests/
│   ├── MyApp.Domain.UnitTests/
│   │   ├── Entities/
│   │   │   └── UserTests.cs
│   │   └── ValueObjects/
│   │       └── EmailTests.cs
│   ├── MyApp.Application.UnitTests/
│   │   ├── Users/
│   │   │   └── Commands/
│   │   │       └── CreateUserCommandTests.cs
│   │   └── Common/
│   │       └── ValidationBehaviourTests.cs
│   ├── MyApp.Application.IntegrationTests/
│   │   ├── Users/
│   │   │   └── CreateUserTests.cs
│   │   ├── Testing.cs                     # Test base class
│   │   └── CustomWebApplicationFactory.cs
│   └── MyApp.Api.FunctionalTests/
│       └── Users/
│           └── UsersEndpointTests.cs
│
├── MyApp.sln
├── Directory.Build.props                  # Shared MSBuild properties
├── Directory.Packages.props               # Central package management
├── .editorconfig
├── global.json                            # SDK version pinning
├── Dockerfile
└── docker-compose.yml
```

---

## 2. Dependency Flow (STRICT)

```
┌─────────────────────────────────────────────┐
│                 MyApp.Api                     │
│         (Composition Root, DI setup)         │
│     References: Application, Infrastructure  │
└─────────────┬──────────────┬────────────────┘
              │              │
              ▼              ▼
┌─────────────────┐  ┌─────────────────────┐
│  MyApp.Application │  │  MyApp.Infrastructure │
│  (Use Cases/CQRS) │  │  (EF Core, Services)  │
│  References: Domain│  │  References: Application│
└────────┬──────────┘  └──────────┬────────────┘
         │                        │
         ▼                        ▼
┌──────────────────────────────────────────────┐
│               MyApp.Domain                    │
│          (Entities, Value Objects)            │
│            ZERO DEPENDENCIES                 │
└──────────────────────────────────────────────┘
```

**Rules:**
- Domain references NOTHING (no NuGet packages except analyzers)
- Application references ONLY Domain
- Infrastructure references Application (implements its interfaces)
- Api references Application AND Infrastructure (wires DI container)
- NEVER reference Infrastructure from Application

---

## 3. Program.cs (Composition Root)

```csharp
// MyApp.Api/Program.cs
var builder = WebApplication.CreateBuilder(args);

// Add layers
builder.Services.AddApplication();        // MediatR, FluentValidation, AutoMapper
builder.Services.AddInfrastructure(builder.Configuration);  // EF Core, Identity

// Add API concerns
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(builder.Configuration["Cors:Origins"]!)
              .AllowAnyHeader()
              .AllowAnyMethod());
});

var app = builder.Build();

// Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

---

## 4. Controller Pattern (MediatR)

```csharp
// MyApp.Api/Controllers/UsersController.cs
[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class UsersController : ControllerBase
{
    private readonly ISender _mediator;

    public UsersController(ISender mediator) => _mediator = mediator;

    [HttpGet]
    [ProducesResponseType(typeof(PaginatedList<UserDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PaginatedList<UserDto>>> GetUsers(
        [FromQuery] GetUsersQuery query,
        CancellationToken ct)
    {
        return Ok(await _mediator.Send(query, ct));
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<UserDto>> GetUser(int id, CancellationToken ct)
    {
        return Ok(await _mediator.Send(new GetUserQuery(id), ct));
    }

    [HttpPost]
    [ProducesResponseType(typeof(int), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<int>> CreateUser(
        CreateUserCommand command,
        CancellationToken ct)
    {
        var id = await _mediator.Send(command, ct);
        return CreatedAtAction(nameof(GetUser), new { id }, id);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> UpdateUser(
        int id,
        UpdateUserCommand command,
        CancellationToken ct)
    {
        command = command with { Id = id };
        await _mediator.Send(command, ct);
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteUser(int id, CancellationToken ct)
    {
        await _mediator.Send(new DeleteUserCommand(id), ct);
        return NoContent();
    }
}
```

---

## 5. CQRS with MediatR

```csharp
// Application/Users/Commands/CreateUser/CreateUserCommand.cs
public record CreateUserCommand(
    string Email,
    string FullName,
    string Password
) : IRequest<int>;


// Application/Users/Commands/CreateUser/CreateUserCommandHandler.cs
public class CreateUserCommandHandler : IRequestHandler<CreateUserCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IPasswordHasher _hasher;

    public CreateUserCommandHandler(
        IApplicationDbContext context,
        IPasswordHasher hasher)
    {
        _context = context;
        _hasher = hasher;
    }

    public async Task<int> Handle(
        CreateUserCommand request,
        CancellationToken ct)
    {
        if (await _context.Users.AnyAsync(u => u.Email == request.Email, ct))
            throw new ConflictException(nameof(User), request.Email);

        var user = new User
        {
            Email = request.Email,
            FullName = request.FullName,
            PasswordHash = _hasher.Hash(request.Password),
            Role = Role.User,
            IsActive = true
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(ct);

        user.AddDomainEvent(new UserCreatedEvent(user.Id));

        return user.Id;
    }
}


// Application/Users/Commands/CreateUser/CreateUserCommandValidator.cs
public class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(255);

        RuleFor(x => x.FullName)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8)
            .MaximumLength(128);
    }
}
```

```csharp
// Application/Users/Queries/GetUser/GetUserQuery.cs
public record GetUserQuery(int Id) : IRequest<UserDto>;

public class GetUserQueryHandler : IRequestHandler<GetUserQuery, UserDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;

    public GetUserQueryHandler(IApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }

    public async Task<UserDto> Handle(GetUserQuery request, CancellationToken ct)
    {
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.Id, ct)
            ?? throw new NotFoundException(nameof(User), request.Id);

        return _mapper.Map<UserDto>(user);
    }
}
```

---

## 6. Domain Entities

```csharp
// Domain/Common/BaseEntity.cs
public abstract class BaseEntity
{
    public int Id { get; set; }

    private readonly List<IDomainEvent> _domainEvents = new();

    [NotMapped]
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    public void AddDomainEvent(IDomainEvent domainEvent)
        => _domainEvents.Add(domainEvent);

    public void ClearDomainEvents() => _domainEvents.Clear();
}


// Domain/Common/AuditableEntity.cs
public abstract class AuditableEntity : BaseEntity
{
    public DateTimeOffset CreatedAt { get; set; }
    public string? CreatedBy { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}


// Domain/Entities/User.cs
public class User : AuditableEntity
{
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Role Role { get; set; } = Role.User;

    // Navigation properties
    public ICollection<Order> Orders { get; set; } = new List<Order>();
}
```

---

## 7. EF Core Configuration

```csharp
// Infrastructure/Data/ApplicationDbContext.cs
public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.ApplyConfigurationsFromAssembly(
            typeof(ApplicationDbContext).Assembly);
        base.OnModelCreating(builder);
    }
}


// Infrastructure/Data/Configurations/UserConfiguration.cs
public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Email)
            .HasMaxLength(255)
            .IsRequired();

        builder.HasIndex(u => u.Email)
            .IsUnique();

        builder.Property(u => u.FullName)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(u => u.PasswordHash)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(u => u.Role)
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.HasMany(u => u.Orders)
            .WithOne(o => o.User)
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

---

## 8. Minimal API Alternative

```csharp
// MyApp.Api/Endpoints/UserEndpoints.cs
public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/users")
            .WithTags("Users")
            .RequireAuthorization();

        group.MapGet("/", GetUsers)
            .WithName("GetUsers")
            .Produces<PaginatedList<UserDto>>();

        group.MapGet("/{id:int}", GetUser)
            .WithName("GetUser")
            .Produces<UserDto>()
            .ProducesProblem(404);

        group.MapPost("/", CreateUser)
            .WithName("CreateUser")
            .Produces<int>(201)
            .ProducesValidationProblem();

        group.MapPut("/{id:int}", UpdateUser)
            .WithName("UpdateUser")
            .Produces(204);

        group.MapDelete("/{id:int}", DeleteUser)
            .WithName("DeleteUser")
            .Produces(204);
    }

    private static async Task<IResult> GetUsers(
        [AsParameters] GetUsersQuery query,
        ISender mediator,
        CancellationToken ct)
    {
        return Results.Ok(await mediator.Send(query, ct));
    }

    private static async Task<IResult> GetUser(
        int id, ISender mediator, CancellationToken ct)
    {
        return Results.Ok(await mediator.Send(new GetUserQuery(id), ct));
    }

    private static async Task<IResult> CreateUser(
        CreateUserCommand command, ISender mediator, CancellationToken ct)
    {
        var id = await mediator.Send(command, ct);
        return Results.Created($"/api/v1/users/{id}", id);
    }

    private static async Task<IResult> UpdateUser(
        int id, UpdateUserCommand command, ISender mediator, CancellationToken ct)
    {
        await mediator.Send(command with { Id = id }, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteUser(
        int id, ISender mediator, CancellationToken ct)
    {
        await mediator.Send(new DeleteUserCommand(id), ct);
        return Results.NoContent();
    }
}

// In Program.cs:
app.MapUserEndpoints();
```

---

## 9. DI Registration Pattern

```csharp
// Application/DependencyInjection.cs
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        var assembly = typeof(DependencyInjection).Assembly;

        services.AddMediatR(cfg =>
            cfg.RegisterServicesFromAssembly(assembly));

        services.AddValidatorsFromAssembly(assembly);

        services.AddTransient(typeof(IPipelineBehavior<,>),
            typeof(ValidationBehaviour<,>));
        services.AddTransient(typeof(IPipelineBehavior<,>),
            typeof(LoggingBehaviour<,>));

        services.AddAutoMapper(assembly);

        return services;
    }
}


// Infrastructure/DependencyInjection.cs
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection"),
                b => b.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)
            ));

        services.AddScoped<IApplicationDbContext>(provider =>
            provider.GetRequiredService<ApplicationDbContext>());

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddTransient<IEmailService, EmailService>();
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();

        return services;
    }
}
```

---

## 10. Middleware

```csharp
// MyApp.Api/Middleware/ExceptionHandlingMiddleware.cs
public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, title) = exception switch
        {
            NotFoundException => (StatusCodes.Status404NotFound, "Not Found"),
            ValidationException => (StatusCodes.Status400BadRequest, "Validation Error"),
            ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
            _ => (StatusCodes.Status500InternalServerError, "Server Error")
        };

        if (statusCode == 500)
            _logger.LogError(exception, "Unhandled exception");

        context.Response.StatusCode = statusCode;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = exception.Message,
            Instance = context.Request.Path
        });
    }
}
```

---

## 11. Testing

```csharp
// tests/MyApp.Application.IntegrationTests/CustomWebApplicationFactory.cs
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace real database with test container
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));

            if (descriptor != null)
                services.Remove(descriptor);

            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(TestDatabase.ConnectionString));
        });
    }
}


// tests/MyApp.Application.UnitTests/Users/Commands/CreateUserCommandTests.cs
public class CreateUserCommandTests
{
    private readonly Mock<IApplicationDbContext> _contextMock;
    private readonly CreateUserCommandHandler _handler;

    public CreateUserCommandTests()
    {
        _contextMock = new Mock<IApplicationDbContext>();
        var hasherMock = new Mock<IPasswordHasher>();
        hasherMock.Setup(h => h.Hash(It.IsAny<string>())).Returns("hashed");
        _handler = new CreateUserCommandHandler(_contextMock.Object, hasherMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldCreateUser_WhenEmailIsUnique()
    {
        // Arrange
        var command = new CreateUserCommand("test@example.com", "Test", "password");
        _contextMock.Setup(c => c.Users).Returns(MockDbSet<User>.Empty);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().BeGreaterThan(0);
    }
}
```

---

## 12. CLI Commands

```bash
# Create solution
dotnet new sln -n MyApp
dotnet new webapi -n MyApp.Api -o src/MyApp.Api
dotnet new classlib -n MyApp.Domain -o src/MyApp.Domain
dotnet new classlib -n MyApp.Application -o src/MyApp.Application
dotnet new classlib -n MyApp.Infrastructure -o src/MyApp.Infrastructure

# Add projects to solution
dotnet sln add src/MyApp.Api src/MyApp.Domain src/MyApp.Application src/MyApp.Infrastructure

# Set project references (dependency flow)
dotnet add src/MyApp.Application reference src/MyApp.Domain
dotnet add src/MyApp.Infrastructure reference src/MyApp.Application
dotnet add src/MyApp.Api reference src/MyApp.Application
dotnet add src/MyApp.Api reference src/MyApp.Infrastructure

# Add NuGet packages
dotnet add src/MyApp.Application package MediatR
dotnet add src/MyApp.Application package FluentValidation.DependencyInjectionExtensions
dotnet add src/MyApp.Application package AutoMapper.Extensions.Microsoft.DependencyInjection
dotnet add src/MyApp.Infrastructure package Microsoft.EntityFrameworkCore.Design
dotnet add src/MyApp.Infrastructure package Npgsql.EntityFrameworkCore.PostgreSQL

# EF Core migrations
dotnet ef migrations add InitialCreate -p src/MyApp.Infrastructure -s src/MyApp.Api
dotnet ef database update -p src/MyApp.Infrastructure -s src/MyApp.Api

# Run
dotnet run --project src/MyApp.Api
dotnet watch run --project src/MyApp.Api  # Hot reload
```

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Single-project monolith | All code in one project, no boundaries | Split into Domain/Application/Infrastructure/Api projects |
| Domain depends on EF | `using Microsoft.EntityFrameworkCore` in Domain | Domain has ZERO NuGet dependencies, interfaces only |
| Anemic CQRS | Commands/Queries with no separation benefit | Use CQRS only when read/write models genuinely differ |
| No FluentValidation | Validation logic in handlers | Separate validator class + `ValidationBehaviour` pipeline |
| Fat controllers | Business logic in controller actions | Controllers call `_mediator.Send()` only |
| Missing CancellationToken | Async methods without cancellation support | ALWAYS pass `CancellationToken` through entire call chain |
| Service locator | `IServiceProvider.GetService<T>()` in business code | Use constructor injection everywhere |
| No Fluent API | Relying on data annotations for EF | Use `IEntityTypeConfiguration<T>` for all entity config |
| Test against real DB | Integration tests hit dev database | Use Testcontainers or in-memory provider |
| God DbContext | DbContext with 50+ DbSets | Split into bounded context DbContexts |

---

## 14. Enforcement Checklist

- [ ] Clean Architecture: 4 projects (Domain → Application → Infrastructure → Api)
- [ ] Domain project has ZERO NuGet package dependencies
- [ ] Application references ONLY Domain — NEVER Infrastructure
- [ ] CQRS via MediatR — one handler per command/query
- [ ] FluentValidation for ALL commands — `ValidationBehaviour` in pipeline
- [ ] DTOs for API responses — NEVER expose domain entities
- [ ] EF Core Fluent API via `IEntityTypeConfiguration<T>` — NEVER data annotations
- [ ] Migrations managed by EF Core CLI — committed to source control
- [ ] `CancellationToken` passed through ALL async methods
- [ ] Global exception handling via middleware returning `ProblemDetails`
- [ ] DI registration in `DependencyInjection.cs` per project layer
- [ ] `appsettings.{Environment}.json` for environment-specific config
- [ ] Unit tests mock interfaces — integration tests use `WebApplicationFactory`
- [ ] Central package management via `Directory.Packages.props`
