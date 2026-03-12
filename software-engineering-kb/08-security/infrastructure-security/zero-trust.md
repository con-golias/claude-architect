# Zero Trust Architecture Comprehensive Guide

## Metadata
- **Category**: Infrastructure Security
- **Audience**: Security architects, platform engineers, DevOps engineers
- **Last Updated**: 2026-03-10
- **Complexity**: Advanced
- **Standards**: NIST SP 800-207, BeyondCorp, CISA Zero Trust Maturity Model

---

## 1. Zero Trust Fundamentals

Zero Trust is a security model based on the principle of "never trust, always verify."
Traditional security models assume that everything inside the corporate network
perimeter is trusted. Zero Trust eliminates this assumption and treats every access
request as if it originates from an untrusted network.

### 1.1 Core Principle

Every access request must be authenticated, authorized, and encrypted, regardless
of where the request originates or what resource it accesses. Trust is never granted
implicitly based on network location, device type, or previous authentication.

### 1.2 Why Perimeter Security Fails

The traditional castle-and-moat model fails because:

- Remote work and cloud services blur the network perimeter
- Attackers who breach the perimeter gain unrestricted lateral movement
- VPN connections grant broad network access rather than specific resource access
- Insider threats operate from within the trusted zone
- Supply chain attacks compromise trusted software inside the perimeter

---

## 2. NIST SP 800-207: Seven Tenets of Zero Trust

NIST Special Publication 800-207 defines seven tenets that form the foundation of Zero
Trust Architecture (ZTA).

### Tenet 1: All Data Sources and Computing Services Are Resources

Every device, service, application, and data store is a resource that requires
protection. This includes employee workstations, IoT devices, SaaS applications,
on-premises servers, cloud workloads, and APIs.

### Tenet 2: All Communication Is Secured Regardless of Network Location

Communication must be encrypted and authenticated whether it occurs within a
corporate network, across the internet, or between services in the same data center.
Network location alone does not confer trust.

### Tenet 3: Access to Individual Enterprise Resources Is Granted on a Per-Session Basis

Access is granted for the specific resource and session requested. Previous
authentication does not automatically grant access to other resources. Each request
is evaluated independently.

### Tenet 4: Access Is Determined by Dynamic Policy

Access decisions consider multiple data points including identity, device health,
behavioral patterns, time of access, and the sensitivity of the requested resource.
Policies are dynamic and adapt to context.

### Tenet 5: The Enterprise Monitors and Measures Security Posture of All Assets

The enterprise continuously monitors the security state of all devices and
applications. Devices that fail health checks are denied access or given reduced
permissions.

### Tenet 6: All Resource Authentication and Authorization Are Dynamic and Strictly Enforced

Authentication and authorization are performed before every access attempt.
Sessions are time-limited. Re-authentication is required when risk signals change.

### Tenet 7: The Enterprise Collects Information About the Current State of Assets

The enterprise collects data on network traffic, access requests, device posture,
and threat intelligence. This data feeds into policy decisions and continuous
improvement.

---

## 3. Core Components

### 3.1 Identity Verification

Identity is the new perimeter. Every access request must be tied to a verified identity
(human or machine).

