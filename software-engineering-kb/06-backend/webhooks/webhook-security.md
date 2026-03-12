# Webhook Security

> **Domain:** Backend > Webhooks
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

Webhooks open a massive attack surface: the producer sends HTTP requests to URLs controlled by the consumer (SSRF risk), the consumer accepts POST requests from anyone (spoofing risk), and payloads may contain sensitive data (data leak risk). Without HMAC signing, timestamp validation, and SSRF protection, webhooks become an entry point for attackers. Every serious provider (Stripe, GitHub, Slack) implements multiple layers of security — there is no reason not to do the same.

---

## How It Works

### Webhook Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    WEBHOOK SECURITY                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: TRANSPORT                                         │
│  ├── HTTPS only (TLS 1.2+)                                 │
│  ├── Certificate validation                                 │
│  └── No HTTP fallback                                       │
│                                                             │
│  Layer 2: AUTHENTICATION                                    │
│  ├── HMAC signature (SHA-256)                               │
│  ├── Timestamp to prevent replay                            │
│  └── Per-subscription unique secrets                        │
│                                                             │
│  Layer 3: AUTHORIZATION                                     │
│  ├── IP allowlisting (optional)                             │
│  ├── mTLS (enterprise)                                      │
│  └── URL ownership verification                             │
│                                                             │
│  Layer 4: PAYLOAD SECURITY                                  │
│  ├── No sensitive data in payload                           │
│  ├── Payload size limits                                    │
│  └── Schema validation                                      │
│                                                             │
│  Layer 5: PRODUCER PROTECTION                               │
│  ├── SSRF prevention                                        │
│  ├── DNS rebinding protection                               │
│  └── Redirect following limits                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## HMAC Signature Verification

### Signing — Producer Side

The standard approach: `HMAC-SHA256(timestamp + "." + payload, secret)`

```typescript
// TypeScript — HMAC Signing (Producer)
import crypto from "crypto";

interface SignedHeaders {
  "X-Webhook-Signature": string;
  "X-Webhook-Timestamp": string;
  "X-Webhook-ID": string;
}

function signWebhook(
  payload: string,
  secret: string,
  eventId: string
): SignedHeaders {
  const timestamp = Math.floor(Date.now() / 1000);

  // Sign: timestamp.payload — prevents replay attacks
  const signedContent = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedContent)
    .digest("hex");

  return {
    "X-Webhook-ID": eventId,
    "X-Webhook-Timestamp": timestamp.toString(),
    "X-Webhook-Signature": `v1=${signature}`,
  };
}

// Multiple signatures for secret rotation
function signWebhookMulti(
  payload: string,
  secrets: string[],  // [current, previous]
  eventId: string
): SignedHeaders {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedContent = `${timestamp}.${payload}`;

  const signatures = secrets.map((secret) => {
    const sig = crypto
      .createHmac("sha256", secret)
      .update(signedContent)
      .digest("hex");
    return `v1=${sig}`;
  });

  return {
    "X-Webhook-ID": eventId,
    "X-Webhook-Timestamp": timestamp.toString(),
    "X-Webhook-Signature": signatures.join(","),
  };
}
```

```go
// Go — HMAC Signing (Producer)
package webhooks

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "strconv"
    "strings"
    "time"
)

type SignedHeaders struct {
    WebhookID        string
    WebhookTimestamp string
    WebhookSignature string
}

func SignWebhook(payload []byte, secret string, eventID string) SignedHeaders {
    timestamp := time.Now().Unix()
    signedContent := fmt.Sprintf("%d.%s", timestamp, payload)

    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(signedContent))
    signature := hex.EncodeToString(mac.Sum(nil))

    return SignedHeaders{
        WebhookID:        eventID,
        WebhookTimestamp: strconv.FormatInt(timestamp, 10),
        WebhookSignature: fmt.Sprintf("v1=%s", signature),
    }
}

func SignWebhookMulti(payload []byte, secrets []string, eventID string) SignedHeaders {
    timestamp := time.Now().Unix()
    signedContent := fmt.Sprintf("%d.%s", timestamp, payload)

    var sigs []string
    for _, secret := range secrets {
        mac := hmac.New(sha256.New, []byte(secret))
        mac.Write([]byte(signedContent))
        sig := hex.EncodeToString(mac.Sum(nil))
        sigs = append(sigs, fmt.Sprintf("v1=%s", sig))
    }

    return SignedHeaders{
        WebhookID:        eventID,
        WebhookTimestamp: strconv.FormatInt(timestamp, 10),
        WebhookSignature: strings.Join(sigs, ","),
    }
}
```

