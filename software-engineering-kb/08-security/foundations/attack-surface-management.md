# Attack Surface Management

> **Domain:** Security > Foundations > Attack Surface Management
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** ---

## Why It Matters

The attack surface is the total sum of all points where an attacker can attempt to enter, extract data from, or cause harm to a system. Every exposed endpoint, open port, third-party dependency, cloud resource, and human with access credentials is a potential entry point. The larger the attack surface, the higher the probability of a successful breach. Attack surface management (ASM) is the continuous process of discovering, cataloging, classifying, and reducing these entry points. Organizations that do not actively manage their attack surface accumulate technical debt in the form of forgotten endpoints, unpatched dependencies, misconfigured cloud resources, and orphaned credentials -- each one a ticking liability.

---

## Core Concepts

### What Is an Attack Surface

The attack surface consists of all reachable and exploitable entry points across an entire technology stack. It spans four primary dimensions:

```
Attack Surface Dimensions:
+---------------------------------------------------------------+
|                                                                 |
|  1. Network Attack Surface                                     |
|  +----------------------------------------------------------+ |
|  | Open ports, exposed services, DNS records, load balancers | |
|  | VPN endpoints, Wi-Fi access points, firewall rules        | |
|  +----------------------------------------------------------+ |
|                                                                 |
|  2. Software Attack Surface                                    |
|  +----------------------------------------------------------+ |
|  | HTTP endpoints, WebSocket handlers, API routes            | |
|  | File upload handlers, CLI commands, admin panels          | |
|  | Debug endpoints, GraphQL schemas, message queue consumers | |
|  | Third-party libraries, runtime environments               | |
|  +----------------------------------------------------------+ |
|                                                                 |
|  3. Physical Attack Surface                                    |
|  +----------------------------------------------------------+ |
|  | Server rooms, USB ports, unattended workstations          | |
|  | Hardware tokens, printed documents, dumpster diving       | |
|  +----------------------------------------------------------+ |
|                                                                 |
|  4. Human / Social Engineering Attack Surface                  |
|  +----------------------------------------------------------+ |
|  | Phishing targets, privilege escalation via social means   | |
|  | Insider threats, credential reuse, shared accounts        | |
|  | Support desks, password reset flows, onboarding gaps      | |
|  +----------------------------------------------------------+ |
|                                                                 |
+---------------------------------------------------------------+
```

Minimizing each dimension directly reduces the probability of breach. Every removed endpoint, closed port, eliminated dependency, and revoked credential is one fewer opportunity for an attacker.

---

### Attack Surface Analysis

Attack surface analysis identifies and catalogs every entry point in an application. The following categories must be enumerated:

| Entry Point Category | Examples | Risk Level |
|---------------------|----------|------------|
| HTTP/REST endpoints | `/api/v1/users`, `/admin/config` | High |
| WebSocket connections | Real-time chat, notifications | High |
| Message queue consumers | RabbitMQ, Kafka, SQS handlers | Medium |
| File upload handlers | Image upload, CSV import, document processing | Critical |
| CLI interfaces | Admin scripts, cron jobs, management commands | Medium |
| Admin panels | `/admin`, `/dashboard`, internal tools | Critical |
| Debug/diagnostic endpoints | `/debug/pprof`, `/health/detailed`, `/__inspect` | Critical |
| Third-party integrations | OAuth callbacks, webhooks, payment processors | High |
| API keys and tokens | Service accounts, JWT secrets, API keys | Critical |
| Database connections | Direct DB access, connection strings | Critical |
| DNS records | Subdomains, CNAME records, MX records | Medium |

```typescript
// TypeScript -- Automated endpoint inventory for Express applications
import express, { Express, Router } from 'express';

interface RouteEntry {
  method: string;
  path: string;
  middleware: string[];
  hasAuth: boolean;
  hasRateLimit: boolean;
}

function inventoryRoutes(app: Express): RouteEntry[] {
  const routes: RouteEntry[] = [];

  function extractRoutes(stack: any[], basePath: string = ''): void {
    for (const layer of stack) {
      if (layer.route) {
        // Direct route
        const methods = Object.keys(layer.route.methods);
        const middlewareNames = layer.route.stack
          .map((s: any) => s.handle?.name || 'anonymous')
          .filter((name: string) => name !== 'anonymous');

        routes.push({
          method: methods.join(',').toUpperCase(),
          path: basePath + layer.route.path,
          middleware: middlewareNames,
          hasAuth: middlewareNames.some((n: string) =>
            /auth|verify|jwt|session/i.test(n)
          ),
          hasRateLimit: middlewareNames.some((n: string) =>
            /rate|throttle|limit/i.test(n)
          ),
        });
      } else if (layer.name === 'router' && layer.handle?.stack) {
        // Nested router
        const prefix = layer.regexp?.source
          ?.replace('\\/?(?=\\/|$)', '')
          ?.replace(/\\\//g, '/') || '';
        extractRoutes(layer.handle.stack, basePath + prefix);
      }
    }
  }

  extractRoutes(app._router?.stack || []);
  return routes;
}

// Generate attack surface report
function generateAttackSurfaceReport(app: Express): void {
  const routes = inventoryRoutes(app);

  console.log('=== ATTACK SURFACE REPORT ===');
  console.log(`Total endpoints: ${routes.length}`);

  const unauthenticated = routes.filter(r => !r.hasAuth);
  console.log(`\nUnauthenticated endpoints (${unauthenticated.length}):`);
  for (const r of unauthenticated) {
    console.log(`  [WARNING] ${r.method} ${r.path}`);
  }

  const noRateLimit = routes.filter(r => !r.hasRateLimit);
  console.log(`\nEndpoints without rate limiting (${noRateLimit.length}):`);
  for (const r of noRateLimit) {
    console.log(`  [WARNING] ${r.method} ${r.path}`);
  }

  const debugRoutes = routes.filter(r =>
    /debug|test|dev|internal|inspect|pprof|metrics/i.test(r.path)
  );
  if (debugRoutes.length > 0) {
    console.log(`\nDebug/internal endpoints found (${debugRoutes.length}):`);
    for (const r of debugRoutes) {
      console.log(`  [CRITICAL] ${r.method} ${r.path}`);
    }
  }
}
```

```go
// Go -- Endpoint inventory for HTTP routers (chi/mux compatible)
package security

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

type EndpointInfo struct {
	Method      string
	Path        string
	Handler     string
	HasAuth     bool
	IsInternal  bool
	IsDebug     bool
}

func InventoryChiRoutes(r chi.Router) []EndpointInfo {
	var endpoints []EndpointInfo

	walkFunc := func(method, route string, handler http.Handler, middlewares ...func(http.Handler) http.Handler) error {
		info := EndpointInfo{
			Method:  method,
			Path:    route,
			Handler: fmt.Sprintf("%T", handler),
		}

		// Detect auth middleware presence
		for _, mw := range middlewares {
			name := fmt.Sprintf("%T", mw)
			if strings.Contains(strings.ToLower(name), "auth") {
				info.HasAuth = true
			}
		}

		// Flag internal and debug endpoints
		lowerPath := strings.ToLower(route)
		info.IsInternal = strings.Contains(lowerPath, "/internal/") ||
			strings.Contains(lowerPath, "/admin/")
		info.IsDebug = strings.Contains(lowerPath, "/debug/") ||
			strings.Contains(lowerPath, "/pprof") ||
			strings.Contains(lowerPath, "/__")

		endpoints = append(endpoints, info)
		return nil
	}

	chi.Walk(r, walkFunc)
	return endpoints
}

func AuditEndpoints(endpoints []EndpointInfo) {
	fmt.Println("=== ENDPOINT SECURITY AUDIT ===")

	for _, ep := range endpoints {
		var warnings []string

		if !ep.HasAuth {
			warnings = append(warnings, "NO_AUTH")
		}
		if ep.IsDebug {
			warnings = append(warnings, "DEBUG_ENDPOINT")
		}
		if ep.IsInternal && !ep.HasAuth {
			warnings = append(warnings, "UNPROTECTED_INTERNAL")
		}

		if len(warnings) > 0 {
			fmt.Printf("[WARN] %s %s -- %s\n",
				ep.Method, ep.Path, strings.Join(warnings, ", "))
		}
	}
}
```

