# Database Storage Engines

> **Domain:** Database > Internals > Storage Engines
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

The storage engine is the core component that determines how a database reads and writes data on disk. Choosing the wrong storage engine — or misconfiguring the right one — causes catastrophic performance problems that no amount of indexing or query optimization can fix. B-tree engines (PostgreSQL, InnoDB) optimize for read-heavy workloads with in-place updates. LSM-tree engines (RocksDB, LevelDB, Cassandra) optimize for write-heavy workloads with sequential writes. Understanding the fundamental tradeoffs between these two approaches — read amplification, write amplification, and space amplification — is essential for selecting and tuning any database.

---

## How It Works

### B-Tree Storage Engine

```
B-Tree: The default storage engine for relational databases
Used by: PostgreSQL, MySQL (InnoDB), SQLite, SQL Server, Oracle

Structure:
┌──────────────────────────────────────────────────────┐
│  B+Tree (leaf nodes store data, internal nodes store │
│  keys for navigation)                                 │
│                                                        │
│              ┌──────────────┐                         │
│              │ Root [50,100]│                         │
│              └──┬──────┬──┬┘                         │
│                 │      │  │                           │
│     ┌───────────┘      │  └───────────┐               │
│     ▼                  ▼              ▼               │
│  ┌────────┐     ┌────────┐     ┌────────┐            │
│  │[10,20, │     │[50,60, │     │[100,120│            │
│  │ 30,40] │     │ 70,80] │     │ 150]   │            │
│  │ (leaf) │────►│ (leaf) │────►│ (leaf) │            │
│  └────────┘     └────────┘     └────────┘            │
│     ↓               ↓               ↓                │
│  [data rows]    [data rows]    [data rows]           │
│                                                        │
│  Page size: typically 8KB (PostgreSQL) or 16KB (InnoDB)│
│  Leaf nodes linked for range scans                    │
│  O(log n) lookup, insert, delete                      │
└──────────────────────────────────────────────────────┘

Write Path:
  1. Find the correct leaf page (O(log n) traversal)
  2. Modify the page in buffer pool (memory)
  3. Write WAL entry (sequential write to disk)
  4. Eventually flush dirty page to disk (random write)

Read Path:
  1. Check buffer pool (memory cache)
  2. If not cached, read page from disk (random read)
  3. Navigate B-tree to find value
  4. Return result

Properties:
  ✅ Fast point reads (O(log n))
  ✅ Fast range scans (sequential leaf traversal)
  ✅ Efficient space usage (in-place updates)
  ❌ Random writes (page splits, updates)
  ❌ Write amplification from page rewrites
```

#### B-Tree Page Structure

```
Page Layout (PostgreSQL 8KB page):
┌─────────────────────────────────────────┐
│  Page Header (24 bytes)                  │
│  • LSN (log sequence number)            │
│  • Checksum                              │
│  • Free space pointer                    │
│  • Number of items                       │
├─────────────────────────────────────────┤
│  Item Pointers (4 bytes each)            │
│  [ptr1][ptr2][ptr3]...[ptrN]            │
│  (sorted by key, point to tuples below) │
├─────────────────────────────────────────┤
│  Free Space                              │
│                                          │
│  (grows from both ends)                  │
│                                          │
├─────────────────────────────────────────┤
│  Tuple Data (grows upward from bottom)  │
│  [tuple3 data]                          │
│  [tuple2 data]                          │
│  [tuple1 data]                          │
├─────────────────────────────────────────┤
│  Special Space (B-tree: sibling links)  │
└─────────────────────────────────────────┘

Page Split (when page is full):
  1. Allocate new page
  2. Move ~half the entries to new page
  3. Update parent node with new key/pointer
  4. This propagates upward if parent is also full
```

---

### LSM-Tree Storage Engine