```python
# Python — HMAC Signing (Producer)
import hashlib
import hmac
import time

def sign_webhook(
    payload: bytes, secret: str, event_id: str
) -> dict[str, str]:
    timestamp = int(time.time())
    signed_content = f"{timestamp}.".encode() + payload

    signature = hmac.new(
        secret.encode(),
        signed_content,
        hashlib.sha256,
    ).hexdigest()

    return {
        "X-Webhook-ID": event_id,
        "X-Webhook-Timestamp": str(timestamp),
        "X-Webhook-Signature": f"v1={signature}",
    }

def sign_webhook_multi(
    payload: bytes, secrets: list[str], event_id: str
) -> dict[str, str]:
    timestamp = int(time.time())
    signed_content = f"{timestamp}.".encode() + payload

    signatures = []
    for secret in secrets:
        sig = hmac.new(
            secret.encode(),
            signed_content,
            hashlib.sha256,
        ).hexdigest()
        signatures.append(f"v1={sig}")

    return {
        "X-Webhook-ID": event_id,
        "X-Webhook-Timestamp": str(timestamp),
        "X-Webhook-Signature": ",".join(signatures),
    }
```

### Verification — Consumer Side

```typescript
// TypeScript — HMAC Verification (Consumer)
import crypto from "crypto";
import express from "express";

const TIMESTAMP_TOLERANCE_SECONDS = 300; // 5 minutes

function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  // Step 1: Validate timestamp freshness — prevent replay attacks
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) {
    return false; // Too old or too far in future
  }

  // Step 2: Compute expected signature
  const signedContent = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(signedContent)
    .digest("hex");

  // Step 3: Parse signature header (may contain multiple: "v1=abc,v1=def")
  const signatures = signature.split(",").map((s) => s.trim());
  const v1Signatures = signatures
    .filter((s) => s.startsWith("v1="))
    .map((s) => s.slice(3));

  // Step 4: Constant-time comparison — prevent timing attacks
  return v1Signatures.some((sig) =>
    crypto.timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex")
    )
  );
}

// Express middleware
function webhookVerification(secret: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // MUST use raw body — parsed JSON won't match signature
    const rawBody = (req as any).rawBody as string;
    const signature = req.headers["x-webhook-signature"] as string;
    const timestamp = req.headers["x-webhook-timestamp"] as string;

    if (!signature || !timestamp || !rawBody) {
      res.status(401).json({ error: "Missing signature headers" });
      return;
    }

    if (!verifyWebhookSignature(rawBody, signature, timestamp, secret)) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    next();
  };
}

// CRITICAL: Preserve raw body for signature verification
const app = express();
app.use("/webhooks", express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  },
}));
app.post("/webhooks/handler", webhookVerification(WEBHOOK_SECRET), handleWebhook);
```

