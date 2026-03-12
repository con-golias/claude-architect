# Read Replicas at Scale

| Field        | Value                                                                 |
|--------------|-----------------------------------------------------------------------|
| Domain       | Scalability > Database Scaling                                        |
| Importance   | High                                                                  |
| Applies To   | Backend services, data-intensive applications, global deployments     |
| Cross-ref    | `07-database/scaling/replication.md`, `07-database/scaling/read-replicas-load.md` |
| Last Updated | 2026-03-10                                                            |

---

## Core Concepts

### Read Replica Topologies

Select the topology that matches the latency budget and fault-tolerance requirements.

| Topology            | Description                                           | Use When                                      |
|---------------------|-------------------------------------------------------|-----------------------------------------------|
| Primary-Replica     | Single primary, one or more replicas in same region   | Read-heavy workloads, simple HA               |
| Cascading Replicas  | Replicas replicate from other replicas, not primary   | Reducing primary I/O overhead at high fan-out  |
| Regional Replicas   | Replicas placed in geographically distinct regions    | Serving reads close to end users globally      |
| Multi-Tier          | Combination of cascading + regional                   | Large-scale global deployments (100+ replicas) |

### Replication Lag Monitoring

Track replication lag as a first-class SLI. Define thresholds before deploying replicas.

| Threshold       | Acceptable For                                  | Action When Exceeded             |
|------------------|------------------------------------------------|----------------------------------|
| < 100 ms         | Interactive reads, dashboards                  | None                             |
| 100 ms - 1 s     | Analytics, reporting, non-critical reads       | Alert, investigate               |
| 1 s - 10 s       | Batch processing, async workflows              | Remove replica from pool         |
| > 10 s           | Nothing in production                          | Page on-call, failover           |

### Consistency Guarantees

| Model                | Guarantee                                          | Trade-off                        |
|----------------------|----------------------------------------------------|----------------------------------|
| Eventual Consistency | Replica will converge with primary eventually      | Stale reads possible             |
| Read-Your-Writes     | A session always sees its own writes               | Requires session-sticky routing  |
| Monotonic Reads      | A session never sees older data after newer data   | Requires ordered replica reads   |
| Bounded Staleness    | Reads are guaranteed fresh within a time window    | Requires lag-aware routing       |

### Scaling Decision: Replicas vs Cache

Add replicas when the query patterns are diverse and hard to cache. Add cache when the same
hot keys are read repeatedly.

| Signal                            | Add Replicas                | Add Cache (Redis/Memcached) |
|-----------------------------------|-----------------------------|-----------------------------|
| Query diversity                   | High (many distinct queries)| Low (same keys repeatedly)  |
| Data freshness requirement        | Seconds-level tolerance     | Minutes-level tolerance     |
| Write-to-read ratio               | 1:10 or higher              | 1:100 or higher             |
| Operational complexity budget     | Medium                      | Low                         |
| Cost sensitivity                  | Lower (reuse existing DB)   | Higher (new infra layer)    |

---

## Code Examples

### TypeScript: Read/Write Splitting with Connection Routing

```typescript
import { Pool, PoolClient } from "pg";

interface ReplicaPool {
  host: string;
  pool: Pool;
  lagMs: number;
  healthy: boolean;
}

class ReadWriteRouter {
  private primary: Pool;
  private replicas: ReplicaPool[];
  private roundRobinIndex = 0;

  constructor(primaryConfig: object, replicaConfigs: { host: string }[]) {
    this.primary = new Pool(primaryConfig);
    this.replicas = replicaConfigs.map((cfg) => ({
      host: cfg.host,
      pool: new Pool({ ...cfg, max: 20 }),
      lagMs: 0,
      healthy: true,
    }));
  }

  /** Route writes and read-your-writes to the primary. */
  async write(query: string, params?: unknown[]): Promise<unknown> {
    return this.primary.query(query, params);
  }

  /** Route reads to a healthy replica with acceptable lag. */
  async read(
    query: string,
    params?: unknown[],
    maxLagMs = 1000
  ): Promise<unknown> {
    const eligible = this.replicas.filter(
      (r) => r.healthy && r.lagMs <= maxLagMs
    );
    if (eligible.length === 0) {
      // Fallback to primary when no healthy replica exists.
      return this.primary.query(query, params);
    }
    const replica = eligible[this.roundRobinIndex % eligible.length];
    this.roundRobinIndex++;
    return replica.pool.query(query, params);
  }

  /** Periodically refresh lag metrics for every replica. */
  async refreshLagMetrics(): Promise<void> {
    for (const replica of this.replicas) {
      try {
        const result = await replica.pool.query(
          "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) * 1000 AS lag_ms"
        );
        replica.lagMs = parseFloat(result.rows[0].lag_ms) || 0;
        replica.healthy = true;
      } catch {
        replica.healthy = false;
      }
    }
  }
}
```

### Go: Replica Health Checking and Automatic Failover