```
LSM-Tree (Log-Structured Merge-Tree):
Used by: RocksDB, LevelDB, Cassandra, ScyllaDB, TiKV,
         CockroachDB (Pebble), HBase, InfluxDB

Structure:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Write Path:                                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    │
│  │ WAL      │    │ MemTable │    │ Immutable    │    │
│  │ (append  │───►│ (sorted  │───►│ MemTable     │    │
│  │  only)   │    │  in-mem) │    │ (flush to    │    │
│  └──────────┘    └──────────┘    │  disk)       │    │
│                                   └──────┬───────┘    │
│                                          │ flush      │
│                                          ▼            │
│  ┌──────────────────────────────────────────────┐    │
│  │ Level 0:  SSTable SSTable SSTable             │    │
│  │           (may overlap)                       │    │
│  ├──────────────────────────────────────────────┤    │
│  │ Level 1:  SSTable  SSTable  SSTable           │    │
│  │           (sorted, non-overlapping)           │    │
│  ├──────────────────────────────────────────────┤    │
│  │ Level 2:  SSTable SSTable SSTable SSTable     │    │
│  │           (10x larger than Level 1)           │    │
│  ├──────────────────────────────────────────────┤    │
│  │ Level N:  ...                                 │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  SSTable (Sorted String Table):                       │
│  • Immutable, sorted key-value file                   │
│  • Index block + data blocks + bloom filter           │
│  • Once written, never modified                       │
│                                                        │
│  Compaction: merge SSTables from Level N to Level N+1 │
│  Remove duplicates, apply deletes (tombstones)        │
└──────────────────────────────────────────────────────┘

Write Path:
  1. Append to WAL (sequential write — fast)
  2. Insert into MemTable (in-memory sorted tree)
  3. When MemTable full, flush to Level 0 SSTable
  4. Background compaction merges levels

Read Path:
  1. Check MemTable (newest data)
  2. Check bloom filters for each SSTable
  3. Search SSTables from Level 0 → Level N
  4. Return first match found (newest version)

Properties:
  ✅ Fast writes (sequential, append-only)
  ✅ High write throughput
  ✅ Good compression (sorted data compresses well)
  ❌ Read amplification (may check multiple levels)
  ❌ Space amplification (data duplicated across levels)
  ❌ Write amplification from compaction
```

#### Compaction Strategies

```
Compaction: merge + sort + deduplicate SSTables

1. Leveled Compaction (RocksDB default, LevelDB)
   • Each level N+1 is 10x larger than level N
   • SSTables within a level don't overlap
   • Compaction: pick SSTable from L(N), merge into L(N+1)
   • ✅ Low space amplification (~10%)
   • ❌ High write amplification (10-30x)
   • Best for: read-heavy workloads

2. Size-Tiered Compaction (Cassandra default)
   • SSTables grouped by similar size
   • When enough same-size SSTables accumulate, merge
   • ✅ Low write amplification (~2-4x)
   • ❌ High space amplification (up to 2x)
   • Best for: write-heavy workloads

3. FIFO Compaction
   • Delete oldest SSTables entirely
   • No merge, just age-based expiry
   • ✅ Zero write amplification
   • ❌ Only works for time-series (TTL-based)
   • Best for: time-series with retention policy

4. Universal Compaction (RocksDB)
   • Hybrid: size-tiered at small levels, leveled at large
   • More tunable than either pure approach
   • Best for: mixed workloads
```

---

### B-Tree vs LSM-Tree

| Aspect | B-Tree | LSM-Tree |
|--------|--------|----------|
| **Write pattern** | Random (in-place update) | Sequential (append-only) |
| **Read pattern** | Single page read | May read multiple levels |
| **Write amplification** | Low-medium (1-2x) | High (10-30x leveled) |
| **Read amplification** | Low (1x) | Medium (bloom filters help) |
| **Space amplification** | Low (~1x) | Medium (1.1x leveled, 2x tiered) |
| **Concurrency** | Complex (page locking) | Simpler (append-only) |
| **Point reads** | Excellent | Good |
| **Range reads** | Excellent | Good |
| **Write throughput** | Medium | High |
| **Compression** | Per-page (limited) | Per-SSTable (excellent) |
| **Use case** | OLTP, mixed workloads | Write-heavy, time-series |

```
Amplification Factors (the three trade-offs):

Write Amplification = (bytes written to disk) / (bytes written by app)
  B-Tree: ~2-5x (WAL + page flush)
  LSM leveled: ~10-30x (compaction rewrites)
  LSM tiered: ~2-4x

Read Amplification = (disk reads per query)
  B-Tree: 1-2 (index traversal, usually cached)
  LSM: 1-N (check each level, bloom filters help)

Space Amplification = (disk space used) / (actual data size)
  B-Tree: ~1.5x (fragmentation, page overhead)
  LSM leveled: ~1.1x
  LSM tiered: ~2x (duplicates across tiers)
```

---