```go
// Go — HMAC Verification (Consumer)
package webhooks

import (
    "crypto/hmac"
    "crypto/sha256"
    "crypto/subtle"
    "encoding/hex"
    "fmt"
    "io"
    "math"
    "net/http"
    "strconv"
    "strings"
    "time"
)

const TimestampTolerance = 5 * time.Minute

func VerifyWebhookSignature(payload []byte, signature, timestamp, secret string) error {
    // Step 1: Validate timestamp
    ts, err := strconv.ParseInt(timestamp, 10, 64)
    if err != nil {
        return fmt.Errorf("invalid timestamp: %w", err)
    }
    diff := time.Since(time.Unix(ts, 0))
    if math.Abs(diff.Seconds()) > TimestampTolerance.Seconds() {
        return fmt.Errorf("timestamp too old: %v", diff)
    }

    // Step 2: Compute expected
    signedContent := fmt.Sprintf("%s.%s", timestamp, payload)
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(signedContent))
    expected := hex.EncodeToString(mac.Sum(nil))

    // Step 3: Parse signatures
    parts := strings.Split(signature, ",")
    for _, part := range parts {
        part = strings.TrimSpace(part)
        if !strings.HasPrefix(part, "v1=") {
            continue
        }
        sig := strings.TrimPrefix(part, "v1=")

        // Step 4: Constant-time comparison
        if subtle.ConstantTimeCompare([]byte(sig), []byte(expected)) == 1 {
            return nil
        }
    }

    return fmt.Errorf("no matching signature found")
}

// Middleware
func WebhookVerificationMiddleware(secret string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            body, err := io.ReadAll(r.Body)
            if err != nil {
                http.Error(w, "failed to read body", http.StatusBadRequest)
                return
            }

            sig := r.Header.Get("X-Webhook-Signature")
            ts := r.Header.Get("X-Webhook-Timestamp")

            if err := VerifyWebhookSignature(body, sig, ts, secret); err != nil {
                http.Error(w, "invalid signature", http.StatusUnauthorized)
                return
            }

            // Put raw body back for handler
            r.Body = io.NopCloser(bytes.NewReader(body))
            next.ServeHTTP(w, r)
        })
    }
}
```

```python
# Python — HMAC Verification (Consumer)
import hashlib
import hmac
import math
import time
from fastapi import Request, HTTPException

TIMESTAMP_TOLERANCE = 300  # 5 minutes

def verify_webhook_signature(
    payload: bytes,
    signature: str,
    timestamp: str,
    secret: str,
) -> bool:
    # Step 1: Validate timestamp
    try:
        ts = int(timestamp)
    except ValueError:
        return False

    if abs(time.time() - ts) > TIMESTAMP_TOLERANCE:
        return False

    # Step 2: Compute expected
    signed_content = f"{timestamp}.".encode() + payload
    expected = hmac.new(
        secret.encode(), signed_content, hashlib.sha256
    ).hexdigest()

    # Step 3: Check signatures
    for part in signature.split(","):
        part = part.strip()
        if not part.startswith("v1="):
            continue
        sig = part[3:]
        # Step 4: Constant-time comparison
        if hmac.compare_digest(sig, expected):
            return True

    return False

# FastAPI dependency
async def verify_webhook(request: Request) -> bytes:
    body = await request.body()
    signature = request.headers.get("X-Webhook-Signature", "")
    timestamp = request.headers.get("X-Webhook-Timestamp", "")
    secret = get_webhook_secret()

    if not verify_webhook_signature(body, signature, timestamp, secret):
        raise HTTPException(401, "Invalid webhook signature")

    return body

# Usage
@router.post("/webhooks/handler")
async def handle_webhook(body: bytes = Depends(verify_webhook)):
    event = json.loads(body)
    await process_event(event)
    return {"status": "ok"}
```

---

## Secret Rotation

### Zero-Downtime Secret Rotation

```
Timeline:
─────────────────────────────────────────────────────────
Day 0:  Create new secret, keep old
        → Sign with BOTH secrets (dual signatures)
        → Consumer accepts either signature ✓

Day 7:  Consumer updates to new secret
        → Old signatures still valid during transition ✓

Day 14: Remove old secret
        → Only new secret used for signing
─────────────────────────────────────────────────────────
```

