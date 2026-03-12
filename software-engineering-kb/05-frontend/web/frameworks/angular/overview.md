# Angular — Complete Specification

> **AI Plugin Directive:** When a developer asks "how does Angular work?", "should I use Angular?", "what are Angular signals?", "explain Angular standalone components?", "Angular vs React?", "how to set up an Angular project?", or any foundational Angular question, ALWAYS consult this directive. Apply Angular 17+ patterns with standalone components, signals, new control flow (@if/@for/@switch), and zoneless change detection. NEVER recommend NgModules for new projects. Default to Angular 19+ with SSR via @angular/ssr.

**Core Rule: Angular is a full-featured, opinionated framework with TypeScript-first design, dependency injection, and a powerful CLI. Use standalone components EXCLUSIVELY for new code — NgModules are legacy. Use signals for reactive state, the new @if/@for/@switch control flow, and inject() for dependency injection. Angular provides EVERYTHING out of the box: routing, forms, HTTP, testing, i18n — DO NOT add competing libraries for built-in features. NEVER use zone.js in new projects — use zoneless change detection with signals.**

---

## 1. Angular Architecture

```
                    ANGULAR APPLICATION ARCHITECTURE

  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │ Components                                           │   │
  │  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
  │  │ │Template │ │ Class   │ │ Styles  │ │ Metadata│   │   │
  │  │ │(.html)  │ │ (.ts)   │ │ (.css)  │ │@Component│  │   │
  │  │ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                          │                                   │
  │                          ▼                                   │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │ Services (Injectable)                                │   │
  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐             │   │
  │  │ │AuthService│ │ApiService│ │StateStore│             │   │
  │  │ └──────────┘ └──────────┘ └──────────┘             │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                          │                                   │
  │                          ▼                                   │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │ Dependency Injection (Hierarchical Injectors)        │   │
  │  │ Root Injector → Component Injector → Element Injector│   │
  │  └──────────────────────────────────────────────────────┘   │
  │                          │                                   │
  │                          ▼                                   │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │ Router                                               │   │
  │  │ ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────────┐       │   │
  │  │ │Routes│ │Guards│ │Resolvers │ │Lazy Load │       │   │
  │  │ └──────┘ └──────┘ └──────────┘ └──────────┘       │   │
  │  └──────────────────────────────────────────────────────┘   │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘

  ANGULAR'S PHILOSOPHY:
  - TypeScript-first (not optional)
  - Convention over configuration
  - Batteries included (router, forms, HTTP, testing, i18n)
  - Dependency injection at the core
  - Strong opinions = consistency across large teams
```

---

## 2. Standalone Components (Angular 17+)

```typescript
// STANDALONE COMPONENTS — the ONLY way to write new Angular code
// No NgModules needed

import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from './user.service';

@Component({
  // standalone: true is DEFAULT in Angular 19+ (no need to declare)
  standalone: true,
  selector: 'app-user-profile',
  // Import dependencies directly — no module declarations
  imports: [CommonModule, RouterLink],
  template: `
    @if (loading()) {
      <div class="skeleton">Loading...</div>
    } @else if (user()) {
      <article class="profile">
        <h2>{{ user()!.name }}</h2>
        <p>{{ user()!.email }}</p>
        <a [routerLink]="['/users', user()!.id, 'edit']">Edit</a>
      </article>
    } @else {
      <p>User not found</p>
    }
  `,
  styles: [`
    .profile { padding: 1rem; border-radius: 8px; }
    .skeleton { animation: pulse 1.5s infinite; }
  `],
})
export class UserProfileComponent {
  private userService = inject(UserService);

  // Signals — reactive state
  user = signal<User | null>(null);
  loading = signal(true);

  constructor() {
    this.loadUser();
  }

  private async loadUser() {
    try {
      const user = await this.userService.getUser('123');
      this.user.set(user);
    } finally {
      this.loading.set(false);
    }
  }
}

// ❌ LEGACY: NgModule-based component
// @NgModule({ declarations: [UserProfileComponent], imports: [...] })
// DON'T use NgModules for new code
```

---

## 3. Signals

```typescript
import { signal, computed, effect, untracked } from '@angular/core';

// signal() — Reactive primitive (like Vue's ref())
const count = signal(0);
const name = signal('Alice');
const items = signal<Item[]>([]);

// READ: Call the signal (it's a getter function)
console.log(count());  // 0
console.log(name());   // 'Alice'

// WRITE: .set(), .update(), .mutate()
count.set(5);                      // Replace value
count.update(c => c + 1);         // Transform based on current
items.update(list => [...list, newItem]); // Immutable update

// computed() — Derived signal (cached, auto-tracked)
const doubleCount = computed(() => count() * 2);
const activeItems = computed(() => items().filter(i => i.active));

// computed is LAZY — only evaluates when read
// computed is CACHED — recalculates only when dependencies change

// effect() — Side effect on signal change
effect(() => {
  // Automatically tracks count() and name()
  console.log(`Count: ${count()}, Name: ${name()}`);
  // Re-runs whenever count or name changes
});

// effect with cleanup
effect((onCleanup) => {
  const subscription = someObservable$.subscribe(data => {
    items.set(data);
  });

  onCleanup(() => subscription.unsubscribe());
});

// untracked() — Read signal without tracking
effect(() => {
  console.log(`Count: ${count()}`);           // TRACKED
  const n = untracked(() => name());           // NOT tracked
  // Effect only re-runs when count changes, not name
});
```

