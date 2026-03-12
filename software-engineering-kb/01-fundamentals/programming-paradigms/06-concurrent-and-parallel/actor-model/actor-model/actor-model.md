# Actor Model

> **Domain:** Fundamentals > Programming Paradigms > Concurrent & Parallel
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-06

## What It Is

The Actor Model treats **actors** as the fundamental unit of computation. Each actor is an independent entity with its own private state, a mailbox for incoming messages, and behavior. Actors communicate exclusively through **asynchronous message passing** — no shared state, no locks. This makes the model inherently safe for concurrency and naturally distributable across machines.

**Origin:** Proposed by Carl Hewitt in 1973. Implemented most successfully in Erlang/OTP (1986) by Joe Armstrong at Ericsson.

## How It Works

```
Actor A                     Actor B                   Actor C
┌─────────┐                ┌─────────┐              ┌─────────┐
│ State    │    message     │ State    │   message    │ State    │
│ Behavior │ ─────────────→ │ Behavior │ ──────────→  │ Behavior │
│ Mailbox  │                │ Mailbox  │              │ Mailbox  │
└─────────┘                └─────────┘              └─────────┘

Each actor can:
1. Send messages to other actors
2. Create new actors
3. Change its own behavior for the next message
4. Process ONE message at a time (sequential within actor)
```

```erlang
%% Erlang — the canonical actor model language
-module(counter).
-export([start/1, increment/1, get/1]).

%% Start a counter actor
start(Initial) ->
    spawn(fun() -> loop(Initial) end).

%% Actor's message loop — processes one message at a time
loop(Count) ->
    receive
        {increment, Amount} ->
            loop(Count + Amount);    %% recursive call with new state

        {get, Caller} ->
            Caller ! {count, Count}, %% send reply message
            loop(Count);             %% state unchanged

        stop ->
            ok                       %% actor terminates
    end.

%% Client API
increment(Pid, Amount) -> Pid ! {increment, Amount}.
get(Pid) ->
    Pid ! {get, self()},
    receive {count, Count} -> Count end.

%% Usage
Counter = counter:start(0),
counter:increment(Counter, 5),
counter:increment(Counter, 3),
counter:get(Counter).  %% 8
```

```elixir
# Elixir — modern Erlang (runs on BEAM VM)
defmodule ChatRoom do
  use GenServer

  # Client API
  def start_link(name), do: GenServer.start_link(__MODULE__, %{}, name: name)
  def join(room, user),  do: GenServer.cast(room, {:join, user})
  def leave(room, user), do: GenServer.cast(room, {:leave, user})
  def broadcast(room, user, msg), do: GenServer.cast(room, {:broadcast, user, msg})
  def members(room), do: GenServer.call(room, :members)

  # Server callbacks (actor behavior)
  @impl true
  def init(_), do: {:ok, %{members: MapSet.new()}}

  @impl true
  def handle_cast({:join, user}, state) do
    {:noreply, %{state | members: MapSet.put(state.members, user)}}
  end

  def handle_cast({:broadcast, from, msg}, state) do
    state.members
    |> Enum.reject(&(&1 == from))
    |> Enum.each(&send_message(&1, from, msg))
    {:noreply, state}
  end

  @impl true
  def handle_call(:members, _from, state) do
    {:reply, MapSet.to_list(state.members), state}
  end
end
```

### Supervision Trees — "Let It Crash"

```
Erlang/OTP philosophy: don't try to handle every error.
Let the faulty actor crash, and have a supervisor restart it.

         Supervisor
        /    |    \
    Worker Worker Worker
      ↓
    CRASH!
      ↓
  Supervisor detects → restarts fresh Worker

Strategies:
  one_for_one:   restart only the crashed child
  one_for_all:   restart all children
  rest_for_one:  restart crashed child and all started after it
```

### Actor Model vs Threads vs CSP

```
                Actor Model         Threads + Locks      CSP / Channels
──────────────────────────────────────────────────────────────────────
Communication   Async messages      Shared memory        Sync channels
State           Private (per actor) Shared (protected)   Private (per goroutine)
Failure         Supervision trees   Try/catch             Panic/recover
Distribution    Natural             Difficult             Possible
Ordering        Per-actor FIFO      Non-deterministic     Channel-order
```

## Real-world Examples

- **WhatsApp** — 2M connections per server on Erlang (acquired for $19B).
- **Discord** — Elixir for real-time messaging at scale.
- **Akka (Scala/Java)** — actor framework for JVM (used by LinkedIn, PayPal).
- **Microsoft Orleans** — virtual actor framework for .NET (used by Halo, Xbox).
- **Riak** — distributed database built on Erlang actors.

## Sources

- Hewitt, C. (1973). "A Universal Modular ACTOR Formalism for Artificial Intelligence." *IJCAI*.
- Armstrong, J. (2003). *Programming Erlang*. Pragmatic Bookshelf.
- [Akka Documentation](https://doc.akka.io/docs/akka/current/)
