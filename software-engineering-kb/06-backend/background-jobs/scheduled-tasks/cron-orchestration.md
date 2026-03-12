# Cron & Task Orchestration

> **AI Plugin Directive — Cron Jobs & Task Orchestration in Production**
> You are an AI coding assistant. When generating, reviewing, or refactoring cron jobs and
> orchestration code, follow EVERY rule in this document. Production cron jobs require proper
> infrastructure, monitoring, and failure handling. Treat each section as non-negotiable.

**Core Rule: ALWAYS run cron jobs in isolated containers or dedicated workers — NEVER inside your API server process. ALWAYS monitor execution with alerting on failure. ALWAYS implement graceful shutdown to prevent interrupted jobs.**

---

## 1. Kubernetes CronJob

The PREFERRED method for containerized applications:

```yaml
# cleanup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cleanup-expired-sessions
  namespace: production
spec:
  schedule: "*/15 * * * *"     # Every 15 minutes
  timeZone: "America/New_York" # K8s 1.27+ supports timezone
  concurrencyPolicy: Forbid    # NEVER run concurrent instances
  startingDeadlineSeconds: 300  # Skip if 5 min late
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      backoffLimit: 2          # Retry failed jobs 2 times
      activeDeadlineSeconds: 600 # Kill if running > 10 min
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: cleanup
              image: myapp:latest
              command: ["node", "scripts/cleanup-sessions.js"]
              resources:
                requests:
                  cpu: "100m"
                  memory: "256Mi"
                limits:
                  cpu: "500m"
                  memory: "512Mi"
              env:
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: db-credentials
                      key: url
```

### 1.1 Concurrency Policies

| Policy | Behavior | Use Case |
|--------|----------|----------|
| **Forbid** | Skip new run if previous still running | PREFERRED — prevents overlap |
| **Replace** | Cancel running job, start new one | Time-sensitive, latest matters |
| **Allow** | Run concurrent instances | Independent, no shared state |

ALWAYS use `Forbid` unless you have a specific reason for concurrent execution.

### 1.2 Multiple CronJobs Example

```yaml
# daily-reports.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-financial-report
spec:
  schedule: "0 6 * * *"
  timeZone: "UTC"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 3600  # 1 hour max
      template:
        spec:
          restartPolicy: Never     # Don't restart — DLQ instead
          containers:
            - name: report
              image: myapp:latest
              command: ["node", "scripts/daily-report.js"]

---
# weekly-digest.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: weekly-email-digest
spec:
  schedule: "0 9 * * 1"  # Monday 9 AM
  timeZone: "America/New_York"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 7200  # 2 hours max
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: digest
              image: myapp:latest
              command: ["node", "scripts/weekly-digest.js"]
```

---

## 2. Task Orchestration Patterns

### 2.1 Sequential Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│               Sequential Pipeline                             │
│                                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│  │ Extract  │───►│Transform │───►│  Load    │               │
│  │ Data     │    │ Data     │    │ Data     │               │
│  └──────────┘    └──────────┘    └──────────┘               │
│                                                               │
│  Each step depends on the previous step's output.            │
│  If step 2 fails, step 3 does not run.                       │
│  ALWAYS checkpoint after each step for resumability.         │
└──────────────────────────────────────────────────────────────┘
```

```typescript
interface PipelineStep {
  name: string;
  execute: (input: any) => Promise<any>;
  compensate?: (input: any) => Promise<void>; // Rollback on failure
}

class Pipeline {
  private steps: PipelineStep[] = [];
  private completedSteps: string[] = [];

  addStep(step: PipelineStep): this {
    this.steps.push(step);
    return this;
  }

  async execute(initialInput: any, pipelineId: string): Promise<any> {
    let input = initialInput;

    // Resume from checkpoint if available
    const checkpoint = await this.loadCheckpoint(pipelineId);
    const startIndex = checkpoint?.lastCompletedStep
      ? this.steps.findIndex((s) => s.name === checkpoint.lastCompletedStep) + 1
      : 0;

    if (checkpoint?.lastOutput) {
      input = checkpoint.lastOutput;
    }

    for (let i = startIndex; i < this.steps.length; i++) {
      const step = this.steps[i];

      try {
        input = await step.execute(input);
        this.completedSteps.push(step.name);

        // Checkpoint after each step
        await this.saveCheckpoint(pipelineId, step.name, input);
      } catch (error) {
        // Compensate completed steps in reverse order
        for (let j = this.completedSteps.length - 1; j >= 0; j--) {
          const completedStep = this.steps.find(
            (s) => s.name === this.completedSteps[j]
          );
          await completedStep?.compensate?.(input);
        }
        throw error;
      }
    }

    // Clean up checkpoint on success
    await this.deleteCheckpoint(pipelineId);
    return input;
  }
}

