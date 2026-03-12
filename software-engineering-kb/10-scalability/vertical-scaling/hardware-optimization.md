# Hardware Optimization

> **Domain:** Scalability > Vertical Scaling
> **Importance:** High
> **Last Updated:** 2025

## Identifying the Bottleneck

Before scaling hardware, profile to find the constraint:

```
CPU-bound:    High CPU%, low I/O wait → More/faster cores
Memory-bound: High swap, OOM kills    → More RAM
I/O-bound:    High iowait%, low CPU%  → Faster storage (NVMe)
Network-bound: High bandwidth usage   → Better NIC, compression
```

```bash
# Quick bottleneck identification (Linux)
# CPU: check utilization per core
mpstat -P ALL 1 5

# Memory: check swap usage and OOM events
free -h && dmesg | grep -i "out of memory"

# I/O: check disk latency and throughput
iostat -xz 1 5

# Network: check bandwidth and errors
sar -n DEV 1 5
```

```go
// Go: Runtime profiling to identify bottleneck
import (
    "net/http"
    _ "net/http/pprof"
    "runtime"
)

func init() {
    // Expose profiling endpoints
    go func() {
        http.ListenAndServe(":6060", nil)
    }()
}
// Access: go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30
// Memory: go tool pprof http://localhost:6060/debug/pprof/heap
```

## CPU Scaling

### Cores vs Clock Speed

| Workload | Optimal Strategy |
|----------|-----------------|
| Single-threaded (Redis, some DBs) | Higher clock speed |
| Multi-threaded (web servers, parallel processing) | More cores |
| Mixed (typical web app) | Balance of both |

### NUMA Awareness

Non-Uniform Memory Access — memory access time depends on which CPU socket.

```bash
# Check NUMA topology
numactl --hardware

# Pin process to NUMA node for locality
numactl --cpunodebind=0 --membind=0 ./myapp

# PostgreSQL: huge pages + NUMA-aware
echo "vm.nr_hugepages = 4096" >> /etc/sysctl.conf
```

### Cloud Instance Families

| Family | Optimized For | Example (AWS) | Use Case |
|--------|--------------|---------------|----------|
| Compute | CPU | c7i.4xlarge | Web servers, batch processing |
| Memory | RAM | r7i.4xlarge | In-memory DBs, caching |
| Storage | I/O | i4i.4xlarge | Databases, data warehouses |
| General | Balanced | m7i.4xlarge | Mixed workloads |
| Accelerated | GPU/FPGA | p5.48xlarge | ML inference, video |

## Memory Scaling

```python
# Python: Monitor memory to right-size
import psutil
import resource

def get_memory_profile():
    process = psutil.Process()
    return {
        "rss_mb": process.memory_info().rss / 1024 / 1024,
        "vms_mb": process.memory_info().vms / 1024 / 1024,
        "percent": process.memory_percent(),
        "system_available_mb": psutil.virtual_memory().available / 1024 / 1024,
        "swap_used_mb": psutil.swap_memory().used / 1024 / 1024,
    }

# Rule: RSS should be < 70% of available RAM
# If swap_used > 0, instance needs more memory
```

**Memory sizing rules:**
- Database buffer pool: 50-75% of RAM (PostgreSQL: shared_buffers = 25%, effective_cache_size = 75%)
- Application server: Measure peak RSS, provision 1.5x
- JVM: Set -Xmx to 50-75% of container memory, leave room for off-heap
- Redis: maxmemory < 80% of available (leave room for fork during RDB save)

## Storage Scaling

| Storage Type | IOPS | Throughput | Latency | Use Case |
|-------------|------|-----------|---------|----------|
| HDD (st1) | 500 | 500 MB/s | 5-10ms | Sequential reads, logs |
| SSD (gp3) | 16,000 | 1,000 MB/s | <1ms | General purpose |
| NVMe (io2) | 256,000 | 4,000 MB/s | <0.1ms | High-performance DB |
| Instance store | 3.3M | 7,000 MB/s | <0.05ms | Ephemeral, temp data |

```hcl
# Terraform: Provisioned IOPS SSD for database
resource "aws_ebs_volume" "db_data" {
  availability_zone = "us-east-1a"
  size              = 500     # GB
  type              = "io2"
  iops              = 64000   # Provisioned IOPS
  throughput        = 1000    # MB/s

  tags = { Name = "db-data" }
}
```

## Network Bandwidth

```bash
# Kernel tuning for high-throughput networking
# /etc/sysctl.conf
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 87380 16777216
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 1024 65535

# File descriptor limits
fs.file-max = 2097152
```

**Instance networking by size (AWS):**
- m7i.large: 12.5 Gbps baseline
- m7i.4xlarge: 25 Gbps
- m7i.16xlarge: 50 Gbps
- c7gn.16xlarge: 200 Gbps (network optimized)

## Hardware Acceleration

| Accelerator | Use Case | Performance Gain |
|------------|----------|-----------------|
| AES-NI | TLS encryption | 5-10x faster TLS |
| AVX-512 | Vector math, compression | 2-8x for compatible workloads |
| GPU (NVIDIA) | ML inference, video | 10-100x for parallel compute |
| AWS Graviton (ARM) | General compute | 20-40% better price/performance |
| FPGA | Custom hardware logic | Low-latency custom processing |

## Best Practices

1. **Profile before scaling** — identify CPU/memory/IO/network bottleneck first
2. **Right-size instances** — monitor actual usage, resize to 60-70% utilization target
3. **Use NUMA-aware configuration** — pin processes to NUMA nodes for memory locality
4. **Choose instance family by workload** — compute-optimized for CPU, memory-optimized for DB
5. **Enable huge pages for databases** — reduces TLB misses, improves memory-intensive workloads
6. **Tune kernel parameters** — TCP buffers, file descriptors, connection limits
7. **Use NVMe/provisioned IOPS for databases** — storage I/O is often the hidden bottleneck
8. **Consider ARM instances** — Graviton offers 20-40% better price/performance for many workloads
9. **Set resource alarms** — alert at 70% CPU, 80% memory before hitting ceiling
10. **Benchmark before and after** — quantify the improvement from each scaling action

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|-------------|--------|-----|
| Scaling without profiling | Wasted money on wrong resource | Profile first (CPU/mem/IO) |
| Using general-purpose for everything | Suboptimal price/performance | Match instance family to workload |
| Ignoring NUMA on large instances | 30-40% memory penalty | Pin to NUMA node |
| Default kernel parameters | Connection limits hit early | Tune sysctl for production |
| Over-provisioning permanently | 2-5x cost waste | Right-size, use auto-scaling |
| HDD for database | 100x latency penalty | NVMe or provisioned IOPS SSD |
| Ignoring instance store | Missing free high-perf storage | Use for temp/cache data |
| No swap monitoring | Silent performance degradation | Alert on any swap usage |

## Enforcement Checklist

- [ ] Workload profiled to identify CPU/memory/IO/network bottleneck
- [ ] Instance family matches workload type
- [ ] Kernel parameters tuned for production (sysctl, file descriptors)
- [ ] Database storage uses NVMe or provisioned IOPS
- [ ] NUMA configuration verified on multi-socket instances
- [ ] Resource utilization monitoring with alerts at 70% threshold
- [ ] Instance right-sizing review scheduled quarterly
- [ ] Benchmark results documented before and after scaling