### Column-Oriented Storage

```
Row-Oriented (OLTP):
  Store all columns of a row together
  Page 1: [id:1, name:"Alice", age:32, city:"NYC"]
  Page 2: [id:2, name:"Bob", age:28, city:"SF"]
  ✅ Fast for SELECT * FROM users WHERE id = 1
  ❌ Slow for SELECT AVG(age) FROM users

Column-Oriented (OLAP):
  Store each column separately
  Column "id":   [1, 2, 3, 4, 5, ...]
  Column "name": ["Alice", "Bob", "Carol", ...]
  Column "age":  [32, 28, 35, 41, ...]
  Column "city": ["NYC", "SF", "LA", ...]
  ✅ Fast for SELECT AVG(age) — read only age column
  ✅ Excellent compression (similar values together)
  ❌ Slow for SELECT * WHERE id = 1 (reassemble row)

Databases:
  Row:    PostgreSQL, MySQL, SQLite
  Column: ClickHouse, DuckDB, Parquet, BigQuery, Redshift
  Hybrid: TiDB (TiKV row + TiFlash column)
```

```
Column Encoding Techniques:
┌────────────────────────────────────────────────────┐
│                                                      │
│  1. Dictionary Encoding                              │
│     city: ["NYC", "SF", "NYC", "LA", "NYC", "SF"]  │
│     → dict: {0:"NYC", 1:"SF", 2:"LA"}              │
│     → data: [0, 1, 0, 2, 0, 1]                     │
│     Savings: 90%+ for low-cardinality columns       │
│                                                      │
│  2. Run-Length Encoding (RLE)                        │
│     status: ["active","active","active","inactive"] │
│     → [("active", 3), ("inactive", 1)]             │
│     Savings: excellent for sorted/repeated values   │
│                                                      │
│  3. Bit-Packing                                      │
│     age: [32, 28, 35, 41] (range 0-127 → 7 bits)   │
│     → pack 7 bits per value instead of 32           │
│     Savings: 4x for small integers                  │
│                                                      │
│  4. Delta Encoding                                   │
│     timestamps: [1000, 1001, 1002, 1005]            │
│     → base=1000, deltas=[0, 1, 1, 3]               │
│     Savings: excellent for sequential data           │
└────────────────────────────────────────────────────┘
```

---

### Heap vs Clustered Storage

```
Heap Table (PostgreSQL default):
  Rows stored in insertion order
  Index points to (page, offset) on heap
  Index lookup → random read on heap

  ┌──────┐     ┌─────────────────────┐
  │Index │────►│ Heap: [row3][row1]  │
  │[key] │     │ [row7][row2][row5]  │
  └──────┘     └─────────────────────┘

Clustered Index (InnoDB, CockroachDB):
  Rows stored sorted by primary key
  Primary key IS the data storage order
  Secondary index → primary key → data

  ┌──────────────────────────────────────┐
  │ Primary Index = Data                  │
  │ [key:1,row1][key:2,row2][key:3,row3] │
  └──────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────┐
  │ Secondary    │────►│ Primary Key  │──► Data
  │ Index        │     │ Lookup       │
  └──────────────┘     └──────────────┘

Implications:
  Heap:      Any column can be PK, no PK ordering constraint
  Clustered: PK choice critical (scan order, range queries)
             Secondary index lookups = 2 B-tree traversals
             UUID PKs → random inserts → page splits
```

---

### Buffer Pool / Page Cache

```
Buffer Pool Architecture:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  ┌──────────────────────────────────┐                 │
│  │         Buffer Pool              │                 │
│  │    (shared memory, ~25% RAM)     │                 │
│  │                                   │                 │
│  │  ┌──────┐ ┌──────┐ ┌──────┐    │                 │
│  │  │Page 1│ │Page 5│ │Page 3│    │  Cached pages   │
│  │  │(clean)│ │(dirty)│ │(clean)│   │  (frequently    │
│  │  └──────┘ └──────┘ └──────┘    │   accessed)      │
│  │                                   │                 │
│  │  Hash table: page_id → buffer    │                 │
│  │  Clock/LRU replacement policy    │                 │
│  └──────────────────┬───────────────┘                 │
│                      │                                 │
│         Dirty page   │ flush (background writer)      │
│                      ▼                                 │
│  ┌──────────────────────────────────┐                 │
│  │         Disk (SSD/HDD)           │                 │
│  │  Data files: pages stored here   │                 │
│  └──────────────────────────────────┘                 │
│                                                        │
│  Goal: serve 99%+ of reads from memory                │
│  Hit ratio < 95% → add RAM or tune buffer pool       │
│                                                        │
│  PostgreSQL: shared_buffers (+ OS page cache)         │
│  MySQL: innodb_buffer_pool_size                        │
│  MongoDB: WiredTiger cache                             │
└──────────────────────────────────────────────────────┘
```

