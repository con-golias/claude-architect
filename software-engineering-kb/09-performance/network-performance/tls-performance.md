# TLS Performance Optimization

> **Domain:** Network Performance · **Importance:** Critical

---

## Overview

TLS secures every HTTPS connection but adds latency through handshakes, certificate validation, and cryptographic operations. TLS 1.3 reduces the handshake from 2-RTT (TLS 1.2) to 1-RTT, with 0-RTT resumption for returning clients. Optimize TLS performance through protocol selection, session resumption, certificate chain reduction, OCSP stapling, cipher suite tuning, and hardware acceleration. Every millisecond in the TLS handshake delays the first byte of every resource on the page.

---

## TLS 1.3 vs TLS 1.2 Handshake

### TLS 1.2 — 2-RTT Handshake

```
Client                              Server
  |──── ClientHello ──────────────────>|  RTT 1
  |<─── ServerHello + Certificate ─────|
  |<─── ServerKeyExchange ─────────────|
  |<─── ServerHelloDone ───────────────|
  |──── ClientKeyExchange ────────────>|  RTT 2
  |──── ChangeCipherSpec ─────────────>|
  |──── Finished ─────────────────────>|
  |<─── ChangeCipherSpec ──────────────|
  |<─── Finished ──────────────────────|
  |──── Application Data ────────────>|  (finally!)

Total: 2 RTTs before first byte of application data
On 100ms RTT link: 200ms handshake overhead
```

### TLS 1.3 — 1-RTT Handshake

```
Client                              Server
  |──── ClientHello + KeyShare ───────>|  RTT 1
  |<─── ServerHello + KeyShare ────────|
  |<─── EncryptedExtensions ───────────|
  |<─── Certificate + Verify ──────────|
  |<─── Finished ──────────────────────|
  |──── Finished ─────────────────────>|
  |──── Application Data ────────────>|  (1 RTT earlier!)

Total: 1 RTT before first byte of application data
On 100ms RTT link: 100ms handshake overhead (50% faster)
```

### Latency Impact

| Scenario | TLS 1.2 | TLS 1.3 | TLS 1.3 0-RTT |
|----------|---------|---------|---------------|
| LAN (1ms RTT) | 2ms | 1ms | 0ms |
| Regional (20ms RTT) | 40ms | 20ms | 0ms |
| Cross-continent (100ms RTT) | 200ms | 100ms | 0ms |
| Mobile/satellite (300ms RTT) | 600ms | 300ms | 0ms |

---

## 0-RTT Resumption

TLS 1.3 0-RTT allows the client to send application data in the first packet of a resumed connection using a pre-shared key (PSK) from a previous session.

```
Returning client with cached PSK:
  Client ──── ClientHello + PSK + EarlyData(GET /index.html) ────> Server
  Server processes request immediately (0 RTT handshake latency)
```

### Benefits and Risks

| Aspect | Detail |
|--------|--------|
| Latency savings | Eliminates 1 RTT (20-300ms depending on distance) |
| Replay vulnerability | 0-RTT data can be captured and replayed by an attacker |
| Safe methods | GET, HEAD, OPTIONS — idempotent operations only |
| Unsafe methods | POST, PUT, DELETE — must reject in 0-RTT |
| Forward secrecy | 0-RTT data lacks forward secrecy until full handshake completes |

### Server Configuration

```nginx
# Nginx — enable TLS 1.3 with 0-RTT
server {
    listen 443 ssl http2;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_early_data on;  # Enable 0-RTT

    # Reject 0-RTT for state-changing requests
    # $ssl_early_data is "1" if request arrived in 0-RTT
    location /api/ {
        if ($ssl_early_data) {
            # Return 425 Too Early for non-idempotent requests
            set $early "early";
        }
        if ($request_method !~ ^(GET|HEAD|OPTIONS)$) {
            set $early "${early}-unsafe";
        }
        if ($early = "early-unsafe") {
            return 425;
        }
        proxy_pass http://backend;
        proxy_set_header Early-Data $ssl_early_data;
    }
}
```

