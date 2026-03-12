# SAML Security Guide

## Metadata
- **Category**: Authentication and Identity
- **Priority**: High
- **Last Updated**: 2025-01-15
- **Standards**: SAML 2.0, OASIS Security Assertion Markup Language
- **Applicable Languages**: TypeScript, Python, Java

---

## Table of Contents

1. [Overview](#overview)
2. [SAML 2.0 Flow](#saml-20-flow)
3. [SAML Assertion Structure](#saml-assertion-structure)
4. [XML Signature Validation](#xml-signature-validation)
5. [Signature Wrapping Attacks (XSW)](#signature-wrapping-attacks)
6. [XML Signature Exclusion Attacks](#xml-signature-exclusion-attacks)
7. [Assertion Consumer Service URL Validation](#assertion-consumer-service-url-validation)
8. [Audience Restriction Validation](#audience-restriction-validation)
9. [Time Validation](#time-validation)
10. [Replay Prevention](#replay-prevention)
11. [SAML vs OAuth2/OIDC](#saml-vs-oauth2-oidc)
12. [Common SAML Vulnerabilities](#common-saml-vulnerabilities)
13. [Secure Library Configuration](#secure-library-configuration)
14. [Implementation Examples](#implementation-examples)
15. [Best Practices](#best-practices)
16. [Anti-Patterns](#anti-patterns)
17. [Enforcement Checklist](#enforcement-checklist)

---

## Overview

Security Assertion Markup Language (SAML) 2.0 is an XML-based framework for exchanging
authentication and authorization data between an Identity Provider (IdP) and a Service
Provider (SP). Despite being older than OAuth 2.0 and OpenID Connect, SAML remains
dominant in enterprise Single Sign-On (SSO) deployments. Major identity providers
(Okta, Azure AD, Ping Identity, ADFS) all support SAML 2.0.

SAML security is challenging because it relies on XML digital signatures, which have a
long history of implementation vulnerabilities. XML Signature Wrapping (XSW) attacks,
XXE injection, and assertion replay are among the most critical attack vectors. This
guide provides comprehensive coverage of these threats and their mitigations.

### Key Roles

| Role                | Abbreviation | Description                                  |
|---------------------|-------------|----------------------------------------------|
| Identity Provider   | IdP         | Authenticates users and issues SAML assertions|
| Service Provider    | SP          | Relies on IdP assertions to grant access     |
| Principal           | User        | The person being authenticated               |

### SAML Terminology

| Term                         | Description                                         |
|------------------------------|-----------------------------------------------------|
| Assertion                    | XML document containing authentication claims       |
| Assertion Consumer Service   | SP endpoint that receives SAML responses             |
| Single Sign-On Service       | IdP endpoint that initiates authentication           |
| Metadata                     | XML document describing IdP or SP configuration      |
| Binding                      | Protocol for transmitting SAML messages (POST, Redirect) |
| RelayState                   | Opaque value to preserve SP state across SSO flow    |

---

## SAML 2.0 Flow

### SP-Initiated SSO (Recommended)

SP-initiated SSO is the preferred flow because the SP controls the initiation and
can enforce state validation.

```
1. User visits SP application (https://app.example.com)
2. SP detects no session, generates AuthnRequest
3. SP redirects user to IdP SSO URL with AuthnRequest
4. IdP authenticates user (credentials, MFA)
5. IdP generates SAML Response with Assertion
6. IdP sends Response to SP's Assertion Consumer Service (ACS) via POST
7. SP validates Response, Assertion, and Signature
8. SP creates local session for the user
9. User is redirected to the original requested resource
```

**AuthnRequest (SP to IdP):**

```xml
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="_abc123-request-id"
  Version="2.0"
  IssueInstant="2025-01-15T10:00:00Z"
  Destination="https://idp.example.com/sso/saml"
  AssertionConsumerServiceURL="https://app.example.com/saml/acs"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>https://app.example.com</saml:Issuer>
  <samlp:NameIDPolicy
    Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    AllowCreate="false"/>
</samlp:AuthnRequest>
```

### IdP-Initiated SSO (Higher Risk)

In IdP-initiated SSO, the IdP sends a SAML response to the SP without a corresponding
AuthnRequest. This flow is inherently riskier because:

1. No AuthnRequest means no `InResponseTo` validation, weakening replay protection.
2. No `RelayState` from the SP means the SP cannot verify the SSO flow was expected.
3. The SP receives an unsolicited assertion, which opens the door to injection attacks.

**Risk mitigation for IdP-initiated SSO:**
- Validate the assertion signature rigorously.
- Enforce strict time windows (NotBefore/NotOnOrAfter).
- Cache assertion IDs for replay detection (minimum 2 hours).
- Validate the `Destination` attribute matches the ACS URL.
- If possible, disable IdP-initiated SSO entirely and use SP-initiated only.

---

## SAML Assertion Structure

A SAML Response contains one or more Assertions. Each Assertion contains:

```xml
<saml:Assertion
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="_assertion-id-xyz789"
  Version="2.0"
  IssueInstant="2025-01-15T10:00:30Z">

  <!-- Who issued this assertion -->
  <saml:Issuer>https://idp.example.com</saml:Issuer>

  <!-- Digital signature over the assertion -->
  <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
    <!-- ... signature details ... -->
  </ds:Signature>

  <!-- Who is the subject (authenticated user) -->
  <saml:Subject>
    <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
      user@example.com
    </saml:NameID>
    <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
      <saml:SubjectConfirmationData
        InResponseTo="_abc123-request-id"
        NotOnOrAfter="2025-01-15T10:05:30Z"
        Recipient="https://app.example.com/saml/acs"/>
    </saml:SubjectConfirmation>
  </saml:Subject>

  <!-- Validity conditions -->
  <saml:Conditions
    NotBefore="2025-01-15T09:59:30Z"
    NotOnOrAfter="2025-01-15T10:05:30Z">
    <saml:AudienceRestriction>
      <saml:Audience>https://app.example.com</saml:Audience>
    </saml:AudienceRestriction>
  </saml:Conditions>

  <!-- Authentication details -->
  <saml:AuthnStatement
    AuthnInstant="2025-01-15T10:00:25Z"
    SessionNotOnOrAfter="2025-01-15T18:00:00Z"
    SessionIndex="_session-index-123">
    <saml:AuthnContext>
      <saml:AuthnContextClassRef>
        urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport
      </saml:AuthnContextClassRef>
    </saml:AuthnContext>
  </saml:AuthnStatement>

  <!-- User attributes -->
  <saml:AttributeStatement>
    <saml:Attribute Name="email"
      NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">
      <saml:AttributeValue>user@example.com</saml:AttributeValue>
    </saml:Attribute>
    <saml:Attribute Name="firstName">
      <saml:AttributeValue>John</saml:AttributeValue>
    </saml:Attribute>
    <saml:Attribute Name="lastName">
      <saml:AttributeValue>Doe</saml:AttributeValue>
    </saml:Attribute>
    <saml:Attribute Name="groups">
      <saml:AttributeValue>engineering</saml:AttributeValue>
      <saml:AttributeValue>admin</saml:AttributeValue>
    </saml:Attribute>
  </saml:AttributeStatement>
</saml:Assertion>
```

### Subject

The Subject identifies the authenticated user. The `NameID` element contains the
user's identifier (email, persistent ID, or transient ID). The `SubjectConfirmation`
with `bearer` method indicates that whoever presents this assertion is the subject.

### Conditions

The Conditions element defines the validity constraints:
- `NotBefore`: Earliest time the assertion is valid.
- `NotOnOrAfter`: Latest time the assertion is valid.
- `AudienceRestriction`: Which SP(s) the assertion is intended for.

### AuthnStatement

The AuthnStatement confirms that the user was authenticated and specifies the
authentication method (password, MFA, certificate, etc.).

### AttributeStatement

The AttributeStatement contains user attributes sent by the IdP: email, name,
groups, roles, or any custom attributes.

---

## XML Signature Validation

XML Digital Signatures in SAML are among the most complex and error-prone aspects
of the protocol. The signature can cover the entire Response, individual Assertions,
or both.

### Signature Verification Process

1. **Canonicalize the signed XML** using the specified canonicalization method
   (typically Exclusive XML Canonicalization 1.0).
2. **Compute the digest** of the canonicalized signed element.
3. **Verify the digest** matches the `DigestValue` in the `Reference` element.
4. **Verify the signature** over the `SignedInfo` element using the IdP's public key.
5. **Verify that the signed element is the element being processed.** This is the
   critical step that prevents signature wrapping attacks.

### What to Verify

| Check                           | Description                                          |
|----------------------------------|------------------------------------------------------|
| Signature algorithm             | Must use RSA-SHA256 or stronger (reject SHA-1)       |
| Digest algorithm                | Must use SHA-256 or stronger                         |
| Reference URI                   | Must point to the correct element (Response or Assertion ID) |
| Certificate/key trust           | Must match the IdP's known signing certificate        |
| Signed element identity         | The element processed must be the element that was signed |

### Certificate Pinning vs. Metadata Trust

**Certificate pinning:** Configure the SP with the IdP's exact signing certificate.
Reject any assertion not signed with this exact certificate. This is the most secure
approach but requires manual certificate rotation.

**Metadata-based trust:** Download the IdP's metadata document, which contains the
signing certificate. Validate against the metadata certificate. This allows for
automated certificate rotation but requires secure metadata fetching (HTTPS with
certificate validation).

---

## Signature Wrapping Attacks (XSW)

Signature Wrapping (XSW) attacks are the most critical class of SAML vulnerabilities.
They exploit the disconnect between which XML element is signed and which element the
application processes.

### Attack Mechanism

In a valid SAML Response, the signature covers a specific element identified by its
`ID` attribute. The `Reference` in the signature points to this element via a URI
fragment (`#_assertion-id`).

In an XSW attack, the attacker:
1. Copies the signed assertion to a different location in the XML tree.
2. Creates a new, forged assertion with the attacker's claims.
3. Places the forged assertion where the application expects to find it.
4. The signature validates because it still covers the original (now relocated) assertion.
5. The application processes the forged assertion because it is in the expected location.

### XSW Variants

There are at least 8 known XSW variants (XSW1 through XSW8), each using different
placement strategies for the original and forged elements.

**XSW1:** Move the signed Response to a new `Extensions` element. Place a forged
Response as the root element.

**XSW2:** Insert a forged Assertion before the signed Assertion in the Response.

**XSW3:** Insert a forged Assertion as a child of the signed Assertion.

**XSW4:** Move the signed Assertion into a new wrapping element. Place a forged
Assertion in the original location.

### Prevention

1. **After signature validation, use only the signed element for processing.**
   Do not use XPath or DOM traversal to find the Assertion independently from the
   signature verification result.

2. **Verify that the signed element's ID matches the expected Assertion ID.**
   After verification, confirm that the `Reference URI` in the signature points to
   the Assertion you are about to process.

3. **Use a SAML library that is known to be resistant to XSW attacks.**
   Maintain the library at its latest version.

4. **Validate the structure of the SAML Response.** Reject responses that contain
   unexpected elements, duplicate Assertions, or Assertions nested within other
   Assertions.

```python
def validate_no_wrapping(xml_doc, signed_assertion_id: str) -> bool:
    """Validate that the SAML response has not been tampered with via XSW."""
    # Count assertions in the response
    assertions = xml_doc.findall(
        ".//{urn:oasis:names:tc:SAML:2.0:assertion}Assertion"
    )

    # There should be exactly one assertion
    if len(assertions) != 1:
        raise SecurityError(
            f"Expected 1 assertion, found {len(assertions)}. "
            "Possible signature wrapping attack."
        )

    # The assertion's ID must match the signed reference
    assertion = assertions[0]
    if assertion.get("ID") != signed_assertion_id:
        raise SecurityError(
            "Assertion ID does not match signed reference. "
            "Possible signature wrapping attack."
        )

    return True
```

---

## XML Signature Exclusion Attacks

In a signature exclusion attack, the attacker removes the signature from the SAML
Response entirely. If the SP does not require and validate signatures, it processes
the assertion as valid.

### Prevention

1. **Always require signatures.** Configure the SP to reject any SAML Response
   or Assertion that is not signed.

2. **Require signature on the Assertion, not just the Response.** Some IdPs sign
   only the outer Response. If the Assertion within is not signed, its contents can
   be modified without invalidating the Response signature (depending on
   canonicalization). Require both Response and Assertion signatures, or at minimum,
   require an Assertion signature.

3. **Reject unsigned assertions regardless of the Response signature.** The safest
   policy is to reject any Assertion that does not have its own digital signature.

```typescript
function validateSignaturePresence(samlResponse: SAMLResponse): void {
  // Check that at least the Assertion is signed
  const assertionSigned = samlResponse.assertion?.signature !== undefined;
  const responseSigned = samlResponse.signature !== undefined;

  if (!assertionSigned) {
    throw new SecurityError(
      "SAML Assertion is not signed. Unsigned assertions are not accepted."
    );
  }

  // Optionally require both
  if (!responseSigned) {
    console.warn(
      "SAML Response is not signed (Assertion is signed). " +
      "Consider requiring Response signature as well."
    );
  }
}
```

---

## Assertion Consumer Service URL Validation

The Assertion Consumer Service (ACS) URL is the SP endpoint that receives SAML
Responses. Validating the ACS URL prevents open redirect and assertion injection attacks.

### Validation Rules

1. **Validate the `Destination` attribute** in the SAML Response matches the SP's
   configured ACS URL exactly.

2. **Validate the `Recipient` attribute** in the `SubjectConfirmationData` matches
   the SP's ACS URL.

3. **Use exact string matching.** No partial matching, no wildcard matching.

4. **Register the ACS URL in the IdP metadata.** The IdP should validate that the
   Response is being sent to a registered ACS URL.

```python
def validate_acs_url(response_destination: str, subject_recipient: str,
                      expected_acs_url: str) -> None:
    """Validate ACS URL in both Response Destination and Subject Recipient."""
    if response_destination != expected_acs_url:
        raise SecurityError(
            f"Response Destination '{response_destination}' does not match "
            f"expected ACS URL '{expected_acs_url}'."
        )

    if subject_recipient != expected_acs_url:
        raise SecurityError(
            f"Subject Recipient '{subject_recipient}' does not match "
            f"expected ACS URL '{expected_acs_url}'."
        )
```

---

## Audience Restriction Validation

The `AudienceRestriction` element in the SAML Assertion specifies which Service
Provider(s) the assertion is intended for. Without audience validation, an assertion
intended for SP-A could be replayed against SP-B.

```python
def validate_audience(assertion_audience: str, expected_audience: str) -> None:
    """Validate that the assertion audience matches the SP entity ID."""
    if assertion_audience != expected_audience:
        raise SecurityError(
            f"Audience '{assertion_audience}' does not match "
            f"expected audience '{expected_audience}'."
        )
```

The expected audience is typically the SP's Entity ID (e.g., `https://app.example.com`).

---

## Time Validation

### NotBefore and NotOnOrAfter

SAML Assertions include time bounds that define when the assertion is valid.

```python
from datetime import datetime, timezone, timedelta

MAX_CLOCK_SKEW = timedelta(seconds=120)  # 2 minutes

def validate_time_conditions(
    not_before: str,
    not_on_or_after: str,
    clock_skew: timedelta = MAX_CLOCK_SKEW,
) -> None:
    """Validate SAML assertion time conditions with clock skew tolerance."""
    now = datetime.now(timezone.utc)
    nb = datetime.fromisoformat(not_before.replace("Z", "+00:00"))
    noa = datetime.fromisoformat(not_on_or_after.replace("Z", "+00:00"))

    # NotBefore check (with clock skew tolerance)
    if now < nb - clock_skew:
        raise SecurityError(
            f"Assertion is not yet valid. NotBefore: {not_before}, "
            f"Current time: {now.isoformat()}"
        )

    # NotOnOrAfter check (with clock skew tolerance)
    if now >= noa + clock_skew:
        raise SecurityError(
            f"Assertion has expired. NotOnOrAfter: {not_on_or_after}, "
            f"Current time: {now.isoformat()}"
        )
```

### Clock Skew Tolerance

Allow a clock skew tolerance of 2 minutes (120 seconds) maximum. This accounts for
time differences between the IdP and SP servers. Using NTP on both servers minimizes
clock drift.

**Do not set clock skew tolerance greater than 5 minutes.** Large tolerances
significantly extend the replay window and weaken time-based validation.

### SubjectConfirmationData Timing

In addition to the Conditions element, the `SubjectConfirmationData` has its own
`NotOnOrAfter` attribute. Validate both:

```python
def validate_subject_confirmation_time(
    subject_not_on_or_after: str,
    clock_skew: timedelta = MAX_CLOCK_SKEW,
) -> None:
    """Validate SubjectConfirmationData time bound."""
    now = datetime.now(timezone.utc)
    noa = datetime.fromisoformat(subject_not_on_or_after.replace("Z", "+00:00"))

    if now >= noa + clock_skew:
        raise SecurityError(
            f"SubjectConfirmationData has expired. "
            f"NotOnOrAfter: {subject_not_on_or_after}"
        )
```

---

## Replay Prevention

SAML assertions can be replayed if an attacker captures a valid Response during
transmission. Replay prevention requires tracking assertion IDs and `InResponseTo` values.

### InResponseTo Tracking

For SP-initiated SSO, the SAML Response includes an `InResponseTo` attribute that
references the original AuthnRequest ID. The SP must:

1. Store the AuthnRequest ID when the request is initiated.
2. Validate that the `InResponseTo` value in the Response matches a stored request ID.
3. Delete the stored request ID after successful validation (single use).
4. Expire stored request IDs after 5 minutes.

```typescript
class AuthnRequestTracker {
  private store: Map<string, { timestamp: number; returnUrl: string }>;
  private maxAgeMs: number = 300000; // 5 minutes

  constructor() {
    this.store = new Map();
  }

  track(requestId: string, returnUrl: string): void {
    this.store.set(requestId, {
      timestamp: Date.now(),
      returnUrl,
    });
  }

  validate(inResponseTo: string): { valid: boolean; returnUrl?: string } {
    const entry = this.store.get(inResponseTo);

    if (!entry) {
      return { valid: false }; // Unknown request ID
    }

    if (Date.now() - entry.timestamp > this.maxAgeMs) {
      this.store.delete(inResponseTo);
      return { valid: false }; // Expired
    }

    // Delete after use (single use)
    this.store.delete(inResponseTo);
    return { valid: true, returnUrl: entry.returnUrl };
  }

  // Periodic cleanup of expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.store) {
      if (now - entry.timestamp > this.maxAgeMs) {
        this.store.delete(id);
      }
    }
  }
}
```

### Assertion ID Caching

Cache the Assertion ID (`_assertion-id-xyz789`) and reject any assertion with a
duplicate ID. The cache duration must be at least as long as the assertion's
`NotOnOrAfter` time plus the clock skew tolerance.

```go
package saml

import (
    "context"
    "fmt"
    "time"

    "github.com/redis/go-redis/v9"
)

type AssertionIDCache struct {
    redis *redis.Client
}

func NewAssertionIDCache(redis *redis.Client) *AssertionIDCache {
    return &AssertionIDCache{redis: redis}
}

func (c *AssertionIDCache) CheckAndStore(ctx context.Context, assertionID string,
    notOnOrAfter time.Time) error {

    key := fmt.Sprintf("saml:assertion:%s", assertionID)

    // Try to set the key only if it does not exist (NX)
    ttl := time.Until(notOnOrAfter) + 5*time.Minute // Extra buffer
    if ttl <= 0 {
        return fmt.Errorf("assertion has already expired")
    }

    set, err := c.redis.SetNX(ctx, key, "1", ttl).Result()
    if err != nil {
        return fmt.Errorf("checking assertion cache: %w", err)
    }

    if !set {
        return fmt.Errorf("assertion ID %s has already been used (replay attack)", assertionID)
    }

    return nil
}
```

---

## SAML vs OAuth2/OIDC

### When to Use SAML

| Scenario                                | Recommendation    |
|-----------------------------------------|-------------------|
| Enterprise SSO with legacy IdPs         | SAML              |
| ADFS or on-premises Active Directory    | SAML              |
| Government or regulated environments    | SAML (often required) |
| Integration with specific SaaS apps     | SAML (widely supported) |

### When to Use OAuth2/OIDC

| Scenario                                | Recommendation    |
|-----------------------------------------|-------------------|
| Modern web/mobile applications          | OIDC              |
| API authorization                       | OAuth 2.0         |
| Consumer-facing applications            | OIDC              |
| Microservices architecture              | OAuth 2.0         |
| Native mobile applications              | OIDC + PKCE       |
| Machine-to-machine communication        | OAuth 2.0 Client Credentials |

### Feature Comparison

| Feature              | SAML 2.0            | OAuth 2.0 / OIDC          |
|----------------------|---------------------|---------------------------|
| Token format         | XML                 | JSON (JWT)                |
| Transport            | Browser redirects   | HTTP API calls            |
| Mobile support       | Poor                | Excellent                 |
| Complexity           | High (XML, signatures)| Moderate                |
| Specification age    | 2005                | 2012 (OAuth), 2014 (OIDC)|
| Single Sign-On       | Yes                 | Yes                       |
| Single Logout        | Partially supported | Limited support            |
| API authorization    | Not designed for this| Yes                       |
| Phishing resistance  | No (unless with strong auth) | No (unless with FIDO2)  |

### Migration Strategy (SAML to OIDC)

1. Implement OIDC alongside SAML (dual-stack).
2. New applications use OIDC exclusively.
3. Migrate existing applications from SAML to OIDC gradually.
4. Decommission SAML when all applications are migrated.

---

## Common SAML Vulnerabilities

### 1. Signature Wrapping (XSW)

See the dedicated section above. This is the most critical SAML vulnerability class.
Use a well-maintained library and validate that the signed element is the processed
element.

### 2. XXE (XML External Entity) in SAML

SAML messages are XML, making them potential vectors for XXE injection. An attacker
can include an external entity definition in the SAML Response that causes the XML
parser to read local files, make HTTP requests, or cause denial of service.

**Attack example:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<samlp:Response>
  <saml:Assertion>
    <saml:Subject>
      <saml:NameID>&xxe;</saml:NameID>
    </saml:Subject>
  </saml:Assertion>
</samlp:Response>
```

**Prevention:**
- Disable DTD processing in the XML parser.
- Disable external entity resolution.
- Use a SAML library that configures XML parsing securely by default.

```python
# Python: Disable XXE in lxml
from lxml import etree

parser = etree.XMLParser(
    resolve_entities=False,
    no_network=True,
    dtd_validation=False,
    load_dtd=False,
)

def safe_parse_xml(xml_string: str) -> etree._Element:
    """Parse XML with XXE protection."""
    return etree.fromstring(xml_string.encode(), parser=parser)
```

```java
// Java: Disable XXE in DocumentBuilderFactory
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
dbf.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
dbf.setXIncludeAware(false);
dbf.setExpandEntityReferences(false);
```

```typescript
// TypeScript/Node.js: Use a library with XXE protection
import { DOMParser } from "@xmldom/xmldom";

// xmldom does not process external entities by default
// but always verify library documentation
```

### 3. Open Redirect via RelayState

The `RelayState` parameter is passed through the SSO flow to preserve the user's
original destination. If the SP redirects to the `RelayState` value without
validation, an attacker can craft a SAML flow that redirects the victim to a
malicious site after authentication.

**Prevention:**
- Validate the `RelayState` against a whitelist of allowed URLs.
- Use relative paths instead of absolute URLs in `RelayState`.
- Apply the same open redirect protections as any other redirect parameter.

```typescript
function validateRelayState(relayState: string, allowedHosts: string[]): boolean {
  try {
    const url = new URL(relayState, "https://app.example.com");

    // Only allow same-origin or explicitly allowed hosts
    if (!allowedHosts.includes(url.hostname)) {
      return false;
    }

    // Reject non-HTTPS
    if (url.protocol !== "https:") {
      return false;
    }

    return true;
  } catch {
    // If it is a relative path, allow it
    return relayState.startsWith("/") && !relayState.startsWith("//");
  }
}
```

### 4. Assertion Replay

An attacker captures a valid SAML Response (e.g., via network interception, browser
history, or logs) and replays it to gain unauthorized access. See the Replay Prevention
section for mitigations.

---

## Secure Library Configuration

### TypeScript (samlify)

```typescript
import * as samlify from "samlify";
import * as validator from "@authenio/samlify-xsd-schema-validator";

// Set the XSD schema validator to validate XML structure
samlify.setSchemaValidator(validator);

// Service Provider configuration
const sp = samlify.ServiceProvider({
  entityID: "https://app.example.com",
  authnRequestsSigned: true,
  wantAssertionsSigned: true,
  wantMessageSigned: true,
  assertionConsumerService: [
    {
      Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
      Location: "https://app.example.com/saml/acs",
    },
  ],
  singleLogoutService: [
    {
      Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
      Location: "https://app.example.com/saml/slo",
    },
  ],
  signingCert: readFileSync("./sp-signing-cert.pem"),
  privateKey: readFileSync("./sp-private-key.pem"),
  privateKeyPass: process.env.SP_KEY_PASSWORD,
  signatureConfig: {
    prefix: "ds",
    location: {
      reference: "//saml:Issuer",
      action: "after",
    },
  },
});

// Identity Provider configuration (from IdP metadata)
const idp = samlify.IdentityProvider({
  metadata: readFileSync("./idp-metadata.xml"),
  wantLogoutRequestSigned: true,
  isAssertionEncrypted: false,
  messageSigningOrder: "sign-then-encrypt",
});

// Handle SSO login
async function handleLogin(req: Request, res: Response): Promise<void> {
  const { context: loginUrl } = sp.createLoginRequest(idp, "redirect");
  res.redirect(loginUrl);
}

// Handle ACS callback
async function handleACS(req: Request, res: Response): Promise<void> {
  try {
    const { extract } = await sp.parseLoginResponse(idp, "post", {
      body: req.body,
    });

    const { nameID, attributes, conditions } = extract;

    // Additional validations
    validateAudience(conditions.audience, "https://app.example.com");
    validateTimeConditions(conditions.notBefore, conditions.notOnOrAfter);
    await checkAssertionReplay(extract.response.id);

    // Create local session
    const user = await findOrCreateUser(nameID, attributes);
    req.session.userId = user.id;

    // Redirect to original destination
    const relayState = req.body.RelayState || "/";
    if (validateRelayState(relayState, ["app.example.com"])) {
      res.redirect(relayState);
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.error("SAML authentication failed:", error);
    res.status(401).json({ error: "Authentication failed" });
  }
}
```

### TypeScript (passport-saml)

```typescript
import passport from "passport";
import { Strategy as SamlStrategy, type VerifiedCallback } from "passport-saml";

const samlStrategy = new SamlStrategy(
  {
    callbackUrl: "https://app.example.com/saml/acs",
    entryPoint: "https://idp.example.com/sso/saml",
    issuer: "https://app.example.com",
    cert: readFileSync("./idp-signing-cert.pem", "utf-8"),
    privateKey: readFileSync("./sp-private-key.pem", "utf-8"),

    // Security settings
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    signatureAlgorithm: "sha256",
    digestAlgorithm: "sha256",

    // Time validation
    acceptedClockSkewMs: 120000, // 2 minutes
    maxAssertionAgeMs: 300000, // 5 minutes

    // Audience validation
    audience: "https://app.example.com",

    // Request signing
    authnRequestBinding: "HTTP-POST",

    // Disable IdP-initiated SSO if not needed
    validateInResponseTo: "always",
  },
  (profile: any, done: VerifiedCallback) => {
    // profile contains the parsed SAML attributes
    const user = {
      email: profile.nameID,
      firstName: profile["firstName"],
      lastName: profile["lastName"],
      groups: profile["groups"] || [],
    };

    return done(null, user);
  },
  (profile: any, done: VerifiedCallback) => {
    // Logout callback
    return done(null, profile);
  }
);

passport.use("saml", samlStrategy);
```

### Python (python3-saml)

```python
from onelogin.saml2.auth import OneLogin_Saml2_Auth
from onelogin.saml2.utils import OneLogin_Saml2_Utils

def get_saml_settings() -> dict:
    """Return python3-saml settings dictionary."""
    return {
        "strict": True,  # CRITICAL: Always True in production
        "debug": False,
        "sp": {
            "entityId": "https://app.example.com",
            "assertionConsumerService": {
                "url": "https://app.example.com/saml/acs",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
            },
            "singleLogoutService": {
                "url": "https://app.example.com/saml/slo",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
            },
            "NameIDFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
            "x509cert": open("sp-cert.pem").read(),
            "privateKey": open("sp-key.pem").read(),
        },
        "idp": {
            "entityId": "https://idp.example.com",
            "singleSignOnService": {
                "url": "https://idp.example.com/sso/saml",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            },
            "singleLogoutService": {
                "url": "https://idp.example.com/slo/saml",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            },
            "x509cert": open("idp-cert.pem").read(),
        },
        "security": {
            "nameIdEncrypted": False,
            "authnRequestsSigned": True,
            "logoutRequestSigned": True,
            "logoutResponseSigned": True,
            "signMetadata": True,
            "wantMessagesSigned": True,
            "wantAssertionsSigned": True,
            "wantNameId": True,
            "wantNameIdEncrypted": False,
            "wantAssertionsEncrypted": False,
            "signatureAlgorithm": "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
            "digestAlgorithm": "http://www.w3.org/2001/04/xmlenc#sha256",
            "rejectDeprecatedAlgorithm": True,  # Reject SHA-1
        },
    }


def handle_acs(request) -> dict:
    """Handle SAML ACS callback."""
    saml_settings = get_saml_settings()
    req = prepare_flask_request(request)
    auth = OneLogin_Saml2_Auth(req, saml_settings)
    auth.process_response()

    errors = auth.get_errors()
    if errors:
        raise SecurityError(f"SAML authentication failed: {', '.join(errors)}")

    if not auth.is_authenticated():
        raise SecurityError("SAML authentication failed: not authenticated")

    # Extract user attributes
    attributes = auth.get_attributes()
    name_id = auth.get_nameid()
    session_index = auth.get_session_index()

    return {
        "name_id": name_id,
        "attributes": attributes,
        "session_index": session_index,
    }
```

### Java (OpenSAML)

```java
import org.opensaml.saml.saml2.core.*;
import org.opensaml.xmlsec.signature.support.SignatureValidator;
import org.opensaml.security.credential.Credential;
import net.shibboleth.utilities.java.support.xml.BasicParserPool;

public class SAMLResponseValidator {

    private final Credential idpCredential;
    private final String expectedAudience;
    private final String expectedAcsUrl;
    private final int maxClockSkewSeconds;

    public SAMLResponseValidator(
        Credential idpCredential,
        String expectedAudience,
        String expectedAcsUrl,
        int maxClockSkewSeconds
    ) {
        this.idpCredential = idpCredential;
        this.expectedAudience = expectedAudience;
        this.expectedAcsUrl = expectedAcsUrl;
        this.maxClockSkewSeconds = maxClockSkewSeconds;
    }

    public SAMLUserInfo validate(Response response) throws SAMLValidationException {
        // 1. Validate Response status
        if (!StatusCode.SUCCESS.equals(
                response.getStatus().getStatusCode().getValue())) {
            throw new SAMLValidationException("SAML Response status is not Success");
        }

        // 2. Validate Destination
        if (!expectedAcsUrl.equals(response.getDestination())) {
            throw new SAMLValidationException(
                "Response Destination does not match ACS URL"
            );
        }

        // 3. Get the assertion (expect exactly one)
        List<Assertion> assertions = response.getAssertions();
        if (assertions.size() != 1) {
            throw new SAMLValidationException(
                "Expected exactly 1 assertion, found " + assertions.size()
            );
        }
        Assertion assertion = assertions.get(0);

        // 4. Validate assertion signature
        if (assertion.getSignature() == null) {
            throw new SAMLValidationException("Assertion is not signed");
        }
        try {
            SignatureValidator.validate(assertion.getSignature(), idpCredential);
        } catch (Exception e) {
            throw new SAMLValidationException("Assertion signature validation failed", e);
        }

        // 5. Validate conditions
        Conditions conditions = assertion.getConditions();
        validateTimeConditions(conditions);
        validateAudienceRestriction(conditions);

        // 6. Validate Subject
        Subject subject = assertion.getSubject();
        validateSubjectConfirmation(subject);

        // 7. Extract NameID and attributes
        String nameId = subject.getNameID().getValue();
        Map<String, List<String>> attributes = extractAttributes(assertion);

        return new SAMLUserInfo(nameId, attributes);
    }

    private void validateTimeConditions(Conditions conditions)
            throws SAMLValidationException {
        Instant now = Instant.now();
        Instant notBefore = conditions.getNotBefore();
        Instant notOnOrAfter = conditions.getNotOnOrAfter();
        Duration skew = Duration.ofSeconds(maxClockSkewSeconds);

        if (now.isBefore(notBefore.minus(skew))) {
            throw new SAMLValidationException("Assertion is not yet valid");
        }
        if (now.isAfter(notOnOrAfter.plus(skew))) {
            throw new SAMLValidationException("Assertion has expired");
        }
    }

    private void validateAudienceRestriction(Conditions conditions)
            throws SAMLValidationException {
        for (AudienceRestriction restriction : conditions.getAudienceRestrictions()) {
            boolean found = restriction.getAudiences().stream()
                .anyMatch(a -> expectedAudience.equals(a.getURI()));
            if (!found) {
                throw new SAMLValidationException(
                    "Audience restriction does not include expected audience"
                );
            }
        }
    }

    private void validateSubjectConfirmation(Subject subject)
            throws SAMLValidationException {
        for (SubjectConfirmation confirmation : subject.getSubjectConfirmations()) {
            if ("urn:oasis:names:tc:SAML:2.0:cm:bearer".equals(confirmation.getMethod())) {
                SubjectConfirmationData data = confirmation.getSubjectConfirmationData();

                // Validate Recipient
                if (!expectedAcsUrl.equals(data.getRecipient())) {
                    throw new SAMLValidationException(
                        "Subject Recipient does not match ACS URL"
                    );
                }

                // Validate NotOnOrAfter
                Instant notOnOrAfter = data.getNotOnOrAfter();
                if (Instant.now().isAfter(
                        notOnOrAfter.plus(Duration.ofSeconds(maxClockSkewSeconds)))) {
                    throw new SAMLValidationException(
                        "SubjectConfirmationData has expired"
                    );
                }

                return; // Valid subject confirmation found
            }
        }
        throw new SAMLValidationException("No valid bearer SubjectConfirmation found");
    }

    private Map<String, List<String>> extractAttributes(Assertion assertion) {
        Map<String, List<String>> attributes = new HashMap<>();
        for (AttributeStatement statement : assertion.getAttributeStatements()) {
            for (Attribute attribute : statement.getAttributes()) {
                List<String> values = attribute.getAttributeValues().stream()
                    .map(v -> v.getDOM().getTextContent())
                    .collect(Collectors.toList());
                attributes.put(attribute.getName(), values);
            }
        }
        return attributes;
    }
}
```

---

## Best Practices

1. **Always require signed assertions.** Configure the SP with `wantAssertionsSigned: true`. Reject any assertion that is not digitally signed. Preferably require both Response and Assertion signatures.

2. **Use SHA-256 or stronger for signatures and digests.** Reject SHA-1 explicitly. Configure both the signature algorithm (`rsa-sha256`) and the digest algorithm (`sha256`). SHA-1 has known collision attacks and must not be trusted.

3. **Validate all time conditions with bounded clock skew.** Check `NotBefore`, `NotOnOrAfter` on the Conditions element, and `NotOnOrAfter` on the SubjectConfirmationData. Set clock skew tolerance to a maximum of 2 minutes. Use NTP on all servers.

4. **Implement assertion replay prevention.** Cache assertion IDs and reject duplicates. For SP-initiated SSO, validate the `InResponseTo` attribute against stored AuthnRequest IDs. Set cache duration to at least the assertion validity window plus clock skew.

5. **Validate the audience restriction.** Verify that the SP's Entity ID is included in the `AudienceRestriction` element. Reject assertions intended for other SPs.

6. **Validate the ACS URL in both Destination and Recipient.** Use exact string matching. Do not allow partial matches or wildcards. This prevents assertion injection and open redirect attacks.

7. **Disable XML external entity (XXE) processing.** Configure the XML parser to reject DTDs, disable external entity resolution, and disable external DTD loading. This is critical for preventing XXE injection attacks.

8. **Prefer SP-initiated SSO over IdP-initiated SSO.** SP-initiated SSO provides `InResponseTo` validation, which strengthens replay protection. If IdP-initiated SSO is required, implement compensating controls (strict time windows, assertion ID caching).

9. **Pin or securely manage IdP certificates.** Store the IdP's signing certificate in configuration and validate every assertion against it. When the IdP rotates certificates, update the SP configuration. Automate this through metadata refresh if possible.

10. **Log all SAML events for security monitoring.** Log successful and failed authentications, signature validation results, time validation results, and any detected attack patterns. Do not log full SAML responses (they contain PII), but log assertion IDs, timestamps, and validation outcomes.

---

## Anti-Patterns

1. **Setting `strict: false` in SAML library configuration.** Non-strict mode disables critical security validations (signature checking, time validation, audience restriction). This is catastrophic in production. Always set `strict: true`.

2. **Not validating XML signatures or accepting unsigned assertions.** Some SP implementations skip signature verification during development and never re-enable it. Every production SAML integration must validate digital signatures on every assertion.

3. **Using SHA-1 for signature or digest algorithms.** SHA-1 has known collision attacks and has been deprecated for digital signatures. An attacker with sufficient resources can forge SHA-1 signatures. Use SHA-256 minimum.

4. **Processing the first Assertion found in the Response without verifying it is the signed one.** This is the essence of XSW attacks. The application must process only the assertion that was verified by the signature, not the first assertion in document order.

5. **Not disabling XXE in the XML parser.** Default XML parser configurations in many languages resolve external entities. A SAML Response with a malicious DTD can read local files, make outbound HTTP requests, or cause denial of service.

6. **Allowing unrestricted RelayState redirect.** If the SP redirects the user to the `RelayState` URL after authentication without validation, an attacker can use the SAML flow for an open redirect attack, directing authenticated users to phishing sites.

7. **Setting clock skew tolerance greater than 5 minutes.** Excessive clock skew tolerance extends the replay window and weakens the time-based security of SAML assertions. Fix clock synchronization with NTP instead of increasing tolerance.

8. **Not tracking assertion IDs for replay detection.** Without assertion ID caching, an attacker who captures a valid SAML Response can replay it multiple times within the assertion's validity window. This is especially critical for IdP-initiated SSO where there is no `InResponseTo` check.

---

## Enforcement Checklist

### Design Phase
- [ ] Decided on SP-initiated vs IdP-initiated SSO (prefer SP-initiated).
- [ ] Defined SP Entity ID and ACS URL.
- [ ] Obtained IdP metadata or signing certificate.
- [ ] Defined attribute mapping (IdP attributes to SP user model).
- [ ] Planned replay prevention strategy (assertion ID cache, InResponseTo tracking).
- [ ] Defined clock skew tolerance (maximum 2 minutes).
- [ ] Selected SAML library and verified its XSW attack resistance.

### Implementation Phase
- [ ] Library is configured with `strict: true` (or equivalent).
- [ ] Assertion signatures are required and validated (`wantAssertionsSigned: true`).
- [ ] SHA-256 is enforced for signatures and digests; SHA-1 is rejected.
- [ ] `NotBefore` and `NotOnOrAfter` are validated on Conditions and SubjectConfirmationData.
- [ ] Audience restriction is validated against the SP's Entity ID.
- [ ] ACS URL is validated in Response `Destination` and Subject `Recipient`.
- [ ] `InResponseTo` is validated for SP-initiated SSO.
- [ ] Assertion ID cache is implemented for replay prevention.
- [ ] XML parser has XXE protections enabled (no DTD, no external entities).
- [ ] RelayState is validated against allowed destinations.
- [ ] IdP certificate is pinned or fetched securely via metadata.
- [ ] SAML error responses are handled without revealing internal details.

### Testing Phase
- [ ] Signature validation correctly rejects unsigned assertions.
- [ ] Signature validation correctly rejects assertions signed with an unknown certificate.
- [ ] Time validation rejects expired assertions.
- [ ] Time validation rejects assertions not yet valid.
- [ ] Audience validation rejects assertions for a different SP.
- [ ] ACS URL validation rejects mismatched Destinations and Recipients.
- [ ] Replay detection rejects reused assertion IDs.
- [ ] InResponseTo validation rejects mismatched or missing values (SP-initiated).
- [ ] XXE payloads are rejected (test with DTD and external entity references).
- [ ] XSW attack variants (XSW1-XSW8) are tested using SAML Raider or similar tools.
- [ ] RelayState open redirect is tested and blocked.

### Deployment Phase
- [ ] IdP certificate is deployed and matches the configured value.
- [ ] ACS URL is accessible over HTTPS.
- [ ] SP metadata is published and accessible to the IdP.
- [ ] Clock synchronization (NTP) is configured on all servers.
- [ ] Assertion ID cache (Redis or equivalent) is deployed and monitored.
- [ ] Logging captures SAML authentication events.
- [ ] Monitoring alerts on signature validation failures and replay attempts.

### Periodic Review
- [ ] IdP certificate rotation is tracked and SP configuration is updated.
- [ ] SAML library is updated to the latest version (XSW attack patches).
- [ ] Clock skew between SP and IdP is monitored.
- [ ] Assertion ID cache performance and availability is verified.
- [ ] SAML authentication logs are reviewed for anomalous patterns.
- [ ] SAML vs OIDC migration timeline is evaluated.