// Usage
const reportPipeline = new Pipeline()
  .addStep({
    name: "fetch-data",
    execute: async () => fetchSalesData(),
  })
  .addStep({
    name: "aggregate",
    execute: async (data) => aggregateSalesData(data),
  })
  .addStep({
    name: "generate-pdf",
    execute: async (aggregated) => generatePDF(aggregated),
  })
  .addStep({
    name: "send-email",
    execute: async (pdf) => sendReport(pdf),
  });

await reportPipeline.execute(null, "daily-report-2024-03-09");
```

### 2.2 Fan-Out / Fan-In

```
┌──────────────────────────────────────────────────────────────┐
│              Fan-Out / Fan-In Pattern                          │
│                                                               │
│                    ┌──────────┐                               │
│                    │ Dispatch │                               │
│                    └─────┬────┘                               │
│               ┌──────────┼──────────┐                        │
│               ▼          ▼          ▼                         │
│          ┌────────┐ ┌────────┐ ┌────────┐                    │
│          │ Task A │ │ Task B │ │ Task C │  (parallel)        │
│          └───┬────┘ └───┬────┘ └───┬────┘                    │
│              └──────────┼──────────┘                         │
│                         ▼                                     │
│                    ┌──────────┐                               │
│                    │ Collect  │  (wait for all)               │
│                    └──────────┘                               │
│                                                               │
│  Use for: Image processing, report generation,               │
│  batch notifications, data migration                         │
└──────────────────────────────────────────────────────────────┘
```

```typescript
import { FlowProducer } from "bullmq";

const flow = new FlowProducer({ connection });

// Fan-out: dispatch parallel tasks, fan-in: parent waits for all
await flow.add({
  name: "monthly-report",
  queueName: "reports",
  data: { month: "2024-03" },
  children: [
    { name: "fetch-revenue", queueName: "data", data: { metric: "revenue" } },
    { name: "fetch-users", queueName: "data", data: { metric: "users" } },
    { name: "fetch-churn", queueName: "data", data: { metric: "churn" } },
    { name: "fetch-nps", queueName: "data", data: { metric: "nps" } },
  ],
});

// Parent job runs AFTER all children complete
// Children results available via job.getChildrenValues()
```

### 2.3 Saga Pattern (Distributed Transactions)

```
┌──────────────────────────────────────────────────────────────┐
│                    Saga Pattern                               │
│                                                               │
│  Step 1: Create Order → Compensate: Cancel Order             │
│  Step 2: Reserve Stock → Compensate: Release Stock           │
│  Step 3: Charge Payment → Compensate: Refund Payment         │
│  Step 4: Ship Order → Compensate: Cancel Shipment            │
│                                                               │
│  If Step 3 fails:                                             │
│  ├── Compensate Step 2 (release stock)                       │
│  ├── Compensate Step 1 (cancel order)                        │
│  └── Step 4 never executes                                   │
│                                                               │
│  ALWAYS execute compensations in reverse order.              │
│  EVERY compensation MUST be idempotent.                       │
└──────────────────────────────────────────────────────────────┘
```

```typescript
interface SagaStep<T> {
  name: string;
  execute: (ctx: T) => Promise<T>;
  compensate: (ctx: T) => Promise<void>;
}

class Saga<T> {
  private steps: SagaStep<T>[] = [];

  addStep(step: SagaStep<T>): this {
    this.steps.push(step);
    return this;
  }

  async execute(initialCtx: T): Promise<T> {
    const completed: SagaStep<T>[] = [];
    let ctx = initialCtx;

    for (const step of this.steps) {
      try {
        ctx = await step.execute(ctx);
        completed.push(step);
      } catch (error) {
        // Compensate in reverse order
        for (const completedStep of completed.reverse()) {
          try {
            await completedStep.compensate(ctx);
          } catch (compError) {
            logger.error(`Compensation failed: ${completedStep.name}`, compError);
            // Log for manual intervention — do NOT stop compensation chain
          }
        }
        throw error;
      }
    }

    return ctx;
  }
}

// Usage
const orderSaga = new Saga<OrderContext>()
  .addStep({
    name: "create-order",
    execute: async (ctx) => { ctx.orderId = await createOrder(ctx); return ctx; },
    compensate: async (ctx) => { await cancelOrder(ctx.orderId); },
  })
  .addStep({
    name: "reserve-stock",
    execute: async (ctx) => { await reserveStock(ctx.orderId, ctx.items); return ctx; },
    compensate: async (ctx) => { await releaseStock(ctx.orderId); },
  })
  .addStep({
    name: "charge-payment",
    execute: async (ctx) => { ctx.paymentId = await chargePayment(ctx); return ctx; },
    compensate: async (ctx) => { await refundPayment(ctx.paymentId); },
  });

