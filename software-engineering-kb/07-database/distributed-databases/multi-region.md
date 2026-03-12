# Multi-Region Database Deployments

> **Domain:** Database > Distributed Databases > Multi-Region
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Multi-region database deployments serve two critical purposes: disaster recovery (survive a full region outage) and latency reduction (serve users from nearby regions). However, physics is unforgiving — the speed of light imposes a minimum ~60-150ms round-trip between continents. Every database architecture must make explicit tradeoffs between consistency, latency, and availability across regions. Choosing the wrong multi-region pattern can result in either data loss during regional failures or unacceptable latency for users. This document covers every production multi-region pattern and when to use each.

---

## How It Works

### Multi-Region Tradeoffs

```
The Fundamental Constraint (speed of light):

US-East ←──── 30ms ────→ US-West
US-East ←──── 80ms ────→ EU-West
US-East ←──── 150ms ───→ AP-Southeast

Every synchronous operation across regions adds
this latency as a floor. You cannot go faster.

Tradeoff Triangle:
         Consistency
            ▲
           / \
          /   \
         /     \
        / PICK  \
       /  TWO    \
      /           \
     ▼─────────────▼
  Low Latency    Availability

Pattern                  Consistency  Latency   Availability
──────────────────────── ─────────── ────────── ────────────
Synchronous replication  Strong       High       Medium
Async replication        Eventual     Low        High
Multi-active (conflict)  Eventual     Low        Very High
Consensus-based (Raft)   Strong       Medium     High
```

---

### Pattern 1: Primary-Standby (Active-Passive)

```
┌─────────────────────────────────────────────────────┐
│  Primary Region (US-East)     Standby (EU-West)     │
│                                                       │
│  ┌───────────────┐           ┌───────────────┐      │
│  │  Primary DB   │──async──►│  Standby DB   │      │
│  │  (read/write) │  repl    │  (read-only)  │      │
│  │               │          │               │      │
│  │  All writes   │          │  Promoted on  │      │
│  │  served here  │          │  failure      │      │
│  └───────────────┘           └───────────────┘      │
│                                                       │
│  RPO: seconds-minutes (async replication lag)        │
│  RTO: minutes (manual/automated failover)            │
│  Consistency: eventual (standby may lag)             │
│  Latency: low for primary region, high for others   │
└─────────────────────────────────────────────────────┘

Use when:
  • Single-region primary, DR only
  • Cost-sensitive (only 2 regions)
  • Acceptable data loss on failover (RPO > 0)
```

```sql
-- PostgreSQL: streaming replication to standby
-- On primary: postgresql.conf
-- wal_level = replica
-- max_wal_senders = 5
-- synchronous_standby_names = ''  (async)

-- On standby: recovery configuration
-- primary_conninfo = 'host=primary-host port=5432 user=replicator'
-- primary_slot_name = 'standby_slot'

-- Check replication lag
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;

-- Monitor lag in time
SELECT
    EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS lag_seconds
FROM pg_stat_replication;
```

---

### Pattern 2: Synchronous Multi-Region Replication

```
┌─────────────────────────────────────────────────────┐
│  Primary (US-East)    Sync Standby (US-West)        │
│                                                       │
│  ┌───────────────┐    ┌───────────────┐             │
│  │  Primary DB   │──sync──►│  Sync Standby│          │
│  │               │──async─►│  Async Standby│ (EU)   │
│  │  Writes wait  │         └───────────────┘        │
│  │  for sync ACK │                                   │
│  └───────────────┘                                   │
│                                                       │
│  RPO: 0 (zero data loss to sync standby)            │
│  RTO: seconds-minutes (automated failover)           │
│  Consistency: strong (sync), eventual (async)        │
│  Latency: +30-80ms per write (sync round-trip)       │
│                                                       │
│  DANGER: if sync standby is down, writes BLOCK      │
│  Mitigation: synchronous_commit = remote_write       │
│             (standby writes to OS buffer, not disk)  │
└─────────────────────────────────────────────────────┘
```

```sql
-- PostgreSQL: synchronous replication
-- postgresql.conf on primary
-- synchronous_standby_names = 'FIRST 1 (standby_us_west, standby_eu_west)'
-- synchronous_commit = on  (wait for standby flush to disk)

-- Synchronous commit levels:
-- off         : no wait (data loss possible)
-- local       : wait for local flush only
-- remote_write: wait for standby OS buffer write
-- on          : wait for standby disk flush
-- remote_apply: wait for standby to apply (strongest)

-- Per-transaction control
SET synchronous_commit = 'remote_apply';
BEGIN;
INSERT INTO critical_financial_data VALUES (...);
COMMIT;  -- waits for standby to apply

SET synchronous_commit = 'local';
BEGIN;
INSERT INTO analytics_events VALUES (...);
COMMIT;  -- only waits for local disk
```

