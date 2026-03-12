# Angular Performance — Complete Specification

> **AI Plugin Directive:** When a developer asks "why is my Angular app slow?", "how to optimize Angular change detection?", "what is OnPush?", "how do Angular signals help performance?", "how to use @defer?", "Angular zoneless?", or any Angular performance question, ALWAYS consult this directive. Apply signals for reactive state, @defer for lazy rendering, OnPush or zoneless change detection, and virtual scrolling for large lists. ALWAYS measure before optimizing.

**Core Rule: Angular's default change detection checks EVERY component on EVERY event (click, timer, HTTP response). This is safe but wasteful. Use signals + zoneless change detection for the best performance — Angular only updates components when their signal dependencies change. For legacy code, use `ChangeDetectionStrategy.OnPush` as a stepping stone. NEVER optimize without measuring first — use Angular DevTools Profiler. Use `@defer` for lazy loading below-fold content and `trackBy` in @for loops.**

---

## 1. Change Detection

```
          ANGULAR CHANGE DETECTION STRATEGIES

  DEFAULT (Zone.js):
  ┌─────────────────────────────────────────────────┐
  │ Event (click, timer, HTTP) triggers Zone.js     │
  │ → Zone.js notifies Angular                      │
  │ → Angular checks EVERY component in the tree    │
  │ → ALL bindings re-evaluated                     │
  │ → DOM updated where values changed              │
  │                                                 │
  │ Component Tree Check:                           │
  │ App ✓ → Header ✓ → Nav ✓                       │
  │      → Dashboard ✓ → Chart ✓ → Table ✓         │
  │      → Footer ✓                                 │
  │ ALL components checked regardless of changes    │
  └─────────────────────────────────────────────────┘

  OnPush:
  ┌─────────────────────────────────────────────────┐
  │ Component only checked when:                    │
  │ 1. Input reference changes (new object/array)   │
  │ 2. Event handler fires IN this component        │
  │ 3. Async pipe receives new value                │
  │ 4. markForCheck() called manually               │
  │                                                 │
  │ Component Tree Check:                           │
  │ App ✓ → Header ✗ → Nav ✗    (skipped!)         │
  │      → Dashboard ✓ → Chart ✗  (skipped!)       │
  │                   → Table ✓  (input changed)    │
  │      → Footer ✗                (skipped!)       │
  └─────────────────────────────────────────────────┘

  Signals + Zoneless:
  ┌─────────────────────────────────────────────────┐
  │ Signal changes → Angular knows EXACTLY which    │
  │ components depend on that signal                │
  │ → ONLY those components re-checked              │
  │ → No Zone.js overhead                           │
  │ → No tree-walking needed                        │
  │                                                 │
  │ count() signal changes:                         │
  │ App ✗ → Header ✗ → Nav ✗                       │
  │      → Dashboard ✗ → Chart ✗                    │
  │                   → Counter ✓  (uses count())   │
  │      → Footer ✗                                 │
  │ ONLY Counter checked — everything else skipped  │
  └─────────────────────────────────────────────────┘
```

### 1.1 OnPush Strategy

```typescript
import { Component, ChangeDetectionStrategy, signal, input } from '@angular/core';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-user-card',
  template: `
    <div class="card">
      <h3>{{ user().name }}</h3>
      <p>{{ user().email }}</p>
      <button (click)="handleClick()">Action</button>
    </div>
  `,
})
export class UserCardComponent {
  user = input.required<User>();

  handleClick() {
    // OnPush component IS checked because event fired HERE
    console.log('clicked');
  }
}

// PARENT MUST pass new reference for OnPush to detect changes
@Component({...})
export class ParentComponent {
  users = signal<User[]>([]);

  updateUser(id: string, name: string) {
    // ❌ WRONG: Mutating existing object — OnPush child won't detect
    this.users()[0].name = name;

    // ✅ CORRECT: Create new object — OnPush child detects new reference
    this.users.update(list => list.map(u =>
      u.id === id ? { ...u, name } : u
    ));
  }
}

// RULES FOR OnPush:
// 1. ALL inputs must be immutable (new reference = change)
// 2. Use signals for internal state
// 3. Use async pipe for Observables (auto-marks for check)
// 4. NEVER mutate input objects — always create new references
```

### 1.2 Zoneless (Angular 19+)