```typescript
// TypeScript — Secret Rotation
interface SubscriptionSecrets {
  current: string;
  previous: string | null;
  rotated_at: Date;
}

// Producer: rotate secret
async function rotateSecret(subscriptionId: string): Promise<{
  new_secret: string;
}> {
  const sub = await getSubscription(subscriptionId);

  const newSecret = `whsec_${crypto.randomBytes(32).toString("hex")}`;

  await updateSubscription(subscriptionId, {
    secret_current: newSecret,
    secret_previous: sub.secret_current, // Keep old as fallback
    secret_rotated_at: new Date(),
  });

  // Return new secret to subscription owner — ONLY TIME it's visible
  return { new_secret: newSecret };
}

// Producer: sign with both secrets during rotation window
function signWithRotation(
  payload: string,
  secrets: SubscriptionSecrets,
  eventId: string
): SignedHeaders {
  const activeSecrets = [secrets.current];

  // Include previous secret if rotation was recent (< 14 days)
  if (secrets.previous && secrets.rotated_at) {
    const daysSinceRotation =
      (Date.now() - secrets.rotated_at.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceRotation < 14) {
      activeSecrets.push(secrets.previous);
    }
  }

  return signWebhookMulti(payload, activeSecrets, eventId);
}
```

---

## SSRF Prevention — Producer Side

When the user provides a webhook URL, the producer makes an HTTP request to it. Without protection: SSRF.

```typescript
// TypeScript — SSRF Prevention
import { lookup } from "dns/promises";
import { URL } from "url";
import net from "net";

const BLOCKED_IP_RANGES = [
  "10.0.0.0/8",       // Private Class A
  "172.16.0.0/12",    // Private Class B
  "192.168.0.0/16",   // Private Class C
  "127.0.0.0/8",      // Loopback
  "169.254.0.0/16",   // Link-local
  "0.0.0.0/8",        // Current network
  "100.64.0.0/10",    // Shared address space (CGNAT)
  "198.18.0.0/15",    // Benchmarking
  "fc00::/7",         // IPv6 unique local
  "fe80::/10",        // IPv6 link-local
  "::1/128",          // IPv6 loopback
];

function isPrivateIP(ip: string): boolean {
  return BLOCKED_IP_RANGES.some((cidr) => isInCIDR(ip, cidr));
}

async function validateWebhookURL(urlStr: string): Promise<void> {
  const url = new URL(urlStr);

  // MUST be HTTPS
  if (url.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS");
  }

  // Block IP addresses directly — force DNS resolution
  if (net.isIP(url.hostname)) {
    throw new Error("Webhook URL must use a domain name, not IP address");
  }

  // Resolve DNS and check IP
  const { address } = await lookup(url.hostname);
  if (isPrivateIP(address)) {
    throw new Error("Webhook URL resolves to private/internal IP");
  }

  // Block common internal hostnames
  const blocked = ["localhost", "metadata.google.internal", "169.254.169.254"];
  if (blocked.includes(url.hostname.toLowerCase())) {
    throw new Error("Webhook URL points to blocked hostname");
  }

  // Block non-standard ports (optional, but recommended)
  const port = url.port ? parseInt(url.port) : 443;
  if (port !== 443 && port !== 8443) {
    throw new Error("Webhook URL must use port 443 or 8443");
  }
}

// DNS rebinding protection: resolve at delivery time too
async function safeDeliver(
  url: string,
  payload: string,
  headers: Record<string, string>
): Promise<Response> {
  // Re-resolve DNS at delivery time
  const parsedUrl = new URL(url);
  const { address } = await lookup(parsedUrl.hostname);
  if (isPrivateIP(address)) {
    throw new Error("DNS rebinding detected: URL resolves to private IP");
  }

  return fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: payload,
    redirect: "manual",  // NEVER follow redirects automatically
    signal: AbortSignal.timeout(30_000),
  });
}
```

