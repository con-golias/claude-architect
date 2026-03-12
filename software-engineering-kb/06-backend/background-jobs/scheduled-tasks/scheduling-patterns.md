# Scheduling Patterns

> **AI Plugin Directive — Scheduled Task Patterns & Design**
> You are an AI coding assistant. When generating, reviewing, or refactoring scheduled task code,
> follow EVERY rule in this document. Improperly scheduled tasks cause duplicate execution,
> missed runs, and resource contention. Treat each section as non-negotiable.

**Core Rule: NEVER use in-process timers (setInterval, time.Ticker) for production scheduled tasks — they are lost on process restart and execute on every instance. ALWAYS use a distributed scheduler with leader election or a dedicated scheduling service. EVERY scheduled task MUST be idempotent.**

---

## 1. Scheduling Methods

```
┌──────────────────────────────────────────────────────────────┐
│              Scheduling Methods Comparison                    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  In-Process Timers (NEVER in production)              │    │
│  │  ├── setInterval / setTimeout (Node.js)              │    │
│  │  ├── time.Ticker / time.AfterFunc (Go)               │    │
│  │  ├── threading.Timer (Python)                        │    │
│  │  └── Problems: lost on restart, runs on every pod    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  OS-Level Cron (simple deployments)                   │    │
│  │  ├── Linux crontab                                   │    │
│  │  ├── Single machine only                             │    │
│  │  └── No built-in monitoring or retry                 │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Distributed Schedulers (PREFERRED)                   │    │
│  │  ├── BullMQ Repeatable Jobs                          │    │
│  │  ├── Kubernetes CronJob                              │    │
│  │  ├── Temporal / Inngest                              │    │
│  │  ├── pg-boss (PostgreSQL)                            │    │
│  │  └── AWS EventBridge / CloudWatch Events             │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

| Method | Distributed | Persistence | Monitoring | Use Case |
|--------|------------|-------------|------------|----------|
| `setInterval` | NO | NO | NO | NEVER in production |
| OS Cron | NO | NO | Basic (logs) | Single-server, simple tasks |
| **BullMQ Repeatable** | YES | YES (Redis) | YES | Node.js apps |
| **Kubernetes CronJob** | YES | YES | YES | Containerized workloads |
| **pg-boss** | YES | YES (Postgres) | YES | Postgres-based apps |
| **Temporal** | YES | YES | Full | Complex workflows |
| **AWS EventBridge** | YES | Managed | YES | AWS serverless |

---

## 2. Cron Expression Syntax

```
┌─────────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌─────────── day of month (1-31)
│ │ │ ┌───────── month (1-12)
│ │ │ │ ┌─────── day of week (0-7, 0 and 7 = Sunday)
│ │ │ │ │
* * * * *

Common Patterns:
├── */5 * * * *      Every 5 minutes
├── 0 * * * *        Every hour (at :00)
├── 0 */2 * * *      Every 2 hours
├── 0 0 * * *        Daily at midnight
├── 0 0 * * 1        Every Monday at midnight
├── 0 0 1 * *        First day of every month
├── 0 0 1 1 *        January 1st at midnight (yearly)
├── 30 4 * * *       Daily at 4:30 AM
├── 0 9 * * 1-5      Weekdays at 9 AM
└── 0 0 */2 * *      Every 2 days at midnight
```

ALWAYS use human-readable cron libraries to avoid expression errors:

```typescript
// GOOD — human-readable ✅
import { CronJob } from "cron";

new CronJob("0 */5 * * * *", handler); // Every 5 minutes

// BETTER — named constants ✅
const SCHEDULES = {
  EVERY_5_MINUTES: "*/5 * * * *",
  EVERY_HOUR: "0 * * * *",
  DAILY_MIDNIGHT: "0 0 * * *",
  DAILY_4AM: "0 4 * * *",
  WEEKLY_MONDAY: "0 0 * * 1",
  MONTHLY_FIRST: "0 0 1 * *",
} as const;
```

---

## 3. Distributed Scheduling with Leader Election

ALWAYS ensure only ONE instance executes a scheduled task at a time:

### 3.1 Redis-Based Leader Election

```typescript
class DistributedScheduler {
  private lockPrefix = "scheduler:lock:";
  private leaderId = randomUUID();

