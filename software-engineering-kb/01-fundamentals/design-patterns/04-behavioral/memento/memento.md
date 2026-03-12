# Memento Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Memento pattern captures and stores an object's internal state so that it can be **restored later without violating encapsulation**. The object itself creates the snapshot, and only the object knows how to restore from it.

**GoF Intent:** "Without violating encapsulation, capture and externalize an object's internal state so that the object can be restored to this state later."

## How It Works

```typescript
// Memento — stores state snapshot
class EditorMemento {
  constructor(
    private readonly content: string,
    private readonly cursorPosition: number
  ) {}

  getContent(): string { return this.content; }
  getCursorPosition(): number { return this.cursorPosition; }
}

// Originator — creates and restores from mementos
class TextEditor {
  private content: string = "";
  private cursorPosition: number = 0;

  type(text: string): void {
    this.content = this.content.slice(0, this.cursorPosition)
      + text + this.content.slice(this.cursorPosition);
    this.cursorPosition += text.length;
  }

  save(): EditorMemento {
    return new EditorMemento(this.content, this.cursorPosition);
  }

  restore(memento: EditorMemento): void {
    this.content = memento.getContent();
    this.cursorPosition = memento.getCursorPosition();
  }

  getContent(): string { return this.content; }
}

// Caretaker — manages memento history
class History {
  private snapshots: EditorMemento[] = [];

  push(memento: EditorMemento): void {
    this.snapshots.push(memento);
  }

  pop(): EditorMemento | undefined {
    return this.snapshots.pop();
  }
}

// Usage
const editor = new TextEditor();
const history = new History();

history.push(editor.save());
editor.type("Hello ");
history.push(editor.save());
editor.type("World");

editor.getContent();  // "Hello World"
editor.restore(history.pop()!);
editor.getContent();  // "Hello "
editor.restore(history.pop()!);
editor.getContent();  // ""
```

## Real-world Examples

- **Ctrl+Z (Undo)** — every editor stores mementos for undo.
- **Game save states** — checkpoint saves capture the entire game state.
- **Database transactions** — savepoints allow rollback to a previous state.
- **Version control** — each commit is a memento of the repository state.
- **Browser `history.pushState()`** — stores navigation state for back/forward.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 283-291.
- [Refactoring.Guru — Memento](https://refactoring.guru/design-patterns/memento)
