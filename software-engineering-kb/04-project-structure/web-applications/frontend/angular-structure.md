# Angular Project Structure — Complete Specification

> **AI Plugin Directive:** When a developer asks "how do I structure an Angular project?", "Angular standalone vs NgModules?", "Angular feature modules?", "how to organize Angular services?", "Angular CLI project structure?", or "Angular monorepo with Nx?", use this directive. Angular is an opinionated framework with a strong CLI and official style guide. Since Angular 17+, standalone components are the DEFAULT — NgModules are legacy for existing projects only. Angular projects MUST follow the official Angular Style Guide conventions. The CLI-generated structure is the starting point, NOT the final architecture.

---

## 1. The Core Rule

**Angular projects MUST use standalone components (Angular 17+) as the default. Organize by feature domain, NOT by technical type. Each feature is a self-contained directory with its components, services, models, and routes. Shared code lives in a `shared/` directory with barrel exports. Lazy load feature routes. Use the Angular CLI for all code generation (`ng generate`). Follow Angular's official style guide naming conventions: `feature-name.type.ts` (kebab-case with dot-separated type suffix).**

```
❌ WRONG: Organized by technical type (layer-first)
src/app/
├── components/
│   ├── user-list.component.ts
│   ├── user-detail.component.ts
│   ├── order-list.component.ts
│   └── dashboard.component.ts
├── services/
│   ├── user.service.ts
│   ├── order.service.ts
│   └── auth.service.ts
├── models/
│   ├── user.model.ts
│   └── order.model.ts
├── pipes/
│   └── currency.pipe.ts
└── guards/
    └── auth.guard.ts

✅ CORRECT: Organized by feature domain
src/app/
├── features/
│   ├── users/
│   │   ├── user-list/
│   │   │   └── user-list.component.ts
│   │   ├── user-detail/
│   │   │   └── user-detail.component.ts
│   │   ├── services/
│   │   │   └── user.service.ts
│   │   ├── models/
│   │   │   └── user.model.ts
│   │   └── users.routes.ts
│   ├── orders/
│   │   ├── ...
│   │   └── orders.routes.ts
│   └── dashboard/
│       └── ...
├── shared/
│   ├── components/
│   ├── pipes/
│   ├── directives/
│   └── services/
├── core/
│   ├── guards/
│   ├── interceptors/
│   └── services/
└── app.routes.ts
```

---

## 2. Enterprise Structure (Angular 17+ Standalone)

### Small-to-Medium Project

