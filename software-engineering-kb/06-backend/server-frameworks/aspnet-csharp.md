# ASP.NET Core — C# Server Framework

> **AI Plugin Directive — ASP.NET Core Production Patterns for Enterprise APIs**
> You are an AI coding assistant. When generating, reviewing, or refactoring ASP.NET Core
> applications, follow EVERY rule in this document. ASP.NET Core is one of the fastest
> enterprise frameworks with native dependency injection and built-in security. Treat each
> section as non-negotiable.

**Core Rule: ALWAYS use the built-in dependency injection container. ALWAYS use async/await for I/O operations. ALWAYS implement global exception handling with middleware. ALWAYS use the Options pattern for configuration. ALWAYS validate input with FluentValidation or Data Annotations. NEVER use synchronous I/O in request handlers.**

---

## 1. Project Setup — Minimal API vs Controller

```
┌──────────────────────────────────────────────────────────────┐
│              Minimal API vs Controller-based                  │
│                                                               │
│  Minimal API (ASP.NET Core 6+):                             │
│  ├── Less ceremony, fewer files                             │
│  ├── Function-based routing (like Express)                  │
│  ├── Best for: microservices, small APIs                    │
│  └── app.MapGet("/api/users", handler)                      │
│                                                               │
│  Controller-based (MVC pattern):                            │
│  ├── Full MVC lifecycle, model binding, filters             │
│  ├── More structure, conventions                            │
│  ├── Best for: large APIs, enterprise applications          │
│  └── [ApiController] public class UsersController           │
│                                                               │
│  Recommendation:                                             │
│  ├── Small services (< 10 endpoints): Minimal API          │
│  └── Large applications (> 20 endpoints): Controllers       │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Controller-Based Setup

```csharp
// Program.cs — Application entry point
var builder = WebApplication.CreateBuilder(args);

// --- Services ---
builder.Services.AddControllers()
    .AddJsonOptions(options => {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => {
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "My API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
    });
});

// Database (EF Core)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default"),
        npgsql => npgsql.EnableRetryOnFailure(3)));

// Configuration
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<CorsSettings>(builder.Configuration.GetSection("Cors"));

// DI registrations
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();

// Auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()!;
        options.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret)),
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
        };
    });
builder.Services.AddAuthorization();

// CORS
builder.Services.AddCors(options => {
    options.AddDefaultPolicy(policy => {
        policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>()!)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials()
              .SetPreflightMaxAge(TimeSpan.FromHours(24));
    });
});

// Health checks
builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("Default")!)
    .AddRedis(builder.Configuration.GetConnectionString("Redis")!);

var app = builder.Build();

