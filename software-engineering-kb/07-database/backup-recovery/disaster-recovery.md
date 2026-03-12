# Database Disaster Recovery

> **Domain:** Database > Backup & Recovery > Disaster Recovery
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Disaster recovery (DR) is the set of procedures and infrastructure that restore database operations after a catastrophic failure — hardware destruction, datacenter outage, regional cloud failure, ransomware, or critical human error. The difference between a company that survives a disaster and one that doesn't is having a tested DR plan with defined RPO (how much data you can afford to lose) and RTO (how long you can afford to be down). DR is not optional for production systems — it is a business continuity requirement that must be designed, implemented, and tested regularly.

---

## How It Works

### RPO and RTO

```
RPO (Recovery Point Objective):
  Maximum acceptable data loss measured in time
  "We can tolerate losing the last X minutes of data"

RTO (Recovery Time Objective):
  Maximum acceptable downtime measured in time
  "We must be back online within X minutes"

┌──────────────────────────────────────────────────────┐
│                                                        │
│  ───────────────────────────────────────────────────  │
│  ^                    ^              ^                 │
│  Last backup         Disaster       Recovery           │
│  or sync point       occurs         complete           │
│                                                        │
│  |←──── RPO ────────→|←──── RTO ───→|                │
│  (data loss window)   (downtime)                      │
│                                                        │
│  Tier  │ RPO          │ RTO          │ Cost           │
│  ──────┼──────────────┼──────────────┼────────        │
│  1     │ 0 (zero)     │ < 1 min      │ $$$$$          │
│  2     │ < 5 min      │ < 15 min     │ $$$$           │
│  3     │ < 1 hour     │ < 1 hour     │ $$$            │
│  4     │ < 4 hours    │ < 4 hours    │ $$             │
│  5     │ < 24 hours   │ < 24 hours   │ $              │
└──────────────────────────────────────────────────────┘
```

### DR Architecture Tiers

```
Tier 1: Active-Active (RPO=0, RTO<1min)
┌─────────────┐         ┌─────────────┐
│ Region A    │◄──sync──►│ Region B    │
│ (active)    │         │ (active)    │
│ CockroachDB │         │ CockroachDB │
└─────────────┘         └─────────────┘
Cost: 2x infrastructure + distributed SQL license
Use: Financial services, healthcare, e-commerce

Tier 2: Hot Standby (RPO<5min, RTO<15min)
┌─────────────┐  async   ┌─────────────┐
│ Primary     │────repl──►│ Hot Standby │
│ (active)    │          │ (read-only, │
│             │          │  auto-failover)│
└─────────────┘          └─────────────┘
Cost: 2x compute, replication overhead
Use: SaaS, APIs, most production systems

Tier 3: Warm Standby (RPO<1hr, RTO<1hr)
┌─────────────┐  WAL     ┌─────────────┐
│ Primary     │──archive─►│ Warm Standby│
│ (active)    │          │ (delayed    │
│             │          │  replay)    │
└─────────────┘          └─────────────┘
Cost: 1.5x compute, storage for WAL
Use: Internal tools, staging, cost-sensitive

Tier 4: Backup Restore (RPO<4hr, RTO<4hr)
┌─────────────┐  backup  ┌─────────────┐
│ Primary     │──to S3──►│ (restore on │
│ (active)    │          │  demand)    │
└─────────────┘          └─────────────┘
Cost: backup storage only
Use: Development, non-critical systems
```

---

### DR Scenarios & Response

```
Scenario Matrix:
┌─────────────────────┬──────────────────┬─────────────────┐
│ Scenario            │ Impact            │ Recovery Method  │
├─────────────────────┼──────────────────┼─────────────────┤
│ Single disk failure │ Data inaccessible │ RAID rebuild or  │
│                     │                  │ replica failover │
├─────────────────────┼──────────────────┼─────────────────┤
│ Server crash        │ DB down          │ Replica promote  │
│                     │                  │ (automated)      │
├─────────────────────┼──────────────────┼─────────────────┤
│ AZ failure (cloud)  │ Primary down     │ Multi-AZ failover│
│                     │                  │ (automatic)      │
├─────────────────────┼──────────────────┼─────────────────┤
│ Region failure      │ All AZs down     │ Cross-region DR  │
│                     │                  │ (manual/auto)    │
├─────────────────────┼──────────────────┼─────────────────┤
│ Accidental DELETE   │ Data corruption  │ PITR to before   │
│ or DROP TABLE       │ replicated       │ the mistake      │
├─────────────────────┼──────────────────┼─────────────────┤
│ Ransomware          │ Data encrypted   │ Restore from     │
│                     │ by attacker      │ offline backup   │
├─────────────────────┼──────────────────┼─────────────────┤
│ Schema migration    │ Data corruption  │ PITR to before   │
│ gone wrong          │ or loss          │ migration        │
└─────────────────────┴──────────────────┴─────────────────┘
```

