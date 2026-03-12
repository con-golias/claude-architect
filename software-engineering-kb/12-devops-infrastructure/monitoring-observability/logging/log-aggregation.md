# Log Aggregation

## Overview

| Field              | Value                                                                           |
|--------------------|---------------------------------------------------------------------------------|
| **Domain**         | DevOps > Observability > Logging                                                |
| **Importance**     | High                                                                            |
| **Scope**          | Centralized log collection, processing pipelines, routing, retention, and cost optimization |
| **Audience**       | DevOps Engineers, SREs, Platform Engineers                                       |
| **Key Insight**    | A well-designed log pipeline separates collection from processing and storage, enabling independent scaling and vendor-agnostic routing |
| **Cross-ref**      | [Structured Logging](structured-logging.md), [ELK Stack](elk-stack.md), [Three Pillars](../three-pillars.md) |

---

## Core Concepts

### Why Aggregate Logs

```text
Without Aggregation:                   With Aggregation:
┌───────┐ ┌───────┐ ┌───────┐         ┌───────┐ ┌───────┐ ┌───────┐
│ Pod A │ │ Pod B │ │ Pod C │         │ Pod A │ │ Pod B │ │ Pod C │
│ logs  │ │ logs  │ │ logs  │         │ logs  │ │ logs  │ │ logs  │
└───┬───┘ └───┬───┘ └───┬───┘         └───┬───┘ └───┬───┘ └───┬───┘
    │         │         │                  │         │         │
  kubectl   kubectl   kubectl              └────┬────┴────┬────┘
  logs A    logs B    logs C                    │         │
    │         │         │              ┌────────▼─────────▼────────┐
    ▼         ▼         ▼              │   Centralized Log Store   │
  Manual    Manual    Manual           │  - Search across all pods │
  search    search    search           │  - Correlate by trace_id  │
                                       │  - Alert on patterns      │
                                       │  - Retain for compliance  │
                                       └──────────────────────────┘
```

**Core benefits:**
- Cross-service search and correlation using trace_id, request_id
- Retention beyond pod/container lifecycle (containers are ephemeral)
- Compliance and audit requirements (GDPR, SOX, HIPAA)
- Automated alerting on log patterns and error rates
- Historical analysis for capacity planning and debugging

### Log Collection Patterns

| Pattern       | Mechanism                           | Pros                                | Cons                                |
|---------------|-------------------------------------|-------------------------------------|-------------------------------------|
| **DaemonSet** | Agent per node reads container logs | Low app overhead, no code changes   | Node resource usage, all-or-nothing |
| **Sidecar**   | Agent per pod                       | Per-pod config, isolation           | Higher resource usage, more config  |
| **Direct Ship** | App sends logs directly to backend| No collector dependency             | Couples app to log backend, retry burden |
| **OTel SDK**  | App emits via OTLP to collector     | Unified with metrics/traces         | Requires SDK integration            |

```text
Recommended Architecture (Kubernetes):

  ┌─────────────────────────────────────────────────────┐
  │                   Kubernetes Node                    │
  │                                                     │
  │  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
  │  │ App Pod │  │ App Pod │  │ App Pod │            │
  │  │ stdout  │  │ stdout  │  │ stdout  │            │
  │  └────┬────┘  └────┬────┘  └────┬────┘            │
  │       │            │            │                   │
  │       ▼            ▼            ▼                   │
  │  /var/log/containers/*.log                          │
  │       │                                             │
  │  ┌────▼──────────────────────┐                      │
  │  │ Fluent Bit (DaemonSet)    │                      │
  │  │ - Tail container logs     │                      │
  │  │ - Parse JSON              │                      │
  │  │ - Enrich with K8s meta    │                      │
  │  │ - Buffer and forward      │                      │
  │  └────────────┬──────────────┘                      │
  └───────────────┼──────────────────────────────────────┘
                  │
                  ▼
  ┌──────────────────────────────────────┐
  │  Aggregation Layer (optional)         │
  │  Fluentd / Vector / OTel Collector    │
  │  - Cross-node aggregation             │
  │  - Routing rules                      │
  │  - Sampling / filtering               │
  └───────┬──────────┬──────────┬────────┘
          │          │          │
          ▼          ▼          ▼
       Loki     Elasticsearch   S3
     (search)    (analytics)   (archive)
```

