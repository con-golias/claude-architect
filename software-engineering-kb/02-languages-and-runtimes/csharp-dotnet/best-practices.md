# C#/.NET: Best Practices

> **Domain:** Languages > C#/.NET
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## Modern C# Style (C# 12+)

### Use Records for Data

```csharp
// Immutable data with value semantics
public record UserDto(string Name, string Email, int Age);

// With computed properties
public record OrderSummary(string OrderId, List<LineItem> Items)
{
    public decimal Total => Items.Sum(i => i.Price * i.Quantity);
    public int ItemCount => Items.Count;
}

// Record structs for high-performance value types
public readonly record struct Coordinate(double Lat, double Lng);
```

### Primary Constructors (C# 12)

```csharp
// DI in services — clean and concise
public class OrderService(
    IOrderRepository repository,
    IPaymentGateway payment,
    ILogger<OrderService> logger) : IOrderService
{
    public async Task<Order> PlaceOrderAsync(PlaceOrderCommand cmd, CancellationToken ct)
    {
        logger.LogInformation("Placing order for {CustomerId}", cmd.CustomerId);

        var order = Order.Create(cmd);
        await payment.ChargeAsync(order.Total, cmd.PaymentMethod, ct);
        await repository.SaveAsync(order, ct);

        return order;
    }
}
```

### Pattern Matching for Control Flow

```csharp
// Replace if-else chains with switch expressions
public decimal CalculateDiscount(Customer customer) => customer switch
{
    { Tier: CustomerTier.Premium, YearsActive: > 5 } => 0.25m,
    { Tier: CustomerTier.Premium }                    => 0.15m,
    { Tier: CustomerTier.Standard, YearsActive: > 3 } => 0.10m,
    { Tier: CustomerTier.Standard }                   => 0.05m,
    _                                                  => 0m
};

// Guard against nulls
public string FormatAddress(Address? addr) => addr switch
{
    null => "No address",
    { Country: "US", State: var state } => $"{addr.City}, {state} {addr.Zip}",
    { Country: var country }            => $"{addr.City}, {country}",
};
```

### Collection Expressions (C# 12)

```csharp
// Unified collection initialization
List<string> names = ["Alice", "Bob", "Charlie"];
ImmutableArray<int> ids = [1, 2, 3];

// Spread for combining
int[] first = [1, 2, 3];
int[] second = [4, 5, 6];
int[] all = [..first, ..second]; // [1, 2, 3, 4, 5, 6]

// In method calls
ProcessItems([..existingItems, newItem]);
```

## Async/Await Best Practices

### Always Pass CancellationToken

```csharp
// Every async method should accept and propagate CancellationToken
public async Task<User?> GetUserAsync(int id, CancellationToken ct = default)
{
    var user = await _repository.FindByIdAsync(id, ct);

    if (user is null) return null;

    // Propagate to all async calls
    user.Orders = await _orderRepository.GetByUserIdAsync(id, ct);
    return user;
}
```

### Avoid Async Anti-Patterns

```csharp
// BAD: async void (cannot be awaited, crashes on exception)
async void OnClick(object sender, EventArgs e) { ... }

// GOOD: async Task (except event handlers)
async Task OnClickAsync(object sender, EventArgs e) { ... }

// BAD: .Result or .Wait() (deadlock risk)
var user = GetUserAsync(1).Result;

// GOOD: await all the way
var user = await GetUserAsync(1, ct);

// BAD: unnecessary async/await (just wrapping)
async Task<User> GetUserAsync(int id, CancellationToken ct)
    => await _repo.FindByIdAsync(id, ct); // unnecessary state machine

// GOOD: pass through directly
Task<User> GetUserAsync(int id, CancellationToken ct)
    => _repo.FindByIdAsync(id, ct);

// BAD: Task.Run for I/O (wastes thread pool thread)
await Task.Run(() => httpClient.GetAsync(url));

// GOOD: use native async I/O
await httpClient.GetAsync(url, ct);
```

### Parallel Async Operations

```csharp
// Run independent operations concurrently
public async Task<Dashboard> LoadDashboardAsync(int userId, CancellationToken ct)
{
    // Start all tasks
    var profileTask = _profileService.GetAsync(userId, ct);
    var ordersTask = _orderService.GetRecentAsync(userId, ct);
    var notificationsTask = _notificationService.GetUnreadAsync(userId, ct);

    // Await all (parallel execution)
    await Task.WhenAll(profileTask, ordersTask, notificationsTask);

    return new Dashboard(
        profileTask.Result,
        ordersTask.Result,
        notificationsTask.Result);
}

// Process items with controlled parallelism
await Parallel.ForEachAsync(items, new ParallelOptions
{
    MaxDegreeOfParallelism = 10,
    CancellationToken = ct
}, async (item, token) =>
{
    await ProcessItemAsync(item, token);
});
```

