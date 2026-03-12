# Famous Outages & Engineering Lessons

| Attribute | Value |
|-----------|-------|
| Domain | Case Studies > Postmortems |
| Importance | High |
| Last Updated | 2026-03-10 |
| Cross-ref | [Postmortems](../../12-devops-infrastructure/incident-management/postmortems.md), [Incident Response](../../12-devops-infrastructure/incident-management/incident-response.md) |

---

## Core Concepts

Every major outage reveals systemic engineering failures -- not individual mistakes. Study these incidents to build systems that fail gracefully rather than catastrophically.

### 1. AWS S3 US-East-1 Outage (February 28, 2017)

**What happened:** A single engineer executing a command to remove a small number of servers in the S3 billing system accidentally entered a larger-than-intended value, taking too many servers offline. This triggered a cascading failure across the entire US-EAST-1 region.

**Root cause:** The input to the command was not validated for scope. Removing the index subsystem servers forced a full restart of the S3 index and placement subsystems, which took longer than expected due to the massive growth in stored objects since the last restart.

```text
Failure cascade:
  Typo in server removal command
    → S3 index subsystem offline
      → S3 object storage unavailable
        → Services depending on S3 fail (many AWS services store state in S3)
          → AWS health dashboard itself was hosted on S3, could not report the outage
            → Estimated $150M+ in losses across affected companies
```

**Impact:** Four hours of degradation affecting thousands of websites and services. The AWS status dashboard itself went down because it depended on S3.

**What they fixed:**
- Added safeguards to prevent removal of capacity below minimum thresholds
- Partitioned the index subsystem for faster recovery
- Moved the status dashboard off S3
- Reduced blast radius through cell-based architecture

**Lesson:** Validate destructive commands for scope. Design systems so that administrative actions cannot accidentally remove critical capacity. Ensure monitoring infrastructure does not depend on the system it monitors.

---

### 2. Cloudflare WAF Regex Outage (July 2, 2019)

**What happened:** A new WAF (Web Application Firewall) rule containing a catastrophically backtracking regular expression was deployed globally. CPU usage spiked to 100% on every edge server worldwide, causing 502 errors for all Cloudflare-proxied domains.

**Root cause:** The regex `(?:(?:\"|'|\]|\}|\\|\d|(?:nan|infinity|true|false|null|undefined|symbol|math)|\`|\-|\+)+[)]*;?((?:\s|-|~|!|{}|\|\||\+)*.*(?:.*=.*)))` used excessive backtracking. A safety mechanism that would have limited CPU time per regex had been accidentally removed during a refactoring weeks prior.

```text
Failure cascade:
  New WAF rule deployed globally (no staged rollout)
    → Regex causes catastrophic backtracking on certain inputs
      → CPU spikes to 100% on all edge servers
        → All HTTP/HTTPS traffic returns 502 errors
          → Traffic drops 82% across Cloudflare's entire network
            → 27 minutes of global outage affecting millions of websites
```

**Impact:** 27 minutes of global outage. Traffic dropped 82%.

**What they fixed:**
- Switched to regex engines with runtime guarantees (re2/Rust regex)
- Implemented staged rollouts for WAF rules (test on subset before global deploy)
- Added CPU usage monitoring per rule execution
- Restored the CPU protection mechanism that had been removed

**Lesson:** Never deploy changes globally without staged rollout. Use regex engines with guaranteed linear time complexity. Treat safety mechanisms as critical code -- any removal must be flagged in code review.

---

### 3. Facebook/Meta Global Outage (October 4, 2021)

**What happened:** During routine backbone maintenance, an engineer ran a command to assess network capacity. A bug in the audit tool caused it to issue commands that disconnected all Facebook data centers from the internet. BGP route withdrawals propagated globally, and DNS servers became unreachable.

**Root cause:** The capacity audit tool had a bug that caused it to issue a command disconnecting all backbone connections. Safety systems that should have prevented this failed because they relied on the same backbone network that was being disconnected.

```text
Failure cascade:
  Backbone maintenance command with audit tool bug
    → All data center backbone connections severed
      → BGP routes withdrawn globally (Facebook unreachable)
        → DNS servers, designed to withdraw routes if they cannot reach data centers,
           withdrew their own BGP routes
          → Facebook, Instagram, WhatsApp, Messenger all unreachable
            → Internal tools (also on the same infrastructure) went down
              → Engineers could not remotely diagnose or fix the problem
                → Physical access to data centers required (badge systems also down)
                  → 6+ hours to restore service
```

