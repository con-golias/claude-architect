# Encryption in Transit

## Comprehensive Guide to Protecting Data During Transmission

Category: Data Security
Scope: TLS, certificate management, mTLS, service mesh, protocol configuration
Last Updated: 2025-12-01
Status: Living Document

---

## Table of Contents

1. Why Encrypt Data in Transit
2. TLS 1.3 vs TLS 1.2
3. TLS Handshake Process
4. Certificate Types
5. Certificate Management
6. Certificate Pinning
7. HSTS (HTTP Strict Transport Security)
8. mTLS (Mutual TLS)
9. Cipher Suite Configuration
10. OCSP Stapling
11. Certificate Transparency
12. Internal Service Encryption
13. Database Connection Encryption
14. Configuration Examples
15. Best Practices
16. Anti-Patterns
17. Enforcement Checklist

---

## 1. Why Encrypt Data in Transit

### Threats Addressed

- **Eavesdropping**: Attackers on shared networks (WiFi, ISP) reading plaintext traffic
- **Man-in-the-Middle (MITM)**: Attackers intercepting and modifying traffic between parties
- **Session hijacking**: Stealing authentication tokens from unencrypted HTTP traffic
- **DNS spoofing**: Redirecting traffic to malicious servers without certificate validation
- **Traffic analysis**: Inferring sensitive information from unencrypted metadata

### Compliance Requirements

- **PCI DSS Requirement 4**: Encrypt transmission of cardholder data across open networks
- **HIPAA Security Rule**: Implement encryption for ePHI in transit
- **GDPR Article 32**: Apply appropriate technical measures including encryption
- **SOC 2**: Demonstrate encryption of data during transmission
- **FedRAMP**: Require FIPS 140-2 validated encryption for federal systems

### Encrypt Everything

Modern security posture requires encrypting ALL traffic, not just "sensitive" traffic:

- External client-to-server traffic (HTTPS)
- Internal service-to-service traffic (mTLS)
- Database connections (TLS/SSL)
- Message queue connections (TLS)
- Cache connections (TLS)
- Load balancer to backend connections (TLS)
- CI/CD pipeline communications (TLS)

---

## 2. TLS 1.3 vs TLS 1.2

### TLS 1.3 Improvements

TLS 1.3 (RFC 8446) is the current standard. Prefer TLS 1.3 wherever possible.

```
+--------------------------------------------------------------+
| Feature                  | TLS 1.2          | TLS 1.3        |
|--------------------------------------------------------------+
| Handshake round-trips    | 2 RTT            | 1 RTT          |
| 0-RTT resumption         | Not available    | Supported      |
| Cipher suites            | Many (some weak) | 5 (all strong) |
| Key exchange             | RSA or ECDHE     | ECDHE only     |
| Forward secrecy          | Optional         | Mandatory      |
| Renegotiation            | Supported (vuln) | Removed         |
| Compression              | Supported (vuln) | Removed         |
| Static RSA key exchange  | Supported (weak) | Removed         |
| CBC cipher modes         | Supported        | Removed         |
| RC4, DES, 3DES           | Some support     | Removed         |
+--------------------------------------------------------------+
```

### TLS 1.3 Cipher Suites

TLS 1.3 supports only five cipher suites, all using AEAD:

```
TLS_AES_256_GCM_SHA384        (mandatory)
TLS_AES_128_GCM_SHA256        (mandatory)
TLS_CHACHA20_POLY1305_SHA256  (recommended)
TLS_AES_128_CCM_SHA256        (optional)
TLS_AES_128_CCM_8_SHA256      (optional)
```

### Disable TLS 1.0 and 1.1

TLS 1.0 and 1.1 are deprecated (RFC 8996). Disable them immediately.

```nginx
# Nginx: Only allow TLS 1.2 and 1.3
ssl_protocols TLSv1.2 TLSv1.3;
```

---

## 3. TLS Handshake Process

### TLS 1.2 Handshake (2-RTT)

```
Client                                       Server
  |                                            |
  |--- ClientHello (versions, ciphers) ------->|
  |                                            |
  |<-- ServerHello (version, cipher) ----------|
  |<-- Certificate (server cert) --------------|
  |<-- ServerKeyExchange (ECDHE params) -------|
  |<-- ServerHelloDone ------------------------|
  |                                            |
  |--- ClientKeyExchange (ECDHE public) ------>|
  |--- ChangeCipherSpec ---------------------->|
  |--- Finished (encrypted) ------------------>|
  |                                            |
  |<-- ChangeCipherSpec -----------------------|
  |<-- Finished (encrypted) -------------------|
  |                                            |
  |=== Application Data (encrypted) ==========|
```

