# ScyllaDB

> **Domain:** Database > NoSQL > Wide-Column
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

ScyllaDB is a drop-in replacement for Apache Cassandra, rewritten in C++ with a shared-nothing architecture. It delivers 3-10x better throughput and dramatically lower latency (P99 < 1ms) compared to Cassandra's Java-based implementation. ScyllaDB eliminates Cassandra's JVM garbage collection pauses — the single biggest source of tail latency spikes in Cassandra. It uses the same CQL query language and client drivers, making migration from Cassandra straightforward. Discord's migration from Cassandra to ScyllaDB is one of the most well-documented case studies in database engineering.

---

## How It Works

### ScyllaDB vs Cassandra Architecture

```
Cassandra (JVM-based):              ScyllaDB (C++ / Seastar):
┌──────────────────┐               ┌──────────────────┐
│  JVM Process     │               │  Seastar Engine   │
│                  │               │                    │
│  Thread Pool     │               │  Per-Core Shards   │
│  ┌─────────────┐ │               │  ┌───┐ ┌───┐ ┌───┐│
│  │ Thread 1    │ │               │  │S0 │ │S1 │ │S2 ││
│  │ Thread 2    │ │               │  │   │ │   │ │   ││
│  │ Thread 3    │ │               │  │Own│ │Own│ │Own││
│  │ Thread 4    │ │               │  │mem│ │mem│ │mem││
│  │ (shared mem)│ │               │  └───┘ └───┘ └───┘│
│  └─────────────┘ │               │  No shared state   │
│  GC pauses: 50-  │               │  No GC pauses      │
│  500ms!           │               │  No thread locks   │
└──────────────────┘               └──────────────────┘
```

**Key differences:**

| Feature | Cassandra | ScyllaDB |
|---------|-----------|---------|
| **Language** | Java (JVM) | C++ (Seastar framework) |
| **Thread model** | Shared-nothing (per JVM) | Shared-nothing (per CPU core) |
| **GC pauses** | Yes (50-500ms P99 spikes) | None |
| **Latency P99** | 10-100ms typical | < 1ms typical |
| **Throughput** | X | 3-10x Cassandra |
| **Memory management** | JVM heap + off-heap | Manual, precise |
| **Compaction** | Blocks threads | Incremental, non-blocking |
| **Auto-tuning** | Manual (many JVM flags) | Automatic (detects hardware) |
| **CQL compatibility** | Native | 100% compatible |
| **Client drivers** | Cassandra drivers | Same Cassandra drivers work |
| **Nodes needed** | More (lower per-node throughput) | Fewer (3-10x per-node) |

---

### Shard-per-Core Architecture

```
ScyllaDB Node (16 cores):
┌────────────────────────────────────────────────────┐
│  Core 0   │  Core 1   │  Core 2   │  ...  Core 15 │
│  ┌──────┐ │  ┌──────┐ │  ┌──────┐ │      ┌──────┐ │
│  │Shard 0│ │  │Shard 1│ │  │Shard 2│ │      │Shard │ │
│  │       │ │  │       │ │  │       │ │      │  15  │ │
│  │Own    │ │  │Own    │ │  │Own    │ │      │Own   │ │
│  │memory │ │  │memory │ │  │memory │ │      │memory│ │
│  │Own    │ │  │Own    │ │  │Own    │ │      │Own   │ │
│  │I/O    │ │  │I/O    │ │  │I/O    │ │      │I/O   │ │
│  │Own    │ │  │Own    │ │  │Own    │ │      │Own   │ │
│  │network│ │  │network│ │  │network│ │      │network│ │
│  └──────┘ │  └──────┘ │  └──────┘ │      └──────┘ │
│                                                      │
│  No locks between shards                             │
│  No context switching                                │
│  Each shard handles its own subset of token range    │
└────────────────────────────────────────────────────┘

Result: Linear scaling with CPU cores
        16 cores = 16x single-core throughput
```

---

### Migration from Cassandra

