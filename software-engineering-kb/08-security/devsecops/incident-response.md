# Incident Response for Developers

## Overview

| Field          | Value                                                         |
|----------------|---------------------------------------------------------------|
| **Domain**     | DevSecOps, Security Operations, Incident Management           |
| **Scope**      | Developer-focused incident detection, response, and recovery  |
| **Audience**   | Developers, SREs, Engineering Managers, Security Engineers    |
| **Framework**  | NIST SP 800-61 Rev. 2 (Computer Security Incident Handling)   |
| **Key Insight**| Developers who understand incident response fix issues faster and preserve evidence that prevents future incidents |

---

## NIST SP 800-61 Incident Handling Lifecycle

The National Institute of Standards and Technology defines a four-phase incident handling lifecycle that forms the foundation of all modern incident response programs.

```text
NIST SP 800-61 Incident Response Lifecycle:

+-------------+     +--------------------+     +-----------------------------+
| Preparation |---->| Detection &        |---->| Containment, Eradication,   |
|             |     | Analysis           |     | & Recovery                  |
+-------------+     +--------------------+     +-----------------------------+
      ^                                                    |
      |                                                    v
      |                                        +----------------------+
      +----------------------------------------| Post-Incident        |
                                               | Activity             |
                                               +----------------------+

Phase Details:
  1. Preparation: Tools, training, runbooks, contacts
  2. Detection & Analysis: Identify and confirm the incident
  3. Containment, Eradication, Recovery: Stop the damage, remove the cause, restore
  4. Post-Incident Activity: Learn and improve
```

---

## Phase 1: Preparation

Preparation is the most important phase. Without it, every other phase degrades significantly.

### Developer Preparedness Checklist

```text
Developer Incident Response Preparedness:

Environment Setup:
[ ] SSH access to production log aggregation system
[ ] VPN access configured and tested for emergency access
[ ] Familiarity with production deployment pipeline
[ ] Access to feature flag management system
[ ] Emergency contact list (security team, on-call SRE, management)
[ ] PagerDuty/Opsgenie account configured with correct escalation

Knowledge:
[ ] Understand the application architecture and data flows
[ ] Know where production logs are stored and how to query them
[ ] Understand the deployment rollback process
[ ] Know how to use feature flags to disable features
[ ] Understand the data classification for systems you own
[ ] Know the regulatory requirements for your data (GDPR, HIPAA, PCI)

Documentation:
[ ] Application runbook is current and accessible
[ ] Architecture diagrams are up to date
[ ] Data flow diagrams show where sensitive data is stored and transmitted
[ ] On-call rotation is staffed and documented
[ ] Incident response playbooks are accessible (not behind broken auth)

Practice:
[ ] Participated in at least one tabletop exercise in the past year
[ ] Completed incident response training
[ ] Familiar with the incident communication channels and tools
[ ] Has performed at least one production deployment
```

### Incident Response Toolkit for Developers

```python
# incident_toolkit.py -- Reusable incident response utilities

import logging
import json
import datetime
import hashlib
from functools import wraps

logger = logging.getLogger("incident_response")

class IncidentLogger:
    """Structured logging for incident response activities."""

    def __init__(self, incident_id):
        self.incident_id = incident_id
        self.timeline = []

    def log_action(self, action, details, actor):
        """Record an incident response action with timestamp."""
        entry = {
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "incident_id": self.incident_id,
            "action": action,
            "details": details,
            "actor": actor,
        }
        self.timeline.append(entry)
        logger.info(json.dumps(entry))
        return entry

    def export_timeline(self):
        """Export the complete incident timeline for the postmortem."""
        return json.dumps(self.timeline, indent=2)


class KillSwitch:
    """Feature flag-based kill switch for emergency feature disabling."""

    def __init__(self, flag_client):
        self.flag_client = flag_client

    def disable_feature(self, feature_name, reason, actor):
        """Immediately disable a feature via feature flag."""
        self.flag_client.set_flag(feature_name, enabled=False)
        logger.critical(
            f"KILL SWITCH ACTIVATED: {feature_name} disabled by {actor}. "
            f"Reason: {reason}"
        )

    def enable_feature(self, feature_name, reason, actor):
        """Re-enable a previously disabled feature."""
        self.flag_client.set_flag(feature_name, enabled=True)
        logger.info(
            f"KILL SWITCH DEACTIVATED: {feature_name} enabled by {actor}. "
            f"Reason: {reason}"
        )


def rate_limiter_emergency(requests_per_minute=10):
    """Emergency rate limiter that can be applied to any endpoint."""
    from collections import defaultdict
    import time

    request_counts = defaultdict(list)

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            client_ip = get_client_ip()
            now = time.time()
            # Clean old entries
            request_counts[client_ip] = [
                t for t in request_counts[client_ip]
                if now - t < 60
            ]
            if len(request_counts[client_ip]) >= requests_per_minute:
                logger.warning(
                    f"Emergency rate limit hit: {client_ip} on {f.__name__}"
                )
                return {"error": "Rate limited"}, 429
            request_counts[client_ip].append(now)
            return f(*args, **kwargs)
        return wrapper
    return decorator
```

### On-Call Rotation

```yaml
# PagerDuty/Opsgenie on-call configuration
on_call_schedule:
  name: "Application Security On-Call"
  timezone: "America/New_York"
  rotation:
    type: weekly
    participants:
      - name: "Security Engineer 1"
        contact: "+1-555-0101"
        email: "sec-eng-1@example.com"
      - name: "Security Engineer 2"
        contact: "+1-555-0102"
        email: "sec-eng-2@example.com"
      - name: "Security Engineer 3"
        contact: "+1-555-0103"
        email: "sec-eng-3@example.com"

  escalation_policy:
    - level: 1
      target: "On-call security engineer"
      timeout: 10  # minutes
    - level: 2
      target: "Security team lead"
      timeout: 15
    - level: 3
      target: "CISO"
      timeout: 20
    - level: 4
      target: "VP Engineering"
      timeout: 30

  notification_rules:
    - type: push_notification
      delay: 0
    - type: sms
      delay: 2  # minutes
    - type: phone_call
      delay: 5
```

