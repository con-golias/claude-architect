# Deployment Strategies

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | DevOps > CI/CD                                               |
| Importance    | Critical                                                     |
| Last Updated  | 2026-03-10                                                   |
| Cross-ref     | [Feature Flags](feature-flags.md), [GitOps](gitops.md)      |

---

## Core Concepts

### Deployment Strategy Overview

Choose a deployment strategy based on risk tolerance, infrastructure cost, and required
rollback speed. Every strategy is a trade-off between safety and complexity.

```
Risk ──────────────────────────────────────────► Safety
Low                                              High

Recreate → Rolling → Blue-Green → Canary → Shadow
  │          │          │           │         │
  Simplest   Moderate   Instant     Metric    Zero user
  Downtime   Zero-DT    rollback    driven    impact
  Cheap      Default    2x infra    Complex   Most complex
```

### Recreate Strategy

Terminate all existing instances, then deploy the new version. The simplest strategy
but causes downtime.

**When acceptable:**
- Development and staging environments
- Batch processing systems with maintenance windows
- Applications where brief downtime is contractually acceptable
- Database schema changes that require exclusive access

```yaml
# Kubernetes Recreate deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: batch-processor
spec:
  replicas: 3
  strategy:
    type: Recreate    # All pods killed, then all recreated
  template:
    spec:
      containers:
      - name: processor
        image: myapp/processor:2.1.0
        resources:
          requests:
            cpu: "500m"
            memory: "512Mi"
```

### Rolling Deployment

Replace instances incrementally. The default Kubernetes strategy. Old and new versions
coexist temporarily, so ensure backward compatibility.

```yaml
# Kubernetes Rolling Update
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  replicas: 6
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2        # Max 2 extra pods during update
      maxUnavailable: 1   # At most 1 pod unavailable
  template:
    spec:
      containers:
      - name: api
        image: myapp/api:3.2.0
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 3
        livenessProbe:
          httpGet:
            path: /livez
            port: 8080
          initialDelaySeconds: 15
          periodSeconds: 10
      terminationGracePeriodSeconds: 30
```

**Rollback:** `kubectl rollout undo deployment/api-server` reverts to the previous
ReplicaSet. Kubernetes retains revision history (configurable via `revisionHistoryLimit`).

**Health check requirements:**
- `readinessProbe` -- gates traffic to new pods (must pass before receiving requests)
- `livenessProbe` -- restarts unhealthy pods
- `startupProbe` -- for slow-starting applications (prevents premature liveness kills)

### Blue-Green Deployment

Maintain two identical environments ("blue" = current, "green" = new). Deploy to the
inactive environment, validate, then switch traffic atomically.

```
          ┌─────────────┐
          │ Load Balancer│
          │   / Router   │
          └──────┬───────┘
                 │
        Switch   │   (atomic cutover)
        ┌────────┼────────┐
        │        │        │
   ┌────▼───┐         ┌──▼─────┐
   │ Blue   │         │ Green  │
   │ v2.0.0 │         │ v2.1.0 │
   │(active)│         │ (new)  │
   └────────┘         └────────┘
```

```yaml
# Blue-Green with Kubernetes Services
# Step 1: Deploy green alongside blue
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-green
  labels:
    app: api
    version: green
spec:
  replicas: 6
  selector:
    matchLabels:
      app: api
      version: green
  template:
    metadata:
      labels:
        app: api
        version: green
    spec:
      containers:
      - name: api
        image: myapp/api:3.2.0
---
# Step 2: Switch service selector to green
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  selector:
    app: api
    version: green    # Flip from "blue" to "green"
  ports:
  - port: 80
    targetPort: 8080
```

**Database considerations:** Blue-green is straightforward for stateless services.
For databases, use the expand-contract migration pattern (see section below).

**Cost:** Requires 2x infrastructure during transition. Mitigate by scaling down the
inactive environment to minimum replicas after cutover.

### Canary Deployment

Route a small percentage of traffic to the new version. Monitor metrics. Gradually
increase traffic if metrics are healthy; roll back instantly if they degrade.

```
         ┌──────────────┐
         │ Traffic Split │
         └──┬────────┬──┘
            │        │
           95%      5%
            │        │
       ┌────▼───┐ ┌──▼──────┐
       │ Stable │ │ Canary  │
       │ v2.0.0 │ │ v2.1.0  │
       │ 6 pods │ │ 1 pod   │
       └────────┘ └─────────┘
              │
   Metrics OK? ──► Promote: 10% → 25% → 50% → 100%
   Metrics bad? ──► Rollback: 0% instantly
```

**Argo Rollouts Canary Configuration:**