---

### Attack Surface Mapping

Attack surface mapping goes beyond listing endpoints. It involves understanding data flows, trust boundaries, and dependency relationships.

```
Attack Surface Mapping Process:
+---------------------------------------------------------------+
|                                                                 |
|  Step 1: Endpoint Inventory                                    |
|  - List all HTTP routes, WebSocket handlers, gRPC services     |
|  - Include health checks, metrics, and admin endpoints         |
|  - Document authentication requirements per endpoint           |
|                                                                 |
|  Step 2: Dependency Mapping                                    |
|  - Enumerate all third-party packages (npm, pip, go modules)   |
|  - Identify transitive dependencies                            |
|  - Map external service integrations (APIs, SaaS, databases)   |
|                                                                 |
|  Step 3: Data Flow Analysis                                    |
|  - Trace data from ingestion to storage to output              |
|  - Identify where sensitive data is processed                  |
|  - Map serialization/deserialization boundaries                |
|                                                                 |
|  Step 4: Trust Boundary Identification                         |
|  - Internet <-> Load Balancer (untrusted to semi-trusted)      |
|  - Load Balancer <-> Application (semi-trusted to trusted)     |
|  - Application <-> Database (trusted to highly trusted)        |
|  - Service <-> Service (trust depends on network segment)      |
|  - Internal <-> Third-party API (trusted to external)          |
|                                                                 |
+---------------------------------------------------------------+
```

```python
# Python -- Automated dependency attack surface analysis
import json
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class DependencyRisk:
    name: str
    version: str
    is_direct: bool
    known_vulnerabilities: int = 0
    last_updated: str = ""
    maintainers: int = 0
    risk_score: float = 0.0
    risk_factors: list[str] = field(default_factory=list)


def analyze_npm_dependencies(package_json_path: str) -> list[DependencyRisk]:
    """Analyze npm dependencies for attack surface risk."""
    path = Path(package_json_path)
    with open(path) as f:
        pkg = json.load(f)

    direct_deps = set(pkg.get("dependencies", {}).keys())
    dev_deps = set(pkg.get("devDependencies", {}).keys())

    # Run npm audit for vulnerability data
    audit_result = subprocess.run(
        ["npm", "audit", "--json"],
        capture_output=True, text=True, cwd=path.parent
    )
    audit_data = json.loads(audit_result.stdout) if audit_result.stdout else {}

    # Build risk assessments
    risks: list[DependencyRisk] = []
    vuln_map = audit_data.get("vulnerabilities", {})

    all_deps = direct_deps | dev_deps
    for dep_name in all_deps:
        risk = DependencyRisk(
            name=dep_name,
            version=pkg.get("dependencies", {}).get(
                dep_name,
                pkg.get("devDependencies", {}).get(dep_name, "unknown")
            ),
            is_direct=dep_name in direct_deps,
        )

        # Check for known vulnerabilities
        if dep_name in vuln_map:
            vuln = vuln_map[dep_name]
            risk.known_vulnerabilities = len(vuln.get("via", []))
            risk.risk_factors.append(
                f"{risk.known_vulnerabilities} known vulnerabilities"
            )

        # Flag dev dependencies shipped to production
        if dep_name in dev_deps:
            risk.risk_factors.append("devDependency -- verify not in production bundle")

        # Calculate risk score
        risk.risk_score = (
            risk.known_vulnerabilities * 3.0
            + (0.5 if not risk.is_direct else 0)
        )

        risks.append(risk)

    # Sort by risk score descending
    risks.sort(key=lambda r: r.risk_score, reverse=True)
    return risks


def print_dependency_report(risks: list[DependencyRisk]) -> None:
    """Print a formatted dependency risk report."""
    print("=== DEPENDENCY ATTACK SURFACE REPORT ===")
    print(f"Total dependencies analyzed: {len(risks)}")

    high_risk = [r for r in risks if r.risk_score >= 3.0]
    if high_risk:
        print(f"\nHigh-risk dependencies ({len(high_risk)}):")
        for r in high_risk:
            print(f"  [CRITICAL] {r.name}@{r.version}")
            for factor in r.risk_factors:
                print(f"    - {factor}")

    vuln_deps = [r for r in risks if r.known_vulnerabilities > 0]
    print(f"\nDependencies with known vulnerabilities: {len(vuln_deps)}")
    print(f"Direct dependencies: {sum(1 for r in risks if r.is_direct)}")
    print(f"Transitive dependencies: {sum(1 for r in risks if not r.is_direct)}")
```

---

### External vs Internal Attack Surface

```
External Attack Surface (EASM):              Internal Attack Surface:
+-----------------------------+              +-----------------------------+
| Internet-facing assets      |              | Post-breach lateral movement|
|                             |              |                             |
| - Public websites           |              | - Internal APIs             |
| - API gateways              |              | - Service-to-service comms  |
| - DNS records / subdomains  |              | - Database connections      |
| - Cloud storage (S3, GCS)   |              | - Message queues            |
| - Email servers (MX)        |              | - Shared file systems       |
| - VPN endpoints             |              | - Internal admin panels     |
| - Mobile app backends       |              | - CI/CD pipelines           |
| - CDN configurations        |              | - Secrets management        |
| - SSL/TLS certificates      |              | - Container orchestration   |
| - Third-party SaaS          |              | - Internal DNS              |
|                             |              | - Service mesh              |
| Discovery: outside-in scan  |              | Discovery: inside-out audit |
| Tools: Amass, Subfinder,    |              | Tools: network mapping,     |
|        Shodan, Censys       |              |        service mesh telemetry|
+-----------------------------+              +-----------------------------+
```

EASM focuses on what an attacker sees from the outside -- the internet-facing perimeter. Internal ASM assumes the perimeter has already been breached and focuses on limiting lateral movement. Both are required. A strong external perimeter with flat internal networking means a single compromised service exposes everything.

---

## Reducing the Attack Surface

### Remove Unused Endpoints and Dead Code

```typescript
// TypeScript -- Middleware to detect and flag unused endpoints
// Track endpoint usage over time, then remove unused ones

import { Request, Response, NextFunction } from 'express';
import fs from 'fs';

interface EndpointUsage {
  method: string;
  path: string;
  lastAccessed: number;
  totalHits: number;
}

const usageFile = '/var/log/endpoint-usage.json';

// Load existing usage data
let usageMap: Map<string, EndpointUsage> = new Map();
try {
  const data = JSON.parse(fs.readFileSync(usageFile, 'utf-8'));
  usageMap = new Map(Object.entries(data));
} catch {
  // First run, start fresh
}

export function trackEndpointUsage(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const key = `${req.method}:${req.route?.path || req.path}`;
  const existing = usageMap.get(key);

  usageMap.set(key, {
    method: req.method,
    path: req.route?.path || req.path,
    lastAccessed: Date.now(),
    totalHits: (existing?.totalHits || 0) + 1,
  });

  next();
}

// Run periodically to identify dead endpoints
export function reportDeadEndpoints(thresholdDays: number = 30): string[] {
  const threshold = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
  const deadEndpoints: string[] = [];

  for (const [key, usage] of usageMap) {
    if (usage.lastAccessed < threshold) {
      deadEndpoints.push(
        `${usage.method} ${usage.path} -- last accessed ` +
        `${Math.floor((Date.now() - usage.lastAccessed) / 86400000)} days ago`
      );
    }
  }

  return deadEndpoints;
}
```

