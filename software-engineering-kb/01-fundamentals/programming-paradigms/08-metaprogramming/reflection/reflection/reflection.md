# Reflection

> **Domain:** Fundamentals > Programming Paradigms > Metaprogramming
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Reflection is the ability of a program to **inspect and modify its own structure and behavior at runtime**. A reflective program can examine types, discover methods, read annotations, create instances dynamically, and invoke methods by name — all without knowing these details at compile time.

## How It Works

```java
// Java Reflection API
import java.lang.reflect.*;

public class ReflectionDemo {
    public static void main(String[] args) throws Exception {
        Class<?> clazz = Class.forName("com.example.User");

        // Inspect fields
        for (Field field : clazz.getDeclaredFields()) {
            System.out.printf("%s %s %s%n",
                Modifier.toString(field.getModifiers()),
                field.getType().getSimpleName(),
                field.getName());
        }

        // Create instance dynamically
        Constructor<?> ctor = clazz.getConstructor(String.class, int.class);
        Object user = ctor.newInstance("Alice", 30);

        // Invoke method by name
        Method getName = clazz.getMethod("getName");
        String name = (String) getName.invoke(user);  // "Alice"

        // Access private field
        Field ageField = clazz.getDeclaredField("age");
        ageField.setAccessible(true);  // bypass access control
        int age = (int) ageField.get(user);  // 30
    }
}
```

```python
# Python — introspection (reflection is native)
class User:
    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age

    def greet(self) -> str:
        return f"Hi, I'm {self.name}"

user = User("Alice", 30)

# Inspect attributes
dir(user)                          # list all attributes/methods
hasattr(user, "name")              # True
getattr(user, "name")              # "Alice"
setattr(user, "name", "Bob")       # modify at runtime

# Inspect type
type(user)                         # <class 'User'>
isinstance(user, User)             # True
user.__class__.__name__            # "User"

# Inspect methods
import inspect
members = inspect.getmembers(user, predicate=inspect.ismethod)
sig = inspect.signature(User.greet)  # (self) -> str

# Dynamic method call
method_name = "greet"
result = getattr(user, method_name)()  # "Hi, I'm Bob"

# Create class dynamically
DynamicClass = type("DynamicClass", (object,), {
    "x": 10,
    "hello": lambda self: f"Hello from dynamic class, x={self.x}",
})
obj = DynamicClass()
obj.hello()  # "Hello from dynamic class, x=10"
```

```typescript
// TypeScript — reflect-metadata (decorator metadata)
import "reflect-metadata";

function Validate(target: any, key: string) {
  const type = Reflect.getMetadata("design:type", target, key);
  console.log(`${key} has type: ${type.name}`);
}

class Form {
  @Validate name: string;    // logs: "name has type: String"
  @Validate age: number;     // logs: "age has type: Number"
}

// JavaScript Proxy — runtime interception (metaobject protocol)
const handler: ProxyHandler<any> = {
  get(target, prop, receiver) {
    console.log(`Accessing: ${String(prop)}`);
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    console.log(`Setting: ${String(prop)} = ${value}`);
    return Reflect.set(target, prop, value, receiver);
  },
};

const proxy = new Proxy({ name: "Alice" }, handler);
proxy.name;         // logs: "Accessing: name" → "Alice"
proxy.age = 30;     // logs: "Setting: age = 30"
```

### Reflection Use Cases and Costs

```
Use Cases:                        Performance Cost:
─────────────────────────────────────────────────────
DI containers (Spring @Autowired)  Method.invoke() is 5-50x slower than direct call
Serialization (Jackson, Gson)      Field access via reflection bypasses JIT optimization
ORM mapping (Hibernate)            Class loading and inspection at startup
Testing (mocking frameworks)       Security manager checks on each reflective access
Plugin systems                     No compile-time type checking

Rule: Prefer compile-time mechanisms (generics, interfaces, code generation)
      Use reflection only when dynamic behavior is truly needed.
```

## Sources

- Forman, I. & Forman, N. (2004). *Java Reflection in Action*. Manning.
- [Java Reflection Tutorial](https://docs.oracle.com/javase/tutorial/reflect/)
- [Python `inspect` module](https://docs.python.org/3/library/inspect.html)
