# Microsoft's Clean Code Standards

> **Domain:** Fundamentals > Clean Code > Industry Standards
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Microsoft publishes comprehensive coding standards for the .NET ecosystem, TypeScript, and their API design guidelines. Their standards have shaped how millions of developers write C#, .NET, and TypeScript code.

### Key Resources

- *.NET Coding Conventions* (Microsoft Learn documentation)
- *Framework Design Guidelines* (Cwalina & Abrams) — the "bible" for .NET API design
- *Microsoft REST API Guidelines* (GitHub)
- TypeScript coding guidelines (from the TypeScript team)
- Roslyn Analyzers — built-in code analysis for .NET

## How It Works

### .NET/C# Conventions

```csharp
// Microsoft C# naming conventions
public class CustomerService                    // PascalCase classes
{
    private readonly ILogger _logger;           // _camelCase private fields
    private const int MaxRetries = 3;           // PascalCase constants
    public string FirstName { get; set; }       // PascalCase properties

    public async Task<Customer> GetByIdAsync(   // PascalCase methods
        int customerId)                         // camelCase parameters
    {
        var customer = await _repository        // var for obvious types
            .FindAsync(customerId);
        return customer;
    }
}
```

### Framework Design Guidelines

The "FDG" establishes rules for designing reusable .NET libraries:
- **DO** use PascalCase for all public members.
- **DO** prefix interfaces with `I` (`IDisposable`, `IEnumerable`).
- **DO NOT** use Hungarian notation.
- **DO** prefer exceptions over error codes.
- **DO** make types as immutable as possible.
- **DO NOT** use `out` or `ref` parameters in public APIs.

### Microsoft REST API Guidelines

```
GET    /users/{id}          → 200 OK with user
POST   /users               → 201 Created with location header
PUT    /users/{id}          → 200 OK (full replace)
PATCH  /users/{id}          → 200 OK (partial update)
DELETE /users/{id}          → 204 No Content

Error response format:
{
  "error": {
    "code": "InvalidArgument",
    "message": "The 'email' field is not a valid email address.",
    "target": "email"
  }
}
```

### Built-in Code Analysis

.NET ships with Roslyn Analyzers that enforce coding standards at compile time:

```xml
<!-- .editorconfig for .NET projects -->
[*.cs]
dotnet_naming_rule.private_fields_should_be_camel_case.severity = warning
dotnet_naming_style.begins_with_underscore.required_prefix = _

# Code quality rules
dotnet_diagnostic.CA1062.severity = warning  # Validate arguments
dotnet_diagnostic.CA2007.severity = warning  # ConfigureAwait
dotnet_diagnostic.CA1822.severity = suggestion  # Mark static
```

## Key Takeaways

1. **Consistent naming is paramount** — Microsoft's PascalCase convention is one of the most recognized in the industry.
2. **Design APIs carefully** — Framework Design Guidelines apply to any public API, not just .NET.
3. **Use built-in analysis tools** — Roslyn analyzers catch issues at compile time.
4. **Follow REST conventions** — Microsoft's REST guidelines are a solid reference for any API.

## Sources

- [.NET Coding Conventions (Microsoft Learn)](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions)
- Cwalina, K. & Abrams, B. (2008). *Framework Design Guidelines* (2nd ed.). Addison-Wesley.
- [Microsoft REST API Guidelines (GitHub)](https://github.com/microsoft/api-guidelines)
- [.NET Runtime Coding Style](https://github.com/dotnet/runtime/blob/main/docs/coding-guidelines/coding-style.md)