### 3.1 Signal-Based Inputs/Outputs (Angular 17.1+)

```typescript
import { Component, input, output, model } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-todo-item',
  template: `
    <li [class.completed]="todo().completed">
      <span>{{ todo().text }}</span>
      <button (click)="onToggle()">Toggle</button>
      <button (click)="onDelete()">Delete</button>
    </li>
  `,
})
export class TodoItemComponent {
  // Signal-based inputs (replaces @Input())
  todo = input.required<Todo>();               // Required input
  showActions = input(true);                   // Optional with default

  // Signal-based outputs (replaces @Output())
  toggled = output<string>();                  // Emits the todo ID
  deleted = output<string>();                  // Emits the todo ID

  // model() — Two-way binding signal (replaces @Input + @Output pair)
  // selected = model(false);
  // Parent: <app-todo-item [(selected)]="isSelected" />

  onToggle() {
    this.toggled.emit(this.todo().id);
  }

  onDelete() {
    this.deleted.emit(this.todo().id);
  }
}

// PARENT USAGE:
// <app-todo-item
//   [todo]="todo"
//   (toggled)="toggleTodo($event)"
//   (deleted)="deleteTodo($event)"
// />

// COMPARISON:
// OLD: @Input() todo!: Todo;           → NEW: todo = input.required<Todo>();
// OLD: @Output() toggled = new EventEmitter<string>(); → NEW: toggled = output<string>();
// Signal inputs are:
//   - Read-only (cannot be set from inside the component)
//   - Type-safe (no undefined unless optional)
//   - Reactive (can be used in computed/effect)
```

---

## 4. New Control Flow (Angular 17+)

```typescript
// NEW CONTROL FLOW — replaces *ngIf, *ngFor, *ngSwitch

@Component({
  template: `
    <!-- @if / @else if / @else -->
    @if (isLoggedIn()) {
      <app-dashboard />
    } @else if (isLoading()) {
      <app-spinner />
    } @else {
      <app-login />
    }

    <!-- @for with required track -->
    @for (item of items(); track item.id) {
      <app-item [item]="item" (deleted)="removeItem($event)" />
    } @empty {
      <p>No items found.</p>
    }

    <!-- @switch -->
    @switch (status()) {
      @case ('loading') {
        <app-spinner />
      }
      @case ('error') {
        <app-error [message]="errorMessage()" />
      }
      @case ('success') {
        <app-content [data]="data()" />
      }
      @default {
        <p>Unknown status</p>
      }
    }

    <!-- @defer — Lazy loading sections -->
    @defer (on viewport) {
      <app-heavy-chart [data]="chartData()" />
    } @placeholder {
      <div class="chart-placeholder">Chart loading...</div>
    } @loading (minimum 500ms) {
      <app-spinner />
    } @error {
      <p>Failed to load chart</p>
    }

    <!-- @defer triggers:
      on viewport  — when element enters viewport
      on idle      — when browser is idle
      on hover     — when user hovers
      on interaction — when user interacts (click, focus)
      on timer(5s) — after delay
      when condition — when expression is true
    -->
  `,
})
export class DashboardComponent {
  isLoggedIn = signal(false);
  isLoading = signal(true);
  items = signal<Item[]>([]);
  status = signal<'loading' | 'error' | 'success'>('loading');

  removeItem(id: string) {
    this.items.update(list => list.filter(i => i.id !== id));
  }
}

// ❌ LEGACY: Structural directives
// *ngIf="condition"           → @if (condition) { }
// *ngFor="let item of items"  → @for (item of items; track item.id) { }
// [ngSwitch]="value"          → @switch (value) { @case (...) { } }
// NEVER use structural directives in new code
```

---

## 5. Routing