---

## Phase 2: Detection and Analysis

### Incident Severity Levels

```text
Incident Severity Classification:

SEV1 -- Critical (All Hands on Deck)
  Definition: Active exploitation, data breach, or complete service outage
  Examples:
    - Confirmed data breach with PII/financial data exfiltration
    - Active unauthorized access to production systems
    - Complete production outage caused by security incident
    - Ransomware or destructive malware detected
  Response:
    - Immediate page to security on-call AND engineering on-call
    - Incident commander assigned within 15 minutes
    - War room established (Zoom bridge, Slack channel)
    - Status updates every 30 minutes
    - Executive notification within 1 hour
    - Legal and compliance notified immediately
  Target Resolution: 4 hours (containment), 24 hours (eradication)

SEV2 -- High (Urgent Response Required)
  Definition: Active attack attempt, significant vulnerability exposure,
              or partial service degradation due to security issue
  Examples:
    - Active brute force attack causing partial service degradation
    - Critical vulnerability discovered in production (exploitable, no evidence of exploitation)
    - Credential leak in public repository
    - Unauthorized access attempt detected but not confirmed successful
  Response:
    - Page security on-call within 15 minutes
    - Incident commander assigned within 30 minutes
    - Status updates every 1 hour
    - Management notification within 4 hours
  Target Resolution: 8 hours (containment), 48 hours (eradication)

SEV3 -- Medium (Prompt Attention Required)
  Definition: Security issue with potential but no immediate threat
  Examples:
    - Suspicious activity detected but not confirmed malicious
    - Non-critical vulnerability found in production
    - Security misconfiguration discovered
    - Phishing attempt targeting employees
  Response:
    - Notify security team via Slack during business hours
    - Investigate within 4 hours during business hours
    - Status updates daily
  Target Resolution: 72 hours

SEV4 -- Low (Informational / Scheduled Response)
  Definition: Minor security issue with low immediate risk
  Examples:
    - Security policy violation (non-critical)
    - Failed automated attack blocked by existing controls
    - Security improvement opportunity identified
    - Minor configuration drift
  Response:
    - Create ticket in security backlog
    - Address within normal sprint cycle
    - No immediate page required
  Target Resolution: 2 weeks
```

### Detection Methods

#### Log Monitoring

```python
# Structured security event logging
import structlog
import json

logger = structlog.get_logger("security_events")

# Authentication events
def log_auth_event(event_type, user_id, ip_address, success, details=None):
    """Log authentication events for security monitoring."""
    logger.info(
        "auth_event",
        event_type=event_type,        # login, logout, password_change, mfa_enroll
        user_id=user_id,
        ip_address=ip_address,
        success=success,
        details=details,
        category="authentication",
    )

# Authorization events
def log_authz_event(user_id, resource, action, allowed, ip_address):
    """Log authorization decisions for security monitoring."""
    if not allowed:
        logger.warning(
            "authorization_denied",
            user_id=user_id,
            resource=resource,
            action=action,
            ip_address=ip_address,
            category="authorization",
        )

# Data access events
def log_data_access(user_id, data_type, record_count, purpose):
    """Log access to sensitive data for audit and anomaly detection."""
    logger.info(
        "data_access",
        user_id=user_id,
        data_type=data_type,         # pii, financial, health
        record_count=record_count,
        purpose=purpose,
        category="data_access",
    )

# Anomaly events
def log_anomaly(anomaly_type, details, severity):
    """Log detected anomalies for security investigation."""
    logger.warning(
        "anomaly_detected",
        anomaly_type=anomaly_type,
        details=details,
        severity=severity,
        category="anomaly",
    )
```

#### Alerting Configuration

```yaml
# Prometheus alerting rules for security event detection
groups:
  - name: security_incident_detection
    rules:
      # Brute force detection
      - alert: BruteForceAttack
        expr: |
          sum(rate(auth_login_failures_total[5m])) by (source_ip) > 20
        for: 2m
        labels:
          severity: sev2
          category: security
          playbook: credential-compromise
        annotations:
          summary: "Potential brute force attack from {{ $labels.source_ip }}"
          description: "{{ $value }} failed login attempts per second from {{ $labels.source_ip }}"
          runbook_url: "https://wiki.example.com/runbooks/brute-force"

      # Data exfiltration detection
      - alert: AbnormalDataExport
        expr: |
          sum(rate(api_response_bytes_total{endpoint=~"/api/v1/(users|export|download).*"}[10m])) > 50000000
        for: 5m
        labels:
          severity: sev1
          category: security
          playbook: data-breach
        annotations:
          summary: "Abnormal data export volume detected"
          description: "{{ $value }} bytes/sec being exported, exceeding normal threshold"

      # Privilege escalation detection
      - alert: UnauthorizedAdminAccess
        expr: |
          increase(auth_admin_access_denied_total[5m]) > 10
        for: 1m
        labels:
          severity: sev2
          category: security
        annotations:
          summary: "Multiple failed admin access attempts"

      # Service account anomaly
      - alert: ServiceAccountAnomaly
        expr: |
          count(rate(api_requests_total{auth_type="service_account"}[5m]) > 100) by (service_account) > 0
          unless
          count(rate(api_requests_total{auth_type="service_account"}[5m] offset 7d) > 100) by (service_account) > 0
        for: 10m
        labels:
          severity: sev3
          category: security
        annotations:
          summary: "Unusual service account activity for {{ $labels.service_account }}"
```

#### Anomaly Detection

