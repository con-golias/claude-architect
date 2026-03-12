# Elasticsearch as a Database

> **Domain:** Database > NoSQL > Search Engines
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Elasticsearch is an Apache Lucene-based distributed search and analytics engine. While covered in `06-backend/search/elasticsearch.md` from an API and search patterns perspective, this document focuses on Elasticsearch as a database: its cluster architecture, shard management, index lifecycle, data modeling, and operational concerns. Understanding how Elasticsearch stores, replicates, and retrieves data is essential for operating it in production — misconfigured sharding, mapping explosions, and cluster instability are the most common causes of Elasticsearch outages.

---

## How It Works

### Cluster Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Elasticsearch Cluster                     │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  Master Node│  │  Data Node  │  │  Data Node  │      │
│  │  (elected)  │  │             │  │             │      │
│  │             │  │ ┌─────────┐ │  │ ┌─────────┐ │      │
│  │ Cluster     │  │ │Shard P0 │ │  │ │Shard R0 │ │      │
│  │ state mgmt  │  │ │(primary)│ │  │ │(replica)│ │      │
│  │ Index mgmt  │  │ └─────────┘ │  │ └─────────┘ │      │
│  │ Shard alloc │  │ ┌─────────┐ │  │ ┌─────────┐ │      │
│  │             │  │ │Shard R1 │ │  │ │Shard P1 │ │      │
│  │             │  │ │(replica)│ │  │ │(primary)│ │      │
│  └─────────────┘  │ └─────────┘ │  │ └─────────┘ │      │
│                    └─────────────┘  └─────────────┘      │
│                                                            │
│  Primary shards: handle writes, replicated to replicas    │
│  Replica shards: serve reads, provide fault tolerance     │
│  Shard = self-contained Lucene index                      │
└──────────────────────────────────────────────────────────┘
```

### Index & Shard Sizing

```
Index Sizing Rules:
- Target shard size: 10-50 GB (ideal ~30 GB)
- Max shard size: 50 GB (performance degrades beyond)
- Max shards per node: ~20 per GB of heap
- Heap size: 50% of RAM, max 31 GB (compressed oops)