```typescript
// app.routes.ts — Standalone routes (no RouterModule.forRoot needed)
import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', component: HomeComponent },

  // Lazy loading (ALWAYS for non-critical routes)
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component')
      .then(m => m.DashboardComponent),
    canActivate: [authGuard],
  },

  // Lazy load child routes
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes')
      .then(m => m.ADMIN_ROUTES),
    canActivate: [adminGuard],
  },

  // Dynamic params
  {
    path: 'users/:id',
    loadComponent: () => import('./users/user-detail.component')
      .then(m => m.UserDetailComponent),
    resolve: { user: userResolver },
  },

  // Wildcard (404)
  { path: '**', component: NotFoundComponent },
];

// Functional guards (Angular 15+)
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

// Functional resolver
export const userResolver: ResolveFn<User> = (route) => {
  const userService = inject(UserService);
  return userService.getUser(route.paramMap.get('id')!);
};

// Bootstrap (main.ts)
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
});
```

---

## 6. Services and HttpClient

```typescript
// Services — Injectable classes for business logic

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' }) // Singleton — available everywhere
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = '/api/users';

  // Signal-based state
  currentUser = signal<User | null>(null);

  getUsers() {
    return this.http.get<User[]>(this.apiUrl).pipe(
      catchError(this.handleError),
    );
  }

  getUser(id: string) {
    return this.http.get<User>(`${this.apiUrl}/${id}`).pipe(
      catchError(this.handleError),
    );
  }

  createUser(user: CreateUserDto) {
    return this.http.post<User>(this.apiUrl, user).pipe(
      catchError(this.handleError),
    );
  }

  private handleError(error: HttpErrorResponse) {
    let message = 'An error occurred';
    if (error.status === 0) {
      message = 'Network error — check your connection';
    } else if (error.status === 404) {
      message = 'Resource not found';
    } else if (error.error?.message) {
      message = error.error.message;
    }
    return throwError(() => new Error(message));
  }
}

// HTTP Interceptor (functional — Angular 15+)
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req);
};
```

---

## 7. Forms

```typescript
// REACTIVE FORMS — ALWAYS use for complex forms

import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div>
        <label for="name">Name</label>
        <input id="name" formControlName="name" />
        @if (form.controls.name.errors?.['required'] && form.controls.name.touched) {
          <span class="error">Name is required</span>
        }
        @if (form.controls.name.errors?.['minlength']) {
          <span class="error">Minimum 2 characters</span>
        }
      </div>

      <div>
        <label for="email">Email</label>
        <input id="email" type="email" formControlName="email" />
        @if (form.controls.email.errors?.['email'] && form.controls.email.touched) {
          <span class="error">Invalid email</span>
        }
      </div>

      <!-- Nested form group -->
      <fieldset formGroupName="address">
        <legend>Address</legend>
        <input formControlName="street" placeholder="Street" />
        <input formControlName="city" placeholder="City" />
        <input formControlName="zip" placeholder="ZIP" />
      </fieldset>

      <button type="submit" [disabled]="form.invalid || submitting()">
        {{ submitting() ? 'Saving...' : 'Save' }}
      </button>
    </form>
  `,
})
export class UserFormComponent {
  private fb = inject(FormBuilder);
  submitting = signal(false);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    address: this.fb.group({
      street: [''],
      city: ['', Validators.required],
      zip: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
    }),
  });

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      await this.saveUser(this.form.value);
    } finally {
      this.submitting.set(false);
    }
  }
}

// DECISION: Reactive Forms vs Template-Driven
// Reactive Forms → Complex forms, dynamic fields, cross-field validation, programmatic control
// Template-Driven → Simple forms (login, search), minimal validation
// RULE: Default to Reactive Forms for everything non-trivial
```

---

## 8. When to Choose Angular

```
ANGULAR DECISION TREE:

CHOOSE ANGULAR WHEN:
├── Enterprise team (10+ developers)?
│   └── YES → Angular ✅ (strong conventions, consistent codebase)
│
├── Need everything built-in (forms, HTTP, i18n, testing)?
│   └── YES → Angular ✅ (batteries included — no library selection paralysis)
│
├── Team already knows TypeScript well?
│   └── YES → Angular ✅ (TypeScript-first, strong typing everywhere)
│
├── Need strict architecture enforcement?
│   └── YES → Angular ✅ (opinionated structure, DI, CLI schematics)
│
├── Government/financial/healthcare regulated industry?
│   └── YES → Angular ✅ (LTS, enterprise support from Google)
│
├── Need strong i18n support?
│   └── YES → Angular ✅ (built-in i18n with AOT compilation)