### Disable Debug Endpoints in Production

```go
// Go -- Conditionally register debug endpoints based on environment
package main

import (
	"net/http"
	"net/http/pprof"
	"os"
	"log"

	"github.com/go-chi/chi/v5"
)

func setupRouter() chi.Router {
	r := chi.NewRouter()

	// Production routes -- always registered
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(authMiddleware)
		r.Use(rateLimitMiddleware)
		r.Get("/users", listUsers)
		r.Post("/users", createUser)
	})

	// Health check -- minimal information in production
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Debug endpoints -- NEVER in production
	env := os.Getenv("APP_ENV")
	if env == "development" || env == "staging" {
		log.Println("[WARN] Debug endpoints enabled -- not for production use")
		r.Route("/debug", func(r chi.Router) {
			r.HandleFunc("/pprof/", pprof.Index)
			r.HandleFunc("/pprof/cmdline", pprof.Cmdline)
			r.HandleFunc("/pprof/profile", pprof.Profile)
			r.HandleFunc("/pprof/symbol", pprof.Symbol)
			r.HandleFunc("/pprof/trace", pprof.Trace)
			r.Handle("/pprof/heap", pprof.Handler("heap"))
			r.Handle("/pprof/goroutine", pprof.Handler("goroutine"))
		})
	} else if env == "production" {
		// Explicitly block debug paths in production
		r.HandleFunc("/debug/*", func(w http.ResponseWriter, r *http.Request) {
			http.NotFound(w, r)
		})
	}

	return r
}
```

### Remove Default Credentials and Sample Pages

```python
# Python -- Pre-deployment security checker
# Run as part of CI/CD pipeline before deployment

import os
import re
import sys
from pathlib import Path


class PreDeploymentChecker:
    """Check for common attack surface issues before deployment."""

    def __init__(self, project_root: str):
        self.root = Path(project_root)
        self.issues: list[str] = []

    def check_default_credentials(self) -> None:
        """Scan for hardcoded default credentials."""
        patterns = [
            r'password\s*[=:]\s*["\'](?:admin|password|123456|root|test)',
            r'secret\s*[=:]\s*["\'](?:changeme|secret|default|TODO)',
            r'api[_-]?key\s*[=:]\s*["\'](?:test|demo|sample|CHANGE)',
            r'token\s*[=:]\s*["\'](?:test|demo|sample|xxxx)',
        ]

        for filepath in self.root.rglob("*"):
            if filepath.is_file() and filepath.suffix in (
                ".py", ".ts", ".js", ".go", ".yaml", ".yml",
                ".json", ".toml", ".env", ".cfg", ".ini",
            ):
                try:
                    content = filepath.read_text(errors="ignore")
                except Exception:
                    continue

                for pattern in patterns:
                    matches = re.finditer(pattern, content, re.IGNORECASE)
                    for match in matches:
                        self.issues.append(
                            f"[CRITICAL] Default credential in "
                            f"{filepath.relative_to(self.root)}: "
                            f"{match.group()[:50]}..."
                        )

    def check_debug_configuration(self) -> None:
        """Detect debug mode enabled in configuration files."""
        debug_patterns = [
            (r'DEBUG\s*=\s*[Tt]rue', "Debug mode enabled"),
            (r'debug:\s*true', "Debug mode enabled in YAML"),
            (r'NODE_ENV\s*=\s*development', "Node environment set to development"),
            (r'FLASK_DEBUG\s*=\s*1', "Flask debug mode enabled"),
            (r'APP_DEBUG\s*=\s*true', "Application debug mode enabled"),
        ]

        config_files = list(self.root.rglob("*.env")) + \
                       list(self.root.rglob("*.env.*")) + \
                       list(self.root.rglob("*.yaml")) + \
                       list(self.root.rglob("*.yml"))

        for filepath in config_files:
            if ".env.example" in filepath.name:
                continue
            try:
                content = filepath.read_text(errors="ignore")
            except Exception:
                continue

            for pattern, message in debug_patterns:
                if re.search(pattern, content):
                    self.issues.append(
                        f"[HIGH] {message} in "
                        f"{filepath.relative_to(self.root)}"
                    )

    def check_sample_files(self) -> None:
        """Detect sample/example files that should not be deployed."""
        suspect_patterns = [
            "**/sample/**", "**/example/**", "**/demo/**",
            "**/test-page*", "**/default.html",
            "**/phpinfo.php", "**/info.php",
            "**/swagger-ui/**",  # Swagger UI exposed in production
        ]

        for pattern in suspect_patterns:
            for filepath in self.root.rglob(pattern.replace("**/", "")):
                self.issues.append(
                    f"[MEDIUM] Sample/test file detected: "
                    f"{filepath.relative_to(self.root)}"
                )

    def check_exposed_ports_config(self) -> None:
        """Check Docker and compose files for unnecessarily exposed ports."""
        for compose_file in self.root.rglob("docker-compose*.yml"):
            try:
                content = compose_file.read_text()
            except Exception:
                continue

            # Detect ports bound to 0.0.0.0 (all interfaces)
            port_matches = re.finditer(
                r'ports:\s*\n((?:\s+-\s+.+\n)+)', content
            )
            for match in port_matches:
                ports_block = match.group(1)
                for line in ports_block.strip().split('\n'):
                    line = line.strip().lstrip('- ').strip('"').strip("'")
                    # "8080:80" binds to all interfaces
                    if re.match(r'^\d+:\d+$', line):
                        self.issues.append(
                            f"[HIGH] Port bound to all interfaces in "
                            f"{compose_file.relative_to(self.root)}: {line} "
                            f"-- use 127.0.0.1:{line} to bind to localhost only"
                        )

    def run_all_checks(self) -> bool:
        """Run all pre-deployment checks. Return True if clean."""
        self.check_default_credentials()
        self.check_debug_configuration()
        self.check_sample_files()
        self.check_exposed_ports_config()

        if self.issues:
            print("=== PRE-DEPLOYMENT SECURITY CHECK FAILED ===")
            for issue in sorted(self.issues):
                print(f"  {issue}")
            print(f"\nTotal issues: {len(self.issues)}")
            return False

        print("=== PRE-DEPLOYMENT SECURITY CHECK PASSED ===")
        return True


if __name__ == "__main__":
    project_root = sys.argv[1] if len(sys.argv) > 1 else "."
    checker = PreDeploymentChecker(project_root)
    if not checker.run_all_checks():
        sys.exit(1)
```

### Network Segmentation

