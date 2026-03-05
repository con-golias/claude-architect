---
paths:
  - "src/**/*.tsx"
  - "src/**/*.jsx"
  - "src/**/*.vue"
  - "src/**/*.ts"
  - "src/**/*.js"
  - "src/**/*.svelte"
---
## State Management Rules

### Single Source of Truth
- Every piece of state MUST have exactly one canonical location — never duplicate state across stores, components, or caches
- Normalize nested/relational data into flat lookup maps: `{ byId: { [id]: entity }, allIds: string[] }`
- Store entity IDs in lists, not full objects — reference by ID, resolve at render time
- NEVER store the same entity in multiple slices — use relationships (IDs) instead
- When state is shared by 3+ components, lift it to the nearest common ancestor or a dedicated store

### Client State vs Server State
- Separate client-only state (UI: modals, form drafts, theme) from server state (API data)
- Use a server-state library (React Query, SWR, Apollo, TanStack Query) for ALL fetched data — never store API responses in global client stores
- Server state is owned by the server — the client holds a cache, not the truth
- Let the server-state library manage caching, refetching, and background revalidation
- NEVER manually synchronize server data between components — rely on cache key invalidation

### Immutable State Updates
- NEVER mutate state directly — always produce a new reference
- Use immutable update patterns: spread operator, `Object.assign({}, ...)`, or a library (Immer)
- For arrays: use `map`, `filter`, `concat` — never `push`, `splice`, `sort` on state directly
- Freeze state in development (`Object.freeze`) to catch accidental mutations early
- State updater functions MUST be pure — no side effects, no API calls inside reducers/mutations

### Derived State & Selectors
- NEVER store values that can be computed from existing state — derive them
- Use memoized selectors (reselect, computed, `useMemo`) for expensive derivations
- Selectors MUST be pure functions: `(state) => derivedValue`
- Co-locate selectors with the state slice they read from
- Name selectors with `select` or `get` prefix: `selectActiveUsers`, `getCartTotal`

### State Hydration & Persistence
- For SSR: serialize state on server, rehydrate on client — handle mismatches gracefully
- Validate persisted state shape on load — never trust localStorage/sessionStorage blindly
  - If schema has changed since persistence, reset to defaults rather than crash
- Version persisted state: include a schema version and migrate or discard on mismatch
- NEVER persist sensitive data (tokens, PII) to localStorage — use secure HttpOnly cookies
- Clear persisted state on logout

### Optimistic Updates
- Apply optimistic updates only for low-risk, high-frequency actions (toggles, likes, reorders)
- ALWAYS implement rollback: revert local state if the server request fails
- Show unobtrusive error feedback on rollback — never silently revert
- For conflict-prone operations (edits, deletes), wait for server confirmation instead
- Reconcile optimistic state with server response — replace optimistic data with canonical server data
