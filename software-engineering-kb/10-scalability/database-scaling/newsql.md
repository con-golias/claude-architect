# NewSQL and Distributed SQL

| Field        | Value                                                                  |
|--------------|------------------------------------------------------------------------|
| Domain       | Scalability > Database Scaling                                         |
| Importance   | High                                                                   |
| Applies To   | Globally distributed systems, high-write workloads needing ACID        |
| Cross-ref    | `07-database/distributed-databases/newsql-overview.md`                 |
| Last Updated | 2026-03-10                                                             |

---

## Core Concepts

### When Traditional SQL Stops Scaling

Adopt distributed SQL when the workload hits one or more of these walls and traditional
sharding or read replicas no longer suffice.

| Scaling Wall                      | Symptom                                        | Why NewSQL Helps                              |
|-----------------------------------|------------------------------------------------|-----------------------------------------------|
| Single-node write throughput      | Primary CPU/IOPS saturated                     | Distributes writes across multiple nodes      |
| Cross-shard transactions          | Application-level 2PC is fragile and slow      | Native distributed transactions with ACID     |
| Global latency                    | Users far from the single-region DB            | Data placement near users with zone configs   |
| Operational sharding complexity   | Shard-key redesign, rebalancing, custom routing| Automatic range-based sharding and rebalancing|

### NewSQL Comparison

| Feature                  | CockroachDB            | TiDB                    | YugabyteDB             | Spanner (GCP)          |
|--------------------------|------------------------|-------------------------|------------------------|------------------------|
| SQL Compatibility        | PostgreSQL wire        | MySQL wire              | PostgreSQL wire        | Proprietary + PG       |
| Consensus Protocol       | Raft                   | Raft                    | Raft                   | Paxos (TrueTime)       |
| Automatic Sharding       | Yes (ranges)           | Yes (regions)           | Yes (tablets)          | Yes (splits)           |
| Geo-Partitioning         | Zone configs           | Placement rules         | Tablespaces            | Instance configs       |
| Open Source               | Yes (BSL core)         | Yes (Apache 2.0)        | Yes (Apache 2.0)       | No (managed only)      |
| Managed Offering         | CockroachDB Cloud      | TiDB Cloud              | YugabyteDB Managed    | Cloud Spanner          |
| Ideal For                | Multi-region OLTP      | MySQL-compatible HTAP   | PG-compatible OLTP     | Global consistency     |

### Distributed Transactions: How NewSQL Achieves ACID at Scale

NewSQL databases use consensus protocols (Raft, Paxos) to replicate transaction logs across
nodes. Each transaction commits only when a quorum of replicas acknowledges the write.

Key mechanisms:
- **Range-based sharding** -- data is split into ranges (or tablets) distributed across nodes.
- **Leaseholder / leader** -- one node per range serves reads and proposes writes.
- **Distributed commit** -- cross-range transactions use parallel consensus or 2PC coordinated
  by the database engine, not the application.
- **MVCC timestamps** -- every row version carries a timestamp for snapshot isolation.

### Data Placement and Locality

Control where data lives to satisfy latency and compliance requirements.

| Strategy               | Effect                                              | Use When                                    |
|------------------------|-----------------------------------------------------|---------------------------------------------|
| Regional Tables        | Pin all replicas of a table to one region            | Data sovereignty, low-latency single-region |
| Global Tables          | Replicate table to every region (read-only locally)  | Reference data read everywhere              |
| Row-Level Geo-Partition| Route rows to regions based on a column value        | Multi-tenant with per-tenant region affinity|

---

## Code Examples

### SQL: CockroachDB Zone Configuration

```sql
-- Pin the 'orders' table to the us-east region for data sovereignty.
ALTER TABLE orders CONFIGURE ZONE USING
    constraints = '[+region=us-east]',
    num_replicas = 5,
    lease_preferences = '[[+region=us-east]]';

-- Create a geo-partitioned table by region column.
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region STRING NOT NULL,
    email STRING NOT NULL,
    data JSONB
) PARTITION BY LIST (region) (
    PARTITION us_east VALUES IN ('us-east'),
    PARTITION eu_west VALUES IN ('eu-west'),
    PARTITION ap_south VALUES IN ('ap-south')
);

ALTER PARTITION us_east OF TABLE user_profiles
    CONFIGURE ZONE USING constraints = '[+region=us-east]';
ALTER PARTITION eu_west OF TABLE user_profiles
    CONFIGURE ZONE USING constraints = '[+region=eu-west]';
ALTER PARTITION ap_south OF TABLE user_profiles
    CONFIGURE ZONE USING constraints = '[+region=ap-south]';
```