```
my-angular-app/
├── src/
│   ├── app/
│   │   ├── app.component.ts               ← Root component (standalone)
│   │   ├── app.component.html
│   │   ├── app.component.scss
│   │   ├── app.component.spec.ts
│   │   ├── app.config.ts                  ← Application config (providers)
│   │   ├── app.routes.ts                  ← Top-level route definitions
│   │   │
│   │   ├── core/                          ← Singleton services, app-wide concerns
│   │   │   ├── guards/
│   │   │   │   ├── auth.guard.ts
│   │   │   │   └── role.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   ├── auth.interceptor.ts    ← Adds Bearer token
│   │   │   │   ├── error.interceptor.ts   ← Global error handling
│   │   │   │   └── loading.interceptor.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts        ← Singleton auth service
│   │   │   │   ├── notification.service.ts
│   │   │   │   └── storage.service.ts
│   │   │   ├── models/
│   │   │   │   ├── api-response.model.ts
│   │   │   │   └── user-session.model.ts
│   │   │   └── constants/
│   │   │       ├── api-endpoints.ts
│   │   │       └── app.constants.ts
│   │   │
│   │   ├── features/                      ← Feature domains
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   │   ├── login.component.ts
│   │   │   │   │   ├── login.component.html
│   │   │   │   │   ├── login.component.scss
│   │   │   │   │   └── login.component.spec.ts
│   │   │   │   ├── register/
│   │   │   │   │   ├── register.component.ts
│   │   │   │   │   └── register.component.html
│   │   │   │   ├── services/
│   │   │   │   │   └── auth-api.service.ts
│   │   │   │   ├── models/
│   │   │   │   │   └── auth.model.ts
│   │   │   │   └── auth.routes.ts
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── dashboard.component.ts
│   │   │   │   ├── dashboard.component.html
│   │   │   │   ├── widgets/
│   │   │   │   │   ├── stats-widget/
│   │   │   │   │   │   └── stats-widget.component.ts
│   │   │   │   │   └── recent-activity/
│   │   │   │   │       └── recent-activity.component.ts
│   │   │   │   └── dashboard.routes.ts
│   │   │   │
│   │   │   ├── users/
│   │   │   │   ├── user-list/
│   │   │   │   │   ├── user-list.component.ts
│   │   │   │   │   └── user-list.component.html
│   │   │   │   ├── user-detail/
│   │   │   │   │   ├── user-detail.component.ts
│   │   │   │   │   └── user-detail.component.html
│   │   │   │   ├── user-form/
│   │   │   │   │   ├── user-form.component.ts
│   │   │   │   │   └── user-form.component.html
│   │   │   │   ├── services/
│   │   │   │   │   └── user.service.ts
│   │   │   │   ├── models/
│   │   │   │   │   └── user.model.ts
│   │   │   │   └── users.routes.ts
│   │   │   │
│   │   │   └── orders/
│   │   │       ├── order-list/
│   │   │       ├── order-detail/
│   │   │       ├── services/
│   │   │       ├── models/
│   │   │       └── orders.routes.ts
│   │   │
│   │   ├── shared/                        ← Shared reusable pieces
│   │   │   ├── components/
│   │   │   │   ├── button/
│   │   │   │   │   ├── button.component.ts
│   │   │   │   │   └── button.component.html
│   │   │   │   ├── data-table/
│   │   │   │   │   ├── data-table.component.ts
│   │   │   │   │   └── data-table.component.html
│   │   │   │   ├── confirm-dialog/
│   │   │   │   │   └── confirm-dialog.component.ts
│   │   │   │   └── page-header/
│   │   │   │       └── page-header.component.ts
│   │   │   ├── directives/
│   │   │   │   ├── click-outside.directive.ts
│   │   │   │   └── autofocus.directive.ts
│   │   │   ├── pipes/
│   │   │   │   ├── truncate.pipe.ts
│   │   │   │   ├── relative-time.pipe.ts
│   │   │   │   └── currency-format.pipe.ts
│   │   │   ├── validators/
│   │   │   │   ├── email.validator.ts
│   │   │   │   └── password-match.validator.ts
│   │   │   └── models/
│   │   │       ├── pagination.model.ts
│   │   │       └── sort.model.ts
│   │   │
│   │   └── layout/                        ← App shell components
│   │       ├── header/
│   │       │   ├── header.component.ts
│   │       │   └── header.component.html
│   │       ├── sidebar/
│   │       │   ├── sidebar.component.ts
│   │       │   └── sidebar.component.html
│   │       ├── footer/
│   │       │   └── footer.component.ts
│   │       └── main-layout/
│   │           ├── main-layout.component.ts
│   │           └── main-layout.component.html
│   │
│   ├── assets/
│   │   ├── images/
│   │   ├── icons/
│   │   └── i18n/
│   │       ├── en.json
│   │       └── el.json
│   ├── environments/
│   │   ├── environment.ts                 ← Default (dev)
│   │   └── environment.prod.ts            ← Production overrides
│   ├── styles/
│   │   ├── _variables.scss
│   │   ├── _mixins.scss
│   │   ├── _reset.scss
│   │   └── styles.scss                    ← Global entry point
│   ├── index.html
│   ├── main.ts                            ← Bootstrap entry
│   └── styles.scss
│
├── angular.json                           ← CLI workspace config
├── tsconfig.json                          ← Root TS config
├── tsconfig.app.json                      ← App-specific TS config
├── tsconfig.spec.json                     ← Test-specific TS config
├── package.json
└── .editorconfig
```

### Large Enterprise Project (Nx Monorepo)