```python
# Simple anomaly detection for API request patterns
import statistics
from collections import defaultdict
from datetime import datetime, timedelta

class SecurityAnomalyDetector:
    """Detect anomalous patterns that may indicate security incidents."""

    def __init__(self, baseline_days=30, std_dev_threshold=3):
        self.baseline_days = baseline_days
        self.std_dev_threshold = std_dev_threshold

    def detect_unusual_access_pattern(self, user_id, current_requests, historical_data):
        """Detect if a user's current request volume is anomalous."""
        if len(historical_data) < 7:  # Need at least a week of data
            return None

        mean = statistics.mean(historical_data)
        stdev = statistics.stdev(historical_data) if len(historical_data) > 1 else 0

        if stdev == 0:
            return None

        z_score = (current_requests - mean) / stdev

        if z_score > self.std_dev_threshold:
            return {
                "anomaly_type": "unusual_access_volume",
                "user_id": user_id,
                "current_requests": current_requests,
                "baseline_mean": round(mean, 2),
                "baseline_stdev": round(stdev, 2),
                "z_score": round(z_score, 2),
                "severity": "high" if z_score > 5 else "medium",
            }
        return None

    def detect_unusual_time_access(self, user_id, access_hour, historical_hours):
        """Detect if a user is accessing the system at unusual times."""
        if not historical_hours:
            return None

        common_hours = set(historical_hours)
        if access_hour not in common_hours:
            return {
                "anomaly_type": "unusual_access_time",
                "user_id": user_id,
                "access_hour": access_hour,
                "typical_hours": sorted(common_hours),
                "severity": "low",
            }
        return None

    def detect_impossible_travel(self, user_id, current_location, previous_location,
                                  time_diff_minutes):
        """Detect impossible travel (login from two distant locations in short time)."""
        distance_km = calculate_distance(current_location, previous_location)
        max_possible_km = time_diff_minutes * 15  # ~900 km/h (fast flight speed)

        if distance_km > max_possible_km and time_diff_minutes < 120:
            return {
                "anomaly_type": "impossible_travel",
                "user_id": user_id,
                "current_location": current_location,
                "previous_location": previous_location,
                "distance_km": round(distance_km, 2),
                "time_diff_minutes": time_diff_minutes,
                "severity": "high",
            }
        return None
```

---

## Phase 3: Containment, Eradication, and Recovery

### Developer Role in Incident Response

```text
Developer Responsibilities During an Incident:

Immediate (First 30 Minutes):
  1. Acknowledge the page/alert
  2. Join the war room (Slack channel / Zoom bridge)
  3. Confirm the incident commander knows you are available
  4. Begin reviewing relevant logs and metrics
  5. Assess: What is the blast radius?

Investigation (30 min - 2 hours):
  1. Analyze application logs for suspicious activity
  2. Identify the root cause or attack vector
  3. Determine what data or systems are affected
  4. Identify the timeline: when did the issue start?
  5. Document findings in the incident channel

Containment (As directed by incident commander):
  1. Deploy feature flag changes to disable affected features
  2. Revoke compromised credentials/tokens
  3. Apply emergency patches or configuration changes
  4. Assist with traffic blocking or rate limiting
  5. Switch affected services to read-only mode if needed

Recovery (After containment):
  1. Develop and test the permanent fix
  2. Deploy the fix through the standard pipeline (with expedited review)
  3. Verify the fix resolves the issue
  4. Monitor for recurrence
  5. Assist with data impact assessment
```

### Containment Actions

#### Feature Flag Kill Switch

```python
# kill_switch.py -- Emergency feature disabling via feature flags

from launchdarkly import LDClient
import logging
import os

logger = logging.getLogger("incident.kill_switch")

class EmergencyKillSwitch:
    """Kill switch for rapid feature disabling during incidents."""

    def __init__(self):
        sdk_key = os.environ.get("LAUNCHDARKLY_SDK_KEY")
        self.client = LDClient(sdk_key)

    def disable(self, feature_key, reason, incident_id):
        """
        Disable a feature immediately.

        Usage during incident:
            kill_switch = EmergencyKillSwitch()
            kill_switch.disable(
                "payment-processing",
                "Suspected payment fraud - INC-2024-042",
                "INC-2024-042"
            )
        """
        # Note: This uses the LaunchDarkly API to update the flag.
        # In practice, use the LD API client or admin console.
        import requests

        response = requests.patch(
            f"https://app.launchdarkly.com/api/v2/flags/production/{feature_key}",
            headers={
                "Authorization": os.environ["LAUNCHDARKLY_API_KEY"],
                "Content-Type": "application/json",
            },
            json=[{
                "op": "replace",
                "path": "/environments/production/on",
                "value": False,
            }]
        )

        if response.status_code == 200:
            logger.critical(
                f"KILL SWITCH ACTIVATED: {feature_key} disabled. "
                f"Incident: {incident_id}. Reason: {reason}"
            )
        else:
            logger.error(
                f"KILL SWITCH FAILED: Could not disable {feature_key}. "
                f"Status: {response.status_code}"
            )

        return response.status_code == 200

# Flask integration example
from flask import Flask, jsonify
from functools import wraps

app = Flask(__name__)

def feature_flag_guard(feature_key, fallback_response=None):
    """Decorator that checks feature flag before executing endpoint."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if not ld_client.variation(feature_key, get_current_user(), True):
                logger.info(f"Feature {feature_key} is disabled (kill switch active)")
                if fallback_response:
                    return jsonify(fallback_response), 503
                return jsonify({
                    "error": "Service temporarily unavailable",
                    "retry_after": 300,
                }), 503
            return f(*args, **kwargs)
        return wrapper
    return decorator

@app.route("/api/v1/payments", methods=["POST"])
@feature_flag_guard("payment-processing", fallback_response={
    "error": "Payment processing is temporarily disabled",
    "message": "Please try again later",
})
def process_payment():
    """Payment endpoint with kill switch support."""
    return handle_payment_request()
```

#### Token Revocation

