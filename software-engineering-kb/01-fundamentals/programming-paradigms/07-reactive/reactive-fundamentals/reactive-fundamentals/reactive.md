# Reactive Programming

> **Domain:** Fundamentals > Programming Paradigms > Reactive
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

Reactive programming is a paradigm centered on **data streams and the propagation of change**. When a data source changes, all dependent computations automatically update. Instead of imperatively fetching and processing data, you declaratively define how data flows and transforms through a pipeline of operations.

**The Reactive Manifesto (2013)** defines reactive systems as: **Responsive** (timely responses), **Resilient** (stay responsive under failure), **Elastic** (scale under load), **Message-Driven** (async message passing).

## How It Works

```typescript
// Reactive concept: values that change over time
// Spreadsheet analogy: cell C1 = A1 + B1
// When A1 changes, C1 automatically recalculates

// Signals — modern reactive primitives (SolidJS, Angular Signals, Preact)
import { signal, computed, effect } from "@preact/signals";

const price = signal(100);
const quantity = signal(3);

// Computed value — automatically updates when dependencies change
const total = computed(() => price.value * quantity.value);

// Effect — runs when dependencies change
effect(() => {
  console.log(`Total: $${total.value}`);
});

price.value = 120;     // logs: "Total: $360" (auto-updated)
quantity.value = 5;    // logs: "Total: $600" (auto-updated)
```

```typescript
// RxJS — Observable-based reactive programming
import { fromEvent, interval } from "rxjs";
import { map, filter, debounceTime, switchMap } from "rxjs/operators";

// Mouse position stream
const mouseMove$ = fromEvent<MouseEvent>(document, "mousemove").pipe(
  map(event => ({ x: event.clientX, y: event.clientY })),
  filter(pos => pos.x > 100),  // only right side of screen
);

mouseMove$.subscribe(pos => updateCursor(pos));

// Autocomplete search — reactive composition
const search$ = fromEvent<InputEvent>(searchInput, "input").pipe(
  map(e => (e.target as HTMLInputElement).value),
  debounceTime(300),                    // wait for user to stop typing
  filter(query => query.length >= 2),   // minimum 2 characters
  switchMap(query => fetchResults(query)), // cancel previous request
);

search$.subscribe(results => renderResults(results));
```

### Push vs Pull Model

```
PULL model (traditional):
  Consumer asks for data when ready
  consumer.getData()  →  producer returns data
  Example: Iterator, database query

PUSH model (reactive):
  Producer emits data when available
  producer.subscribe(data => ...)
  Example: WebSocket, event stream, Observable

Reactive programming is inherently PUSH-based:
  Data source → transformation pipeline → subscriber
```

### Backpressure

```
Problem: producer emits faster than consumer can process

Producer:  ████████████████████  (100 events/sec)
Consumer:  ████░░░░████░░░░████  (25 events/sec)
                    ^^^ overflow!

Solutions:
  Buffer:    Collect excess items in a queue (bounded)
  Drop:      Discard items when consumer is busy
  Latest:    Keep only the most recent item
  Throttle:  Slow down the producer
  Sample:    Take one item per time window

RxJS: bufferTime(), throttleTime(), debounceTime(), sample()
Project Reactor: Flux.onBackpressureBuffer(), onBackpressureDrop()
```

### Reactive vs Event-Driven

```
Event-Driven:                    Reactive:
─────────────                    ─────────
Discrete events                  Continuous data streams
Callback/handler per event       Composable operator pipelines
Fire-and-forget                  Backpressure-aware
Simple pub/sub                   Transformation chains
DOM events, webhooks             Real-time data processing

Reactive builds ON TOP of event-driven,
adding composition, transformation, and flow control.
```

## Real-world Examples

- **React useState/useEffect** — component re-renders when state changes.
- **Vue.js reactivity** — `ref()`, `reactive()`, `computed()` — proxy-based.
- **Angular Signals** — fine-grained reactivity (Angular 16+).
- **SolidJS** — compile-time reactive signals, no virtual DOM.
- **RxJS** — reactive extensions for JavaScript (Angular's HTTP client).
- **Project Reactor** — reactive library for Spring WebFlux (Java).
- **Kafka Streams** — reactive stream processing at scale.

## Sources

- Bainomugisha, E. et al. (2013). "A Survey on Reactive Programming." *ACM Computing Surveys*, 45(4).
- [The Reactive Manifesto](https://www.reactivemanifesto.org/) (2013).
- Meijer, E. (2010). "Subject/Observer is Dual to Iterator." Microsoft Research.