```
# Caddy — TLS 1.3 is default; 0-RTT handled automatically
example.com {
    tls {
        protocols tls1.2 tls1.3
    }
    reverse_proxy localhost:8080
}
```

---

## Session Tickets and Resumption

Session tickets allow clients to resume TLS sessions without a full handshake. The server encrypts session state into a ticket sent to the client; the client presents it on reconnection.

```nginx
# Nginx — session ticket configuration
ssl_session_timeout 1d;          # Ticket lifetime (24 hours)
ssl_session_cache shared:SSL:50m; # 50MB shared cache (~200k sessions)
ssl_session_tickets on;

# Rotate ticket keys every 12 hours for forward secrecy
# Use a cron job or external key rotation mechanism
# Without rotation, compromised keys decrypt all past sessions
```

```go
// Go — TLS with session tickets enabled
tlsConfig := &tls.Config{
    MinVersion:             tls.VersionTLS12,
    MaxVersion:             tls.VersionTLS13,
    SessionTicketsDisabled: false, // Rotate keys regularly for forward secrecy
}
server := &http.Server{Addr: ":443", TLSConfig: tlsConfig}
server.ListenAndServeTLS("cert.pem", "key.pem")
```

---

## OCSP Stapling

Without OCSP stapling, the browser makes a separate HTTP request to the Certificate Authority to check if the certificate has been revoked (30-300ms). OCSP stapling lets the server fetch and cache the OCSP response, then include it ("staple") in the TLS handshake.

| Method | Latency Impact | Privacy | Reliability |
|--------|---------------|---------|-------------|
| CRL download | 100-500ms (full list) | CA sees IP | Fails if CA down |
| OCSP live check | 30-300ms per connection | CA sees every visit | Fails if CA down |
| OCSP stapling | 0ms (server provides) | CA never sees client | Server caches response |
| OCSP Must-Staple | 0ms + hard fail if missing | Best privacy | Breaks if server misconfigured |

```nginx
# Nginx — OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/ssl/certs/ca-chain.pem;  # Full CA chain
resolver 1.1.1.1 8.8.8.8 valid=300s;
resolver_timeout 5s;
```

```
# Caddy — OCSP stapling is automatic (zero configuration)
example.com {
    # Caddy fetches, caches, and staples OCSP automatically
    reverse_proxy localhost:8080
}
```

```bash
# Verify OCSP stapling is working
openssl s_client -connect example.com:443 -status 2>/dev/null | grep -A 3 "OCSP Response Status"
# OCSP Response Status: successful (0x0)
```

---

## Certificate Chain Optimization

Every intermediate certificate adds ~1KB to the TLS handshake. The handshake must fit in the TCP initial congestion window (typically 10 TCP segments = ~14KB). Oversized certificate chains cause an extra RTT.

| Chain Length | Size | Impact |
|-------------|------|--------|
| Leaf only (missing intermediates) | ~1KB | Broken — browser can't verify |
| Leaf + 1 intermediate | ~2-3KB | Optimal |
| Leaf + 2 intermediates | ~3-5KB | Acceptable |
| Leaf + 3+ intermediates | ~5-8KB | Adds RTT due to exceeding initial cwnd |
| Leaf + full chain + root | ~6-10KB | Root is unnecessary — browsers have it built in |

### Optimization Steps

```bash
# Check certificate chain
openssl s_client -connect example.com:443 -showcerts 2>/dev/null | \
  grep -E "s:|i:" | head -10

# Verify chain completeness and order
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt cert.pem

# Remove root CA from chain (browsers already have it)
# Keep only: leaf cert + necessary intermediates
cat leaf.pem intermediate.pem > fullchain.pem
# Do NOT include root CA
```

```nginx
# Nginx — optimized certificate chain
ssl_certificate /etc/ssl/certs/fullchain.pem;      # leaf + intermediates only
ssl_certificate_key /etc/ssl/private/server.key;
```

Use ECDSA certificates (P-256) instead of RSA. ECDSA certificates are 10x smaller and verify faster.

