# Aspect-Oriented Programming (AOP)

> **Domain:** Fundamentals > Programming Paradigms > Aspect-Oriented
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

AOP separates **cross-cutting concerns** — functionality that spans multiple modules but doesn't belong in any single one — into modular units called **aspects**. Without AOP, concerns like logging, security, caching, and transactions get scattered across business logic. AOP weaves these concerns in declaratively, keeping business code clean.

**Origin:** Developed by Gregor Kiczales et al. at Xerox PARC (1997). AspectJ was the first implementation.

## Key Concepts

```
Aspect:       Module encapsulating a cross-cutting concern (e.g., LoggingAspect)
Join Point:   A point during execution (method call, field access, exception)
Pointcut:     Expression selecting which join points to intercept
Advice:       Code executed at a join point (before, after, around)
Weaving:      Process of integrating aspects into the code
              - Compile-time (AspectJ)
              - Load-time (agent-based)
              - Runtime (Spring AOP proxies)
```

## How It Works

### Spring AOP (Java)

```java
import org.aspectj.lang.annotation.*;
import org.aspectj.lang.ProceedingJoinPoint;

// Aspect: modular logging concern
@Aspect
@Component
public class LoggingAspect {

    // Pointcut: which methods to intercept
    @Pointcut("execution(* com.example.service.*.*(..))")
    public void serviceLayer() {}

    // Before advice: runs before the method
    @Before("serviceLayer()")
    public void logEntry(JoinPoint jp) {
        log.info("→ {}.{}({})",
            jp.getTarget().getClass().getSimpleName(),
            jp.getSignature().getName(),
            Arrays.toString(jp.getArgs()));
    }

    // After returning advice: runs after successful return
    @AfterReturning(pointcut = "serviceLayer()", returning = "result")
    public void logExit(JoinPoint jp, Object result) {
        log.info("← {}.{} returned: {}",
            jp.getTarget().getClass().getSimpleName(),
            jp.getSignature().getName(),
            result);
    }

    // Around advice: wraps the entire method (most powerful)
    @Around("@annotation(Timed)")  // methods annotated with @Timed
    public Object measureTime(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.nanoTime();
        try {
            return pjp.proceed();  // call original method
        } finally {
            long elapsed = System.nanoTime() - start;
            log.info("{} took {}ms", pjp.getSignature().getName(), elapsed / 1_000_000);
        }
    }
}

// Transaction aspect — declarative transaction management
@Aspect
@Component
public class TransactionAspect {

    @Around("@annotation(Transactional)")
    public Object manageTransaction(ProceedingJoinPoint pjp) throws Throwable {
        Transaction tx = txManager.begin();
        try {
            Object result = pjp.proceed();
            tx.commit();
            return result;
        } catch (Exception e) {
            tx.rollback();
            throw e;
        }
    }
}

// Business code stays clean — no logging/transaction code mixed in
@Service
public class OrderService {

    @Timed
    @Transactional
    public Order placeOrder(OrderRequest request) {
        // Pure business logic — no cross-cutting concerns
        Order order = Order.from(request);
        orderRepo.save(order);
        inventoryService.reserve(order.getItems());
        return order;
    }
}
```

### Python AOP with Decorators

```python
import functools
import time
import logging

# Aspect: timing concern
def timed(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        logging.info(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper

# Aspect: caching concern
def cached(ttl_seconds: int = 300):
    def decorator(func):
        cache = {}
        @functools.wraps(func)
        def wrapper(*args):
            if args in cache:
                value, timestamp = cache[args]
                if time.time() - timestamp < ttl_seconds:
                    return value
            result = func(*args)
            cache[args] = (result, time.time())
            return result
        return wrapper
    return decorator

# Aspect: authorization concern
def require_role(role: str):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if role not in user.roles:
                raise PermissionError(f"Requires role: {role}")
            return func(*args, **kwargs)
        return wrapper
    return decorator

# Business logic — clean, concerns separated
class UserService:
    @timed
    @cached(ttl_seconds=60)
    @require_role("admin")
    def get_all_users(self) -> list[User]:
        return self.repo.find_all()
```

### AOP vs Alternatives

```
Approach              How                        Trade-off
──────────────────────────────────────────────────────────
AOP (Spring)          Proxy-based interception   Powerful but implicit
Decorators (Python)   Function wrapping          Explicit but manual
Middleware (Express)   Pipeline interception      HTTP-specific
Higher-order fns      Function composition       Flexible but scattered
DI + interfaces       Wrapper implementations    Verbose but clear
```

## Real-world Examples

- **Spring AOP** — `@Transactional`, `@Cacheable`, `@Secured`, `@Async`.
- **AspectJ** — full AOP for Java with compile-time weaving.
- **Python decorators** — logging, caching, auth, rate limiting.
- **TypeScript decorators** — NestJS guards, interceptors, pipes.
- **PostSharp (.NET)** — compile-time AOP for C#.

## Sources

- Kiczales, G. et al. (1997). "Aspect-Oriented Programming." *ECOOP*. Springer.
- [Spring AOP Documentation](https://docs.spring.io/spring-framework/reference/core/aop.html)
- Laddad, R. (2009). *AspectJ in Action*. 2nd ed. Manning.
