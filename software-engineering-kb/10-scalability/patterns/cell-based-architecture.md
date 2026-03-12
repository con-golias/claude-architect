# Cell-Based Architecture

| Field          | Value                          |
|----------------|--------------------------------|
| Domain         | Scalability > Patterns         |
| Importance     | High                           |
| Last Updated   | 2026-03-10                     |

> **Scalability Focus**: Cell-based architecture partitions a system into independent,
> self-contained units (cells) that limit blast radius and enable horizontal scaling
> beyond the limits of traditional microservice deployments.

---

## 1. Core Concepts

### 1.1 Cell Isolation

A **cell** is a complete, independent deployment of the entire service stack.
Each cell handles a subset of traffic and shares nothing with other cells:
no databases, no caches, no message brokers.

```
                    ┌──────────────────┐
                    │   Cell Router    │
                    │ (consistent hash)│
                    └───┬──────┬───────┘
                        │      │
               ┌────────┘      └────────┐
               ▼                        ▼
    ┌──────────────────┐    ┌──────────────────┐
    │     Cell A        │    │     Cell B        │
    │ ┌──────────────┐ │    │ ┌──────────────┐ │
    │ │  API + Logic  │ │    │ │  API + Logic  │ │
    │ ├──────────────┤ │    │ ├──────────────┤ │
    │ │   Database    │ │    │ │   Database    │ │
    │ ├──────────────┤ │    │ ├──────────────┤ │
    │ │    Cache      │ │    │ │    Cache      │ │
    │ ├──────────────┤ │    │ ├──────────────┤ │
    │ │    Queue      │ │    │ │    Queue      │ │
    │ └──────────────┘ │    │ └──────────────┘ │
    └──────────────────┘    └──────────────────┘
```

### 1.2 Cell Sizing

| Cell Size     | Users per Cell | Blast Radius | Operational Overhead |
|---------------|----------------|--------------|----------------------|
| Small (micro) | 1K-10K         | Very low     | Very high            |
| Medium        | 10K-100K       | Low          | Moderate             |
| Large         | 100K-1M        | Moderate     | Low                  |

Target cell size so that a complete cell failure affects no more than 5% of users.

### 1.3 Cell Routing

Route requests to cells using **consistent hashing** on a stable key (tenant ID,
user ID, or account ID). The router must be stateless and horizontally scalable.

### 1.4 Comparison with Traditional Microservices

| Aspect              | Microservices                   | Cell-Based                           |
|---------------------|---------------------------------|--------------------------------------|
| Blast radius        | Entire service, all users       | Single cell only                     |
| Scaling unit        | Individual services             | Complete stack per cell              |
| Data isolation      | Shared database                 | Separate database per cell           |
| Deployment          | Rolling update, all instances   | Per-cell with canary progression     |

---

## 2. Code Examples

### 2.1 TypeScript -- Cell Router with Health-Aware Routing

```typescript
import { createHash } from "node:crypto";

interface Cell {
  id: string;
  endpoint: string;
  healthy: boolean;
  weight: number;     // 0-100, used for traffic shifting
  region: string;
}

interface CellRouterConfig {
  cells: Cell[];
  virtualNodesPerCell: number;  // Hash ring virtual nodes
  healthCheckIntervalMs: number;
}

class CellRouter {
  private ring: Array<{ hash: number; cellId: string }> = [];
  private cells: Map<string, Cell> = new Map();

  constructor(private readonly config: CellRouterConfig) {
    for (const cell of config.cells) {
      this.cells.set(cell.id, cell);
    }
    this.buildRing();
  }

  routeRequest(routingKey: string): Cell {
    const hash = this.hashKey(routingKey);
    const cell = this.findCell(hash);

    if (!cell.healthy) {
      // Evacuate: route to next healthy cell on the ring
      return this.findNextHealthyCell(hash);
    }

    return cell;
  }

  updateCellHealth(cellId: string, healthy: boolean): void {
    const cell = this.cells.get(cellId);
    if (cell) {
      cell.healthy = healthy;
      if (!healthy) {
        console.warn(`Cell ${cellId} marked unhealthy -- traffic will be evacuated`);
      }
    }
  }

  shiftTraffic(fromCellId: string, toCellId: string, percentage: number): void {
    const from = this.cells.get(fromCellId);
    const to = this.cells.get(toCellId);
    if (!from || !to) return;

    from.weight = Math.max(0, 100 - percentage);
    to.weight = Math.min(100, to.weight + percentage);
    this.buildRing();
  }

  private buildRing(): void {
    this.ring = [];
    for (const cell of this.cells.values()) {
      const nodes = Math.floor(
        this.config.virtualNodesPerCell * (cell.weight / 100)
      );
      for (let i = 0; i < nodes; i++) {
        const hash = this.hashKey(`${cell.id}:${i}`);
        this.ring.push({ hash, cellId: cell.id });
      }
    }
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  private findCell(hash: number): Cell {
    for (const node of this.ring) {
      if (node.hash >= hash) {
        return this.cells.get(node.cellId)!;
      }
    }
    return this.cells.get(this.ring[0].cellId)!;
  }

  private findNextHealthyCell(hash: number): Cell {
    const startIdx = this.ring.findIndex((n) => n.hash >= hash);
    for (let i = 0; i < this.ring.length; i++) {
      const idx = (startIdx + i) % this.ring.length;
      const cell = this.cells.get(this.ring[idx].cellId)!;
      if (cell.healthy) return cell;
    }
    throw new Error("No healthy cells available");
  }

  private hashKey(key: string): number {
    const hash = createHash("md5").update(key).digest();
    return hash.readUInt32BE(0);
  }
}
```