### SQL: TiDB Placement Rules

```sql
-- Create a placement policy for the EU region.
CREATE PLACEMENT POLICY eu_only
    PRIMARY_REGION = "eu-west"
    REGIONS = "eu-west,eu-central"
    FOLLOWERS = 2;

-- Apply the policy to a table.
ALTER TABLE gdpr_sensitive_data PLACEMENT POLICY = eu_only;

-- Verify current placement.
SHOW PLACEMENT FOR TABLE gdpr_sensitive_data;
```

### Go: CockroachDB Client with Retry Logic for Distributed Transactions

```go
package main

import (
    "context"
    "database/sql"
    "fmt"
    "log"

    "github.com/cockroachdb/cockroach-go/v2/crdb"
    _ "github.com/lib/pq"
)

func main() {
    db, err := sql.Open("postgres",
        "postgresql://root@localhost:26257/shop?sslmode=disable")
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    // Transfer funds with automatic retry on serialization errors.
    err = transferFunds(context.Background(), db, "acct-a", "acct-b", 500)
    if err != nil {
        log.Fatalf("transfer failed: %v", err)
    }
}

func transferFunds(ctx context.Context, db *sql.DB, from, to string, amount int) error {
    // crdb.ExecuteTx handles transaction retries transparently.
    return crdb.ExecuteTx(ctx, db, nil, func(tx *sql.Tx) error {
        var balance int
        if err := tx.QueryRowContext(ctx,
            "SELECT balance FROM accounts WHERE id = $1", from,
        ).Scan(&balance); err != nil {
            return fmt.Errorf("read sender balance: %w", err)
        }
        if balance < amount {
            return fmt.Errorf("insufficient funds: have %d, need %d", balance, amount)
        }

        if _, err := tx.ExecContext(ctx,
            "UPDATE accounts SET balance = balance - $1 WHERE id = $2",
            amount, from,
        ); err != nil {
            return fmt.Errorf("debit sender: %w", err)
        }

        if _, err := tx.ExecContext(ctx,
            "UPDATE accounts SET balance = balance + $1 WHERE id = $2",
            amount, to,
        ); err != nil {
            return fmt.Errorf("credit receiver: %w", err)
        }
        return nil
    })
}
```

### Python: Migration Compatibility Check (PostgreSQL to CockroachDB)

```python
"""
Pre-migration validator: scan a PostgreSQL schema dump for constructs
that are unsupported or behave differently in CockroachDB.
"""
import re
import sys
from dataclasses import dataclass

INCOMPATIBLE_PATTERNS: list[tuple[str, str]] = [
    (r"CREATE\s+TRIGGER", "Triggers are not supported; move logic to application layer."),
    (r"INHERITS\s*\(", "Table inheritance is not supported; use explicit tables."),
    (r"CREATE\s+EXTENSION", "Verify extension availability in CockroachDB docs."),
    (r"DEFERRABLE\s+INITIALLY\s+DEFERRED", "Deferrable constraints behave differently."),
    (r"LISTEN|NOTIFY", "LISTEN/NOTIFY is not supported; use changefeeds instead."),
    (r"SERIAL\b", "Use UUID or INT DEFAULT unique_rowid() instead of SERIAL."),
]

@dataclass
class Finding:
    line_no: int
    pattern_desc: str
    line_text: str

def scan_schema(path: str) -> list[Finding]:
    findings: list[Finding] = []
    with open(path) as f:
        for i, line in enumerate(f, start=1):
            for pattern, desc in INCOMPATIBLE_PATTERNS:
                if re.search(pattern, line, re.IGNORECASE):
                    findings.append(Finding(line_no=i, pattern_desc=desc, line_text=line.strip()))
    return findings

if __name__ == "__main__":
    results = scan_schema(sys.argv[1])
    for f in results:
        print(f"L{f.line_no}: {f.pattern_desc}\n  -> {f.line_text}")
    if results:
        print(f"\n{len(results)} compatibility issue(s) found.")
        sys.exit(1)
    print("No known incompatibilities detected.")
```

---

## Cost-Performance Trade-offs: NewSQL vs Traditional Sharding

