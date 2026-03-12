# Model-View-Controller (MVC)

> **Domain:** Fundamentals > Design Patterns > Architectural
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

MVC separates an application into three interconnected components: the **Model** (data and business logic), the **View** (presentation layer), and the **Controller** (input handling and coordination). This separation allows independent development, testing, and modification of each component.

**Origin:** Introduced by Trygve Reenskaug at Xerox PARC in 1979 for Smalltalk-80. It became the dominant architecture for web frameworks in the 2000s.

## How It Works

```
┌──────────────┐     user action     ┌──────────────┐
│              │ ──────────────────→  │              │
│     View     │                     │  Controller  │
│  (presents)  │ ←────────────────── │  (handles    │
│              │     selects view    │   input)     │
└──────┬───────┘                     └──────┬───────┘
       │                                    │
       │  observes/reads                    │  updates
       │                                    │
       │         ┌──────────────┐           │
       └────────→│    Model     │←──────────┘
                 │  (data +     │
                 │   business   │
                 │   logic)     │
                 └──────────────┘
```

### Server-Side MVC (Classic Web)

```typescript
// Model — pure data and business logic
class UserModel {
  private db: Database;

  async findById(id: string): Promise<User | null> {
    return this.db.query("SELECT * FROM users WHERE id = ?", [id]);
  }

  async updateEmail(id: string, email: string): Promise<void> {
    if (!email.includes("@")) throw new ValidationError("Invalid email");
    await this.db.query("UPDATE users SET email = ? WHERE id = ?", [email, id]);
  }
}

// Controller — handles HTTP requests, coordinates model and view
class UserController {
  constructor(private model: UserModel) {}

  async getProfile(req: Request, res: Response): Promise<void> {
    const user = await this.model.findById(req.params.id);
    if (!user) {
      res.status(404).render("error", { message: "User not found" });
      return;
    }
    res.render("profile", { user });  // selects view + passes data
  }

  async updateEmail(req: Request, res: Response): Promise<void> {
    try {
      await this.model.updateEmail(req.params.id, req.body.email);
      res.redirect(`/users/${req.params.id}`);
    } catch (e) {
      res.status(400).render("edit-profile", { error: e.message });
    }
  }
}

// View (template) — presentation only
// profile.ejs
// <h1><%= user.name %></h1>
// <p>Email: <%= user.email %></p>
// <a href="/users/<%= user.id %>/edit">Edit</a>
```

```python
# Django — the most prominent server-side MVC framework
# (Django calls it MTV: Model-Template-View, where "View" = Controller)

# models.py (Model)
from django.db import models

class Article(models.Model):
    title = models.CharField(max_length=200)
    body = models.TextField()
    published = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-published"]

# views.py (Controller in MVC terminology)
from django.shortcuts import render, get_object_or_404

def article_detail(request, pk):
    article = get_object_or_404(Article, pk=pk)
    return render(request, "articles/detail.html", {"article": article})

def article_list(request):
    articles = Article.objects.all()[:20]
    return render(request, "articles/list.html", {"articles": articles})

# urls.py (Routing — maps URLs to controllers)
from django.urls import path
urlpatterns = [
    path("articles/", article_list),
    path("articles/<int:pk>/", article_detail),
]
```

### Client-Side MVC

```typescript
// Backbone.js-style client-side MVC
class TodoModel extends EventEmitter {
  private items: Todo[] = [];

  add(text: string): void {
    this.items.push({ id: Date.now(), text, done: false });
    this.emit("change", this.items);
  }

  toggle(id: number): void {
    const item = this.items.find(t => t.id === id);
    if (item) item.done = !item.done;
    this.emit("change", this.items);
  }

  getAll(): Todo[] { return [...this.items]; }
}

class TodoView {
  constructor(private container: HTMLElement) {}

  render(items: Todo[]): void {
    this.container.innerHTML = items
      .map(t => `<li class="${t.done ? "done" : ""}" data-id="${t.id}">${t.text}</li>`)
      .join("");
  }
}

class TodoController {
  constructor(private model: TodoModel, private view: TodoView) {
    // Model changes → update view
    model.on("change", (items) => view.render(items));

    // User input → update model
    view.container.addEventListener("click", (e) => {
      const id = Number((e.target as HTMLElement).dataset.id);
      if (id) model.toggle(id);
    });
  }
}
```

### MVC Variants

```
Classic MVC:       View observes Model directly (Smalltalk-80)
Web MVC:           Controller mediates all communication (Spring MVC, Rails)
MVP:               Presenter replaces Controller; View is passive
MVVM:              ViewModel replaces Controller; two-way data binding

Classic:   View ←→ Model ←→ Controller
Web MVC:   View ← Controller → Model    (Controller is the hub)
```

## Real-world Examples

- **Ruby on Rails** — popularized convention-over-configuration MVC for web.
- **Spring MVC** — Java enterprise web framework with `@Controller`, `@Service`, `@Repository`.
- **Django** — Python MTV (Model-Template-View), where View acts as Controller.
- **ASP.NET MVC** — Microsoft's MVC framework for C# web applications.
- **Laravel** — PHP MVC framework with Eloquent ORM and Blade templates.
- **Express.js** — minimalist Node.js framework often structured as MVC manually.
- **Cocoa MVC** — Apple's UIKit framework (though often criticized as "Massive View Controller").

## Sources

- Reenskaug, T. (1979). *Models-Views-Controllers*. Xerox PARC technical note.
- Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley. (Observer pattern underlies MVC)
- [Martin Fowler — GUI Architectures](https://martinfowler.com/eaaDev/uiArchs.html)