```sql
-- PostgreSQL: check buffer cache hit ratio
SELECT
    sum(heap_blks_read) AS heap_read,
    sum(heap_blks_hit) AS heap_hit,
    sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) AS ratio
FROM pg_statio_user_tables;
-- Target: > 0.99 (99%+ cache hit ratio)

-- MySQL: check InnoDB buffer pool hit ratio
SHOW GLOBAL STATUS LIKE 'Innodb_buffer_pool_read%';
-- hit ratio = 1 - (reads / read_requests)
```

---

## Best Practices

1. **ALWAYS choose B-tree for OLTP** (PostgreSQL, MySQL) — best for mixed read/write workloads
2. **ALWAYS choose LSM-tree for write-heavy** workloads (time-series, logging, analytics ingestion)
3. **ALWAYS monitor buffer pool hit ratio** — below 95% indicates insufficient memory
4. **ALWAYS choose clustered index PK carefully** — it determines physical data order (InnoDB)
5. **ALWAYS use sequential PKs** for clustered indexes — random UUIDs cause page splits
6. **ALWAYS tune compaction** for LSM-tree databases — wrong strategy kills performance
7. **NEVER ignore write amplification** in LSM-tree — compaction uses disk I/O and CPU
8. **NEVER mix OLTP and OLAP** in the same storage engine — use column store for analytics
9. **NEVER undersize buffer pool** — database performance drops dramatically when data doesn't fit in memory
10. **NEVER use HDD** for B-tree OLTP workloads — random reads are 100x slower than SSD

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| LSM-tree for read-heavy OLTP | High read latency, read amplification | Use B-tree (PostgreSQL/MySQL) |
| B-tree for write-heavy ingestion | Slow writes, page splits | Use LSM-tree (RocksDB, Cassandra) |
| Buffer pool too small | High disk I/O, cache miss rate > 5% | Increase to 25-75% of RAM |
| Random UUIDs as clustered PK | Page splits, fragmentation, slow inserts | Use sequential IDs or UUIDv7 |
| No compaction tuning | Write stalls, space amplification | Tune compaction strategy for workload |
| Row store for analytics | Full table scans, slow aggregations | Use column store (ClickHouse, DuckDB) |
| Column store for OLTP | Slow point queries, row reassembly | Use row store (PostgreSQL) |
| HDD for random-access workloads | Order of magnitude slower | Use SSD (NVMe preferred) |
| Ignoring page splits | Index bloat, degraded performance | Monitor with pg_stat_user_tables, REINDEX |
| Not understanding heap vs clustered | Wrong PK design, slow secondary lookups | Learn your database's storage model |

---

## Real-world Examples

### PostgreSQL (B-Tree + Heap)
- Default storage engine for most web applications
- Buffer pool (shared_buffers) + OS page cache for performance

### RocksDB (LSM-Tree)
- Storage engine for CockroachDB (as Pebble), TiKV, MyRocks
- Optimized for SSD with configurable compaction

### ClickHouse (Column Store)
- Column-oriented storage for real-time analytics
- 100x faster than row stores for analytical queries

### DuckDB (Column Store, Embedded)
- "SQLite for analytics" — in-process column-oriented engine
- Vectorized execution, excellent for local data analysis

---

## Enforcement Checklist

- [ ] Storage engine type matches workload (B-tree for OLTP, LSM for write-heavy)
- [ ] Buffer pool sized appropriately (25-75% RAM, hit ratio > 99%)
- [ ] Primary key design matches storage model (sequential for clustered)
- [ ] Compaction strategy configured for LSM-tree databases
- [ ] Column store used for analytics workloads (not row store)
- [ ] SSD storage used for B-tree OLTP (not HDD)
- [ ] Write amplification measured and acceptable
- [ ] Page/block size appropriate for workload
- [ ] Compression enabled for cold data
- [ ] Storage engine internals documented for team understanding
