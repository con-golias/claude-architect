# Angular Dependency Injection — Complete Specification

> **AI Plugin Directive:** When a developer asks "how does Angular DI work?", "explain Angular dependency injection", "when to use inject() vs constructor?", "what are injection tokens?", "how to scope services?", "explain hierarchical injectors", or any Angular DI question, ALWAYS consult this directive. Apply the `inject()` function pattern, `providedIn: 'root'` for singleton services, and component-level providers for scoped instances. NEVER use NgModule providers arrays in new code.

**Core Rule: Angular's dependency injection system is HIERARCHICAL — services can be singleton (root), scoped to a component subtree, or scoped to a route. Use `inject()` function for ALL dependency injection — constructor injection is verbose legacy. Use `providedIn: 'root'` for singleton services. Use component-level `providers` for scoped instances. NEVER create services without `@Injectable()`. Use `InjectionToken` for non-class dependencies (config, feature flags).**

---

## 1. DI Architecture

```
            ANGULAR HIERARCHICAL INJECTOR TREE

  ┌──────────────────────────────────────────────────┐
  │ Platform Injector                                │
  │ (shared across multiple apps — rare)             │
  └──────────────────┬───────────────────────────────┘
                     │
  ┌──────────────────▼───────────────────────────────┐
  │ Root Injector (providedIn: 'root')               │
  │ ┌──────────────────────────────────────────────┐ │
  │ │ AuthService (singleton)                      │ │
  │ │ HttpClient (singleton)                       │ │
  │ │ ApiService (singleton)                       │ │
  │ └──────────────────────────────────────────────┘ │
  └──────────────────┬───────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
  ┌─────▼────┐ ┌────▼─────┐ ┌───▼──────┐
  │ Route A  │ │ Route B  │ │ Route C  │
  │ Injector │ │ Injector │ │ Injector │
  │ (lazy)   │ │ (lazy)   │ │          │
  └────┬─────┘ └──────────┘ └──────────┘
       │
  ┌────▼──────────────────┐
  │ Component Injector    │
  │ ┌──────────────────┐  │
  │ │ FormService      │  │ ← New instance per component
  │ │ (scoped to this  │  │
  │ │  component tree)  │  │
  │ └──────────────────┘  │
  └───────────────────────┘

  RESOLUTION ORDER:
  1. Component's own providers
  2. Parent component's providers
  3. Route-level providers
  4. Root injector
  5. Platform injector
  → If not found: NullInjectorError
```

---

## 2. inject() Function (Modern Pattern)

```typescript
import { inject, Injectable, InjectionToken } from '@angular/core';

// SERVICE DEFINITION
@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = inject(API_URL); // Injection token

  getUsers() {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }
}

// COMPONENT USAGE
@Component({
  standalone: true,
  template: `...`,
})
export class UserListComponent {
  // ✅ MODERN: inject() function
  private userService = inject(UserService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  users = signal<User[]>([]);

  constructor() {
    this.userService.getUsers().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(users => this.users.set(users));
  }
}

// ❌ LEGACY: Constructor injection
export class UserListComponent {
  constructor(
    private userService: UserService,  // Works but verbose
    private router: Router,
    private destroyRef: DestroyRef,
  ) {}
}

// inject() ADVANTAGES over constructor injection:
// 1. Can be called in functions, not just constructors
// 2. Cleaner — no constructor parameter list
// 3. Works in functional guards, resolvers, interceptors
// 4. Can be used in base classes without super() chain
// 5. Works with InjectionToken more naturally
```

### 2.1 inject() Options

```typescript
// OPTIONAL — Returns null if not found (no error)
const analytics = inject(AnalyticsService, { optional: true });
// analytics is AnalyticsService | null

// SELF — Only look in this component's own injector
const formState = inject(FormStateService, { self: true });

// SKIP_SELF — Skip this component, start from parent
const parentLayout = inject(LayoutService, { skipSelf: true });

// HOST — Look up to the host component only
const hostRef = inject(ElementRef, { host: true });

// DEFAULT VALUE — No error, use default
const config = inject(AppConfig, { optional: true }) ?? DEFAULT_CONFIG;

// USE IN FUNCTIONS (outside constructor) — requires injection context
function createUserService() {
  const http = inject(HttpClient); // Works in injection context
  return new UserService(http);
}

// RULE: inject() can only be called in:
// 1. Constructor
// 2. Field initializers
// 3. Factory functions called during construction
// 4. Functions with runInInjectionContext()
```

---

## 3. Service Scoping