```python
# token_revocation.py -- Emergency token and session revocation

import redis
import logging
from datetime import datetime

logger = logging.getLogger("incident.token_revocation")

class EmergencyTokenRevocation:
    """Revoke tokens and sessions during security incidents."""

    def __init__(self, redis_client):
        self.redis = redis_client

    def revoke_user_sessions(self, user_id, reason, incident_id):
        """Revoke all active sessions for a specific user."""
        # Add user to revocation list
        self.redis.sadd("revoked_users", user_id)
        self.redis.set(
            f"revocation:{user_id}",
            json.dumps({
                "revoked_at": datetime.utcnow().isoformat(),
                "reason": reason,
                "incident_id": incident_id,
            })
        )

        # Delete all session keys for this user
        session_keys = self.redis.keys(f"session:{user_id}:*")
        if session_keys:
            self.redis.delete(*session_keys)

        logger.critical(
            f"SESSIONS REVOKED: All sessions for user {user_id} revoked. "
            f"Incident: {incident_id}"
        )

    def revoke_all_api_keys(self, service_name, reason, incident_id):
        """Revoke all API keys for a specific service."""
        api_keys = self.redis.smembers(f"api_keys:{service_name}")
        for key in api_keys:
            self.redis.sadd("revoked_api_keys", key)
            self.redis.delete(f"api_key_data:{key}")

        logger.critical(
            f"API KEYS REVOKED: All keys for {service_name} revoked. "
            f"Count: {len(api_keys)}. Incident: {incident_id}"
        )

    def revoke_all_sessions_globally(self, reason, incident_id):
        """Nuclear option: Revoke ALL active sessions system-wide."""
        # Increment the global session version
        new_version = self.redis.incr("global_session_version")

        logger.critical(
            f"GLOBAL SESSION REVOCATION: All sessions invalidated. "
            f"New version: {new_version}. Incident: {incident_id}"
        )
        return new_version

# Middleware that checks session validity
def session_validity_middleware(request):
    """Check if the current session has been revoked."""
    user_id = request.session.get("user_id")

    # Check user-specific revocation
    if user_id and redis_client.sismember("revoked_users", user_id):
        return redirect("/login?reason=session_revoked")

    # Check global session version
    session_version = request.session.get("version", 0)
    global_version = int(redis_client.get("global_session_version") or 0)
    if session_version < global_version:
        return redirect("/login?reason=session_expired")

    return None  # Session is valid, continue
```

#### IP Blocking and Rate Limiting

```python
# emergency_ip_blocking.py -- Runtime IP blocking during incidents

import ipaddress
from datetime import datetime, timedelta

class EmergencyIPBlocker:
    """Block malicious IPs during security incidents."""

    def __init__(self, redis_client, waf_client=None):
        self.redis = redis_client
        self.waf_client = waf_client

    def block_ip(self, ip_address, reason, duration_hours=24, incident_id=None):
        """Block a specific IP address."""
        self.redis.setex(
            f"blocked_ip:{ip_address}",
            timedelta(hours=duration_hours),
            json.dumps({
                "blocked_at": datetime.utcnow().isoformat(),
                "reason": reason,
                "incident_id": incident_id,
                "expires_hours": duration_hours,
            })
        )

        # Also add to WAF if available
        if self.waf_client:
            self.waf_client.add_to_blocklist(ip_address, duration_hours)

        logger.warning(
            f"IP BLOCKED: {ip_address} blocked for {duration_hours}h. "
            f"Reason: {reason}"
        )

    def block_cidr(self, cidr_range, reason, duration_hours=24, incident_id=None):
        """Block an entire CIDR range."""
        network = ipaddress.ip_network(cidr_range, strict=False)
        self.redis.setex(
            f"blocked_cidr:{cidr_range}",
            timedelta(hours=duration_hours),
            json.dumps({
                "blocked_at": datetime.utcnow().isoformat(),
                "reason": reason,
                "incident_id": incident_id,
                "network_size": network.num_addresses,
            })
        )
        logger.warning(
            f"CIDR BLOCKED: {cidr_range} ({network.num_addresses} addresses) "
            f"blocked for {duration_hours}h. Reason: {reason}"
        )

    def is_blocked(self, ip_address):
        """Check if an IP is blocked (direct or CIDR)."""
        # Check direct IP block
        if self.redis.exists(f"blocked_ip:{ip_address}"):
            return True

        # Check CIDR blocks
        ip = ipaddress.ip_address(ip_address)
        blocked_cidrs = self.redis.keys("blocked_cidr:*")
        for cidr_key in blocked_cidrs:
            cidr = cidr_key.decode().split(":", 1)[1]
            if ip in ipaddress.ip_network(cidr, strict=False):
                return True

        return False

# Flask middleware
@app.before_request
def check_ip_block():
    """Block requests from blocked IP addresses."""
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    if ip_blocker.is_blocked(client_ip):
        logger.info(f"Blocked request from {client_ip}")
        abort(403)
```

#### Service Isolation and Read-Only Mode

```python
# service_isolation.py -- Switch services to degraded/read-only mode

class ServiceIsolation:
    """Control service availability during incidents."""

    def __init__(self, config_store):
        self.config = config_store

    def enable_read_only_mode(self, service_name, reason, incident_id):
        """Switch a service to read-only mode (block all writes)."""
        self.config.set(f"service:{service_name}:mode", "read_only")
        logger.critical(
            f"READ-ONLY MODE: {service_name} switched to read-only. "
            f"Incident: {incident_id}"
        )

    def enable_maintenance_mode(self, service_name, reason, incident_id):
        """Switch a service to maintenance mode (block all traffic)."""
        self.config.set(f"service:{service_name}:mode", "maintenance")
        logger.critical(
            f"MAINTENANCE MODE: {service_name} taken offline. "
            f"Incident: {incident_id}"
        )

    def restore_normal_mode(self, service_name, reason, incident_id):
        """Restore normal operation."""
        self.config.set(f"service:{service_name}:mode", "normal")
        logger.info(
            f"NORMAL MODE: {service_name} restored. Incident: {incident_id}"
        )

# Database-level read-only enforcement
class ReadOnlyDatabaseProxy:
    """Database proxy that enforces read-only mode."""

    WRITE_OPERATIONS = {"INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "TRUNCATE"}

    def __init__(self, real_connection, read_only=False):
        self.connection = real_connection
        self.read_only = read_only

    def execute(self, query, params=None):
        if self.read_only:
            first_word = query.strip().split()[0].upper()
            if first_word in self.WRITE_OPERATIONS:
                raise PermissionError(
                    f"Write operation '{first_word}' blocked: "
                    f"service is in read-only mode"
                )
        return self.connection.execute(query, params)
```

