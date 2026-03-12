# Kubernetes Database Operators

> **Domain:** Database > Operations > Kubernetes Operators
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Running databases on Kubernetes requires specialized operators that handle the complexity of stateful workloads — persistent storage, replication, failover, backups, scaling, and upgrades. Without an operator, managing PostgreSQL or MySQL on Kubernetes requires manual intervention for every operational task. Database operators automate day-2 operations: automated failover, point-in-time recovery, rolling upgrades, and connection pooling. Teams running databases on Kubernetes MUST use a mature operator — managing stateful workloads manually on Kubernetes is a recipe for data loss.

---

## How It Works

### Operator Architecture

```
Kubernetes Database Operator Pattern:
┌──────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                        │
│                                                            │
│  ┌───────────────────┐     ┌──────────────────────┐      │
│  │  Operator Pod      │     │  Custom Resource (CR) │      │
│  │  ┌──────────────┐ │     │                        │      │
│  │  │ Controller   │◄├─────┤  apiVersion: pgv2     │      │
│  │  │ (watches CRs)│ │     │  kind: PostgresCluster│      │
│  │  └──────┬───────┘ │     │  spec:                │      │
│  └─────────┼─────────┘     │    replicas: 3         │      │
│            │                │    storage: 100Gi      │      │
│            │ manages        │    version: 16         │      │
│            ▼                └──────────────────────┘      │
│  ┌─────────────────────────────────────────┐              │
│  │  Managed Database Pods                    │              │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ │              │
│  │  │ Primary   │ │ Replica  │ │ Replica  │ │              │
│  │  │ (R/W)     │ │ (R/O)    │ │ (R/O)    │ │              │
│  │  │ + PgBouncer│ │ + PgBouncer│ │ + PgBouncer│ │              │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ │              │
│  │       │             │             │        │              │
│  │  ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ │              │
│  │  │  PVC     │ │  PVC     │ │  PVC     │ │              │
│  │  │ 100Gi   │ │ 100Gi   │ │ 100Gi   │ │              │
│  │  └──────────┘ └──────────┘ └──────────┘ │              │
│  └─────────────────────────────────────────┘              │
│                                                            │
│  ┌─────────────────────────────────────────┐              │
│  │  Backup CronJob → S3/GCS                 │              │
│  └─────────────────────────────────────────┘              │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### PostgreSQL Operators Comparison

```
┌─────────────────┬──────────────┬──────────────┬──────────────┐
│ Feature          │ CloudNativePG│ Crunchy PGO  │ Zalando      │
│                  │ (CNPG)       │ (v5)         │ Postgres Op. │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ Maturity         │ High (CNCF)  │ Very High    │ High         │
│ License          │ Apache 2.0   │ Apache 2.0   │ MIT          │
│ HA / Failover    │ Automated    │ Automated    │ Patroni-based│
│ Backup (PITR)    │ Barman/S3    │ pgBackRest   │ WAL-G/S3     │
│ Connection Pool  │ PgBouncer    │ PgBouncer    │ Built-in     │
│ Monitoring       │ Prometheus   │ Prometheus   │ Prometheus   │
│ Rolling Upgrades │ Yes          │ Yes          │ Yes          │
│ Minor Upgrades   │ Automated    │ Automated    │ Automated    │
│ Major Upgrades   │ Manual       │ pg_upgrade   │ Clone        │
│ Declarative      │ Yes          │ Yes          │ Yes          │
│ Multi-cluster    │ Yes          │ Yes          │ Limited      │
│ Community        │ Active       │ Large        │ Active       │
│ Best for         │ Cloud-native │ Enterprise   │ Simple setups│
└─────────────────┴──────────────┴──────────────┴──────────────┘

Recommendation: CloudNativePG for new deployments (CNCF sandbox)
```

### CloudNativePG Example

```yaml
# CloudNativePG — PostgreSQL cluster definition
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: myapp-pg
  namespace: production