  constructor(
    private redis: Redis,
    private lockTTL: number = 30_000 // 30 seconds
  ) {}

  async acquireLock(taskName: string): Promise<boolean> {
    // SET NX (only if not exists) + PX (TTL in ms)
    const result = await this.redis.set(
      `${this.lockPrefix}${taskName}`,
      this.leaderId,
      "PX",
      this.lockTTL,
      "NX"
    );
    return result === "OK";
  }

  async releaseLock(taskName: string): Promise<void> {
    // Release ONLY if we hold the lock (Lua script for atomicity)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      end
      return 0
    `;
    await this.redis.eval(script, 1, `${this.lockPrefix}${taskName}`, this.leaderId);
  }

  async executeScheduled(
    taskName: string,
    fn: () => Promise<void>
  ): Promise<boolean> {
    const acquired = await this.acquireLock(taskName);
    if (!acquired) {
      return false; // Another instance is running this task
    }

    try {
      await fn();
      return true;
    } finally {
      await this.releaseLock(taskName);
    }
  }
}

// Usage
const scheduler = new DistributedScheduler(redis);

// Every instance runs the cron, but only the leader executes
cron.schedule("0 4 * * *", async () => {
  const executed = await scheduler.executeScheduled("daily-cleanup", async () => {
    await cleanupExpiredSessions();
    await purgeOldLogs();
  });

  if (executed) {
    logger.info("Daily cleanup completed");
  } else {
    logger.debug("Daily cleanup skipped (another instance is leader)");
  }
});
```

**Go**
```go
type DistributedScheduler struct {
    rdb      *redis.Client
    leaderID string
    lockTTL  time.Duration
}

func (s *DistributedScheduler) AcquireLock(ctx context.Context, taskName string) (bool, error) {
    key := "scheduler:lock:" + taskName
    ok, err := s.rdb.SetNX(ctx, key, s.leaderID, s.lockTTL).Result()
    return ok, err
}

func (s *DistributedScheduler) ReleaseLock(ctx context.Context, taskName string) error {
    script := redis.NewScript(`
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        end
        return 0
    `)
    return script.Run(ctx, s.rdb, []string{"scheduler:lock:" + taskName}, s.leaderID).Err()
}

func (s *DistributedScheduler) Execute(ctx context.Context, taskName string, fn func() error) (bool, error) {
    acquired, err := s.AcquireLock(ctx, taskName)
    if err != nil || !acquired {
        return false, err
    }
    defer s.ReleaseLock(ctx, taskName)
    return true, fn()
}
```

---

## 4. BullMQ Repeatable Jobs

PREFERRED method for Node.js applications:

```typescript
import { Queue, Worker } from "bullmq";

const scheduledQueue = new Queue("scheduled", { connection });

// Define repeatable jobs
async function setupScheduledJobs() {
  // Every 5 minutes — cleanup expired sessions
  await scheduledQueue.add("cleanup-sessions", {}, {
    repeat: { pattern: "*/5 * * * *" },
    jobId: "cleanup-sessions", // Fixed ID prevents duplicates
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 50 },
  });

  // Daily at 4 AM — generate reports
  await scheduledQueue.add("generate-daily-report", {}, {
    repeat: { pattern: "0 4 * * *" },
    jobId: "generate-daily-report",
  });

  // Every Monday at 9 AM — send weekly digest
  await scheduledQueue.add("weekly-digest", {}, {
    repeat: { pattern: "0 9 * * 1" },
    jobId: "weekly-digest",
  });

  // Every 30 seconds — health check
  await scheduledQueue.add("health-check", {}, {
    repeat: { every: 30_000 }, // Interval-based (not cron)
    jobId: "health-check",
  });
}

// Worker processes scheduled jobs
const scheduledWorker = new Worker("scheduled", async (job) => {
  switch (job.name) {
    case "cleanup-sessions":
      await cleanupExpiredSessions();
      break;
    case "generate-daily-report":
      await generateDailyReport(new Date());
      break;
    case "weekly-digest":
      await sendWeeklyDigest();
      break;
    case "health-check":
      await performHealthCheck();
      break;
  }
}, { connection, concurrency: 1 });
```

- ALWAYS use a fixed `jobId` for repeatable jobs — prevents duplicates on restart
- ALWAYS set `concurrency: 1` for scheduled workers unless jobs are independent
- BullMQ automatically handles leader election for repeatable jobs — only one instance creates the scheduled run

---

## 5. Common Scheduled Task Categories

| Category | Examples | Frequency | Priority |
|----------|---------|-----------|----------|
| **Cleanup** | Expired sessions, old tokens, temp files | Every 5-60 min | LOW |
| **Aggregation** | Daily stats, weekly reports, monthly billing | Daily/weekly/monthly | MEDIUM |
| **Sync** | External data sync, cache refresh | Every 1-15 min | MEDIUM |
| **Notifications** | Digest emails, reminders, renewals | Daily/weekly | HIGH |
| **Maintenance** | DB vacuum, index rebuild, log rotation | Daily/weekly | LOW |
| **Monitoring** | Health checks, SLA checks, alerting | Every 30s-5min | HIGH |
| **Billing** | Subscription renewal, invoice generation | Monthly | CRITICAL |

---

## 6. Timezone & DST Handling

ALWAYS handle timezones explicitly in scheduled tasks:

```typescript
// ALWAYS specify timezone in cron schedule
await queue.add("daily-report", {}, {
  repeat: {
    pattern: "0 9 * * *",
    tz: "America/New_York", // ALWAYS use IANA timezone
  },
});

// NEVER use UTC offsets — they don't handle DST
// BAD: "0 14 * * *" (assuming UTC+5) ❌
// GOOD: "0 9 * * *" with tz: "America/New_York" ✅
```

- ALWAYS use IANA timezone names (e.g., `America/New_York`), NEVER UTC offsets
- ALWAYS test scheduled tasks around DST transitions
- ALWAYS store timestamps in UTC internally, convert for display only
- ALWAYS document the intended timezone for each scheduled task

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| `setInterval` in production | Lost on restart, runs on every pod | Use distributed scheduler |
| No leader election | Task runs on ALL instances simultaneously | Redis lock or built-in leader election |
| No idempotency | Duplicate execution on overlap or retry | Make every scheduled task idempotent |
| No timeout | Long-running task blocks next scheduled run | Set execution timeout |
| Fixed UTC offset for timezone | Tasks shift time during DST | Use IANA timezone names |
| No monitoring | Failed tasks go unnoticed | Log execution, alert on failure |
| Overlapping execution | Previous run not finished when next starts | Lock prevents concurrent runs |
| Hard-coded schedule | Schedule change requires deployment | Store schedules in config/database |
| No error handling | Single failure stops all scheduled work | Catch and log errors, continue |
| Too-frequent scheduling | Unnecessary load on database/services | Optimize frequency based on need |

---

## 8. Enforcement Checklist

- [ ] No `setInterval` or `time.Ticker` used for scheduled tasks in production
- [ ] Distributed scheduler with leader election used (BullMQ/K8s CronJob/pg-boss)
- [ ] Every scheduled task is idempotent (safe to run twice)
- [ ] IANA timezone specified for all time-sensitive schedules
- [ ] Execution timeout configured per task
- [ ] Overlapping execution prevented (lock or concurrency=1)
- [ ] Execution logged with duration, success/failure, and output
- [ ] Alerting configured for failed scheduled tasks
- [ ] Schedule constants named and documented
- [ ] DST transitions tested for all timezone-dependent tasks