---

### DR Runbook Template

```
DR Runbook: Database Recovery Procedure
═══════════════════════════════════════

1. ASSESS
   □ Identify the failure type (server, AZ, region, data)
   □ Determine RPO/RTO requirements for affected services
   □ Notify incident commander and stakeholders
   □ Start incident timeline log

2. DECIDE
   □ Choose recovery method:
     • Automated failover (if available and triggered)
     • Manual replica promotion
     • PITR from backup
     • Full restore from backup
   □ Estimate recovery time
   □ Communicate ETA to stakeholders

3. EXECUTE
   For Replica Promotion:
   □ Verify replica is caught up (check replication lag)
   □ Promote replica: pg_ctl promote / STOP SLAVE; RESET SLAVE ALL;
   □ Update DNS / connection strings
   □ Verify application connectivity
   □ Monitor for errors

   For PITR:
   □ Identify target recovery time (before the incident)
   □ Provision recovery server
   □ Restore base backup
   □ Configure recovery target time
   □ Start database, wait for WAL replay
   □ Verify data integrity
   □ Switch application to recovered database

4. VERIFY
   □ Run data integrity checks
   □ Verify application functionality (smoke tests)
   □ Check for data loss (compare with expected state)
   □ Monitor error rates and latency

5. POST-INCIDENT
   □ Document root cause
   □ Document data loss (if any)
   □ Update DR procedures based on lessons
   □ Schedule DR drill to test improvements
```

---

### Delayed Replicas

```
Delayed Replica: intentionally lagging replica for
human error recovery

┌─────────────┐  real-time  ┌──────────────┐
│ Primary     │────repl────►│ Replica 1    │ (real-time)
│             │             └──────────────┘
│             │  delayed    ┌──────────────┐
│             │────repl────►│ Replica 2    │ (4 hours behind)
└─────────────┘             └──────────────┘

If someone runs: DROP TABLE users;
  → Replica 1: table dropped (replicated instantly)
  → Replica 2: table still exists (4 hours behind)
  → Recovery: promote delayed replica or copy table

PostgreSQL:
  recovery_min_apply_delay = '4h'

MySQL:
  CHANGE REPLICATION SOURCE TO SOURCE_DELAY = 14400;  -- 4h in seconds

Operational pattern:
  • 1 real-time replica for HA/reads
  • 1 delayed replica (4-6 hours) for human error
  • Combined: protects against both crashes AND mistakes
```

---

### DR Testing

```
DR Testing Schedule:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Monthly:                                              │
│  □ Restore backup to test environment                 │
│  □ Verify data integrity after restore                │
│  □ Measure actual RTO vs target                       │
│  □ Verify application can connect to restored DB      │
│                                                        │
│  Quarterly:                                            │
│  □ Full failover drill (promote replica)              │
│  □ DNS failover test                                  │
│  □ Cross-region failover (if applicable)              │
│  □ Measure actual RPO (check data loss)               │
│                                                        │
│  Annually:                                             │
│  □ Full disaster simulation (region failure)          │
│  □ Complete DR procedure from scratch                 │
│  □ Update runbook with findings                       │
│  □ Train new team members on DR procedures            │
│                                                        │
│  After Every Change:                                   │
│  □ Major schema migration: verify backup/restore      │
│  □ Infrastructure change: verify replication           │
│  □ New database: add to backup + DR plan              │
└──────────────────────────────────────────────────────┘
```

