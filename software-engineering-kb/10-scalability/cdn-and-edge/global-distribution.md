# Global Distribution Architecture

> **Domain:** Scalability > CDN and Edge
> **Importance:** High
> **Last Updated:** 2025
> **Cross-ref:** [07-database/distributed-databases/multi-region.md](../../07-database/distributed-databases/multi-region.md) (database replication patterns); this document covers **application-layer global distribution**: multi-region deployment, DNS routing, global load balancing, and failover architecture.

---

## 1. Multi-Region Deployment Strategies

```
┌─────────────────────────────────────────────────────────────────┐
│  ACTIVE-ACTIVE                   ACTIVE-PASSIVE                 │
│  ┌──────────┐  ┌──────────┐     ┌──────────┐  ┌──────────┐    │
│  │ US-East  │  │ EU-West  │     │ US-East  │  │ EU-West  │    │
│  │ Read/    │  │ Read/    │     │ Read/    │  │ Standby  │    │
│  │ Write    │  │ Write    │     │ Write    │  │ (cold)   │    │
│  └────┬─────┘  └────┬─────┘     └────┬─────┘  └────┬─────┘    │
│       └──async repl──┘                └──async repl──┘          │
│                                                                 │
│  RTO: ~0    RPO: ~0             RTO: 5-30min  RPO: seconds     │
│  Cost: 2x   Complexity: HIGH   Cost: 1.3x    Complexity: MED  │
└─────────────────────────────────────────────────────────────────┘
```

| Architecture | RTO | RPO | Cost | Use Case |
|-------------|-----|-----|------|----------|
| Active-Active (multi-master) | ~0 | ~0 | 2-3x | Zero-downtime global apps |
| Active-Active (read-local-write-global) | ~0 reads / 30s writes | seconds | 1.5-2x | Read-heavy global apps |
| Warm Standby | 5-15 min | seconds | 1.3-1.5x | Business-critical apps |
| Cold Standby (pilot light) | 30-60 min | minutes | 1.1-1.2x | Cost-sensitive DR |
| Backup/Restore | 1-24 hours | hours | 1.05x | Non-critical systems |

## 2. DNS-Based Routing: Route53 Configuration

```hcl
# Terraform — latency-based routing to nearest region
resource "aws_route53_record" "api_us" {
  zone_id        = aws_route53_zone.main.zone_id
  name           = "api.example.com"
  type           = "A"
  set_identifier = "us-east-1"
  alias {
    name                   = aws_lb.api_us.dns_name
    zone_id                = aws_lb.api_us.zone_id
    evaluate_target_health = true
  }
  latency_routing_policy { region = "us-east-1" }
}

resource "aws_route53_record" "api_eu" {
  zone_id        = aws_route53_zone.main.zone_id
  name           = "api.example.com"
  type           = "A"
  set_identifier = "eu-west-1"
  alias {
    name                   = aws_lb.api_eu.dns_name
    zone_id                = aws_lb.api_eu.zone_id
    evaluate_target_health = true
  }
  latency_routing_policy { region = "eu-west-1" }
}

# Health check — auto-failover when region goes unhealthy
resource "aws_route53_health_check" "api_us" {
  fqdn              = aws_lb.api_us.dns_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 10
}

# Geolocation routing for data sovereignty (GDPR)
resource "aws_route53_record" "api_eu_geo" {
  zone_id        = aws_route53_zone.main.zone_id
  name           = "api.example.com"
  type           = "A"
  set_identifier = "eu-geo"
  alias {
    name                   = aws_lb.api_eu.dns_name
    zone_id                = aws_lb.api_eu.zone_id
    evaluate_target_health = true
  }
  geolocation_routing_policy { continent = "EU" }
}
```

## 3. Global Load Balancing: Anycast and GSLB

