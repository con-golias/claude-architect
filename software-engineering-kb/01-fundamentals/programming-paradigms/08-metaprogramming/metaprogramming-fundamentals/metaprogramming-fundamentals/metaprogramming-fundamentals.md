# Metaprogramming

> **Domain:** Fundamentals > Programming Paradigms > Metaprogramming
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Metaprogramming is writing **code that writes, manipulates, or reasons about other code**. The program treats code itself as data — generating, transforming, or inspecting it at compile time or runtime. This enables powerful abstractions: ORMs generate SQL from code, serializers inspect types, and macro systems extend language syntax.

## Types of Metaprogramming

```
Compile-time:
  - C++ template metaprogramming
  - Rust procedural macros
  - Lisp macros (code as data)
  - Code generation (protobuf, GraphQL codegen)

Runtime:
  - Reflection (Java, C#, Python)
  - Dynamic method dispatch (Ruby method_missing)
  - JavaScript Proxy / eval
  - Monkey patching (Ruby, Python)

Both:
  - TypeScript decorators (compile + runtime)
  - Annotation processing (Java)
```

### Homoiconicity — Code as Data (Lisp)

```clojure
;; Clojure — code IS data (S-expressions are lists)
;; This is code:
(+ 1 2 3)            ;; → 6

;; This is data (a list):
'(+ 1 2 3)           ;; → the list (+ 1 2 3)

;; Macro: transforms code (data) at compile time
(defmacro unless [condition & body]
  `(if (not ~condition) (do ~@body)))

;; Usage — extends the language
(unless (empty? items)
  (process items)
  (log "done"))

;; Expands at compile time to:
;; (if (not (empty? items)) (do (process items) (log "done")))
```

### Compile-Time Computation

```rust
// Rust — procedural macros generate code at compile time
// Derive macro: automatically implements traits
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct User {
    name: String,
    age: u32,
    email: String,
}

// The #[derive(Serialize)] macro generates at compile time:
// impl Serialize for User {
//     fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
//         let mut state = s.serialize_struct("User", 3)?;
//         state.serialize_field("name", &self.name)?;
//         state.serialize_field("age", &self.age)?;
//         state.serialize_field("email", &self.email)?;
//         state.end()
//     }
// }

// Declarative macro (macro_rules!)
macro_rules! vec_of_strings {
    ($($x:expr),*) => {
        vec![$($x.to_string()),*]
    };
}
let names = vec_of_strings!["Alice", "Bob", "Carol"];
```

```python
# Python — metaclasses (classes that create classes)
class SingletonMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super().__call__(*args, **kwargs)
        return cls._instances[cls]

class Database(metaclass=SingletonMeta):
    def __init__(self, url: str):
        self.url = url

# Both return the exact same instance
db1 = Database("postgres://localhost")
db2 = Database("postgres://other")
assert db1 is db2  # True — singleton enforced by metaclass
```

### When to Use Metaprogramming

```
Good uses:
  - Eliminating boilerplate (derive macros, code generation)
  - Building frameworks (DI containers, ORM, serialization)
  - DSLs and language extensions
  - Testing utilities (mocking, fixtures)

Dangers:
  - Hard to debug (generated code is invisible)
  - Hard to understand (magic behavior)
  - Compile-time metaprogramming can slow builds
  - Runtime metaprogramming bypasses type checking

Rule: Use the simplest tool that works.
      Plain functions > generics > macros/reflection
```

## Sources

- Czarnecki, K. & Eisenecker, U. (2000). *Generative Programming*. Addison-Wesley.
- [Rust Book — Macros](https://doc.rust-lang.org/book/ch19-06-macros.html)
- [Lilis, Y. & Savidis, A. (2019). "A Survey of Metaprogramming Languages." ACM Computing Surveys.](https://www.oilshell.org/archive/lilis2019.pdf)