```python
# Example: Identity verification middleware for a microservice
import jwt
from functools import wraps
from flask import request, jsonify

class IdentityVerifier:
    """Verify the identity of every request using JWT tokens."""

    def __init__(self, jwks_url: str, required_issuer: str, required_audience: str):
        self.jwks_url = jwks_url
        self.required_issuer = required_issuer
        self.required_audience = required_audience
        self._jwks_client = jwt.PyJWKClient(jwks_url, cache_jwk_set=True)

    def verify_token(self, token: str) -> dict:
        """Verify and decode a JWT token."""
        signing_key = self._jwks_client.get_signing_key_from_jwt(token)

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            issuer=self.required_issuer,
            audience=self.required_audience,
            options={
                "require": ["exp", "iss", "aud", "sub", "iat"],
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": True,
            }
        )

        return payload

    def require_identity(self, required_scopes: list = None):
        """Decorator to require identity verification on endpoints."""
        def decorator(f):
            @wraps(f)
            def decorated_function(*args, **kwargs):
                auth_header = request.headers.get('Authorization', '')
                if not auth_header.startswith('Bearer '):
                    return jsonify({"error": "Missing bearer token"}), 401

                token = auth_header[7:]
                try:
                    identity = self.verify_token(token)
                except jwt.ExpiredSignatureError:
                    return jsonify({"error": "Token expired"}), 401
                except jwt.InvalidTokenError as e:
                    return jsonify({"error": f"Invalid token: {str(e)}"}), 401

                # Check required scopes
                if required_scopes:
                    token_scopes = identity.get("scope", "").split()
                    if not all(s in token_scopes for s in required_scopes):
                        return jsonify({"error": "Insufficient scopes"}), 403

                request.identity = identity
                return f(*args, **kwargs)
            return decorated_function
        return decorator


# Usage
verifier = IdentityVerifier(
    jwks_url="https://idp.example.com/.well-known/jwks.json",
    required_issuer="https://idp.example.com",
    required_audience="https://api.example.com"
)

@app.route("/api/v1/orders")
@verifier.require_identity(required_scopes=["orders:read"])
def get_orders():
    user_id = request.identity["sub"]
    # Only return orders belonging to the authenticated user
    return jsonify(get_user_orders(user_id))
```

### 3.2 Device Verification

Every device accessing resources must be identified, inventoried, and assessed for
security posture.

```yaml
# Device trust evaluation signals
device_trust_signals:
  identity:
    - device_certificate_valid: true
    - device_registered_in_inventory: true
    - device_owner_identity_verified: true

  health:
    - os_up_to_date: true
    - antivirus_running: true
    - disk_encryption_enabled: true
    - firewall_enabled: true
    - screen_lock_configured: true

  compliance:
    - mdm_enrolled: true
    - security_policy_compliant: true
    - last_check_in_within_24h: true

  risk_signals:
    - known_compromised_device: false
    - anomalous_location: false
    - impossible_travel: false
```

```python
# Device posture check middleware
class DevicePostureChecker:
    """Evaluate device trust before granting access."""

    REQUIRED_SIGNALS = {
        "os_patched": True,
        "disk_encrypted": True,
        "firewall_enabled": True,
        "mdm_enrolled": True,
    }

    def evaluate_device(self, device_id: str, device_signals: dict) -> dict:
        """Evaluate device posture and return trust decision."""
        trust_score = 0
        max_score = len(self.REQUIRED_SIGNALS)
        failures = []

        for signal, required_value in self.REQUIRED_SIGNALS.items():
            actual_value = device_signals.get(signal)
            if actual_value == required_value:
                trust_score += 1
            else:
                failures.append(f"{signal}: expected {required_value}, got {actual_value}")

        trust_level = trust_score / max_score

        if trust_level == 1.0:
            access_level = "full"
        elif trust_level >= 0.75:
            access_level = "limited"
        else:
            access_level = "denied"

        return {
            "device_id": device_id,
            "trust_score": trust_level,
            "access_level": access_level,
            "failures": failures,
            "recommendation": "Remediate device" if access_level != "full" else "OK"
        }
```

### 3.3 Network Microsegmentation

Divide the network into small, isolated segments. Apply per-workload security policies.

```yaml
# Kubernetes microsegmentation with Cilium NetworkPolicy
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: payment-service-policy
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: payment-service
  ingress:
    - fromEndpoints:
        - matchLabels:
            app: order-service
      toPorts:
        - ports:
            - port: "8443"
              protocol: TCP
          rules:
            http:
              - method: POST
                path: "/api/v1/payments"
              - method: GET
                path: "/api/v1/payments/[a-f0-9-]+"
  egress:
    - toEndpoints:
        - matchLabels:
            app: payment-database
      toPorts:
        - ports:
            - port: "5432"
              protocol: TCP
    - toFQDNs:
        - matchName: "api.stripe.com"
      toPorts:
        - ports:
            - port: "443"
              protocol: TCP
```

### 3.4 Least-Privilege Access

Grant the minimum level of access required for the specific task and time period.