```
┌─────────────────────────────────────────────────────────────────┐
│  DNS-Based (Route53)         Anycast (Global Accelerator)       │
│  - Returns closest region IP - Same IP from all regions via BGP │
│  - Failover: DNS TTL 60-300s - Failover: BGP convergence 30-90s│
│  - Per-resolver granularity  - Per-packet (true nearest)        │
│                                                                 │
│  GSLB (F5, Citrix)                                             │
│  - App-aware, health-check driven, weighted/priority policies  │
│  - Failover: health check interval 10-30s                      │
└─────────────────────────────────────────────────────────────────┘
```

```hcl
# AWS Global Accelerator — Anycast-based global load balancing
resource "aws_globalaccelerator_accelerator" "api" {
  name            = "api-global"
  ip_address_type = "IPV4"
  enabled         = true
}

resource "aws_globalaccelerator_listener" "api" {
  accelerator_arn = aws_globalaccelerator_accelerator.api.id
  protocol        = "TCP"
  port_range { from_port = 443; to_port = 443 }
}

resource "aws_globalaccelerator_endpoint_group" "us" {
  listener_arn          = aws_globalaccelerator_listener.api.id
  endpoint_group_region = "us-east-1"
  health_check_path     = "/health"
  health_check_interval_seconds = 10
  endpoint_configuration {
    endpoint_id = aws_lb.api_us.arn
    weight      = 100
  }
}
```

## 4. Go: Region-Aware Service with Data Locality

```go
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"
)

type RegionConfig struct {
	Region      string
	DatabaseDSN string // Local read replica
	PrimaryDSN  string // Write-primary (may be remote)
	CacheAddr   string // Local Redis
}

var configs = map[string]RegionConfig{
	"us-east-1":      {Region: "us-east-1", DatabaseDSN: "postgres://read-us:5432/app", PrimaryDSN: "postgres://primary-us:5432/app", CacheAddr: "cache-us:6379"},
	"eu-west-1":      {Region: "eu-west-1", DatabaseDSN: "postgres://read-eu:5432/app", PrimaryDSN: "postgres://primary-us:5432/app", CacheAddr: "cache-eu:6379"},
	"ap-northeast-1": {Region: "ap-northeast-1", DatabaseDSN: "postgres://read-ap:5432/app", PrimaryDSN: "postgres://primary-us:5432/app", CacheAddr: "cache-ap:6379"},
}

type Service struct {
	config  RegionConfig
	localDB *DatabaseClient
	primary *DatabaseClient
	cache   *CacheClient
}

// ReadLocal reads from the local replica — sub-5ms within region
func (s *Service) ReadLocal(ctx context.Context, key string) ([]byte, error) {
	if val, err := s.cache.Get(ctx, key); err == nil {
		return val, nil
	}
	val, err := s.localDB.Query(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("local read failed: %w", err)
	}
	_ = s.cache.Set(ctx, key, val, 60*time.Second)
	return val, nil
}

// WriteGlobal writes to the primary and invalidates all regional caches
func (s *Service) WriteGlobal(ctx context.Context, key string, data []byte) error {
	if err := s.primary.Write(ctx, key, data); err != nil {
		return fmt.Errorf("primary write failed: %w", err)
	}
	_ = s.cache.Delete(ctx, key)
	go s.publishInvalidation(key) // Async cross-region cache bust
	return nil
}

func (s *Service) Handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Served-Region", s.config.Region)
	switch r.Method {
	case http.MethodGet:
		data, err := s.ReadLocal(r.Context(), r.URL.Path)
		if err != nil { http.Error(w, "read error", 500); return }
		w.Header().Set("Cache-Control", "public, max-age=30")
		w.Write(data)
	case http.MethodPut:
		data, _ := io.ReadAll(r.Body)
		if err := s.WriteGlobal(r.Context(), r.URL.Path, data); err != nil {
			http.Error(w, "write error", 500); return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
```

## 5. TypeScript: Multi-Region API with Read-Local-Write-Global