---

### Pattern 3: Multi-Active (Active-Active)

```
┌──────────────────────────────────────────────────────────┐
│  Region A (US-East)        Region B (EU-West)            │
│                                                            │
│  ┌───────────────┐         ┌───────────────┐             │
│  │  DB Node A    │◄──────►│  DB Node B    │             │
│  │  (read/write) │ bi-dir  │  (read/write) │             │
│  │               │ async   │               │             │
│  │  Serves US    │ repl    │  Serves EU    │             │
│  │  users        │         │  users        │             │
│  └───────────────┘         └───────────────┘             │
│                                                            │
│  CONFLICT: User updates profile in US-East AND EU-West    │
│  simultaneously → which write wins?                       │
│                                                            │
│  Conflict Resolution Strategies:                          │
│  • Last-write-wins (LWW) — timestamp-based               │
│  • Region priority — designated "authoritative" region    │
│  • Application-level merge — custom business logic        │
│  • CRDTs — conflict-free replicated data types           │
└──────────────────────────────────────────────────────────┘
```

```typescript
// TypeScript — Last-write-wins conflict resolution
interface ReplicatedRecord {
  id: string;
  data: Record<string, unknown>;
  version: number;
  updatedAt: Date;
  sourceRegion: string;
}

function resolveConflict(
  local: ReplicatedRecord,
  remote: ReplicatedRecord
): ReplicatedRecord {
  // Last-write-wins based on timestamp
  if (remote.updatedAt > local.updatedAt) {
    return remote;
  }
  // Tie-break by region priority
  if (remote.updatedAt.getTime() === local.updatedAt.getTime()) {
    const regionPriority: Record<string, number> = {
      'us-east': 1,
      'eu-west': 2,
      'ap-southeast': 3,
    };
    return regionPriority[remote.sourceRegion] < regionPriority[local.sourceRegion]
      ? remote
      : local;
  }
  return local;
}
```

```sql
-- PostgreSQL: logical replication for multi-active
-- Each region publishes and subscribes

-- Region A (US-East)
CREATE PUBLICATION us_east_pub FOR TABLE users, orders;
CREATE SUBSCRIPTION eu_west_sub
    CONNECTION 'host=eu-west-db port=5432 dbname=app'
    PUBLICATION eu_west_pub;

-- Region B (EU-West)
CREATE PUBLICATION eu_west_pub FOR TABLE users, orders;
CREATE SUBSCRIPTION us_east_sub
    CONNECTION 'host=us-east-db port=5432 dbname=app'
    PUBLICATION us_east_pub;

-- DANGER: this creates circular replication
-- Must handle: conflict detection, loop prevention, schema sync
-- Consider: BDR (Bi-Directional Replication) extension for PostgreSQL
```

---

### Pattern 4: Distributed SQL (Consensus-Based)

```
┌──────────────────────────────────────────────────────────┐
│                    CockroachDB Multi-Region               │
│                                                            │
│  US-East              EU-West            AP-Southeast     │
│  ┌──────────┐        ┌──────────┐       ┌──────────┐    │
│  │ Node 1   │        │ Node 3   │       │ Node 5   │    │
│  │ Node 2   │        │ Node 4   │       │ Node 6   │    │
│  └──────────┘        └──────────┘       └──────────┘    │
│                                                            │
│  Table Locality Options:                                  │
│                                                            │
│  REGIONAL BY TABLE (pin to one region):                   │
│  ┌────────────────────┐                                   │
│  │ user_profiles      │ All data in primary region        │
│  │ LOCALITY: us-east  │ Fast reads/writes in US-East      │
│  │ (leader + replicas │ Slow from EU/AP (cross-region)   │
│  │  all in us-east)   │                                   │
│  └────────────────────┘                                   │
│                                                            │
│  REGIONAL BY ROW (row-level locality):                    │
│  ┌────────────────────────────────────┐                   │
│  │ orders                              │                   │
│  │ Row: region=us → leader in us-east │                   │
│  │ Row: region=eu → leader in eu-west │                   │
│  │ Row: region=ap → leader in ap-se   │                   │
│  │ Each row fast in its home region   │                   │
│  └────────────────────────────────────┘                   │
│                                                            │
│  GLOBAL (replicated everywhere):                          │
│  ┌────────────────────┐                                   │
│  │ currencies         │ Non-blocking reads from anywhere  │
│  │ LOCALITY: global   │ Write latency ~300ms (all regions)│
│  │ Read: <5ms anywhere│ Use for reference data            │
│  └────────────────────┘                                   │
└──────────────────────────────────────────────────────────┘
```