```go
// Go — SSRF Prevention
package webhooks

import (
    "fmt"
    "net"
    "net/url"
    "strings"
)

var blockedNetworks = []string{
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "0.0.0.0/8",
    "100.64.0.0/10",
}

var blockedHostnames = []string{
    "localhost",
    "metadata.google.internal",
    "169.254.169.254",
}

func ValidateWebhookURL(rawURL string) error {
    parsed, err := url.Parse(rawURL)
    if err != nil {
        return fmt.Errorf("invalid URL: %w", err)
    }

    if parsed.Scheme != "https" {
        return fmt.Errorf("must use HTTPS")
    }

    hostname := parsed.Hostname()

    // Block direct IPs
    if net.ParseIP(hostname) != nil {
        return fmt.Errorf("must use domain name, not IP")
    }

    // Block known internal hostnames
    for _, blocked := range blockedHostnames {
        if strings.EqualFold(hostname, blocked) {
            return fmt.Errorf("blocked hostname: %s", hostname)
        }
    }

    // Resolve and check
    ips, err := net.LookupHost(hostname)
    if err != nil {
        return fmt.Errorf("DNS resolution failed: %w", err)
    }

    for _, ipStr := range ips {
        ip := net.ParseIP(ipStr)
        if ip == nil {
            continue
        }
        for _, cidr := range blockedNetworks {
            _, network, _ := net.ParseCIDR(cidr)
            if network.Contains(ip) {
                return fmt.Errorf("resolves to private IP: %s", ipStr)
            }
        }
    }

    return nil
}

// Custom transport that re-validates DNS at connection time
type SSRFSafeTransport struct {
    Base http.RoundTripper
}

func (t *SSRFSafeTransport) RoundTrip(req *http.Request) (*http.Response, error) {
    hostname := req.URL.Hostname()
    ips, err := net.LookupHost(hostname)
    if err != nil {
        return nil, fmt.Errorf("DNS lookup failed: %w", err)
    }

    for _, ipStr := range ips {
        ip := net.ParseIP(ipStr)
        for _, cidr := range blockedNetworks {
            _, network, _ := net.ParseCIDR(cidr)
            if network.Contains(ip) {
                return nil, fmt.Errorf("DNS rebinding: %s → %s", hostname, ipStr)
            }
        }
    }

    return t.Base.RoundTrip(req)
}
```

```python
# Python — SSRF Prevention
import ipaddress
import socket
from urllib.parse import urlparse

BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

BLOCKED_HOSTNAMES = {"localhost", "metadata.google.internal", "169.254.169.254"}

def is_private_ip(ip_str: str) -> bool:
    ip = ipaddress.ip_address(ip_str)
    return any(ip in network for network in BLOCKED_NETWORKS)

def validate_webhook_url(url: str) -> None:
    parsed = urlparse(url)

    if parsed.scheme != "https":
        raise ValueError("Webhook URL must use HTTPS")

    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL: no hostname")

    # Block direct IPs
    try:
        ipaddress.ip_address(hostname)
        raise ValueError("Must use domain name, not IP")
    except ValueError as e:
        if "Must use" in str(e):
            raise

    # Block known internal hostnames
    if hostname.lower() in BLOCKED_HOSTNAMES:
        raise ValueError(f"Blocked hostname: {hostname}")

    # Resolve and check
    try:
        results = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        raise ValueError(f"DNS resolution failed for {hostname}")

    for family, _, _, _, sockaddr in results:
        ip_str = sockaddr[0]
        if is_private_ip(ip_str):
            raise ValueError(f"Resolves to private IP: {ip_str}")
```

---

## IP Allowlisting

Publish the IP ranges of the webhook service so consumers can allowlist them.