### Collection Pipeline Design

Design every log pipeline with five stages.

```text
  Collect ──► Parse ──► Enrich ──► Route ──► Store

  1. COLLECT: Read from file, stdin, syslog, OTLP, or API
  2. PARSE:   Extract JSON fields, handle multiline stack traces
  3. ENRICH:  Add Kubernetes metadata, geo-IP, service version
  4. ROUTE:   Direct logs to different backends by severity/team/type
  5. STORE:   Write to Loki, Elasticsearch, S3, or cloud-native service
```

### Log Collectors Comparison

| Collector        | Language | Memory     | Plugins | Best For                              |
|------------------|----------|------------|---------|---------------------------------------|
| **Fluent Bit**   | C        | ~10 MB     | 100+    | Lightweight edge collection in K8s    |
| **Fluentd**      | Ruby/C   | ~40 MB     | 800+    | Aggregation layer, complex routing    |
| **Vector**       | Rust     | ~15 MB     | 100+    | High-performance, programmable transforms |
| **OTel Collector** | Go     | ~30 MB     | 100+    | Unified telemetry (logs + metrics + traces) |
| **Filebeat**     | Go       | ~20 MB     | 30+     | Elasticsearch-native environments     |

### Fluent Bit Configuration for Kubernetes

```yaml
# fluent-bit-daemonset.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluent-bit
  namespace: logging
  labels:
    app: fluent-bit
spec:
  selector:
    matchLabels:
      app: fluent-bit
  template:
    metadata:
      labels:
        app: fluent-bit
    spec:
      serviceAccountName: fluent-bit
      tolerations:
        - operator: Exists
      containers:
        - name: fluent-bit
          image: fluent/fluent-bit:3.2
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
            - name: containers
              mountPath: /var/log/containers
              readOnly: true
            - name: config
              mountPath: /fluent-bit/etc/
          env:
            - name: NODE_NAME
              valueFrom:
                fieldRef:
                  fieldPath: spec.nodeName
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
        - name: containers
          hostPath:
            path: /var/log/containers
        - name: config
          configMap:
            name: fluent-bit-config
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: logging
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         5
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf
        HTTP_Server   On
        HTTP_Listen   0.0.0.0
        HTTP_Port     2020
        storage.path  /var/log/flb-storage/
        storage.sync  normal
        storage.backlog.mem_limit 50M

    [INPUT]
        Name              tail
        Path              /var/log/containers/*.log
        Parser            cri
        Tag               kube.*
        Mem_Buf_Limit     10MB
        Skip_Long_Lines   On
        Refresh_Interval  10
        DB                /var/log/flb_kube.db

    [FILTER]
        Name                kubernetes
        Match               kube.*
        Kube_URL            https://kubernetes.default.svc:443
        Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
        Merge_Log           On
        Merge_Log_Key       log_parsed
        K8S-Logging.Parser  On
        K8S-Logging.Exclude On
        Labels              On
        Annotations         Off

    [FILTER]
        Name    modify
        Match   kube.*
        Add     cluster production-us-east-1
        Add     node ${NODE_NAME}

    # Route ERROR+ to both Loki and Elasticsearch
    [OUTPUT]
        Name          loki
        Match         kube.*
        Host          loki-gateway.logging.svc
        Port          80
        Labels        job=fluent-bit, cluster=production
        Label_Keys    $kubernetes['namespace_name'],$kubernetes['pod_name']
        Auto_Kubernetes_Labels On
        Retry_Limit   5

    # Archive all logs to S3 (compressed)
    [OUTPUT]
        Name          s3
        Match         kube.*
        bucket        company-logs-archive
        region        us-east-1
        total_file_size 50M
        upload_timeout  10m
        s3_key_format  /logs/%Y/%m/%d/$TAG/%H-%M-%S
        compression    gzip

  parsers.conf: |
    [PARSER]
        Name        cri
        Format      regex
        Regex       ^(?<time>[^ ]+) (?<stream>stdout|stderr) (?<logtag>[^ ]*) (?<log>.*)$
        Time_Key    time
        Time_Format %Y-%m-%dT%H:%M:%S.%L%z

    [PARSER]
        Name        json
        Format      json
        Time_Key    timestamp
        Time_Format %Y-%m-%dT%H:%M:%S.%LZ
```