```typescript
// ZONELESS — No Zone.js, signals drive change detection

// main.ts
import { provideExperimentalZonelessChangeDetection } from '@angular/core';

bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    // OR: provideZonelessChangeDetection() in Angular 19+
  ],
});

// Components use signals — Angular auto-tracks
@Component({
  standalone: true,
  template: `
    <p>Count: {{ count() }}</p>
    <button (click)="increment()">+1</button>

    @for (item of items(); track item.id) {
      <app-item [item]="item" />
    }
  `,
})
export class CounterComponent {
  count = signal(0);
  items = signal<Item[]>([]);

  increment() {
    this.count.update(c => c + 1);
    // Angular knows this component uses count()
    // Only this component is re-checked
  }
}

// MIGRATION PATH:
// 1. Add OnPush to all components
// 2. Replace @Input with signal inputs
// 3. Replace Observable + subscribe with signals or toSignal()
// 4. Remove Zone.js
// 5. Test everything
```

---

## 2. @defer Blocks

```typescript
// @defer — Lazy load component chunks on demand

@Component({
  template: `
    <!-- Load when element enters viewport -->
    @defer (on viewport) {
      <app-heavy-chart [data]="chartData()" />
    } @placeholder (minimum 100ms) {
      <div class="chart-placeholder" style="height: 400px">
        Chart will load when scrolled into view
      </div>
    } @loading (after 100ms; minimum 500ms) {
      <app-chart-skeleton />
    } @error {
      <p>Failed to load chart component</p>
    }

    <!-- Load when browser is idle -->
    @defer (on idle) {
      <app-recommendations />
    } @placeholder {
      <div>Recommendations loading...</div>
    }

    <!-- Load on user interaction -->
    @defer (on interaction) {
      <app-rich-text-editor />
    } @placeholder {
      <textarea placeholder="Click to load editor..."></textarea>
    }

    <!-- Load after delay -->
    @defer (on timer(3s)) {
      <app-analytics-widget />
    }

    <!-- Load when condition is true -->
    @defer (when showAdvanced()) {
      <app-advanced-settings />
    }

    <!-- Prefetch: download code before trigger -->
    @defer (on viewport; prefetch on idle) {
      <app-below-fold-content />
    }
    <!-- Prefetches during idle time, renders when in viewport -->
  `,
})
export class DashboardComponent {
  chartData = signal<DataPoint[]>([]);
  showAdvanced = signal(false);
}

// @defer TRIGGERS:
// on viewport    — element enters browser viewport
// on idle        — browser idle (requestIdleCallback)
// on interaction — click, focus, keydown on placeholder
// on hover       — mouseenter on placeholder
// on timer(Ns)   — after N seconds/milliseconds
// when condition — when boolean expression is true

// RULES:
// - @defer creates a SEPARATE chunk (code-split automatically)
// - Dependencies of deferred component are also lazy loaded
// - Use @placeholder for CLS prevention (fixed dimensions)
// - Use prefetch to download code before it's needed
// - ALWAYS provide @placeholder to prevent layout shift
```

---

## 3. List Performance

### 3.1 track in @for

```typescript
@Component({
  template: `
    <!-- ✅ ALWAYS provide track expression -->
    @for (user of users(); track user.id) {
      <app-user-card [user]="user" />
    }

    <!-- track $index — only for STATIC lists that never reorder -->
    @for (tab of tabs; track $index) {
      <button (click)="selectTab($index)">{{ tab }}</button>
    }

    <!-- ❌ NEVER: No track (Angular requires it in @for) -->
    <!-- @for (user of users()) { } — COMPILE ERROR: track required -->
  `,
})
export class UserListComponent {
  users = signal<User[]>([]);

  // track tells Angular how to identify each item across updates
  // Without proper tracking, Angular destroys and recreates DOM nodes
}
```

### 3.2 Virtual Scrolling

```typescript
// Angular CDK Virtual Scrolling
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  standalone: true,
  imports: [ScrollingModule],
  template: `
    <cdk-virtual-scroll-viewport itemSize="50" class="viewport">
      <div *cdkVirtualFor="let item of items; trackBy: trackById"
           class="item">
        {{ item.name }}
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: [`
    .viewport {
      height: 600px;
      width: 100%;
    }
    .item {
      height: 50px;
      display: flex;
      align-items: center;
    }
  `],
})
export class VirtualListComponent {
  items = signal<Item[]>([]);

  trackById(index: number, item: Item): string {
    return item.id;
  }
}

// For variable height items:
// Use autosize virtual scrolling (experimental)
// Or implement custom virtual scroll with measured heights