---

## Runbook Templates

### Runbook 1: Data Breach Response

```text
RUNBOOK: Data Breach Response
Severity: SEV1
Last Updated: 2024-01-15
Owner: Security Team

TRIGGER:
  - Confirmed or suspected unauthorized access to sensitive data
  - Evidence of data exfiltration
  - Third-party notification of data exposure

IMMEDIATE ACTIONS (First 30 Minutes):
  1. [ ] Page security on-call and incident commander
  2. [ ] Create incident Slack channel: #inc-YYYY-MM-DD-data-breach
  3. [ ] Start incident timeline documentation
  4. [ ] Identify the scope: what data, how many records, what systems
  5. [ ] Notify legal and compliance team

CONTAINMENT (30 min - 2 hours):
  6. [ ] Revoke compromised credentials/tokens
  7. [ ] Block attacker IP addresses (if identified)
  8. [ ] Isolate affected systems from network (if active exfiltration)
  9. [ ] Preserve logs and evidence (DO NOT delete or modify)
  10. [ ] Enable enhanced logging on affected systems
  11. [ ] Rotate all secrets on affected systems

INVESTIGATION (2 - 24 hours):
  12. [ ] Determine attack vector (how did they get in?)
  13. [ ] Identify full scope of compromised data
  14. [ ] Build timeline of attacker activity
  15. [ ] Assess: Is the attacker still active?
  16. [ ] Determine data classification of exposed data
  17. [ ] Enumerate affected users/records

ERADICATION (After investigation):
  18. [ ] Remove attacker access (all backdoors, accounts, keys)
  19. [ ] Patch the vulnerability that was exploited
  20. [ ] Verify no persistence mechanisms remain
  21. [ ] Deploy fixes through standard pipeline with expedited review

RECOVERY:
  22. [ ] Restore services from known-good backups (if needed)
  23. [ ] Monitor for signs of continued compromise
  24. [ ] Gradually restore normal access
  25. [ ] Verify data integrity

NOTIFICATION:
  26. [ ] Legal: Determine notification obligations
  27. [ ] GDPR: Notify supervisory authority within 72 hours (if applicable)
  28. [ ] HIPAA: Notify HHS within 60 days (if applicable)
  29. [ ] State breach laws: Notify affected individuals per requirements
  30. [ ] Update status page for customers

POST-INCIDENT:
  31. [ ] Conduct blameless postmortem within 5 business days
  32. [ ] Document lessons learned and corrective actions
  33. [ ] Update runbooks based on lessons learned
```

### Runbook 2: Credential Compromise

```text
RUNBOOK: Credential Compromise
Severity: SEV1/SEV2
Last Updated: 2024-01-15
Owner: Security Team

TRIGGER:
  - Secret detected in public repository (GitHub, GitLab)
  - Credential found in logs or monitoring
  - Third-party reports compromised credentials
  - Employee reports credential exposure

IMMEDIATE ACTIONS (First 15 Minutes):
  1. [ ] Identify the type of credential (API key, password, token, certificate)
  2. [ ] Identify where the credential was exposed
  3. [ ] Determine what the credential provides access to
  4. [ ] Revoke/rotate the credential IMMEDIATELY

CREDENTIAL-SPECIFIC ACTIONS:

  AWS Access Keys:
  5a. [ ] Deactivate the access key in IAM console
  5b. [ ] Review CloudTrail for unauthorized usage
  5c. [ ] Generate new access key
  5d. [ ] Update all systems using the old key

  Database Passwords:
  5a. [ ] Change the database password immediately
  5b. [ ] Review database audit logs for unauthorized access
  5c. [ ] Update connection strings in secrets manager
  5d. [ ] Restart application services to pick up new credentials

  API Keys (Third Party):
  5a. [ ] Revoke the key via the provider's dashboard
  5b. [ ] Review API usage logs for unauthorized calls
  5c. [ ] Generate new API key
  5d. [ ] Update key in secrets manager

  SSH Keys:
  5a. [ ] Remove the public key from all authorized_keys files
  5b. [ ] Review SSH access logs for unauthorized usage
  5c. [ ] Generate new key pair
  5d. [ ] Distribute new public key

  TLS Certificates:
  5a. [ ] Revoke the certificate with the CA
  5b. [ ] Generate new certificate
  5c. [ ] Deploy new certificate
  5d. [ ] Verify OCSP/CRL reflects revocation

INVESTIGATION:
  6. [ ] Determine: Was the credential used by an unauthorized party?
  7. [ ] Review access logs during the exposure window
  8. [ ] Identify the root cause (how was it exposed?)
  9. [ ] Assess data impact (what data could have been accessed?)

PREVENTION:
  10. [ ] Add detection rule for this credential pattern to pre-commit hooks
  11. [ ] Ensure credential is stored in secrets manager going forward
  12. [ ] Educate the team member on credential handling
  13. [ ] Verify pre-commit secret scanning is active on the repository
```

### Runbook 3: Malicious Code Detection