```
Recommended Network Segmentation:
+---------------------------------------------------------------+
|                                                                 |
|  Public Zone (DMZ)           | Private Zone                    |
|  +-------------------------+ | +-----------------------------+ |
|  | Load Balancer           | | | Application Servers         | |
|  | CDN / WAF               | | | Background Workers          | |
|  | Reverse Proxy           | | | Internal APIs               | |
|  +-------------------------+ | +-----------------------------+ |
|            |                 |              |                   |
|    Port 443 only             |   Port 8080 (internal only)     |
|            |                 |              |                   |
|  +-------------------------+ | +-----------------------------+ |
|  | API Gateway             | | | Message Queues              | |
|  | Rate Limiting           | | | Cache (Redis)               | |
|  | Auth Verification       | | | Search (Elasticsearch)      | |
|  +-------------------------+ | +-----------------------------+ |
|                              |              |                   |
|                              |   Port 5432/6379 (DB subnet)    |
|                              |              |                   |
|                              | +-----------------------------+ |
|                              | | Database Subnet              | |
|                              | | - PostgreSQL                 | |
|                              | | - No internet access         | |
|                              | | - Only app subnet can reach  | |
|                              | +-----------------------------+ |
|                              |                                  |
|  Management Zone             |                                  |
|  +-------------------------+ |                                  |
|  | Bastion Host            | |                                  |
|  | CI/CD Runners           | |                                  |
|  | Monitoring / Logging    | |                                  |
|  +-------------------------+ |                                  |
+---------------------------------------------------------------+

Rules:
- Public zone: only ports 80/443 inbound from internet
- App zone: only reachable from public zone on specific ports
- DB zone: only reachable from app zone on database ports
- Management zone: SSH via bastion only, restricted IP allowlist
- No direct internet access from DB or app zones (use NAT gateway)
```

---

## Cloud Attack Surface

Cloud environments introduce unique attack surface concerns that do not exist in traditional on-premise deployments.

```
Cloud Attack Surface Vectors:
+---------------------------------------------------------------+
|                                                                 |
|  Storage Exposure                                              |
|  - Public S3 buckets / GCS buckets / Azure Blob containers    |
|  - Misconfigured bucket policies                              |
|  - Backup snapshots shared publicly                           |
|                                                                 |
|  Compute Exposure                                              |
|  - Overly permissive security groups (0.0.0.0/0 ingress)      |
|  - Exposed management ports (SSH 22, RDP 3389)                |
|  - Serverless functions with public invocation URLs            |
|  - Container images with embedded secrets                     |
|                                                                 |
|  Identity & Access                                             |
|  - IAM policies with wildcard permissions (*:*)                |
|  - Long-lived access keys (no rotation)                       |
|  - Cross-account role trust too broad                         |
|  - Service accounts with excessive privileges                 |
|                                                                 |
|  Network Exposure                                              |
|  - Default VPC with permissive rules                          |
|  - Public subnets for resources that should be private        |
|  - Missing VPC flow logs                                      |
|  - DNS zone transfer enabled                                  |
|                                                                 |
|  Data Exposure                                                 |
|  - Unencrypted database snapshots                             |
|  - Publicly accessible RDS/Cloud SQL instances                |
|  - Elasticsearch/OpenSearch domains without authentication    |
|  - Redis/Memcached exposed without auth                       |
|                                                                 |
+---------------------------------------------------------------+
```

```typescript
// TypeScript -- AWS attack surface scanner using AWS SDK
import {
  S3Client,
  ListBucketsCommand,
  GetBucketPolicyStatusCommand,
  GetPublicAccessBlockCommand,
} from '@aws-sdk/client-s3';
import {
  EC2Client,
  DescribeSecurityGroupsCommand,
} from '@aws-sdk/client-ec2';
import {
  IAMClient,
  ListUsersCommand,
  ListAccessKeysCommand,
  GetAccessKeyLastUsedCommand,
} from '@aws-sdk/client-iam';

interface CloudFinding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  resource: string;
  issue: string;
  remediation: string;
}

async function scanS3Buckets(s3: S3Client): Promise<CloudFinding[]> {
  const findings: CloudFinding[] = [];
  const { Buckets } = await s3.send(new ListBucketsCommand({}));

  for (const bucket of Buckets || []) {
    const name = bucket.Name!;

    try {
      // Check public access block
      const accessBlock = await s3.send(
        new GetPublicAccessBlockCommand({ Bucket: name })
      );
      const config = accessBlock.PublicAccessBlockConfiguration;

      if (!config?.BlockPublicAcls || !config?.BlockPublicPolicy ||
          !config?.IgnorePublicAcls || !config?.RestrictPublicBuckets) {
        findings.push({
          severity: 'CRITICAL',
          resource: `s3://${name}`,
          issue: 'Public access block not fully enabled',
          remediation: 'Enable all four public access block settings',
        });
      }
    } catch {
      findings.push({
        severity: 'HIGH',
        resource: `s3://${name}`,
        issue: 'Cannot determine public access block status',
        remediation: 'Verify bucket access configuration manually',
      });
    }

    try {
      const policyStatus = await s3.send(
        new GetBucketPolicyStatusCommand({ Bucket: name })
      );
      if (policyStatus.PolicyStatus?.IsPublic) {
        findings.push({
          severity: 'CRITICAL',
          resource: `s3://${name}`,
          issue: 'Bucket policy allows public access',
          remediation: 'Review and restrict bucket policy',
        });
      }
    } catch {
      // No bucket policy = not publicly accessible via policy
    }
  }

  return findings;
}

async function scanSecurityGroups(ec2: EC2Client): Promise<CloudFinding[]> {
  const findings: CloudFinding[] = [];
  const { SecurityGroups } = await ec2.send(
    new DescribeSecurityGroupsCommand({})
  );

  for (const sg of SecurityGroups || []) {
    for (const perm of sg.IpPermissions || []) {
      for (const range of perm.IpRanges || []) {
        if (range.CidrIp === '0.0.0.0/0') {
          const port = perm.FromPort === perm.ToPort
            ? `${perm.FromPort}`
            : `${perm.FromPort}-${perm.ToPort}`;

          const severity =
            perm.FromPort === 22 || perm.FromPort === 3389 ||
            perm.FromPort === 5432 || perm.FromPort === 3306
              ? 'CRITICAL' : 'HIGH';

          findings.push({
            severity,
            resource: `sg:${sg.GroupId} (${sg.GroupName})`,
            issue: `Port ${port} open to 0.0.0.0/0 (entire internet)`,
            remediation: `Restrict ingress to specific CIDR ranges`,
          });
        }
      }
    }
  }

  return findings;
}

