# Database Engineering

Production database knowledge covering relational and NoSQL databases, data modeling, query optimization, transactions, scaling, migrations, security, and operational best practices.

## Contents

### Fundamentals
- [Database Types](fundamentals/database-types.md) — Relational, document, key-value, graph, time-series, vector, wide-column paradigms
- [Database Architecture](fundamentals/database-architecture.md) — Query processing pipeline, storage engines, buffer pools, catalog
- [CAP Theorem & Consistency](fundamentals/cap-consistency.md) — CAP theorem, consistency models, PACELC, eventual consistency patterns

### Transactions
- [ACID & Isolation Levels](transactions/acid-isolation.md) — ACID properties, isolation levels, MVCC, phantom reads, serializable
- [Locking & Concurrency](transactions/locking-concurrency.md) — Lock types, deadlock detection, optimistic vs pessimistic, SKIP LOCKED
- [Distributed Transactions](transactions/distributed-transactions.md) — 2PC, Saga pattern, outbox pattern, idempotency

### Data Modeling
- [Normalization](data-modeling/normalization.md) — Normal forms (1NF-5NF), functional dependencies, normalization workflow
- [Denormalization](data-modeling/denormalization.md) — Strategic denormalization, materialized views, CQRS, read models
- [Relationships](data-modeling/relationships.md) — One-to-many, many-to-many, polymorphic, self-referential, junction tables
- [Schema Design Patterns](data-modeling/schema-design-patterns.md) — EAV, soft delete, audit trails, temporal data, multi-tenancy, tree structures

### Relational Databases
- **SQL Fundamentals**
  - [Advanced SQL](relational/sql-fundamentals/advanced-sql.md) — Window functions, CTEs, lateral joins, grouping sets, JSON operations
- **PostgreSQL**
  - [Overview & Architecture](relational/postgresql/overview.md) — Process model, MVCC, VACUUM, configuration
  - [Indexing](relational/postgresql/indexing.md) — B-tree, GIN, GiST, BRIN, partial, covering, expression indexes
  - [Advanced Features](relational/postgresql/advanced-features.md) — JSONB, full-text search, extensions, triggers, RLS
  - [Performance Tuning](relational/postgresql/performance-tuning.md) — Memory config, vacuum tuning, query optimization, monitoring
- **MySQL**
  - [Overview & Architecture](relational/mysql/overview.md) — InnoDB architecture, replication, MySQL 8.0 features
  - [Performance Tuning](relational/mysql/performance-tuning.md) — Buffer pool, query cache, slow query log, InnoDB config

### NoSQL Databases
- [MongoDB](nosql/mongodb.md) — Document model, aggregation pipeline, indexing, replication, sharding
- [Redis](nosql/redis.md) — Data structures, persistence, clustering, pub/sub, Lua scripting
- [DynamoDB](nosql/dynamodb.md) — Partition keys, GSI/LSI, single-table design, capacity modes

### Distributed Databases
- [NewSQL Overview](distributed-databases/newsql-overview.md) — CockroachDB, TiDB, YugabyteDB architecture and comparison
- [Consensus Protocols](distributed-databases/consensus-protocols.md) — Raft, Paxos, Multi-Raft, clock synchronization
- [Multi-Region](distributed-databases/multi-region.md) — Multi-region patterns, failover, data sovereignty, conflict resolution

### Vector Databases
- [Embeddings & Similarity](vector-databases/embeddings-similarity.md) — Vector embeddings, distance metrics, ANN algorithms, RAG pattern
- [pgvector](vector-databases/pgvector.md) — PostgreSQL vector extension, HNSW/IVFFlat indexing, hybrid search
- [Dedicated Vector DBs](vector-databases/dedicated-vector-dbs.md) — Pinecone, Qdrant, Weaviate, Milvus, Chroma comparison

### Database Internals
- [Storage Engines](database-internals/storage-engines.md) — B-tree vs LSM-tree, page structure, compaction, column-oriented storage
- [WAL & Durability](database-internals/wal-durability.md) — Write-ahead logging, checkpoints, crash recovery (ARIES), PITR
- [Memory Management](database-internals/memory-management.md) — Buffer pools, shared memory, connection memory, OS-level tuning

### Scaling
- [Replication](scaling/replication.md) — Streaming, logical, synchronous/async, replication lag, failover
- [Sharding & Partitioning](scaling/sharding-partitioning.md) — Table partitioning, horizontal sharding, shard key selection, Citus/Vitess
- [Read Replicas & Load Distribution](scaling/read-replicas-load.md) — Read/write splitting, connection pooling, caching integration