```
my-org/
├── apps/
│   ├── web/                               ← Main Angular app
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── app.component.ts
│   │   │   │   ├── app.config.ts
│   │   │   │   ├── app.routes.ts
│   │   │   │   └── pages/                 ← Thin page components
│   │   │   │       ├── home/
│   │   │   │       ├── dashboard/
│   │   │   │       └── settings/
│   │   │   └── main.ts
│   │   ├── project.json                   ← Nx project config
│   │   └── tsconfig.app.json
│   │
│   └── admin/                             ← Admin Angular app
│       ├── src/
│       └── project.json
│
├── libs/                                  ← Shared libraries
│   ├── shared/
│   │   ├── ui/                            ← Shared UI components
│   │   │   ├── src/
│   │   │   │   ├── lib/
│   │   │   │   │   ├── button/
│   │   │   │   │   ├── data-table/
│   │   │   │   │   ├── modal/
│   │   │   │   │   └── index.ts
│   │   │   │   └── index.ts               ← Public API
│   │   │   └── project.json
│   │   ├── data-access/                   ← Shared API/state services
│   │   │   ├── src/lib/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── http-client.service.ts
│   │   │   │   └── index.ts
│   │   │   └── project.json
│   │   ├── util/                          ← Shared utilities
│   │   │   ├── src/lib/
│   │   │   │   ├── date.utils.ts
│   │   │   │   ├── string.utils.ts
│   │   │   │   └── index.ts
│   │   │   └── project.json
│   │   └── models/                        ← Shared interfaces/types
│   │       ├── src/lib/
│   │       │   ├── user.model.ts
│   │       │   ├── order.model.ts
│   │       │   └── index.ts
│   │       └── project.json
│   │
│   ├── users/                             ← Feature library
│   │   ├── feature/                       ← Smart components (containers)
│   │   │   ├── src/lib/
│   │   │   │   ├── user-list/
│   │   │   │   ├── user-detail/
│   │   │   │   └── index.ts
│   │   │   └── project.json
│   │   ├── data-access/                   ← API + state for users
│   │   │   ├── src/lib/
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── user.store.ts          ← NgRx ComponentStore or Signal Store
│   │   │   │   └── index.ts
│   │   │   └── project.json
│   │   └── ui/                            ← Presentational components
│   │       ├── src/lib/
│   │       │   ├── user-card/
│   │       │   ├── user-avatar/
│   │       │   └── index.ts
│   │       └── project.json
│   │
│   └── orders/                            ← Feature library
│       ├── feature/
│       ├── data-access/
│       └── ui/
│
├── nx.json                                ← Nx workspace config
├── tsconfig.base.json                     ← Base TS config
└── package.json

Nx Library Classification:
┌──────────────────┬──────────────────────────────────────────────────┐
│ Library Type     │ Purpose                                           │
├──────────────────┼──────────────────────────────────────────────────┤
│ feature          │ Smart components with routing (containers)        │
│ ui               │ Presentational components (dumb, input/output)    │
│ data-access      │ Services, state management, API calls             │
│ util             │ Pure functions, helpers, pipes                     │
│ models           │ Interfaces, types, enums                          │
│ shell            │ App shell with routing configuration              │
└──────────────────┴──────────────────────────────────────────────────┘

RULE: Nx enforces module boundaries — libs/users/feature CANNOT import libs/orders/data-access.
RULE: Dependency direction: feature → data-access → util/models. NEVER reverse.
RULE: shared/* libraries are importable by ANY feature. Feature libs are scoped.
```

---

## 3. Angular 17+ Standalone Components

### Application Bootstrap

```typescript
// main.ts — Standalone bootstrap (Angular 17+)
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
```

```typescript
// app.config.ts — Application configuration
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor])
    ),
    provideAnimationsAsync(),
  ],
};
```

```typescript
// app.component.ts — Root component
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
```

### Standalone Component Pattern

```typescript
// features/users/user-list/user-list.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService } from '../services/user.service';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { User } from '../models/user.model';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [AsyncPipe, RouterLink, DataTableComponent, PageHeaderComponent],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);

  users$ = this.userService.getUsers();

  ngOnInit(): void {
    // Component initialization
  }
}
```

```
RULE: ALL new components MUST be standalone: true (default in Angular 17+).
RULE: Import dependencies directly in the component's imports array.
RULE: Use inject() function instead of constructor injection (preferred in standalone).
RULE: NgModules are LEGACY — use ONLY for migrating existing projects.
```

---

## 4. Routing (Standalone)

### Top-Level Routes

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  // Public routes
  {
    path: '',
    loadComponent: () => import('./features/home/home.component')
      .then(m => m.HomeComponent),
  },

  // Auth routes (lazy loaded)
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes')
      .then(m => m.AUTH_ROUTES),
  },

  // Protected routes with layout
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component')
          .then(m => m.DashboardComponent),
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes')
          .then(m => m.USERS_ROUTES),
      },
      {
        path: 'orders',
        loadChildren: () => import('./features/orders/orders.routes')
          .then(m => m.ORDERS_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes')
          .then(m => m.SETTINGS_ROUTES),
      },
    ],
  },

  // Wildcard
  {
    path: '**',
    loadComponent: () => import('./shared/components/not-found/not-found.component')
      .then(m => m.NotFoundComponent),
  },
];
```

### Feature Routes

```typescript
// features/users/users.routes.ts
import { Routes } from '@angular/router';