// --- Middleware pipeline (order matters) ---
if (app.Environment.IsDevelopment()) {
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler("/error");  // Global error handler
app.UseHsts();
app.UseHttpsRedirection();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
```

---

## 3. Controller & DTOs

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    // Constructor injection (ALWAYS use this, never [FromServices])
    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    public async Task<ActionResult<PaginatedResponse<UserResponse>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        pageSize = Math.Clamp(pageSize, 1, 100);
        var result = await _userService.GetAllAsync(page, pageSize);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserResponse>> GetById(Guid id)
    {
        var user = await _userService.GetByIdAsync(id);
        return Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<UserResponse>> Create([FromBody] CreateUserRequest request)
    {
        var user = await _userService.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = user.Id }, user);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserResponse>> Update(Guid id, [FromBody] UpdateUserRequest request)
    {
        var user = await _userService.UpdateAsync(id, request);
        return Ok(user);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(Guid id)
    {
        await _userService.DeleteAsync(id);
        return NoContent();
    }
}

// DTOs
public record CreateUserRequest(
    [Required][StringLength(100, MinimumLength = 1)] string Name,
    [Required][EmailAddress] string Email,
    [Required][MinLength(8)] string Password
);

public record UpdateUserRequest(
    [StringLength(100, MinimumLength = 1)] string? Name,
    [EmailAddress] string? Email
);

public record UserResponse(
    Guid Id,
    string Name,
    string Email,
    string Role,
    DateTime CreatedAt
);

public record PaginatedResponse<T>(
    IReadOnlyList<T> Data,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages
);
```

---

## 4. Service Layer

```csharp
public interface IUserService
{
    Task<PaginatedResponse<UserResponse>> GetAllAsync(int page, int pageSize);
    Task<UserResponse> GetByIdAsync(Guid id);
    Task<UserResponse> CreateAsync(CreateUserRequest request);
    Task<UserResponse> UpdateAsync(Guid id, UpdateUserRequest request);
    Task DeleteAsync(Guid id);
}

public class UserService : IUserService
{
    private readonly IUserRepository _repository;
    private readonly IPasswordHasher<User> _passwordHasher;

    public UserService(IUserRepository repository, IPasswordHasher<User> passwordHasher)
    {
        _repository = repository;
        _passwordHasher = passwordHasher;
    }

    public async Task<PaginatedResponse<UserResponse>> GetAllAsync(int page, int pageSize)
    {
        var (users, totalCount) = await _repository.GetAllAsync(page, pageSize);
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        return new PaginatedResponse<UserResponse>(
            users.Select(u => u.ToResponse()).ToList(),
            page, pageSize, totalCount, totalPages
        );
    }

    public async Task<UserResponse> GetByIdAsync(Guid id)
    {
        var user = await _repository.GetByIdAsync(id)
            ?? throw new NotFoundException($"User {id} not found");
        return user.ToResponse();
    }

    public async Task<UserResponse> CreateAsync(CreateUserRequest request)
    {
        if (await _repository.ExistsByEmailAsync(request.Email))
            throw new ConflictException("Email already in use");

        var user = new User
        {
            Name = request.Name,
            Email = request.Email,
            Role = UserRole.User,
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        await _repository.AddAsync(user);
        return user.ToResponse();
    }

    public async Task<UserResponse> UpdateAsync(Guid id, UpdateUserRequest request)
    {
        var user = await _repository.GetByIdAsync(id)
            ?? throw new NotFoundException($"User {id} not found");

        if (request.Name is not null) user.Name = request.Name;
        if (request.Email is not null && request.Email != user.Email)
        {
            if (await _repository.ExistsByEmailAsync(request.Email))
                throw new ConflictException("Email already in use");
            user.Email = request.Email;
        }

        await _repository.UpdateAsync(user);
        return user.ToResponse();
    }

    public async Task DeleteAsync(Guid id)
    {
        if (!await _repository.ExistsAsync(id))
            throw new NotFoundException($"User {id} not found");
        await _repository.DeleteAsync(id);
    }
}
```

---

## 5. Entity Framework Core — Entity & Repository

```csharp
// Entity
public class User
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    public UserResponse ToResponse() => new(Id, Name, Email, Role.ToString(), CreatedAt);
}

// DbContext
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity => {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Email).HasMaxLength(255).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        foreach (var entry in ChangeTracker.Entries<User>())
        {
            if (entry.State == EntityState.Modified)
                entry.Entity.UpdatedAt = DateTime.UtcNow;
        }
        return base.SaveChangesAsync(ct);
    }
}

// Repository
public interface IUserRepository
{
    Task<(List<User> Users, int TotalCount)> GetAllAsync(int page, int pageSize);
    Task<User?> GetByIdAsync(Guid id);
    Task<bool> ExistsByEmailAsync(string email);
    Task<bool> ExistsAsync(Guid id);
    Task AddAsync(User user);
    Task UpdateAsync(User user);
    Task DeleteAsync(Guid id);
}

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _context;

    public UserRepository(AppDbContext context) => _context = context;

    public async Task<(List<User>, int)> GetAllAsync(int page, int pageSize)
    {
        var query = _context.Users.AsNoTracking().OrderByDescending(u => u.CreatedAt);
        var totalCount = await query.CountAsync();
        var users = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return (users, totalCount);
    }

    public async Task<User?> GetByIdAsync(Guid id) =>
        await _context.Users.FindAsync(id);

    public async Task<bool> ExistsByEmailAsync(string email) =>
        await _context.Users.AnyAsync(u => u.Email == email);

    public async Task<bool> ExistsAsync(Guid id) =>
        await _context.Users.AnyAsync(u => u.Id == id);

    public async Task AddAsync(User user)
    {
        _context.Users.Add(user);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(User user)
    {
        _context.Users.Update(user);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        await _context.Users.Where(u => u.Id == id).ExecuteDeleteAsync();
    }
}
```

---

## 6. Global Exception Handling

```csharp
// Exception handler middleware
public class ExceptionHandlerMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlerMiddleware> _logger;

    public ExceptionHandlerMiddleware(RequestDelegate next, ILogger<ExceptionHandlerMiddleware> logger)
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
        catch (NotFoundException ex)
        {
            context.Response.StatusCode = 404;
            await context.Response.WriteAsJsonAsync(new { error = "not_found", message = ex.Message });
        }
        catch (ConflictException ex)
        {
            context.Response.StatusCode = 409;
            await context.Response.WriteAsJsonAsync(new { error = "conflict", message = ex.Message });
        }
        catch (UnauthorizedException ex)
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new { error = "unauthorized", message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception at {Method} {Path}",
                context.Request.Method, context.Request.Path);
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new {
                error = "internal_error",
                message = "An unexpected error occurred"
                // NEVER include ex.Message or ex.StackTrace
            });
        }
    }
}

// Register: app.UseMiddleware<ExceptionHandlerMiddleware>();
```

---

## 7. Testing

```csharp
// Controller integration test with WebApplicationFactory
public class UsersControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public UsersControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.WithWebHostBuilder(builder => {
            builder.ConfigureServices(services => {
                // Replace real DB with in-memory
                services.RemoveAll<DbContextOptions<AppDbContext>>();
                services.AddDbContext<AppDbContext>(options =>
                    options.UseInMemoryDatabase("TestDb"));
            });
        }).CreateClient();

        _client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", TestHelper.GenerateTestToken());
    }

    [Fact]
    public async Task List_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/users?page=1&pageSize=10");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<PaginatedResponse<UserResponse>>();
        body.Should().NotBeNull();
        body!.Data.Should().NotBeNull();
    }

    [Fact]
    public async Task Create_WithInvalidEmail_Returns400()
    {
        var request = new { Name = "Test", Email = "invalid", Password = "password123" };
        var response = await _client.PostAsJsonAsync("/api/users", request);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}

// Service unit test
public class UserServiceTests
{
    private readonly Mock<IUserRepository> _repoMock = new();
    private readonly Mock<IPasswordHasher<User>> _hasherMock = new();
    private readonly UserService _service;

    public UserServiceTests()
    {
        _service = new UserService(_repoMock.Object, _hasherMock.Object);
    }

    [Fact]
    public async Task Create_WithExistingEmail_ThrowsConflict()
    {
        _repoMock.Setup(r => r.ExistsByEmailAsync("test@test.com")).ReturnsAsync(true);

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.CreateAsync(new CreateUserRequest("Test", "test@test.com", "password123")));
    }
}
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Synchronous I/O in handlers | Thread pool exhaustion | Always use async/await for I/O |
| Service locator (`IServiceProvider.GetService`) | Hidden dependencies, untestable | Constructor injection |
| No `AsNoTracking()` for read queries | Unnecessary change tracking overhead | `AsNoTracking()` on all read-only queries |
| Exposing EF entities in responses | Internal fields leak, tight coupling | Use DTOs/records for all API responses |
| Using `try/catch` in every controller | Repetitive code, inconsistent errors | Global exception handler middleware |
| No cancellation token propagation | Requests can't be cancelled | Pass `CancellationToken` through async chain |
| `AddSingleton` for services with scoped deps | Captive dependency, memory leaks | Match service lifetimes (scoped services use scoped deps) |
| No health checks | Can't monitor service health | `AddHealthChecks()` with DB/Redis checks |
| Hardcoded config values | Can't change without redeployment | Options pattern + environment variables |
| EF migrations in production with auto-migrate | Schema drift | Use `dotnet ef migrations` + CI/CD pipeline |

---

## 9. Enforcement Checklist

- [ ] Constructor injection used for all dependencies
- [ ] async/await used for all I/O operations
- [ ] CancellationToken propagated through async chain
- [ ] DTOs used for all request/response bodies (never EF entities)
- [ ] Global exception handler middleware configured
- [ ] Data Annotations or FluentValidation on all input
- [ ] Options pattern used for configuration
- [ ] Health checks configured for DB and Redis
- [ ] Swagger/OpenAPI docs auto-generated
- [ ] `AsNoTracking()` on all read-only queries
- [ ] CORS configured with explicit origins
- [ ] JWT authentication configured
- [ ] Graceful shutdown configured
- [ ] Integration tests with `WebApplicationFactory`
- [ ] EF Core migrations managed through CLI (never auto-migrate)