### TLS 1.3 Handshake (1-RTT)

```
Client                                       Server
  |                                            |
  |--- ClientHello + KeyShare --------------->|
  |                                            |
  |<-- ServerHello + KeyShare ----------------|
  |<-- EncryptedExtensions (encrypted) -------|
  |<-- Certificate (encrypted) ---------------|
  |<-- CertificateVerify (encrypted) ---------|
  |<-- Finished (encrypted) ------------------|
  |                                            |
  |--- Finished (encrypted) ------------------>|
  |                                            |
  |=== Application Data (encrypted) ==========|
```

### TLS 1.3 0-RTT Resumption

0-RTT allows sending application data in the first message during session resumption.

**Warning**: 0-RTT data is NOT replay-protected. Only use for idempotent requests
(GET). Never use 0-RTT for state-changing operations (POST, PUT, DELETE).

```
Client                                       Server
  |                                            |
  |--- ClientHello + KeyShare + 0-RTT data -->|
  |                                            |
  |<-- ServerHello + KeyShare ----------------|
  |<-- Finished -------------------------------|
  |                                            |
  |--- Finished ------------------------------>|
  |=== Application Data ======================|
```

---

## 4. Certificate Types

### Domain Validation (DV)

- Validates domain ownership only (DNS or HTTP challenge)
- Lowest cost (often free via Let's Encrypt)
- Fastest issuance (minutes)
- Suitable for most applications
- No organization identity verification

### Organization Validation (OV)

- Validates domain ownership AND organization identity
- Moderate cost and issuance time (days)
- Displays organization name in certificate details
- Suitable for business applications

### Extended Validation (EV)

- Most rigorous validation of organization identity
- Highest cost and longest issuance time (weeks)
- Previously showed green bar in browsers (no longer the case)
- Limited additional value over DV with proper security controls
- Consider whether the cost is justified for your use case

### Wildcard Certificates

- Cover all subdomains at one level: `*.example.com`
- Do NOT cover the apex domain or multi-level subdomains
- `*.example.com` covers `api.example.com` but NOT `example.com` or `a.b.example.com`
- Require careful key management since compromise affects all subdomains

### Multi-Domain (SAN) Certificates

- Cover multiple specific domains in one certificate
- Use Subject Alternative Names (SAN) extension
- Useful for services with multiple domain names

---

## 5. Certificate Management

### Let's Encrypt and ACME Protocol

Let's Encrypt provides free DV certificates with automated issuance and renewal
via the ACME (Automatic Certificate Management Environment) protocol.

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate with Nginx plugin
certbot --nginx -d example.com -d www.example.com

# Obtain certificate with standalone server
certbot certonly --standalone -d example.com

# Obtain certificate with DNS challenge (for wildcards)
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/cloudflare.ini \
  -d '*.example.com' -d example.com

# Test auto-renewal
certbot renew --dry-run

# Auto-renewal via cron (certbot installs timer automatically)
# Verify timer: systemctl list-timers | grep certbot
```

### Certificate Auto-Renewal

```bash
# Cron job for renewal (if systemd timer not available)
# Run twice daily as recommended by Let's Encrypt
0 0,12 * * * certbot renew --quiet --deploy-hook "systemctl reload nginx"
```

### Certificate Monitoring

```python
import ssl
import socket
from datetime import datetime, timezone


def check_certificate_expiry(hostname: str, port: int = 443) -> dict:
    """Check certificate expiration for a hostname."""
    context = ssl.create_default_context()
    conn = context.wrap_socket(
        socket.socket(socket.AF_INET),
        server_hostname=hostname
    )
    conn.settimeout(10)
    conn.connect((hostname, port))
    cert = conn.getpeercert()
    conn.close()

    not_after = datetime.strptime(
        cert['notAfter'], '%b %d %H:%M:%S %Y %Z'
    ).replace(tzinfo=timezone.utc)

    days_remaining = (not_after - datetime.now(timezone.utc)).days

    return {
        'hostname': hostname,
        'issuer': dict(x[0] for x in cert['issuer']),
        'subject': dict(x[0] for x in cert['subject']),
        'not_after': not_after.isoformat(),
        'days_remaining': days_remaining,
        'is_expiring_soon': days_remaining < 30,
        'san': [
            entry[1] for entry in cert.get('subjectAltName', [])
        ]
    }


# Usage
result = check_certificate_expiry('example.com')
if result['is_expiring_soon']:
    alert(f"Certificate expires in {result['days_remaining']} days")
```

---

## 6. Certificate Pinning

### Status and Recommendations

Certificate pinning has evolved significantly:

- **Browser pinning (HPKP)**: Deprecated and removed from browsers (too risky, can
  cause permanent denial of service if misconfigured)
- **Mobile app pinning**: Still used but declining in favor of Certificate Transparency
- **Certificate Transparency (CT)**: Preferred modern approach for detecting rogue
  certificates

### Mobile Certificate Pinning (When Still Needed)

```kotlin
// Android: Certificate pinning with OkHttp
val client = OkHttpClient.Builder()
    .certificatePinner(
        CertificatePinner.Builder()
            .add("api.example.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
            .add("api.example.com", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=")  // backup
            .build()
    )
    .build()
```

```swift
// iOS: Certificate pinning with URLSession
class PinningDelegate: NSObject, URLSessionDelegate {
    let pinnedCertificates: Set<Data>

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard let serverTrust = challenge.protectionSpace.serverTrust,
              let certificate = SecTrustGetCertificateAtIndex(serverTrust, 0) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        let serverCertData = SecCertificateCopyData(certificate) as Data

        if pinnedCertificates.contains(serverCertData) {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}
```

### Certificate Transparency as Alternative

Certificate Transparency (CT) requires CAs to log all issued certificates to public
logs. Monitor CT logs for unauthorized certificates issued for your domains.

```python
# Monitor Certificate Transparency logs
import requests


def monitor_ct_logs(domain: str):
    """Query crt.sh for certificates issued for a domain."""
    response = requests.get(
        f'https://crt.sh/?q=%.{domain}&output=json',
        timeout=30
    )
    certs = response.json()

    for cert in certs:
        print(f"Issuer: {cert['issuer_name']}")
        print(f"CN: {cert['common_name']}")
        print(f"Not Before: {cert['not_before']}")
        print(f"Not After: {cert['not_after']}")
        print("---")


monitor_ct_logs('example.com')
```

---

## 7. HSTS (HTTP Strict Transport Security)

### What HSTS Does

HSTS instructs browsers to always use HTTPS for a domain, preventing:
- Downgrade attacks (stripping HTTPS to HTTP)
- Mixed content issues
- Cookie theft over HTTP

### HSTS Header Configuration

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- **max-age**: Duration in seconds (31536000 = 1 year minimum for preload)
- **includeSubDomains**: Apply HSTS to all subdomains (required for preload)
- **preload**: Indicate intent to be included in browser preload lists

### Deployment Strategy

Deploy HSTS incrementally to avoid lockouts:

```nginx
# Stage 1: Short max-age, no subdomains (test for 1 week)
add_header Strict-Transport-Security "max-age=604800" always;

# Stage 2: Longer max-age, add subdomains (test for 1 month)
add_header Strict-Transport-Security "max-age=2592000; includeSubDomains" always;

# Stage 3: Full deployment with preload (production)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

### HSTS Preload

Submit your domain to the HSTS preload list (hstspreload.org) for maximum protection.
Once preloaded, browsers will use HTTPS for your domain even on the first visit.

**Warning**: Preload removal takes months. Ensure ALL subdomains support HTTPS before
enabling includeSubDomains and preload.

### Nginx HSTS Configuration

```nginx
server {
    listen 80;
    server_name example.com;
    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # HSTS with preload
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Additional security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
}
```

---

## 8. mTLS (Mutual TLS)

### What mTLS Provides

Standard TLS authenticates only the server to the client. mTLS additionally
authenticates the client to the server using client certificates.

```
Standard TLS:
  Client verifies Server certificate  (one-way)

mTLS:
  Client verifies Server certificate  (two-way)
  Server verifies Client certificate
```

### Use Cases

- Service-to-service communication in microservices
- API authentication for machine-to-machine calls
- Zero trust network architectures
- IoT device authentication

### mTLS in Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name api.internal.example.com;

    # Server certificate
    ssl_certificate /etc/ssl/server.crt;
    ssl_certificate_key /etc/ssl/server.key;

    # Client certificate verification
    ssl_client_certificate /etc/ssl/ca.crt;  # CA that signed client certs
    ssl_verify_client on;                     # Require client certificate
    ssl_verify_depth 2;                       # Verification chain depth

    # Pass client certificate info to backend
    proxy_set_header X-Client-DN $ssl_client_s_dn;
    proxy_set_header X-Client-Verify $ssl_client_verify;

    location / {
        # Only allow connections with valid client certificates
        if ($ssl_client_verify != SUCCESS) {
            return 403;
        }
        proxy_pass http://backend;
    }
}
```

### mTLS in Go

```go
package main

import (
    "crypto/tls"
    "crypto/x509"
    "fmt"
    "log"
    "net/http"
    "os"
)

// Server with mTLS
func startMTLSServer() {
    // Load CA certificate for client verification
    caCert, err := os.ReadFile("ca.crt")
    if err != nil {
        log.Fatal(err)
    }
    caCertPool := x509.NewCertPool()
    caCertPool.AppendCertsFromPEM(caCert)

    // Configure TLS with client certificate requirement
    tlsConfig := &tls.Config{
        ClientCAs:  caCertPool,
        ClientAuth: tls.RequireAndVerifyClientCert,
        MinVersion: tls.VersionTLS12,
    }

    server := &http.Server{
        Addr:      ":8443",
        TLSConfig: tlsConfig,
    }

    http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        // Access client certificate details
        if len(r.TLS.PeerCertificates) > 0 {
            clientCert := r.TLS.PeerCertificates[0]
            fmt.Fprintf(w, "Hello, %s\n", clientCert.Subject.CommonName)
        }
    })

    log.Fatal(server.ListenAndServeTLS("server.crt", "server.key"))
}

// Client with mTLS
func createMTLSClient() *http.Client {
    // Load client certificate
    cert, err := tls.LoadX509KeyPair("client.crt", "client.key")
    if err != nil {
        log.Fatal(err)
    }

    // Load CA certificate for server verification
    caCert, err := os.ReadFile("ca.crt")
    if err != nil {
        log.Fatal(err)
    }
    caCertPool := x509.NewCertPool()
    caCertPool.AppendCertsFromPEM(caCert)

    return &http.Client{
        Transport: &http.Transport{
            TLSClientConfig: &tls.Config{
                Certificates: []tls.Certificate{cert},
                RootCAs:      caCertPool,
                MinVersion:   tls.VersionTLS12,
            },
        },
    }
}
```

### mTLS in Node.js

```typescript
import https from 'https';
import fs from 'fs';
import tls from 'tls';

// Server with mTLS
const serverOptions: https.ServerOptions = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  ca: fs.readFileSync('ca.crt'),          // CA for client cert validation
  requestCert: true,                       // Request client certificate
  rejectUnauthorized: true,                // Reject invalid client certs
  minVersion: 'TLSv1.2' as tls.SecureVersion
};