async function scanIAMAccessKeys(iam: IAMClient): Promise<CloudFinding[]> {
  const findings: CloudFinding[] = [];
  const { Users } = await iam.send(new ListUsersCommand({}));

  for (const user of Users || []) {
    const { AccessKeyMetadata } = await iam.send(
      new ListAccessKeysCommand({ UserName: user.UserName })
    );

    for (const key of AccessKeyMetadata || []) {
      if (key.Status !== 'Active') continue;

      const { AccessKeyLastUsed } = await iam.send(
        new GetAccessKeyLastUsedCommand({ AccessKeyId: key.AccessKeyId })
      );

      const daysSinceCreated = Math.floor(
        (Date.now() - (key.CreateDate?.getTime() || 0)) / 86400000
      );

      // Flag keys older than 90 days
      if (daysSinceCreated > 90) {
        findings.push({
          severity: 'HIGH',
          resource: `iam:${user.UserName}/${key.AccessKeyId}`,
          issue: `Access key is ${daysSinceCreated} days old (>90 day limit)`,
          remediation: 'Rotate access key or switch to IAM roles',
        });
      }

      // Flag keys never used
      if (!AccessKeyLastUsed?.LastUsedDate) {
        findings.push({
          severity: 'MEDIUM',
          resource: `iam:${user.UserName}/${key.AccessKeyId}`,
          issue: 'Access key has never been used',
          remediation: 'Delete unused access key',
        });
      }
    }
  }

  return findings;
}
```

---

## API Attack Surface

APIs are the primary attack surface for modern applications. Every public and internal API endpoint represents a potential entry point.

```
API Attack Surface Concerns:
+---------------------------------------------------------------+
|                                                                 |
|  Undocumented Endpoints                                        |
|  - Endpoints not in API docs but still accessible              |
|  - Legacy routes from previous API versions                    |
|  - Auto-generated CRUD routes (e.g., from ORM scaffolding)    |
|                                                                 |
|  Overly Permissive CORS                                        |
|  - Access-Control-Allow-Origin: *                              |
|  - Allowing credentials with wildcard origin                   |
|  - Reflecting arbitrary Origin header in response              |
|                                                                 |
|  Information Leakage                                           |
|  - Stack traces in error responses                             |
|  - Database query details in error messages                    |
|  - Server version headers (X-Powered-By, Server)              |
|  - Verbose 404 pages listing valid routes                      |
|                                                                 |
|  GraphQL Specific                                              |
|  - Introspection enabled in production                         |
|  - No query depth or complexity limits                         |
|  - No field-level authorization                                |
|                                                                 |
|  Excessive Data Exposure                                       |
|  - Returning entire database records instead of needed fields  |
|  - Including internal IDs, timestamps, metadata in responses  |
|  - No response field filtering or projection                  |
|                                                                 |
+---------------------------------------------------------------+
```

```typescript
// TypeScript -- Security middleware for API attack surface reduction
import { Request, Response, NextFunction } from 'express';

// 1. Remove information leakage headers
export function removeServerHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Modern browsers, use CSP instead
  res.setHeader(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  next();
}

// 2. Strict CORS configuration
export function strictCors(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
      );
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    // Do NOT reflect arbitrary origins
    // Do NOT use Access-Control-Allow-Origin: *

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

// 3. Production error handler -- no stack traces
export function productionErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log full error internally
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  // Return sanitized error to client
  const statusCode = (err as any).statusCode || 500;

  if (process.env.NODE_ENV === 'production') {
    res.status(statusCode).json({
      error: statusCode >= 500
        ? 'Internal server error'
        : err.message,
      // No stack trace, no query details, no internal state
    });
  } else {
    // Development: include details for debugging
    res.status(statusCode).json({
      error: err.message,
      stack: err.stack,
    });
  }
}

// 4. GraphQL introspection guard
export function disableGraphQLIntrospection() {
  return {
    requestDidStart() {
      return {
        async didResolveOperation(context: any) {
          if (process.env.NODE_ENV === 'production') {
            const query = context.request.query || '';
            if (
              query.includes('__schema') ||
              query.includes('__type')
            ) {
              throw new Error('GraphQL introspection is disabled');
            }
          }
        },
      };
    },
  };
}

// 5. Response field filtering -- prevent excessive data exposure
interface FieldFilter {
  [resource: string]: string[];
}

const ALLOWED_RESPONSE_FIELDS: FieldFilter = {
  user: ['id', 'name', 'email', 'role', 'createdAt'],
  // Explicitly exclude: passwordHash, internalNotes, ssn, etc.
  order: ['id', 'status', 'total', 'items', 'createdAt'],
  // Explicitly exclude: internalCost, marginPercent, etc.
};

export function filterResponseFields(resource: string, data: any): any {
  const allowedFields = ALLOWED_RESPONSE_FIELDS[resource];
  if (!allowedFields) return data;

  if (Array.isArray(data)) {
    return data.map(item => filterSingle(item, allowedFields));
  }
  return filterSingle(data, allowedFields);
}

function filterSingle(obj: Record<string, any>, fields: string[]): any {
  const filtered: Record<string, any> = {};
  for (const field of fields) {
    if (field in obj) {
      filtered[field] = obj[field];
    }
  }
  return filtered;
}
```

---

## Supply Chain Attack Surface

The software supply chain is a growing attack vector. Every dependency, build tool, CI/CD pipeline, and package registry is a potential compromise point.

```
Supply Chain Attack Vectors:
+---------------------------------------------------------------+
|                                                                 |
|  Dependencies                                                  |
|  - Compromised npm/PyPI/Go packages (typosquatting)           |
|  - Malicious maintainer takeover                              |
|  - Dependency confusion (internal vs public package names)    |
|  - Unmaintained packages with known CVEs                      |
|                                                                 |
|  CI/CD Pipelines                                               |
|  - Secrets exposed in build logs                              |
|  - Untrusted code execution in CI runners                     |
|  - Insecure pipeline configurations (PR from fork runs CI)    |
|  - Build artifact tampering                                   |
|                                                                 |
|  Build Systems                                                 |
|  - Compromised build tools or compilers                       |
|  - Unsigned build artifacts                                   |
|  - Reproducibility issues (different builds from same source) |
|                                                                 |
|  Container Images                                              |
|  - Base images with known vulnerabilities                     |
|  - Secrets baked into image layers                            |
|  - Pulling from untrusted registries                          |
|  - No image signing or verification                           |
|                                                                 |
+---------------------------------------------------------------+
```

```go
// Go -- Dependency audit tool for Go modules
package audit

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

type ModuleInfo struct {
	Path      string    `json:"Path"`
	Version   string    `json:"Version"`
	Time      time.Time `json:"Time"`
	Indirect  bool      `json:"Indirect"`
	Dir       string    `json:"Dir"`
	GoMod     string    `json:"GoMod"`
	GoVersion string    `json:"GoVersion"`
}

type SupplyChainFinding struct {
	Severity    string
	Module      string
	Version     string
	Description string
}