```json
// AWS IAM policy with time-bound access
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TimeBoundAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::project-data/team-a/*",
      "Condition": {
        "DateGreaterThan": {"aws:CurrentTime": "2026-03-10T09:00:00Z"},
        "DateLessThan": {"aws:CurrentTime": "2026-03-10T18:00:00Z"},
        "IpAddress": {"aws:SourceIp": "203.0.113.0/24"},
        "Bool": {"aws:MultiFactorAuthPresent": "true"}
      }
    }
  ]
}
```

### 3.5 Continuous Monitoring

Monitor all access attempts, device posture changes, and anomalous behavior in real
time.

```python
# Continuous monitoring and adaptive access control
from datetime import datetime, timezone
from dataclasses import dataclass
from enum import Enum

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class AccessContext:
    user_id: str
    device_id: str
    source_ip: str
    resource: str
    action: str
    timestamp: datetime
    mfa_verified: bool
    device_trust_score: float
    geo_location: str
    user_agent: str

class ContinuousMonitor:
    """Evaluate risk signals continuously and adjust access."""

    def evaluate_risk(self, context: AccessContext) -> RiskLevel:
        """Calculate risk level based on multiple signals."""
        risk_score = 0

        # Factor 1: Device trust
        if context.device_trust_score < 0.5:
            risk_score += 40
        elif context.device_trust_score < 0.75:
            risk_score += 20
        elif context.device_trust_score < 1.0:
            risk_score += 10

        # Factor 2: MFA status
        if not context.mfa_verified:
            risk_score += 30

        # Factor 3: Anomalous access time
        hour = context.timestamp.hour
        if hour < 6 or hour > 22:
            risk_score += 15

        # Factor 4: Impossible travel (simplified)
        if self._detect_impossible_travel(context.user_id, context.geo_location):
            risk_score += 50

        # Factor 5: Sensitive resource
        if self._is_sensitive_resource(context.resource):
            risk_score += 10

        # Factor 6: Known threat IP
        if self._is_known_threat_ip(context.source_ip):
            risk_score += 60

        # Map score to risk level
        if risk_score >= 70:
            return RiskLevel.CRITICAL
        elif risk_score >= 50:
            return RiskLevel.HIGH
        elif risk_score >= 25:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def determine_action(self, risk: RiskLevel) -> str:
        """Determine access action based on risk level."""
        actions = {
            RiskLevel.LOW: "allow",
            RiskLevel.MEDIUM: "allow_with_logging",
            RiskLevel.HIGH: "require_step_up_auth",
            RiskLevel.CRITICAL: "deny_and_alert",
        }
        return actions[risk]

    def _detect_impossible_travel(self, user_id: str, geo: str) -> bool:
        # Check if user's location changed impossibly fast
        # Implementation depends on location tracking system
        pass

    def _is_sensitive_resource(self, resource: str) -> bool:
        sensitive_patterns = ["/admin", "/api/internal", "/payments", "/secrets"]
        return any(p in resource for p in sensitive_patterns)

    def _is_known_threat_ip(self, ip: str) -> bool:
        # Check against threat intelligence feeds
        pass
```

---

## 4. BeyondCorp Model (Google)

Google's BeyondCorp is the most widely referenced Zero Trust implementation. It
eliminates the distinction between internal and external networks.

### 4.1 Key BeyondCorp Principles

- Access depends solely on device state, user credentials, and request context
- All access to enterprise resources is fully authenticated, fully authorized, and
  fully encrypted
- Access is granted on a per-request basis after evaluating trust
- The corporate network does not imply any level of trust
- All devices are tracked in an inventory database

### 4.2 BeyondCorp Architecture Components

```
[User + Device]
      |
      | (1) Authenticate with IdP (OIDC/SAML)
      v
[Identity Provider]
      |
      | (2) Issue identity token with device attestation
      v
[Identity-Aware Proxy]
      |
      | (3) Evaluate access policy (identity + device + context)
      |
      | (4) If allowed, proxy request to backend
      v
[Backend Service]
```

---

## 5. Identity-Aware Proxies

Identity-Aware Proxies (IAP) authenticate and authorize every request before it reaches
the backend application. The application does not need to implement its own
authentication.

### 5.1 Google Cloud IAP

