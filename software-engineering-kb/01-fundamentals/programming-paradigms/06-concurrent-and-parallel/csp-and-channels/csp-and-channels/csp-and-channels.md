# CSP and Channels

> **Domain:** Fundamentals > Programming Paradigms > Concurrent & Parallel
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

**Communicating Sequential Processes (CSP)** is a concurrency model where independent processes communicate through **channels** — typed conduits that synchronize sender and receiver. Unlike the actor model (async mailboxes), CSP channels are synchronous by default: the sender blocks until the receiver is ready, and vice versa. Go is the most prominent language built on CSP principles.

**Origin:** Formalized by Tony Hoare in 1978 in his paper *"Communicating Sequential Processes."*

## How It Works

```go
// Go — goroutines (lightweight processes) + channels
package main

import "fmt"

func producer(ch chan<- int) {
    for i := 0; i < 5; i++ {
        ch <- i  // send to channel (blocks until receiver ready)
    }
    close(ch)  // signal no more values
}

func consumer(ch <-chan int) {
    for val := range ch {  // receive until channel closed
        fmt.Println("Received:", val)
    }
}

func main() {
    ch := make(chan int)  // unbuffered channel — synchronous
    go producer(ch)       // goroutine: lightweight (~4KB stack)
    consumer(ch)          // runs in main goroutine
}
```

### Fan-Out / Fan-In Pattern

```go
// Fan-out: distribute work to multiple goroutines
// Fan-in: merge results into one channel
func fanOutFanIn() {
    jobs := make(chan int, 100)
    results := make(chan int, 100)

    // Fan-out: 3 workers consuming from same channel
    for w := 0; w < 3; w++ {
        go func(id int) {
            for job := range jobs {
                results <- job * job  // process and send result
            }
        }(w)
    }

    // Send jobs
    go func() {
        for i := 0; i < 20; i++ {
            jobs <- i
        }
        close(jobs)
    }()

    // Collect results
    for i := 0; i < 20; i++ {
        fmt.Println(<-results)
    }
}
```

### Select Statement — Multiplexing Channels

```go
func main() {
    ch1 := make(chan string)
    ch2 := make(chan string)
    quit := make(chan bool)

    go func() {
        for {
            select {
            case msg := <-ch1:
                fmt.Println("Channel 1:", msg)
            case msg := <-ch2:
                fmt.Println("Channel 2:", msg)
            case <-quit:
                fmt.Println("Shutting down")
                return
            case <-time.After(5 * time.Second):
                fmt.Println("Timeout — no messages for 5s")
            }
        }
    }()
}
```

### Buffered vs Unbuffered Channels

```go
// Unbuffered — synchronous, sender blocks until receiver is ready
ch := make(chan int)      // capacity 0

// Buffered — async up to capacity, then blocks
ch := make(chan int, 10)  // capacity 10, sender blocks when full

// Use cases:
// Unbuffered: strict synchronization, handoff between goroutines
// Buffered:   producer-consumer with temporary backlog
```

### Pipeline Pattern

```go
// Stage 1: generate numbers
func generate(nums ...int) <-chan int {
    out := make(chan int)
    go func() {
        for _, n := range nums {
            out <- n
        }
        close(out)
    }()
    return out
}

// Stage 2: square each number
func square(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            out <- n * n
        }
        close(out)
    }()
    return out
}

// Stage 3: filter even numbers
func filterEven(in <-chan int) <-chan int {
    out := make(chan int)
    go func() {
        for n := range in {
            if n%2 == 0 { out <- n }
        }
        close(out)
    }()
    return out
}

// Compose pipeline
func main() {
    pipeline := filterEven(square(generate(1, 2, 3, 4, 5)))
    for val := range pipeline {
        fmt.Println(val)  // 4, 16  (only even squares)
    }
}
```

### CSP vs Actor Model

```
                CSP / Channels              Actor Model
──────────────────────────────────────────────────────────
Communication   Named channels              Named actors (mailboxes)
Synchrony       Synchronous by default      Asynchronous
Identity        Processes are anonymous      Actors have addresses
Distribution    Same machine (typically)     Across machines (natural)
Paradigm        Go, Clojure core.async       Erlang, Akka
Best for        Pipeline/workflow patterns    Distributed systems
```

## Real-world Examples

- **Go standard library** — net/http, database/sql use goroutines + channels internally.
- **Docker** — written in Go, uses CSP for container lifecycle management.
- **Kubernetes** — control plane uses Go channels extensively.
- **Clojure core.async** — CSP-style channels on the JVM.
- **Rust crossbeam** — channel-based concurrency.
- **Limbo/Plan 9** — Bell Labs OS languages based directly on CSP.

## Sources

- Hoare, C.A.R. (1978). "Communicating Sequential Processes." *Communications of the ACM*, 21(8).
- Donovan, A. & Kernighan, B. (2015). *The Go Programming Language*. Addison-Wesley. Chapter 8.
- [Go Blog — Pipelines and Cancellation](https://go.dev/blog/pipelines)