Example: 500 GB of data, 3 data nodes
- Shards needed: 500 GB / 30 GB = ~17 primary shards
- With 1 replica: 34 total shards
- Per node: ~11 shards (well within limits)
```

```json
// Create index with shard configuration
PUT /products
{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1,
    "refresh_interval": "5s",
    "codec": "best_compression"
  },
  "mappings": {
    "properties": {
      "name":        { "type": "text", "analyzer": "english" },
      "description": { "type": "text", "analyzer": "english" },
      "sku":         { "type": "keyword" },
      "price":       { "type": "float" },
      "category":    { "type": "keyword" },
      "tags":        { "type": "keyword" },
      "created_at":  { "type": "date" },
      "metadata":    { "type": "object", "enabled": false }
    }
  }
}
```

---

### Index Lifecycle Management (ILM)

```
Time-series data lifecycle:
┌──────┐    ┌──────┐    ┌──────┐    ┌──────┐
│ Hot  │───►│ Warm │───►│ Cold │───►│Delete│
│ Phase│    │ Phase│    │ Phase│    │ Phase│
│      │    │      │    │      │    │      │
│7 days│    │30 days│   │90 days│   │365 d │
│SSD   │    │HDD   │    │Frozen│    │      │
│5 repl│    │1 repl│    │0 repl│    │      │
└──────┘    └──────┘    └──────┘    └──────┘
```

```json
// ILM policy
PUT _ilm/policy/logs_policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_primary_shard_size": "30gb",
            "max_age": "7d"
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 },
          "allocate": { "number_of_replicas": 1 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "freeze": {}
        }
      },
      "delete": {
        "min_age": "365d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

---

### Mapping & Data Types

| ES Type | Use Case | Notes |
|---------|----------|-------|
| `text` | Full-text search | Analyzed, tokenized, not for sorting |
| `keyword` | Exact match, sorting, aggregation | Not analyzed, max 32KB |
| `long/integer/float/double` | Numeric values | Use scaled_float for prices |
| `date` | Timestamps | ISO 8601 or epoch |
| `boolean` | True/false | |
| `object` | Nested JSON | Flattened, no independent queries |
| `nested` | Array of objects | Independent queries, higher cost |
| `geo_point` | Lat/lon coordinates | Geo queries (distance, bounding box) |
| `dense_vector` | ML embeddings | Vector similarity search |

```json
// Dynamic mapping pitfall — mapping explosion
// ES auto-creates mappings for new fields
// If you index arbitrary JSON, you get thousands of fields → OOM

// Prevention: strict mapping
PUT /events
{
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "type":    { "type": "keyword" },
      "payload": { "type": "object", "enabled": false }
    }
  }
}
// "strict": reject documents with unmapped fields
// "enabled": false: store but don't index (no search, saves memory)
```

---

### Cluster Health & Monitoring

```bash
# Cluster health
GET _cluster/health
# green: all shards allocated
# yellow: primary shards OK, some replicas unassigned
# red: some primary shards unassigned (data loss risk!)

# Node statistics
GET _nodes/stats

# Index statistics
GET _cat/indices?v&s=store.size:desc

# Shard allocation
GET _cat/shards?v&s=store:desc

# Pending tasks
GET _cluster/pending_tasks

# Hot threads (debug performance)
GET _nodes/hot_threads
```

---

### Elasticsearch vs Dedicated Databases

| Use Case | Use ES | Use PostgreSQL/MongoDB |
|----------|--------|----------------------|
| Full-text search | Yes | Only if simple (PG tsvector sufficient) |
| Log analytics | Yes | No (time-series volume) |
| Product search | Yes | Maybe (PG pg_trgm sufficient for small catalogs) |
| Primary OLTP database | No | Yes |
| Transactional data | No | Yes |
| Strong consistency | No (near-real-time) | Yes |
| Complex JOINs | No | Yes |

---

## Best Practices

1. **ALWAYS set explicit mappings** — never rely on dynamic mapping for production indexes
2. **ALWAYS use ILM** for time-series data — automate hot/warm/cold/delete lifecycle
3. **ALWAYS size shards between 10-50 GB** — too small = overhead, too large = slow recovery
4. **ALWAYS use keyword for exact-match fields** — not text (text is for full-text search)
5. **ALWAYS disable dynamic mapping or set to strict** — prevent mapping explosions
6. **ALWAYS set refresh_interval to 5-30s** for write-heavy indexes — default 1s is expensive
7. **ALWAYS monitor cluster health** — yellow/red requires immediate attention
8. **NEVER use Elasticsearch as primary database** — it is not ACID, no transactions
9. **NEVER create too many shards** — each shard consumes heap memory
10. **NEVER index arbitrary user input fields** — causes mapping explosion

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Dynamic mapping on user input | Mapping explosion, OOM | Set dynamic: strict |
| Too many small shards | High overhead, slow queries | Target 10-50 GB per shard |
| No ILM for time-series | Disk fills up, old data never deleted | Configure ILM policy |
| Text type for keyword fields | Cannot aggregate, sort, or exact-match | Use keyword for exact values |
| refresh_interval = 1s on write-heavy | High CPU, slow indexing | Increase to 5-30s |
| Using ES as primary database | Data loss, no ACID, no transactions | Use PostgreSQL/MongoDB as primary |
| Cluster in yellow/red state | Unassigned shards, potential data loss | Investigate and fix immediately |
| Not monitoring heap usage | OOM crash | Keep heap < 75% used |

---

## Real-world Examples

### Elastic Cloud
- Managed Elasticsearch with automatic ILM, scaling, and monitoring
- Integrations with observability (APM, logs, metrics)

### GitHub
- Elasticsearch for code search (billions of lines of code)
- Custom analyzers for programming language tokenization
- Search across repositories, issues, and discussions

### Wikipedia
- Elasticsearch for full-text search across all articles
- Multi-language analyzers for global content
- Real-time indexing of article edits

---

## Enforcement Checklist

- [ ] Explicit mappings defined (no dynamic mapping for production)
- [ ] Shard sizes between 10-50 GB
- [ ] ILM policy configured for time-series indexes
- [ ] Cluster health monitored with alerting (green/yellow/red)
- [ ] Heap usage monitored (< 75%)
- [ ] refresh_interval tuned for write-heavy indexes
- [ ] Keyword type used for exact-match/aggregation fields
- [ ] Elasticsearch NOT used as primary database
- [ ] Mapping explosion prevention in place (strict or disabled dynamic)
- [ ] Backup/restore configured (snapshot to S3)