### Vector Configuration

```yaml
# vector.yaml
sources:
  kubernetes_logs:
    type: kubernetes_logs
    auto_partial_merge: true
    extra_label_selector: "app!=fluent-bit"

  internal_metrics:
    type: internal_metrics

transforms:
  parse_json:
    type: remap
    inputs: ["kubernetes_logs"]
    source: |
      # Parse JSON log body
      parsed, err = parse_json(.message)
      if err == null {
        . = merge(., parsed)
        del(.message)
      }

  enrich_metadata:
    type: remap
    inputs: ["parse_json"]
    source: |
      .cluster = "production-us-east-1"
      .environment = get_env_var("ENVIRONMENT") ?? "unknown"

      # Normalize log level
      .level = downcase(.level) ?? "info"

      # Redact sensitive fields
      if exists(.email) {
        .email = "[REDACTED]"
      }
      if exists(.authorization) {
        .authorization = "[REDACTED]"
      }

  route_by_level:
    type: route
    inputs: ["enrich_metadata"]
    route:
      errors: '.level == "error" || .level == "fatal"'
      warnings: '.level == "warn"'
      info: '.level == "info" || .level == "debug"'

  # Sample info/debug logs at 10%
  sample_info:
    type: sample
    inputs: ["route_by_level.info"]
    rate: 10

sinks:
  loki_all:
    type: loki
    inputs: ["route_by_level.errors", "route_by_level.warnings", "sample_info"]
    endpoint: "http://loki-gateway.logging.svc:80"
    encoding:
      codec: json
    labels:
      service: "{{ kubernetes.pod_labels.app }}"
      namespace: "{{ kubernetes.pod_namespace }}"
      level: "{{ level }}"
    batch:
      max_bytes: 1048576
      timeout_secs: 5

  s3_archive:
    type: aws_s3
    inputs: ["route_by_level.errors", "route_by_level.warnings", "sample_info"]
    bucket: "company-logs-archive"
    region: "us-east-1"
    key_prefix: "logs/%Y/%m/%d/"
    compression: gzip
    encoding:
      codec: json
    batch:
      max_bytes: 10485760
      timeout_secs: 300

  # Send Vector's own metrics to Prometheus
  prometheus_sink:
    type: prometheus_exporter
    inputs: ["internal_metrics"]
    address: "0.0.0.0:9598"
```

### OTel Collector Logging Pipeline

```yaml
# otel-collector-logging.yaml
receivers:
  filelog:
    include:
      - /var/log/containers/*.log
    exclude:
      - /var/log/containers/otel-collector*.log
    operators:
      - type: router
        routes:
          - output: parse_json
            expr: 'body matches "^\\{"'
          - output: parse_cri
            expr: 'true'
      - id: parse_json
        type: json_parser
        timestamp:
          parse_from: attributes.timestamp
          layout: "%Y-%m-%dT%H:%M:%S.%LZ"
      - id: parse_cri
        type: regex_parser
        regex: '^(?P<time>[^ ]+) (?P<stream>stdout|stderr) (?P<flags>[^ ]*) (?P<log>.*)$'
        timestamp:
          parse_from: attributes.time
          layout: "%Y-%m-%dT%H:%M:%S.%LZ"

  otlp:
    protocols:
      grpc:
        endpoint: "0.0.0.0:4317"
      http:
        endpoint: "0.0.0.0:4318"

processors:
  batch:
    timeout: 5s
    send_batch_size: 1024

  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128

  k8sattributes:
    extract:
      metadata:
        - k8s.pod.name
        - k8s.namespace.name
        - k8s.deployment.name
        - k8s.node.name
      labels:
        - tag_name: app
          key: app
          from: pod

  filter/severity:
    logs:
      log_record:
        - 'severity_number < SEVERITY_NUMBER_INFO'

  attributes/redact:
    actions:
      - key: password
        action: delete
      - key: authorization
        action: delete
      - key: token
        action: delete

exporters:
  loki:
    endpoint: "http://loki-gateway.logging.svc:3100/loki/api/v1/push"
    default_labels_enabled:
      exporter: false
      job: true

  awss3:
    s3uploader:
      region: "us-east-1"
      s3_bucket: "company-logs-archive"
      s3_prefix: "otel-logs"
      s3_partition: "minute"
      file_prefix: "logs"

service:
  pipelines:
    logs:
      receivers: [filelog, otlp]
      processors: [memory_limiter, k8sattributes, attributes/redact, filter/severity, batch]
      exporters: [loki, awss3]
```

