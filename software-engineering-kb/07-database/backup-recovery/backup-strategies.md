# Database Backup Strategies

> **Domain:** Database > Backup & Recovery > Strategies
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Database backups are the last line of defense against data loss. Hardware failures, software bugs, human errors (accidental DELETE without WHERE), ransomware, and natural disasters can destroy your primary database and all its replicas. Replication is NOT a backup — a corrupted write replicates to all replicas instantly. A dropped table propagates to every replica. Only backups with proper retention allow you to recover data to a point before the disaster. The cost of implementing backups is trivial; the cost of losing data without backups is catastrophic — often business-ending.

---

## How It Works

### Backup Types

```
Backup Taxonomy:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  1. Logical Backup (pg_dump, mysqldump)               │
│     • Exports SQL statements (CREATE TABLE, INSERT)   │
│     • Human-readable, portable across versions        │
│     • Slow for large databases (table lock or MVCC)   │
│     • Size: often larger than physical                 │
│     • Restore: replay SQL (slow, table at a time)    │
│                                                        │
│  2. Physical Backup (pg_basebackup, file copy)        │
│     • Copies raw data files + WAL                     │
│     • Fast (disk-level copy)                          │
│     • Not portable across major versions              │
│     • Size: exact copy of database files              │
│     • Restore: copy files back (fast, full cluster)  │
│                                                        │
│  3. Continuous Archiving (WAL archiving + PITR)       │
│     • Base backup + continuous WAL archive            │
│     • Restore to any point in time (second precision) │
│     • RPO: near-zero (last WAL segment, ~minutes)    │
│     • Used by: pgBackRest, Barman, WAL-G             │
│                                                        │
│  4. Snapshot Backup (cloud/storage level)              │
│     • EBS snapshot, ZFS snapshot, LVM snapshot         │
│     • Near-instant (copy-on-write)                    │
│     • Cloud-native (AWS, GCP, Azure)                  │
│     • RPO: time between snapshots                     │
└──────────────────────────────────────────────────────┘
```

### Backup Comparison

| Feature | Logical | Physical | PITR | Snapshot |
|---------|---------|----------|------|----------|
| **Speed (backup)** | Slow | Fast | Fast (base) | Instant |
| **Speed (restore)** | Very slow | Fast | Medium | Fast |
| **Granularity** | Table-level | Full cluster | Point-in-time | Full volume |
| **Cross-version** | Yes | No | No | N/A |
| **Cross-platform** | Yes | No | No | No |
| **Size** | Variable | 1:1 | 1:1 + WAL | 1:1 (dedup) |
| **Partial restore** | Yes (single table) | No | No | No |
| **RPO** | Schedule-based | Schedule-based | Minutes | Schedule-based |

---

### PostgreSQL Backup Methods

```bash
# 1. Logical Backup (pg_dump)
# Single database
pg_dump -Fc -Z 5 -j 4 -d mydb -f /backup/mydb.dump
# -Fc: custom format (compressed, parallel restore)
# -Z 5: compression level (0-9)
# -j 4: parallel jobs for dump
# Restore:
pg_restore -j 4 -d mydb /backup/mydb.dump

# All databases
pg_dumpall -f /backup/all_databases.sql
# Restore:
psql -f /backup/all_databases.sql

# Single table
pg_dump -Fc -t orders -d mydb -f /backup/orders.dump

# 2. Physical Backup (pg_basebackup)
pg_basebackup -D /backup/base -Ft -z -P -U replicator -h primary
# -Ft: tar format
# -z: gzip compression
# -P: progress reporting
# Produces: base.tar.gz + pg_wal.tar.gz

# 3. PITR with pgBackRest (recommended for production)
# See pgBackRest section below
```