export const USERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./user-list/user-list.component')
      .then(m => m.UserListComponent),
  },
  {
    path: 'new',
    loadComponent: () => import('./user-form/user-form.component')
      .then(m => m.UserFormComponent),
  },
  {
    path: ':id',
    loadComponent: () => import('./user-detail/user-detail.component')
      .then(m => m.UserDetailComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./user-form/user-form.component')
      .then(m => m.UserFormComponent),
  },
];
```

```
RULE: ALWAYS lazy load feature routes with loadChildren() or loadComponent().
RULE: Export route arrays as const (USERS_ROUTES), NOT as modules.
RULE: Use withComponentInputBinding() to automatically bind route params to component inputs.
RULE: Guards use functional style: export const authGuard: CanActivateFn = () => { ... }
```

---

## 5. Signals and State Management (Angular 17+)

### Signal-Based Component

```typescript
// features/users/user-list/user-list.component.ts
import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-user-list',
  standalone: true,
  template: `
    <input [value]="searchQuery()" (input)="searchQuery.set($event.target.value)" />
    @if (loading()) {
      <app-spinner />
    } @else {
      <app-data-table [data]="filteredUsers()" />
    }
    <p>Showing {{ filteredUsers().length }} of {{ users().length }} users</p>
  `,
})
export class UserListComponent {
  private userService = inject(UserService);

  searchQuery = signal('');
  users = toSignal(this.userService.getUsers(), { initialValue: [] });
  loading = signal(true);

  filteredUsers = computed(() =>
    this.users().filter(u =>
      u.name.toLowerCase().includes(this.searchQuery().toLowerCase())
    )
  );
}
```

### NgRx Signal Store (Angular 17+)

```typescript
// features/users/store/user.store.ts
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { inject, computed } from '@angular/core';
import { pipe, switchMap, tap } from 'rxjs';
import { UserService } from '../services/user.service';
import { User } from '../models/user.model';

type UserState = {
  users: User[];
  loading: boolean;
  error: string | null;
  filter: string;
};

const initialState: UserState = {
  users: [],
  loading: false,
  error: null,
  filter: '',
};

export const UserStore = signalStore(
  withState(initialState),
  withComputed((state) => ({
    filteredUsers: computed(() =>
      state.users().filter(u =>
        u.name.toLowerCase().includes(state.filter().toLowerCase())
      )
    ),
    totalCount: computed(() => state.users().length),
  })),
  withMethods((store, userService = inject(UserService)) => ({
    setFilter(filter: string) {
      patchState(store, { filter });
    },
    loadUsers: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          userService.getUsers().pipe(
            tap(users => patchState(store, { users, loading: false })),
          )
        ),
      )
    ),
  })),
);
```

```
State Management Decision Tree:

START: What state management does this feature need?

Simple component state (toggle, form input)?
├── YES → signal() in the component. No external store.
└── NO ↓

Shared state between 2-3 components in same feature?
├── YES → Service with signals (inject in components).
└── NO ↓

Complex state with side effects (API calls, caching)?
├── YES → NgRx Signal Store (@ngrx/signals).
└── NO ↓

Enterprise-wide state with devtools, undo/redo, persistence?
└── YES → NgRx Store (@ngrx/store) with full Redux pattern.

RULE: Start simple (signals) and evolve to stores only when complexity demands it.
RULE: NgRx Signal Store is the RECOMMENDED default for feature-level state (Angular 17+).
RULE: Full NgRx Store is ONLY for apps with complex state interactions across many features.
```

---

## 6. Services and Dependency Injection

### Service Organization

```typescript
// core/services/auth.service.ts — Application-wide singleton
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints';

