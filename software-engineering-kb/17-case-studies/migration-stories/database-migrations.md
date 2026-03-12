# Database Migration Case Studies

| Attribute | Value |
|-----------|-------|
| Domain | Case Studies > Migration Stories |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Database](../../07-database/), [Database Scaling](../../10-scalability/database-scaling/) |

---

## Core Concepts

### Common Migration Paths

| Source → Target | Motivation | Complexity |
|---|---|---|
| MySQL → PostgreSQL | Standards compliance, advanced features (JSONB, CTEs, extensions) | Medium |
| MongoDB → PostgreSQL | ACID transactions, JOIN support, schema enforcement | High |
| Oracle → PostgreSQL | Licensing cost (Oracle: $47K+/core vs PostgreSQL: $0), vendor freedom | High |
| SQL Server → PostgreSQL | Cost reduction, Linux ecosystem, open-source tooling | Medium |
| Cassandra → ScyllaDB | Same data model, 10x better latency (C++ vs Java GC pauses) | Low-Medium |
| Single DB → Sharded | Horizontal scale beyond single-node capacity | High |
| Self-managed → Managed (RDS/Cloud SQL) | Operational burden reduction, automated HA and backups | Low-Medium |

### Zero-Downtime Migration Pattern

Follow this four-phase pattern for production database migrations without user-facing downtime.

```
Phase 1: Dual-Write    Phase 2: Shadow Read    Phase 3: Cutover    Phase 4: Cleanup
┌─────────┐            ┌─────────┐             ┌─────────┐         ┌─────────┐
│  App     │            │  App     │            │  App     │         │  App     │
│ write→A  │            │ write→A  │            │ write→B  │         │ write→B  │
│ write→B  │            │ write→B  │            │ read→B   │         │ read→B   │
│ read→A   │            │ read→A+B │            │          │         │          │
└─────────┘            │ compare  │            └─────────┘         └─────────┘
                       └─────────┘                                  (remove A)
```

**Phase 1 — Dual-Write (1-4 weeks):**
- Application writes to both old and new databases
- All reads still come from the old database
- Monitor write latency impact and error rates on the new target
- Run continuous data validation comparing both stores

**Phase 2 — Shadow Read (1-2 weeks):**
- Read from both databases, return old database results to users
- Compare results in background — log every discrepancy
- Target: discrepancy rate below 0.01% before proceeding
- Profile query performance on new database under real read load

**Phase 3 — Cutover (minutes to hours):**
- Switch reads and writes to the new database (feature flag or connection string swap)
- Keep the old database receiving writes for instant rollback capability
- Monitor error rates, latency, and business metrics intensely for 24-48 hours

**Phase 4 — Cleanup (1-2 weeks post-cutover):**
- Stop dual-writes to old database
- Keep old database read-only for 14-30 days as safety net
- Remove dual-write code paths from application
- Decommission old database after validation period

### Schema Migration Strategies

**Expand-Contract Pattern (zero-downtime schema changes):**

```
Step 1: Expand           Step 2: Migrate          Step 3: Contract
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ old_column   │         │ old_column   │         │ new_column   │
│ new_column   │ ← add   │ new_column   │ ← copy  │              │ ← drop old
│ (nullable)   │         │ (populated)  │         │ (NOT NULL)   │
└──────────────┘         └──────────────┘         └──────────────┘
```

1. **Expand:** Add new column as nullable, deploy code that writes to both columns
2. **Migrate:** Backfill existing rows, validate data integrity
3. **Contract:** Drop old column after all code reads from new column only

**Online DDL Tools:**
- **pt-online-schema-change** (Percona): creates shadow table, copies data, swaps via rename
- **gh-ost** (GitHub): uses binary log streaming instead of triggers — less intrusive
- **pg_repack** (PostgreSQL): repacks tables without exclusive locks
- **LHM** (Large Hadron Migrator, Shopify): online migrations for MySQL