```yaml
# Argo Rollouts canary with automated analysis
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api-rollout
spec:
  replicas: 10
  strategy:
    canary:
      canaryService: api-canary
      stableService: api-stable
      trafficRouting:
        nginx:
          stableIngress: api-ingress
          annotationPrefix: nginx.ingress.kubernetes.io
      steps:
      - setWeight: 5
      - pause: { duration: 5m }
      - analysis:
          templates:
          - templateName: success-rate
          args:
          - name: service-name
            value: api-canary
      - setWeight: 25
      - pause: { duration: 10m }
      - analysis:
          templates:
          - templateName: success-rate
      - setWeight: 50
      - pause: { duration: 10m }
      - setWeight: 100
  revisionHistoryLimit: 3
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  metrics:
  - name: success-rate
    interval: 60s
    count: 5
    successCondition: result[0] >= 0.99
    failureLimit: 2
    provider:
      prometheus:
        address: http://prometheus.monitoring:9090
        query: |
          sum(rate(http_requests_total{
            service="{{args.service-name}}",
            status=~"2.."
          }[2m]))
          /
          sum(rate(http_requests_total{
            service="{{args.service-name}}"
          }[2m]))
```

### Canary vs A/B Testing

| Aspect         | Canary                             | A/B Testing                        |
|---------------|-------------------------------------|-------------------------------------|
| Goal          | Validate deployment safety          | Measure feature effectiveness       |
| Traffic split | Percentage-based (random)           | Segment-based (user attributes)     |
| Metrics       | Error rate, latency, CPU            | Conversion rate, engagement         |
| Duration      | Minutes to hours                    | Days to weeks                       |
| Rollback      | Automatic on degradation            | Manual after statistical significance|
| Tooling       | Argo Rollouts, Flagger             | LaunchDarkly, Optimizely, Unleash   |

### Shadow (Dark) Deployment

Mirror production traffic to the new version without returning its responses to users.
Compare behavior, performance, and correctness with zero user impact.

```yaml
# Istio traffic mirroring
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-shadow
spec:
  hosts:
  - api.example.com
  http:
  - route:
    - destination:
        host: api-stable
        port:
          number: 80
      weight: 100
    mirror:
      host: api-canary
      port:
        number: 80
    mirrorPercentage:
      value: 100.0    # Mirror all traffic; adjust to reduce load
```

**Caution:** Shadow deployments must not perform side effects (writes, payments,
emails). Use read-only mode or mock external dependencies in the shadow environment.

### Feature-Flag-Driven Deployment

Decouple deployment from release. Deploy code to production with the feature behind a
flag. Enable gradually. See [Feature Flags](feature-flags.md) for full coverage.

```typescript
// Deploy code, release via flag
async function handleRequest(req: Request): Promise<Response> {
  const user = await getUser(req);

  if (await featureFlags.isEnabled('new-checkout-flow', user)) {
    return newCheckoutHandler(req);  // New code path
  }
  return legacyCheckoutHandler(req);  // Existing path
}
```

**Advantages:** Instant rollback (disable flag), per-user targeting, no infrastructure
duplication. **Trade-off:** Added code complexity, flag cleanup discipline required.

### Nginx Traffic Splitting (Without Service Mesh)

```nginx
# nginx.conf -- weight-based canary without Istio/Argo
upstream api_backend {
    server api-stable:8080 weight=95;
    server api-canary:8080 weight=5;
}

# Cookie-based sticky canary (user stays on same version)
map $cookie_canary $backend {
    "true"   api-canary;
    default  api-stable;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://$backend;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Progressive Delivery

Progressive delivery is the umbrella term for deployment strategies that incrementally
expose changes to users with automated safety gates. It combines canary, feature flags,
and observability.

**Deployment orchestrators:**

| Tool            | Model              | Strengths                                     |
|----------------|---------------------|-----------------------------------------------|
| Argo Rollouts  | K8s CRD            | Native K8s, canary + blue-green, analysis     |
| Flagger        | K8s operator        | Works with Istio/Linkerd/Nginx/Contour        |
| Spinnaker      | Standalone platform | Multi-cloud, pipeline UI, mature              |

### Database Migration Strategies for Zero-Downtime Deploys

Database schema changes are the hardest part of zero-downtime deployments.
Use the **expand-contract** (also called "parallel change") pattern.

```
Phase 1: EXPAND                 Phase 2: MIGRATE              Phase 3: CONTRACT
┌──────────────────┐           ┌──────────────────┐          ┌──────────────────┐
│ Add new column   │           │ Backfill data    │          │ Drop old column  │
│ (nullable)       │           │ Dual-write both  │          │ Remove dual-write│
│ Keep old column  │           │ columns          │          │ Code uses new    │
│ Old code works   │           │ Old+new code work│          │ column only      │
└──────────────────┘           └──────────────────┘          └──────────────────┘
     Deploy v2.0                    Deploy v2.1                  Deploy v2.2
```

```sql
-- Phase 1: Expand (non-breaking, backward compatible)
ALTER TABLE users ADD COLUMN full_name VARCHAR(255);

-- Phase 2: Migrate (backfill + dual-write in application code)
UPDATE users SET full_name = CONCAT(first_name, ' ', last_name)
WHERE full_name IS NULL;
-- Application writes to BOTH old and new columns