```typescript
// SCOPE 1: Root Singleton (most common)
@Injectable({ providedIn: 'root' })
export class AuthService {
  // ONE instance for entire application
  // Tree-shakeable — removed from bundle if not injected
  currentUser = signal<User | null>(null);
}

// SCOPE 2: Component-Level (new instance per component)
@Component({
  standalone: true,
  providers: [FormStateService], // New instance for this component tree
  template: `...`,
})
export class OrderFormComponent {
  private formState = inject(FormStateService);
  // This FormStateService is unique to this component and its children
}

// SCOPE 3: Route-Level (new instance per lazy-loaded route)
// admin.routes.ts
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    providers: [AdminService], // Scoped to admin route subtree
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'users', component: AdminUsersComponent },
    ],
  },
];

// SCOPE 4: Platform (shared across Angular apps — very rare)
@Injectable({ providedIn: 'platform' })
export class SharedAnalyticsService { }

// DECISION TREE:
// Is it a global singleton? (auth, API, router) → providedIn: 'root'
// Does each component need its own instance? → Component providers
// Is it scoped to a lazy-loaded section? → Route providers
// Is it shared across multiple Angular apps? → providedIn: 'platform'
```

---

## 4. InjectionToken

```typescript
import { InjectionToken, inject } from '@angular/core';

// FOR NON-CLASS DEPENDENCIES (strings, objects, functions, config)

// Define the token
export const API_URL = new InjectionToken<string>('API_URL');

export interface AppConfig {
  apiUrl: string;
  environment: 'development' | 'staging' | 'production';
  featureFlags: Record<string, boolean>;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

// Provide values
// main.ts
bootstrapApplication(AppComponent, {
  providers: [
    { provide: API_URL, useValue: 'https://api.example.com' },
    {
      provide: APP_CONFIG,
      useValue: {
        apiUrl: 'https://api.example.com',
        environment: 'production',
        featureFlags: { darkMode: true, newCheckout: false },
      },
    },
  ],
});

// Consume
@Component({...})
export class ApiService {
  private apiUrl = inject(API_URL);
  private config = inject(APP_CONFIG);
}

// FACTORY PROVIDER — Compute value dynamically
export const IS_MOBILE = new InjectionToken<boolean>('IS_MOBILE', {
  providedIn: 'root',
  factory: () => window.innerWidth < 768,
});

// MULTI-PROVIDER — Multiple values for same token
export const HTTP_INTERCEPTORS = new InjectionToken<HttpInterceptorFn[]>('INTERCEPTORS');

bootstrapApplication(AppComponent, {
  providers: [
    { provide: HTTP_INTERCEPTORS, useValue: authInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useValue: loggingInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useValue: errorInterceptor, multi: true },
  ],
});

// Inject all:
const interceptors = inject(HTTP_INTERCEPTORS); // HttpInterceptorFn[]
```

---

## 5. Provider Types

```typescript
// useClass — Provide a class (most common)
{ provide: UserService, useClass: UserService }
// Shorthand: just UserService in providers array

// useClass with substitution (testing, feature flags)
{ provide: UserService, useClass: MockUserService }
// Injecting UserService gives MockUserService instance

// useValue — Provide a constant value
{ provide: API_URL, useValue: 'https://api.example.com' }
{ provide: IS_PRODUCTION, useValue: true }

// useFactory — Compute value with dependencies
{
  provide: Logger,
  useFactory: () => {
    const config = inject(APP_CONFIG);
    return config.environment === 'production'
      ? new ProductionLogger()
      : new DevelopmentLogger();
  },
}

// useExisting — Alias one token to another
{ provide: AbstractLogger, useExisting: ConsoleLogger }
// Injecting AbstractLogger gives the ConsoleLogger instance

// COMPARISON:
// useClass    → Create new instance of given class
// useValue    → Use exact value provided
// useFactory  → Call function to create value (with DI access)
// useExisting → Reference another provider
```

---

## 6. Advanced DI Patterns

### 6.1 Abstract Class + Multiple Implementations

```typescript
// Define abstract contract
abstract class NotificationService {
  abstract send(message: string): void;
}

// Implementation 1
@Injectable()
class EmailNotificationService extends NotificationService {
  send(message: string) {
    console.log(`Email: ${message}`);
  }
}

// Implementation 2
@Injectable()
class PushNotificationService extends NotificationService {
  send(message: string) {
    console.log(`Push: ${message}`);
  }
}

// Choose implementation based on config
bootstrapApplication(AppComponent, {
  providers: [
    {
      provide: NotificationService,
      useFactory: () => {
        const config = inject(APP_CONFIG);
        return config.usePush
          ? new PushNotificationService()
          : new EmailNotificationService();
      },
    },
  ],
});

// Consumer doesn't know which implementation
@Component({...})
export class AlertComponent {
  private notifications = inject(NotificationService);
  // Works with either implementation
}
```

