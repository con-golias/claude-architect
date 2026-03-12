# Mediator Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Mediator pattern defines an object that **centralizes complex communications** between many objects. Instead of objects referring to each other directly (creating a web of dependencies), they communicate through the mediator — reducing coupling from O(n^2) to O(n).

**GoF Intent:** "Define an object that encapsulates how a set of objects interact. Mediator promotes loose coupling by keeping objects from referring to each other explicitly."

## How It Works

```typescript
// Without Mediator: every component knows every other component (n² coupling)
// With Mediator: every component only knows the mediator (n coupling)

interface ChatMediator {
  sendMessage(message: string, sender: User): void;
  addUser(user: User): void;
}

class ChatRoom implements ChatMediator {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
    user.setMediator(this);
  }

  sendMessage(message: string, sender: User): void {
    for (const user of this.users) {
      if (user !== sender) {
        user.receive(message, sender.name);
      }
    }
  }
}

class User {
  private mediator!: ChatMediator;

  constructor(public name: string) {}

  setMediator(mediator: ChatMediator): void {
    this.mediator = mediator;
  }

  send(message: string): void {
    this.mediator.sendMessage(message, this);
  }

  receive(message: string, from: string): void {
    console.log(`${this.name} received from ${from}: ${message}`);
  }
}

// Usage
const room = new ChatRoom();
const alice = new User("Alice");
const bob = new User("Bob");
room.addUser(alice);
room.addUser(bob);
alice.send("Hello!");  // Bob receives: "Hello!" from Alice
```

### Mediator vs Observer

```
Mediator:  Centralized — mediator knows all colleagues, controls routing
Observer:  Distributed — subject notifies all observers, no routing logic

Use Mediator when: complex routing logic needed between components
Use Observer when: simple broadcast notification is sufficient
```

## Real-world Examples

- **Air traffic control** — planes communicate through the tower, not directly.
- **Redux/NgRx** — the store is a mediator between components and state.
- **MediatR (.NET)** — mediator library for CQRS command/query handling.
- **Express.js `app`** — mediates between routes, middleware, and handlers.
- **GUI dialog boxes** — form elements communicate through the dialog controller.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 273-282.
- [Refactoring.Guru — Mediator](https://refactoring.guru/design-patterns/mediator)
