# Domain-Specific Languages (DSLs)

> **Domain:** Fundamentals > Programming Paradigms > Declarative
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

A Domain-Specific Language (DSL) is a language **designed for a particular problem domain**, as opposed to a general-purpose language (GPL) like Python or Java. DSLs sacrifice generality for expressiveness, readability, and productivity within their domain. They range from standalone languages (SQL, HTML) to embedded APIs within host languages (fluent builders, query builders).

## Types of DSLs

### External DSLs — Standalone Languages

```sql
-- SQL — data querying DSL
SELECT department, AVG(salary) as avg_salary
FROM employees
WHERE hire_date > '2020-01-01'
GROUP BY department
HAVING AVG(salary) > 80000
ORDER BY avg_salary DESC;
```

```regex
# Regular expressions — pattern matching DSL
^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$     # date: YYYY-MM-DD
^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$  # email validation
```

```graphql
# GraphQL — API query DSL
query GetUser($id: ID!) {
  user(id: $id) {
    name
    email
    posts(first: 10, orderBy: CREATED_AT_DESC) {
      title
      createdAt
      comments { count }
    }
  }
}
```

```hcl
# Terraform HCL — infrastructure DSL
resource "aws_lambda_function" "api" {
  function_name = "my-api"
  runtime       = "nodejs18.x"
  handler       = "index.handler"
  memory_size   = 256
  timeout       = 30
  environment {
    variables = { DB_HOST = var.db_host }
  }
}
```

### Internal DSLs — Embedded in Host Languages

```typescript
// TypeScript — fluent query builder (internal DSL)
const results = await db
  .select("users.name", "orders.total")
  .from("users")
  .join("orders", "orders.user_id", "users.id")
  .where("users.active", true)
  .where("orders.total", ">", 100)
  .orderBy("orders.total", "desc")
  .limit(10);

// Test assertion DSL
expect(user.name).toBe("Alice");
expect(items).toHaveLength(3);
expect(result).toMatchObject({ status: "ok", code: 200 });
```

```python
# Python — SQLAlchemy query DSL
users = (
    session.query(User)
    .filter(User.active == True)
    .filter(User.age >= 18)
    .order_by(User.name.asc())
    .limit(50)
    .all()
)

# pytest DSL
def test_transfer():
    account = BankAccount(balance=1000)
    account.withdraw(200)
    assert account.balance == 800
    with pytest.raises(ValueError, match="Insufficient"):
        account.withdraw(900)
```

```groovy
// Gradle — build automation DSL (Groovy/Kotlin)
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.2.0'
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}

tasks.named('test') {
    useJUnitPlatform()
}
```

### Building an Internal DSL

```typescript
// Fluent builder pattern — creating a DSL for HTTP requests
class RequestBuilder {
  private config: RequestConfig = { method: "GET", headers: {} };

  get(url: string): this    { this.config.method = "GET"; this.config.url = url; return this; }
  post(url: string): this   { this.config.method = "POST"; this.config.url = url; return this; }
  header(key: string, value: string): this { this.config.headers[key] = value; return this; }
  body(data: any): this     { this.config.body = data; return this; }
  timeout(ms: number): this { this.config.timeout = ms; return this; }

  async send(): Promise<Response> { return fetch(this.config.url!, this.config); }
}

// Usage reads like a specification
const response = await new RequestBuilder()
  .post("https://api.example.com/users")
  .header("Authorization", "Bearer token")
  .body({ name: "Alice", email: "alice@example.com" })
  .timeout(5000)
  .send();
```

### External vs Internal DSLs

```
                    External DSL              Internal DSL
──────────────────────────────────────────────────────────
Syntax              Custom parser             Host language syntax
Learning curve      New syntax to learn       Familiar host language
Tooling             Must build from scratch   IDE support from host
Flexibility         Unlimited syntax          Limited by host grammar
Examples            SQL, HTML, Regex, YAML    Fluent APIs, builders
Build effort        High (parser/lexer)       Low (just API design)
```

## Real-world Examples

- **SQL** — universal database query language (1974).
- **HTML/CSS** — web content and styling (1993/1996).
- **Regular expressions** — pattern matching (1951, Ken Thompson).
- **GraphQL** — Facebook's API query language (2015).
- **Terraform HCL** — infrastructure as code (HashiCorp).
- **Dockerfile** — container image definition.
- **Makefile** — build automation.
- **YAML/JSON/TOML** — configuration DSLs.
- **Jest/Mocha** — testing DSLs with `describe`/`it`/`expect`.

## Sources

- Fowler, M. (2010). *Domain-Specific Languages*. Addison-Wesley.
- [Martin Fowler — DSL](https://martinfowler.com/books/dsl.html)
- [Wikipedia — Domain-Specific Language](https://en.wikipedia.org/wiki/Domain-specific_language)