```typescript
// TypeScript — Published IP Ranges
// GET /webhooks/ips — public endpoint
router.get("/webhooks/ips", (req, res) => {
  res.json({
    ipv4: [
      "203.0.113.0/24",
      "198.51.100.0/24",
    ],
    ipv6: [
      "2001:db8::/32",
    ],
    last_updated: "2024-03-01",
    // Consumers should poll this periodically
    cache_ttl_hours: 24,
  });
});

// Consumer-side: validate source IP
function webhookIPAllowlist(allowedCIDRs: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const sourceIP = req.ip || req.socket.remoteAddress;

    const allowed = allowedCIDRs.some((cidr) => isInCIDR(sourceIP, cidr));
    if (!allowed) {
      res.status(403).json({ error: "IP not allowed" });
      return;
    }

    next();
  };
}
```

---

## Payload Security

### Do not send sensitive data in webhook payloads

```typescript
// ❌ BAD — Sensitive data in payload
const badEvent = {
  type: "customer.created",
  data: {
    id: "cust_123",
    email: "user@example.com",
    ssn: "123-45-6789",        // PII leakage!
    credit_card: "4242...4242", // Payment data!
    password_hash: "bcrypt...",  // Security risk!
  },
};

// ✅ GOOD — Only IDs + link for details
const goodEvent = {
  type: "customer.created",
  data: {
    id: "cust_123",
    resource_url: "https://api.example.com/v1/customers/cust_123",
  },
};

// ✅ ALSO GOOD — Key fields without sensitive data
const betterEvent = {
  type: "customer.created",
  data: {
    id: "cust_123",
    name: "John Doe",
    plan: "enterprise",
    created_at: "2024-03-15T10:30:00Z",
    resource_url: "https://api.example.com/v1/customers/cust_123",
  },
};
```

### Payload Size Limits

```typescript
// Producer: enforce max payload size
const MAX_PAYLOAD_SIZE = 256 * 1024; // 256KB

function createWebhookPayload(event: WebhookEvent): string {
  const payload = JSON.stringify(event);

  if (Buffer.byteLength(payload) > MAX_PAYLOAD_SIZE) {
    // Trim to thin event + resource URL
    const thinEvent: WebhookEvent = {
      ...event,
      data: {
        id: (event.data as any).id,
        resource_url: (event.data as any).resource_url,
        _truncated: true,
      },
    };
    return JSON.stringify(thinEvent);
  }

  return payload;
}
```

---

## URL Ownership Verification

Before sending webhooks to a URL, make sure the subscriber actually controls that URL.

### Challenge-Response Verification

```typescript
// TypeScript — Challenge-Response
async function verifyURLOwnership(url: string): Promise<boolean> {
  const challenge = crypto.randomBytes(32).toString("hex");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "url_verification",
        challenge,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return false;

    const body = await response.json();
    return body.challenge === challenge;
  } catch {
    return false;
  }
}
```

### Alternative: Verification Token in URL

```
// Consumer adds verification token as query param:
https://example.com/webhooks?verify=tok_abc123def456

// Producer validates token exists in subscription database
// Less secure than challenge-response but simpler
```

---

## Redirect Handling

```typescript
// NEVER follow redirects blindly — re-validate each hop
async function safeDeliverWithRedirects(
  url: string,
  payload: string,
  headers: Record<string, string>,
  maxRedirects: number = 3
): Promise<Response> {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    // Validate URL before each request
    await validateWebhookURL(currentUrl);

    const response = await fetch(currentUrl, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: payload,
      redirect: "manual",  // Don't auto-follow
      signal: AbortSignal.timeout(30_000),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location) {
        throw new Error("Redirect without Location header");
      }
      currentUrl = new URL(location, currentUrl).toString();
      redirectCount++;
      continue;
    }

    return response;
  }

  throw new Error(`Too many redirects (${maxRedirects})`);
}
```

---

## Rate Limiting Webhook Deliveries