// DECISION:
// < 100 items    → Regular @for
// 100-1000 items → Consider virtual scrolling
// 1000+ items    → ALWAYS use cdk-virtual-scroll-viewport
```

---

## 4. RxJS Performance

```typescript
import { toSignal, toObservable } from '@angular/core/rxjs-interop';

// SIGNAL ↔ OBSERVABLE INTEROP

// Observable → Signal (recommended for consuming Observables)
@Component({...})
export class DataComponent {
  private dataService = inject(DataService);

  // toSignal auto-subscribes AND auto-unsubscribes
  data = toSignal(this.dataService.getData(), {
    initialValue: [],
  });

  // With error handling
  users = toSignal(this.dataService.getUsers().pipe(
    catchError(() => of([])),
  ), { initialValue: [] });
}

// Signal → Observable (for piping through RxJS operators)
@Component({...})
export class SearchComponent {
  query = signal('');

  results = toSignal(
    toObservable(this.query).pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(q => q.length >= 2),
      switchMap(q => this.searchService.search(q)),
    ),
    { initialValue: [] }
  );
}

// AVOID: Manual subscribe + unsubscribe patterns
// ❌ LEGACY PATTERN:
export class BadComponent implements OnInit, OnDestroy {
  private subscription!: Subscription;

  ngOnInit() {
    this.subscription = this.dataService.getData().subscribe(data => {
      this.data = data;
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe(); // Easy to forget!
  }
}

// ✅ MODERN: toSignal (auto-manages subscription lifecycle)
export class GoodComponent {
  data = toSignal(inject(DataService).getData());
}

// WHEN TO USE RxJS vs Signals:
// Signals  → Synchronous state, UI state, simple derived values
// RxJS     → Async streams, WebSocket, complex event transforms
// toSignal → Bridge: consume Observable results as signals
```

---

## 5. Bundle Optimization

```
ANGULAR BUNDLE OPTIMIZATION:

1. LAZY LOAD ROUTES (ALWAYS):
   loadComponent: () => import('./page').then(m => m.PageComponent)
   loadChildren: () => import('./routes').then(m => m.ROUTES)

2. @defer FOR COMPONENTS:
   @defer (on viewport) { <app-heavy /> }
   Creates separate chunk automatically.

3. TREE SHAKING:
   - Standalone components are tree-shakeable by default
   - NgModules bundle EVERYTHING declared — avoid them
   - providedIn: 'root' services are tree-shaken if unused

4. PRODUCTION BUILD:
   ng build --configuration production
   - AOT compilation (Ahead-of-Time)
   - Dead code elimination
   - Minification + uglification
   - Tree shaking

5. ANALYZE BUNDLE:
   ng build --stats-json
   npx webpack-bundle-analyzer dist/stats.json

   OR: Use source-map-explorer
   npx source-map-explorer dist/browser/*.js

6. COMMON BUNDLE BLOAT:
   ┌─────────────────────────┬──────────┬───────────────────┐
   │ Culprit                 │ Impact   │ Fix               │
   ├─────────────────────────┼──────────┼───────────────────┤
   │ moment.js               │ +300KB   │ date-fns, luxon   │
   │ lodash (full import)    │ +70KB    │ lodash-es or      │
   │                         │          │ individual imports│
   │ rxjs (full import)      │ +50KB    │ Import operators  │
   │                         │          │ individually      │
   │ @angular/material (all) │ +200KB   │ Import specific   │
   │                         │          │ modules only      │
   │ zone.js                 │ +13KB    │ Go zoneless       │
   └─────────────────────────┴──────────┴───────────────────┘
```

---

## 6. SSR and Hydration

```typescript
// Angular SSR with @angular/ssr

// angular.json or ng add @angular/ssr

// Hydration: Angular 17+ has non-destructive hydration
// Server renders HTML → Client hydrates (attaches event listeners)
// WITHOUT re-rendering the DOM (non-destructive)

// main.server.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideServerRendering } from '@angular/platform-server';

bootstrapApplication(AppComponent, {
  providers: [
    provideServerRendering(),
  ],
});

// Client hydration is enabled by default in Angular 17+
// provideClientHydration() in main.ts

// Incremental Hydration (Angular 18+):
// Components hydrate on-demand, not all at once
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';

bootstrapApplication(AppComponent, {
  providers: [
    provideClientHydration(withIncrementalHydration()),
  ],
});

// @defer + SSR = Incremental hydration
// @defer (on viewport; hydrate on viewport) {
//   <app-interactive-widget />
// }
// Server renders the HTML, client hydrates only when in viewport

// RULES:
// - Use @angular/ssr for all production Angular apps needing SEO
// - Non-destructive hydration avoids DOM flicker
// - @defer + hydrate combines lazy loading with selective hydration
// - Test SSR with: ng serve --configuration=ssr
```

---

## 7. Profiling Angular Applications

```
ANGULAR DEVTOOLS:

1. Install Angular DevTools extension
2. Open DevTools → Angular tab
3. Component Explorer:
   - Inspect component tree
   - View inputs, outputs, state
   - Edit values in real-time

4. Profiler:
   - Record change detection cycles
   - See which components were checked
   - Identify unnecessary checks
   - Measure render time per component

CHROME PERFORMANCE TAB:
1. Record interaction
2. Look for:
   - "Zone.js: invokeTask" entries (change detection triggers)
   - Long "ApplicationRef.tick" calls (slow change detection)
   - Script execution time in components

PROGRAMMATIC MEASUREMENT:
  // Enable in development
  { provide: NG_DEV_MODE, useValue: true }

  // Angular performance tracing
  import { enableProdMode } from '@angular/core';
  // In development: Check timing marks in Performance tab

KEY METRICS:
  - Change detection cycle time: < 10ms
  - Component creation time: < 5ms
  - Initial bundle load: < 200KB gzipped
  - Route chunk: < 100KB gzipped
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Default change detection everywhere** | Entire tree checked on every event, slow with many components | Use OnPush or signals + zoneless |
| **Missing trackBy in @for** | DOM nodes destroyed/recreated instead of moved, poor list performance | ALWAYS provide `track item.id` in @for |
| **Manual subscribe without unsubscribe** | Memory leaks, stale callbacks, component continues receiving data after destroyed | Use `toSignal()`, `takeUntilDestroyed()`, or async pipe |
| **Not using @defer** | Heavy components in initial bundle, slow first paint | Defer below-fold and conditional content with @defer |
| **Not lazy loading routes** | Entire application in one bundle, slow initial load | Use `loadComponent`/`loadChildren` for all non-critical routes |
| **Zone.js in new projects** | 13KB overhead, unnecessary change detection cycles, global patching | Use zoneless with signals |
| **Calling methods in templates** | Method called on EVERY change detection cycle, no caching | Use computed signals or pipes instead |
| **Complex expressions in templates** | Recalculated on every check, hard to debug | Extract to computed signal in component class |
| **Not using OnPush with immutable data** | Components checked unnecessarily, wasted cycles | Enable OnPush, ensure inputs are new references |
| **Importing entire RxJS** | Bundles unused operators, bloated build | Import specific operators: `import { map } from 'rxjs/operators'` |
| **Not analyzing bundle size** | Hidden bloat, unnecessary dependencies shipped | Run webpack-bundle-analyzer regularly |
| **Sync operations in change detection** | Slow change detection cycles, UI jank | Move heavy computation to signals/computed or Web Workers |

---

## 9. Enforcement Checklist

### Change Detection
- [ ] OnPush strategy or zoneless mode used for all components
- [ ] Signals used for reactive state (not plain properties)
- [ ] No function calls in templates (use computed signals or pipes)
- [ ] Input references are immutable (new object = change)

### Lazy Loading
- [ ] ALL non-critical routes use `loadComponent`/`loadChildren`
- [ ] @defer used for below-fold heavy components
- [ ] @defer @placeholder has fixed dimensions (prevents CLS)
- [ ] Prefetch strategies configured for likely navigation

### Lists
- [ ] ALL @for loops have `track` expression with unique ID
- [ ] Lists with 100+ items use CDK virtual scrolling
- [ ] No $index tracking for dynamic lists

### RxJS
- [ ] `toSignal()` used to consume Observables in components
- [ ] `takeUntilDestroyed()` used for manual subscriptions
- [ ] No manual subscribe/unsubscribe pattern
- [ ] RxJS operators imported individually (tree-shaking)

### Bundle
- [ ] Production build with AOT compilation
- [ ] Bundle size analyzed and monitored
- [ ] No full library imports (lodash, rxjs, material)
- [ ] Zone.js removed or minimal polyfills configured

### Measurement
- [ ] Angular DevTools Profiler used to verify performance
- [ ] No optimization without measured evidence
- [ ] Web Vitals monitored in production
- [ ] Performance budgets set in angular.json