```hcl
# Terraform - Enable Google Cloud IAP for an App Engine application
resource "google_iap_web_iam_member" "app_access" {
  project = var.project_id
  role    = "roles/iap.httpsResourceAccessor"
  member  = "group:developers@example.com"

  condition {
    title       = "require_corp_device"
    description = "Require corporate managed device"
    expression  = "device.is_corp_owned == true && device.encryption_status == DeviceEncryptionStatus.ENCRYPTED"
  }
}

resource "google_iap_web_iam_member" "admin_access" {
  project = var.project_id
  role    = "roles/iap.httpsResourceAccessor"
  member  = "group:admins@example.com"

  condition {
    title       = "admin_access_conditions"
    description = "Admin access requires managed device and verified cert"
    expression  = "device.is_corp_owned == true && device.verified_chrome_os == true"
  }
}

# Backend service IAP configuration
resource "google_iap_web_backend_service_iam_binding" "binding" {
  project             = var.project_id
  web_backend_service = google_compute_backend_service.app.name
  role                = "roles/iap.httpsResourceAccessor"

  members = [
    "group:developers@example.com",
  ]
}
```

### 5.2 OAuth2 Proxy as Identity-Aware Proxy

```yaml
# Kubernetes deployment of OAuth2 Proxy for identity-aware access
apiVersion: apps/v1
kind: Deployment
metadata:
  name: oauth2-proxy
  namespace: auth
spec:
  replicas: 2
  selector:
    matchLabels:
      app: oauth2-proxy
  template:
    metadata:
      labels:
        app: oauth2-proxy
    spec:
      containers:
        - name: oauth2-proxy
          image: quay.io/oauth2-proxy/oauth2-proxy:v7.6.0
          args:
            - --provider=oidc
            - --oidc-issuer-url=https://idp.example.com
            - --client-id=$(CLIENT_ID)
            - --client-secret=$(CLIENT_SECRET)
            - --email-domain=example.com
            - --upstream=http://backend-service.production.svc:8080
            - --http-address=0.0.0.0:4180
            - --cookie-secure=true
            - --cookie-httponly=true
            - --cookie-samesite=lax
            - --cookie-expire=1h
            - --cookie-refresh=30m
            - --pass-access-token=true
            - --pass-user-headers=true
            - --set-xauthrequest=true
            - --reverse-proxy=true
            - --skip-provider-button=true
          envFrom:
            - secretRef:
                name: oauth2-proxy-secrets
          ports:
            - containerPort: 4180
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 200m
              memory: 256Mi
```

---

## 6. Software-Defined Perimeter (SDP)

SDP creates invisible infrastructure by default-denying all connections. Resources are
accessible only after authentication and authorization through a controller.

### 6.1 SDP Architecture

```
                    (1) Authenticate
[Client] -----------------------------------------> [SDP Controller]
                                                          |
                    (2) Issue single-packet authorization  |
[Client] <------------------------------------------------|
    |
    | (3) SPA knock (single packet with crypto token)
    v
[SDP Gateway] --- verifies SPA ---> opens port for client
    |
    | (4) Mutually authenticated TLS tunnel
    v
[Protected Service]
```

### 6.2 ZTNA vs Traditional VPN

```
+---------------------------+---------------------+----------------------------+
| Feature                   | Traditional VPN     | ZTNA                       |
+---------------------------+---------------------+----------------------------+
| Network Access            | Full subnet access  | Per-application access     |
| Authentication            | One-time at connect | Continuous per request     |
| Device Posture            | Optional check      | Required for every session |
| Lateral Movement          | Possible            | Prevented by design        |
| Visibility                | Limited             | Full request-level logging |
| Scalability               | VPN concentrator    | Cloud-native, distributed  |
| User Experience           | All traffic tunneled| Only app traffic proxied   |
| Attack Surface            | VPN server exposed  | No inbound ports           |
+---------------------------+---------------------+----------------------------+
```

---

## 7. Zero Trust for APIs

Every API request must be authenticated and authorized, regardless of whether it
originates from within the network.