```typescript
// Per-subscription rate limiting — prevent abuse
import { RateLimiterRedis } from "rate-limiter-flexible";

const deliveryLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "webhook_delivery",
  points: 1000,      // Max 1000 deliveries
  duration: 3600,    // Per hour per subscription
  blockDuration: 60, // Block for 1 minute if exceeded
});

async function rateLimitedDelivery(
  subscriptionId: string,
  job: WebhookJob
): Promise<void> {
  try {
    await deliveryLimiter.consume(subscriptionId);
    await deliver(job);
  } catch (rateLimitError) {
    // Queue for later delivery
    await scheduleRetry(job, 60_000); // Retry in 1 minute
  }
}
```

---

## Best Practices

1. **ALWAYS use HMAC-SHA256 signing** — SHA-1 is deprecated, MD5 is broken
2. **ALWAYS include timestamp in signature** — prevents replay attacks
3. **ALWAYS use constant-time comparison** — `crypto.timingSafeEqual`, `hmac.compare_digest`, `subtle.ConstantTimeCompare`
4. **ALWAYS validate URLs resolve to public IPs** — both at registration AND delivery time
5. **ALWAYS require HTTPS** — never allow HTTP webhook URLs
6. **ALWAYS support secret rotation** — sign with current + previous secret
7. **ALWAYS use unique per-subscription secrets** — shared secrets = single point of compromise
8. **NEVER include sensitive/PII data in payloads** — use resource URLs instead
9. **NEVER follow redirects automatically** — re-validate SSRF on each hop
10. **NEVER log webhook secrets** — treat as credentials
11. **ALWAYS publish IP ranges** — let consumers allowlist your webhook sources
12. **ALWAYS limit payload size** — 256KB max, truncate to thin event if exceeded

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| No signature verification | Consumer accepts spoofed events | HMAC-SHA256 on every event |
| Signature without timestamp | Replay attacks possible | Include timestamp, reject > 5min old |
| `==` instead of constant-time compare | Timing attack reveals signature | Use language-specific safe comparison |
| HTTP webhook URLs | Credentials/data exposed in transit | Require HTTPS, reject HTTP |
| Shared signing secret | One compromise affects all consumers | Unique secret per subscription |
| No SSRF protection | Attacker targets internal services | Validate resolved IPs, block private ranges |
| Following redirects | SSRF via redirect to internal IP | Manual redirect handling with re-validation |
| Sensitive data in payload | Data leak if consumer is compromised | Thin events + resource URLs |
| Logging secrets | Secret exposure in log aggregation | Never log secrets, mask in error messages |
| No secret rotation | Compromised secret = permanent access | Support rotation with overlap window |
| No rate limiting | Abuse via mass subscription creation | Per-subscription delivery rate limits |
| No URL verification | Webhook to unowned URLs | Challenge-response or token verification |

---

## Real-world Examples

### Stripe Signature Scheme
- `Stripe-Signature: t=timestamp,v1=signature`
- HMAC-SHA256 with `timestamp.payload`
- Tolerance: 5 minutes (default in their SDK)
- Per-endpoint unique signing secret
- `whsec_` prefix for easy identification in logs

### GitHub Signature
- `X-Hub-Signature-256: sha256=signature`
- HMAC-SHA256 of raw body
- No timestamp (weaker replay protection)
- Per-webhook unique secret

### Slack Request Verification
- `X-Slack-Signature: v0=signature`
- HMAC-SHA256 of `v0:timestamp:body`
- `X-Slack-Request-Timestamp` header
- 5-minute tolerance
- App signing secret shared across all events

### Twilio Signature
- `X-Twilio-Signature`: HMAC-SHA1 (legacy) of URL + sorted POST params
- Uses Auth Token as HMAC key
- Form-encoded (not JSON)
- Validates full URL including query params

### Svix (Webhook Infrastructure)
- Open-source webhook standard (Standard Webhooks)
- `webhook-id`, `webhook-timestamp`, `webhook-signature` headers
- HMAC-SHA256 with `msg_id.timestamp.body`
- `whsec_` base64-encoded secrets
- SDK for verification in 10+ languages