@Injectable({ providedIn: 'root' })  // Singleton — app-wide
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  currentUser = signal<User | null>(null);
  isAuthenticated = signal(false);

  login(credentials: LoginCredentials) {
    return this.http.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, credentials).pipe(
      tap(response => {
        this.currentUser.set(response.user);
        this.isAuthenticated.set(true);
        localStorage.setItem('token', response.token);
      }),
    );
  }

  logout() {
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    localStorage.removeItem('token');
    this.router.navigate(['/auth/login']);
  }
}
```

```typescript
// features/users/services/user.service.ts — Feature-scoped
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User, CreateUserDto } from '../models/user.model';
import { PaginatedResponse } from '@shared/models/pagination.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private baseUrl = '/api/users';

  getUsers(page = 1, limit = 20): Observable<PaginatedResponse<User>> {
    return this.http.get<PaginatedResponse<User>>(this.baseUrl, {
      params: { page, limit },
    });
  }

  getUserById(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  createUser(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.baseUrl, dto);
  }

  updateUser(id: string, dto: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, dto);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
```

```
Service Placement Rules:
┌──────────────────────────┬──────────────────────────────────────────────┐
│ Service Type             │ Location                                      │
├──────────────────────────┼──────────────────────────────────────────────┤
│ App-wide singletons      │ core/services/ (auth, notification, storage) │
│ Feature-specific         │ features/{name}/services/                     │
│ Shared utility services  │ shared/services/ (used by 3+ features)       │
│ HTTP interceptors        │ core/interceptors/                            │
│ Route guards             │ core/guards/                                  │
└──────────────────────────┴──────────────────────────────────────────────┘

RULE: providedIn: 'root' for most services (tree-shakeable singletons).
RULE: Use inject() function instead of constructor injection (Angular 14+).
RULE: Feature services live INSIDE the feature directory.
RULE: Core services are app-wide singletons that NEVER belong to a feature.
```

---

## 7. Interceptors and Guards (Functional Style)

### Functional Interceptor (Angular 17+)

```typescript
// core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');

  if (token) {
    const cloned = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(cloned);
  }

  return next(req);
};

// core/interceptors/error.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError(error => {
      if (error.status === 401) {
        localStorage.removeItem('token');
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    }),
  );
};
```

### Functional Guard

```typescript
// core/guards/auth.guard.ts
import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};

// core/guards/role.guard.ts
export const roleGuard = (requiredRole: string): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    return authService.currentUser()?.role === requiredRole;
  };
};
```

```
RULE: Use FUNCTIONAL interceptors and guards (Angular 15+).
RULE: Class-based interceptors and guards are LEGACY — do not use for new code.
RULE: Register interceptors in app.config.ts with withInterceptors([]).
RULE: Guards return boolean | UrlTree | Observable<boolean>.
```

---

## 8. Angular CLI Commands and File Naming

### CLI Generation Commands

```bash
# Generate standalone component
ng generate component features/users/user-list --standalone

# Generate service
ng generate service features/users/services/user

# Generate guard (functional)
ng generate guard core/guards/auth --functional

# Generate pipe
ng generate pipe shared/pipes/truncate --standalone

# Generate directive
ng generate directive shared/directives/click-outside --standalone

# Generate interceptor (functional)
ng generate interceptor core/interceptors/auth --functional
```

### Naming Conventions (Official Style Guide)

```
┌────────────────────┬────────────────────────────────────────────────────┐
│ Type               │ Naming Convention                                   │
├────────────────────┼────────────────────────────────────────────────────┤
│ Component          │ user-list.component.ts → UserListComponent          │
│ Service            │ user.service.ts → UserService                       │
│ Guard              │ auth.guard.ts → authGuard (function)                │
│ Interceptor        │ auth.interceptor.ts → authInterceptor (function)    │
│ Pipe               │ truncate.pipe.ts → TruncatePipe                     │
│ Directive          │ click-outside.directive.ts → ClickOutsideDirective  │
│ Model/Interface    │ user.model.ts → User, CreateUserDto                 │
│ Enum               │ order-status.enum.ts → OrderStatus                  │
│ Routes             │ users.routes.ts → USERS_ROUTES                      │
│ Store              │ user.store.ts → UserStore                           │
│ Resolver           │ user.resolver.ts → userResolver                     │
│ Spec (test)        │ user.service.spec.ts                                │
│ Environment        │ environment.ts, environment.prod.ts                  │
└────────────────────┴────────────────────────────────────────────────────┘