-- Phase 3: Contract (after all code uses new column)
ALTER TABLE users DROP COLUMN first_name;
ALTER TABLE users DROP COLUMN last_name;
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
```

**Rules for zero-downtime migrations:**
- Never rename a column in one step (expand-contract instead)
- Never add a NOT NULL column without a default
- Never drop a column still referenced by the previous app version
- Run migrations as a separate step before deploying application code
- Use migration tools that support transactional DDL (Flyway, Alembic, golang-migrate)

### Rollback Strategies

| Strategy              | Speed      | Reliability | Notes                                   |
|----------------------|------------|-------------|-----------------------------------------|
| Kubernetes rollback  | Seconds    | High        | `kubectl rollout undo`; uses ReplicaSet |
| Blue-green switch    | Seconds    | Highest     | Flip traffic back to previous env       |
| Canary abort         | Seconds    | High        | Remove canary weight, 100% to stable    |
| Feature flag disable | Seconds    | High        | No deployment needed                    |
| Database rollback    | Minutes    | Medium      | Requires backward-compatible migrations |
| Full redeployment    | Minutes    | Medium      | Redeploy previous artifact from registry|

**Automate rollback triggers:**
- Error rate exceeds baseline + 2 standard deviations
- P99 latency exceeds SLO threshold
- Health check failures exceed threshold
- Custom business metric degradation (e.g., checkout conversion drops 5%)

---

## Best Practices

1. **Default to rolling deployments.** Rolling updates are built into Kubernetes, require
   no additional tooling, and handle most services. Upgrade to canary or blue-green only
   when the risk profile demands it.

2. **Always configure health checks.** Every deployment must have readiness and liveness
   probes. Without them, rolling updates route traffic to unready pods and canary analysis
   has no signal to evaluate.

3. **Automate rollback with metric-based triggers.** Define SLO-based rollback conditions
   in Argo Rollouts AnalysisTemplates or Flagger MetricTemplates. Human-in-the-loop
   rollback is too slow for production incidents.

4. **Use expand-contract for database changes.** Never perform backward-incompatible
   schema changes in a single deployment. Spread the change across 2-3 releases to
   ensure both old and new application versions work at every step.

5. **Implement canary for customer-facing services.** Any service handling user traffic
   should use canary or progressive delivery. Validate with real traffic before full rollout.

6. **Set `terminationGracePeriodSeconds` appropriately.** Give in-flight requests time to
   complete. Default 30s is insufficient for long-running API calls. Match it to your
   longest expected request duration plus a buffer.

7. **Test rollback procedures regularly.** Schedule monthly rollback drills. A rollback
   procedure that has never been tested will fail when needed most.

8. **Separate database migrations from application deployments.** Run migrations as a
   distinct pipeline step that completes before the application deployment begins.
   This enables independent rollback of each layer.

9. **Use deployment slots or traffic headers for pre-production validation.** Route
   internal team traffic to the new version via headers before opening to external
   users. This provides a final human validation step.

10. **Document strategy selection criteria.** Maintain an ADR that explains which
    deployment strategy applies to which service tier and why. Review when adding
    new services.

---

## Anti-Patterns

| Anti-Pattern                            | Impact                                          | Fix                                                      |
|-----------------------------------------|-------------------------------------------------|----------------------------------------------------------|
| Deploy without health checks            | Traffic routed to broken pods                   | Require readiness/liveness probes in all deployments     |
| Big-bang deployments (recreate in prod)  | Full downtime for all users                     | Use rolling or canary; reserve recreate for dev/staging  |
| Manual rollback only                    | Slow response; MTTR measured in hours           | Automate rollback with metric-based triggers             |
| Breaking schema change in one deploy    | Old pods crash on new schema                    | Use expand-contract pattern across multiple releases     |
| Canary without metrics analysis         | Human must watch dashboards during every deploy | Define AnalysisTemplate with automatic success/failure   |
| Blue-green without database strategy    | New version corrupts shared database            | Use expand-contract migrations; version APIs             |
| Ignoring connection draining            | Users see 502/503 during deploy                 | Set `terminationGracePeriodSeconds`; use preStop hooks   |
| Same strategy for all services          | Over-engineering batch jobs; under-protecting APIs| Match strategy to service criticality and traffic profile|

---

## Enforcement Checklist

- [ ] Every Kubernetes Deployment has readiness and liveness probes configured
- [ ] Rolling update `maxSurge` and `maxUnavailable` are tuned per service
- [ ] Customer-facing services use canary or blue-green deployment
- [ ] Argo Rollouts or Flagger is configured with AnalysisTemplates
- [ ] Rollback is automated and triggers on error rate / latency SLO breach
- [ ] Database migrations use expand-contract pattern (documented in ADR)
- [ ] Migrations run as a separate CI/CD step before application deployment
- [ ] `terminationGracePeriodSeconds` matches the longest expected request + buffer
- [ ] Rollback drills are scheduled monthly and results are documented
- [ ] Deployment strategy is documented per service in the service catalog
- [ ] Shadow/dark deployments are used for high-risk changes before canary
- [ ] Feature flags are available as an instant rollback mechanism for new features