| Dimension                | NewSQL / Distributed SQL                   | Traditional Application-Level Sharding     |
|--------------------------|--------------------------------------------|--------------------------------------------|
| Operational overhead     | Lower (DB handles rebalancing, splits)     | Higher (custom shard management code)      |
| Infrastructure cost      | Higher (3-node minimum, consensus overhead)| Lower (single-node instances per shard)    |
| Cross-shard transactions | Native ACID                                | Requires application-level 2PC or sagas    |
| Latency per query        | Higher (consensus round-trip)              | Lower (single-node queries within shard)   |
| Schema evolution         | Standard ALTER TABLE                       | Must coordinate across all shards          |
| Team skill requirement   | Standard SQL + distributed systems tuning  | Deep sharding expertise + custom tooling   |

---

## 10 Best Practices

1. **Validate SQL compatibility before migrating.** Run the full application test suite against the target NewSQL database in CI before committing to migration.
2. **Use the database's built-in retry mechanism.** Distributed transactions encounter serialization retries; wrap every transaction in a retry loop provided by the client library.
3. **Design primary keys for distribution.** Use UUIDs or hash-prefixed keys to avoid hotspots; never use monotonically increasing integers as primary keys.
4. **Configure data placement from day one.** Define zone configurations or placement policies during schema creation, not after data grows.
5. **Start with a 3-region deployment only if needed.** A single-region, multi-AZ deployment provides HA without cross-region latency until global reach is required.
6. **Benchmark with production-like data volumes.** Distributed SQL performance characteristics differ from single-node PostgreSQL; synthetic benchmarks mislead.
7. **Monitor per-range metrics.** Track hot ranges, leaseholder distribution, and inter-node latency to detect imbalances early.
8. **Keep transactions short.** Long-running transactions increase contention and retry rates in consensus-based systems.
9. **Plan the migration incrementally.** Use dual-write or shadow-read patterns to validate correctness before cutting over.
10. **Budget for 3x the node count of a single-node equivalent.** Consensus replication and fault tolerance require more nodes; factor this into capacity planning.

---

## 8 Anti-Patterns

| #  | Anti-Pattern                             | Problem                                                    | Correct Approach                                           |
|----|------------------------------------------|------------------------------------------------------------|------------------------------------------------------------|
| 1  | Auto-increment primary keys              | All inserts land on the same range leader; write hotspot   | Use UUIDs or hash-sharded indexes                          |
| 2  | Ignoring transaction retries             | Serialization errors surface as intermittent 500s          | Wrap all transactions in the client library's retry loop   |
| 3  | Treating it as a drop-in PostgreSQL      | Unsupported features (triggers, extensions) break at runtime| Run compatibility scan and integration tests pre-migration |
| 4  | Single-region deployment for global users| Cross-continent latency negates the benefit of distributed SQL| Configure geo-partitioning to place data near users       |
| 5  | Oversized transactions                   | Lock contention, high retry rates, increased tail latency  | Break large mutations into batches of <= 1000 rows         |
| 6  | No placement policy for regulated data   | Data stored in non-compliant regions violates regulations  | Define placement policies pinning data to compliant regions|
| 7  | Skipping capacity testing                | Production load reveals hotspots not seen in dev           | Load-test with realistic data distribution and query mix   |
| 8  | Migrating everything at once             | Big-bang migration risks data loss and extended downtime   | Migrate table-by-table with dual-write verification        |

---

## Enforcement Checklist

- [ ] SQL compatibility scan passes with zero blocking issues against target NewSQL engine
- [ ] All application transactions use the client library's retry/backoff wrapper
- [ ] Primary keys use UUIDs or hash-sharded indexes; no auto-increment PKs exist
- [ ] Zone configuration or placement policies are defined for every table with compliance requirements
- [ ] Load tests with production-scale data complete within latency SLOs on the target cluster
- [ ] Monitoring dashboards cover per-range hotspots, leaseholder skew, and inter-node latency
- [ ] Migration plan documents a rollback procedure for every phase
- [ ] Dual-write or shadow-read validation runs for at least one release cycle before cutover
- [ ] Transaction duration is measured; p99 transaction time stays below 500 ms
- [ ] Cluster is sized to at least 3 nodes across distinct failure domains (AZs or racks)
- [ ] Schema changes are tested in a staging cluster before applying to production
- [ ] Cost model compares NewSQL total cost against traditional sharding for the projected 12-month workload
