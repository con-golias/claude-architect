# C#/.NET: Ecosystem

> **Domain:** Languages > C#/.NET
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2026-03

## Ecosystem Overview

The .NET ecosystem is one of the **most comprehensive enterprise platforms**, with NuGet hosting 400K+ packages. C#/.NET powers Windows desktop, web backend, cloud services, game development (Unity), and increasingly cross-platform mobile/desktop via MAUI.

## Web Frameworks

### ASP.NET Core

| Feature | ASP.NET Core MVC | Minimal APIs | Blazor |
|---------|-----------------|-------------|--------|
| Style | MVC controllers | Functional endpoints | Component-based |
| Lines for API | ~20 (controller + action) | ~3 | N/A |
| Best for | Large apps, teams | Microservices, small APIs | Full-stack C# (no JS) |
| Performance | Very good (~200K req/s) | Excellent (~300K req/s) | Good (WASM), Excellent (Server) |
| Learning curve | Medium | Low | Medium |

```csharp
// Minimal API (.NET 6+) — concise HTTP APIs
var app = WebApplication.CreateBuilder(args).Build();

app.MapGet("/users/{id}", async (int id, IUserService service) =>
    await service.GetAsync(id) is User user
        ? Results.Ok(user)
        : Results.NotFound());

app.MapPost("/users", async (CreateUserRequest req, IUserService service) =>
{
    var user = await service.CreateAsync(req);
    return Results.Created($"/users/{user.Id}", user);
});

app.Run();
```

### Blazor Rendering Modes (.NET 8)

| Mode | Rendering | Interactivity | Use Case |
|------|-----------|--------------|----------|
| **Static SSR** | Server | None (static HTML) | Content pages, SEO |
| **Interactive Server** | Server (SignalR) | Real-time via WebSocket | Internal apps, dashboards |
| **Interactive WebAssembly** | Client (WASM) | Client-side | Offline-capable, PWA |
| **Auto** | Server → WASM | Switches after download | Best of both worlds |

### Other Web Frameworks

| Framework | Type | Key Feature |
|-----------|------|-------------|
| **Carter** | Minimal API extensions | Nancy-inspired routing |
| **FastEndpoints** | REPR pattern | Vertical slices, high performance |
| **ServiceStack** | Full-stack | Auto-generated clients, gRPC |
| **Wolverine** | Mediator + messaging | CQRS, Marten integration |
| **Hot Chocolate** | GraphQL | Schema-first or code-first |

## ASP.NET Core Architecture

```
ASP.NET Core Application
├── Middleware Pipeline
│   ├── Exception handling
│   ├── HTTPS redirection
│   ├── Authentication / Authorization
│   ├── CORS
│   ├── Rate limiting (.NET 7+)
│   ├── Output caching (.NET 7+)
│   └── Routing → Endpoints
├── Dependency Injection (built-in)
├── Configuration (appsettings, env vars, Azure Key Vault)
├── Logging (ILogger, Serilog, NLog)
├── Health Checks
├── OpenTelemetry integration
└── Hosting
    ├── Kestrel (cross-platform HTTP server)
    ├── IIS (Windows)
    └── Container (Docker/Kubernetes)
```

## ORM & Data Access

| Library | Type | Key Feature | Performance |
|---------|------|-------------|-------------|
| **Entity Framework Core** | Full ORM | LINQ to SQL, migrations, change tracking | Good |
| **Dapper** | Micro-ORM | Raw SQL with object mapping | Excellent |
| **EF Core + compiled queries** | ORM | Pre-compiled LINQ queries | Very Good |
| **LINQ to DB** | ORM | Direct LINQ translation, no change tracking | Very Good |
| **Marten** | Document DB | PostgreSQL as document DB + event store | Good |
| **Npgsql** | Raw driver | PostgreSQL ADO.NET provider | Best |

```csharp
// Entity Framework Core — LINQ queries
var users = await context.Users
    .Where(u => u.IsActive)
    .OrderBy(u => u.Name)
    .Select(u => new UserDto(u.Id, u.Name, u.Email))
    .ToListAsync(ct);

// Dapper — raw SQL with mapping
var users = await connection.QueryAsync<User>(
    "SELECT * FROM Users WHERE IsActive = @Active ORDER BY Name",
    new { Active = true });
```

## Testing Ecosystem