```typescript
// TypeScript - Zero Trust API middleware
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

interface ZeroTrustConfig {
  jwksUri: string;
  issuer: string;
  audience: string;
  requiredClaims: string[];
}

class ZeroTrustAPIGateway {
  private jwksClient: jwksClient.JwksClient;
  private config: ZeroTrustConfig;

  constructor(config: ZeroTrustConfig) {
    this.config = config;
    this.jwksClient = jwksClient({
      jwksUri: config.jwksUri,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  /**
   * Middleware: Verify identity on every request.
   */
  verifyIdentity() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'authentication_required',
          message: 'Bearer token is required',
        });
      }

      const token = authHeader.slice(7);

      try {
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded) {
          return res.status(401).json({ error: 'invalid_token' });
        }

        const key = await this.jwksClient.getSigningKey(decoded.header.kid);
        const verified = jwt.verify(token, key.getPublicKey(), {
          issuer: this.config.issuer,
          audience: this.config.audience,
          algorithms: ['RS256', 'ES256'],
          clockTolerance: 30,
        });

        // Attach verified identity to request
        (req as any).identity = verified;
        next();
      } catch (err) {
        return res.status(401).json({
          error: 'token_verification_failed',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };
  }

  /**
   * Middleware: Enforce authorization based on scopes and resource ownership.
   */
  authorize(requiredScopes: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const identity = (req as any).identity;
      if (!identity) {
        return res.status(401).json({ error: 'identity_not_verified' });
      }

      const tokenScopes: string[] = (identity.scope || '').split(' ');
      const hasRequiredScopes = requiredScopes.every(
        (scope) => tokenScopes.includes(scope)
      );

      if (!hasRequiredScopes) {
        return res.status(403).json({
          error: 'insufficient_scope',
          required: requiredScopes,
          provided: tokenScopes,
        });
      }

      next();
    };
  }

  /**
   * Middleware: Rate limit per identity to prevent abuse.
   */
  rateLimitPerIdentity(maxRequests: number, windowSeconds: number) {
    const requestCounts = new Map<string, { count: number; resetAt: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const identity = (req as any).identity;
      const clientId = identity?.sub || req.ip;
      const now = Date.now();

      const record = requestCounts.get(clientId);
      if (!record || now > record.resetAt) {
        requestCounts.set(clientId, {
          count: 1,
          resetAt: now + windowSeconds * 1000,
        });
        return next();
      }

      record.count++;
      if (record.count > maxRequests) {
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          retryAfter: Math.ceil((record.resetAt - now) / 1000),
        });
      }

      next();
    };
  }
}

// Usage
const zt = new ZeroTrustAPIGateway({
  jwksUri: 'https://idp.example.com/.well-known/jwks.json',
  issuer: 'https://idp.example.com',
  audience: 'https://api.example.com',
  requiredClaims: ['sub', 'scope', 'email'],
});

app.use(zt.verifyIdentity());
app.use(zt.rateLimitPerIdentity(100, 60));

app.get('/api/v1/orders',
  zt.authorize(['orders:read']),
  getOrdersHandler
);

app.post('/api/v1/payments',
  zt.authorize(['payments:write']),
  createPaymentHandler
);
```

---

## 8. Zero Trust for Microservices

### 8.1 mTLS Between Services

```yaml
# Istio PeerAuthentication - require mTLS for all meshed services
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT

---
# Istio RequestAuthentication - verify JWT at each service
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
  name: require-jwt
  namespace: production
spec:
  jwtRules:
    - issuer: "https://idp.example.com"
      jwksUri: "https://idp.example.com/.well-known/jwks.json"
      audiences:
        - "https://api.example.com"
      forwardOriginalToken: true
      outputPayloadToHeader: "x-jwt-payload"

---
# Istio AuthorizationPolicy - fine-grained access control per service
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: order-service-auth
  namespace: production
spec:
  selector:
    matchLabels:
      app: order-service
  action: ALLOW
  rules:
    # Allow API gateway to call order service
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/api-gateway"]
      to:
        - operation:
            methods: ["GET", "POST"]
            paths: ["/api/v1/orders*"]
      when:
        - key: request.auth.claims[scope]
          values: ["orders:read", "orders:write"]
    # Allow notification service to read orders
    - from:
        - source:
            principals: ["cluster.local/ns/production/sa/notification-service"]
      to:
        - operation:
            methods: ["GET"]
            paths: ["/api/v1/orders/*"]
```