| Certificate Type | Key Size | Cert Size | Signature Speed |
|-----------------|----------|-----------|-----------------|
| RSA 2048 | 2048 bits | ~1.2KB | Baseline |
| RSA 4096 | 4096 bits | ~2.0KB | 4-8x slower than RSA 2048 |
| ECDSA P-256 | 256 bits | ~0.5KB | 2-4x faster than RSA 2048 |
| ECDSA P-384 | 384 bits | ~0.6KB | Slightly slower than P-256 |

---

## HSTS Preload for TLS Performance

HSTS prevents the initial HTTP-to-HTTPS redirect (1 RTT saved). HSTS preload embeds the HTTPS-only policy in the browser itself — no redirect even on first visit. Without HSTS, every first visit incurs an HTTP 301 redirect to HTTPS (1 extra RTT). With preload, the browser knows to use HTTPS before the first connection.

```nginx
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

---

## Cipher Suite Selection for Performance

Choose cipher suites that balance security and speed. AES-GCM with hardware acceleration (AES-NI) is the fastest on modern CPUs. ChaCha20-Poly1305 is faster on devices without AES hardware (older mobile).

```nginx
# Nginx — performance-optimized cipher configuration
ssl_protocols TLSv1.2 TLSv1.3;

# TLS 1.3 cipher suites (configured via OpenSSL, not nginx directive)
# Preferred order: AES-256-GCM > ChaCha20 > AES-128-GCM
ssl_conf_command Ciphersuites TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256;

# TLS 1.2 cipher suites
ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

ssl_prefer_server_ciphers on;  # Server chooses optimal cipher
ssl_ecdh_curve X25519:secp384r1:secp256r1;  # Fastest curves first
```

### Cipher Performance Comparison

| Cipher | Throughput (AES-NI) | Throughput (no AES-NI) | Security |
|--------|--------------------|-----------------------|----------|
| AES-128-GCM | ~5 GB/s | ~200 MB/s | Strong |
| AES-256-GCM | ~4 GB/s | ~150 MB/s | Strongest |
| ChaCha20-Poly1305 | ~2 GB/s | ~1.5 GB/s | Strong |

**Rule:** Prefer AES-GCM on servers (AES-NI available). Let clients without AES-NI negotiate ChaCha20 via cipher preference.

---

## Hardware Acceleration

```bash
# Check if CPU supports AES-NI
grep -m1 aes /proc/cpuinfo
# flags: ... aes ...

# OpenSSL speed test — compare with and without hardware
openssl speed -evp aes-256-gcm
openssl speed -evp chacha20-poly1305

# Typical results on modern Xeon:
# aes-256-gcm:   4,200 MB/s (AES-NI)
# chacha20:      1,800 MB/s (software)
```

```go
// Go — TLS config preferring hardware-accelerated ciphers
tlsConfig := &tls.Config{
    MinVersion: tls.VersionTLS12,
    CipherSuites: []uint16{
        tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
        tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
        tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
        tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
        tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
        tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
    },
    CurvePreferences: []tls.CurveID{
        tls.X25519,    // Fastest key exchange
        tls.CurveP256, // Widely supported
    },
}
```

---

## TLS False Start

TLS False Start allows the client to send application data before the handshake is fully confirmed, effectively saving 1 RTT on TLS 1.2 connections. Requires forward-secret cipher suites (ECDHE) and NPN/ALPN support. TLS 1.3 makes False Start unnecessary (1-RTT is already the default).

---

## Verification and Testing

```bash
# Full TLS performance audit
curl -w "dns: %{time_namelookup}\nconnect: %{time_connect}\ntls: %{time_appconnect}\nttfb: %{time_starttransfer}\ntotal: %{time_total}\n" -o /dev/null -s https://example.com

# Check TLS version and cipher
openssl s_client -connect example.com:443 2>/dev/null | grep -E "Protocol|Cipher"
# Protocol  : TLSv1.3
# Cipher    : TLS_AES_256_GCM_SHA384

# Test session resumption
openssl s_client -connect example.com:443 -sess_out /tmp/sess.pem < /dev/null 2>/dev/null
openssl s_client -connect example.com:443 -sess_in /tmp/sess.pem < /dev/null 2>/dev/null | grep "Reused"
# Reused, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384