```typescript
import express from "express";
import { Pool } from "pg";
import Redis from "ioredis";

const REGION = process.env.AWS_REGION || "us-east-1";
const localDB = new Pool({ connectionString: process.env.LOCAL_DB_URL, max: 20 });
const primaryDB = new Pool({ connectionString: process.env.PRIMARY_DB_URL, max: 10 });
const cache = new Redis(process.env.LOCAL_CACHE_URL!);

const app = express();
app.use(express.json());
app.use((req, res, next) => { res.set("X-Served-Region", REGION); next(); });

// READ: local replica + local cache — sub-5ms
app.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const cached = await cache.get(`product:${id}`);
  if (cached) {
    res.set("X-Cache", "HIT");
    return res.json(JSON.parse(cached));
  }
  const { rows } = await localDB.query("SELECT * FROM products WHERE id = $1", [id]);
  if (!rows.length) return res.status(404).json({ error: "not found" });
  await cache.set(`product:${id}`, JSON.stringify(rows[0]), "EX", 60);
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
  res.json(rows[0]);
});

// WRITE: global primary + cross-region cache invalidation
app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { name, price } = req.body;
  await primaryDB.query(
    "UPDATE products SET name=$1, price=$2, updated_at=NOW() WHERE id=$3",
    [name, price, id]
  );
  await cache.del(`product:${id}`);
  // Publish invalidation for all regions
  await cache.publish("cache:invalidate", JSON.stringify({
    key: `product:${id}`, region: REGION, timestamp: Date.now(),
  }));
  res.status(204).end();
});
```

## 6. Data Sovereignty and Compliance

```
┌─────────────────────────────────────────────────────────────────┐
│  GDPR (EU): Personal data in EU/EEA or approved countries       │
│  LGPD (Brazil): Similar to GDPR; data in approved locations     │
│  PIPL (China): Data in China; cross-border needs assessment     │
│                                                                 │
│  ┌─────────┐ Geofenced ┌──────────┐  Data never leaves EU      │
│  │ EU User │───DNS────►│ EU Region│                             │
│  └─────────┘           └──────────┘                             │
│  ┌─────────┐ Latency   ┌──────────┐  Nearest healthy region    │
│  │ US User │───based───►│ US Region│                             │
│  └─────────┘           └──────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## 7. Automated Failover Orchestrator

```python
import asyncio
import httpx
from dataclasses import dataclass
from datetime import datetime

@dataclass
class RegionHealth:
    region: str
    endpoint: str
    healthy: bool = True
    latency_ms: float = 0
    consecutive_failures: int = 0

