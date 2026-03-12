# TLS & Certificate Management

> **Domain:** Backend > Security > Cryptography
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

TLS (Transport Layer Security) is the foundation of every secure communication on the internet. Without TLS, every API call, every login, every webhook is transmitted in plaintext — visible at every network hop. Incorrect TLS configuration (old versions, weak cipher suites, expired certificates) creates a false sense of security or service outages. Certificate management in production (Let's Encrypt, rotation, mTLS) is operational complexity that, if done wrong, takes down an entire service.

---

## How It Works

### TLS Handshake (TLS 1.3 — Simplified)

```
Client                                    Server
  │                                         │
  │  1. ClientHello                         │
  │  (supported ciphers, key share)         │
  │────────────────────────────────────────▶│
  │                                         │
  │  2. ServerHello + Certificate +         │
  │     Key Share + Finished                │
  │◀────────────────────────────────────────│
  │                                         │
  │  3. Client verifies certificate         │
  │     Computes shared secret              │
  │     Sends Finished                      │
  │────────────────────────────────────────▶│
  │                                         │
  │  ═══════ Encrypted Channel ═══════      │
  │  4. Application Data (HTTP, gRPC)       │
  │◀═══════════════════════════════════════▶│
```

TLS 1.3: **1-RTT handshake** (vs 2-RTT in TLS 1.2). Zero-RTT available for resumed connections.

### TLS Version Comparison

| Feature | TLS 1.2 | TLS 1.3 |
|---------|---------|---------|
| Handshake RTT | 2 | **1** |
| Cipher suites | 37+ (many weak) | **5** (all strong) |
| Forward secrecy | Optional | **Mandatory** |
| RSA key exchange | Supported | **Removed** |
| 0-RTT resumption | ❌ | ✅ |
| Compression | Supported (CRIME vuln) | **Removed** |
| Renegotiation | Supported (vuln risk) | **Removed** |

**Rule:** ALWAYS support TLS 1.3. Allow TLS 1.2 as fallback. NEVER allow TLS 1.1 or below.

---

## TLS Configuration

### Node.js (Express/Fastify)

```typescript
// TypeScript — TLS Configuration
import https from "https";
import fs from "fs";
import express from "express";

const app = express();

// Production TLS config
const server = https.createServer(
  {
    key: fs.readFileSync("/etc/ssl/private/server.key"),
    cert: fs.readFileSync("/etc/ssl/certs/server.crt"),
    ca: fs.readFileSync("/etc/ssl/certs/ca-bundle.crt"),

    // TLS version control
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",

    // Cipher suite control (TLS 1.2 only — 1.3 has fixed suites)
    ciphers: [
      "TLS_AES_256_GCM_SHA384",          // TLS 1.3
      "TLS_CHACHA20_POLY1305_SHA256",     // TLS 1.3
      "TLS_AES_128_GCM_SHA256",          // TLS 1.3
      "ECDHE-ECDSA-AES256-GCM-SHA384",   // TLS 1.2
      "ECDHE-RSA-AES256-GCM-SHA384",     // TLS 1.2
      "ECDHE-ECDSA-CHACHA20-POLY1305",   // TLS 1.2
      "ECDHE-RSA-CHACHA20-POLY1305",     // TLS 1.2
      "ECDHE-ECDSA-AES128-GCM-SHA256",   // TLS 1.2
      "ECDHE-RSA-AES128-GCM-SHA256",     // TLS 1.2
    ].join(":"),

    // Prefer server cipher order
    honorCipherOrder: true,

    // ECDH curves
    ecdhCurve: "X25519:P-256:P-384",

    // Session resumption
    sessionTimeout: 300, // 5 minutes
  },
  app
);

server.listen(443);
```

### Go

```go
// Go — TLS Configuration
package main

import (
    "crypto/tls"
    "log"
    "net/http"
)

func main() {
    tlsConfig := &tls.Config{
        MinVersion: tls.VersionTLS12,
        MaxVersion: tls.VersionTLS13,

        // TLS 1.2 cipher suites (TLS 1.3 suites are auto-selected)
        CipherSuites: []uint16{
            tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256,
            tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256,
            tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
            tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
        },

        // Prefer server cipher order
        PreferServerCipherSuites: true,

        // Curve preferences
        CurvePreferences: []tls.CurveID{
            tls.X25519,
            tls.CurveP256,
            tls.CurveP384,
        },
    }

    server := &http.Server{
        Addr:      ":443",
        TLSConfig: tlsConfig,
        Handler:   handler,
    }

    log.Fatal(server.ListenAndServeTLS(
        "/etc/ssl/certs/server.crt",
        "/etc/ssl/private/server.key",
    ))
}
```

### Nginx (Reverse Proxy — Most Common)

```nginx
# nginx — Production TLS configuration
server {
    listen 443 ssl http2;
    server_name api.example.com;

    # Certificates
    ssl_certificate     /etc/ssl/certs/fullchain.pem;
    ssl_certificate_key /etc/ssl/private/privkey.pem;
    ssl_trusted_certificate /etc/ssl/certs/chain.pem;

    # Protocols — TLS 1.2 + 1.3 only
    ssl_protocols TLSv1.2 TLSv1.3;

    # Cipher suites
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;

    # ECDH curve
    ssl_ecdh_curve X25519:prime256v1:secp384r1;

    # Session caching
    ssl_session_cache shared:TLS:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;  # More secure without

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # HSTS (Strict Transport Security)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Proxy to backend
    location / {
        proxy_pass http://backend:3000;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name api.example.com;
    return 301 https://$server_name$request_uri;
}
```

---

## Certificate Management

### Let's Encrypt (ACME Protocol)

```yaml
# Docker Compose — Certbot auto-renewal
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - certbot-webroot:/var/www/certbot:ro
      - certbot-certs:/etc/letsencrypt:ro

  certbot:
    image: certbot/certbot
    volumes:
      - certbot-webroot:/var/www/certbot
      - certbot-certs:/etc/letsencrypt
    # Initial certificate
    command: certonly --webroot --webroot-path=/var/www/certbot
      --email admin@example.com --agree-tos --no-eff-email
      -d api.example.com -d www.example.com
    # Renewal cron (run every 12h)
    # certbot renew --quiet --deploy-hook "nginx -s reload"

volumes:
  certbot-webroot:
  certbot-certs:
```

```bash
# cert-manager in Kubernetes (automated Let's Encrypt)
# ClusterIssuer
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: nginx
---
# Certificate
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: api-tls
  namespace: production
spec:
  secretName: api-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - api.example.com
    - "*.api.example.com"
  renewBefore: 360h  # 15 days before expiry
```

### Certificate Monitoring

```typescript
// TypeScript — Certificate Expiry Monitoring
import tls from "tls";

interface CertInfo {
  domain: string;
  validFrom: Date;
  validTo: Date;
  daysUntilExpiry: number;
  issuer: string;
  subject: string;
}

async function checkCertificate(hostname: string): Promise<CertInfo> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname },
      () => {
        const cert = socket.getPeerCertificate();
        const validTo = new Date(cert.valid_to);
        const daysUntilExpiry = Math.floor(
          (validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        resolve({
          domain: hostname,
          validFrom: new Date(cert.valid_from),
          validTo,
          daysUntilExpiry,
          issuer: cert.issuer.O,
          subject: cert.subject.CN,
        });

        socket.end();
      }
    );

    socket.on("error", reject);
  });
}

// Health check — run daily
async function monitorCertificates(): Promise<void> {
  const domains = [
    "api.example.com",
    "auth.example.com",
    "webhook.example.com",
  ];

  for (const domain of domains) {
    try {
      const info = await checkCertificate(domain);

      if (info.daysUntilExpiry <= 7) {
        await alertCritical(`Certificate expires in ${info.daysUntilExpiry} days`, {
          domain,
          expiresAt: info.validTo.toISOString(),
        });
      } else if (info.daysUntilExpiry <= 30) {
        await alertWarning(`Certificate expires in ${info.daysUntilExpiry} days`, {
          domain,
        });
      }
    } catch (error) {
      await alertCritical(`Certificate check failed for ${domain}`, {
        error: String(error),
      });
    }
  }
}
```

---

## Mutual TLS (mTLS)

Standard TLS: only the server proves its identity. mTLS: the client ALSO proves who it is.

```
Standard TLS:          mTLS:
Client → Server cert   Client cert ↔ Server cert
(one-way)              (two-way)
```

### mTLS Implementation

```go
// Go — mTLS Server
package main

import (
    "crypto/tls"
    "crypto/x509"
    "log"
    "net/http"
    "os"
)

func setupMTLSServer() *http.Server {
    // Load CA certificate to verify client certs
    caCert, err := os.ReadFile("/etc/ssl/ca/ca.crt")
    if err != nil {
        log.Fatalf("read CA cert: %v", err)
    }

    caCertPool := x509.NewCertPool()
    caCertPool.AppendCertsFromPEM(caCert)

    tlsConfig := &tls.Config{
        ClientAuth: tls.RequireAndVerifyClientCert,
        ClientCAs:  caCertPool,
        MinVersion: tls.VersionTLS12,
    }

    return &http.Server{
        Addr:      ":443",
        TLSConfig: tlsConfig,
        Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Access client certificate info
            if len(r.TLS.PeerCertificates) > 0 {
                clientCert := r.TLS.PeerCertificates[0]
                log.Printf("Client: %s (org: %s)",
                    clientCert.Subject.CommonName,
                    clientCert.Subject.Organization)
            }
            w.Write([]byte("Authenticated via mTLS"))
        }),
    }
}
```

```go
// Go — mTLS Client
func setupMTLSClient() *http.Client {
    // Load client certificate and key
    clientCert, err := tls.LoadX509KeyPair(
        "/etc/ssl/client/client.crt",
        "/etc/ssl/client/client.key",
    )
    if err != nil {
        log.Fatalf("load client cert: %v", err)
    }

    // Load CA certificate to verify server
    caCert, err := os.ReadFile("/etc/ssl/ca/ca.crt")
    if err != nil {
        log.Fatalf("read CA cert: %v", err)
    }

    caCertPool := x509.NewCertPool()
    caCertPool.AppendCertsFromPEM(caCert)

    return &http.Client{
        Transport: &http.Transport{
            TLSClientConfig: &tls.Config{
                Certificates: []tls.Certificate{clientCert},
                RootCAs:      caCertPool,
                MinVersion:   tls.VersionTLS12,
            },
        },
    }
}
```

### When to Use mTLS

| Use Case | mTLS; |
|----------|-------|
| Service-to-service (microservices) | ✅ Yes |
| API gateway → backend services | ✅ Yes |
| B2B partner integrations | ✅ Yes |
| Public API (browser clients) | ❌ No — use OAuth/JWT |
| Mobile apps | ❌ No — certificate management too complex |
| Internal admin tools | ✅ Yes — zero-trust |

---

## Certificate Types

| Type | Validation | Use Case | Cost |
|------|-----------|----------|------|
| **DV (Domain Validated)** | Domain ownership | APIs, websites | Free (Let's Encrypt) |
| **OV (Organization Validated)** | Organization check | Business APIs | $50-200/yr |
| **EV (Extended Validation)** | Full legal verification | Banking, finance | $200-1000/yr |
| **Wildcard** | `*.example.com` | Multiple subdomains | Varies |
| **SAN (Subject Alternative Name)** | Multiple domains | Multi-domain setup | Varies |
| **Self-signed** | None | Development only | Free |

**NEVER use self-signed in production.** NEVER use DV certificates without ACME auto-renewal.

---

## Certificate Best Practices Table

| Practice | Why |
|----------|-------|
| Use ECDSA P-256 keys (not RSA) | Smaller, faster, equally secure |
| Auto-renew 30 days before expiry | Buffer for renewal failures |
| Monitor certificate expiry daily | Prevent outages from expired certs |
| Use OCSP Stapling | Faster, privacy-preserving revocation check |
| Disable session tickets | Prevent forward secrecy bypass |
| Use HSTS with preload | Prevent downgrade attacks |
| Store private keys in HSM/KMS | Prevent key extraction |

---

## Best Practices

1. **ALWAYS use TLS 1.3** — faster, more secure, mandatory forward secrecy
2. **ALWAYS allow TLS 1.2 as fallback** — some clients don't support 1.3 yet
3. **NEVER allow TLS 1.1 or below** — deprecated, vulnerable
4. **ALWAYS use ECDSA certificates** — P-256 for speed, P-384 for paranoia
5. **ALWAYS auto-renew certificates** — Let's Encrypt + cert-manager
6. **ALWAYS monitor certificate expiry** — daily check, alert at 30 and 7 days
7. **ALWAYS use HSTS** — `max-age=63072000; includeSubDomains; preload`
8. **ALWAYS enable OCSP Stapling** — faster TLS handshake, privacy
9. **ALWAYS use mTLS for service-to-service** — zero-trust internal communication
10. **NEVER use self-signed in production** — breaks trust chain, training users to ignore warnings
11. **NEVER store private keys in source code** — KMS, vault, or filesystem with 0600 permissions
12. **NEVER disable certificate verification** — `NODE_TLS_REJECT_UNAUTHORIZED=0` is a security hole

---

## Anti-patterns / Common Mistakes

| Anti-pattern | Symptom | Fix |
|-------------|----------|------|
| TLS 1.0/1.1 enabled | Vulnerable to BEAST, POODLE | Min TLS 1.2 |
| Weak cipher suites (RC4, DES) | Exploitable encryption | GCM-only cipher suites |
| Expired certificates | Service outage, browser warnings | Auto-renewal + monitoring |
| Self-signed in production | Users trained to click "proceed" | Let's Encrypt (free) |
| No HSTS | Downgrade attacks possible | HSTS with preload |
| RSA 2048 key exchange | Slow, larger handshake | ECDSA P-256 |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` | All certificate validation disabled | Fix the real certificate issue |
| Manual certificate renewal | Human error → outage | ACME auto-renewal |
| No mTLS for internal services | Internal traffic unencrypted | Service mesh mTLS or manual mTLS |
| Private keys in git | Key compromised forever | .gitignore, KMS, rotate immediately |

---

## Real-world Examples

### Cloudflare
- TLS 1.3 by default for all customers since 2018
- Custom certificate rotation every 15 days
- ECDSA P-256 preferred, RSA 2048 fallback
- OCSP Stapling on all certificates

### Google
- TLS 1.3 for >95% of traffic
- BoringSSL (custom OpenSSL fork)
- Certificate Transparency logs (public audit)
- Internal mTLS via ALTS (Application Layer Transport Security)

### Let's Encrypt
- 300+ million active certificates
- 90-day certificate lifetime (forces automation)
- ACME protocol standard (RFC 8555)
- Free DV certificates, wildcard support
- Rate limits: 50 certs/domain/week