RULE: File names use kebab-case with dot-separated type suffix.
RULE: Class names use PascalCase. Function names use camelCase.
RULE: One class per file. File name matches the class name.
RULE: Spec files are co-located: user.service.ts + user.service.spec.ts
RULE: ALWAYS use the CLI to generate files — it creates the correct boilerplate.
```

---

## 9. Core vs Shared vs Features

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ Layer    │ Purpose and Rules                                            │
├──────────┼──────────────────────────────────────────────────────────────┤
│ core/    │ App-wide singletons. Instantiated ONCE.                      │
│          │ Contains: auth service, interceptors, guards, app constants  │
│          │ RULE: NEVER imported by features. Only by app root.          │
│          │ RULE: Every service here is providedIn: 'root'.              │
├──────────┼──────────────────────────────────────────────────────────────┤
│ shared/  │ Reusable UI components, pipes, directives.                   │
│          │ Contains: buttons, tables, pipes, validators                 │
│          │ RULE: NO business logic. Pure presentation and utilities.    │
│          │ RULE: Imported by 3+ features (Rule of Three).              │
│          │ RULE: Has barrel exports (index.ts) for public API.         │
├──────────┼──────────────────────────────────────────────────────────────┤
│ features/│ Business domains. Each feature is self-contained.            │
│          │ Contains: components, services, models, routes               │
│          │ RULE: Features NEVER import from other features.             │
│          │ RULE: Features import from shared/ and core/ only.           │
│          │ RULE: Each feature has its own routes file.                  │
├──────────┼──────────────────────────────────────────────────────────────┤
│ layout/  │ App shell (header, sidebar, footer).                         │
│          │ Contains: structural layout components                       │
│          │ RULE: These are the "chrome" of the app.                    │
│          │ RULE: Used by route configuration, not imported by features. │
└──────────┴──────────────────────────────────────────────────────────────┘

Dependency Direction (strictly enforced):
  features/ → shared/ → (no dependencies)
  features/ → core/   → (no dependencies)
  features/ ✗→ features/  ← FORBIDDEN

If two features need to share data, use a core/ service or NgRx store.
```

---

## 10. Testing Structure

```
src/app/
├── features/
│   └── users/
│       ├── user-list/
│       │   ├── user-list.component.ts
│       │   └── user-list.component.spec.ts    ← Co-located unit test
│       ├── services/
│       │   ├── user.service.ts
│       │   └── user.service.spec.ts           ← Co-located unit test
│       └── models/
│           └── user.model.ts
├── shared/
│   └── pipes/
│       ├── truncate.pipe.ts
│       └── truncate.pipe.spec.ts              ← Co-located unit test

e2e/                                           ← E2E tests (Cypress/Playwright)
├── fixtures/
│   └── users.json
├── support/
│   ├── commands.ts
│   └── e2e.ts
└── specs/
    ├── auth/
    │   ├── login.cy.ts
    │   └── register.cy.ts
    └── users/
        ├── user-list.cy.ts
        └── user-crud.cy.ts

RULE: Unit tests are ALWAYS co-located (same folder as source file).
RULE: E2E tests live in e2e/ at project root, organized by feature.
RULE: Angular CLI generates .spec.ts files automatically. DO NOT skip them.
RULE: Use Angular TestBed for component tests, plain Jasmine/Jest for services/utils.
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **NgModules in new project** | SharedModule, CoreModule, FeatureModule boilerplate | Use standalone components (Angular 17+ default) |
| **Layer-first organization** | components/, services/, models/ at root level | Feature-first: features/{name}/ with co-located files |
| **Feature cross-imports** | UserService imports from OrderService directly | Use core/ service or shared state management |
| **Constructor injection** | `constructor(private svc: MyService)` everywhere | Use `inject(MyService)` function (Angular 14+) |
| **Class-based guards** | `@Injectable() class AuthGuard implements CanActivate` | Functional guards: `export const authGuard: CanActivateFn` |
| **Eager loading all routes** | Every feature loaded in initial bundle | Lazy load with `loadChildren()` and `loadComponent()` |
| **No barrel exports** | `import { X } from '../../../shared/components/button/button.component'` | Add index.ts: `export { ButtonComponent } from './button.component'` |
| **Fat components** | Component with 300+ lines, API calls, business logic | Extract to services, use smart/dumb component pattern |
| **God service** | One AppService with every method in the app | Split by domain: AuthService, UserService, OrderService |
| **Subscribing in components** | `.subscribe()` without unsubscription | Use `async` pipe, `toSignal()`, or `takeUntilDestroyed()` |
| **No environments** | Hardcoded API URLs, config values | Use environment.ts / environment.prod.ts |
| **Shared module with everything** | SharedModule imports/exports 50+ items | Split: SharedUIModule, SharedPipesModule or use standalone |
| **Manual file creation** | Creating component files by hand | ALWAYS use `ng generate` CLI commands |

---

## 12. Enforcement Checklist

- [ ] **Standalone components** — all new components are standalone: true
- [ ] **Feature-first structure** — features/{name}/ with co-located files
- [ ] **core/ for singletons** — auth, interceptors, guards, app-wide services
- [ ] **shared/ for reusables** — UI components, pipes, directives (3+ consumers)
- [ ] **Lazy-loaded routes** — every feature uses loadChildren() or loadComponent()
- [ ] **Functional guards/interceptors** — CanActivateFn, HttpInterceptorFn
- [ ] **inject() function** — not constructor injection
- [ ] **Signals for state** — signal(), computed(), effect() for reactive state
- [ ] **Angular CLI used** — ng generate for all new files
- [ ] **Naming conventions** — kebab-case.type.ts (user-list.component.ts)
- [ ] **Co-located tests** — .spec.ts next to source files
- [ ] **Barrel exports** — index.ts in shared/ subdirectories
- [ ] **No cross-feature imports** — features don't import from other features
- [ ] **Environments configured** — environment.ts + environment.prod.ts
- [ ] **Path aliases** — @shared/*, @core/*, @features/* in tsconfig

---

## 13. New Control Flow and Deferrable Views (Angular 17+)

### New Control Flow (@if, @for, @switch)

```html
<!-- PREFERRED (v17+): New built-in control flow -->
@if (loading()) {
  <app-spinner />
} @else if (error()) {
  <app-error-message [message]="error()!" />
} @else {
  @for (order of filteredOrders(); track order.id) {
    <app-order-card [order]="order" (click)="selectOrder(order)" />
  } @empty {
    <app-empty-state message="No orders found" />
  }
}