### 8.2 JWT Validation at Each Service

```go
// Go - JWT validation middleware for microservices (Zero Trust)
package middleware

import (
    "context"
    "fmt"
    "net/http"
    "strings"

    "github.com/golang-jwt/jwt/v5"
    "github.com/lestrrat-go/jwx/v2/jwk"
)

type ZeroTrustMiddleware struct {
    keySet      jwk.Set
    issuer      string
    audience    string
}

func NewZeroTrustMiddleware(jwksURL, issuer, audience string) (*ZeroTrustMiddleware, error) {
    keySet, err := jwk.Fetch(context.Background(), jwksURL)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
    }

    return &ZeroTrustMiddleware{
        keySet:   keySet,
        issuer:   issuer,
        audience: audience,
    }, nil
}

func (ztm *ZeroTrustMiddleware) Authenticate(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Extract token
        authHeader := r.Header.Get("Authorization")
        if !strings.HasPrefix(authHeader, "Bearer ") {
            http.Error(w, "missing bearer token", http.StatusUnauthorized)
            return
        }
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")

        // Parse and validate token
        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            kid, ok := token.Header["kid"].(string)
            if !ok {
                return nil, fmt.Errorf("missing kid in token header")
            }

            key, found := ztm.keySet.LookupKeyID(kid)
            if !found {
                return nil, fmt.Errorf("unknown kid: %s", kid)
            }

            var rawKey interface{}
            if err := key.Raw(&rawKey); err != nil {
                return nil, fmt.Errorf("failed to extract key: %w", err)
            }

            return rawKey, nil
        },
            jwt.WithIssuer(ztm.issuer),
            jwt.WithAudience(ztm.audience),
            jwt.WithValidMethods([]string{"RS256", "ES256"}),
        )

        if err != nil || !token.Valid {
            http.Error(w, "invalid token", http.StatusUnauthorized)
            return
        }

        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            http.Error(w, "invalid claims", http.StatusUnauthorized)
            return
        }

        // Attach identity to context
        ctx := context.WithValue(r.Context(), "identity", claims)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func (ztm *ZeroTrustMiddleware) RequireScope(scope string, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        claims, ok := r.Context().Value("identity").(jwt.MapClaims)
        if !ok {
            http.Error(w, "identity not found", http.StatusUnauthorized)
            return
        }

        tokenScopes := strings.Split(fmt.Sprintf("%v", claims["scope"]), " ")
        for _, s := range tokenScopes {
            if s == scope {
                next.ServeHTTP(w, r)
                return
            }
        }

        http.Error(w, "insufficient scope", http.StatusForbidden)
    })
}
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Months 1-3)

- Deploy centralized identity provider (Okta, Entra ID, Google Workspace)
- Enforce MFA for all users
- Inventory all assets and resources
- Enable comprehensive logging and monitoring
- Identify and classify all applications and data

### Phase 2: Identity-Centric Access (Months 3-6)

- Replace VPN with ZTNA for remote access
- Deploy identity-aware proxy for web applications
- Implement SSO for all applications
- Begin device trust evaluation
- Implement conditional access policies

### Phase 3: Microsegmentation (Months 6-9)

- Deploy service mesh with mTLS for microservices
- Implement Kubernetes NetworkPolicies (default-deny)
- Segment network by workload sensitivity
- Deploy per-service authorization policies
- Implement API gateway with Zero Trust principles

### Phase 4: Continuous Verification (Months 9-12)

- Implement continuous device posture assessment
- Deploy anomaly detection and behavioral analytics
- Implement adaptive access policies based on risk signals
- Automate incident response for high-risk events
- Conduct red team exercises against Zero Trust controls

### Phase 5: Optimization (Ongoing)

- Refine policies based on monitoring data
- Reduce false positives in anomaly detection
- Extend Zero Trust to OT/IoT devices
- Integrate threat intelligence feeds
- Measure and report Zero Trust maturity

---

## 10. Zero Trust Tools

### 10.1 Cloudflare Access

```yaml
# Cloudflare Access policy configuration (Terraform)
resource "cloudflare_access_application" "internal_app" {
  zone_id          = var.zone_id
  name             = "Internal Dashboard"
  domain           = "dashboard.example.com"
  type             = "self_hosted"
  session_duration = "1h"

  auto_redirect_to_identity = true
}

