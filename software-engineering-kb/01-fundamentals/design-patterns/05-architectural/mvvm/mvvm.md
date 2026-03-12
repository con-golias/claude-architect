# Model-View-ViewModel (MVVM)

> **Domain:** Fundamentals > Design Patterns > Architectural
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

MVVM separates an application into **Model** (data/business logic), **View** (UI/presentation), and **ViewModel** (an abstraction of the View that exposes data and commands). The key innovation is **two-way data binding** — the ViewModel and View stay in sync automatically, eliminating manual DOM manipulation.

**Origin:** Introduced by Ken Cooper and Ted Peters at Microsoft in 2005 for WPF (Windows Presentation Foundation). It became the dominant pattern for modern frontend frameworks.

## How It Works

```
┌──────────────┐  data binding   ┌──────────────┐  reads/writes  ┌──────────────┐
│              │ ←─────────────→ │              │ ─────────────→ │              │
│     View     │                 │  ViewModel   │                │    Model     │
│  (template)  │   automatic     │  (state +    │  ←──────────── │  (data +     │
│              │   sync          │   logic)     │   notifies     │   services)  │
└──────────────┘                 └──────────────┘                └──────────────┘
```

### React (Functional MVVM)

```typescript
// Model — data types and API layer
interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

async function fetchTodos(): Promise<Todo[]> {
  const res = await fetch("/api/todos");
  return res.json();
}

async function saveTodo(todo: Partial<Todo>): Promise<Todo> {
  const res = await fetch("/api/todos", {
    method: "POST",
    body: JSON.stringify(todo),
  });
  return res.json();
}

// ViewModel — custom hook encapsulating state and logic
function useTodoViewModel() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "done">("all");

  useEffect(() => {
    fetchTodos().then(setTodos);
  }, []);

  const filtered = useMemo(() => {
    switch (filter) {
      case "active": return todos.filter(t => !t.completed);
      case "done":   return todos.filter(t => t.completed);
      default:       return todos;
    }
  }, [todos, filter]);

  const addTodo = async (text: string) => {
    const todo = await saveTodo({ text, completed: false });
    setTodos(prev => [...prev, todo]);
  };

  const toggleTodo = (id: number) => {
    setTodos(prev => prev.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    ));
  };

  const remaining = todos.filter(t => !t.completed).length;

  return { todos: filtered, filter, setFilter, addTodo, toggleTodo, remaining };
}

// View — pure presentation, binds to ViewModel
function TodoApp() {
  const vm = useTodoViewModel();

  return (
    <div>
      <h1>Todos ({vm.remaining} remaining)</h1>
      <input onKeyDown={e => {
        if (e.key === "Enter") vm.addTodo(e.currentTarget.value);
      }} />
      <FilterBar current={vm.filter} onChange={vm.setFilter} />
      <ul>
        {vm.todos.map(todo => (
          <li key={todo.id} onClick={() => vm.toggleTodo(todo.id)}>
            {todo.completed ? "✓" : "○"} {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Vue.js (Composition API — Native MVVM)

```typescript
// Vue — ViewModel is the component setup
<script setup lang="ts">
import { ref, computed } from "vue";

// Model
interface Product {
  id: number;
  name: string;
  price: number;
}

// ViewModel (reactive state + computed + methods)
const products = ref<Product[]>([]);
const searchQuery = ref("");
const sortBy = ref<"name" | "price">("name");

const filtered = computed(() => {
  let result = products.value.filter(p =>
    p.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  );
  return result.sort((a, b) =>
    sortBy.value === "price" ? a.price - b.price : a.name.localeCompare(b.name)
  );
});

const total = computed(() =>
  filtered.value.reduce((sum, p) => sum + p.price, 0)
);

async function loadProducts() {
  const res = await fetch("/api/products");
  products.value = await res.json();
}

onMounted(loadProducts);
</script>

<!-- View — template with two-way binding -->
<template>
  <input v-model="searchQuery" placeholder="Search..." />
  <select v-model="sortBy">
    <option value="name">Name</option>
    <option value="price">Price</option>
  </select>
  <ul>
    <li v-for="p in filtered" :key="p.id">
      {{ p.name }} — ${{ p.price }}
    </li>
  </ul>
  <p>Total: ${{ total }}</p>
</template>
```

### Angular (Class-Based MVVM)

```typescript
// Angular — ViewModel is the Component class
@Component({
  selector: "app-user-profile",
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <input formControlName="name" />
      <input formControlName="email" />
      <span *ngIf="form.get('email')?.errors?.['email']">Invalid email</span>
      <button [disabled]="!form.valid || saving">
        {{ saving ? "Saving..." : "Save" }}
      </button>
    </form>
  `
})
export class UserProfileComponent implements OnInit {
  form: FormGroup;
  saving = false;

  constructor(
    private fb: FormBuilder,
    private userService: UserService
  ) {
    this.form = this.fb.group({
      name: ["", Validators.required],
      email: ["", [Validators.required, Validators.email]],
    });
  }

  async ngOnInit() {
    const user = await this.userService.getCurrent();
    this.form.patchValue(user);
  }

  async onSubmit() {
    this.saving = true;
    await this.userService.update(this.form.value);
    this.saving = false;
  }
}
```

### MVC vs MVVM

```
MVC:    Controller handles input, selects view, passes data
MVVM:   ViewModel exposes state; View binds to it automatically

MVC:    View → Controller → Model → View (request/response cycle)
MVVM:   View ↔ ViewModel → Model (continuous two-way binding)

MVC:    Better for server-rendered pages (Rails, Django, Spring MVC)
MVVM:   Better for rich client-side apps (React, Vue, Angular, WPF)
```

## Real-world Examples

- **React + Hooks** — `useState`/`useReducer` as ViewModel, JSX as View.
- **Vue.js** — Composition API is explicitly MVVM with reactive refs and computed.
- **Angular** — Component class is ViewModel with template binding.
- **SwiftUI** — `@Observable` classes as ViewModel, declarative `View` structs.
- **WPF/XAML** — Original MVVM platform with `INotifyPropertyChanged`.
- **Knockout.js** — Early JavaScript MVVM library with observable bindings.
- **Android Jetpack** — `ViewModel` class with `LiveData` and Compose UI.

## Sources

- Gossman, J. (2005). *Introduction to Model/View/ViewModel pattern*. Microsoft Blog.
- [Martin Fowler — Presentation Model](https://martinfowler.com/eaaDev/PresentationModel.html)
- [Vue.js Documentation — Reactivity Fundamentals](https://vuejs.org/guide/essentials/reactivity-fundamentals.html)