@switch (order().status) {
  @case ('pending') { <span class="badge-yellow">Pending</span> }
  @case ('shipped') { <span class="badge-blue">Shipped</span> }
  @case ('delivered') { <span class="badge-green">Delivered</span> }
  @default { <span>{{ order().status }}</span> }
}

<!-- LEGACY (avoid for new code) -->
<app-spinner *ngIf="loading$ | async"></app-spinner>
<div *ngFor="let order of orders$ | async; trackBy: trackById">
  <app-order-card [order]="order"></app-order-card>
</div>

RULE: Use @if, @for, @switch for ALL new templates (Angular 17+).
RULE: @for REQUIRES a track expression — this is enforced at compile time.
RULE: @empty block is optional but recommended for lists.
RULE: *ngIf / *ngFor are LEGACY — migrate when touching old templates.
```

### Deferrable Views (@defer)

```html
<!-- Lazy load heavy components — only render when scrolled into view -->
@defer (on viewport) {
  <app-analytics-chart [data]="chartData()" />
} @loading (minimum 500ms) {
  <app-skeleton height="300px" />
} @placeholder {
  <div class="chart-placeholder">Chart loads on scroll</div>
} @error {
  <app-error-message message="Failed to load chart" />
}

<!-- Lazy load after user interaction -->
@defer (on interaction) {
  <app-advanced-filters />
} @placeholder {
  <button>Show Advanced Filters</button>
}

<!-- Lazy load after a timer -->
@defer (on timer(3s)) {
  <app-recommendation-widget />
}

RULE: @defer creates a separate JavaScript chunk — automatic code splitting.
RULE: Use @defer for heavy components: charts, editors, maps, complex tables.
RULE: @loading, @placeholder, @error blocks are optional but recommended.
RULE: @defer replaces manual lazy loading with loadComponent() in many cases.
```

---

## 14. Nx Module Boundary Enforcement

### Tags and Boundary Rules

```json
// nx.json
{
  "targetDefaults": { ... },
  "namedInputs": { ... }
}

// project.json for each library
// libs/features/orders/project.json
{
  "name": "features-orders",
  "tags": ["type:feature", "scope:orders"]
}

// libs/shared/ui/project.json
{
  "name": "shared-ui",
  "tags": ["type:ui", "scope:shared"]
}