| Tool | Type | Key Feature |
|------|------|-------------|
| **xUnit** | Test framework | Most popular, .NET team uses it |
| **NUnit** | Test framework | Mature, constraint model |
| **MSTest** | Test framework | Microsoft official |
| **Moq** | Mocking | Most popular .NET mock library |
| **NSubstitute** | Mocking | Friendlier syntax than Moq |
| **FluentAssertions** | Assertions | `result.Should().Be(42)` |
| **Verify** | Snapshot testing | Approval-based testing |
| **Testcontainers** | Integration testing | Docker-based test dependencies |
| **Bogus** | Test data | Fake data generation |
| **ArchUnitNET** | Architecture testing | Enforce architecture rules in tests |
| **Playwright** | E2E testing | Browser automation (Microsoft) |
| **WireMock.Net** | HTTP mocking | Mock external HTTP dependencies |
| **Respawn** | DB cleanup | Fast database reset between tests |

## Cloud & Azure Integration

| Service | NuGet Package | Purpose |
|---------|--------------|---------|
| **Azure SDK** | Azure.* | Unified SDK for all Azure services |
| **Azure Functions** | Microsoft.Azure.Functions | Serverless compute |
| **Azure Service Bus** | Azure.Messaging.ServiceBus | Message queuing |
| **Azure Cosmos DB** | Microsoft.Azure.Cosmos | Global NoSQL database |
| **Azure Key Vault** | Azure.Security.KeyVault | Secrets management |
| **Azure SignalR** | Microsoft.Azure.SignalR | Real-time communication |
| **.NET Aspire** | Aspire.* | Cloud-native orchestration |

**Note**: While .NET works with AWS/GCP, Azure integration is deepest — Microsoft builds both.

## Messaging & Background Processing

| Library | Type | Key Feature |
|---------|------|-------------|
| **MassTransit** | Message bus | RabbitMQ, Azure SB, Kafka abstraction |
| **NServiceBus** | Enterprise messaging | Saga pattern, commercial |
| **Wolverine** | Mediator + messaging | CQRS, durable messaging |
| **MediatR** | Mediator | In-process CQRS (no messaging) |
| **Hangfire** | Background jobs | Dashboard, recurring jobs |
| **Quartz.NET** | Job scheduling | Cron-based scheduling |
| **Azure Functions** | Serverless | Event-driven compute |

## Desktop & Mobile

| Framework | Platform | Status |
|-----------|----------|--------|
| **.NET MAUI** | iOS, Android, Windows, macOS | Microsoft's cross-platform UI |
| **WPF** | Windows | Mature desktop (XAML-based) |
| **WinForms** | Windows | Legacy but still supported |
| **WinUI 3** | Windows | Modern Windows UI |
| **Avalonia UI** | Cross-platform | WPF-like, truly cross-platform |
| **Uno Platform** | All platforms | WinUI API on all platforms |
| **Unity** | Games | C# as scripting language |

## Game Development

| Engine | Language | Market |
|--------|----------|--------|
| **Unity** | C# | ~50% of all games, 70% mobile games |
| **Godot** | C# + GDScript | Growing open-source alternative |
| **Stride** | C# | Open-source 3D engine |
| **MonoGame** | C# | XNA successor, 2D games |

**Unity's C# adoption** makes C# one of the most popular game development languages worldwide.

## Serialization

| Library | Format | Performance | Key Feature |
|---------|--------|-------------|-------------|
| **System.Text.Json** | JSON | Best (built-in) | Source generators, AOT-friendly |
| **Newtonsoft.Json** | JSON | Good | Most features, most popular |
| **MessagePack-CSharp** | Binary | Excellent | Fast binary serialization |
| **protobuf-net** | Protobuf | Excellent | Google Protocol Buffers |

## Observability

| Tool | Type | Key Feature |
|------|------|-------------|
| **OpenTelemetry .NET** | Tracing + Metrics | CNCF standard, built-in support |
| **Serilog** | Structured logging | Sinks for every destination |
| **Application Insights** | APM | Azure-native monitoring |
| **Prometheus-net** | Metrics | Prometheus exporter |
| **Seq** | Log aggregation | Structured log search (Serilog) |
| **Elastic APM** | APM | Elasticsearch-based |

## Build & Package Management

| Tool | Purpose | Key Feature |
|------|---------|-------------|
| **dotnet CLI** | Build, run, publish | Built-in, cross-platform |
| **NuGet** | Package management | 400K+ packages |
| **MSBuild** | Build system | XML-based, powerful |
| **Central Package Management** | Version pinning | Directory.Packages.props |

## NuGet Statistics

| Metric | Value (2025) |
|--------|-------------|
| Total packages | ~400K+ |
| Total downloads | 300B+ cumulative |
| Most downloaded | Newtonsoft.Json (3B+), Serilog, xUnit, FluentAssertions |
| Package format | .nupkg (NuGet), global tools |

## Sources

- [NuGet Gallery](https://www.nuget.org/)
- [ASP.NET Core Documentation](https://learn.microsoft.com/en-us/aspnet/core/)
- [.NET Blog](https://devblogs.microsoft.com/dotnet/)
- [Awesome .NET](https://github.com/quozd/awesome-dotnet)