### 6.2 DestroyRef Pattern

```typescript
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({...})
export class DataComponent {
  private destroyRef = inject(DestroyRef);

  constructor() {
    // Auto-unsubscribe when component is destroyed
    this.dataService.getData().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(data => this.data.set(data));

    // Manual cleanup registration
    this.destroyRef.onDestroy(() => {
      this.socket?.disconnect();
      this.timer?.cancel();
    });
  }
}

// In functional context (guard, resolver):
export const dataResolver: ResolveFn<Data> = () => {
  const destroyRef = inject(DestroyRef);
  const dataService = inject(DataService);

  return dataService.getData().pipe(
    takeUntilDestroyed(destroyRef),
  );
};
```

### 6.3 runInInjectionContext

```typescript
import { runInInjectionContext, Injector, inject } from '@angular/core';

// Call inject() outside normal injection context
@Component({...})
export class DynamicComponent {
  private injector = inject(Injector);

  loadFeature() {
    // Create injection context on-demand
    runInInjectionContext(this.injector, () => {
      const featureService = inject(FeatureService);
      featureService.initialize();
    });
  }
}
```

---

## 7. Testing with DI

```typescript
import { TestBed } from '@angular/core/testing';

describe('UserComponent', () => {
  let component: UserComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // Override providers for testing
      providers: [
        { provide: UserService, useClass: MockUserService },
        { provide: API_URL, useValue: 'http://localhost:3000' },
      ],
    });

    component = TestBed.createComponent(UserComponent).componentInstance;
  });

  it('should load users', () => {
    // MockUserService is injected instead of real service
    expect(component.users()).toHaveLength(2);
  });
});

// Spy on injected service
const userService = TestBed.inject(UserService);
spyOn(userService, 'getUsers').and.returnValue(of(mockUsers));

// Override at component level
TestBed.overrideComponent(UserComponent, {
  set: {
    providers: [{ provide: FormService, useClass: MockFormService }],
  },
});
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Constructor injection with many params** | Constructor with 8+ parameters, hard to read | Use `inject()` function in field initializers |
| **Not using providedIn: 'root'** | Services not tree-shaken, manual provider registration | Add `providedIn: 'root'` to @Injectable — auto-registered, tree-shakeable |
| **Circular dependencies** | Build warnings, runtime NullInjectorError | Use InjectionToken, restructure service boundaries |
| **Service without @Injectable** | NullInjectorError at runtime | ALWAYS decorate services with `@Injectable()` |
| **NgModule providers in new code** | Verbose module setup, hard to tree-shake | Use standalone providers or providedIn |
| **God service (1000+ lines)** | Untestable, mixed concerns, hard to maintain | Split into focused services by domain |
| **Not unsubscribing from Observables** | Memory leaks, stale callbacks, ghost updates | Use `takeUntilDestroyed()` or DestroyRef.onDestroy |
| **Using `any` for InjectionToken** | No type safety, runtime errors | Always type InjectionToken: `new InjectionToken<Config>()` |
| **Providing singleton at component level** | Multiple instances created unintentionally | Use `providedIn: 'root'` for singletons |
| **Not using abstract classes for interfaces** | Can't inject by interface in Angular (interfaces erased at runtime) | Use abstract class as interface + useClass for implementation |

---

## 9. Enforcement Checklist

### Service Design
- [ ] ALL services have `@Injectable()` decorator
- [ ] Singleton services use `providedIn: 'root'`
- [ ] Services follow single responsibility principle
- [ ] No service exceeds 300 lines (extract sub-services)

### Injection
- [ ] `inject()` function used instead of constructor injection
- [ ] InjectionToken used for non-class dependencies
- [ ] Optional dependencies use `{ optional: true }` flag
- [ ] No circular dependencies between services

### Scoping
- [ ] Component-level providers used for scoped instances
- [ ] Route-level providers used for lazy-loaded feature scoping
- [ ] Service scope matches actual usage pattern (singleton vs scoped)

### Cleanup
- [ ] ALL Observable subscriptions cleaned up (`takeUntilDestroyed`)
- [ ] `DestroyRef.onDestroy()` used for non-Observable cleanup
- [ ] No manual `ngOnDestroy` when `takeUntilDestroyed` suffices

### Testing
- [ ] Services testable with `TestBed.inject()`
- [ ] Mock providers used for external dependencies
- [ ] InjectionToken values overridable in tests
- [ ] No test relies on real HTTP calls (HttpClientTestingModule)