resource "cloudflare_access_policy" "require_corp_identity" {
  application_id = cloudflare_access_application.internal_app.id
  zone_id        = var.zone_id
  name           = "Require corporate identity"
  precedence     = 1
  decision       = "allow"

  include {
    email_domain = ["example.com"]
  }

  require {
    device_posture = [cloudflare_device_posture_rule.corp_device.id]
  }
}

resource "cloudflare_device_posture_rule" "corp_device" {
  account_id  = var.account_id
  name        = "Corporate Device"
  type        = "serial_number"
  description = "Device must be in corporate inventory"

  match {
    platform = "mac"
  }
}
```

### 10.2 Tailscale

```bash
# Tailscale ACL policy - define access based on identity, not network
{
  "acls": [
    // Developers can access dev and staging environments
    {
      "action": "accept",
      "src": ["group:developers"],
      "dst": [
        "tag:dev:*",
        "tag:staging:*"
      ]
    },
    // SRE team can access all environments
    {
      "action": "accept",
      "src": ["group:sre"],
      "dst": [
        "tag:dev:*",
        "tag:staging:*",
        "tag:production:*"
      ]
    },
    // CI/CD runners can access staging and production for deployment
    {
      "action": "accept",
      "src": ["tag:cicd"],
      "dst": [
        "tag:staging:443",
        "tag:production:443"
      ]
    }
  ],
  "groups": {
    "group:developers": ["user1@example.com", "user2@example.com"],
    "group:sre": ["sre1@example.com", "sre2@example.com"]
  },
  "tagOwners": {
    "tag:dev": ["group:developers"],
    "tag:staging": ["group:sre"],
    "tag:production": ["group:sre"],
    "tag:cicd": ["group:sre"]
  }
}
```

### 10.3 OPA (Open Policy Agent) for Zero Trust Policy

```rego
# OPA Rego policy for Zero Trust access decisions
package zerotrust.access

import future.keywords.in

default allow := false

# Allow access only when all conditions are met
allow {
    identity_verified
    device_trusted
    scope_sufficient
    not high_risk
}

# Identity must be verified with valid token
identity_verified {
    input.identity.verified == true
    input.identity.issuer == "https://idp.example.com"
    time.now_ns() < input.identity.exp * 1000000000
}

# Device must meet trust requirements
device_trusted {
    input.device.trust_score >= 0.8
    input.device.os_patched == true
    input.device.disk_encrypted == true
}

# Token must have required scopes
scope_sufficient {
    required := data.policies[input.resource].required_scopes
    provided := split(input.identity.scope, " ")
    every s in required {
        s in provided
    }
}

# Block high-risk requests
high_risk {
    input.risk.impossible_travel == true
}

high_risk {
    input.risk.known_compromised_device == true
}

high_risk {
    input.risk.source_ip_threat_score > 0.9
}