```yaml
# pgBackRest: enterprise PostgreSQL backup
# /etc/pgbackrest/pgbackrest.conf

[global]
repo1-type=s3
repo1-s3-bucket=my-pg-backups
repo1-s3-region=us-east-1
repo1-s3-endpoint=s3.amazonaws.com
repo1-path=/pgbackrest
repo1-retention-full=4          # keep 4 full backups
repo1-retention-diff=14         # keep 14 differential backups
repo1-cipher-type=aes-256-cbc   # encrypt backups
repo1-cipher-pass=encryption-key

[mydb]
pg1-path=/var/lib/postgresql/16/main
pg1-port=5432

# postgresql.conf settings needed:
# archive_mode = on
# archive_command = 'pgbackrest --stanza=mydb archive-push %p'
# wal_level = replica
```

```bash
# pgBackRest operations

# Initialize stanza (one-time)
pgbackrest --stanza=mydb stanza-create

# Full backup (weekly)
pgbackrest --stanza=mydb --type=full backup

# Differential backup (daily — only changes since last full)
pgbackrest --stanza=mydb --type=diff backup

# Incremental backup (hourly — only changes since last backup)
pgbackrest --stanza=mydb --type=incr backup

# List backups
pgbackrest --stanza=mydb info

# Restore to latest
pgbackrest --stanza=mydb --delta restore

# Point-in-time recovery
pgbackrest --stanza=mydb --type=time \
  --target="2024-06-15 14:30:00" \
  --target-action=promote restore

# Restore single database from backup
pgbackrest --stanza=mydb --db-include=mydb restore
```

---

### MySQL Backup Methods

```bash
# 1. Logical Backup (mysqldump)
mysqldump --single-transaction --routines --triggers \
  --set-gtid-purged=ON \
  -u root -p mydb > /backup/mydb.sql

# All databases
mysqldump --single-transaction --all-databases \
  --routines --triggers \
  -u root -p > /backup/all.sql

# 2. Physical Backup (Percona XtraBackup — recommended)
# Full backup
xtrabackup --backup --target-dir=/backup/full \
  --user=root --password=pass

# Incremental backup
xtrabackup --backup --target-dir=/backup/incr1 \
  --incremental-basedir=/backup/full \
  --user=root --password=pass

# Prepare backup for restore
xtrabackup --prepare --target-dir=/backup/full
xtrabackup --prepare --target-dir=/backup/full \
  --incremental-dir=/backup/incr1

# Restore
xtrabackup --copy-back --target-dir=/backup/full

# 3. mysqlsh (MySQL Shell dump — parallel, compressed)
mysqlsh -- util dump-instance /backup/full \
  --threads=4 --compression=zstd
```

---

### Backup Schedule & Retention

```
Recommended Backup Schedule:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Continuous: WAL archiving (every WAL segment, ~16MB) │
│  Every 1h:  Incremental backup                        │
│  Every day:  Differential backup                      │
│  Every week: Full backup                              │
│                                                        │
│  Retention:                                            │
│  ┌─────────────────────────────────────────────┐      │
│  │ 4 weekly full backups (1 month)              │      │
│  │ 14 daily differential backups                │      │
│  │ 24 hourly incremental backups                │      │
│  │ WAL archive: 30 days                         │      │
│  └─────────────────────────────────────────────┘      │
│                                                        │
│  Storage estimate (100 GB database):                  │
│  Full: 4 × 100 GB (compressed ~30 GB) = 120 GB       │
│  Diff: 14 × ~10 GB = 140 GB                          │
│  Incr: 24 × ~2 GB = 48 GB                            │
│  WAL: 30 days × ~5 GB/day = 150 GB                   │
│  Total: ~460 GB in S3 (~$10/month)                    │
└──────────────────────────────────────────────────────┘
```

---

### Backup Automation