class FailoverOrchestrator:
    def __init__(self, regions: list[dict], dns_client, threshold: int = 3):
        self.regions = {
            r["region"]: RegionHealth(region=r["region"], endpoint=r["endpoint"])
            for r in regions
        }
        self.dns = dns_client
        self.threshold = threshold

    async def check_region(self, region: RegionHealth) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                start = datetime.utcnow()
                resp = await client.get(region.endpoint)
                region.latency_ms = (datetime.utcnow() - start).total_seconds() * 1000
                if resp.status_code == 200:
                    region.consecutive_failures = 0
                    region.healthy = True
                    return True
                region.consecutive_failures += 1
        except Exception:
            region.consecutive_failures += 1
        if region.consecutive_failures >= self.threshold:
            region.healthy = False
            await self._failover(region)
        return False

    async def _failover(self, failed: RegionHealth) -> None:
        await self.dns.update_record("api.example.com", failed.region, weight=0)
        healthy = [r for r in self.regions.values() if r.healthy]
        for r in healthy:
            await self.dns.update_record("api.example.com", r.region, weight=100 // len(healthy))

    async def run(self, interval: int = 10) -> None:
        while True:
            await asyncio.gather(*[self.check_region(r) for r in self.regions.values()])
            await asyncio.sleep(interval)
```

## 8. Active-Active Conflict Resolution

```typescript
// Last-write-wins with Hybrid Logical Clock tiebreaker
interface VersionedRecord {
  id: string;
  data: Record<string, unknown>;
  hlcTimestamp: bigint;
  sourceRegion: string;
}

class ConflictResolver {
  resolve(local: VersionedRecord, remote: VersionedRecord): VersionedRecord {
    if (local.hlcTimestamp > remote.hlcTimestamp) return local;
    if (remote.hlcTimestamp > local.hlcTimestamp) return remote;
    // Deterministic tiebreaker: lexicographic region comparison
    return local.sourceRegion < remote.sourceRegion ? local : remote;
  }
}
```

---

## 9. Best Practices

1. **Use latency-based DNS routing as the default global distribution strategy.** Route users to the nearest healthy region; pair with health checks for automatic failover.
2. **Separate read path (local) from write path (global primary).** Reads hit the local replica for sub-5ms latency; writes go to the primary accepting cross-region latency.
3. **Deploy infrastructure-as-code identically across all regions.** Use the same Terraform modules parameterized by region to prevent configuration drift.
4. **Set DNS TTL to 60 seconds or less for failover records.** Longer TTLs delay failover; 60s balances DNS query load against failover speed.
5. **Use Anycast (Global Accelerator, Cloudflare) for TCP-level global routing.** Anycast failover via BGP convergence is faster than DNS TTL expiry.
6. **Pin data-sovereign users to compliant regions with geolocation routing.** GDPR, LGPD, and PIPL require data residency; enforce at the DNS layer.
7. **Define explicit RTO and RPO targets per service tier.** Tier-1: RTO <1min, RPO ~0. Tier-3: RTO <4h, RPO <1h. Size infrastructure accordingly.
8. **Run automated regional failover drills monthly.** Simulate region failure to verify failover works within target RTO.
9. **Implement cross-region cache invalidation via pub/sub.** Publish invalidation events on writes so other regions evict stale cache entries.
10. **Monitor replication lag across all regions continuously.** Lag directly affects RPO; alert when it exceeds the acceptable consistency window.

---

## 10. Anti-Patterns

| # | Anti-Pattern | Problem | Correct Approach |
|---|-------------|---------|-----------------|
| 1 | Single-region with "add regions later" | Retrofitting multi-region requires major data-layer rewrites | Design for multi-region from the start with read-local-write-global |
| 2 | Synchronous cross-region writes | 60-150ms added latency per write due to speed of light | Write locally and replicate async; accept eventual consistency |
| 3 | DNS TTL set to 3600s for failover | 1 hour of downtime while DNS caches expire | Set TTL to 60s for failover records |
| 4 | No health checks on DNS records | Traffic continues to failed regions indefinitely | Configure health checks at 10-30s intervals with auto-failover |
| 5 | Active-active without conflict resolution | Concurrent writes to the same record cause silent data corruption | Implement LWW with HLC timestamps or CRDT-based structures |
| 6 | Ignoring data sovereignty in routing | EU data processed in US violates GDPR; fines up to 4% revenue | Enforce geolocation DNS routing for regulated jurisdictions |
| 7 | Failover tested only in staging | Staging cannot replicate production DNS caching or replication lag | Run monthly production failover drills with verification |
| 8 | Origin shield colocated with primary DB | Shield region failure takes out both CDN cache and database | Place shield and DB primary in different zones or regions |

---

## 11. Enforcement Checklist

- [ ] Application deployed in 2+ regions with identical infrastructure-as-code
- [ ] DNS routing configured (latency-based or Anycast) with health checks
- [ ] Health check interval set to 10-30 seconds with automatic failover
- [ ] DNS TTL for failover records set to 60 seconds or less
- [ ] Read path uses local replica; write path uses global primary
- [ ] Cross-region cache invalidation implemented via pub/sub or event bus
- [ ] Replication lag monitored with alerts at >1s and >5s thresholds
- [ ] RTO and RPO targets defined and documented for each service tier
- [ ] Data sovereignty enforced via geolocation routing for regulated regions
- [ ] Regional failover drills executed monthly with results documented
- [ ] Conflict resolution strategy defined for any active-active write paths
- [ ] Monitoring dashboards show per-region latency, error rates, and traffic split