### 2.2 Go -- Cell Manager with Independent Deployment

```go
package cell

import (
    "context"
    "crypto/md5"
    "encoding/binary"
    "fmt"
    "sort"
    "sync"
)

type Cell struct {
    ID       string
    Endpoint string
    Healthy  bool
    Weight   int // 0-100
    Region   string
}

type Manager struct {
    mu           sync.RWMutex
    cells        map[string]*Cell
    ring         []ringNode
    virtualNodes int
}

type ringNode struct {
    hash   uint32
    cellID string
}

func NewManager(virtualNodes int) *Manager {
    return &Manager{
        cells:        make(map[string]*Cell),
        virtualNodes: virtualNodes,
    }
}

func (m *Manager) AddCell(c *Cell) {
    m.mu.Lock()
    defer m.mu.Unlock()
    m.cells[c.ID] = c
    m.rebuildRing()
}

func (m *Manager) RemoveCell(cellID string) {
    m.mu.Lock()
    defer m.mu.Unlock()
    delete(m.cells, cellID)
    m.rebuildRing()
}

func (m *Manager) Route(routingKey string) (*Cell, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()

    if len(m.ring) == 0 {
        return nil, fmt.Errorf("no cells available")
    }

    hash := hashKey(routingKey)
    idx := sort.Search(len(m.ring), func(i int) bool {
        return m.ring[i].hash >= hash
    })
    if idx == len(m.ring) {
        idx = 0
    }

    // Find healthy cell starting from hash position
    for i := 0; i < len(m.ring); i++ {
        pos := (idx + i) % len(m.ring)
        cell := m.cells[m.ring[pos].cellID]
        if cell.Healthy {
            return cell, nil
        }
    }
    return nil, fmt.Errorf("no healthy cells available")
}

func (m *Manager) SetHealth(cellID string, healthy bool) {
    m.mu.Lock()
    defer m.mu.Unlock()
    if cell, ok := m.cells[cellID]; ok {
        cell.Healthy = healthy
    }
}

func (m *Manager) EvacuateCell(cellID string) {
    m.SetHealth(cellID, false) // Traffic auto-reroutes to next healthy cell
}

func (m *Manager) rebuildRing() {
    m.ring = nil
    for _, cell := range m.cells {
        nodes := m.virtualNodes * cell.Weight / 100
        if nodes < 1 && cell.Weight > 0 {
            nodes = 1
        }
        for i := 0; i < nodes; i++ {
            hash := hashKey(fmt.Sprintf("%s:%d", cell.ID, i))
            m.ring = append(m.ring, ringNode{hash: hash, cellID: cell.ID})
        }
    }
    sort.Slice(m.ring, func(i, j int) bool {
        return m.ring[i].hash < m.ring[j].hash
    })
}

func hashKey(key string) uint32 {
    h := md5.Sum([]byte(key))
    return binary.BigEndian.Uint32(h[:4])
}
```

### 2.3 Terraform -- AWS Cell-Based Architecture with Separate VPCs

