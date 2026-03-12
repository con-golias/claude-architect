# Offline-First Mobile — Complete Specification

> **AI Plugin Directive:** When a developer asks "offline-first architecture", "mobile offline support", "data sync mobile", "local-first mobile", "conflict resolution mobile", "CRDT mobile", "optimistic updates mobile", "sync queue pattern", "offline data strategy", "background sync", or any offline-first question, ALWAYS consult this directive. Offline-first design treats the network as an enhancement rather than a requirement. ALWAYS design mobile apps to work offline by default — store data locally and sync when connectivity is available. ALWAYS use a sync queue for pending mutations. ALWAYS implement conflict resolution strategy BEFORE shipping — last-write-wins is the simplest default.

**Core Rule: Mobile apps MUST work without network connectivity. Users open apps on subways, elevators, airplanes, and areas with poor coverage. ALWAYS store data locally (Room/SQLDelight/Core Data) and sync to server when online. ALWAYS use a mutation queue for offline writes — persist pending operations and replay when connectivity returns. ALWAYS implement conflict resolution (last-write-wins for simple apps, CRDTs for collaborative apps). Use optimistic UI updates — show changes immediately, sync in background.**

---

## 1. Offline-First Architecture

```
  OFFLINE-FIRST DATA FLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  USER ACTION (create/update/delete)                  │
  │       │                                              │
  │       ▼                                              │
  │  LOCAL DATABASE (source of truth)                    │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  1. Write to local DB immediately              │  │
  │  │  2. UI updates instantly (optimistic)           │  │
  │  │  3. Add mutation to sync queue                  │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │                                  │
  │                    ▼                                  │
  │  SYNC QUEUE (pending operations)                     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  { id: 1, op: "CREATE", data: {...}, retry: 0 }│  │
  │  │  { id: 2, op: "UPDATE", data: {...}, retry: 0 }│  │
  │  │  { id: 3, op: "DELETE", id: "abc", retry: 0 }  │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │ when online                     │
  │                    ▼                                  │
  │  SYNC ENGINE                                         │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  1. Check connectivity                         │  │
  │  │  2. Process queue in order                     │  │
  │  │  3. Send to server                             │  │
  │  │  4. Handle conflicts (server vs local)         │  │
  │  │  5. Update local DB with server response       │  │
  │  │  6. Remove from queue on success               │  │
  │  │  7. Retry on failure (exponential backoff)     │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  SERVER → LOCAL (pull sync)                          │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Periodic pull (or push via WebSocket/SSE)     │  │
  │  │  → Merge server changes into local DB          │  │
  │  │  → Resolve conflicts with strategy             │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Sync Queue Implementation

```typescript
// React Native / Expo — sync queue with MMKV or WatermelonDB
interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class SyncQueue {
  private queue: SyncOperation[] = [];

  async add(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount' | 'maxRetries'>) {
    const op: SyncOperation = {
      ...operation,
      id: uuid(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 5,
    };
    this.queue.push(op);
    await this.persistQueue();
  }

  async processQueue() {
    if (!navigator.onLine) return;

    const pending = [...this.queue];
    for (const op of pending) {
      try {
        await this.executeOperation(op);
        this.queue = this.queue.filter(q => q.id !== op.id);
      } catch (error) {
        op.retryCount++;
        if (op.retryCount >= op.maxRetries) {
          this.queue = this.queue.filter(q => q.id !== op.id);
          await this.reportFailedOperation(op);
        }
      }
    }
    await this.persistQueue();
  }

  private async executeOperation(op: SyncOperation) {
    switch (op.type) {
      case 'CREATE':
        return api.post(`/${op.entity}`, op.data);
      case 'UPDATE':
        return api.put(`/${op.entity}/${op.entityId}`, op.data);
      case 'DELETE':
        return api.delete(`/${op.entity}/${op.entityId}`);
    }
  }
}
```

---

## 2. Conflict Resolution Strategies

```
  CONFLICT RESOLUTION STRATEGIES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  LAST-WRITE-WINS (simplest):                         │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Compare timestamps — latest change wins       │  │
  │  │  PRO: Simple, works for most apps              │  │
  │  │  CON: Silently loses earlier edits              │  │
  │  │  USE: Todo apps, settings, profiles             │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  SERVER-WINS:                                        │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Server version always takes precedence        │  │
  │  │  PRO: No conflict logic needed                 │  │
  │  │  CON: User loses offline changes               │  │
  │  │  USE: Read-heavy apps, reference data           │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  CLIENT-WINS:                                        │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Client version always takes precedence        │  │
  │  │  PRO: User changes never lost                  │  │
  │  │  CON: Other users' changes overwritten          │  │
  │  │  USE: Personal data, single-user scenarios      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  FIELD-LEVEL MERGE:                                  │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Merge non-conflicting field changes           │  │
  │  │  PRO: Preserves most changes                   │  │
  │  │  CON: More complex implementation               │  │
  │  │  USE: Form-heavy apps, documents                │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  CRDT (Conflict-free Replicated Data Types):         │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Mathematically guaranteed merge without       │  │
  │  │  conflicts (commutative, associative, idem.)   │  │
  │  │  PRO: No conflicts ever, real-time collab      │  │
  │  │  CON: Complex, limited data types               │  │
  │  │  USE: Collaborative editing, shared whiteboards │  │
  │  │  Libraries: Yjs, Automerge                      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  DEFAULT: Use last-write-wins for most apps.         │
  │  Upgrade to field-level merge if data loss reported. │
  │  CRDTs only for real-time collaborative features.    │
  └──────────────────────────────────────────────────────┘
```

---

## 3. Connectivity Detection

```typescript
// React Native — NetInfo
import NetInfo from '@react-native-community/netinfo';

function useConnectivity() {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  return isConnected;
}

// Show connectivity banner
function OfflineBanner() {
  const isConnected = useConnectivity();

  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>You are offline. Changes will sync when connected.</Text>
    </View>
  );
}
```

```kotlin
// Android — ConnectivityManager
class ConnectivityObserver @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    val isConnected: Flow<Boolean> = callbackFlow {
        val manager = context.getSystemService<ConnectivityManager>()!!
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) { trySend(true) }
            override fun onLost(network: Network) { trySend(false) }
        }
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        manager.registerNetworkCallback(request, callback)
        trySend(manager.activeNetwork != null)
        awaitClose { manager.unregisterNetworkCallback(callback) }
    }.distinctUntilChanged()
}
```

---

## 4. Local Storage Options

```
  LOCAL STORAGE COMPARISON

  ┌────────────────────┬──────────────┬────────────────┐
  │ Technology         │ Platform     │ Best For       │
  ├────────────────────┼──────────────┼────────────────┤
  │ Room               │ Android      │ Structured     │
  │                    │              │ relational data│
  ├────────────────────┼──────────────┼────────────────┤
  │ Core Data/SwiftData│ iOS          │ Object graph   │
  │                    │              │ with relations │
  ├────────────────────┼──────────────┼────────────────┤
  │ SQLDelight         │ KMP          │ Cross-platform │
  │                    │              │ SQL database   │
  ├────────────────────┼──────────────┼────────────────┤
  │ WatermelonDB       │ React Native │ Offline-first  │
  │                    │              │ with sync      │
  ├────────────────────┼──────────────┼────────────────┤
  │ MMKV               │ RN/Native    │ Key-value      │
  │                    │              │ (fast, small)  │
  ├────────────────────┼──────────────┼────────────────┤
  │ Realm              │ All          │ Object DB      │
  │                    │              │ with sync      │
  └────────────────────┴──────────────┴────────────────┘

  RECOMMENDATION:
  • Structured data → Room (Android), Core Data (iOS), SQLDelight (KMP)
  • Key-value → DataStore (Android), UserDefaults (iOS), MMKV (RN)
  • Offline-first with sync → WatermelonDB (RN), Realm (all)