func AuditGoModules() ([]SupplyChainFinding, error) {
	var findings []SupplyChainFinding

	// List all dependencies as JSON
	cmd := exec.Command("go", "list", "-m", "-json", "all")
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to list modules: %w", err)
	}

	// Parse JSON stream (go list -json outputs concatenated JSON objects)
	decoder := json.NewDecoder(strings.NewReader(string(output)))
	var modules []ModuleInfo
	for decoder.More() {
		var mod ModuleInfo
		if err := decoder.Decode(&mod); err != nil {
			continue
		}
		modules = append(modules, mod)
	}

	for _, mod := range modules {
		// Skip the main module
		if mod.Version == "" {
			continue
		}

		// Check for old dependencies (> 2 years without update)
		if !mod.Time.IsZero() {
			age := time.Since(mod.Time)
			if age > 2*365*24*time.Hour {
				findings = append(findings, SupplyChainFinding{
					Severity:    "MEDIUM",
					Module:      mod.Path,
					Version:     mod.Version,
					Description: fmt.Sprintf("Module not updated in %.0f days", age.Hours()/24),
				})
			}
		}

		// Flag modules from suspicious registries
		if !strings.HasPrefix(mod.Path, "github.com/") &&
			!strings.HasPrefix(mod.Path, "golang.org/") &&
			!strings.HasPrefix(mod.Path, "google.golang.org/") &&
			!strings.HasPrefix(mod.Path, "go.uber.org/") {
			findings = append(findings, SupplyChainFinding{
				Severity:    "LOW",
				Module:      mod.Path,
				Version:     mod.Version,
				Description: "Module from less common registry -- verify legitimacy",
			})
		}
	}

	// Run govulncheck for known vulnerabilities
	vulnCmd := exec.Command("govulncheck", "./...")
	vulnOutput, err := vulnCmd.CombinedOutput()
	if err != nil {
		// govulncheck exits non-zero when vulnerabilities found
		findings = append(findings, SupplyChainFinding{
			Severity:    "HIGH",
			Module:      "(multiple)",
			Version:     "",
			Description: fmt.Sprintf("govulncheck found issues:\n%s", string(vulnOutput)),
		})
	}

	return findings, nil
}
```

---

## Attack Surface Monitoring

Continuous monitoring detects new attack surface expansion before attackers exploit it.

```
Continuous Monitoring Strategy:
+---------------------------------------------------------------+
|                                                                 |
|  Asset Discovery (Weekly)                                      |
|  - Scan DNS records for new subdomains                        |
|  - Monitor certificate transparency logs                      |
|  - Discover cloud resources via API (new S3, EC2, Lambda)     |
|  - Scan IP ranges for new services                            |
|                                                                 |
|  Endpoint Monitoring (Daily)                                   |
|  - Compare current route table against baseline               |
|  - Detect new endpoints added without security review         |
|  - Monitor for re-enabled debug endpoints                     |
|  - Track API version usage for deprecation                    |
|                                                                 |
|  Dependency Tracking (On Every Build)                          |
|  - npm audit / pip-audit / govulncheck in CI                  |
|  - SBOM generation and diff                                   |
|  - License compliance check                                   |
|  - Dependency freshness check                                 |
|                                                                 |
|  Certificate Monitoring (Daily)                                |
|  - Monitor expiration dates                                   |
|  - Detect certificates issued for your domains (CT logs)      |
|  - Verify certificate chain validity                          |
|  - Alert on unexpected certificate changes                    |
|                                                                 |
|  Configuration Drift (Hourly)                                  |
|  - Compare cloud resource config against policy               |
|  - Detect new security group rules                            |
|  - Monitor IAM policy changes                                 |
|  - Track firewall rule modifications                          |
|                                                                 |
+---------------------------------------------------------------+
```

```python
# Python -- Attack surface monitoring automation
import hashlib
import json
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


