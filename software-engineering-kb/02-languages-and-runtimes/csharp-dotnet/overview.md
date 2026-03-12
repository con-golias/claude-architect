# C#/.NET: Overview

> **Domain:** Languages > C#/.NET
> **Difficulty:** Beginner-Advanced
> **Last Updated:** 2026-03

## History & Evolution

### C# Timeline

| Version | Year | Key Features |
|---------|------|-------------|
| **C# 1.0** | 2002 | Managed code, classes, structs, interfaces, events |
| **C# 2.0** | 2005 | Generics, nullable types, iterators, anonymous methods |
| **C# 3.0** | 2007 | LINQ, lambda expressions, extension methods, var, anonymous types |
| **C# 4.0** | 2010 | Dynamic binding, named/optional arguments, covariance/contravariance |
| **C# 5.0** | 2012 | **async/await** (first mainstream language to get it) |
| **C# 6.0** | 2015 | Expression-bodied members, string interpolation, null-conditional ?. |
| **C# 7.0-7.3** | 2017-2018 | Pattern matching, tuples, local functions, ref returns |
| **C# 8.0** | 2019 | **Nullable reference types**, async streams, switch expressions, ranges |
| **C# 9.0** | 2020 | **Records**, init-only setters, top-level statements, pattern improvements |
| **C# 10** | 2021 | Global usings, file-scoped namespaces, record structs |
| **C# 11** | 2022 | Raw string literals, required members, list patterns, generic math |
| **C# 12** | 2023 | **Primary constructors**, collection expressions, inline arrays |
| **C# 13** | 2024 | params collections, lock object, ref struct interfaces |
| **C# 14** | 2025 | Extension types (preview), field keyword, first-class spans |

### .NET Timeline

| Version | Year | Significance |
|---------|------|-------------|
| **.NET Framework 1.0** | 2002 | Original Windows-only framework |
| **.NET Framework 4.8** | 2019 | Final .NET Framework release |
| **.NET Core 1.0** | 2016 | Cross-platform rewrite (Linux, macOS) |
| **.NET Core 3.1** | 2019 | LTS, WPF/WinForms on Core |
| **.NET 5** | 2020 | Unified platform (Core + Framework merge) |
| **.NET 6** | 2021 | LTS, Minimal APIs, Hot Reload, MAUI preview |
| **.NET 7** | 2022 | Performance, Native AOT GA, rate limiting |
| **.NET 8** | 2023 | **LTS**, Blazor United, Native AOT improvements, Aspire |
| **.NET 9** | 2024 | Performance, AI integration, Hybrid Cache |
| **.NET 10** | 2025 | **LTS**, further AOT, cloud-native enhancements |

**Key insight**: .NET Framework (Windows-only, legacy) vs .NET (cross-platform, modern). All new development should target .NET 8+.

## Runtime Architecture

```
C# Source Code (.cs)
    ↓
Roslyn Compiler (compile-time)
    ↓
IL (Intermediate Language) — .dll assemblies
    ↓
CoreCLR Runtime (execution)
├── RyuJIT — JIT compiler (IL → native code)
│   ├── Tiered Compilation (Tier 0 → Tier 1)
│   ├── On-Stack Replacement (OSR)
│   ├── Dynamic PGO (Profile-Guided Optimization)
│   └── Hardware intrinsics (SIMD, AVX, etc.)
├── GC — Garbage Collector
│   ├── Generational (Gen 0/1/2)
│   ├── Server GC vs Workstation GC
│   ├── Regions-based (modern .NET)
│   └── Pinned Object Heap
├── Type System — reflection, generics (reified)
├── Thread Pool — work-stealing, I/O completion ports
└── Interop — P/Invoke, COM, C++/CLI

Alternative: Native AOT (ahead-of-time compilation)
├── No JIT at runtime — direct native binary
├── Smaller footprint, instant startup
├── No reflection (trimmed)
└── Ideal for microservices, serverless, CLI tools
```

### Key Runtime Differences from JVM

| Feature | .NET (CoreCLR) | JVM (HotSpot) |
|---------|---------------|---------------|
| Generics | **Reified** (preserved at runtime) | Type-erased |
| Value types | **First-class** (struct on stack) | Objects only (Project Valhalla pending) |
| JIT | RyuJIT (fast, single-pass) | C2 (slower, higher peak optimization) |
| AOT | **Native AOT** (GA since .NET 7) | GraalVM Native Image |
| Startup | ~100ms (JIT), ~10ms (AOT) | ~500ms-3s |
| Async | **async/await** (first-class, since 2012) | Virtual Threads (2023) |