spec:
  instances: 3        # 1 primary + 2 replicas

  postgresql:
    parameters:
      shared_buffers: "1GB"
      effective_cache_size: "3GB"
      work_mem: "64MB"
      max_connections: "200"
      wal_level: "logical"
      max_wal_senders: "10"
      max_replication_slots: "10"
      shared_preload_libraries: "pg_stat_statements"

  imageName: ghcr.io/cloudnative-pg/postgresql:16.2

  storage:
    size: 100Gi
    storageClass: gp3-encrypted  # AWS EBS gp3

  resources:
    requests:
      memory: "4Gi"
      cpu: "2"
    limits:
      memory: "8Gi"
      cpu: "4"

  # Backup configuration
  backup:
    barmanObjectStore:
      destinationPath: s3://myapp-pg-backups/
      s3Credentials:
        accessKeyId:
          name: pg-backup-s3
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: pg-backup-s3
          key: SECRET_ACCESS_KEY
      wal:
        compression: gzip
        maxParallel: 4
    retentionPolicy: "30d"

  # Scheduled backups
  scheduledBackups:
    - name: daily-backup
      schedule: "0 2 * * *"  # 2 AM daily
      backupOwnerReference: self

  # Monitoring
  monitoring:
    enablePodMonitor: true
    customQueriesConfigMap:
      - name: pg-custom-metrics
        key: queries.yaml

  # Affinity — spread replicas across zones
  affinity:
    topologyKey: topology.kubernetes.io/zone

  # Connection pooling (PgBouncer)
  enablePgBouncer: true
  pgBouncer:
    poolMode: transaction
    defaultPoolSize: 20
    maxClientConn: 200

---
# Application connects to services:
# myapp-pg-rw    → primary (read-write)
# myapp-pg-ro    → replicas (read-only, load balanced)
# myapp-pg-r     → any instance (read-only)
```

### Percona Operator (MySQL)

```yaml
# Percona XtraDB Cluster Operator — MySQL HA
apiVersion: pxc.percona.com/v1
kind: PerconaXtraDBCluster
metadata:
  name: myapp-mysql
  namespace: production
spec:
  crVersion: '1.14.0'
  secretsName: myapp-mysql-secrets

  pxc:
    size: 3                    # 3-node Galera cluster
    image: percona/percona-xtradb-cluster:8.0.35
    resources:
      requests:
        memory: 4Gi
        cpu: 2
    volumeSpec:
      persistentVolumeClaim:
        storageClassName: gp3-encrypted
        resources:
          requests:
            storage: 100Gi
    configuration: |
      [mysqld]
      innodb_buffer_pool_size=2G
      max_connections=200

  haproxy:
    enabled: true
    size: 2
    image: percona/haproxy:2.8.5

  proxysql:
    enabled: false

  backup:
    image: percona/percona-xtradb-cluster-operator:1.14.0-pxc8.0-backup-pxb8.0.35
    storages:
      s3-backup:
        type: s3
        s3:
          bucket: myapp-mysql-backups
          credentialsSecret: mysql-backup-s3
          region: us-east-1
    schedule:
      - name: daily-backup
        schedule: "0 3 * * *"
        keep: 7
        storageName: s3-backup
```

### Day-2 Operations with Operators

```bash
# CloudNativePG — common operations

# Scale replicas
kubectl patch cluster myapp-pg -n production --type merge \
  -p '{"spec":{"instances":5}}'

# Trigger manual backup
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Backup
metadata:
  name: manual-backup-$(date +%Y%m%d)
  namespace: production
spec:
  cluster:
    name: myapp-pg
EOF

# Check cluster status
kubectl get cluster myapp-pg -n production -o yaml

# View backup status
kubectl get backups -n production

# Failover (promote replica to primary)
# Automatic on primary failure, or manual:
kubectl cnpg promote myapp-pg replica-pod-name -n production