await orderSaga.execute({ userId: "user-123", items: [...] });
```

---

## 3. Monitoring & Alerting

ALWAYS monitor scheduled tasks with these metrics:

| Metric | Alert Condition | Action |
|--------|----------------|--------|
| Execution duration | > 2x expected duration | Investigate performance |
| Last successful run | > 2x schedule interval | Task is failing/stuck |
| Failure count | > 0 per run | Check error logs |
| Skipped runs | > 2 consecutive | Previous run still executing |
| Memory usage | > 80% of limit | Optimize or increase limits |
| DLQ depth | > 0 | Manual intervention needed |

```typescript
// Structured task execution logging
async function executeScheduledTask(
  taskName: string,
  fn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  const runId = randomUUID();

  logger.info("Scheduled task started", {
    task: taskName,
    runId,
    timestamp: new Date().toISOString(),
  });

  try {
    await fn();

    const duration = Date.now() - startTime;
    logger.info("Scheduled task completed", {
      task: taskName,
      runId,
      durationMs: duration,
      status: "success",
    });

    metrics.histogram("scheduled_task.duration_ms", duration, { task: taskName });
    metrics.increment("scheduled_task.completed", { task: taskName });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error("Scheduled task failed", {
      task: taskName,
      runId,
      durationMs: duration,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    metrics.increment("scheduled_task.failed", { task: taskName });

    // Alert on failure
    await alerting.send({
      severity: "high",
      title: `Scheduled task failed: ${taskName}`,
      description: (error as Error).message,
      runId,
    });

    throw error;
  }
}
```

---

## 4. Task Registry Pattern

ALWAYS register all scheduled tasks in a central registry:

```typescript
interface ScheduledTaskConfig {
  name: string;
  schedule: string;         // Cron expression
  timezone: string;         // IANA timezone
  timeout: number;          // Max execution time (ms)
  enabled: boolean;
  handler: () => Promise<void>;
  description: string;
}

const TASK_REGISTRY: ScheduledTaskConfig[] = [
  {
    name: "cleanup-expired-sessions",
    schedule: "*/15 * * * *",
    timezone: "UTC",
    timeout: 120_000,
    enabled: true,
    handler: cleanupExpiredSessions,
    description: "Remove expired sessions from Redis and database",
  },
  {
    name: "daily-financial-report",
    schedule: "0 6 * * *",
    timezone: "America/New_York",
    timeout: 3600_000,
    enabled: true,
    handler: generateDailyFinancialReport,
    description: "Generate and email daily financial summary",
  },
  {
    name: "weekly-digest-email",
    schedule: "0 9 * * 1",
    timezone: "America/New_York",
    timeout: 7200_000,
    enabled: true,
    handler: sendWeeklyDigest,
    description: "Send weekly activity digest to all users",
  },
  {
    name: "monthly-billing",
    schedule: "0 0 1 * *",
    timezone: "UTC",
    timeout: 14400_000,
    enabled: true,
    handler: processMonthlyBilling,
    description: "Process subscription renewals and generate invoices",
  },
];

// Register all tasks
function registerScheduledTasks(scheduler: DistributedScheduler) {
  for (const task of TASK_REGISTRY) {
    if (!task.enabled) continue;

    cron.schedule(task.schedule, async () => {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Task timeout: ${task.name}`)), task.timeout)
      );

      await Promise.race([
        scheduler.executeScheduled(task.name, () =>
          executeScheduledTask(task.name, task.handler)
        ),
        timeoutPromise,
      ]);
    }, { timezone: task.timezone });
  }

  logger.info(`Registered ${TASK_REGISTRY.filter((t) => t.enabled).length} scheduled tasks`);
}
```

---

## 5. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Cron inside API server | Task runs on all pods, restart kills it | Separate worker process or K8s CronJob |
| No execution timeout | Stuck task blocks all future runs | Set `activeDeadlineSeconds` or code-level timeout |
| No checkpoint/resume | Long pipeline restarts from scratch on failure | Checkpoint after each step |
| Ignoring compensation failures | Partial rollback, inconsistent state | Log and alert, continue compensation chain |
| No task registry | Tasks scattered across codebase | Central registry with all configs |
| No alerting on failure | Failed tasks go unnoticed for days | Alert on every failure, dashboard for status |
| Missing concurrencyPolicy | Previous run overlaps with new run | Set `concurrencyPolicy: Forbid` (K8s) |
| No retention limits | Completed job history fills storage | Set `successfulJobsHistoryLimit` |
| Hard-coded schedules | Schedule change requires code deploy | Config-driven or database-stored schedules |
| No graceful shutdown | Jobs killed mid-execution | Handle SIGTERM, finish current step |

---

## 6. Enforcement Checklist

- [ ] All scheduled tasks run in dedicated workers or K8s CronJobs — NEVER in API server
- [ ] Leader election or `concurrencyPolicy: Forbid` prevents duplicate execution
- [ ] Every scheduled task has an execution timeout
- [ ] All tasks registered in a central task registry with metadata
- [ ] Execution logged with run ID, duration, status
- [ ] Alerting configured for failed tasks
- [ ] Pipeline tasks checkpoint after each step for resumability
- [ ] Saga compensations run in reverse order and are idempotent
- [ ] IANA timezones used for all schedules
- [ ] Graceful shutdown implemented for long-running tasks
- [ ] Task history retention limits configured
- [ ] Dashboard available for task execution status and history