@dataclass
class AttackSurfaceBaseline:
    """Represents a snapshot of the current attack surface."""
    timestamp: str
    endpoints: list[dict]
    dependencies: list[dict]
    open_ports: list[dict]
    dns_records: list[dict]
    cloud_resources: list[dict]
    checksum: str = ""

    def compute_checksum(self) -> str:
        content = json.dumps({
            "endpoints": self.endpoints,
            "dependencies": self.dependencies,
            "open_ports": self.open_ports,
            "dns_records": self.dns_records,
            "cloud_resources": self.cloud_resources,
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


@dataclass
class SurfaceChange:
    category: str
    change_type: str  # "added", "removed", "modified"
    description: str
    severity: str
    details: dict = field(default_factory=dict)


class AttackSurfaceMonitor:
    """Monitor attack surface changes between baselines."""

    def __init__(self, baseline_dir: str = "/var/lib/asm/baselines"):
        self.baseline_dir = Path(baseline_dir)
        self.baseline_dir.mkdir(parents=True, exist_ok=True)

    def capture_baseline(self) -> AttackSurfaceBaseline:
        """Capture current attack surface state."""
        baseline = AttackSurfaceBaseline(
            timestamp=datetime.utcnow().isoformat(),
            endpoints=self._discover_endpoints(),
            dependencies=self._discover_dependencies(),
            open_ports=self._discover_open_ports(),
            dns_records=self._discover_dns_records(),
            cloud_resources=self._discover_cloud_resources(),
        )
        baseline.checksum = baseline.compute_checksum()
        return baseline

    def compare_baselines(
        self,
        previous: AttackSurfaceBaseline,
        current: AttackSurfaceBaseline,
    ) -> list[SurfaceChange]:
        """Compare two baselines and identify changes."""
        changes: list[SurfaceChange] = []

        # Compare endpoints
        prev_endpoints = {
            f"{e['method']}:{e['path']}" for e in previous.endpoints
        }
        curr_endpoints = {
            f"{e['method']}:{e['path']}" for e in current.endpoints
        }

        for added in curr_endpoints - prev_endpoints:
            changes.append(SurfaceChange(
                category="endpoint",
                change_type="added",
                description=f"New endpoint discovered: {added}",
                severity="HIGH",
                details={"endpoint": added},
            ))

        for removed in prev_endpoints - curr_endpoints:
            changes.append(SurfaceChange(
                category="endpoint",
                change_type="removed",
                description=f"Endpoint removed: {removed}",
                severity="LOW",
                details={"endpoint": removed},
            ))

        # Compare dependencies
        prev_deps = {
            f"{d['name']}@{d['version']}" for d in previous.dependencies
        }
        curr_deps = {
            f"{d['name']}@{d['version']}" for d in current.dependencies
        }

        for added in curr_deps - prev_deps:
            changes.append(SurfaceChange(
                category="dependency",
                change_type="added",
                description=f"New dependency: {added}",
                severity="MEDIUM",
                details={"dependency": added},
            ))

        # Compare open ports
        prev_ports = {
            f"{p['port']}/{p['protocol']}" for p in previous.open_ports
        }
        curr_ports = {
            f"{p['port']}/{p['protocol']}" for p in current.open_ports
        }

        for added in curr_ports - prev_ports:
            changes.append(SurfaceChange(
                category="network",
                change_type="added",
                description=f"New open port: {added}",
                severity="HIGH",
                details={"port": added},
            ))

        return changes

    def _discover_endpoints(self) -> list[dict]:
        """Discover HTTP endpoints from application configuration."""
        # Implementation depends on framework; placeholder for integration
        return []

    def _discover_dependencies(self) -> list[dict]:
        """Parse dependency files for current dependency list."""
        deps = []
        # Check for package.json
        pkg_json = Path("package.json")
        if pkg_json.exists():
            pkg = json.loads(pkg_json.read_text())
            for name, version in pkg.get("dependencies", {}).items():
                deps.append({"name": name, "version": version, "ecosystem": "npm"})
        # Check for go.mod
        go_mod = Path("go.mod")
        if go_mod.exists():
            for line in go_mod.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith(("module", "go ", "require", ")", "//")):
                    parts = line.split()
                    if len(parts) >= 2:
                        deps.append({
                            "name": parts[0],
                            "version": parts[1],
                            "ecosystem": "go",
                        })
        return deps

    def _discover_open_ports(self) -> list[dict]:
        """Discover open ports on the local system."""
        ports = []
        try:
            result = subprocess.run(
                ["ss", "-tlnp"],
                capture_output=True, text=True, timeout=10,
            )
            for line in result.stdout.splitlines()[1:]:
                parts = line.split()
                if len(parts) >= 4:
                    addr = parts[3]
                    port = addr.rsplit(":", 1)[-1] if ":" in addr else ""
                    if port.isdigit():
                        ports.append({
                            "port": int(port),
                            "protocol": "tcp",
                            "address": addr,
                        })
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        return ports

    def _discover_dns_records(self) -> list[dict]:
        """Placeholder for DNS record discovery."""
        return []

    def _discover_cloud_resources(self) -> list[dict]:
        """Placeholder for cloud resource discovery."""
        return []
```

---

## Attack Surface Automation

Integrate automated attack surface discovery and scanning into CI/CD pipelines to catch expansion before deployment.

### Tool Landscape

| Tool | Purpose | Integration Point |
|------|---------|-------------------|
| **Amass** | Subdomain enumeration, DNS discovery | Weekly scheduled scan |
| **Subfinder** | Fast passive subdomain discovery | Pre-deployment check |
| **httpx** | HTTP probing, technology detection | After subdomain discovery |
| **Nuclei** | Vulnerability scanning with templates | CI/CD pipeline, scheduled |
| **trivy** | Container image and filesystem scanning | CI/CD pipeline on build |
| **Semgrep** | Static analysis for security patterns | Pre-commit hook, CI/CD |
| **npm audit / pip-audit / govulncheck** | Dependency vulnerability scanning | Every build |
| **ScoutSuite** | Cloud security posture assessment | Weekly scheduled scan |
| **Prowler** | AWS/Azure/GCP security best practices | Daily scheduled scan |

### CI/CD Integration

```yaml
# GitHub Actions -- Attack surface checks in CI/CD pipeline
name: Attack Surface Checks

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'  # Weekly on Monday at 06:00 UTC

jobs:
  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Node.js dependency audit
      - name: npm audit
        if: hashFiles('package-lock.json') != ''
        run: |
          npm ci
          npm audit --audit-level=high
          # Generate SBOM
          npx @cyclonedx/cyclonedx-npm --output-file sbom.json

      # Go dependency audit
      - name: govulncheck
        if: hashFiles('go.mod') != ''
        run: |
          go install golang.org/x/vuln/cmd/govulncheck@latest
          govulncheck ./...

      # Python dependency audit
      - name: pip-audit
        if: hashFiles('requirements.txt') != ''
        run: |
          pip install pip-audit
          pip-audit -r requirements.txt --strict

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t app:${{ github.sha }} .
      - name: Scan with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: app:${{ github.sha }}
          format: 'table'
          exit-code: '1'
          severity: 'CRITICAL,HIGH'

  static-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Semgrep security scan
        uses: semgrep/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/owasp-top-ten
            p/nodejs
            p/golang

  endpoint-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for debug endpoints in production config
        run: |
          # Fail if debug endpoints are found in production code
          if grep -rn "pprof\|/debug/\|/__inspect\|/test/" src/ --include="*.ts" --include="*.go" | \
             grep -v "_test\.\|\.test\.\|\.spec\.\|test/\|tests/\|mock"; then
            echo "ERROR: Debug/test endpoints found in production code"
            exit 1
          fi

      - name: Check for overly permissive CORS
        run: |
          if grep -rn "Access-Control-Allow-Origin.*\*" src/ --include="*.ts" --include="*.go" --include="*.py"; then
            echo "ERROR: Wildcard CORS origin detected"
            exit 1
          fi

  cloud-security:
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'  # Only on scheduled runs
    steps:
      - uses: actions/checkout@v4
      - name: Run Prowler (AWS)
        run: |
          pip install prowler
          prowler aws \
            --severity critical high \
            --checks s3_bucket_public_access \
                     ec2_security_group_open_to_world \
                     iam_access_key_rotation \
                     rds_instance_publicly_accessible
```

### Automated Subdomain and Endpoint Discovery

```bash
#!/usr/bin/env bash
# attack-surface-discovery.sh
# Automated external attack surface discovery
# Run weekly as a scheduled job

set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain>}"
OUTPUT_DIR="/var/lib/asm/scans/$(date +%Y%m%d)"
mkdir -p "$OUTPUT_DIR"

echo "[*] Starting attack surface discovery for $DOMAIN"

# Step 1: Subdomain enumeration
echo "[*] Running Subfinder..."
subfinder -d "$DOMAIN" -silent -o "$OUTPUT_DIR/subdomains-subfinder.txt"

echo "[*] Running Amass (passive)..."
amass enum -passive -d "$DOMAIN" -o "$OUTPUT_DIR/subdomains-amass.txt"

# Combine and deduplicate
cat "$OUTPUT_DIR"/subdomains-*.txt | sort -u > "$OUTPUT_DIR/subdomains-all.txt"
SUBDOMAIN_COUNT=$(wc -l < "$OUTPUT_DIR/subdomains-all.txt")
echo "[*] Found $SUBDOMAIN_COUNT unique subdomains"

# Step 2: HTTP probing -- find live web servers
echo "[*] Probing with httpx..."
httpx -l "$OUTPUT_DIR/subdomains-all.txt" \
  -silent \
  -status-code \
  -title \
  -tech-detect \
  -json \
  -o "$OUTPUT_DIR/live-hosts.json"

# Step 3: Vulnerability scanning with Nuclei
echo "[*] Running Nuclei vulnerability scan..."
nuclei -l "$OUTPUT_DIR/subdomains-all.txt" \
  -severity critical,high,medium \
  -json \
  -o "$OUTPUT_DIR/nuclei-findings.json" \
  -rate-limit 50

# Step 4: Compare with previous baseline
PREV_SCAN=$(ls -d /var/lib/asm/scans/2* 2>/dev/null | sort | tail -2 | head -1)
if [ -n "$PREV_SCAN" ] && [ "$PREV_SCAN" != "$OUTPUT_DIR" ]; then
  echo "[*] Comparing with previous scan: $PREV_SCAN"

  # New subdomains
  comm -23 "$OUTPUT_DIR/subdomains-all.txt" "$PREV_SCAN/subdomains-all.txt" \
    > "$OUTPUT_DIR/new-subdomains.txt"

  NEW_COUNT=$(wc -l < "$OUTPUT_DIR/new-subdomains.txt")
  if [ "$NEW_COUNT" -gt 0 ]; then
    echo "[ALERT] $NEW_COUNT new subdomains discovered:"
    cat "$OUTPUT_DIR/new-subdomains.txt"
  fi
fi

echo "[*] Scan complete. Results in $OUTPUT_DIR"
```

---

## Limiting Exposed API Surface

### API Versioning and Deprecation

```typescript
// TypeScript -- API version management with automatic deprecation
import { Request, Response, NextFunction, Router } from 'express';

interface APIVersion {
  version: string;
  status: 'active' | 'deprecated' | 'sunset';
  sunsetDate?: string;  // ISO date string
  router: Router;
}

const apiVersions: APIVersion[] = [
  { version: 'v1', status: 'sunset', sunsetDate: '2024-06-01', router: v1Router() },
  { version: 'v2', status: 'deprecated', sunsetDate: '2025-12-01', router: v2Router() },
  { version: 'v3', status: 'active', router: v3Router() },
];

function apiVersionMiddleware(version: APIVersion) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (version.status === 'sunset') {
      const sunsetDate = version.sunsetDate || 'unknown';
      // Return 410 Gone for sunset versions -- reduce attack surface
      res.status(410).json({
        error: `API ${version.version} has been sunset as of ${sunsetDate}. ` +
               `Migrate to the latest version.`,
      });
      return;
    }

    if (version.status === 'deprecated') {
      // Add deprecation headers but still serve
      res.setHeader('Deprecation', 'true');
      res.setHeader('Sunset', version.sunsetDate || '');
      res.setHeader(
        'Link',
        `</api/v3>; rel="successor-version"`
      );
      console.warn(
        `[DEPRECATION] ${req.method} /api/${version.version}${req.path} ` +
        `called from ${req.ip}`
      );
    }

    next();
  };
}

// Register only active and deprecated versions
// Sunset versions return 410 instead of being removed entirely
// (graceful degradation for clients still calling old endpoints)
export function mountAPIVersions(app: any): void {
  for (const version of apiVersions) {
    app.use(
      `/api/${version.version}`,
      apiVersionMiddleware(version),
      version.status !== 'sunset' ? version.router : (_req: Request, res: Response) => {
        res.status(410).end();
      }
    );
  }
}
```

### Reducing Third-Party Dependencies

```
Dependency Reduction Decision Tree:

Is the dependency necessary?
|
+-- NO --> Remove it. Less code = smaller attack surface.
|
+-- YES
    |
    +-- Can it be replaced with standard library?
    |   |
    |   +-- YES --> Replace. stdlib is maintained and audited.
    |   |
    |   +-- NO --> Continue evaluation.
    |
    +-- Is it actively maintained (commits in last 6 months)?
    |   |
    |   +-- NO --> Find alternative or fork and vendor.
    |   |
    |   +-- YES --> Continue evaluation.
    |
    +-- How many transitive dependencies does it pull in?
    |   |
    |   +-- Many (>20) --> Consider lighter alternative.
    |   |
    |   +-- Few (<5) --> Acceptable.
    |
    +-- Does it have known CVEs?
    |   |
    |   +-- YES, unpatched --> Do NOT use. Find alternative.
    |   |
    |   +-- YES, patched --> Update to patched version.
    |   |
    |   +-- NO --> Acceptable.
    |
    +-- KEEP, but pin version and monitor for vulnerabilities.
```

---

## Best Practices

1. **ALWAYS maintain a complete inventory** of all endpoints, services, ports, and dependencies -- you cannot secure what you do not know exists
2. **ALWAYS disable debug endpoints and verbose error messages** in production -- pprof, stack traces, and introspection queries are attacker reconnaissance tools
3. **ALWAYS remove default credentials, sample pages, and placeholder configurations** before deployment -- they are the first thing attackers check
4. **ALWAYS enforce network segmentation** -- databases and internal services must never be directly reachable from the internet
5. **ALWAYS implement strict CORS policies** -- never use wildcard origins (`*`) with credentials; explicitly list allowed origins
6. **ALWAYS run dependency vulnerability scans in CI/CD** -- npm audit, govulncheck, pip-audit, trivy on every build, not just periodically
7. **ALWAYS version and deprecate APIs explicitly** -- sunset old versions to prevent accumulation of unmaintained endpoints
8. **ALWAYS monitor for attack surface expansion** -- compare current state against a baseline weekly; alert on new subdomains, open ports, and endpoints
9. **ALWAYS strip server identification headers** in production -- remove `X-Powered-By`, `Server`, and technology fingerprints from HTTP responses
10. **ALWAYS apply the principle of least privilege** to every layer -- IAM policies, security groups, API permissions, and database access must grant only what is required

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No endpoint inventory | Unknown routes accessible to attackers; shadow APIs discovered during breach investigation | Automate route extraction; maintain a living API catalog; audit against actual traffic |
| Debug endpoints in production | `/debug/pprof`, `/__inspect`, `/graphql` with introspection expose internal state and performance data | Conditionally register debug routes; block debug paths in production; use environment-based feature flags |
| Wildcard CORS (`Access-Control-Allow-Origin: *`) | Any website can make authenticated cross-origin requests to your API | Explicitly list allowed origins; never combine wildcard with `Access-Control-Allow-Credentials: true` |
| Stack traces in error responses | Attackers learn framework version, file paths, database schema, and internal logic from error messages | Return generic error messages in production; log full details server-side only |
| Forgotten subdomains | Old staging, dev, or demo subdomains running outdated code with known vulnerabilities | Run periodic subdomain enumeration; decommission unused subdomains; monitor DNS records |
| Flat network (no segmentation) | Single compromised service gives attacker access to databases, message queues, and internal APIs | Segment into public, application, database, and management zones; enforce firewall rules between zones |
| Dependencies never audited | Transitive dependency with critical CVE stays in production for months | Run `npm audit` / `govulncheck` / `pip-audit` on every CI build; block deploys with critical findings |
| Overly permissive IAM / security groups | `0.0.0.0/0` ingress on database port; `*:*` IAM policy; public S3 bucket | Apply least privilege; use infrastructure-as-code with policy validation; run cloud security scanners (Prowler, ScoutSuite) |

---

## Real-world Examples

### GitHub
- External attack surface monitoring via bug bounty program and automated asset discovery
- Strict API versioning with deprecation headers and sunset dates
- Removed GraphQL introspection in production API
- Dependency review required for all PRs (Dependabot + manual review)

### Cloudflare
- Public transparency reports on attack surface incidents
- Zero-trust network architecture -- no flat internal network
- Automated certificate monitoring via Certificate Transparency logs
- Regular decommissioning of legacy endpoints

### Netflix
- Automated cloud security posture management (Security Monkey, Repokid)
- Continuous IAM least-privilege enforcement -- auto-revoke unused permissions
- Chaos engineering includes security scenarios (attack surface testing)

### Stripe
- Minimal API surface -- every endpoint requires explicit justification
- API versioning at the header level with long deprecation periods
- No debug endpoints, no verbose errors -- consistent sanitized responses
- Supply chain security via vendored dependencies and reproducible builds

---

## Enforcement Checklist

### Endpoint and Application Surface

- [ ] Complete inventory of all HTTP/REST/GraphQL/WebSocket endpoints documented
- [ ] All endpoints require authentication (unless explicitly public with justification)
- [ ] Rate limiting applied to all public endpoints
- [ ] Debug endpoints (`/debug/*`, `/pprof`, `/__inspect`) blocked in production
- [ ] GraphQL introspection disabled in production
- [ ] Error responses return generic messages (no stack traces, no query details)
- [ ] Server identification headers removed (`X-Powered-By`, `Server`)
- [ ] CORS configured with explicit origin allowlist (no wildcards)
- [ ] API versions documented with deprecation and sunset dates
- [ ] Sunset API versions return 410 Gone (not silently served)

### Network Surface

- [ ] Only ports 80/443 exposed to public internet
- [ ] Database ports accessible only from application subnet
- [ ] Network segmented into public, application, database, and management zones
- [ ] SSH access restricted to bastion host with IP allowlist
- [ ] VPC flow logs enabled for all subnets
- [ ] No default VPC in use (create purpose-built VPCs)

### Cloud Surface

- [ ] S3/GCS/Azure Blob public access block enabled on all buckets
- [ ] Security groups reviewed -- no `0.0.0.0/0` on sensitive ports
- [ ] IAM policies follow least privilege (no `*:*` actions)
- [ ] Access keys rotated every 90 days or replaced with IAM roles
- [ ] Unused access keys and service accounts deleted
- [ ] Cloud security posture scanner (Prowler/ScoutSuite) runs weekly

### Supply Chain Surface

- [ ] Dependency vulnerability scan runs on every CI build
- [ ] SBOM (Software Bill of Materials) generated for each release
- [ ] Container images scanned with Trivy before deployment
- [ ] Base images pinned to specific digests (not just tags)
- [ ] No secrets embedded in container image layers
- [ ] CI/CD pipeline permissions follow least privilege
- [ ] Third-party GitHub Actions pinned to commit SHA (not tags)

### Monitoring and Continuous Assessment

- [ ] Subdomain enumeration runs weekly (Amass/Subfinder)
- [ ] Certificate Transparency logs monitored for unauthorized certificates
- [ ] Attack surface baseline captured and diffed on each scan
- [ ] Alerts configured for new subdomains, open ports, and endpoints
- [ ] Dependency freshness tracked -- flag packages not updated in 12+ months
- [ ] Cloud configuration drift detection enabled (hourly)