```text
RUNBOOK: Malicious Code Detection
Severity: SEV1
Last Updated: 2024-01-15
Owner: Security Team

TRIGGER:
  - SAST/SCA scan detects known malicious package
  - Runtime monitoring detects suspicious process execution
  - Dependency supply chain compromise announced (e.g., npm package hijack)
  - Developer reports suspicious code in a dependency

IMMEDIATE ACTIONS:
  1. [ ] Identify the affected package/library and version
  2. [ ] Determine all applications using the affected dependency
  3. [ ] Assess: Is the malicious code executing in production?
  4. [ ] If actively executing: Initiate SEV1 containment (service isolation)

CONTAINMENT:
  5. [ ] Pin dependencies to last known good version
  6. [ ] Block the malicious package version in internal registry
  7. [ ] If supply chain: Block all versions until verified clean
  8. [ ] Deploy rollback to last clean version
  9. [ ] Check build artifacts: Were any built with the compromised dependency?
  10. [ ] Quarantine affected build artifacts

INVESTIGATION:
  11. [ ] Analyze the malicious code: What does it do?
  12. [ ] Determine the attack vector (dependency confusion, typosquatting,
        account takeover, maintainer compromise)
  13. [ ] Review application logs for evidence of malicious activity
  14. [ ] Check: Did the malicious code exfiltrate data?
  15. [ ] Check: Did it establish persistence or backdoors?
  16. [ ] Review network logs for unusual outbound connections

ERADICATION:
  17. [ ] Remove the malicious dependency from all projects
  18. [ ] Clean build caches and CI/CD pipeline caches
  19. [ ] Rebuild all affected artifacts from source
  20. [ ] Rotate any credentials the malicious code could have accessed
  21. [ ] Scan all rebuilt artifacts with updated signatures

RECOVERY AND PREVENTION:
  22. [ ] Deploy clean rebuild to all environments
  23. [ ] Enable dependency pinning with hash verification
  24. [ ] Add the malicious package to internal blocklist
  25. [ ] Review SBOM for other potentially suspicious dependencies
  26. [ ] Implement or strengthen artifact signing
```

### Runbook 4: Zero-Day Dependency Vulnerability

```text
RUNBOOK: Zero-Day Dependency Vulnerability Response
Severity: SEV1/SEV2 (depending on exploitability and exposure)
Last Updated: 2024-01-15
Owner: Security Team

TRIGGER:
  - New critical CVE announced for a widely-used dependency
  - CISA KEV entry added for a dependency in use
  - Security researcher publishes exploit for a dependency

IMMEDIATE ACTIONS (First 1 Hour):
  1. [ ] Identify all applications using the affected dependency (SBOM query)
  2. [ ] Determine: Which version(s) are affected?
  3. [ ] Determine: Is a patch available?
  4. [ ] Determine: Is there a known exploit in the wild?
  5. [ ] Assess reachability: Is the vulnerable function/feature used?

IF ACTIVELY EXPLOITED AND REACHABLE:
  6. [ ] Escalate to SEV1
  7. [ ] Implement WAF rules to block known exploit patterns
  8. [ ] Apply vendor patch immediately (if available)
  9. [ ] If no patch: Implement compensating controls (see below)
  10. [ ] Monitor for exploitation attempts in logs

IF NOT ACTIVELY EXPLOITED OR NOT REACHABLE:
  6. [ ] Classify as SEV2 or SEV3
  7. [ ] Create remediation tickets per standard SLA
  8. [ ] Monitor threat intelligence for escalation
  9. [ ] Prepare patch deployment for next maintenance window

COMPENSATING CONTROLS (when no patch is available):
  - WAF rules to block exploit patterns
  - Network-level restrictions on affected services
  - Feature flag to disable affected functionality
  - Runtime protections (RASP rules)
  - Enhanced monitoring and alerting

COMMUNICATION:
  11. [ ] Notify all affected team leads
  12. [ ] Update internal advisory with impact assessment
  13. [ ] Publish status update for customers (if publicly known vulnerability)
  14. [ ] Report to compliance team if regulated data is at risk
```

---

## Communication During Incidents

### Incident Commander Role

```text
Incident Commander Responsibilities:

1. Declare the incident and set severity level
2. Establish the war room (communication channel)
3. Assign roles:
   - Technical Lead: Drives investigation and remediation
   - Communications Lead: Manages internal and external updates
   - Scribe: Documents the timeline and decisions
4. Make decisions on containment actions
5. Authorize emergency changes
6. Provide regular status updates (cadence based on severity)
7. Escalate when needed (to management, legal, PR)
8. Declare incident resolved
9. Schedule postmortem

Communication Cadence:
  SEV1: Updates every 30 minutes
  SEV2: Updates every 1 hour
  SEV3: Updates every 4 hours or twice daily
  SEV4: Daily summary
```

### Status Page Updates

```text
External Status Page Update Templates:

INVESTIGATING:
  Title: Investigating increased error rates on [Service Name]
  Body: We are currently investigating reports of [symptom].
        We will provide an update within [timeframe].
        Posted at: [timestamp]

IDENTIFIED:
  Title: Root cause identified for [Service Name] issues
  Body: We have identified the root cause and are working on a fix.
        [Brief non-technical description of impact]
        Next update in [timeframe].
        Posted at: [timestamp]

MONITORING:
  Title: Fix deployed, monitoring [Service Name]
  Body: A fix has been deployed and we are monitoring the results.
        Some users may still experience [residual symptoms].
        We will confirm resolution within [timeframe].
        Posted at: [timestamp]

RESOLVED:
  Title: [Service Name] issue resolved
  Body: The issue has been resolved. All services are operating normally.
        Duration: [start time] to [end time]
        Impact: [brief summary of user impact]
        A full postmortem will be published within 5 business days.
        Posted at: [timestamp]

IMPORTANT: Never include technical details about security vulnerabilities
in public status updates. Do not reveal attack vectors, exploits, or
specific data compromised.
```

---

## Phase 4: Post-Incident Activity

### Blameless Postmortem Template