# Rolling restart (e.g., after config change)
kubectl cnpg restart myapp-pg -n production

# PITR restore
kubectl apply -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: myapp-pg-restored
  namespace: production
spec:
  instances: 3
  storage:
    size: 100Gi
  bootstrap:
    recovery:
      source: myapp-pg
      recoveryTarget:
        targetTime: "2026-03-10T10:00:00Z"
  externalClusters:
    - name: myapp-pg
      barmanObjectStore:
        destinationPath: s3://myapp-pg-backups/
        s3Credentials:
          accessKeyId:
            name: pg-backup-s3
            key: ACCESS_KEY_ID
          secretAccessKey:
            name: pg-backup-s3
            key: SECRET_ACCESS_KEY
EOF
```

### When to Use Operators vs Managed

```
Operators vs Managed Services:
┌──────────────────────────────────────────────────────────┐
│                                                            │
│  USE KUBERNETES OPERATORS when:                           │
│  ✅ Already running Kubernetes in production              │
│  ✅ Need fine-grained control over database config       │
│  ✅ Data sovereignty requires self-hosted                │
│  ✅ Cost optimization at scale (10+ databases)           │
│  ✅ Need custom extensions not available in managed      │
│  ✅ Multi-cloud / hybrid-cloud requirement               │
│                                                            │
│  USE MANAGED SERVICES when:                               │
│  ✅ Small team without Kubernetes expertise              │
│  ✅ Need simplest possible operational model             │
│  ✅ Single cloud provider                                │
│  ✅ Compliance certifications needed (SOC2, HIPAA)       │
│  ✅ Limited DevOps capacity                              │
│                                                            │
│  NEVER run databases on Kubernetes without:              │
│  ❌ A mature operator (no DIY StatefulSets)              │
│  ❌ Persistent volume support tested for data safety     │
│  ❌ Backup/restore procedures tested                     │
│  ❌ Monitoring and alerting for database metrics         │
│  ❌ Team experience with Kubernetes operations           │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS use a mature operator** — never manage databases with raw StatefulSets
2. **ALWAYS test backup and restore** — backups are useless if restore doesn't work
3. **ALWAYS spread replicas across availability zones** — topologyKey affinity
4. **ALWAYS enable monitoring** — Prometheus metrics from the operator
5. **ALWAYS use persistent storage** with proper storage class (SSD, encrypted)
6. **ALWAYS configure connection pooling** — PgBouncer sidecar or proxy
7. **ALWAYS automate backups** — scheduled backups to object storage
8. **NEVER run databases on Kubernetes without operators** — too complex to manage manually
9. **NEVER skip failover testing** — test automatic failover before trusting it
10. **NEVER use local storage for databases** — data loss when pod is rescheduled

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Raw StatefulSets for DB | No automated failover, manual ops | Use CloudNativePG/Percona operator |
| No backup to object storage | Data loss on cluster failure | Configure S3/GCS backups |
| All replicas in same AZ | Entire cluster lost on AZ failure | Use topology spread constraints |
| No failover testing | Failover fails when actually needed | Regular failover drills |
| Local storage for database | Data loss on pod reschedule | Use persistent volumes with network storage |
| No connection pooling | Connection exhaustion | Enable PgBouncer in operator |
| No resource limits | DB pod OOMKilled or CPU starved | Set requests and limits |
| No monitoring | Blind to database health | Enable Prometheus pod monitors |

---

## Enforcement Checklist

- [ ] Database operator selected and deployed (CloudNativePG, Percona, etc.)
- [ ] Automated backups configured to object storage
- [ ] Backup restore tested and documented
- [ ] Replicas spread across availability zones
- [ ] Failover tested (automated and manual)
- [ ] Connection pooling enabled (PgBouncer)
- [ ] Prometheus monitoring enabled
- [ ] Resource requests and limits configured
- [ ] Storage class appropriate for database workload (SSD, encrypted)
- [ ] Rolling upgrade procedure tested