```hcl
variable "cells" {
  type = map(object({
    cidr_block = string
    region     = string
  }))
  default = {
    "cell-a" = { cidr_block = "10.1.0.0/16", region = "us-east-1" }
    "cell-b" = { cidr_block = "10.2.0.0/16", region = "us-east-1" }
    "cell-c" = { cidr_block = "10.3.0.0/16", region = "us-west-2" }
  }
}

# Each cell gets its own VPC -- complete network isolation
resource "aws_vpc" "cell" {
  for_each   = var.cells
  cidr_block = each.value.cidr_block
  tags       = { Name = "cell-${each.key}", CellID = each.key }
}

# Per-cell database -- no cross-cell data sharing
resource "aws_rds_cluster" "cell_db" {
  for_each           = var.cells
  cluster_identifier = "db-${each.key}"
  engine             = "aurora-postgresql"
  engine_version     = "15.4"
  database_name      = "app"
  vpc_security_group_ids = [aws_security_group.cell_db[each.key].id]
  db_subnet_group_name   = aws_db_subnet_group.cell[each.key].name
}

# Per-cell cache -- independent failure domain
resource "aws_elasticache_replication_group" "cell_cache" {
  for_each                   = var.cells
  replication_group_id       = "cache-${each.key}"
  description                = "Cache for cell ${each.key}"
  node_type                  = "cache.r6g.large"
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  subnet_group_name          = aws_elasticache_subnet_group.cell[each.key].name
}

# Shared cell router -- the only global component
resource "aws_lb" "cell_router" {
  name               = "cell-router"
  internal           = false
  load_balancer_type = "application"
  subnets            = var.router_subnets
}
```

---

## 3. Cell Evacuation and Traffic Shifting

**Evacuation procedure**: Mark cell unhealthy in router, stop new requests,
drain existing connections (30-120s timeout), redistribute traffic to healthy cells
via consistent hashing, perform maintenance, then restore and shift traffic back.

**Canary deployment**: Deploy to a single canary cell first, monitor 15-30 minutes,
then roll out to remaining cells one at a time to limit blast radius.

---

## 4. Best Practices

1. **Minimize cross-cell communication** -- cells should be self-contained; cross-cell calls defeat isolation.
2. **Size cells for acceptable blast radius** -- each cell failure should affect no more than 5% of users.
3. **Use consistent hashing for routing** -- ensure stable mapping of users to cells with minimal reshuffling.
4. **Keep the cell router stateless** -- the router is a shared component and must not become a bottleneck.
5. **Deploy to canary cells first** -- use one cell as a canary before rolling out to the fleet.
6. **Implement cell evacuation automation** -- evacuating a cell must be a one-command operation.
7. **Monitor per-cell metrics independently** -- aggregate dashboards hide cell-specific issues.
8. **Plan data migration for cell splits** -- as traffic grows, split cells with minimal downtime.
9. **Standardize cell infrastructure as code** -- every cell is deployed from the same Terraform/Pulumi modules.
10. **Test cell failure regularly** -- shut down a cell during game days to verify evacuation works.

---

## 5. Anti-Patterns

| #  | Anti-Pattern                          | Problem                                                   | Correction                                                |
|----|---------------------------------------|-----------------------------------------------------------|-----------------------------------------------------------|
| 1  | Shared database across cells          | Database failure affects all cells, defeating isolation    | Give each cell its own database instance                  |
| 2  | Stateful cell router                  | Router becomes a single point of failure and bottleneck   | Keep router stateless; store routing config in DNS/config |
| 3  | Cross-cell synchronous calls          | Latency and failure coupling between cells                | Eliminate cross-cell calls or use async replication       |
| 4  | Uneven cell sizes                     | One cell has 10x more users, creating disproportionate risk | Rebalance cells when size skew exceeds 2x               |
| 5  | No cell evacuation procedure          | Cannot safely drain a cell for maintenance                | Automate evacuation with drain timeout and health checks  |
| 6  | Global deployments instead of per-cell | Bad deploy takes down all cells simultaneously            | Deploy per-cell with canary progression                   |
| 7  | Ignoring per-cell metrics             | Problems in one cell are hidden by fleet-wide aggregates  | Dashboard and alert per-cell, not just globally           |
| 8  | Too many small cells                  | Operational overhead overwhelms the team                  | Size cells to balance blast radius with operational cost  |

---

## 6. Enforcement Checklist

- [ ] Each cell has independent database, cache, and message broker instances.
- [ ] Cell router uses consistent hashing with virtual nodes for even distribution.
- [ ] Cell router is stateless and horizontally scalable.
- [ ] Cell evacuation is automated and tested in game days.
- [ ] Canary cell deployment is the standard for all releases.
- [ ] Per-cell dashboards and alerts exist for latency, error rate, and saturation.
- [ ] Cross-cell communication is documented, justified, and minimized.
- [ ] Cell size is reviewed quarterly and rebalanced when skew exceeds 2x.
- [ ] Cell infrastructure is defined in IaC modules (Terraform/Pulumi).
- [ ] Cell failure scenarios are tested at least quarterly.
