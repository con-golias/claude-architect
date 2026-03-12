# Macros and Code Generation

> **Domain:** Fundamentals > Programming Paradigms > Metaprogramming
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

Macros transform code at **compile time**, generating or rewriting code before it is compiled or interpreted. Code generation tools produce source code from specifications (schemas, IDL files, templates). Both eliminate boilerplate and enable abstractions that would be impossible with regular functions.

## Types of Macros

### C Preprocessor Macros (Textual Substitution)

```c
// C — text replacement, no type safety
#define MAX(a, b)  ((a) > (b) ? (a) : (b))
#define ARRAY_SIZE(arr)  (sizeof(arr) / sizeof((arr)[0]))

#define LOG(level, fmt, ...) \
    fprintf(stderr, "[%s] %s:%d: " fmt "\n", \
            level, __FILE__, __LINE__, ##__VA_ARGS__)

LOG("ERROR", "Failed to open %s", filename);
// Expands to: fprintf(stderr, "[ERROR] main.c:42: Failed to open %s\n", filename);

// Conditional compilation
#ifdef DEBUG
    #define ASSERT(cond) if (!(cond)) abort()
#else
    #define ASSERT(cond) ((void)0)
#endif

// Danger: macros don't respect scope, types, or hygiene
#define SQUARE(x)  x * x
SQUARE(3 + 1)  // expands to: 3 + 1 * 3 + 1 = 7 (not 16!)
// Fix: #define SQUARE(x) ((x) * (x))
```

### Rust Macros (AST-Level, Hygienic)

```rust
// Declarative macro (macro_rules!)
macro_rules! hashmap {
    ($($key:expr => $value:expr),* $(,)?) => {{
        let mut map = std::collections::HashMap::new();
        $(map.insert($key, $value);)*
        map
    }};
}

let scores = hashmap! {
    "Alice" => 95,
    "Bob" => 87,
    "Carol" => 92,
};

// Procedural macro — derive trait implementation
// Defined in a separate crate:
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, DeriveInput};

#[proc_macro_derive(Builder)]
pub fn derive_builder(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;
    let builder_name = format_ident!("{}Builder", name);

    // Generate builder pattern code at compile time
    let expanded = quote! {
        struct #builder_name { /* ... */ }
        impl #name {
            fn builder() -> #builder_name {
                #builder_name { /* ... */ }
            }
        }
    };
    TokenStream::from(expanded)
}

// Usage — generates hundreds of lines of builder code
#[derive(Builder)]
struct Config {
    host: String,
    port: u16,
    workers: usize,
}
```

### Lisp Macros (Code = Data)

```clojure
;; Clojure — macros operate on the AST (S-expressions)
(defmacro when-let [binding & body]
  `(let [val# ~(second binding)]
     (when val#
       (let [~(first binding) val#]
         ~@body))))

;; Usage — extends language syntax
(when-let [user (find-user id)]
  (send-email user)
  (log "sent"))

;; Compile-time transformation into:
;; (let [val (find-user id)]
;;   (when val
;;     (let [user val]
;;       (send-email user)
;;       (log "sent"))))

;; Threading macro — transforms nested calls into pipeline
(-> data
    (filter even?)
    (map #(* % 2))
    (reduce +))
;; Expands to: (reduce + (map #(* % 2) (filter even? data)))
```

### Code Generation Tools

```
Tool              Input              Output             Use Case
──────────────────────────────────────────────────────────────────
Protocol Buffers  .proto file         TypeScript/Java/Go   API serialization
OpenAPI/Swagger   openapi.yaml        Client SDKs          REST API clients
GraphQL Codegen   .graphql + schema   TypeScript types      Type-safe queries
sqlc              SQL queries         Go functions          Type-safe DB access
Prisma            schema.prisma       TypeScript client     ORM generation
JAXB              XML Schema          Java classes          XML binding
ANTLR             Grammar file        Parser code           Language parsers
```

```bash
# protobuf code generation
protoc --ts_out=./src/generated user.proto
# Generates TypeScript interfaces and serialization code from .proto

# OpenAPI client generation
openapi-generator generate -i api.yaml -g typescript-fetch -o src/api
# Generates complete TypeScript HTTP client from API spec
```

### Macros vs Functions

```
Functions:                         Macros:
Evaluated at runtime               Expanded at compile time
Receive evaluated arguments        Receive unevaluated code (AST)
Cannot introduce new syntax        Can extend language syntax
Type-checked normally              May bypass type checking
Easy to debug                      Hard to debug (invisible expansion)

Rule: Always prefer functions. Use macros only when functions can't do the job
      (custom syntax, compile-time code generation, zero-cost abstractions).
```

## Sources

- Graham, P. (1993). *On Lisp*. Prentice Hall. Chapters 7-8.
- [Rust Reference — Macros](https://doc.rust-lang.org/reference/macros.html)
- [Protocol Buffers Documentation](https://protobuf.dev/)