const server = https.createServer(serverOptions, (req, res) => {
  const clientCert = (req.socket as tls.TLSSocket).getPeerCertificate();
  if (clientCert && clientCert.subject) {
    res.end(`Hello, ${clientCert.subject.CN}\n`);
  } else {
    res.statusCode = 403;
    res.end('Client certificate required\n');
  }
});

server.listen(8443);

// Client with mTLS
const clientOptions: https.RequestOptions = {
  hostname: 'api.internal.example.com',
  port: 8443,
  path: '/',
  method: 'GET',
  key: fs.readFileSync('client.key'),
  cert: fs.readFileSync('client.crt'),
  ca: fs.readFileSync('ca.crt'),
  rejectUnauthorized: true
};

const req = https.request(clientOptions, (res) => {
  res.on('data', (data) => console.log(data.toString()));
});
req.end();
```

---

## 9. Cipher Suite Configuration

### Recommended Cipher Suites

Prefer AEAD ciphers that provide both encryption and authentication:

```
# TLS 1.3 (all are AEAD, no configuration needed)
TLS_AES_256_GCM_SHA384
TLS_CHACHA20_POLY1305_SHA256
TLS_AES_128_GCM_SHA256

# TLS 1.2 (explicitly configure AEAD suites only)
ECDHE-ECDSA-AES256-GCM-SHA384
ECDHE-RSA-AES256-GCM-SHA384
ECDHE-ECDSA-CHACHA20-POLY1305
ECDHE-RSA-CHACHA20-POLY1305
ECDHE-ECDSA-AES128-GCM-SHA256
ECDHE-RSA-AES128-GCM-SHA256
```

### Ciphers to Disable

Disable all of the following:

- RC4 (broken)
- DES / 3DES (weak / sweet32 attack)
- Export ciphers (40-bit, intentionally weak)
- NULL ciphers (no encryption)
- CBC mode ciphers (padding oracle attacks)
- Static RSA key exchange (no forward secrecy)
- MD5 MAC (broken hash)
- SHA-1 MAC (deprecated)

### Nginx Cipher Configuration

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers on;

# DH parameters (at least 2048 bits)
ssl_dhparam /etc/ssl/dhparam.pem;

# ECDH curve
ssl_ecdh_curve secp384r1;

# Session configuration
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;  # Disable for forward secrecy
```