```typescript
// TypeScript — Backup monitoring (check backup freshness)
interface BackupStatus {
  lastFull: Date;
  lastDiff: Date;
  lastIncr: Date;
  lastWAL: Date;
  sizeGB: number;
}

function checkBackupHealth(status: BackupStatus): string[] {
  const alerts: string[] = [];
  const now = new Date();

  const hoursSince = (d: Date) => (now.getTime() - d.getTime()) / 3600000;

  if (hoursSince(status.lastFull) > 7 * 24 + 2) {
    alerts.push('CRITICAL: No full backup in > 7 days');
  }
  if (hoursSince(status.lastDiff) > 24 + 2) {
    alerts.push('WARNING: No differential backup in > 24 hours');
  }
  if (hoursSince(status.lastIncr) > 2) {
    alerts.push('WARNING: No incremental backup in > 2 hours');
  }
  if (hoursSince(status.lastWAL) > 0.5) {
    alerts.push('CRITICAL: WAL archiving may be stalled (> 30 min)');
  }

  return alerts;
}
```

---

### Cloud-Native Backups

| Cloud | Service | Automated | PITR | Retention | Cross-Region |
|-------|---------|-----------|------|-----------|-------------|
| **AWS RDS** | Automated Backups | Yes | 5-min granularity | 0-35 days | Manual snapshot copy |
| **AWS Aurora** | Continuous Backup | Yes | 5-min granularity | 1-35 days | Global DB |
| **GCP Cloud SQL** | Automated Backups | Yes | Seconds | 7-365 days | Cross-region replicas |
| **Azure SQL** | Automated Backups | Yes | 5-min granularity | 7-35 days | Geo-redundant |
| **Supabase** | Daily Backups | Yes | Pro: PITR | 7-30 days | No |
| **Neon** | Continuous | Yes | Instant branching | 7-30 days | Yes |

---

## Best Practices

1. **ALWAYS have automated backups** — manual backups are forgotten backups
2. **ALWAYS test restores regularly** — untested backups are not backups
3. **ALWAYS store backups off-site** — same datacenter fire destroys primary + backup
4. **ALWAYS encrypt backups** — backup files contain all your data
5. **ALWAYS use pgBackRest/XtraBackup** for production — not just pg_dump/mysqldump
6. **ALWAYS configure PITR** (WAL archiving) — recover to any second, not just last backup
7. **ALWAYS monitor backup freshness** — alert if backup is older than expected
8. **NEVER rely on replication as backup** — corruption and deletes replicate instantly
9. **NEVER store backups on the same disk** — disk failure loses data + backup
10. **NEVER skip backup encryption** — S3 bucket with unencrypted DB dump = data breach

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No backups at all | Total data loss on any failure | Implement automated backups immediately |
| Replication as backup | DROP TABLE propagates to replicas | Separate backup system (pgBackRest) |
| Backups on same disk | Disk failure = lose data + backup | S3, GCS, or different storage |
| No restore testing | Restore fails when needed | Monthly restore drill |
| Unencrypted backups | Data breach via backup access | Encrypt with AES-256 |
| Only pg_dump (logical) | Slow restore, no PITR | Use physical backup + WAL archiving |
| No backup monitoring | Backups silently failing | Alert on backup age and size |
| No retention policy | Storage grows indefinitely | Define retention (4 weekly, 14 daily) |
| No cross-region backup | Regional outage loses backups | Copy to different region |
| pg_dump with --no-owner | Permission loss on restore | Always preserve ownership |

---

## Real-world Examples

### GitLab
- pgBackRest for PostgreSQL backup to object storage
- Hourly incremental, daily differential, weekly full
- Documented PITR procedures in runbook

### Stripe
- Continuous WAL archiving for zero-RPO
- Cross-region backup replication
- Regular restore testing as part of DR drills

### Basecamp (37signals)
- Daily encrypted backups to S3
- Cross-region backup copies
- Periodic restore verification

---

## Enforcement Checklist

- [ ] Automated backup schedule configured (full + diff/incr)
- [ ] WAL archiving enabled for PITR capability
- [ ] Backups stored off-site (S3/GCS, different region)
- [ ] Backup encryption enabled (AES-256)
- [ ] Restore tested monthly (full restore drill)
- [ ] Backup monitoring with alerting on freshness
- [ ] Retention policy defined and enforced
- [ ] Cross-region backup copy configured
- [ ] Backup includes all databases, roles, and configurations
- [ ] RPO validated (backup frequency matches requirement)