**Impact:** 6 hours of total outage for 3.5 billion users. Facebook stock dropped ~5%. Estimated $60M+ in lost advertising revenue. CEO's personal wealth dropped $6 billion in a single day.

**What they fixed:**
- Separated management plane from data plane
- Added independent out-of-band access to data centers
- Improved audit tool safeguards
- Ensured safety systems do not depend on the infrastructure they protect

**Lesson:** Safety systems must operate independently from the infrastructure they protect. Ensure out-of-band management access that works even when primary infrastructure is completely down. Test that failsafe mechanisms work during total infrastructure failure.

---

### 4. GitHub MySQL Failover Incident (October 21, 2018)

**What happened:** A 43-second network connectivity loss between data centers triggered an automated MySQL failover. The Raft-based orchestrator (Orchestrator) promoted a West Coast replica as the new primary while the East Coast primary was still accepting writes, creating a split-brain scenario with divergent data.

**Root cause:** During the 43-second network partition, the Raft consensus algorithm correctly deselected the East Coast leader, but the automated failover promoted a West Coast replica that was behind on replication. Both coasts held unique, unreplicated writes.

```text
Failure cascade:
  43 seconds of network connectivity loss between data centers
    → Orchestrator (Raft-based) loses quorum with East Coast
      → West Coast promoted as new primary
        → East Coast and West Coast both accepting writes (split-brain)
          → Data diverges across replicas
            → GitHub chooses data consistency over availability
              → 24 hours 11 minutes of degradation while restoring consistency
```

**Impact:** 24 hours and 11 minutes of service degradation. GitHub prioritized data consistency over availability, accepting extended degradation to prevent data loss.

**What they fixed:**
- Improved orchestrator configuration for cross-datacenter failover
- Added mechanisms to prevent split-brain scenarios
- Improved backup/restore procedures (multi-TB restore was the bottleneck)
- Added better monitoring for replication lag before automated failover

**Lesson:** Automated failover must account for replication lag. A 43-second network blip should not cause 24 hours of degradation. Design failover mechanisms that verify data consistency before promoting replicas. When split-brain occurs, choose consistency over availability and communicate transparently.

---

### 5. CrowdStrike Falcon Sensor Outage (July 19, 2024)

**What happened:** CrowdStrike distributed a faulty channel file update (Channel File 291) to its Falcon Sensor endpoint security software. The update caused an out-of-bounds memory read in the Windows kernel-level driver, resulting in Blue Screen of Death (BSOD) on 8.5 million Windows machines worldwide.

**Root cause:** A mismatch between the IPC Template Type (which defined 21 input fields) and the sensor code (which provided only 20). The Content Interpreter lacked a runtime array bounds check, and the Content Validator had a logic error that allowed the faulty file to pass validation.

```text
Failure cascade:
  Channel File 291 update deployed globally (no staged rollout)
    → Template expects 21 fields, code provides 20
      → Out-of-bounds memory read in kernel driver
        → Windows BSOD (DRIVER_OVERRAN_STACK_BUFFER)
          → Machines enter boot loop (crash → reboot → load driver → crash)
            → 8.5 million Windows machines bricked simultaneously
              → Airlines, hospitals, banks, emergency services disrupted
                → Manual remediation required (boot to safe mode, delete file)
```

**Impact:** 8.5 million Windows machines crashed simultaneously. Airlines grounded flights, hospitals postponed procedures, banks went offline. Called the largest IT outage in history. Manual remediation required physical or remote safe-mode access to each machine.

**What they fixed:**
- Added runtime bounds checking in Content Interpreter
- Fixed the Content Validator logic error
- Implemented staged deployment for channel file updates
- Added additional testing layers for rapid response content

**Lesson:** Kernel-level software must have the highest quality gates. Never deploy kernel-affecting updates to 100% of endpoints simultaneously. Implement runtime bounds checking -- never trust that input data matches expected schemas without validation. Content delivery systems need the same rigor as code deployment systems.

---

### 6. GitLab Database Deletion (January 31, 2017)

**What happened:** During troubleshooting of a PostgreSQL replication issue, an engineer accidentally ran `rm -rf` on the production database directory instead of the intended replica. The command was stopped after 2 seconds, but 300 GB of data had already been deleted. Recovery was complicated by the discovery that all five backup mechanisms had failed.

