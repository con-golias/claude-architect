# Command Pattern

> **Domain:** Fundamentals > Design Patterns > Behavioral
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

The Command pattern encapsulates a request as an **object**, allowing you to parameterize clients with different requests, queue requests, log them, and support undoable operations. It decouples the object that invokes the operation from the one that performs it.

**GoF Intent:** "Encapsulate a request as an object, thereby letting you parameterize clients with different requests, queue or log requests, and support undoable operations."

## How It Works

```typescript
// Command interface
interface Command {
  execute(): void;
  undo(): void;
}

// Concrete commands
class AddTextCommand implements Command {
  constructor(
    private editor: TextEditor,
    private text: string,
    private position: number
  ) {}

  execute(): void {
    this.editor.insert(this.text, this.position);
  }

  undo(): void {
    this.editor.delete(this.position, this.text.length);
  }
}

class DeleteTextCommand implements Command {
  private deletedText: string = "";

  constructor(
    private editor: TextEditor,
    private position: number,
    private length: number
  ) {}

  execute(): void {
    this.deletedText = this.editor.getText(this.position, this.length);
    this.editor.delete(this.position, this.length);
  }

  undo(): void {
    this.editor.insert(this.deletedText, this.position);
  }
}

// Invoker — manages command history
class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];  // clear redo stack
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
    }
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
    }
  }
}
```

```python
# Task queue with commands
from abc import ABC, abstractmethod
from queue import Queue

class Task(ABC):
    @abstractmethod
    def execute(self) -> None: pass

class SendEmailTask(Task):
    def __init__(self, to: str, subject: str):
        self.to = to
        self.subject = subject

    def execute(self):
        send_email(self.to, self.subject)

class ResizeImageTask(Task):
    def __init__(self, path: str, width: int):
        self.path = path
        self.width = width

    def execute(self):
        resize(self.path, self.width)

# Worker processes commands from queue
task_queue = Queue()
task_queue.put(SendEmailTask("user@mail.com", "Welcome!"))
task_queue.put(ResizeImageTask("photo.jpg", 800))

while not task_queue.empty():
    task = task_queue.get()
    task.execute()
```

## Real-world Examples

- **Undo/Redo** — every text editor, graphics editor, IDE.
- **Task/Job queues** — Celery, Sidekiq, Bull.js — serialized command objects.
- **Transaction systems** — each database operation as a command, rollback = undo.
- **Git** — each commit is a command; `git revert` is the undo.
- **Redux actions** — `{ type: 'ADD_TODO', payload: {...} }` are serialized commands.

## Sources

- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. pp. 233-242.
- [Refactoring.Guru — Command](https://refactoring.guru/design-patterns/command)