## Type System

### Overview

| Feature | Support |
|---------|---------|
| Paradigm | Multi-paradigm (OOP + functional + imperative) |
| Typing | **Static**, strong, nominative |
| Null safety | **Nullable Reference Types** (NRT, C# 8+) — opt-in |
| Generics | **Reified** — full runtime type information |
| Type inference | `var` (local), target-typed `new`, lambda parameters |
| Pattern matching | Type patterns, property patterns, list patterns, relational |
| Value types | `struct`, `record struct` — stack-allocated, no GC overhead |
| Algebraic types | Records + `required` + sealed hierarchies |

### Nullable Reference Types (NRT)

```csharp
// Enable in project: <Nullable>enable</Nullable>

string name = "Alice";     // Non-nullable — compiler warns on null assignment
string? nickname = null;    // Nullable — explicit opt-in

// Null-forgiving operator (when YOU know better)
string definitelyNotNull = GetValue()!;

// Pattern matching with null checks
if (nickname is { Length: > 0 } nick)
{
    Console.WriteLine($"Nickname: {nick}");
}
```

### Records

```csharp
// Immutable reference type with value semantics
public record User(string Name, string Email, int Age);

// With validation
public record User(string Name, string Email, int Age)
{
    public string Email { get; init; } = Email.ToLowerInvariant();

    // Compact validation
    public User
    {
        ArgumentException.ThrowIfNullOrEmpty(Name);
        ArgumentOutOfRangeException.ThrowIfNegative(Age);
    }
}

// Non-destructive mutation
var alice = new User("Alice", "alice@example.com", 30);
var older = alice with { Age = 31 };

// Record struct (value type, stack-allocated)
public readonly record struct Point(double X, double Y);
```

### Pattern Matching (C# 8-13)

```csharp
// Switch expression with multiple pattern types
string Classify(object obj) => obj switch
{
    int n when n < 0     => "negative",
    int n                => $"positive int: {n}",
    string { Length: 0 } => "empty string",
    string s             => $"string: {s}",
    null                 => "null",
    _                    => "unknown"
};

// List patterns (C# 11)
int[] numbers = [1, 2, 3, 4, 5];
var result = numbers switch
{
    [1, 2, .., 5]        => "starts with 1,2 ends with 5",
    [_, _, _, ..]        => "at least 3 elements",
    []                   => "empty",
    _                    => "other"
};

// Property patterns (nested)
bool IsEligible(Person p) => p is
{
    Age: >= 18 and <= 65,
    Address.Country: "US" or "CA",
    Employment: { Status: EmploymentStatus.Active }
};
```

## Modern C# Features (C# 10-14)

### Primary Constructors (C# 12)

```csharp
// Before (verbose)
public class UserService
{
    private readonly IUserRepository _repo;
    private readonly ILogger<UserService> _logger;

    public UserService(IUserRepository repo, ILogger<UserService> logger)
    {
        _repo = repo;
        _logger = logger;
    }
}

// After — primary constructor
public class UserService(IUserRepository repo, ILogger<UserService> logger)
{
    public async Task<User?> GetUser(int id)
    {
        logger.LogInformation("Getting user {Id}", id);
        return await repo.FindByIdAsync(id);
    }
}
```

### Collection Expressions (C# 12)

```csharp
// Unified syntax for all collection types
int[] array = [1, 2, 3];
List<int> list = [1, 2, 3];
Span<int> span = [1, 2, 3];
ImmutableArray<int> immutable = [1, 2, 3];

// Spread operator
int[] combined = [..array, 4, 5, ..list];
```

### LINQ (Language Integrated Query)

```csharp
// Fluent LINQ — one of C#'s most powerful features
var topCustomers = orders
    .Where(o => o.Date >= DateTime.Now.AddMonths(-6))
    .GroupBy(o => o.CustomerId)
    .Select(g => new
    {
        CustomerId = g.Key,
        TotalSpent = g.Sum(o => o.Amount),
        OrderCount = g.Count()
    })
    .Where(c => c.TotalSpent > 1000)
    .OrderByDescending(c => c.TotalSpent)
    .Take(10);

// Query syntax (SQL-like)
var query = from o in orders
            where o.Date >= DateTime.Now.AddMonths(-6)
            group o by o.CustomerId into g
            let total = g.Sum(o => o.Amount)
            where total > 1000
            orderby total descending
            select new { CustomerId = g.Key, TotalSpent = total };
```

## Async/Await Model

C# was the **first mainstream language** to implement async/await (2012). JavaScript, Python, Rust, Kotlin, and Swift all adopted similar syntax later.

```csharp
// Task-based async pattern (TAP)
public async Task<User> GetUserAsync(int id, CancellationToken ct = default)
{
    var response = await _httpClient.GetAsync($"/users/{id}", ct);
    response.EnsureSuccessStatusCode();
    return await response.Content.ReadFromJsonAsync<User>(ct)
        ?? throw new InvalidOperationException("Null response");
}

// Parallel async operations
public async Task<Dashboard> GetDashboardAsync(int userId, CancellationToken ct)
{
    var profileTask = GetProfileAsync(userId, ct);
    var ordersTask = GetOrdersAsync(userId, ct);
    var statsTask = GetStatsAsync(userId, ct);

    await Task.WhenAll(profileTask, ordersTask, statsTask);

    return new Dashboard(profileTask.Result, ordersTask.Result, statsTask.Result);
}

// Async streams (IAsyncEnumerable)
public async IAsyncEnumerable<LogEntry> StreamLogsAsync(
    [EnumeratorCancellation] CancellationToken ct = default)
{
    await foreach (var line in ReadLinesAsync(ct))
    {
        yield return ParseLogEntry(line);
    }
}
```

### ValueTask vs Task

| Feature | `Task<T>` | `ValueTask<T>` |
|---------|----------|----------------|
| Allocation | Always heap-allocated | Stack-allocated when sync |
| Use when | Result usually async | Result often cached/sync |
| Await multiple | Yes | **No** (single await only) |
| Hot path | Allocates each call | Zero allocation if sync |

## Generics — Reified (Unlike Java)

```csharp
// .NET generics preserve type information at runtime
public class Repository<T> where T : class, IEntity
{
    // T is known at runtime — no type erasure
    public string GetTableName() => typeof(T).Name;

    // Can create instances of T
    public T CreateInstance() => Activator.CreateInstance<T>();

    // Can use T in runtime checks
    public bool IsMatch(object obj) => obj is T;
}

// Generic math (C# 11, .NET 7+)
public static T Sum<T>(IEnumerable<T> values) where T : INumber<T>
{
    T sum = T.Zero;
    foreach (var value in values)
        sum += value;
    return sum;
}

Sum(new[] { 1, 2, 3 });           // int
Sum(new[] { 1.5, 2.5, 3.5 });     // double
Sum(new[] { 1m, 2m, 3m });        // decimal
```

## Dependency Injection (Built-in)

```csharp
// .NET has built-in DI — no third-party container needed
var builder = WebApplication.CreateBuilder(args);

// Service registration
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddSingleton<ICacheService, RedisCacheService>();
builder.Services.AddTransient<IEmailService, SmtpEmailService>();

// Keyed services (.NET 8)
builder.Services.AddKeyedSingleton<ICache>("redis", new RedisCache());
builder.Services.AddKeyedSingleton<ICache>("memory", new MemoryCache());

var app = builder.Build();
```

## Deployment Models

| Model | Startup | Size | Compatibility | Use Case |
|-------|---------|------|--------------|----------|
| **Framework-dependent** | ~100ms | ~5MB | Needs .NET runtime | Server apps |
| **Self-contained** | ~100ms | ~70MB | Includes runtime | Portable deployment |
| **Native AOT** | **~10ms** | ~10-30MB | Trimmed, no reflection | Serverless, CLI, microservices |
| **Single-file** | ~100ms | ~70MB | One executable | Simple distribution |

## .NET Aspire (Cloud-Native Stack)

```csharp
// .NET Aspire — orchestration for distributed apps (.NET 8+)
var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache");
var postgres = builder.AddPostgres("db").AddDatabase("catalog");
var messaging = builder.AddRabbitMQ("messaging");

var catalogApi = builder.AddProject<Projects.CatalogApi>("catalog-api")
    .WithReference(postgres)
    .WithReference(cache);

builder.AddProject<Projects.WebFrontend>("web")
    .WithReference(catalogApi)
    .WithReference(messaging);

builder.Build().Run();
// Automatic: service discovery, health checks, telemetry, dashboard
```

## Sources

- [C# Language Reference](https://learn.microsoft.com/en-us/dotnet/csharp/)
- [.NET Documentation](https://learn.microsoft.com/en-us/dotnet/)
- [What's New in C#](https://learn.microsoft.com/en-us/dotnet/csharp/whats-new/)
- [.NET Blog](https://devblogs.microsoft.com/dotnet/)
- [.NET Aspire](https://learn.microsoft.com/en-us/dotnet/aspire/)