### Generate DH Parameters

```bash
# Generate 4096-bit DH parameters (takes several minutes)
openssl dhparam -out /etc/ssl/dhparam.pem 4096
```

---

## 10. OCSP Stapling

### What OCSP Stapling Does

OCSP (Online Certificate Status Protocol) allows clients to verify that a certificate
has not been revoked. OCSP stapling has the server fetch and cache the OCSP response,
then "staple" it to the TLS handshake.

### Benefits

- **Privacy**: Client does not contact the CA directly (CA cannot track user browsing)
- **Performance**: Eliminates extra round-trip to OCSP responder
- **Reliability**: Works even if the OCSP responder is down (uses cached response)

### Nginx OCSP Stapling

```nginx
ssl_stapling on;
ssl_stapling_verify on;

# Trusted CA certificate for OCSP verification
ssl_trusted_certificate /etc/letsencrypt/live/example.com/chain.pem;

# DNS resolver for OCSP responder
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

### Verify OCSP Stapling

```bash
# Test OCSP stapling
openssl s_client -connect example.com:443 -status -servername example.com 2>/dev/null | \
  grep -A 10 "OCSP Response"

# Expected output should show "OCSP Response Status: successful"
```

---

## 11. Certificate Transparency

### How CT Works

Certificate Transparency requires Certificate Authorities to log all certificates
they issue to publicly auditable logs. This enables:

- Detection of misissued certificates
- Detection of compromised CAs
- Public accountability for certificate issuance

### CT Log Monitoring

```python
import requests
from datetime import datetime