# Qualys SSL Labs scan (grade A+)
# https://www.ssllabs.com/ssltest/analyze.html?d=example.com
```

---

## Best Practices

1. **Enable TLS 1.3 on all production servers.** TLS 1.3 saves 1 RTT per new connection (100-300ms on intercontinental links). Disable TLS 1.0 and 1.1 entirely.
2. **Enable OCSP stapling.** Eliminates 30-300ms OCSP lookup per connection. Verify with `openssl s_client -status`.
3. **Use ECDSA P-256 certificates.** ECDSA certs are 50-60% smaller than RSA and verify 2-4x faster. Most CAs issue ECDSA by default.
4. **Remove the root CA from certificate chains.** Browsers have root CAs built in. Including the root wastes 1KB per handshake and may exceed the initial congestion window.
5. **Enable session tickets with key rotation.** Session resumption avoids full handshake on reconnection. Rotate ticket keys every 12-24 hours for forward secrecy.
6. **Restrict 0-RTT to idempotent methods.** Return HTTP 425 Too Early for POST/PUT/DELETE in 0-RTT to prevent replay attacks.
7. **Prefer AES-GCM on AES-NI capable servers.** AES-GCM with hardware acceleration delivers 4-5 GB/s throughput. Fall back to ChaCha20 for mobile clients.
8. **Deploy HSTS with preload.** Eliminates the HTTP-to-HTTPS redirect (1 RTT) on every first visit. Submit to hstspreload.org.
9. **Use X25519 as the primary key exchange curve.** X25519 is faster than P-256 for key exchange and is the TLS 1.3 default.
10. **Run Qualys SSL Labs scan monthly.** Target A+ grade. Automate scanning in CI/CD to catch regressions.

---

## Anti-Patterns

1. **Keeping TLS 1.0/1.1 enabled.** These protocols have known vulnerabilities and add cipher negotiation complexity. All modern clients support TLS 1.2+.
2. **Using RSA 4096 certificates.** RSA 4096 certs are 2KB+ and 4-8x slower to verify than RSA 2048. Use ECDSA P-256 instead for both size and speed.
3. **Disabling session resumption.** Every connection performs a full handshake. On high-traffic sites, this wastes millions of CPU cycles and adds latency for every returning client.
4. **Not rotating session ticket keys.** Static ticket keys compromise forward secrecy. If a key is leaked, all sessions encrypted with that key can be decrypted retroactively.
5. **Allowing 0-RTT for all HTTP methods.** 0-RTT data is replayable. An attacker can replay a POST request (payment, transfer) captured from the network.
6. **Including unnecessary intermediate certificates.** Oversized certificate chains exceed the TCP initial congestion window, requiring an extra RTT to deliver the full handshake.
7. **Not enabling OCSP stapling.** Without stapling, every client independently queries the CA's OCSP responder — adding latency and creating a privacy leak (the CA sees every visitor).
8. **Using CBC-mode ciphers.** CBC ciphers are vulnerable to padding oracle attacks (POODLE, Lucky13) and significantly slower than GCM or ChaCha20.

---

## Enforcement Checklist

- [ ] TLS 1.3 is enabled; TLS 1.0 and 1.1 are disabled.
- [ ] TLS 1.2 fallback uses ECDHE-only cipher suites (no RSA key exchange).
- [ ] OCSP stapling is enabled and verified with `openssl s_client -status`.
- [ ] Certificate chain includes leaf + intermediates only (no root CA).
- [ ] ECDSA P-256 certificate is deployed (or RSA 2048 minimum).
- [ ] Session tickets are enabled with key rotation every 12-24 hours.
- [ ] 0-RTT is enabled for GET/HEAD only; POST/PUT/DELETE return 425.
- [ ] HSTS with preload is set; domain submitted to hstspreload.org.
- [ ] Cipher suites prioritize AES-256-GCM > ChaCha20 > AES-128-GCM.
- [ ] X25519 is the primary key exchange curve.
- [ ] Qualys SSL Labs returns A+ grade.
- [ ] `curl -w "%{time_appconnect}"` is tracked in CI/CD to catch regressions.