## Error Handling

### Result Pattern

```csharp
// Typed result instead of exceptions for expected failures
public abstract record Result<T>
{
    public record Success(T Value) : Result<T>;
    public record Failure(Error Error) : Result<T>;

    public TOut Match<TOut>(Func<T, TOut> onSuccess, Func<Error, TOut> onFailure) =>
        this switch
        {
            Success s => onSuccess(s.Value),
            Failure f => onFailure(f.Error),
            _ => throw new InvalidOperationException()
        };
}

public record Error(string Code, string Message);

// Usage
public async Task<Result<User>> CreateUserAsync(CreateUserRequest req)
{
    if (await _repo.ExistsByEmailAsync(req.Email))
        return new Result<User>.Failure(new Error("DUPLICATE", "Email already exists"));

    var user = new User(req.Name, req.Email);
    await _repo.SaveAsync(user);
    return new Result<User>.Success(user);
}

// Handling
var result = await service.CreateUserAsync(request);
return result.Match(
    user => Results.Created($"/users/{user.Id}", user),
    error => Results.Conflict(error)
);
```

### Exception Hierarchy

```csharp
// Domain exceptions for business rule violations
public abstract class DomainException(string message) : Exception(message)
{
    public abstract string Code { get; }
}

public class NotFoundException(string entity, object id)
    : DomainException($"{entity} with ID {id} not found")
{
    public override string Code => "NOT_FOUND";
}

public class BusinessRuleViolationException(string rule)
    : DomainException($"Business rule violated: {rule}")
{
    public override string Code => "BUSINESS_RULE";
}

// Global exception handler (Minimal API)
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var exception = context.Features.Get<IExceptionHandlerFeature>()?.Error;
        var (statusCode, response) = exception switch
        {
            NotFoundException e => (404, new { e.Code, e.Message }),
            BusinessRuleViolationException e => (422, new { e.Code, e.Message }),
            _ => (500, new { Code = "INTERNAL", Message = "An error occurred" })
        };
        context.Response.StatusCode = statusCode;
        await context.Response.WriteAsJsonAsync(response);
    });
});
```

## Dependency Injection

### Service Lifetimes

| Lifetime | Behavior | Use For |
|----------|----------|---------|
| **Transient** | New instance every injection | Lightweight, stateless services |
| **Scoped** | One per request/scope | DbContext, repositories, unit of work |
| **Singleton** | One for app lifetime | Caches, HttpClient factory, config |

```csharp
// Registration patterns
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddSingleton<ICacheService, RedisCacheService>();
builder.Services.AddTransient<IEmailService, SmtpEmailService>();

// Keyed services (.NET 8) — multiple implementations
builder.Services.AddKeyedScoped<INotificationService, EmailNotification>("email");
builder.Services.AddKeyedScoped<INotificationService, SmsNotification>("sms");

// Resolve keyed service
public class OrderService([FromKeyedServices("email")] INotificationService notifier) { }

// Options pattern for configuration
builder.Services.Configure<SmtpOptions>(builder.Configuration.GetSection("Smtp"));
builder.Services.AddOptionsWithValidateOnStart<SmtpOptions>()
    .ValidateDataAnnotations();
```

### DI Anti-Patterns

```csharp
// BAD: Service Locator
public class UserService
{
    public void DoWork()
    {
        var repo = ServiceLocator.Get<IUserRepository>(); // hidden dependency
    }
}

// GOOD: Constructor injection
public class UserService(IUserRepository repo) { }

// BAD: Captive dependency (scoped inside singleton)
builder.Services.AddSingleton<MySingleton>();  // lives forever
builder.Services.AddScoped<MyScopedService>(); // should be per-request
// MySingleton injecting MyScopedService = captive dependency!

// GOOD: Use IServiceScopeFactory in singletons
public class MySingleton(IServiceScopeFactory scopeFactory)
{
    public async Task DoWorkAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var service = scope.ServiceProvider.GetRequiredService<MyScopedService>();
    }
}
```

## Entity Framework Core Best Practices

