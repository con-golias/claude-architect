# Observables and Streams

> **Domain:** Fundamentals > Programming Paradigms > Reactive
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

An **Observable** represents a stream of values over time. Observers subscribe to Observables and react to emitted values. Unlike Promises (single value), Observables can emit **zero, one, or many values** over time. They are lazy (don't execute until subscribed) and composable through **operators** that transform, filter, combine, and control the flow.

## How It Works

```typescript
// RxJS — Observable fundamentals
import { Observable, Subject, BehaviorSubject, of, from, interval } from "rxjs";
import { map, filter, take, switchMap, mergeMap, debounceTime,
         distinctUntilChanged, combineLatestWith, catchError } from "rxjs/operators";

// Creating Observables
const numbers$ = of(1, 2, 3, 4, 5);                    // finite
const ticks$ = interval(1000);                          // infinite (every 1s)
const promise$ = from(fetch("/api/data"));              // from Promise
const events$ = fromEvent(button, "click");             // from DOM events

// Custom Observable
const custom$ = new Observable<number>(subscriber => {
  subscriber.next(1);
  subscriber.next(2);
  setTimeout(() => {
    subscriber.next(3);
    subscriber.complete();  // signal end
  }, 1000);

  // Cleanup function
  return () => console.log("Unsubscribed");
});

// Subscribing
const subscription = custom$.subscribe({
  next: value => console.log("Value:", value),
  error: err => console.error("Error:", err),
  complete: () => console.log("Done"),
});

subscription.unsubscribe();  // clean up
```

### Operators — Composable Transformations

```typescript
// Transformation operators
numbers$.pipe(
  map(n => n * 2),                    // [2, 4, 6, 8, 10]
  filter(n => n > 4),                 // [6, 8, 10]
  take(2),                            // [6, 8] — complete after 2
);

// Real-world: autocomplete search
const searchResults$ = searchInput$.pipe(
  debounceTime(300),                  // wait for pause in typing
  distinctUntilChanged(),             // skip if query unchanged
  filter(q => q.length >= 2),         // minimum 2 chars
  switchMap(query =>                  // cancel previous request
    from(searchAPI(query)).pipe(
      catchError(() => of([]))        // handle errors gracefully
    )
  ),
);

// Combining streams
const dashboard$ = combineLatest([
  userProfile$,
  notifications$,
  realtimeStats$,
]).pipe(
  map(([user, notifs, stats]) => ({ user, notifs, stats })),
);
```

### Hot vs Cold Observables

```typescript
// COLD Observable — creates new execution per subscriber (like a function)
const cold$ = new Observable(subscriber => {
  subscriber.next(Math.random());  // each subscriber gets different value
});
cold$.subscribe(v => console.log("A:", v));  // A: 0.42
cold$.subscribe(v => console.log("B:", v));  // B: 0.78

// HOT Observable — shares execution among subscribers (like an event)
const subject = new Subject<number>();
subject.subscribe(v => console.log("A:", v));  // A: 1
subject.subscribe(v => console.log("B:", v));  // B: 1
subject.next(1);  // both subscribers receive same value

// BehaviorSubject — hot + remembers last value
const state$ = new BehaviorSubject<string>("initial");
state$.subscribe(v => console.log("Late sub:", v));  // "initial" immediately
state$.next("updated");  // "updated" to all subscribers
```

### Marble Diagrams

```
Source:      --1---2---3---4---5---|
                                   (complete)

.map(x*2):  --2---4---6---8---10--|

.filter(>4): ----------6---8---10--|

.take(2):    ----------6---8|
                            (early complete)

Key:
  --- time passing
  |   complete
  X   error
  1   emitted value
```

### Subject Types

```
Subject:          No memory, only emits to current subscribers
BehaviorSubject:  Remembers last value, new subscribers get it immediately
ReplaySubject:    Remembers N values, replays to new subscribers
AsyncSubject:     Only emits the last value, and only on complete
```

## Real-world Examples

- **Angular HttpClient** — returns Observables for HTTP requests.
- **Real-time dashboards** — WebSocket data piped through RxJS operators.
- **Autocomplete/typeahead** — debounce + switchMap pattern.
- **Redux Observable** — side effects as Observable epics.
- **RxPY / RxJava / Rx.NET** — reactive extensions for all major platforms.
- **Stock tickers** — continuous price stream with throttling.

## Sources

- ReactiveX. [Observable Contract](http://reactivex.io/documentation/contract.html).
- [RxJS Documentation](https://rxjs.dev/guide/observable)
- Meijer, E. (2010). "Your Mouse is a Database." *ACM Queue*.