```
Step 1: Deploy ScyllaDB cluster alongside Cassandra
Step 2: Use ScyllaDB Migrator or sstableloader to copy data
Step 3: Switch application to dual-write (both clusters)
Step 4: Verify data consistency
Step 5: Switch reads to ScyllaDB
Step 6: Stop writes to Cassandra
Step 7: Decommission Cassandra

No schema changes needed — CQL is identical
No driver changes needed — same Cassandra drivers
```

```sql
-- Same CQL as Cassandra
CREATE KEYSPACE my_app WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'us-east': 3
};

CREATE TABLE messages (
    channel_id UUID,
    message_id TIMEUUID,
    content TEXT,
    PRIMARY KEY ((channel_id), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);

-- ScyllaDB-specific: workload type hints
ALTER TABLE messages WITH scylla_tags = {'workload_type': 'interactive'};
-- 'interactive' = low-latency OLTP
-- 'batch' = high-throughput analytics
```

---

### ScyllaDB-Specific Features

```sql
-- Incremental compaction (ScyllaDB exclusive)
-- Runs continuously in small chunks, no latency spikes
ALTER TABLE messages WITH compaction = {
  'class': 'IncrementalCompactionStrategy'
};

-- CDC (Change Data Capture — built-in)
ALTER TABLE messages WITH cdc = {'enabled': true};
-- Changes written to messages_scylla_cdc_log table
-- Stream to Kafka via ScyllaDB CDC Source Connector

-- Alternator (DynamoDB-compatible API)
-- Run DynamoDB workloads on ScyllaDB without AWS
-- Uses same AWS SDK, same API, self-hosted
```

---

## Best Practices

1. **ALWAYS use ScyllaDB over Cassandra for new deployments** — superior performance, same API
2. **ALWAYS let ScyllaDB auto-tune** — it detects hardware and configures itself
3. **ALWAYS use IncrementalCompactionStrategy** — ScyllaDB's default, no latency spikes
4. **ALWAYS size clusters with fewer, larger nodes** — ScyllaDB utilizes hardware better than Cassandra
5. **ALWAYS use shard-aware drivers** — route requests to correct shard, skip internal routing
6. **NEVER tune JVM flags** (there is no JVM) — ScyllaDB manages memory automatically
7. **NEVER over-provision nodes** — fewer ScyllaDB nodes replace many Cassandra nodes
8. **ALWAYS monitor per-shard metrics** — ScyllaDB Monitoring Stack (Prometheus + Grafana)

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Using Cassandra for new projects | JVM tuning overhead, GC pauses | Use ScyllaDB (same API, better performance) |
| Too many nodes (Cassandra sizing) | Over-provisioned, wasted resources | ScyllaDB needs 3-10x fewer nodes |
| Manual memory tuning | Sub-optimal performance | Let ScyllaDB auto-tune |
| Not using shard-aware drivers | Extra internal routing hop | Use ScyllaDB shard-aware driver |
| Cassandra compaction strategy | Not using ScyllaDB improvements | Use IncrementalCompactionStrategy |

---

## Real-world Examples

### Discord
- Migrated from Cassandra to ScyllaDB for message storage
- Reduced P99 latency from 40-125ms to < 5ms
- Reduced node count from 177 Cassandra nodes to 72 ScyllaDB nodes
- Handles millions of messages per second

### Expedia
- ScyllaDB for real-time pricing and availability
- Sub-millisecond lookups for hotel/flight pricing
- Replaced multiple Cassandra clusters

### Comcast
- ScyllaDB for DVR metadata storage
- Billions of records across data centers
- Low-latency access for real-time TV guide

---

## Enforcement Checklist

- [ ] ScyllaDB chosen over Cassandra for new wide-column deployments
- [ ] IncrementalCompactionStrategy used (not STCS/LCS)
- [ ] Shard-aware drivers used for optimal routing
- [ ] Auto-tuning enabled (no manual memory configuration)
- [ ] Node count right-sized (not Cassandra-level over-provisioning)
- [ ] Per-shard metrics monitored
- [ ] CDC enabled for event-driven patterns
- [ ] Workload type tags set per table