CONSIDER ALTERNATIVES WHEN:
├── Small team (1-5 devs) → React or Vue (lighter weight)
├── Need React Native for mobile → React
├── Simple content site → Astro or Next.js
├── Prototype/MVP speed → Vue or Svelte
├── Maximum ecosystem/community → React
```

---

## 9. Angular vs React vs Vue

```
┌──────────────────┬───────────────┬──────────────┬──────────────┐
│                  │ Angular       │ React        │ Vue          │
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ Type             │ Framework     │ Library      │ Framework    │
│                  │ (everything)  │ (UI only)    │ (progressive)│
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ Language         │ TypeScript    │ TS or JS     │ TS or JS     │
│                  │ (required)    │ (optional)   │ (optional)   │
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ Reactivity       │ Signals       │ setState +   │ Proxy-based  │
│                  │ (fine-grained)│ re-render    │ (fine-grained)│
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ Templates        │ HTML with     │ JSX (JS)     │ HTML-based   │
│                  │ directives    │              │ templates    │
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ DI               │ Built-in      │ Context      │ Provide/     │
│                  │ (hierarchical)│ (basic)      │ Inject       │
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ State            │ Signals +     │ External     │ Pinia        │
│ management       │ Services      │ (Zustand etc)│ (official)   │
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ Forms            │ Built-in      │ React Hook   │ VeeValidate  │
│                  │ (Reactive)    │ Form         │ or manual    │
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ HTTP             │ HttpClient    │ fetch/axios  │ fetch/axios  │
│                  │ (built-in)    │ (external)   │ (external)   │
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ CLI              │ Angular CLI   │ Vite/CRA     │ create-vue   │
│                  │ (schematics)  │              │ (Vite)       │
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ Learning curve   │ Steep         │ Moderate     │ Gentle       │
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ Bundle (min+gz)  │ ~65KB         │ ~42KB        │ ~33KB        │
├──────────────────┼───────────────┼──────────────┼──────────────┤
│ Best for         │ Enterprise,   │ SPAs, mobile │ Progressive, │
│                  │ large teams   │ (RN), complex│ rapid dev,   │
│                  │              │ ecosystems   │ simpler DX   │
└──────────────────┴───────────────┴──────────────┴──────────────┘
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Using NgModules in new code** | Unnecessary boilerplate, complex dependency chains | Use standalone components exclusively |
| **Using *ngIf/*ngFor instead of @if/@for** | Inconsistent with modern Angular, harder to read | Use new control flow syntax (@if, @for, @switch) |
| **Constructor injection instead of inject()** | Verbose constructor with many parameters | Use `inject()` function — cleaner, works in functions |
| **Not using signals** | RxJS everywhere for simple state, over-complex code | Use signals for synchronous state, RxJS for async streams |
| **Subscribing without unsubscribing** | Memory leaks, stale subscriptions, zombie updates | Use `takeUntilDestroyed()`, async pipe, or `DestroyRef` |
| **Default change detection everywhere** | Entire component tree checked on every event | Use `OnPush` or migrate to signals + zoneless |
| **Not lazy loading routes** | Entire app in initial bundle, slow first load | Use `loadComponent` / `loadChildren` for routes |
| **Fat components (500+ lines)** | Untestable, unmaintainable, mixed concerns | Extract services, create child components, use composable patterns |
| **Circular dependencies** | Build warnings, runtime errors, tangled architecture | Use interfaces, injection tokens, reorganize module boundaries |
| **Not using @defer** | Heavy components loaded upfront, blocking initial render | Use `@defer` for below-fold or conditionally visible content |
| **Template-driven forms for complex cases** | Hard to test, validate, and control programmatically | Use Reactive Forms for any non-trivial form |
| **any type everywhere** | No type safety, bugs at runtime, defeats TypeScript | Enable strict mode, type everything, use generics |

---

## 11. Enforcement Checklist

### Project Setup
- [ ] Angular 17+ used for all new projects
- [ ] Standalone components used exclusively (no NgModules)
- [ ] TypeScript strict mode enabled
- [ ] Angular CLI used for code generation (ng generate)
- [ ] ESLint with @angular-eslint configured

### Components
- [ ] ALL components are standalone
- [ ] Signals used for component state
- [ ] Signal-based inputs (`input()`) used instead of `@Input()`
- [ ] Signal-based outputs (`output()`) used instead of `@Output()`
- [ ] New control flow (@if, @for, @switch) used — no structural directives
- [ ] @defer used for heavy below-fold components
- [ ] inject() used instead of constructor injection

### Routing
- [ ] Routes defined as standalone (no RouterModule)
- [ ] All non-critical routes lazy loaded (loadComponent/loadChildren)
- [ ] Guards and resolvers use functional API
- [ ] Route configuration is type-safe

### Services
- [ ] Services decorated with @Injectable({ providedIn: 'root' })
- [ ] HttpClient used with typed responses
- [ ] Error handling implemented for all HTTP calls
- [ ] Interceptors use functional API (HttpInterceptorFn)

### Forms
- [ ] Reactive Forms used for complex forms
- [ ] Validation feedback shown on touched + invalid
- [ ] Form submission disables button during processing
- [ ] Cross-field validation implemented where needed

### Performance
- [ ] OnPush change detection or zoneless mode used
- [ ] Subscriptions cleaned up (takeUntilDestroyed, async pipe)
- [ ] Track expression provided for all @for loops
- [ ] Bundle size monitored and optimized