class CTMonitor:
    """Monitor Certificate Transparency logs for your domains."""

    def __init__(self, domains: list[str]):
        self.domains = domains

    def check_new_certs(self, domain: str, hours: int = 24) -> list[dict]:
        """Query crt.sh for recently issued certificates."""
        response = requests.get(
            f'https://crt.sh/?q=%.{domain}&output=json',
            timeout=30
        )

        if response.status_code != 200:
            return []

        certs = response.json()
        recent = []

        for cert in certs:
            issued = datetime.strptime(
                cert['not_before'], '%Y-%m-%dT%H:%M:%S'
            )
            age_hours = (datetime.utcnow() - issued).total_seconds() / 3600

            if age_hours <= hours:
                recent.append({
                    'issuer': cert['issuer_name'],
                    'common_name': cert['common_name'],
                    'not_before': cert['not_before'],
                    'not_after': cert['not_after'],
                    'serial': cert.get('serial_number', 'N/A')
                })

        return recent

    def monitor_all(self, hours: int = 24):
        """Monitor all configured domains."""
        for domain in self.domains:
            certs = self.check_new_certs(domain, hours)
            if certs:
                for cert in certs:
                    # Alert on unexpected certificates
                    self.evaluate_certificate(domain, cert)

    def evaluate_certificate(self, domain: str, cert: dict):
        """Evaluate whether a certificate is expected."""
        known_issuers = [
            "Let's Encrypt",
            "DigiCert",
            "Sectigo"
        ]
        issuer = cert['issuer']
        if not any(known in issuer for known in known_issuers):
            self.alert(
                f"Unexpected certificate for {domain} "
                f"from issuer: {issuer}"
            )

    def alert(self, message: str):
        """Send alert for unexpected certificates."""
        print(f"ALERT: {message}")
        # Integrate with PagerDuty, Slack, etc.
```

### Expect-CT Header (Deprecated)

The Expect-CT header is deprecated as CT is now required for all publicly trusted
certificates. No action needed for new deployments.

---

## 12. Internal Service Encryption

### Service Mesh TLS (Istio)

Istio provides automatic mTLS between services in a Kubernetes cluster.

```yaml
# Istio PeerAuthentication: Require mTLS for all services
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT  # Reject any non-mTLS traffic

---
# Namespace-level mTLS policy
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT

---
# Istio DestinationRule: Configure mTLS for specific service
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: api-service
  namespace: production
spec:
  host: api-service.production.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
```

### Linkerd mTLS

```yaml
# Linkerd automatically enables mTLS for injected pods
# Inject Linkerd sidecar
# kubectl get deploy -o yaml | linkerd inject - | kubectl apply -f -