```

---

## 5. Optimistic UI Updates

```typescript
// React Native — optimistic update pattern
function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (newTodo: CreateTodoInput) => api.post('/todos', newTodo),

    // Optimistic update — show immediately
    onMutate: async (newTodo) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const previousTodos = queryClient.getQueryData<Todo[]>(['todos']);

      // Add optimistic todo with temp ID
      queryClient.setQueryData<Todo[]>(['todos'], (old = []) => [
        ...old,
        { ...newTodo, id: `temp-${Date.now()}`, synced: false },
      ]);

      return { previousTodos };
    },

    // Rollback on error
    onError: (_err, _newTodo, context) => {
      queryClient.setQueryData(['todos'], context?.previousTodos);
    },

    // Replace temp with server data on success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

// Visual indicator for unsynced items
function TodoItem({ todo }: { todo: Todo }) {
  return (
    <View style={styles.todoItem}>
      <Text>{todo.title}</Text>
      {!todo.synced && (
        <View style={styles.syncPending}>
          <Ionicons name="cloud-upload-outline" size={16} color="#999" />
        </View>
      )}
    </View>
  );
}
```

---

## 6. Background Sync

```kotlin
// Android — WorkManager for background sync
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncQueue: SyncQueue,
    private val connectivityObserver: ConnectivityObserver,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            syncQueue.processAll()
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry()
            else Result.failure()
        }
    }
}