```sql
-- CockroachDB: multi-region configuration
ALTER DATABASE app SET PRIMARY REGION = 'us-east1';
ALTER DATABASE app ADD REGION 'europe-west1';
ALTER DATABASE app ADD REGION 'asia-southeast1';
ALTER DATABASE app SET SECONDARY REGION = 'europe-west1';

-- Regional by row (row-level geo-partitioning)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crdb_region crdb_internal_region NOT NULL DEFAULT gateway_region()::crdb_internal_region,
    customer_id UUID NOT NULL,
    total DECIMAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    FAMILY (id, crdb_region, customer_id, total, created_at)
) LOCALITY REGIONAL BY ROW;

-- Insert: automatically routed to gateway region
INSERT INTO orders (customer_id, total) VALUES ('cust-123', 99.99);
-- If connected to EU gateway, crdb_region = 'europe-west1'

-- Override region for specific row
INSERT INTO orders (crdb_region, customer_id, total)
VALUES ('us-east1', 'cust-456', 149.99);

-- Global table (reference data, fast reads everywhere)
CREATE TABLE countries (
    code STRING PRIMARY KEY,
    name STRING NOT NULL,
    currency_code STRING NOT NULL
) LOCALITY GLOBAL;

-- Survive region failure
ALTER DATABASE app SURVIVE REGION FAILURE;
-- Requires 3+ regions, increases write latency
-- (needs majority of regions to commit)
```

---

### Pattern 5: Read Replicas Across Regions

```
┌──────────────────────────────────────────────────────────┐
│  Primary (US-East)                                        │
│  ┌───────────────┐                                       │
│  │  Primary DB   │                                       │
│  │  (read/write) │                                       │
│  └──┬─────┬──────┘                                       │
│     │     │                                               │
│  async  async                                            │
│  repl   repl                                             │
│     │     │                                               │
│  ┌──▼──┐  ┌──▼──────┐                                   │
│  │EU   │  │AP       │                                    │
│  │Read │  │Read     │  Read-only replicas in each region │
│  │Repl │  │Replica  │  Low-latency reads for local users │
│  └─────┘  └─────────┘  Writes still go to primary        │
│                                                            │
│  Use when:                                                │
│  • Read-heavy workload (90%+ reads)                      │
│  • Writes can tolerate single-region latency             │
│  • Simpler than multi-active                             │
│                                                            │
│  AWS: Aurora Global Database (< 1s replication lag)      │
│  GCP: Cloud SQL cross-region read replicas               │
│  Azure: Azure SQL Hyperscale geo-replication             │
└──────────────────────────────────────────────────────────┘
```

```go
// Go — Route reads to nearest replica, writes to primary
type MultiRegionDB struct {
    primary  *sql.DB          // US-East (read/write)
    replicas map[string]*sql.DB // region → read replica
    region   string            // current app region
}

func (db *MultiRegionDB) Read(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
    // Use local replica for reads
    if replica, ok := db.replicas[db.region]; ok {
        return replica.QueryContext(ctx, query, args...)
    }
    // Fallback to primary
    return db.primary.QueryContext(ctx, query, args...)
}

func (db *MultiRegionDB) Write(ctx context.Context, query string, args ...interface{}) (sql.Result, error) {
    // Always write to primary
    return db.primary.ExecContext(ctx, query, args...)
}

func (db *MultiRegionDB) ReadAfterWrite(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
    // After a write, read from primary to avoid stale data
    return db.primary.QueryContext(ctx, query, args...)
}
```

---

### Pattern Comparison

| Pattern | Consistency | Write Latency | RPO | RTO | Complexity |
|---------|-------------|---------------|-----|-----|------------|
| **Primary-Standby** | Eventual | Low (local) | Seconds-min | Minutes | Low |
| **Sync Multi-Region** | Strong (sync) | High (+RTT) | 0 | Seconds-min | Medium |
| **Multi-Active** | Eventual + conflicts | Low (local) | 0 (with conflicts) | 0 (no failover) | Very High |
| **Distributed SQL** | Strong (consensus) | Medium (+Raft) | 0 | Automatic | High (managed) |
| **Read Replicas** | Eventual (reads) | Low (writes local) | Seconds | Minutes | Low-Medium |

