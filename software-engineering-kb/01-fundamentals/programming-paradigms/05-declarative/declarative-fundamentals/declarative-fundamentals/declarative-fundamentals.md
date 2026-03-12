# Declarative Programming

> **Domain:** Fundamentals > Programming Paradigms > Declarative
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Declarative programming describes **what** the desired result is, not **how** to compute it step by step. The runtime, compiler, or engine decides the execution strategy. This abstraction often enables powerful optimizations that would be difficult to achieve manually.

**Key Principle:** Describe the output, not the process. Let the system figure out the best execution path.

## How It Works

```sql
-- SQL — the most successful declarative language
-- WHAT: "give me active users sorted by name"
-- HOW:  the database optimizer decides (index scan? hash join? parallel?)
SELECT u.name, u.email, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.active = true
GROUP BY u.id, u.name, u.email
HAVING COUNT(o.id) > 5
ORDER BY u.name;
```

```html
<!-- HTML/CSS — declarative UI -->
<!-- WHAT: a centered card with a shadow -->
<div class="card">
  <h2>Title</h2>
  <p>Content here</p>
</div>

<style>
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}
</style>
```

```typescript
// React JSX — declarative UI
function UserList({ users }: { users: User[] }) {
  // WHAT the UI should look like — React decides how to update the DOM
  return (
    <ul>
      {users
        .filter(u => u.active)
        .map(u => <li key={u.id}>{u.name} ({u.email})</li>)}
    </ul>
  );
}
```

```hcl
# Terraform — declarative infrastructure
resource "aws_instance" "web" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.micro"
  tags = { Name = "web-server" }
}

# WHAT: "I want a t3.micro EC2 instance with this AMI"
# HOW:  Terraform figures out create/update/delete to reach desired state
```

```yaml
# Kubernetes — declarative container orchestration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    spec:
      containers:
      - name: api
        image: myapp:v2.1
        ports:
        - containerPort: 8080
# WHAT: "3 replicas of this container"
# HOW:  Kubernetes handles scheduling, scaling, health checks
```

### Declarative vs Imperative

```typescript
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// IMPERATIVE — how to compute it step by step
let sum = 0;
for (let i = 0; i < numbers.length; i++) {
  if (numbers[i] % 2 === 0) {
    sum += numbers[i] * numbers[i];
  }
}

// DECLARATIVE — what we want
const sum2 = numbers
  .filter(n => n % 2 === 0)
  .map(n => n * n)
  .reduce((a, b) => a + b, 0);

// Same result, but declarative version:
// - Reads like a specification
// - Can be optimized by the engine (parallelized, lazy evaluated)
// - Easier to understand intent
```

### Declarative Languages Spectrum

```
Pure Declarative                                    Pure Imperative
     ←─────────────────────────────────────────────→
SQL  HTML  CSS  Regex  Terraform  Prolog  Haskell  Python  Java  C  Assembly

Most practical languages sit somewhere in the middle.
Modern trend: adding declarative features to imperative languages.
```

## Real-world Examples

- **SQL** — database queries describe what data to retrieve.
- **HTML/CSS** — describe what the page looks like.
- **React/Vue/SwiftUI** — declarative UI frameworks.
- **Terraform/Pulumi** — declarative infrastructure as code.
- **Kubernetes YAML** — declarative container orchestration.
- **GraphQL** — declarative data fetching.
- **Regular expressions** — declarative pattern matching.
- **Make/Gradle** — declarative build systems.

## Sources

- Lloyd, J.W. (1987). *Foundations of Logic Programming*. 2nd ed. Springer.
- [Wikipedia — Declarative Programming](https://en.wikipedia.org/wiki/Declarative_programming)