# Verify mTLS status
# linkerd viz stat deploy -n production
# Look for "MESHED" column showing secured connections
```

### Internal CA for Service Certificates

```bash
# Create internal CA
openssl req -x509 -new -nodes \
  -keyout internal-ca.key \
  -sha384 -days 3650 \
  -out internal-ca.crt \
  -subj "/CN=Internal CA/O=MyCompany"

# Generate service certificate
openssl req -new -nodes \
  -keyout service.key \
  -out service.csr \
  -subj "/CN=api-service.internal"

# Sign with internal CA
openssl x509 -req \
  -in service.csr \
  -CA internal-ca.crt \
  -CAkey internal-ca.key \
  -CAcreateserial \
  -out service.crt \
  -days 365 \
  -sha384 \
  -extfile <(printf "subjectAltName=DNS:api-service.internal,DNS:api-service.production.svc.cluster.local")
```

---

## 13. Database Connection Encryption

### PostgreSQL TLS Configuration

```ini
# postgresql.conf
ssl = on
ssl_cert_file = '/etc/postgresql/server.crt'
ssl_key_file = '/etc/postgresql/server.key'
ssl_ca_file = '/etc/postgresql/ca.crt'
ssl_min_protocol_version = 'TLSv1.2'
ssl_ciphers = 'HIGH:!aNULL:!MD5:!3DES:!RC4'

# Require TLS for all connections (pg_hba.conf)
# TYPE  DATABASE  USER  ADDRESS       METHOD
hostssl all       all   0.0.0.0/0     scram-sha-256
hostssl all       all   ::/0          scram-sha-256
```

### Client Connection with sslmode=verify-full

```python
# Python: PostgreSQL with full SSL verification
import psycopg2

conn = psycopg2.connect(
    host='db.example.com',
    port=5432,
    dbname='myapp',
    user='app_user',
    password='secure_password',
    sslmode='verify-full',          # Verify server cert AND hostname
    sslcert='/etc/ssl/client.crt',  # Client certificate (for mTLS)
    sslkey='/etc/ssl/client.key',   # Client private key
    sslrootcert='/etc/ssl/ca.crt'   # CA certificate
)
```

```go
// Go: PostgreSQL with full SSL verification
package main

import (
    "database/sql"
    "fmt"
    _ "github.com/lib/pq"
)

func connectDB() (*sql.DB, error) {
    connStr := fmt.Sprintf(
        "host=%s port=%d user=%s password=%s dbname=%s "+
            "sslmode=verify-full sslcert=%s sslkey=%s sslrootcert=%s",
        "db.example.com", 5432,
        "app_user", "secure_password", "myapp",
        "/etc/ssl/client.crt",
        "/etc/ssl/client.key",
        "/etc/ssl/ca.crt",
    )

    return sql.Open("postgres", connStr)
}
```

```typescript
// TypeScript: PostgreSQL with SSL
import { Pool } from 'pg';
import fs from 'fs';

const pool = new Pool({
  host: 'db.example.com',
  port: 5432,
  database: 'myapp',
  user: 'app_user',
  password: 'secure_password',
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/etc/ssl/ca.crt').toString(),
    cert: fs.readFileSync('/etc/ssl/client.crt').toString(),
    key: fs.readFileSync('/etc/ssl/client.key').toString()
  }
});
```

### MySQL TLS Configuration

```ini
# my.cnf server configuration
[mysqld]
ssl-ca=/etc/mysql/ca.crt
ssl-cert=/etc/mysql/server.crt
ssl-key=/etc/mysql/server.key
require_secure_transport=ON
tls_version=TLSv1.2,TLSv1.3
```

```python
# Python: MySQL with SSL
import mysql.connector

conn = mysql.connector.connect(
    host='db.example.com',
    user='app_user',
    password='secure_password',
    database='myapp',
    ssl_ca='/etc/ssl/ca.crt',
    ssl_cert='/etc/ssl/client.crt',
    ssl_key='/etc/ssl/client.key',
    ssl_verify_cert=True,
    ssl_verify_identity=True
)
```

---

## 14. Configuration Examples

### Nginx: Production-Grade TLS

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    # Certificates
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    # Protocol versions
    ssl_protocols TLSv1.2 TLSv1.3;

    # Cipher suites (TLS 1.2 only; TLS 1.3 ciphers are fixed)
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers off;  # Let client choose for TLS 1.3

    # DH parameters
    ssl_dhparam /etc/ssl/dhparam.pem;

    # ECDH curve
    ssl_ecdh_curve X25519:secp384r1;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/example.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;

    # Session configuration
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

### Caddy: Automatic TLS

```
# Caddyfile -- Caddy handles TLS automatically
example.com {
    # TLS is automatic with Let's Encrypt
    # To customize:
    tls {
        protocols tls1.2 tls1.3
        ciphers TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384 TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
    }

    reverse_proxy localhost:8080
}
```

### Java: TLS Configuration

```java
import javax.net.ssl.*;
import java.security.KeyStore;
import java.io.FileInputStream;