// libs/shared/data-access/project.json
{
  "name": "shared-data-access",
  "tags": ["type:data-access", "scope:shared"]
}

// .eslintrc.json — Enforce boundaries
{
  "rules": {
    "@nx/enforce-module-boundaries": [
      "error",
      {
        "depConstraints": [
          // Features can use ui, data-access, util
          { "sourceTag": "type:feature", "onlyDependOnLibsWithTags": ["type:ui", "type:data-access", "type:util"] },
          // UI can only use util
          { "sourceTag": "type:ui", "onlyDependOnLibsWithTags": ["type:util"] },
          // Data-access can use util
          { "sourceTag": "type:data-access", "onlyDependOnLibsWithTags": ["type:util"] },
          // Util has no dependencies
          { "sourceTag": "type:util", "onlyDependOnLibsWithTags": [] },
          // Scope isolation — orders cannot import products
          { "sourceTag": "scope:orders", "notDependOnLibsWithTags": ["scope:products", "scope:customers"] },
          { "sourceTag": "scope:products", "notDependOnLibsWithTags": ["scope:orders", "scope:customers"] }
        ]
      }
    ]
  }
}

RULE: Nx boundary enforcement runs in CI — broken boundaries FAIL the build.
RULE: Tags define both type (feature, ui, data-access, util) and scope (orders, products).
RULE: This is the most effective way to prevent spaghetti architecture in large Angular apps.
```

---

## 15. Real-World Examples and References

### Open Source Reference Projects

| Repository | Description | Key Pattern |
|-----------|-------------|-------------|
| `angular/angular` | Angular framework itself | Nx workspace, library-based |
| `angular/components` | Angular Material + CDK | Library architecture |
| `nrwl/nx-examples` | Nx workspace examples | Monorepo with Angular libs |
| `tomastrajan/angular-ngrx-material-starter` | Enterprise starter | NgRx + Material + best practices |
| `nicolestandifer3/angular-enterprise-example` | Enterprise patterns | Core/shared/feature pattern |
| `AhsanAyaz/ng-cookbook` | Angular Cookbook examples | Various architecture patterns |

### Companies Using Angular Enterprise Patterns

- **Google** (Ads, Cloud Console, Firebase Console, internal tools)
- **Microsoft** (Azure Portal, Office 365 admin, Xbox)
- **Deutsche Bank** (trading platforms, internal tools)
- **Samsung** (internal enterprise tools)
- **BMW** (automotive dashboards)
- **Upwork** (freelancer marketplace)
- **Forbes** (media platform)

### Path Alias Configuration

```json
// tsconfig.json — Configure path aliases
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@core/*": ["src/app/core/*"],
      "@shared/*": ["src/app/shared/*"],
      "@features/*": ["src/app/features/*"],
      "@layout/*": ["src/app/layout/*"],
      "@env/*": ["src/environments/*"]
    }
  }
}

// Usage in imports:
import { AuthService } from '@core/services/auth.service';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { OrdersApiService } from '@features/orders/services/orders-api.service';
import { environment } from '@env/environment';
```

---

## 16. Comparison: Small vs Enterprise Structure

```
┌──────────────────────┬──────────────────────────────────┬────────────────────────────────────┐
│ Concern              │ Small (1-5 devs)                 │ Enterprise (10+ devs, Nx)           │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Workspace            │ Single Angular CLI project       │ Nx monorepo with apps/ and libs/    │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Features             │ features/ directory in src/app   │ libs/features/{name}/ as Nx libs    │
│                      │                                  │ with enforced boundaries             │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Shared components    │ shared/components/ directory     │ libs/shared/ui/ as separate lib      │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ State management     │ Services with signals            │ NgRx SignalStore per feature          │
│                      │                                  │ Full NgRx Store for cross-feature     │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Testing              │ Co-located .spec.ts files        │ Nx affected:test + E2E + visual       │
│                      │                                  │ regression testing                    │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Import boundaries    │ ESLint no-restricted-imports     │ Nx enforce-module-boundaries with     │
│                      │                                  │ tags (type + scope)                   │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ Build                │ ng build                         │ Nx affected:build with remote cache   │
│                      │                                  │ and distributed task execution         │
├──────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│ CI                   │ Lint + test + build              │ Nx Cloud + affected commands +         │
│                      │                                  │ parallel execution + remote cache      │
└──────────────────────┴──────────────────────────────────┴────────────────────────────────────┘
```