```text
POSTMORTEM: [Incident Title]
Date: [Date]
Severity: [SEV1/SEV2/SEV3/SEV4]
Incident Commander: [Name]
Author: [Name]
Status: [Draft / Review / Final]

EXECUTIVE SUMMARY
  [2-3 sentence summary of the incident, impact, and resolution]

TIMELINE (All times in UTC)
  [HH:MM] -- [Event description]
  [HH:MM] -- [Event description]
  [HH:MM] -- Alert fired: [alert name]
  [HH:MM] -- Incident declared (SEV[X])
  [HH:MM] -- Incident commander assigned: [Name]
  [HH:MM] -- Root cause identified
  [HH:MM] -- Containment action taken: [description]
  [HH:MM] -- Fix deployed
  [HH:MM] -- Incident resolved

IMPACT
  Duration: [X hours, Y minutes]
  User Impact: [Number of affected users, nature of impact]
  Data Impact: [Was data exposed/lost/corrupted? Scope?]
  Revenue Impact: [Estimated financial impact, if applicable]
  Compliance Impact: [Regulatory notification required? Which regulations?]

ROOT CAUSE ANALYSIS

  5 Whys Analysis:
  1. Why did the incident occur?
     [Answer]
  2. Why did [Answer 1] happen?
     [Answer]
  3. Why did [Answer 2] happen?
     [Answer]
  4. Why did [Answer 3] happen?
     [Answer]
  5. Why did [Answer 4] happen?
     [Root cause]

  Contributing Factors:
  - [Factor 1]
  - [Factor 2]
  - [Factor 3]

WHAT WENT WELL
  - [Positive aspect 1]
  - [Positive aspect 2]
  - [Positive aspect 3]

WHAT COULD BE IMPROVED
  - [Improvement area 1]
  - [Improvement area 2]
  - [Improvement area 3]

CORRECTIVE ACTIONS
  | Action                              | Owner    | Priority | Due Date   | Ticket  |
  |-------------------------------------|----------|----------|------------|---------|
  | [Corrective action 1]              | [Name]   | P1       | [Date]     | [Link]  |
  | [Corrective action 2]              | [Name]   | P2       | [Date]     | [Link]  |
  | [Corrective action 3]              | [Name]   | P2       | [Date]     | [Link]  |

LESSONS LEARNED
  [Key takeaways for the organization]

APPENDIX
  - [Link to logs]
  - [Link to dashboards]
  - [Link to communication thread]
```

### Root Cause Analysis Methods

```text
Fishbone (Ishikawa) Diagram for Security Incidents:

                    INCIDENT: [Description]
                            |
    +----------+----------+-+-+----------+----------+
    |          |          |   |          |          |
  People    Process    Technology  Environment  Policy
    |          |          |         |          |
    |          |          |         |          |
  - Lack of  - No code  - Missing - Staging  - No MFA
    training   review     WAF rule   env not    policy
  - No sec   - No threat- Outdated   matching - No secret
    champion   modeling   library    prod       rotation
  - Fatigue  - No SLA   - No SAST - Network  - No logging
              for fixes   scanning   flat       requirement
```

---

## Evidence Preservation

```text
Evidence Preservation Guidelines for Developers:

CRITICAL: Do NOT do any of the following:
  x Do NOT delete logs
  x Do NOT restart services (unless directed by incident commander)
  x Do NOT modify configuration on affected systems
  x Do NOT "clean up" or fix the code before investigation is complete
  x Do NOT communicate details outside the incident channel
  x Do NOT run destructive commands on affected systems

DO the following:
  + Preserve all relevant logs (copy them to a separate location)
  + Take screenshots of dashboards and monitoring
  + Document the exact commands you run during investigation
  + Save query results and analysis outputs
  + Record the state of affected systems before any changes
  + Use the incident timeline to document all actions

Log Preservation Commands:
  # Copy application logs to evidence directory
  mkdir -p /evidence/INC-YYYY-NNN/
  cp -r /var/log/application/ /evidence/INC-YYYY-NNN/app-logs/
  cp -r /var/log/nginx/ /evidence/INC-YYYY-NNN/nginx-logs/

  # Save database audit logs
  pg_dump --table=audit_log --where="timestamp > '[incident_start]'" \
    > /evidence/INC-YYYY-NNN/db-audit.sql

  # Save network captures (if authorized)
  tcpdump -i eth0 -w /evidence/INC-YYYY-NNN/capture.pcap -c 10000

  # Generate system state snapshot
  ps aux > /evidence/INC-YYYY-NNN/process-list.txt
  netstat -tlnp > /evidence/INC-YYYY-NNN/network-connections.txt
  df -h > /evidence/INC-YYYY-NNN/disk-usage.txt

Chain of Custody:
  - Record who accessed evidence and when
  - Store evidence in read-only location
  - Generate hash of evidence files for integrity verification
  - Maintain evidence for minimum of 1 year (or per legal hold)
```

---

## Legal and Regulatory Notification Requirements

```text
Breach Notification Requirements by Regulation:

GDPR (EU General Data Protection Regulation):
  - Notify supervisory authority within 72 hours of becoming aware
  - Notify affected individuals without "undue delay" if high risk
  - Document: Nature of breach, categories of data, number of records,
    consequences, measures taken

HIPAA (US Health Insurance Portability and Accountability Act):
  - Notify HHS within 60 days (if > 500 individuals affected)
  - Notify affected individuals within 60 days
  - Notify media (if > 500 individuals in a state)
  - Small breaches (< 500): Annual report to HHS

PCI DSS (Payment Card Industry Data Security Standard):
  - Notify acquiring bank immediately
  - Engage PCI Forensic Investigator (PFI)
  - Provide incident report to payment brands
  - Timeline varies by card brand (typically 24-72 hours)

US State Breach Notification Laws:
  - All 50 states have breach notification laws
  - Timelines vary: 30-90 days typically
  - California (CCPA): 45 days; New York: 72 hours (most recent)
  - Definition of "personal information" varies by state

SEC Reporting (US Securities and Exchange Commission):
  - Material cybersecurity incidents: 4 business days (Form 8-K)
  - Annual reporting of cybersecurity risk management (Form 10-K)

Key Actions for Developers:
  - NEVER make notification decisions independently
  - Immediately involve legal and compliance teams
  - Document the incident timeline precisely (notification clocks start
    when the organization "becomes aware")
  - Preserve all evidence (required for regulatory investigation)
```

---

## Tabletop Exercises