```go
package replica

import (
    "context"
    "database/sql"
    "sync"
    "time"
)

type Replica struct {
    DB      *sql.DB
    Host    string
    LagMs   float64
    Healthy bool
}

type ReplicaRouter struct {
    primary  *sql.DB
    replicas []*Replica
    mu       sync.RWMutex
    idx      uint64
}

func NewReplicaRouter(primary *sql.DB, replicas []*Replica) *ReplicaRouter {
    r := &ReplicaRouter{primary: primary, replicas: replicas}
    go r.healthLoop(context.Background())
    return r
}

// ReadDB returns a healthy replica or falls back to primary.
func (r *ReplicaRouter) ReadDB(maxLagMs float64) *sql.DB {
    r.mu.RLock()
    defer r.mu.RUnlock()

    var eligible []*Replica
    for _, rep := range r.replicas {
        if rep.Healthy && rep.LagMs <= maxLagMs {
            eligible = append(eligible, rep)
        }
    }
    if len(eligible) == 0 {
        return r.primary
    }
    r.idx++
    return eligible[r.idx%uint64(len(eligible))].DB
}

func (r *ReplicaRouter) healthLoop(ctx context.Context) {
    ticker := time.NewTicker(5 * time.Second)
    defer ticker.Stop()
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            r.checkAll()
        }
    }
}

func (r *ReplicaRouter) checkAll() {
    r.mu.Lock()
    defer r.mu.Unlock()
    for _, rep := range r.replicas {
        var lagMs float64
        err := rep.DB.QueryRow(
            "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) * 1000",
        ).Scan(&lagMs)
        if err != nil {
            rep.Healthy = false
            continue
        }
        rep.LagMs = lagMs
        rep.Healthy = true
    }
}
```

### SQL: Monitoring Replication Lag

**PostgreSQL** -- run on the replica:

```sql
-- Returns replication lag in seconds on a streaming replica.
SELECT
    CASE
        WHEN pg_last_xact_replay_timestamp() IS NULL THEN -1
        ELSE EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))
    END AS replication_lag_seconds;

-- Detailed WAL position comparison (run on primary):
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;
```

**MySQL** -- run on the replica:

```sql
-- Returns Seconds_Behind_Master (NULL means replication is broken).
SHOW SLAVE STATUS\G

-- MySQL 8.0+ performance_schema approach:
SELECT
    CHANNEL_NAME,
    LAST_APPLIED_TRANSACTION_END_APPLY_TIMESTAMP,
    APPLYING_TRANSACTION,
    TIMESTAMPDIFF(SECOND,
        LAST_APPLIED_TRANSACTION_ORIGINAL_COMMIT_TIMESTAMP,
        LAST_APPLIED_TRANSACTION_END_APPLY_TIMESTAMP
    ) AS apply_lag_seconds
FROM performance_schema.replication_applier_status_by_worker;
```

---

## 10 Best Practices

1. **Treat replication lag as an SLI.** Emit lag metrics to the monitoring system every 5 seconds and set alerts at the threshold that matches the consistency model.
2. **Implement automatic replica eviction.** Remove a replica from the read pool when its lag exceeds the configured threshold; re-add it only after lag recovers for a sustained period.
3. **Use read-your-writes consistency for user-facing flows.** After a write, route the session to the primary (or a guaranteed-fresh replica) for subsequent reads within a short window.
4. **Start with application-level routing.** Middleware proxies add latency and operational overhead; use them only when application-level routing becomes unmanageable.
5. **Monitor replica CPU and I/O independently.** A replica under heavy read load can fall behind on replay; separate read load from replication apply capacity.
6. **Size replicas identically to the primary.** Under-provisioned replicas introduce lag under load and become unreliable failover targets.
7. **Use cascading replicas when fan-out exceeds 5.** Direct replication from the primary to more than 5 replicas increases primary network and I/O overhead.
8. **Place regional replicas behind a geo-aware load balancer.** Route users to the closest replica to minimize read latency.
9. **Test failover promotion regularly.** Promote a replica to primary in a staging environment monthly to validate the runbook and automation.
10. **Separate analytics queries onto dedicated replicas.** Prevent heavy analytical workloads from competing with production read traffic.

---

## 8 Anti-Patterns

| #  | Anti-Pattern                        | Problem                                                    | Correct Approach                                         |
|----|-------------------------------------|------------------------------------------------------------|----------------------------------------------------------|
| 1  | Ignoring replication lag            | Users see stale data, ghost records, or missing updates    | Monitor lag as an SLI with alerting thresholds           |
| 2  | Sending writes to replicas          | Write fails or silently discarded; data loss               | Enforce read-only connections at the driver level        |
| 3  | Single replica for all reads        | Single point of failure; no horizontal scaling benefit     | Deploy at least 2 replicas per region                    |
| 4  | Same connection pool for R and W    | Cannot independently scale or evict unhealthy replicas     | Separate connection pools with distinct routing logic    |
| 5  | Over-relying on proxy middleware    | Added latency, new failure domain, complex debugging       | Use application-level routing until complexity demands it|
| 6  | No fallback to primary              | Reads fail when all replicas are unhealthy                 | Always fall back to primary when no replica qualifies    |
| 7  | Promoting untested replicas         | Promoted replica has misconfiguration, causes outage       | Run automated promotion drills in staging monthly        |
| 8  | Mixing OLTP and OLAP on one replica | Analytical queries starve transactional reads of resources | Dedicate separate replicas for analytics workloads       |

---

## Enforcement Checklist

- [ ] Replication lag metric is emitted and dashboarded with < 1 s p99 target
- [ ] Alerting fires when any replica exceeds the defined lag threshold for > 30 seconds
- [ ] Read/write connection pools are separated in application configuration
- [ ] Replica eviction logic removes lagging replicas from the read pool automatically
- [ ] Fallback to primary is implemented and tested when all replicas are unhealthy
- [ ] Read-your-writes consistency is enforced for authenticated user sessions post-write
- [ ] Regional replicas are placed behind geo-aware DNS or load balancer
- [ ] Cascading replication is used when replica count exceeds 5 per primary
- [ ] Failover promotion runbook exists and is tested quarterly in staging
- [ ] Analytics workloads are routed to dedicated replicas, not shared production replicas
- [ ] Replica instances match primary instance sizing (CPU, memory, storage IOPS)
- [ ] Connection routing logic is covered by integration tests with simulated lag