```bash
# Automated DR test script (PostgreSQL)
#!/bin/bash
set -euo pipefail

STANZA="mydb"
RESTORE_DIR="/tmp/dr-test"
TARGET_TIME="$(date -d '1 hour ago' --iso-8601=seconds)"

echo "=== DR Test: $(date) ==="

# Step 1: Restore from backup
echo "Restoring to $TARGET_TIME..."
pgbackrest --stanza=$STANZA \
  --type=time \
  --target="$TARGET_TIME" \
  --target-action=promote \
  --pg1-path=$RESTORE_DIR \
  restore

# Step 2: Start restored instance on different port
pg_ctl -D $RESTORE_DIR -o "-p 5433" start -w

# Step 3: Run integrity checks
psql -p 5433 -d mydb -c "SELECT count(*) FROM users;"
psql -p 5433 -d mydb -c "SELECT count(*) FROM orders;"

# Step 4: Verify no corruption
psql -p 5433 -d mydb -c "SELECT datname, datallowconn FROM pg_database;"

# Step 5: Cleanup
pg_ctl -D $RESTORE_DIR stop -w
rm -rf $RESTORE_DIR

echo "=== DR Test PASSED ==="
```

---

### Managed DR Solutions

| Provider | Feature | RPO | RTO | Config |
|----------|---------|-----|-----|--------|
| **AWS RDS Multi-AZ** | Synchronous standby | 0 | 1-2 min | Enable Multi-AZ |
| **AWS Aurora** | 6 copies across 3 AZs | 0 | < 30s | Default |
| **AWS Aurora Global** | Cross-region | < 1s | < 1 min | Add secondary region |
| **GCP Cloud SQL HA** | Regional instance | 0 | < 60s | Enable HA |
| **Azure SQL** | Active geo-replication | < 5s | < 30s | Add geo-replica |
| **CockroachDB** | Survive region failure | 0 | < 15s | 3+ regions |

---

## Best Practices

1. **ALWAYS define RPO and RTO** before designing DR — they determine architecture and cost
2. **ALWAYS test DR procedures regularly** — untested DR plans fail when needed
3. **ALWAYS maintain a delayed replica** — protection against human error (DROP TABLE)
4. **ALWAYS store backups in a different region** — regional outage loses co-located backups
5. **ALWAYS automate failover** for Tier 1-2 systems — manual failover is too slow
6. **ALWAYS document DR procedures** in a runbook — incident is not the time to figure it out
7. **ALWAYS include application connectivity** in DR tests — database up but app can't connect = still down
8. **NEVER assume replication = DR** — corruption and deletes replicate instantly
9. **NEVER skip DR testing** — the first time you test DR should not be during an actual disaster
10. **NEVER store DR runbook only in the affected system** — runbook on the server that's down = useless

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No DR plan at all | Total loss on disaster | Define RPO/RTO, implement DR |
| Replication assumed as DR | DROP TABLE propagates | Backups + delayed replica |
| No DR testing | DR fails during actual disaster | Monthly restore, quarterly failover |
| DR runbook on the failed server | Can't access procedures | Store runbook externally (wiki, Notion) |
| Same-region backups only | Regional outage loses backups | Cross-region backup copies |
| Manual failover for critical systems | Minutes-to-hours of downtime | Automated failover (Patroni) |
| No delayed replica | Accidental deletion unrecoverable | 4-6 hour delayed replica |
| RPO/RTO undefined | Unknown recovery expectations | Define with business stakeholders |
| DR procedures outdated | Procedures reference old infrastructure | Review after every infrastructure change |
| No post-incident review | Same failure mode repeats | Post-mortem + runbook update |

---

## Real-world Examples

### GitLab (2017 Database Incident)
- Accidental deletion of production PostgreSQL database
- 5 of 5 backup methods had issues
- 6 hours of data lost, 18 hours of downtime
- Led to comprehensive DR overhaul and public transparency

### GitHub (2018 MySQL Incident)
- Network partition caused stale reads
- Orchestrator promoted wrong replica
- 24 hours to restore consistency
- Led to improved failover validation

### Amazon S3 (2017 us-east-1 Outage)
- Human error took down S3 in us-east-1
- Cascading failures across AWS services
- Demonstrated importance of multi-region DR

---

## Enforcement Checklist

- [ ] RPO and RTO defined for every production database
- [ ] DR architecture tier matches RPO/RTO requirements
- [ ] Backups stored in different region from primary
- [ ] Delayed replica configured (4-6 hours) for human error recovery
- [ ] Automated failover configured for Tier 1-2 systems
- [ ] DR runbook documented and accessible externally
- [ ] Monthly backup restore test performed
- [ ] Quarterly failover drill performed
- [ ] Annual full disaster simulation performed
- [ ] Post-incident reviews update DR procedures
- [ ] Application connectivity included in DR testing
- [ ] DR plan reviewed after every infrastructure change