// Schedule sync when connectivity changes
fun scheduleSyncOnConnect(context: Context) {
    val constraints = Constraints.Builder()
        .setRequiredNetworkType(NetworkType.CONNECTED)
        .build()

    val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
        .setConstraints(constraints)
        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
        .build()

    WorkManager.getInstance(context)
        .enqueueUniqueWork("sync", ExistingWorkPolicy.REPLACE, syncRequest)
}
```

```swift
// iOS — BGTaskScheduler for background sync
func scheduleSync() {
    let request = BGAppRefreshTaskRequest(identifier: "com.app.sync")
    request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
    try? BGTaskScheduler.shared.submit(request)
}

func handleSync(_ task: BGAppRefreshTask) {
    scheduleSync() // re-schedule

    let syncOperation = SyncOperation()
    task.expirationHandler = { syncOperation.cancel() }

    syncOperation.completionBlock = {
        task.setTaskCompleted(success: !syncOperation.isCancelled)
    }

    OperationQueue().addOperation(syncOperation)
}
```

---

## 7. Data Integrity

```
  DATA INTEGRITY RULES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  RULE 1: Version every entity                        │
  │  • Add updatedAt timestamp to every record           │
  │  • Use for conflict detection (compare versions)     │
  │  • Server rejects stale writes (HTTP 409 Conflict)   │
  │                                                      │
  │  RULE 2: Use transactions for multi-entity updates   │
  │  • Room @Transaction, Core Data batch operations     │
  │  • Either ALL writes succeed or NONE do              │
  │                                                      │
  │  RULE 3: Idempotent operations                       │
  │  • Assign client-side IDs (UUID) for creates         │
  │  • Server deduplicates by client ID                  │
  │  • Safe to retry failed sync operations              │
  │                                                      │
  │  RULE 4: Soft delete                                 │
  │  • Mark records as deleted, don't remove             │
  │  • Sync deletes to server, then hard-delete locally  │
  │  • Prevents ghost records on re-sync                 │
  │                                                      │
  │  RULE 5: Migration support                           │
  │  • Schema changes must be backwards-compatible       │
  │  • Old offline data must survive app updates          │
  │  • Room auto-migration, Core Data lightweight migration│
  └──────────────────────────────────────────────────────┘
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **No local storage** | App shows blank screen without network | Store ALL data locally, sync in background |
| **Sync on every change** | Battery drain, excessive network usage | Batch mutations, sync on interval or connectivity change |
| **No conflict strategy** | Data silently overwritten, user loses work | Implement last-write-wins at minimum |
| **No retry logic** | Failed syncs never retried, data stuck locally | Exponential backoff with max retries |
| **No offline indicator** | User doesn't know changes aren't synced | Show banner/icon when offline + pending sync count |
| **Blocking UI on sync** | App freezes during large sync | Background sync, show progress non-modally |
| **No sync queue persistence** | Pending mutations lost on app restart | Persist queue to SQLite/MMKV |
| **Full data re-download** | Slow sync, high bandwidth usage | Delta sync (only changed records since last sync timestamp) |

---

## 6. Enforcement Checklist

### Architecture
- [ ] Local database is source of truth (not server)
- [ ] Sync queue persisted for offline mutations
- [ ] Optimistic UI updates (instant feedback)
- [ ] Conflict resolution strategy defined and implemented
- [ ] Delta sync (not full re-download)

### UX
- [ ] Offline indicator visible to user
- [ ] Pending sync count shown
- [ ] App fully functional without network
- [ ] Sync errors surfaced to user with retry option
- [ ] No loading spinners for cached data

### Reliability
- [ ] Exponential backoff for failed syncs
- [ ] Maximum retry limit with error reporting
- [ ] Connectivity changes trigger sync attempt
- [ ] Background sync scheduled (WorkManager/BGTaskScheduler)
- [ ] Large datasets paginated during sync