public class TLSConfig {

    public static SSLContext createSSLContext() throws Exception {
        // Load trust store (CA certificates)
        KeyStore trustStore = KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream("/etc/ssl/truststore.p12")) {
            trustStore.load(fis, "truststore-password".toCharArray());
        }

        TrustManagerFactory tmf = TrustManagerFactory.getInstance(
            TrustManagerFactory.getDefaultAlgorithm()
        );
        tmf.init(trustStore);

        // Load key store (client certificate for mTLS)
        KeyStore keyStore = KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream("/etc/ssl/keystore.p12")) {
            keyStore.load(fis, "keystore-password".toCharArray());
        }

        KeyManagerFactory kmf = KeyManagerFactory.getInstance(
            KeyManagerFactory.getDefaultAlgorithm()
        );
        kmf.init(keyStore, "key-password".toCharArray());

        // Create SSL context
        SSLContext sslContext = SSLContext.getInstance("TLSv1.3");
        sslContext.init(kmf.getKeyManagers(), tmf.getTrustManagers(), null);

        return sslContext;
    }

    public static SSLParameters getSecureParameters() {
        SSLParameters params = new SSLParameters();
        params.setProtocols(new String[]{"TLSv1.3", "TLSv1.2"});
        params.setCipherSuites(new String[]{
            "TLS_AES_256_GCM_SHA384",
            "TLS_AES_128_GCM_SHA256",
            "TLS_CHACHA20_POLY1305_SHA256"
        });
        params.setEndpointIdentificationAlgorithm("HTTPS");
        return params;
    }
}
```

### Python: Secure HTTP Client

```python
import ssl
import urllib3
import requests
from requests.adapters import HTTPAdapter


class TLSAdapter(HTTPAdapter):
    """Force TLS 1.2+ with strong cipher suites."""

    def init_poolmanager(self, *args, **kwargs):
        ctx = ssl.create_default_context()
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.set_ciphers(
            'ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20'
        )
        # Disable compression (CRIME attack)
        ctx.options |= ssl.OP_NO_COMPRESSION
        kwargs['ssl_context'] = ctx
        return super().init_poolmanager(*args, **kwargs)


# Usage
session = requests.Session()
session.mount('https://', TLSAdapter())