**Root cause:** The engineer was troubleshooting late at night, confused the production and replica server prompts, and ran a destructive command on the wrong server. All backup strategies had silent failures.

```text
Failure cascade:
  Late-night troubleshooting of replication issue
    → Engineer runs rm -rf on wrong server (production instead of replica)
      → 300 GB of data deleted in 2 seconds before command stopped
        → Attempted restore from pg_dump backups: S3 bucket empty
          → pg_dump was using version 9.2 against PostgreSQL 9.6 (silent failure)
            → LVM snapshots: not configured
              → Azure disk snapshots: not tested, unclear if functional
                → Replication: the replication being debugged was already broken
                  → Only salvation: a manual snapshot taken 6 hours earlier for testing
                    → 18 hours of data restoration, live-streamed publicly
```

**Impact:** 18 hours of downtime. 6 hours of data permanently lost. 5,000 projects, 5,000 comments, and 700 user accounts affected. GitLab live-streamed the recovery process on YouTube.

**What they fixed:**
- Automated backup verification (actually restore and verify, not just check "backup ran")
- Multiple independent backup strategies with regular restore testing
- Production server prompts visually distinct from replica prompts
- Restricted access to destructive commands on production systems

**Lesson:** Test backups by actually restoring them. A backup that has never been restored is not a backup -- it is a hope. Implement multiple independent backup strategies and verify each one regularly. Make production environments visually distinct from non-production to prevent human error.

---

## 10 Key Lessons

1. **Blast radius is the critical variable.** Every outage above was amplified by insufficient blast radius control. Design systems with cells, regions, or shards so that failures are contained rather than global.

2. **Never deploy globally without staged rollout.** Cloudflare, CrowdStrike, and AWS all suffered because changes went to 100% of infrastructure simultaneously. Always canary first.

3. **Safety systems must not depend on what they protect.** Facebook's safety systems ran on the same backbone they were supposed to protect. Out-of-band management access is essential.

4. **Test backups by restoring them.** GitLab's five backup mechanisms all failed silently. The only thing that saved them was an accidental manual snapshot. Automate restore verification.

5. **Validate destructive operations for scope.** AWS S3 went down because a command accepted a too-large input without validation. Add confirmation steps, scope limits, and blast radius checks to all destructive operations.

6. **Kernel-level changes need the highest quality gates.** CrowdStrike bricked 8.5 million machines because a kernel driver update lacked runtime bounds checking. Privileged-level software demands correspondingly rigorous testing.

7. **Automated failover must verify replication state.** GitHub's Orchestrator promoted a replica without checking that it was fully caught up, creating a split-brain. Check replication lag before any failover.

8. **Regex engines need runtime guarantees.** Cloudflare's outage was caused by catastrophic regex backtracking. Use engines (re2, Rust regex) that guarantee linear-time execution.

9. **Incident response depends on independent access.** When the infrastructure you are trying to fix is the same infrastructure you use to fix it (Facebook, GitLab), recovery time multiplies. Ensure independent access paths.

10. **Transparent communication builds trust.** GitLab live-streamed their recovery. GitHub published a detailed postmortem. Transparency during incidents builds more trust than silence during outages.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Global deployment without canary | Cloudflare, CrowdStrike: global outages from single bad change | Staged rollout: 1% → 5% → 25% → 100% with automated rollback |
| Monitoring depends on monitored system | AWS status dashboard hosted on S3 (which was down) | Host monitoring on independent infrastructure |
| Untested backups | GitLab: all 5 backup methods had silent failures | Automated restore testing on a regular schedule |
| No scope validation on destructive commands | AWS: typo removed too many servers | Input validation, confirmation steps, minimum capacity thresholds |
| Safety systems on same infrastructure | Facebook: failsafes ran on the backbone being disconnected | Independent out-of-band management plane |
| Auto-failover without replication check | GitHub: promoted a behind replica, caused split-brain | Verify replication lag < threshold before promoting |
| No runtime bounds checking | CrowdStrike: out-of-bounds read in kernel driver | Runtime validation of all input data against expected schemas |
| Late-night troubleshooting without safeguards | GitLab: wrong server targeted during fatigue | Visual distinction for production, pair operations for destructive commands |