```text
Tabletop Exercise for Developers (2 Hours):

Exercise 1: Credential Leak in Public Repository
  Scenario: A developer accidentally commits an AWS access key to a
  public GitHub repository. The commit was pushed 3 hours ago.
  Questions:
  - What is the first action you take?
  - How do you determine if the key was used by an attacker?
  - What systems could this key access?
  - Who do you notify?
  - How do you prevent this from happening again?

Exercise 2: Supply Chain Attack
  Scenario: A popular npm package your application depends on was
  compromised. The maintainer's account was hijacked and a malicious
  version was published 12 hours ago. Your CI pipeline ran and deployed
  a build that includes the compromised version.
  Questions:
  - How do you identify which systems are affected?
  - What containment actions do you take?
  - How do you determine if the malicious code executed?
  - What is your recovery plan?

Exercise 3: Active Data Exfiltration
  Scenario: Your SIEM alerts on unusual outbound data transfer from a
  production database server. Investigation reveals a web shell in a
  file upload directory. Access logs show data being exfiltrated to an
  external IP for the past 48 hours.
  Questions:
  - What is your immediate containment action?
  - How do you preserve evidence without alerting the attacker?
  - How do you determine the scope of data exfiltrated?
  - What regulatory notifications are required?
  - How do you communicate this to customers?

Exercise Format:
  1. Present the scenario (10 min)
  2. Team discussion: What do we do? (30 min)
  3. Walk through the relevant runbook (20 min)
  4. Identify gaps in the runbook (15 min)
  5. Assign action items to close gaps (15 min)
  6. Debrief and lessons learned (15 min)

Schedule: Conduct tabletop exercises quarterly, rotating scenarios
```

---

## Best Practices

1. **Prepare before incidents happen.** Write runbooks, test them, and ensure every developer knows where to find them. Incident response is not the time to create processes from scratch.

2. **Practice blameless postmortems.** Focus on systemic causes, not individual mistakes. Blame discourages reporting and hides the real organizational weaknesses that enable incidents.

3. **Preserve evidence before fixing.** Always capture logs, screenshots, and system state before making changes. Evidence is critical for root cause analysis, legal proceedings, and regulatory compliance.

4. **Communicate clearly and frequently.** Over-communication during incidents is better than silence. Use a consistent format, avoid jargon in external communications, and never speculate about cause or impact.

5. **Maintain a current on-call rotation.** Ensure the on-call schedule is always staffed, contact information is current, and escalation paths are tested. A pager that does not reach anyone is useless.

6. **Conduct tabletop exercises quarterly.** Practice makes incident response muscle memory. Rotate through different scenarios to cover data breach, credential compromise, supply chain attack, and DDoS.

7. **Automate containment actions where possible.** Kill switches, token revocation, and IP blocking should be scriptable and executable within minutes, not hours. Pre-build the tooling.

8. **Follow up on postmortem action items.** Track corrective actions in the issue tracker with owners and deadlines. Review completion status at the next monthly security meeting.

9. **Understand your regulatory notification obligations.** Know which regulations apply to your data (GDPR, HIPAA, PCI DSS, state laws) and what the notification timelines are. Involve legal early.

10. **Keep runbooks updated.** Review and update all incident response runbooks at least quarterly. After every real incident, update the relevant runbook with lessons learned.

---

## Anti-Patterns

1. **No incident response plan.** Figuring out what to do during an active incident wastes critical time and leads to poor decisions. Every team must have documented procedures before an incident occurs.

2. **Blame culture in postmortems.** Identifying who caused the incident rather than what systemic factors enabled it discourages reporting, hides problems, and prevents meaningful improvement.

3. **Destroying evidence during containment.** Restarting servers, deleting logs, or reformatting systems before capturing evidence makes root cause analysis impossible and may violate legal requirements.

4. **Communicating vulnerability details publicly.** Disclosing technical details of an unpatched vulnerability or active attack vector in status page updates or social media helps attackers more than it helps customers.

5. **Not testing backup and recovery procedures.** Assuming backups work without testing them regularly leads to discovering they are corrupt or incomplete during a real incident.

6. **Single point of failure in incident response.** If only one person knows how to access logs, deploy fixes, or revoke credentials, the entire response halts when that person is unavailable.

7. **Skipping postmortems for "small" incidents.** Every incident, regardless of severity, offers learning opportunities. Skipping postmortems means repeating the same mistakes.

8. **Static runbooks that are never updated.** Runbooks that reference decommissioned systems, outdated contacts, or superseded procedures are worse than no runbooks because they provide false confidence.

---

## Enforcement Checklist

```text
Preparation:
[ ] Incident response plan documented and approved
[ ] Incident severity classification defined (SEV1-SEV4)
[ ] On-call rotation staffed and tested
[ ] Escalation paths defined and contacts verified
[ ] War room procedures documented (Slack channel naming, Zoom bridge)
[ ] Runbooks exist for: data breach, credential compromise, service disruption,
    malicious code, zero-day dependency vulnerability
[ ] Evidence preservation guidelines published
[ ] Legal and compliance notification requirements documented
[ ] All developers have production log access for investigation
[ ] Kill switch and containment tools tested quarterly
[ ] Tabletop exercises conducted quarterly

Detection:
[ ] Security event logging implemented (authentication, authorization, data access)
[ ] Alerting configured for security anomalies
[ ] Log aggregation and SIEM integration operational
[ ] Alert routing sends security alerts to correct on-call
[ ] False positive rate for security alerts is below 30%
[ ] Mean time to detect (MTTD) is tracked and reported

Response:
[ ] Incident commander role defined with trained personnel
[ ] Communication templates prepared (internal, external, regulatory)
[ ] Status page process documented for customer communication
[ ] Containment tools available: kill switch, token revocation, IP blocking
[ ] Emergency deployment process allows expedited security patches
[ ] Vendor contact information available for all critical dependencies

Post-Incident:
[ ] Blameless postmortem template in use
[ ] Postmortem conducted within 5 business days of incident resolution
[ ] Corrective actions tracked in issue tracker with owners and deadlines
[ ] Corrective action completion reviewed at monthly security meeting
[ ] Runbooks updated after every real incident
[ ] Incident metrics (count, MTTR, MTTD) tracked and reported monthly
[ ] Annual summary of incidents and trends presented to leadership
```