### Data Migration Tools

| Tool | Use Case | Mechanism |
|---|---|---|
| **pgloader** | MySQL/SQLite → PostgreSQL | Bulk streaming with type mapping |
| **AWS DMS** | Any supported source → AWS target | Managed CDC replication service |
| **Azure DMS** | SQL Server/MySQL/PostgreSQL → Azure | Managed migration with validation |
| **Debezium** | Any DB → Kafka → any target | CDC via database log tailing (WAL, binlog) |
| **gh-ost** | MySQL online DDL | Binary log replication for schema changes |
| **Flyway/Liquibase** | Schema versioning | Version-controlled DDL migrations |

### Real-World Examples

**GitHub — MySQL Horizontal Scaling with Vitess (2019-2023):**
- Problem: single MySQL instance handling all metadata, approaching vertical scaling limits
- Solution: adopted Vitess (YouTube's MySQL sharding middleware)
- Migrated gradually: schema-by-schema, table-by-table to Vitess-managed sharded clusters
- Key challenge: identifying shard keys and rewriting cross-shard queries
- Result: MySQL continues as core database but horizontally scalable behind Vitess

**Notion — PostgreSQL Sharding (2021-2023):**
- Problem: single PostgreSQL instance with 100TB+ data, vacuum and replication lag issues
- Solution: application-level sharding with workspace ID as shard key
- Migrated to 480 logical shards mapped to physical PostgreSQL instances
- Used dual-write pattern during migration with automated consistency validation
- Result: 5x improvement in query latency, eliminated replication lag issues

**Discord — Cassandra → ScyllaDB (2022-2023):**
- Problem: Cassandra's JVM garbage collection caused unpredictable latency spikes
- Solution: ScyllaDB (C++ reimplementation of Cassandra, same data model and query language)
- Migrated trillions of messages with zero downtime using dual-read validation
- Result: p99 latency dropped from 40-125ms to 5-15ms, tail latencies became predictable

**Instagram — PostgreSQL at Scale (2012-present):**
- Challenge: Django ORM on PostgreSQL serving 2B+ monthly active users
- Strategy: extensive use of pgbouncer for connection pooling, read replicas for read-heavy workloads
- Custom sharding middleware for user-partitioned data
- Lesson: PostgreSQL scales far beyond what most teams expect with proper operational investment

### Testing Migrations

**Data validation strategy:**
- Row count comparison between source and target (expect exact match for full migrations)
- Checksum comparison on critical columns (MD5/SHA hash of concatenated values)
- Business rule validation: verify aggregate totals (account balances, order counts)
- Sample-based deep comparison: randomly select 1% of rows for full field-level comparison

**Shadow traffic testing:**
- Replay production read queries against the new database
- Compare response times: p50, p95, p99 between old and new
- Compare result sets for correctness
- Run for at least 1 full business cycle (1 week minimum)

**Rollback plan requirements:**
- Document exact rollback steps before starting migration
- Test rollback procedure in staging environment
- Define rollback triggers: error rate > X%, latency > Y ms, data discrepancy > Z%
- Ensure rollback can execute in under 5 minutes for critical systems

### Performance Validation

**Benchmark before and after:**
- Capture EXPLAIN ANALYZE output for top 50 queries before migration
- Run the same queries on the new database with equivalent data volume
- Compare execution plans — watch for full table scans replacing index scans
- Validate that all necessary indexes exist on the target

**Query plan comparison checklist:**
- Index usage patterns match or improve
- Join strategies are equivalent (nested loop vs hash join vs merge join)
- Row estimates are accurate (indicates statistics are properly gathered)
- No sequential scans on tables with more than 10K rows (for point queries)

### Common Pitfalls

**Data loss scenarios:**
- Failing to capture in-flight transactions during cutover window
- Truncating data during type conversion (VARCHAR(255) → VARCHAR(100))
- Missing rows from tables not included in migration scope

**Encoding issues:**
- Character set mismatch (latin1 → UTF-8 can corrupt multi-byte characters)
- Collation differences affecting sort order and unique constraints
- Emoji and 4-byte Unicode requiring utf8mb4 (MySQL) vs default UTF-8 (PostgreSQL)

**Timezone handling:**
- TIMESTAMP vs TIMESTAMPTZ semantics differ between databases
- Application-level timezone assumptions baked into queries
- Daylight saving time edge cases in historical data

**Sequence and ID gaps:**
- Auto-increment sequences may not match after migration
- UUID generation strategy differences between databases
- Foreign key references broken if IDs change during migration

---

## 10 Key Lessons

1. **Never migrate without a rollback plan.** Document exact rollback steps, test them in staging, and define automatic rollback triggers before touching production.

2. **Dual-write is safer than big-bang cutover.** Run both databases in parallel for weeks, validate consistency, and switch only when discrepancy rate approaches zero.

3. **Test with production-scale data, not subsets.** Query plans, memory usage, and lock contention behave differently at 100GB than at 1GB — test with full data volumes.

4. **Fix encoding before migration, not during.** Identify and clean up character encoding issues in the source database — migrating corrupt data just moves the problem.

5. **Schema changes and data migration are separate concerns.** Use expand-contract for schema evolution and zero-downtime patterns for data migration — do not combine them.

6. **Online DDL tools are essential for large tables.** ALTER TABLE on a 500M-row table locks writes for hours — use gh-ost, pt-osc, or pg_repack for zero-downtime schema changes.

7. **Monitor replication lag continuously during migration.** CDC-based migrations can fall behind during write spikes — alert when lag exceeds your RPO threshold.

8. **Automate data validation, do not rely on spot checks.** Build continuous comparison pipelines that run throughout migration — manual validation misses systematic errors.

9. **Plan for one full business cycle of parallel running.** Weekly patterns, monthly batch jobs, and quarterly reports all need validation — one day of shadow testing is insufficient.

10. **Budget 2-3x your initial timeline estimate.** Database migrations consistently take longer than planned due to edge cases in data, queries, and application behavior.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Big-bang cutover | Extended downtime, no rollback path, data loss risk | Dual-write with gradual cutover and instant rollback capability |
| Skipping data validation | Silent data corruption discovered weeks later | Automated row-count, checksum, and sample comparison pipelines |
| Migrating without production-scale test | Performance regressions in production | Test with full data volume and realistic query patterns |
| Ignoring encoding differences | Corrupted characters, broken search, constraint violations | Audit and fix encoding in source database before migration |
| Manual schema migration | Inconsistent environments, unreproducible changes | Version-controlled migrations with Flyway or Liquibase |
| Changing schema and data simultaneously | Impossible to isolate failures; complex rollback | Separate schema evolution (expand-contract) from data migration |
| Underestimating timeline | Rushed cutover, insufficient testing, production incidents | Plan for 2-3x estimated duration; build in validation phases |
| No replication monitoring | Undetected data drift between source and target | Continuous lag monitoring with alerts at RPO threshold |

---

## Checklist

- [ ] Document current database schema, indexes, stored procedures, and triggers
- [ ] Classify migration approach: homogeneous (same engine) or heterogeneous
- [ ] Audit character encoding and collation in source database
- [ ] Set up automated data validation pipeline (row counts, checksums, samples)
- [ ] Test migration with production-scale data in staging environment
- [ ] Capture EXPLAIN ANALYZE for top 50 queries before and after migration
- [ ] Implement dual-write layer with feature flag for traffic switching
- [ ] Define rollback triggers and test rollback procedure in staging
- [ ] Lower DNS TTL and prepare connection string switch mechanism
- [ ] Plan migration window covering at least one full business cycle for validation
- [ ] Configure monitoring for replication lag, error rates, and query latency
- [ ] Schedule old database decommission 14-30 days after successful cutover