### Query Optimization
- [Indexing Strategies](query-optimization/indexing-strategies.md) — Composite indexes, covering indexes, partial indexes, index monitoring
- [Query Planning](query-optimization/query-planning.md) — EXPLAIN ANALYZE, scan types, join algorithms, optimization workflow
- [N+1 Query Problem](query-optimization/n-plus-one-problem.md) — Detection, ORM solutions (Prisma, Drizzle, SQLAlchemy, GORM), DataLoader
- [Connection Pooling](query-optimization/connection-pooling.md) — Pool sizing, PgBouncer, ProxySQL, monitoring, leak detection
- [Benchmarking](query-optimization/benchmarking.md) — pgbench, sysbench, load testing methodology, performance baselines

### ORM & Query Builders
- [Raw SQL vs ORM](orm-and-query-builders/raw-sql-vs-orm.md) — Spectrum comparison, when to use each approach
- [Prisma](orm-and-query-builders/prisma.md) — Schema-first, TypeScript, generated client, migrations
- [Drizzle](orm-and-query-builders/drizzle.md) — SQL-like TypeScript API, relational queries
- [TypeORM & Sequelize](orm-and-query-builders/typeorm-sequelize.md) — Decorator-based (TypeORM), model-based (Sequelize)
- [SQLAlchemy](orm-and-query-builders/sqlalchemy.md) — Python ORM, 2.0 declarative, async, Alembic
- [GORM & Ent](orm-and-query-builders/gorm-ent.md) — Go ORMs, raw SQL with sqlx/pgx

### Migrations
- [Migration Strategies](migrations/migration-strategies.md) — State-based vs migration-based, versioning, rollback strategies
- [Zero-Downtime Migrations](migrations/zero-downtime-migrations.md) — Expand-contract pattern, safe DDL, lock management
- [Migration Tools](migrations/tools.md) — golang-migrate, Prisma Migrate, Alembic, Atlas, Flyway, dbmate

### Backup & Recovery
- [Backup Strategies](backup-recovery/backup-strategies.md) — Logical, physical, PITR, snapshots, pgBackRest, retention
- [Disaster Recovery](backup-recovery/disaster-recovery.md) — RPO/RTO, DR tiers, runbooks, delayed replicas, DR testing

### Database Security
- [Access Control](database-security/access-control.md) — Authentication, RBAC, Row-Level Security, auditing
- [Encryption & Compliance](database-security/encryption-compliance.md) — TLS, encryption at rest, column-level encryption, GDPR/HIPAA/PCI

### Testing
- [Database Testing](testing/database-testing.md) — Testcontainers, fixtures, integration testing, constraint testing, CI/CD
- [Migration Testing](testing/migration-testing.md) — Schema correctness, reversibility, data integrity, safety linting

### Change Data Capture
- [CDC Fundamentals](change-data-capture/cdc-fundamentals.md) — Log-based CDC, outbox pattern, change event schema, CDC vs polling
- [Debezium & Pipelines](change-data-capture/debezium-pipelines.md) — Debezium connectors, Kafka integration, monitoring, schema evolution

### Monitoring & Observability
- [Metrics & Dashboards](monitoring/metrics-dashboards.md) — Key metrics, pg_stat_statements, Prometheus + Grafana, alerting rules
- [Query Analysis](monitoring/query-analysis.md) — Slow query identification, profiling, automated detection, optimization workflow

### Data Pipelines
- [ETL Patterns](data-pipelines/etl-patterns.md) — ETL vs ELT, extraction methods, dbt transformations, data quality
- [Tools & Orchestration](data-pipelines/tools-orchestration.md) — Airbyte, Fivetran, Airflow, Dagster, dbt, tool comparison

### Operations
- [Maintenance & Upgrades](operations/maintenance-upgrades.md) — VACUUM, autovacuum, REINDEX, XID wraparound, pg_upgrade, maintenance schedule
- [Kubernetes Operators](operations/kubernetes-operators.md) — CloudNativePG, Percona Operator, Zalando, day-2 operations

### Selection
- [Database Selection Guide](selection-guide.md) — Decision framework, paradigm comparison, use case mapping, PostgreSQL as default

## Cross-References

| Topic | Related Sections |
|-------|-----------------|
| Caching patterns | [06-backend/caching](../06-backend/caching/) |
| ORM usage in APIs | [06-backend/api-design](../06-backend/api-design/) |
| Database security | [06-backend/authentication-authorization](../06-backend/authentication-authorization/) |
| Background jobs with DB | [06-backend/background-jobs](../06-backend/background-jobs/) |
| Search integration | [06-backend/search](../06-backend/search/) |