### Log Routing

Route logs to different destinations based on severity, service, or compliance requirements.

```text
Routing Strategy:

  All Logs ──► Collector Pipeline
                    │
                    ├── ERROR/FATAL ──► Loki (30-day retention)
                    │                   + PagerDuty alert
                    │                   + S3 archive (1 year)
                    │
                    ├── WARN ─────────► Loki (14-day retention)
                    │                   + S3 archive (90 days)
                    │
                    ├── INFO ─────────► Loki (7-day retention, sampled 10%)
                    │                   + S3 archive (30 days)
                    │
                    └── DEBUG ────────► /dev/null in production
                                        (enable per-service via config)
```

### Log Retention Policies

| Tier     | Storage         | Retention  | Query Speed | Cost    | Use Case                     |
|----------|-----------------|------------|-------------|---------|------------------------------|
| **Hot**  | Loki/ES SSD     | 7-14 days  | < 1 second  | $$$$    | Active debugging, recent     |
| **Warm** | Loki/ES HDD     | 30-90 days | 1-10 seconds| $$      | Recent incident investigation|
| **Cold** | S3/GCS/Azure Blob| 1-7 years | Minutes     | $       | Compliance, forensics, audit |
| **Frozen** | Glacier/Archive| 7+ years   | Hours       | Cents   | Legal hold, regulatory       |

### Log Storage Cost Optimization

| Strategy          | Savings   | Trade-off                                |
|-------------------|-----------|------------------------------------------|
| Sampling INFO logs| 70-90%    | Lose some routine event records          |
| gzip compression  | 80-90%    | CPU overhead on write/read               |
| Drop DEBUG in prod| 50-70%    | No DEBUG-level data in production        |
| Index only key fields | 40-60% | Cannot search unindexed fields          |
| Tiered retention  | 60-80%    | Slower queries on older data             |
| Aggregation rules | 30-50%    | Lose individual records, keep counts     |

### Multi-Tenant Logging

```text
Namespace Isolation in Kubernetes:

  Team A (namespace: team-a)
    └── Logs tagged: tenant=team-a
         └── Loki tenant header: X-Scope-OrgID=team-a
              └── Query isolation: team-a can only see team-a logs

  Team B (namespace: team-b)
    └── Logs tagged: tenant=team-b
         └── Loki tenant header: X-Scope-OrgID=team-b
              └── Query isolation: team-b can only see team-b logs
```

### Log Pipeline Reliability

Design pipelines to handle backpressure, failures, and data loss scenarios.

```text
Reliability Mechanisms:

  1. BUFFERING
     - Memory buffer: Fast, lost on crash (Fluent Bit Mem_Buf_Limit)
     - Filesystem buffer: Survives restarts (Fluent Bit storage.path)
     - Hybrid: Memory primary, filesystem overflow

  2. BACKPRESSURE
     - When downstream is slow, buffer fills up
     - Options: block (apply backpressure to app), drop oldest, drop newest
     - Best: filesystem buffer + retry with exponential backoff

  3. DEAD LETTER QUEUE
     - Unparseable or undeliverable logs go to DLQ (S3 bucket)
     - Monitor DLQ size; alert if growing
     - Periodically reprocess DLQ entries after fixing parser/destination

  4. AT-LEAST-ONCE DELIVERY
     - Use file-based position tracking (Fluent Bit DB parameter)
     - Checkpoint after successful send acknowledgment
     - Accept duplicates; deduplicate at query time if needed
```