response = session.get('https://api.example.com/data')
```

---

## 15. Best Practices

### 1. Enforce TLS 1.2 as Minimum, Prefer TLS 1.3

Disable TLS 1.0 and 1.1 on all servers and clients. TLS 1.3 provides mandatory
forward secrecy, fewer round trips, and removes all weak cipher suites. Configure
servers to support both TLS 1.2 and 1.3 for compatibility.

### 2. Use AEAD Cipher Suites Exclusively

Select only AEAD (Authenticated Encryption with Associated Data) cipher suites:
AES-GCM and ChaCha20-Poly1305. Disable CBC mode ciphers which are vulnerable to
padding oracle attacks.

### 3. Enable HSTS with Preload for Public-Facing Services

Deploy HSTS incrementally (short max-age first, then full deployment). Include
the preload directive and submit to the preload list for complete protection
against downgrade attacks.

### 4. Automate Certificate Renewal

Use ACME protocol (Let's Encrypt, certbot) for automated certificate management.
Set up monitoring to alert when certificates are within 30 days of expiry. Never
rely on manual renewal processes.

### 5. Implement mTLS for Service-to-Service Communication

Use mutual TLS for all internal service communication. Service meshes (Istio, Linkerd)
provide automatic mTLS with minimal application changes. Rotate service certificates
frequently (24-72 hours).

### 6. Encrypt All Database Connections with sslmode=verify-full

Configure database clients to verify both the server certificate and hostname.
Using sslmode=require without verification is vulnerable to MITM attacks.
Always verify the full certificate chain.

### 7. Enable OCSP Stapling

Configure OCSP stapling on all TLS-terminating servers to improve performance and
privacy. Verify stapling is working with regular automated checks.

### 8. Monitor Certificate Transparency Logs

Set up automated monitoring of CT logs for your domains to detect unauthorized
certificate issuance. Alert on certificates from unexpected CAs.

### 9. Disable TLS Session Tickets for Forward Secrecy

TLS session tickets can compromise forward secrecy if the ticket key is compromised.
Disable session tickets or implement proper ticket key rotation.

### 10. Test TLS Configuration Regularly

Use tools like SSL Labs (ssllabs.com/ssltest), testssl.sh, or Mozilla Observatory
to regularly assess TLS configuration. Automate these tests in CI/CD pipelines.

---

## 16. Anti-Patterns

### 1. Setting rejectUnauthorized to false

Disabling certificate verification in Node.js or other clients defeats the purpose
of TLS entirely. It allows MITM attacks. Never use this in production, not even
as a "temporary fix."

### 2. Using Self-Signed Certificates Without Proper Trust Configuration

Self-signed certificates are acceptable for internal services, but configure proper
trust by distributing the CA certificate to all clients. Do not disable verification
to work around trust issues.

### 3. Terminating TLS at the Load Balancer and Using HTTP Internally

Traffic between the load balancer and backend services is vulnerable if sent over
unencrypted HTTP. Use TLS all the way to the application or use a service mesh for
internal encryption.

### 4. Hardcoding Certificate Paths Without Rotation Support

Design the certificate loading to support hot-reloading or automated restarts on
renewal. Hardcoded paths that require manual restarts lead to expired certificates.

### 5. Using Wildcard Certificates Across Trust Boundaries

A wildcard certificate for `*.example.com` used across multiple teams means a
compromise in one team's service exposes all services. Use separate certificates
for separate trust boundaries.

### 6. Allowing TLS 1.0/1.1 for "Backward Compatibility"

Supporting deprecated TLS versions exposes the server to known vulnerabilities
(POODLE, BEAST). Modern clients all support TLS 1.2. The compatibility argument
is no longer valid.

### 7. Ignoring Certificate Expiry Monitoring

Certificates expire, and expired certificates cause outages. Many high-profile
outages have been caused by forgotten certificate renewals. Implement automated
monitoring and alerting.

### 8. Mixing HTTP and HTTPS Content (Mixed Content)

Loading HTTP resources from an HTTPS page degrades security. Modern browsers block
mixed active content. Ensure all resources (scripts, styles, images, APIs) use HTTPS.

---

## 17. Enforcement Checklist

### TLS Configuration

- [ ] TLS 1.2 is the minimum version on all servers
- [ ] TLS 1.3 is enabled and preferred where supported
- [ ] TLS 1.0 and 1.1 are disabled on all servers
- [ ] Only AEAD cipher suites are enabled (AES-GCM, ChaCha20-Poly1305)
- [ ] Forward secrecy is enforced (ECDHE key exchange only)
- [ ] DH parameters are at least 2048 bits (4096 preferred)
- [ ] TLS compression is disabled (CRIME attack mitigation)
- [ ] Session tickets are disabled or properly rotated

### Certificate Management

- [ ] All certificates are issued by a trusted CA (or properly configured internal CA)
- [ ] Certificate auto-renewal is configured (ACME/certbot)
- [ ] Certificate expiry monitoring is in place (alert at 30 days)
- [ ] Certificate revocation checking is enabled (OCSP stapling)
- [ ] Wildcard certificates are limited to appropriate scope
- [ ] Certificate private keys are stored securely with proper permissions
- [ ] CT log monitoring is configured for all domains

### HTTP Security

- [ ] HTTP to HTTPS redirect is configured (301 redirect)
- [ ] HSTS is enabled with appropriate max-age
- [ ] HSTS includeSubDomains is enabled where appropriate
- [ ] HSTS preload is submitted for public-facing domains
- [ ] No mixed content (all resources loaded over HTTPS)

### Service-to-Service

- [ ] mTLS is enabled for all internal service communication
- [ ] Service certificates are rotated frequently (24-72 hours)
- [ ] Service mesh mTLS is in STRICT mode (no plaintext fallback)
- [ ] Internal CA is properly secured and rotated

### Database Connections

- [ ] All database connections use TLS (sslmode=verify-full)
- [ ] Database servers require TLS (reject plaintext connections)
- [ ] Database TLS certificates are properly managed and rotated
- [ ] Client certificate authentication is used where appropriate

### Testing and Monitoring

- [ ] SSL Labs score is A or A+ for all public endpoints
- [ ] TLS configuration is tested in CI/CD pipeline
- [ ] Certificate transparency logs are monitored
- [ ] Automated alerts for certificate issues (expiry, revocation, unexpected issuance)
- [ ] Regular penetration testing of TLS implementation
- [ ] Downgrade attack testing is performed