---

### Data Sovereignty & Compliance

```
GDPR (EU): Personal data of EU residents must be
           processed within the EU (or approved countries)

Strategy:
┌────────────────────────────────────────────────────────┐
│                                                          │
│  1. Regional by Row (Distributed SQL)                   │
│     EU user data → leader in EU region                  │
│     US user data → leader in US region                  │
│     Data stays in its region                            │
│                                                          │
│  2. Separate Databases per Region                       │
│     EU database → deployed in EU only                   │
│     US database → deployed in US only                   │
│     Application routes by user region                   │
│     Simpler compliance, harder to query across regions  │
│                                                          │
│  3. Encryption + Access Control                         │
│     Data replicated globally but encrypted              │
│     Decryption keys held only in authorized regions     │
│     Meets some (not all) data residency requirements    │
└────────────────────────────────────────────────────────┘
```

```python
# Python — Region-aware data routing
from enum import Enum
from typing import Optional

class Region(Enum):
    US_EAST = "us-east"
    EU_WEST = "eu-west"
    AP_SOUTHEAST = "ap-southeast"

# Map countries to data residency regions
COUNTRY_TO_REGION = {
    # GDPR countries → EU
    "DE": Region.EU_WEST, "FR": Region.EU_WEST,
    "IT": Region.EU_WEST, "ES": Region.EU_WEST,
    "NL": Region.EU_WEST, "BE": Region.EU_WEST,
    # US states
    "US": Region.US_EAST,
    # APAC
    "JP": Region.AP_SOUTHEAST, "SG": Region.AP_SOUTHEAST,
    "AU": Region.AP_SOUTHEAST,
}

def get_data_region(country_code: str) -> Region:
    """Determine which region should store user data."""
    return COUNTRY_TO_REGION.get(country_code, Region.US_EAST)

def get_connection(region: Region):
    """Return database connection for the specified region."""
    connection_strings = {
        Region.US_EAST: "postgresql://us-east-db:5432/app",
        Region.EU_WEST: "postgresql://eu-west-db:5432/app",
        Region.AP_SOUTHEAST: "postgresql://ap-se-db:5432/app",
    }
    return create_connection(connection_strings[region])
```

---

### Monitoring Multi-Region Deployments

```
Critical Metrics:
┌─────────────────────────────────────────────────────┐
│                                                       │
│  1. Replication Lag                                   │
│     • Bytes behind primary                           │
│     • Time behind primary (seconds)                  │
│     • Alert if > acceptable RPO                      │
│                                                       │
│  2. Cross-Region Latency                             │
│     • P50, P95, P99 round-trip times                 │
│     • Per-region write latency                       │
│     • Consensus commit latency (distributed SQL)     │
│                                                       │
│  3. Failover Readiness                               │
│     • Standby apply position vs primary              │
│     • DNS TTL remaining                              │
│     • Connection pool warm-up status                 │
│                                                       │
│  4. Data Distribution                                │
│     • Range/shard balance across regions             │
│     • Hot-spot detection (uneven writes)             │
│     • Storage utilization per region                 │
│                                                       │
│  5. Conflict Rate (multi-active)                     │
│     • Conflicts per second                           │
│     • Conflict resolution outcomes                   │
│     • Data divergence window                         │
└─────────────────────────────────────────────────────┘
```

---

### Failover Strategies

```
Failover Types:
┌────────────────────────────────────────────────────────┐
│                                                          │
│  1. Manual Failover                                     │
│     • Operator triggers promotion                       │
│     • RTO: 5-30 minutes                                 │
│     • Safest (human verification)                       │
│     • Use for: non-critical, cost-sensitive             │
│                                                          │
│  2. Automated Failover (health-check based)             │
│     • Orchestrator detects failure, promotes standby    │
│     • RTO: 30 seconds - 2 minutes                       │
│     • Risk: split-brain if network partition            │
│     • Use for: most production systems                  │
│     • Tools: Patroni (PG), Orchestrator (MySQL)         │
│                                                          │
│  3. Consensus-Based (distributed SQL)                   │
│     • Raft elects new leader automatically              │
│     • RTO: 5-15 seconds                                 │
│     • No split-brain (Raft guarantees single leader)    │
│     • Use for: zero-RPO, minimal-RTO requirements       │
│                                                          │
│  4. DNS-Based Failover                                  │
│     • Update DNS to point to standby                    │
│     • RTO: TTL-dependent (30s - 5min)                   │
│     • Client caching may extend actual RTO              │
│     • Use with: Route 53 health checks, Cloudflare     │
│                                                          │
│  5. Proxy-Based Failover                                │
│     • Proxy (PgBouncer, ProxySQL, HAProxy) re-routes    │
│     • RTO: < 30 seconds                                 │
│     • Transparent to application                        │
│     • Use for: fastest failover without distributed SQL │
└────────────────────────────────────────────────────────┘
```

