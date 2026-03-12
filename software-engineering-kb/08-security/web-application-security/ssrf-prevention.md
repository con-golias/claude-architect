# SSRF Prevention Guide

## Table of Contents

1. [Overview](#overview)
2. [What Is SSRF](#what-is-ssrf)
3. [SSRF Classification](#ssrf-classification)
4. [Attack Targets](#attack-targets)
5. [Protocol Abuse](#protocol-abuse)
6. [Defense Layers](#defense-layers)
7. [Bypass Techniques Developers Must Know](#bypass-techniques-developers-must-know)
8. [Code Examples](#code-examples)
9. [Cloud-Specific Mitigations](#cloud-specific-mitigations)
10. [Best Practices](#best-practices)
11. [Anti-Patterns](#anti-patterns)
12. [Enforcement Checklist](#enforcement-checklist)

---

## Overview

Server-Side Request Forgery (SSRF) is one of the most dangerous vulnerability classes in modern
web applications. It allows an attacker to induce the server-side application to make HTTP
requests to an arbitrary domain, internal service, or cloud metadata endpoint of the attacker's
choosing. This guide provides comprehensive defense strategies, code examples, and an enforcement
checklist for preventing SSRF in production systems.

**CWE Reference:** CWE-918 -- Server-Side Request Forgery (SSRF)
**OWASP Top 10:** A10:2021 -- Server-Side Request Forgery

---

## What Is SSRF

SSRF occurs when an application fetches a remote resource based on user-supplied input without
properly validating the destination URL. The server itself becomes a proxy for the attacker,
enabling requests that bypass firewalls, VPN restrictions, and network ACLs.

### Why SSRF Is Critical

- The server typically has access to internal networks that external users cannot reach.
- Cloud environments expose metadata endpoints on link-local addresses (169.254.169.254).
- Internal services often lack authentication because they assume network-level trust.
- SSRF can be chained with other vulnerabilities to achieve Remote Code Execution (RCE).
- A single SSRF vulnerability can compromise an entire cloud account through credential theft.

### Common Vulnerable Patterns

- URL-based file imports (e.g., "Provide a URL to import your avatar").
- Webhook configurations where users specify callback URLs.
- PDF/HTML rendering engines that fetch remote resources.
- URL preview or link-unfurling features.
- Server-side API integrations where the endpoint is partially user-controlled.
- RSS/Atom feed fetchers.
- XML parsers with external entity resolution (XXE leading to SSRF).

---

## SSRF Classification

### Basic SSRF (Full Response)

The attacker can see the full HTTP response from the forged request. This is the most
straightforward variant and provides maximum information leakage.

**Example attack flow:**

1. Attacker submits `url=http://169.254.169.254/latest/meta-data/iam/security-credentials/`.
2. The server fetches the URL and returns the response body to the attacker.
3. The attacker receives AWS IAM temporary credentials.

### Blind SSRF

The attacker cannot see the response body but can infer information from:

- Response timing (how long the request takes).
- HTTP status codes (200 vs. 500 vs. timeout).
- Side effects (DNS lookups, out-of-band HTTP callbacks to attacker-controlled servers).

Blind SSRF is still dangerous because attackers can:

- Scan internal port ranges.
- Trigger actions on internal services (POST requests to admin endpoints).
- Exfiltrate data through DNS channels.

### Semi-Blind SSRF

The attacker receives partial response information such as:

- Response headers but not the body.
- Content-Length header revealing response size.
- Error messages that leak internal hostnames or IP addresses.
- Boolean signals (e.g., "URL is valid" vs. "URL is invalid").

---

## Attack Targets

### Cloud Metadata Endpoints

Cloud metadata services are the highest-value SSRF targets because they often expose
temporary credentials that grant full access to cloud resources.

#### AWS Instance Metadata Service (IMDS)

**IMDSv1 (vulnerable by default):**

```
http://169.254.169.254/latest/meta-data/
http://169.254.169.254/latest/meta-data/iam/security-credentials/
http://169.254.169.254/latest/meta-data/iam/security-credentials/<role-name>
http://169.254.169.254/latest/user-data
http://169.254.169.254/latest/dynamic/instance-identity/document
```

IMDSv1 uses a simple GET request with no authentication. Any process that can reach
169.254.169.254 can retrieve credentials.

**IMDSv2 (hardened):**

IMDSv2 requires a PUT request to obtain a session token, then uses that token in subsequent
GET requests. This mitigates basic SSRF because most SSRF vectors only allow GET requests
and cannot set custom headers.

```
PUT http://169.254.169.254/latest/api/token
X-aws-ec2-metadata-token-ttl-seconds: 21600

GET http://169.254.169.254/latest/meta-data/
X-aws-ec2-metadata-token: <token-from-PUT>
```

#### GCP Metadata Service

```
http://metadata.google.internal/computeMetadata/v1/
http://169.254.169.254/computeMetadata/v1/
```

GCP requires the `Metadata-Flavor: Google` header. Some SSRF vectors allow header injection,
so do not rely on this as the sole defense.

```
http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token
http://metadata.google.internal/computeMetadata/v1/project/project-id
```

#### Azure Instance Metadata Service (IMDS)

```
http://169.254.169.254/metadata/instance?api-version=2021-02-01
http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/
```

Azure requires the `Metadata: true` header.

### Internal Services

- `http://localhost:8080/admin` -- Admin panels on loopback.
- `http://internal-api.corp.local/` -- Internal microservices.
- `http://10.0.0.1:9200/` -- Elasticsearch on the internal network.
- `http://10.0.0.5:6379/` -- Redis (protocol smuggling via HTTP).
- `http://10.0.0.10:5432/` -- PostgreSQL.
- `http://consul.service.consul:8500/v1/kv/` -- Consul key-value store.
- `http://kubernetes.default.svc/` -- Kubernetes API server.

### Kubernetes-Specific Targets

- `https://kubernetes.default.svc/api/v1/secrets` -- Cluster secrets.
- `http://169.254.169.254/` -- Node metadata from within a pod.
- `https://kubernetes.default.svc/api/v1/namespaces/` -- Namespace enumeration.

---

## Protocol Abuse

### file:// Protocol

Allows reading local files from the server filesystem:

```
file:///etc/passwd
file:///etc/shadow
file:///proc/self/environ
file:///proc/self/cmdline
file:///home/app/.aws/credentials
file:///var/run/secrets/kubernetes.io/serviceaccount/token
```

### gopher:// Protocol

Gopher is extremely dangerous because it allows sending arbitrary bytes to any TCP port.
This enables protocol smuggling to:

- Send raw Redis commands: `gopher://127.0.0.1:6379/_SET%20pwned%20true`.
- Send raw SMTP messages.
- Interact with memcached, MySQL, and other plaintext protocols.

### dict:// Protocol

Used for dictionary service lookups but can be abused for port scanning and service
fingerprinting:

```
dict://internal-host:6379/INFO
dict://internal-host:11211/stats
```

### Other Abusable Protocols

- `ftp://` -- File retrieval from internal FTP servers.
- `ldap://` and `ldaps://` -- LDAP injection through SSRF.
- `tftp://` -- TFTP file retrieval.
- `jar://` -- Java archive protocol (Java-specific SSRF).

---

## Defense Layers

### Layer 1: URL Validation and Parsing

Parse and validate every user-supplied URL before making any request.

**Validation steps:**

1. Parse the URL using a strict, standards-compliant URL parser.
2. Extract the scheme, host, port, and path components.
3. Validate the scheme against an allowlist (typically only `http` and `https`).
4. Resolve the hostname to an IP address.
5. Validate the resolved IP address against a denylist of internal ranges.
6. Make the request using the resolved IP address (not the hostname) to prevent DNS rebinding.

**Critical rule:** Always resolve the hostname BEFORE making the request and validate the
resolved IP. Never validate the hostname string alone.

### Layer 2: Allowlisting Outbound Hosts

Maintain an explicit allowlist of domains and IP addresses the application is permitted
to contact. This is the strongest defense but requires maintenance.

```
ALLOWED_HOSTS = [
    "api.github.com",
    "api.stripe.com",
    "hooks.slack.com",
    "s3.amazonaws.com",
]
```

Prefer allowlisting over denylisting. An allowlist blocks all unknown destinations by
default, while a denylist must anticipate every possible bypass.

### Layer 3: Blocking Internal IP Ranges

Block all private and reserved IP address ranges:

| Range              | Description                    |
|--------------------|--------------------------------|
| `10.0.0.0/8`      | Private network (Class A)      |
| `172.16.0.0/12`   | Private network (Class B)      |
| `192.168.0.0/16`  | Private network (Class C)      |
| `127.0.0.0/8`     | Loopback                       |
| `169.254.0.0/16`  | Link-local (metadata endpoint) |
| `0.0.0.0/8`       | Current network                |
| `100.64.0.0/10`   | Shared address space (CGNAT)   |
| `192.0.0.0/24`    | IETF protocol assignments      |
| `198.18.0.0/15`   | Benchmarking                   |
| `224.0.0.0/4`     | Multicast                      |
| `240.0.0.0/4`     | Reserved for future use        |
| `::1/128`         | IPv6 loopback                  |
| `fc00::/7`        | IPv6 unique local              |
| `fe80::/10`       | IPv6 link-local                |
| `::ffff:0:0/96`   | IPv4-mapped IPv6 addresses     |

### Layer 4: DNS Rebinding Prevention

DNS rebinding attacks work by having a malicious DNS server return a public IP for the
first resolution (passing validation) and a private IP for the second resolution (when the
actual request is made).

**Mitigation: Resolve-then-connect pattern:**

1. Resolve the hostname to an IP address.
2. Validate the IP address against the denylist.
3. Make the HTTP request directly to the validated IP address.
4. Set the Host header to the original hostname.

This eliminates the window between validation and connection where DNS rebinding occurs.

### Layer 5: Disabling Unnecessary URL Schemes

Restrict URL schemes to only those required:

```
ALLOWED_SCHEMES = ["http", "https"]
```

Block all of: `file://`, `gopher://`, `dict://`, `ftp://`, `ldap://`, `jar://`, `tftp://`.

### Layer 6: IMDSv2 Enforcement

On AWS, enforce IMDSv2 to mitigate SSRF targeting the metadata service:

```bash
aws ec2 modify-instance-metadata-options \
    --instance-id i-1234567890abcdef0 \
    --http-tokens required \
    --http-endpoint enabled \
    --http-put-response-hop-limit 1
```

Setting `--http-put-response-hop-limit 1` prevents containers from accessing the host
metadata service through SSRF.

### Layer 7: Network Segmentation

- Place application servers in subnets that cannot reach sensitive internal services.
- Use security groups and NACLs to restrict outbound traffic.
- Deploy a forward proxy for all outbound HTTP requests.
- Block outbound traffic to 169.254.169.254 at the network level from application subnets.
- Use Kubernetes NetworkPolicy to restrict pod egress.

### Layer 8: WAF Rules

Configure WAF rules to detect and block SSRF payloads:

- Block requests containing `169.254.169.254` in any parameter.
- Block requests containing `metadata.google.internal`.
- Block requests containing `localhost`, `127.0.0.1`, `0.0.0.0`.
- Block requests containing `file://`, `gopher://`, `dict://`.
- Use managed rule sets (AWS WAF SSRF rules, Cloudflare OWASP rules).

---

## Bypass Techniques Developers Must Know

Understanding bypass techniques is essential for building robust defenses. If your validation
can be bypassed by any of these techniques, it is insufficient.

### URL Encoding

Attackers encode characters to bypass string-matching filters:

```
http://169.254.169.254/  (original)
http://169.254.169.%32%35%34/  (partial encoding)
http://%31%36%39%2e%32%35%34%2e%31%36%39%2e%32%35%34/  (full encoding)
http://169.254.169.254%00@evil.com/  (null byte injection)
```

**Defense:** Always decode the URL fully before validation. Use a proper URL parser, not
string matching.

### Alternative IP Address Formats

The same IP address can be represented in multiple formats:

```
127.0.0.1       (standard dotted decimal)
2130706433      (decimal integer: 127*16777216 + 0*65536 + 0*256 + 1)
0x7f000001      (hexadecimal)
0177.0.0.1      (octal)
0x7f.0.0.1      (mixed hex and decimal)
127.0.1         (three-part: 127.0.0.1)
127.1           (two-part: 127.0.0.1)

169.254.169.254     (standard)
0xa9fea9fe          (hex)
2852039166          (decimal)
0251.0376.0251.0376 (octal)
0xa9.0xfe.0xa9.0xfe (hex octets)
```

**Defense:** Resolve the hostname to a canonical IP address and validate the resolved address.
Never validate the string representation alone.

### DNS Rebinding

1. Attacker registers `evil.com` with a DNS server they control.
2. First DNS query returns `1.2.3.4` (a public IP, passes validation).
3. The application validates the IP and proceeds.
4. Before the HTTP request, the attacker's DNS server returns `169.254.169.254`.
5. The HTTP client resolves `evil.com` again and connects to the metadata endpoint.

**Defense:** Use the resolve-then-connect pattern. Pin the resolved IP and connect directly
to it.

### Redirect-Based Bypasses

An attacker hosts a URL that returns a redirect to an internal address:

```
https://evil.com/redirect -> HTTP 302 -> http://169.254.169.254/latest/meta-data/
```

The application validates `evil.com` (a public domain) but follows the redirect to the
internal metadata endpoint.

**Defense:** Either disable redirect following entirely, or re-validate the destination of
every redirect against the same rules.

### IPv6 Mapping

IPv6 can represent IPv4 addresses in ways that bypass validation:

```
::1                         (IPv6 loopback, equivalent to 127.0.0.1)
::ffff:127.0.0.1            (IPv4-mapped IPv6)
::ffff:7f00:0001            (IPv4-mapped IPv6 in hex)
0:0:0:0:0:ffff:169.254.169.254  (full IPv4-mapped notation)
[::]                        (IPv6 unspecified, binds to 0.0.0.0)
```

**Defense:** Normalize all addresses to a canonical form and check both IPv4 and IPv6
reserved ranges.

### URL Parser Confusion

Different URL parsers interpret the same URL differently:

```
http://evil.com@169.254.169.254/   (userinfo confusion)
http://169.254.169.254#@evil.com/  (fragment confusion)
http://169.254.169.254\@evil.com/  (backslash confusion)
http://evil.com:80@169.254.169.254/ (port in userinfo)
```

**Defense:** Use a single, well-tested URL parser. Reject URLs with userinfo components
(anything before `@` in the authority).

### Domain Fronting and CNAME Tricks

An attacker registers a public domain with a CNAME record pointing to an internal hostname:

```
ssrf.evil.com CNAME internal-service.corp.local
```

**Defense:** Resolve the domain to an IP address and validate the IP, not the domain name.

---

## Code Examples

### TypeScript -- SSRF-Safe URL Fetcher

```typescript
import { URL } from "url";
import * as dns from "dns/promises";
import * as net from "net";
import * as https from "https";
import * as http from "http";

// Define blocked IP ranges using CIDR notation
const BLOCKED_RANGES = [
  { network: "10.0.0.0", prefix: 8 },
  { network: "172.16.0.0", prefix: 12 },
  { network: "192.168.0.0", prefix: 16 },
  { network: "127.0.0.0", prefix: 8 },
  { network: "169.254.0.0", prefix: 16 },
  { network: "0.0.0.0", prefix: 8 },
  { network: "100.64.0.0", prefix: 10 },
  { network: "224.0.0.0", prefix: 4 },
];

const ALLOWED_SCHEMES = new Set(["http:", "https:"]);

const ALLOWED_HOSTS: Set<string> | null = null; // Set to a Set<string> to enable allowlisting

function ipToLong(ip: string): number {
  const parts = ip.split(".").map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isIpInCidr(ip: string, network: string, prefix: number): boolean {
  const ipLong = ipToLong(ip);
  const networkLong = ipToLong(network);
  const mask = (~0 << (32 - prefix)) >>> 0;
  return (ipLong & mask) === (networkLong & mask);
}

function isBlockedIp(ip: string): boolean {
  // Handle IPv6 loopback
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // Handle IPv4-mapped IPv6
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  if (!net.isIPv4(ip)) {
    // Block all IPv6 addresses by default (conservative approach)
    return true;
  }

  for (const range of BLOCKED_RANGES) {
    if (isIpInCidr(ip, range.network, range.prefix)) {
      return true;
    }
  }

  return false;
}

export async function safeFetch(
  userUrl: string,
  options: { timeout?: number; maxRedirects?: number } = {}
): Promise<Response> {
  const { timeout = 10000, maxRedirects = 0 } = options;

  // Step 1: Parse the URL strictly
  let parsed: URL;
  try {
    parsed = new URL(userUrl);
  } catch {
    throw new Error("Invalid URL format");
  }

  // Step 2: Validate the scheme
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new Error(`Blocked URL scheme: ${parsed.protocol}`);
  }

  // Step 3: Reject URLs with userinfo (user:pass@host)
  if (parsed.username || parsed.password) {
    throw new Error("URLs with userinfo are not allowed");
  }

  // Step 4: Check allowlist if configured
  if (ALLOWED_HOSTS !== null && !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Host not in allowlist: ${parsed.hostname}`);
  }

  // Step 5: Resolve DNS and validate IP
  const hostname = parsed.hostname;
  let addresses: string[];

  try {
    // Check if hostname is already an IP address
    if (net.isIP(hostname)) {
      addresses = [hostname];
    } else {
      const result = await dns.resolve4(hostname);
      addresses = result;
    }
  } catch {
    throw new Error(`DNS resolution failed for: ${hostname}`);
  }

  if (addresses.length === 0) {
    throw new Error(`No addresses found for: ${hostname}`);
  }

  // Step 6: Validate ALL resolved IPs
  for (const addr of addresses) {
    if (isBlockedIp(addr)) {
      throw new Error(`Blocked internal IP address: ${addr}`);
    }
  }

  // Step 7: Make request using resolved IP (prevent DNS rebinding)
  const resolvedIp = addresses[0];
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  const resolvedUrl = new URL(parsed.toString());

  // Use the fetch API with the resolved IP, setting the Host header manually
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resolvedUrl.toString(), {
      signal: controller.signal,
      redirect: maxRedirects > 0 ? "follow" : "error",
      headers: {
        Host: hostname,
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Go -- SSRF-Safe HTTP Client

```go
package ssrf

import (
    "context"
    "errors"
    "fmt"
    "net"
    "net/http"
    "net/url"
    "strings"
    "time"
)

var (
    ErrBlockedIP      = errors.New("ssrf: blocked internal IP address")
    ErrBlockedScheme  = errors.New("ssrf: blocked URL scheme")
    ErrBlockedHost    = errors.New("ssrf: host not in allowlist")
    ErrInvalidURL     = errors.New("ssrf: invalid URL")
    ErrDNSFailed      = errors.New("ssrf: DNS resolution failed")
    ErrUserInfo       = errors.New("ssrf: URLs with userinfo are not allowed")
)

// blockedNetworks contains all private and reserved IP ranges.
var blockedNetworks []*net.IPNet

func init() {
    cidrs := []string{
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "0.0.0.0/8",
        "100.64.0.0/10",
        "198.18.0.0/15",
        "224.0.0.0/4",
        "240.0.0.0/4",
        "::1/128",
        "fc00::/7",
        "fe80::/10",
        "::ffff:0:0/96",
    }
    for _, cidr := range cidrs {
        _, network, err := net.ParseCIDR(cidr)
        if err != nil {
            panic(fmt.Sprintf("invalid CIDR: %s", cidr))
        }
        blockedNetworks = append(blockedNetworks, network)
    }
}

func isBlockedIP(ip net.IP) bool {
    for _, network := range blockedNetworks {
        if network.Contains(ip) {
            return true
        }
    }
    return false
}

// SafeClient returns an http.Client configured to prevent SSRF.
func SafeClient(timeout time.Duration, allowedHosts []string) *http.Client {
    allowedSet := make(map[string]bool, len(allowedHosts))
    for _, h := range allowedHosts {
        allowedSet[strings.ToLower(h)] = true
    }

    transport := &http.Transport{
        DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
            host, port, err := net.SplitHostPort(addr)
            if err != nil {
                return nil, ErrInvalidURL
            }

            // Resolve DNS
            ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
            if err != nil {
                return nil, fmt.Errorf("%w: %v", ErrDNSFailed, err)
            }

            // Validate all resolved IPs
            for _, ipAddr := range ips {
                if isBlockedIP(ipAddr.IP) {
                    return nil, fmt.Errorf("%w: %s resolved to %s", ErrBlockedIP, host, ipAddr.IP)
                }
            }

            // Connect directly to the validated IP
            if len(ips) == 0 {
                return nil, ErrDNSFailed
            }
            resolvedAddr := net.JoinHostPort(ips[0].IP.String(), port)
            dialer := &net.Dialer{Timeout: timeout}
            return dialer.DialContext(ctx, network, resolvedAddr)
        },
    }

    return &http.Client{
        Transport: transport,
        Timeout:   timeout,
        CheckRedirect: func(req *http.Request, via []*http.Request) error {
            // Block all redirects to prevent redirect-based SSRF bypass
            return http.ErrUseLastResponse
        },
    }
}

// SafeFetch validates and fetches a user-supplied URL.
func SafeFetch(ctx context.Context, rawURL string, allowedHosts []string) (*http.Response, error) {
    // Parse URL
    parsed, err := url.Parse(rawURL)
    if err != nil {
        return nil, ErrInvalidURL
    }

    // Validate scheme
    if parsed.Scheme != "http" && parsed.Scheme != "https" {
        return nil, fmt.Errorf("%w: %s", ErrBlockedScheme, parsed.Scheme)
    }

    // Reject userinfo
    if parsed.User != nil {
        return nil, ErrUserInfo
    }

    // Check host allowlist
    if len(allowedHosts) > 0 {
        hostname := strings.ToLower(parsed.Hostname())
        allowed := false
        for _, h := range allowedHosts {
            if hostname == strings.ToLower(h) {
                allowed = true
                break
            }
        }
        if !allowed {
            return nil, fmt.Errorf("%w: %s", ErrBlockedHost, parsed.Hostname())
        }
    }

    client := SafeClient(10*time.Second, allowedHosts)
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
    if err != nil {
        return nil, err
    }

    return client.Do(req)
}
```

### Python -- SSRF-Safe URL Fetcher

```python
import ipaddress
import socket
from urllib.parse import urlparse
from typing import Optional
import requests

BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),
    ipaddress.ip_network("198.18.0.0/15"),
    ipaddress.ip_network("224.0.0.0/4"),
    ipaddress.ip_network("240.0.0.0/4"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

ALLOWED_SCHEMES = {"http", "https"}


def is_blocked_ip(ip_str: str) -> bool:
    """Check if an IP address falls within any blocked range."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True  # If we cannot parse it, block it

    for network in BLOCKED_NETWORKS:
        if ip in network:
            return True
    return False


def safe_fetch(
    user_url: str,
    allowed_hosts: Optional[set[str]] = None,
    timeout: int = 10,
    allow_redirects: bool = False,
) -> requests.Response:
    """
    Fetch a user-supplied URL with SSRF protections.

    Args:
        user_url: The URL to fetch.
        allowed_hosts: Optional set of allowed hostnames. If provided,
                       only these hosts are permitted.
        timeout: Request timeout in seconds.
        allow_redirects: Whether to follow redirects (disabled by default).

    Returns:
        requests.Response object.

    Raises:
        ValueError: If the URL is invalid or blocked.
    """
    # Step 1: Parse URL
    parsed = urlparse(user_url)

    # Step 2: Validate scheme
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError(f"Blocked URL scheme: {parsed.scheme}")

    # Step 3: Reject userinfo
    if parsed.username or parsed.password:
        raise ValueError("URLs with userinfo are not allowed")

    # Step 4: Extract and validate hostname
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("No hostname in URL")

    # Step 5: Check host allowlist
    if allowed_hosts is not None and hostname.lower() not in allowed_hosts:
        raise ValueError(f"Host not in allowlist: {hostname}")

    # Step 6: Resolve DNS
    try:
        addr_infos = socket.getaddrinfo(hostname, parsed.port or 443)
    except socket.gaierror as e:
        raise ValueError(f"DNS resolution failed for {hostname}: {e}")

    if not addr_infos:
        raise ValueError(f"No addresses found for {hostname}")

    # Step 7: Validate ALL resolved IPs
    for addr_info in addr_infos:
        ip = addr_info[4][0]
        if is_blocked_ip(ip):
            raise ValueError(f"Blocked internal IP: {ip} (resolved from {hostname})")

    # Step 8: Make request
    session = requests.Session()
    session.max_redirects = 0 if not allow_redirects else 5

    response = session.get(
        user_url,
        timeout=timeout,
        allow_redirects=allow_redirects,
        headers={"User-Agent": "SafeFetcher/1.0"},
    )

    return response
```

### Java -- SSRF-Safe URL Validator

```java
package com.example.security;

import java.net.InetAddress;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Set;

public class SsrfSafeFetcher {

    private static final Set<String> ALLOWED_SCHEMES = Set.of("http", "https");

    // Private and reserved IPv4 ranges (network address, prefix length)
    private static final List<CidrRange> BLOCKED_RANGES = List.of(
        new CidrRange("10.0.0.0", 8),
        new CidrRange("172.16.0.0", 12),
        new CidrRange("192.168.0.0", 16),
        new CidrRange("127.0.0.0", 8),
        new CidrRange("169.254.0.0", 16),
        new CidrRange("0.0.0.0", 8),
        new CidrRange("100.64.0.0", 10)
    );

    public static HttpResponse<String> safeFetch(String userUrl) throws Exception {
        return safeFetch(userUrl, null);
    }

    public static HttpResponse<String> safeFetch(String userUrl, Set<String> allowedHosts)
            throws Exception {
        // Step 1: Parse URL
        URI uri;
        try {
            uri = new URI(userUrl);
        } catch (URISyntaxException e) {
            throw new SecurityException("Invalid URL format: " + e.getMessage());
        }

        // Step 2: Validate scheme
        String scheme = uri.getScheme();
        if (scheme == null || !ALLOWED_SCHEMES.contains(scheme.toLowerCase())) {
            throw new SecurityException("Blocked URL scheme: " + scheme);
        }

        // Step 3: Reject userinfo
        if (uri.getUserInfo() != null) {
            throw new SecurityException("URLs with userinfo are not allowed");
        }

        // Step 4: Extract hostname
        String hostname = uri.getHost();
        if (hostname == null || hostname.isBlank()) {
            throw new SecurityException("No hostname in URL");
        }

        // Step 5: Check allowlist
        if (allowedHosts != null && !allowedHosts.contains(hostname.toLowerCase())) {
            throw new SecurityException("Host not in allowlist: " + hostname);
        }

        // Step 6: Resolve DNS and validate IPs
        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(hostname);
        } catch (UnknownHostException e) {
            throw new SecurityException("DNS resolution failed for: " + hostname);
        }

        for (InetAddress addr : addresses) {
            if (addr.isLoopbackAddress()
                || addr.isSiteLocalAddress()
                || addr.isLinkLocalAddress()
                || addr.isAnyLocalAddress()
                || addr.isMulticastAddress()) {
                throw new SecurityException(
                    "Blocked internal IP: " + addr.getHostAddress()
                    + " (resolved from " + hostname + ")"
                );
            }
            // Check additional ranges
            if (isBlockedIp(addr)) {
                throw new SecurityException(
                    "Blocked IP range: " + addr.getHostAddress()
                );
            }
        }

        // Step 7: Make request with no redirect following
        HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

        HttpRequest request = HttpRequest.newBuilder()
            .uri(uri)
            .timeout(Duration.ofSeconds(10))
            .GET()
            .build();

        return client.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private static boolean isBlockedIp(InetAddress addr) {
        byte[] addrBytes = addr.getAddress();
        if (addrBytes.length != 4) {
            // Block all IPv6 by default (conservative)
            return true;
        }
        long ipLong = ((long)(addrBytes[0] & 0xFF) << 24)
                    | ((long)(addrBytes[1] & 0xFF) << 16)
                    | ((long)(addrBytes[2] & 0xFF) << 8)
                    | ((long)(addrBytes[3] & 0xFF));

        for (CidrRange range : BLOCKED_RANGES) {
            if (range.contains(ipLong)) {
                return true;
            }
        }
        return false;
    }

    private record CidrRange(String network, int prefix) {
        boolean contains(long ip) {
            String[] parts = network.split("\\.");
            long networkLong = ((long)(Integer.parseInt(parts[0])) << 24)
                             | ((long)(Integer.parseInt(parts[1])) << 16)
                             | ((long)(Integer.parseInt(parts[2])) << 8)
                             | ((long)(Integer.parseInt(parts[3])));
            long mask = (~0L << (32 - prefix)) & 0xFFFFFFFFL;
            return (ip & mask) == (networkLong & mask);
        }
    }
}
```

---

## Cloud-Specific Mitigations

### AWS

1. **Enforce IMDSv2** on all EC2 instances. Set `http-tokens` to `required`.
2. **Set hop limit to 1** (`--http-put-response-hop-limit 1`) to prevent container breakout.
3. **Use VPC endpoints** for AWS services to avoid routing through the public internet.
4. **Block 169.254.169.254** in security group outbound rules for application subnets.
5. **Use IAM roles with minimal permissions** to limit blast radius.
6. **Enable GuardDuty** to detect anomalous metadata access patterns.

### GCP

1. **Use Workload Identity** instead of node-level service accounts.
2. **Block metadata.google.internal** at the network level.
3. **Use VPC Service Controls** to create security perimeters.
4. **Restrict service account scopes** to minimum required permissions.

### Azure

1. **Use Managed Identity** with minimal role assignments.
2. **Block 169.254.169.254** in Network Security Groups.
3. **Use Private Endpoints** for Azure services.
4. **Enable Azure Defender** for anomaly detection.

### Kubernetes

1. **Block metadata endpoints** using NetworkPolicy:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-metadata
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 169.254.169.254/32
```

2. **Use Workload Identity** (GKE) or **IRSA** (EKS) instead of node-level credentials.
3. **Restrict Kubernetes API access** from application pods.

---

## Best Practices

### BP-1: Use an Allowlist for Outbound Destinations

Maintain a strict allowlist of domains and IP addresses the application is permitted to contact.
Deny all destinations not on the list. This is the single most effective SSRF defense.

### BP-2: Resolve DNS Before Connecting

Always resolve the hostname to an IP address, validate the IP, and then connect directly to
the validated IP. Set the Host header to the original hostname. This defeats DNS rebinding
attacks.

### BP-3: Block All Internal and Reserved IP Ranges

Maintain a comprehensive denylist of private, loopback, link-local, multicast, and reserved
IP ranges. Include both IPv4 and IPv6 ranges. Update the list when new reserved ranges are
assigned.

### BP-4: Restrict URL Schemes to http and https

Block all non-HTTP schemes including `file://`, `gopher://`, `dict://`, `ftp://`, `ldap://`,
and `jar://`. These protocols enable reading local files, protocol smuggling, and other attacks.

### BP-5: Disable or Validate Redirect Following

Either disable HTTP redirect following entirely or re-validate the redirect destination
against the same SSRF rules. Redirect-based bypasses are among the most common SSRF attack
techniques.

### BP-6: Enforce IMDSv2 on All Cloud Instances

Configure all EC2 instances to require IMDSv2 with a hop limit of 1. Apply equivalent
hardening on GCP and Azure. Use organization-level policies (AWS SCP, GCP Organization
Policies) to enforce this across all accounts.

### BP-7: Implement Network-Level Segmentation

Do not rely solely on application-level defenses. Block outbound access to internal networks
and cloud metadata endpoints at the security group, NACL, and firewall level.

### BP-8: Use a Dedicated Egress Proxy

Route all outbound HTTP requests through a forward proxy that enforces URL allowlisting and
IP blocking. This centralizes SSRF defense and provides a single enforcement point.

### BP-9: Log and Monitor All Outbound Requests

Log every outbound HTTP request including the destination URL, resolved IP, and response
status. Alert on requests to internal IP ranges or known metadata endpoints. Feed logs into
SIEM for anomaly detection.

### BP-10: Apply Defense in Depth

Never rely on a single SSRF mitigation. Combine URL validation, IP blocking, network
segmentation, WAF rules, and IMDSv2 enforcement. Each layer catches bypasses that other
layers miss.

---

## Anti-Patterns

### AP-1: Validating the Hostname String Instead of the Resolved IP

**Wrong:** Check if the hostname string contains "localhost" or "169.254".
**Problem:** Bypassed by decimal IP (2130706433), hex IP (0x7f000001), DNS rebinding,
and CNAME tricks.

### AP-2: Using a Denylist of Hostnames Instead of IP Ranges

**Wrong:** Block "localhost", "metadata.google.internal", and a few known hostnames.
**Problem:** Cannot anticipate all internal hostnames. Attackers use IP addresses directly.

### AP-3: Validating Before DNS Resolution and Connecting After

**Wrong:** Validate the hostname, then pass the original URL to an HTTP client that resolves
DNS again.
**Problem:** Vulnerable to DNS rebinding -- the second resolution may return a different
(internal) IP.

### AP-4: Following Redirects Without Re-Validation

**Wrong:** Validate the initial URL but follow redirects without checking the redirect target.
**Problem:** Attacker redirects from a valid external URL to `http://169.254.169.254/`.

### AP-5: Relying on WAF Rules as the Only Defense

**Wrong:** Deploy a WAF rule to block requests containing "169.254.169.254" and consider
SSRF solved.
**Problem:** WAF rules are bypassed by encoding, IP format tricks, and redirect chains.
WAF is a supplementary defense, not a primary one.

### AP-6: Allowing file:// and gopher:// Schemes

**Wrong:** Allow any URL scheme because "the user might need to reference a local file."
**Problem:** `file://` reads local files including credentials. `gopher://` enables arbitrary
TCP protocol smuggling.

### AP-7: Using IMDSv1 in Cloud Environments

**Wrong:** Leave IMDSv1 enabled because "it's simpler" or "legacy code depends on it."
**Problem:** IMDSv1 requires only a GET request with no authentication, making it trivially
exploitable via SSRF.

### AP-8: Trusting Network-Level Controls Alone

**Wrong:** Assume SSRF is mitigated because "the application is in a restricted subnet."
**Problem:** Subnet restrictions may not block all internal targets. Misconfigurations
happen. Defense in depth requires application-level validation.

---

## Enforcement Checklist

Use this checklist to verify SSRF defenses are properly implemented.

### URL Validation

- [ ] All user-supplied URLs are parsed with a strict, standards-compliant URL parser.
- [ ] Only `http` and `https` schemes are allowed.
- [ ] URLs with userinfo components (user:pass@host) are rejected.
- [ ] The hostname is extracted and resolved to IP addresses before any request is made.
- [ ] All resolved IP addresses are validated against the blocked ranges list.
- [ ] The blocked ranges list includes: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
      127.0.0.0/8, 169.254.0.0/16, 0.0.0.0/8, 100.64.0.0/10, ::1/128, fc00::/7, fe80::/10.
- [ ] IPv4-mapped IPv6 addresses (::ffff:x.x.x.x) are normalized and checked.
- [ ] Connections are made to the resolved IP, not the original hostname (resolve-then-connect).

### Redirect Handling

- [ ] HTTP redirect following is disabled, OR redirect destinations are re-validated.
- [ ] The maximum redirect count is limited (no more than 3).

### Host Allowlisting

- [ ] An allowlist of permitted outbound hosts exists for features that fetch user-supplied URLs.
- [ ] The allowlist is enforced in code, not just documentation.
- [ ] The allowlist is reviewed periodically and kept minimal.

### Cloud Metadata Protection

- [ ] IMDSv2 is enforced on all AWS EC2 instances (`http-tokens: required`).
- [ ] IMDSv2 hop limit is set to 1 on instances running containers.
- [ ] GCP and Azure metadata endpoints are blocked at the network level.
- [ ] Kubernetes pods use Workload Identity / IRSA instead of node-level credentials.
- [ ] NetworkPolicy blocks egress to 169.254.169.254/32 from application pods.

### Network Segmentation

- [ ] Security groups / NACLs restrict outbound access from application subnets.
- [ ] Outbound traffic to 169.254.169.254 is blocked at the network level.
- [ ] A forward proxy is deployed for all outbound HTTP requests (where feasible).
- [ ] Internal services require authentication (do not rely on network trust alone).

### WAF and Monitoring

- [ ] WAF rules detect SSRF payloads in request parameters.
- [ ] All outbound HTTP requests are logged with destination URL and resolved IP.
- [ ] Alerts fire on outbound requests to internal IP ranges or metadata endpoints.
- [ ] SSRF attempts are correlated with user accounts for investigation.

### Testing

- [ ] Automated SSRF tests cover: basic SSRF, blind SSRF, redirect bypass, DNS rebinding,
      IP format bypass, protocol abuse, and IPv6 mapping.
- [ ] Penetration tests include SSRF testing with bypass techniques.
- [ ] SAST rules detect URL fetching without SSRF validation.
- [ ] DAST scanners test for SSRF in all URL-accepting endpoints.

### Dependency and Framework

- [ ] HTTP client libraries are configured to not follow redirects by default.
- [ ] XML parsers have external entity resolution disabled (XXE leading to SSRF).
- [ ] PDF/HTML rendering engines have network access restricted or sandboxed.
- [ ] Image processing libraries do not fetch remote URLs without validation.

---

## References

- CWE-918: Server-Side Request Forgery (SSRF)
  https://cwe.mitre.org/data/definitions/918.html
- OWASP SSRF Prevention Cheat Sheet
  https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- OWASP Top 10 A10:2021 -- Server-Side Request Forgery
  https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/
- AWS IMDSv2 Documentation
  https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html
- PortSwigger SSRF Research
  https://portswigger.net/web-security/ssrf