```csharp
// Use projection (Select) to avoid loading entire entities
var userDtos = await context.Users
    .Where(u => u.IsActive)
    .Select(u => new UserDto(u.Id, u.Name, u.Email)) // only needed columns
    .ToListAsync(ct);

// Use AsNoTracking for read-only queries
var users = await context.Users
    .AsNoTracking()
    .Where(u => u.IsActive)
    .ToListAsync(ct);

// Compiled queries for hot paths
private static readonly Func<AppDbContext, int, Task<User?>> GetUserById =
    EF.CompileAsyncQuery((AppDbContext db, int id) =>
        db.Users.FirstOrDefault(u => u.Id == id));

// Use ExecuteUpdate/ExecuteDelete for bulk operations (.NET 7+)
await context.Users
    .Where(u => u.LastLogin < DateTime.UtcNow.AddYears(-1))
    .ExecuteDeleteAsync(ct); // No loading into memory!

await context.Products
    .Where(p => p.Category == "seasonal")
    .ExecuteUpdateAsync(s => s.SetProperty(p => p.IsActive, false), ct);
```

## Testing Patterns

```csharp
// Integration test with WebApplicationFactory
public class UserApiTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task GetUser_ReturnsUser_WhenExists()
    {
        // Arrange
        var client = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddScoped<IUserRepository>(_ => new FakeUserRepository(
                    new User(1, "Alice", "alice@test.com")));
            });
        }).CreateClient();

        // Act
        var response = await client.GetAsync("/users/1");

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var user = await response.Content.ReadFromJsonAsync<User>();
        user!.Name.Should().Be("Alice");
    }
}

// Unit test with NSubstitute
public class UserServiceTests
{
    [Fact]
    public async Task CreateUser_ReturnsFailure_WhenEmailExists()
    {
        // Arrange
        var repo = Substitute.For<IUserRepository>();
        repo.ExistsByEmailAsync("taken@test.com", Arg.Any<CancellationToken>())
            .Returns(true);
        var service = new UserService(repo);

        // Act
        var result = await service.CreateUserAsync(
            new CreateUserRequest("Alice", "taken@test.com"));

        // Assert
        result.Should().BeOfType<Result<User>.Failure>()
            .Which.Error.Code.Should().Be("DUPLICATE");
    }
}
```

## Performance Best Practices

```csharp
// Use Span<T> and Memory<T> for zero-allocation parsing
public static bool TryParseUserId(ReadOnlySpan<char> input, out int userId)
{
    var dashIndex = input.IndexOf('-');
    if (dashIndex < 0)
    {
        userId = 0;
        return false;
    }
    return int.TryParse(input[(dashIndex + 1)..], out userId);
}

// Use ArrayPool for temporary buffers
var buffer = ArrayPool<byte>.Shared.Rent(4096);
try
{
    var bytesRead = await stream.ReadAsync(buffer, ct);
    ProcessData(buffer.AsSpan(0, bytesRead));
}
finally
{
    ArrayPool<byte>.Shared.Return(buffer);
}

// Use frozen collections for static lookup tables (.NET 8)
private static readonly FrozenDictionary<string, Country> Countries =
    CountryData.All.ToFrozenDictionary(c => c.Code);

// Use SearchValues for multi-value search (.NET 8)
private static readonly SearchValues<char> Vowels =
    SearchValues.Create("aeiouAEIOU");
int firstVowel = text.AsSpan().IndexOfAny(Vowels);
```

## Anti-Patterns

| Anti-Pattern | Why It's Bad | Better Alternative |
|-------------|-------------|-------------------|
| `async void` | Unobservable exceptions, can't await | `async Task` (except event handlers) |
| `.Result` / `.Wait()` | Deadlocks in ASP.NET | `await` all the way |
| Throwing for control flow | Exceptions are expensive (~10K allocs) | Result pattern, OneOf |
| Not disposing IDisposable | Resource leaks (connections, files) | `using` statement/declaration |
| N+1 queries in EF | Performance disaster | `.Include()`, projection, compiled queries |
| Service Locator | Hidden dependencies, untestable | Constructor injection |
| Captive dependency | Scoped in singleton = memory leak | `IServiceScopeFactory` |
| Mutable statics | Thread-unsafe, global state | DI with appropriate lifetime |
| String concatenation in loops | O(n^2) allocations | `StringBuilder` or string.Join |
| Over-abstracting with interfaces | 1:1 interface:class ratio | Only abstract at boundaries |

## Sources

- [C# Coding Conventions](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions)
- [ASP.NET Core Best Practices](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/best-practices)
- [EF Core Performance](https://learn.microsoft.com/en-us/ef/core/performance/)
- [.NET Performance Tips](https://learn.microsoft.com/en-us/dotnet/framework/performance/performance-tips)
