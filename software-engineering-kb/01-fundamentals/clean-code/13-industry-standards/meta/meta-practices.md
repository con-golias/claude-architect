# Meta (Facebook) Clean Code Practices

> **Domain:** Fundamentals > Clean Code > Industry Standards
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Meta (formerly Facebook) has contributed significantly to the clean code ecosystem through tools, frameworks, and engineering practices. Their philosophy emphasizes **move fast with stable infrastructure** — a maturation of the earlier "move fast and break things."

### Key Contributions to Clean Code

| Tool/Framework | Purpose | Impact |
|----------------|---------|--------|
| **React** | UI component library | Composition over inheritance, declarative UI |
| **Jest** | JavaScript testing framework | Fast, zero-config testing |
| **Prettier** | Code formatter | Opinionated formatting (co-created) |
| **Flow** | JavaScript type checker | Static typing for JS (precursor to TS adoption) |
| **Infer** | Static analysis | Catches null pointers, memory leaks, race conditions |
| **Hack** | Typed PHP | Added type safety to Facebook's PHP codebase |

## How It Works

### React Component Patterns (Clean Code in UI)

Meta's React team explicitly recommends **composition over inheritance**:

> "At Facebook, we use React in thousands of components, and we haven't found any use cases where we would recommend creating component inheritance hierarchies."

```tsx
// Meta's recommended patterns:

// 1. Composition via children
function Card({ children, title }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

// 2. Custom hooks for logic reuse (not HOCs or inheritance)
function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { /* auth logic */ }, []);
  return { user, isAuthenticated: !!user };
}

// 3. Separation: data fetching hook + pure component
function UserProfile() {
  const { user } = useUser(userId);
  if (!user) return <Skeleton />;
  return <ProfileView user={user} />;
}
```

### Infer Static Analysis

Infer catches bugs that other tools miss — null pointer dereferences, memory leaks, thread safety issues. It runs on millions of lines of code at Meta and is open source.

### Testing Culture (Jest)

Meta created Jest to make testing **fast and zero-configuration**:
- Parallel test execution
- Snapshot testing for UI components
- Built-in mocking
- Watch mode for developer productivity

### Code Review at Meta

- Strong code review culture with focus on **readability and correctness**
- Internal tools for large-scale code changes (codemods)
- Automated code quality checks integrated into the review process

## Key Takeaways

1. **Composition over inheritance** — React proves this at massive scale.
2. **Invest in developer tools** — Jest, Prettier, Infer all improve code quality automatically.
3. **Static analysis at scale** — Infer catches bugs that testing alone misses.
4. **Testing should be fast and easy** — if tests are slow or painful to write, developers won't write them.

## Sources

- [React Documentation — Composition vs Inheritance](https://react.dev/learn)
- [Infer Static Analyzer (GitHub)](https://github.com/facebook/infer)
- [Jest Testing Framework](https://jestjs.io/)
- [React & Next.js 2025 Best Practices (Strapi)](https://strapi.io/blog/react-and-nextjs-in-2025-modern-best-practices)