# Step-up authentication required for sensitive resources
step_up_required {
    data.policies[input.resource].sensitivity == "high"
    not input.identity.mfa_method in {"webauthn", "hardware_key"}
}
```

---

## 11. Best Practices

1. **Start with identity as the foundation** -- implement a centralized identity
   provider with MFA before anything else; identity verification is the cornerstone
   of Zero Trust.

2. **Verify every request, not just the first** -- do not rely on session cookies or
   VPN connections as proof of trust; validate identity, authorization, and device
   posture on every API call.

3. **Implement least-privilege access with time bounds** -- grant access to specific
   resources for limited durations; use just-in-time (JIT) access provisioning for
   sensitive systems.

4. **Encrypt all traffic with mTLS** -- use mutual TLS for all service-to-service
   communication; deploy a service mesh (Istio, Linkerd) to automate certificate
   management and rotation.

5. **Monitor continuously and adapt policies** -- collect and analyze access logs,
   device posture signals, and behavioral patterns; use adaptive policies that increase
   security requirements when risk signals are elevated.

6. **Replace VPNs with ZTNA** -- traditional VPNs grant broad network access; ZTNA
   provides per-application access based on identity and device posture with no
   inbound ports exposed.

7. **Implement microsegmentation everywhere** -- apply network policies at the workload
   level, not just the subnet level; default-deny all traffic and explicitly allow
   required communication paths.

8. **Deploy identity-aware proxies** -- place identity-aware proxies in front of all
   applications to centralize authentication and authorization; the application receives
   verified identity headers.

9. **Maintain a comprehensive asset inventory** -- track all devices, users, services,
   and data stores; unmanaged assets cannot be protected and represent shadow IT risk.

10. **Take a phased approach** -- do not attempt to implement Zero Trust everywhere at
    once; prioritize high-value assets and sensitive data; iterate based on monitoring
    data and lessons learned.

---

## 12. Anti-Patterns

1. **Treating Zero Trust as a product to purchase** -- Zero Trust is an architecture
   and strategy, not a single product; no vendor solution implements all aspects of
   Zero Trust; it requires organizational commitment and cultural change.

2. **Implementing Zero Trust without an identity foundation** -- attempting network
   microsegmentation or ZTNA without a robust identity provider and MFA creates
   complexity without meaningful security improvement.

3. **Replacing VPN with ZTNA but keeping flat networks** -- ZTNA for remote access is
   only one component; internal networks still need microsegmentation, mTLS, and
   per-request authorization.

4. **Trusting traffic because it has a valid certificate** -- mTLS verifies identity,
   not authorization; a valid certificate confirms who is calling but not whether the
   call is permitted; always enforce authorization policies.

5. **Granting permanent access to resources** -- Zero Trust requires time-bound access;
   standing privileges create risk if credentials are compromised; use JIT access
   provisioning.

6. **Ignoring device posture in access decisions** -- identity alone is insufficient;
   a verified user on a compromised device is still a threat; assess device health
   as part of every access decision.

7. **Implementing Zero Trust without logging and monitoring** -- without visibility
   into access patterns, anomalies cannot be detected and policies cannot be tuned;
   comprehensive logging is a prerequisite.

8. **Exempting legacy systems from Zero Trust controls** -- legacy systems are often
   the most vulnerable; place identity-aware proxies in front of legacy applications
   rather than exempting them from Zero Trust policies.

---

## 13. Enforcement Checklist

### Identity Foundation
- [ ] Centralized identity provider (IdP) deployed for all users and services
- [ ] MFA enforced for all human users (hardware keys for privileged accounts)
- [ ] SSO configured for all applications
- [ ] Machine identities managed through certificates or workload identity
- [ ] Service accounts use short-lived credentials (no static secrets)
- [ ] Access reviews conducted quarterly to remove unused permissions

### Device Trust
- [ ] Device inventory tracks all endpoints accessing resources
- [ ] Device posture assessment checks OS patches, encryption, firewall, MDM
- [ ] Unmanaged devices receive restricted access or are denied
- [ ] Device trust is evaluated on every access request, not just initial connection

### Network Controls
- [ ] Default-deny network policies applied at the workload level
- [ ] mTLS enforced for all service-to-service communication
- [ ] VPN replaced with ZTNA for remote access
- [ ] No implicit trust based on network location
- [ ] Private endpoints used for cloud service access

### Application Access
- [ ] Identity-aware proxy deployed in front of all web applications
- [ ] API authentication and authorization enforced on every request
- [ ] Authorization policies use scopes and claims, not just identity
- [ ] Session duration is limited (maximum 1 hour for sensitive resources)
- [ ] Step-up authentication required for high-risk operations

### Monitoring and Response
- [ ] All access requests are logged with full context
- [ ] Anomaly detection is active (impossible travel, unusual times, new devices)
- [ ] Adaptive policies adjust access based on real-time risk signals
- [ ] Security team reviews Zero Trust policy violations within defined SLA
- [ ] Red team exercises test Zero Trust controls annually

### Maturity Assessment
- [ ] CISA Zero Trust Maturity Model assessment completed
- [ ] Phase 1 (foundation) items are fully implemented
- [ ] Phase 2 (identity-centric) items are fully implemented
- [ ] Continuous improvement process is established with measurable metrics
- [ ] Executive sponsorship and organizational buy-in are maintained