```yaml
# Patroni — PostgreSQL HA with automatic failover
# patroni.yml
scope: my-cluster
name: node1

restapi:
  listen: 0.0.0.0:8008

etcd3:
  hosts: etcd1:2379,etcd2:2379,etcd3:2379

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576  # 1MB max lag for failover
    synchronous_mode: true            # zero data loss
    postgresql:
      parameters:
        max_connections: 200
        synchronous_commit: "on"
        wal_level: replica

postgresql:
  listen: 0.0.0.0:5432
  data_dir: /data/postgresql
  authentication:
    replication:
      username: replicator
      password: rep-password
    superuser:
      username: postgres
      password: pg-password
```

---

## Best Practices

1. **ALWAYS define RPO and RTO requirements first** — they determine which pattern to use
2. **ALWAYS use read replicas** before multi-active — simpler, fewer failure modes
3. **ALWAYS test failover regularly** — scheduled failover drills reveal configuration errors
4. **ALWAYS monitor replication lag** with alerting — lag exceeding RPO means data loss risk
5. **ALWAYS use distributed SQL for zero-RPO + zero-RTO** — CockroachDB or YugabyteDB
6. **ALWAYS implement region-aware routing** in application — route reads to nearest replica
7. **ALWAYS consider data sovereignty** — GDPR, CCPA, data residency laws
8. **NEVER assume async replication = zero data loss** — RPO > 0 by definition
9. **NEVER use multi-active without conflict resolution strategy** — conflicts will happen
10. **NEVER deploy cross-region without measuring baseline latency** — know the cost

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Async replication assumed as zero RPO | Data loss on failover | Use sync replication or distributed SQL |
| No failover testing | Failover fails when needed | Monthly failover drills |
| Multi-active without conflict handling | Silent data corruption | Implement conflict detection and resolution |
| DNS TTL too high | Slow failover (clients cache old IP) | Set DNS TTL to 30-60 seconds |
| Read-after-write goes to replica | Stale reads after writes | Route read-after-write to primary |
| Cross-region writes without locality | Every write pays cross-region RTT | Use geo-partitioning (regional by row) |
| No replication lag monitoring | Undetected data divergence | Alert on lag > acceptable RPO |
| Split-brain after network partition | Two primaries, data divergence | Use fencing (STONITH), consensus-based failover |
| All eggs in one cloud provider | Provider outage = total outage | Multi-cloud or at least multi-region |
| Ignoring connection pool warmup | Spike of errors after failover | Pre-warm connection pools to standby |

---

## Real-world Examples

### Stripe (Multi-Region PostgreSQL)
- Primary in US, sync standby for zero data loss
- Read replicas in multiple regions
- Automated failover with extensive testing

### CockroachDB Cloud
- Three-region deployments with SURVIVE REGION FAILURE
- Regional by row for data locality
- Automatic consensus-based failover

### Amazon Aurora Global Database
- Cross-region replication < 1 second lag
- Managed failover with write forwarding
- Up to 5 secondary regions

### Slack
- Multi-region deployment with Vitess (MySQL sharding)
- Regional routing for chat messages
- Cross-region replication for disaster recovery

---

## Enforcement Checklist

- [ ] RPO and RTO requirements documented and agreed
- [ ] Multi-region pattern chosen based on RPO/RTO/complexity tradeoffs
- [ ] Replication lag monitoring with alerting in place
- [ ] Failover procedure documented and tested (monthly drills)
- [ ] Data sovereignty requirements mapped to regions
- [ ] Region-aware routing implemented in application
- [ ] Read-after-write consistency handled (route to primary)
- [ ] Connection pool failover and warmup configured
- [ ] DNS TTL set appropriately for failover speed
- [ ] Split-brain prevention mechanism in place
- [ ] Cross-region latency baselined and acceptable
- [ ] Backup and point-in-time recovery configured per region