---

## Best Practices

1. **Use DaemonSet-based collection for Kubernetes** -- deploy Fluent Bit as a DaemonSet to collect container logs from every node without modifying application code.

2. **Separate collection from aggregation** -- use a lightweight collector (Fluent Bit) at the edge and a heavier aggregator (Fluentd, Vector, OTel Collector) for routing and transformation.

3. **Implement filesystem-based buffering** -- configure filesystem buffers on collectors to survive pod restarts and handle downstream outages without data loss.

4. **Route logs by severity to different retention tiers** -- send ERROR logs to hot storage with long retention, sample INFO logs, and drop DEBUG in production.

5. **Enrich logs with Kubernetes metadata** -- add pod name, namespace, deployment, node, and labels at the collector level, not in application code.

6. **Compress archived logs** -- apply gzip or zstd compression on logs destined for cold/archive storage to reduce costs by 80-90%.

7. **Monitor the log pipeline itself** -- expose collector metrics (records in/out, errors, buffer usage) to Prometheus and alert on pipeline failures.

8. **Implement dead letter queues** -- route unparseable or undeliverable logs to a DLQ (S3 bucket) rather than dropping them silently.

9. **Set memory limits on collectors** -- configure memory_limiter in OTel Collector or Mem_Buf_Limit in Fluent Bit to prevent OOM kills on the collection nodes.

10. **Standardize multi-tenant log isolation** -- use Loki tenant headers or Elasticsearch index-per-namespace patterns to ensure teams can only query their own logs.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| **Direct application-to-backend shipping** | Couples app to log backend, retry logic in every service, no centralized routing | Use a collector (Fluent Bit, Vector) as an intermediary |
| **Memory-only buffering** | Collector crash or restart loses all buffered logs | Configure filesystem-based buffering with position tracking |
| **No log sampling** | INFO-level logs from high-traffic services dominate storage costs | Sample INFO/DEBUG logs at 10%; always keep ERROR/WARN at 100% |
| **Single retention tier** | All logs kept at hot-tier cost; budget exceeded in weeks | Implement hot/warm/cold tiers with automatic lifecycle policies |
| **Unmonitored pipeline** | Collection silently fails; logs stop flowing without any alert | Export collector metrics and alert on throughput drops or error rate |
| **Overly complex parsing** | Regex-based parsers for every format; fragile, slow, hard to maintain | Standardize on JSON structured logging at the source |
| **No backpressure handling** | Collector OOM-kills when downstream is slow; node instability | Configure memory limits, filesystem buffers, and backpressure policies |
| **Logging to local files inside containers** | Logs lost when container restarts; breaks DaemonSet collection pattern | Log to stdout/stderr; let the container runtime handle log files |

---

## Enforcement Checklist

- [ ] Log collector deployed as DaemonSet on every Kubernetes node (Fluent Bit or Vector)
- [ ] Filesystem-based buffering configured on all collectors with position tracking
- [ ] Kubernetes metadata enrichment enabled (pod name, namespace, deployment, labels)
- [ ] Log routing rules implemented: ERROR to hot tier, INFO sampled, DEBUG dropped in production
- [ ] Cold storage archival configured (S3/GCS) with gzip compression and lifecycle policies
- [ ] Collector metrics exposed to Prometheus with alerts on throughput drops and buffer overflow
- [ ] Dead letter queue configured for unparseable/undeliverable logs
- [ ] Memory limits set on all collector instances to prevent OOM kills
- [ ] Multi-tenant isolation configured (Loki org ID or Elasticsearch index-per-namespace)
- [ ] Log pipeline end-to-end latency monitored (time from log emission to searchability < 30 seconds)
