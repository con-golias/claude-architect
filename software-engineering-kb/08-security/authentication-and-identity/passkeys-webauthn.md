# Passkeys and WebAuthn Guide

## Metadata
- **Category**: Authentication and Identity
- **Priority**: Critical
- **Last Updated**: 2025-01-15
- **Standards**: WebAuthn Level 2 (W3C), FIDO2 (FIDO Alliance), CTAP2
- **Applicable Languages**: TypeScript, Go, Python

---

## Table of Contents

1. [Overview](#overview)
2. [What Are Passkeys](#what-are-passkeys)
3. [WebAuthn API](#webauthn-api)
4. [Registration Ceremony](#registration-ceremony)
5. [Authentication Ceremony](#authentication-ceremony)
6. [Authenticator Types](#authenticator-types)
7. [Discoverable Credentials (Resident Keys)](#discoverable-credentials)
8. [Passkey Sync](#passkey-sync)
9. [Conditional UI (Autofill)](#conditional-ui-autofill)
10. [Fallback Authentication](#fallback-authentication)
11. [Server-Side Implementation](#server-side-implementation)
12. [Libraries and Tools](#libraries-and-tools)
13. [Best Practices](#best-practices)
14. [Anti-Patterns](#anti-patterns)
15. [Enforcement Checklist](#enforcement-checklist)

---

## Overview

Passkeys represent the most significant advancement in authentication security since
the introduction of multi-factor authentication. Built on the WebAuthn standard and
FIDO2 protocols, passkeys use public key cryptography to provide phishing-resistant
authentication without passwords.

Unlike passwords, passkeys cannot be phished because the browser enforces origin
binding -- the credential is cryptographically bound to the website's domain and cannot
be presented to a look-alike domain. Unlike TOTP codes, passkeys cannot be intercepted
or socially engineered because the private key never leaves the authenticator.

This guide covers the technical implementation of passkeys and WebAuthn, from client-side
API calls to server-side verification, including passkey synchronization, conditional
UI, and fallback strategies.

---

## What Are Passkeys

Passkeys are FIDO2 discoverable credentials that can be synchronized across a user's
devices through a platform credential manager. They replace passwords entirely.

### Key Properties

| Property              | Description                                               |
|-----------------------|-----------------------------------------------------------|
| Phishing-resistant    | Bound to the website origin; cannot be used on fake sites |
| No shared secrets     | Uses public key cryptography; server stores only public keys |
| No reuse              | Each passkey is unique to a single website                 |
| Biometric-protected   | Unlocked with fingerprint, face, or device PIN             |
| Synced                | Available across all devices in the same ecosystem         |
| Discoverable          | Can initiate authentication without entering a username    |

### How Passkeys Work

1. **Registration:** The server sends a challenge. The authenticator generates a
   key pair (public + private). The private key is stored in the authenticator
   (device, security key, or cloud credential manager). The public key is sent
   to the server.

2. **Authentication:** The server sends a challenge. The authenticator signs the
   challenge with the private key (after user verification via biometric or PIN).
   The server verifies the signature with the stored public key.

3. **Phishing resistance:** The browser includes the origin (domain) in the data
   signed by the authenticator. If the user is on a phishing site
   (`evil-example.com` instead of `example.com`), the authenticator either refuses
   to sign (if the credential is not found for that origin) or signs with the wrong
   origin, which the server rejects.

### Passkeys vs. Traditional FIDO2 Security Keys

| Feature               | Passkeys (Synced)          | Security Keys (Device-bound) |
|-----------------------|----------------------------|-------------------------------|
| Storage               | Cloud credential manager   | Hardware device               |
| Cross-device          | Yes (within ecosystem)     | No (physical key required)    |
| Loss recovery         | Sync restores credentials  | Lost key = lost access        |
| Cloning risk          | Cloud account compromise   | Physically impossible         |
| User experience       | Seamless, no hardware      | Requires carrying the key     |

---

## WebAuthn API

The WebAuthn API provides two primary methods:

1. `navigator.credentials.create()` -- Registration (creating a new credential).
2. `navigator.credentials.get()` -- Authentication (using an existing credential).

Both methods require a secure context (HTTPS or localhost).

### Browser Support

WebAuthn is supported in all major browsers: Chrome, Firefox, Safari, and Edge.
Passkey support (synced credentials) requires platform support:
- Apple: iOS 16+, macOS Ventura+, Safari 16+
- Google: Android 9+, Chrome 108+
- Microsoft: Windows 11 23H2+, Edge
- Third-party: 1Password, Dashlane, Bitwarden

---

## Registration Ceremony

The registration ceremony creates a new passkey for a user account.

### Client-Side Flow

```typescript
// Step 1: Fetch registration options from the server
async function startPasskeyRegistration(): Promise<void> {
  const optionsResponse = await fetch("/api/webauthn/register/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  const options: PublicKeyCredentialCreationOptions = await optionsResponse.json();

  // Step 2: Convert base64url strings to ArrayBuffers
  options.challenge = base64urlToBuffer(options.challenge as unknown as string);
  options.user.id = base64urlToBuffer(options.user.id as unknown as string);
  if (options.excludeCredentials) {
    options.excludeCredentials = options.excludeCredentials.map((cred) => ({
      ...cred,
      id: base64urlToBuffer(cred.id as unknown as string),
    }));
  }

  // Step 3: Call WebAuthn API
  let credential: PublicKeyCredential;
  try {
    credential = (await navigator.credentials.create({
      publicKey: options,
    })) as PublicKeyCredential;
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError") {
        // User cancelled or timed out
        showMessage("Registration cancelled. Please try again.");
        return;
      }
      if (error.name === "InvalidStateError") {
        // Credential already exists for this user on this authenticator
        showMessage("A passkey already exists for this account on this device.");
        return;
      }
    }
    throw error;
  }

  // Step 4: Send credential to server for verification
  const attestationResponse = credential.response as AuthenticatorAttestationResponse;

  const registrationResponse = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
      attestationObject: bufferToBase64url(attestationResponse.attestationObject),
      transports: attestationResponse.getTransports?.() || [],
    },
  };

  const verifyResponse = await fetch("/api/webauthn/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(registrationResponse),
  });

  if (verifyResponse.ok) {
    showMessage("Passkey registered successfully.");
  } else {
    showMessage("Registration failed. Please try again.");
  }
}

// Utility functions
function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
```

### PublicKeyCredentialCreationOptions

```typescript
interface RegistrationOptions {
  // Relying party (your application) information
  rp: {
    name: string;   // Human-readable name: "My Application"
    id: string;     // Domain: "example.com" (registrable domain suffix)
  };

  // User information
  user: {
    id: ArrayBuffer;     // Unique user handle (NOT email, NOT username)
    name: string;        // Username or email for display
    displayName: string; // Full name for display
  };

  // Random challenge from the server (minimum 16 bytes)
  challenge: ArrayBuffer;

  // Supported public key algorithms (ordered by preference)
  pubKeyCredParams: [
    { type: "public-key", alg: -7 },    // ES256 (ECDSA P-256)
    { type: "public-key", alg: -257 },   // RS256 (RSASSA-PKCS1-v1_5)
    { type: "public-key", alg: -8 },     // EdDSA (Ed25519)
  ];

  // Timeout in milliseconds (5 minutes recommended)
  timeout: 300000;

  // Credentials to exclude (prevent duplicate registration)
  excludeCredentials: Array<{
    type: "public-key";
    id: ArrayBuffer;
    transports?: AuthenticatorTransport[];
  }>;

  // Authenticator selection criteria
  authenticatorSelection: {
    // "platform" = device authenticator, "cross-platform" = security key
    authenticatorAttachment?: "platform" | "cross-platform";
    // "required" = must store on device, "preferred" = try, "discouraged" = don't
    residentKey: "required" | "preferred" | "discouraged";
    // Whether to require user verification (biometric/PIN)
    userVerification: "required" | "preferred" | "discouraged";
  };

  // Attestation preference ("none" for most use cases)
  attestation: "none" | "indirect" | "direct" | "enterprise";
}
```

### Registration Options Guidance

**residentKey:**
- Use `"required"` for passkey flows (username-less authentication).
- Use `"preferred"` to support both passkeys and non-discoverable credentials.
- Use `"discouraged"` only for second-factor scenarios.

**userVerification:**
- Use `"required"` when the passkey replaces both password and MFA.
- Use `"preferred"` to support authenticators that may not have biometric capabilities.
- Never use `"discouraged"` for primary authentication.

**attestation:**
- Use `"none"` for most consumer applications. Attestation verification adds complexity
  and provides minimal benefit for typical web applications.
- Use `"direct"` or `"enterprise"` only when you need to verify the authenticator make
  and model (e.g., enterprise environments requiring specific hardware security keys).

---

## Authentication Ceremony

The authentication ceremony verifies a user's identity using a previously registered passkey.

### Client-Side Flow

```typescript
async function authenticateWithPasskey(conditional: boolean = false): Promise<void> {
  // Step 1: Fetch authentication options from the server
  const optionsResponse = await fetch("/api/webauthn/authenticate/options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  const options: PublicKeyCredentialRequestOptions = await optionsResponse.json();

  // Step 2: Convert base64url strings to ArrayBuffers
  options.challenge = base64urlToBuffer(options.challenge as unknown as string);
  if (options.allowCredentials) {
    options.allowCredentials = options.allowCredentials.map((cred) => ({
      ...cred,
      id: base64urlToBuffer(cred.id as unknown as string),
    }));
  }

  // Step 3: Call WebAuthn API
  let credential: PublicKeyCredential;
  try {
    if (conditional) {
      // Conditional UI: triggered by autofill
      credential = (await navigator.credentials.get({
        publicKey: options,
        mediation: "conditional",
      })) as PublicKeyCredential;
    } else {
      // Modal UI: triggered by button click
      credential = (await navigator.credentials.get({
        publicKey: options,
      })) as PublicKeyCredential;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      showMessage("Authentication cancelled.");
      return;
    }
    throw error;
  }

  // Step 4: Send assertion to server for verification
  const assertionResponse = credential.response as AuthenticatorAssertionResponse;

  const authenticationResponse = {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
      authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
      signature: bufferToBase64url(assertionResponse.signature),
      userHandle: assertionResponse.userHandle
        ? bufferToBase64url(assertionResponse.userHandle)
        : null,
    },
  };

  const verifyResponse = await fetch("/api/webauthn/authenticate/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(authenticationResponse),
  });

  if (verifyResponse.ok) {
    const { sessionToken } = await verifyResponse.json();
    // Authentication successful -- redirect or update UI
    window.location.href = "/dashboard";
  } else {
    showMessage("Authentication failed. Please try again.");
  }
}
```

### PublicKeyCredentialRequestOptions

```typescript
interface AuthenticationOptions {
  // Random challenge from the server (minimum 16 bytes)
  challenge: ArrayBuffer;

  // Timeout in milliseconds
  timeout: 300000;

  // Relying party ID (domain)
  rpId: "example.com";

  // Allowed credentials (empty for discoverable credential flow)
  allowCredentials: Array<{
    type: "public-key";
    id: ArrayBuffer;
    transports?: AuthenticatorTransport[];
  }>;

  // User verification requirement
  userVerification: "required" | "preferred" | "discouraged";
}
```

When `allowCredentials` is empty, the authenticator presents all discoverable
credentials for the relying party, enabling username-less authentication.

---

## Authenticator Types

### Platform Authenticators

Platform authenticators are built into the user's device. They use the device's
biometric sensors or screen lock mechanism for user verification.

| Platform          | Authenticator              | User Verification        |
|-------------------|----------------------------|--------------------------|
| macOS / iOS       | Touch ID, Face ID          | Fingerprint, face scan   |
| Windows           | Windows Hello              | Face, fingerprint, PIN   |
| Android           | Biometric prompt           | Fingerprint, face, PIN   |
| Chrome OS         | Device PIN or biometric    | PIN, fingerprint         |

**Advantages:** No additional hardware needed. Familiar to users. Fast authentication.

**Disadvantages:** Tied to the device (unless synced as passkeys). Lost device means
lost access (unless synced or backed up).

### Roaming Authenticators (Security Keys)

Roaming authenticators are external hardware devices that connect via USB, NFC, or
Bluetooth.

| Device          | Interface          | Key Features                        |
|-----------------|--------------------|--------------------------------------|
| YubiKey 5 Series| USB-A, USB-C, NFC | FIDO2, PIV, OTP, OpenPGP            |
| YubiKey Bio     | USB-A, USB-C      | Built-in fingerprint reader          |
| Google Titan    | USB-A, USB-C, NFC | FIDO2, U2F                           |
| Feitian         | USB, NFC, BLE     | FIDO2, various form factors          |

**Advantages:** Device-bound keys cannot be extracted or cloned. Work across all
platforms. Enterprise-grade security.

**Disadvantages:** Must be carried physically. Can be lost. Cost per key.

### Choosing Authenticator Attachment

```typescript
// For passkey registration (sync across devices)
authenticatorSelection: {
  authenticatorAttachment: undefined, // Allow both platform and roaming
  residentKey: "required",
  userVerification: "required",
}

// For platform-only (device-bound, better UX)
authenticatorSelection: {
  authenticatorAttachment: "platform",
  residentKey: "required",
  userVerification: "required",
}

// For security key enrollment (enterprise)
authenticatorSelection: {
  authenticatorAttachment: "cross-platform",
  residentKey: "preferred",
  userVerification: "required",
}
```

---

## Discoverable Credentials (Resident Keys)

Discoverable credentials (also called resident keys) are stored on the authenticator
and can be discovered without providing a credential ID. This enables username-less
authentication -- the user simply triggers the authenticator, and it presents all
available credentials for the current site.

### Registration with Discoverable Credentials

Set `residentKey: "required"` in the `authenticatorSelection` options:

```typescript
const options: PublicKeyCredentialCreationOptions = {
  // ...
  authenticatorSelection: {
    residentKey: "required",
    userVerification: "required",
  },
};
```

### Authentication without Username

When using discoverable credentials, set `allowCredentials` to an empty array or
omit it entirely. The authenticator will present a list of available credentials
for the relying party.

```typescript
const options: PublicKeyCredentialRequestOptions = {
  challenge: serverChallenge,
  rpId: "example.com",
  allowCredentials: [], // Empty = discoverable credential flow
  userVerification: "required",
  timeout: 300000,
};
```

The authenticator response includes a `userHandle` field containing the user ID
that was specified during registration. The server uses this to identify the user.

---

## Passkey Sync

### Platform Credential Managers

Passkeys are synchronized through platform credential managers:

| Platform        | Credential Manager         | Sync Scope                     |
|-----------------|----------------------------|--------------------------------|
| Apple           | iCloud Keychain            | All Apple devices with same Apple ID |
| Google          | Google Password Manager    | All Android/Chrome with same Google account |
| Microsoft       | Windows Hello              | Windows devices (expanding)     |
| 1Password       | 1Password Vault            | All platforms with 1Password    |
| Dashlane        | Dashlane Vault             | All platforms with Dashlane     |
| Bitwarden       | Bitwarden Vault            | All platforms with Bitwarden    |

### Cross-Platform Authentication (Hybrid Transport)

When a user's passkey is on their phone but they are logging in on a laptop, the
hybrid transport protocol (formerly caBLE) enables cross-device authentication.

**Flow:**
1. The laptop displays a QR code.
2. The user scans the QR code with their phone.
3. The phone and laptop establish a secure Bluetooth Low Energy (BLE) channel.
4. The phone performs the authentication ceremony and sends the assertion to the laptop.
5. The laptop forwards the assertion to the server.

This works across ecosystems: an iPhone passkey can authenticate on a Windows laptop.

### Sync Security Considerations

1. Synced passkeys are only as secure as the platform account (Apple ID, Google account).
   Ensure these accounts have strong authentication (MFA, recovery key).

2. For high-security environments, consider requiring device-bound credentials
   (security keys) that cannot be synced or cloned.

3. Monitor for unexpected credential creation across many devices, which could indicate
   account compromise of the platform credential manager.

---

## Conditional UI (Autofill)

Conditional UI allows passkey authentication to be integrated into the browser's
autofill mechanism. When a user focuses on a username field, the browser shows available
passkeys alongside saved passwords.

### HTML Setup

```html
<form id="login-form">
  <label for="username">Username</label>
  <input
    type="text"
    id="username"
    name="username"
    autocomplete="username webauthn"
  />

  <label for="password">Password</label>
  <input
    type="password"
    id="password"
    name="password"
    autocomplete="current-password webauthn"
  />

  <button type="submit">Sign in</button>
</form>
```

The key addition is `webauthn` in the `autocomplete` attribute. This signals to the
browser that WebAuthn credentials should be included in the autofill dropdown.

### JavaScript Setup

```typescript
// Check if conditional mediation is available
async function initConditionalUI(): Promise<void> {
  // Check if WebAuthn is available
  if (!window.PublicKeyCredential) {
    return;
  }

  // Check if conditional mediation is supported
  const isConditionalAvailable =
    await PublicKeyCredential.isConditionalMediationAvailable?.();

  if (!isConditionalAvailable) {
    return; // Fall back to button-based authentication
  }

  // Start conditional UI authentication
  // This call does NOT show a modal -- it waits for the user to select
  // a passkey from the autofill dropdown
  try {
    await authenticateWithPasskey(true); // conditional = true
  } catch (error) {
    // AbortError is expected when the user submits the form with a password
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    console.error("Conditional UI error:", error);
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", initConditionalUI);
```

### Aborting Conditional UI

When the user submits the login form with a password instead of a passkey, abort the
conditional UI request to prevent conflicts:

```typescript
const abortController = new AbortController();

async function initConditionalUI(): Promise<void> {
  // ... (same as above, but pass signal)
  const credential = await navigator.credentials.get({
    publicKey: options,
    mediation: "conditional",
    signal: abortController.signal, // Allow aborting
  });
}

// When form is submitted with password
document.getElementById("login-form")!.addEventListener("submit", () => {
  abortController.abort(); // Cancel the conditional UI request
});
```

---

## Fallback Authentication

Not all users have devices that support passkeys. Implement graceful fallback
authentication for compatibility.

### Fallback Strategy

```
1. Passkey (conditional UI) -- Try first, most secure
2. Passkey (modal button) -- Explicit trigger
3. Password + TOTP -- Traditional MFA
4. Password + SMS OTP -- Weakest acceptable option
5. Account recovery -- Last resort
```

### Feature Detection

```typescript
interface AuthCapabilities {
  webauthnAvailable: boolean;
  conditionalUIAvailable: boolean;
  platformAuthenticatorAvailable: boolean;
}

async function detectAuthCapabilities(): Promise<AuthCapabilities> {
  const capabilities: AuthCapabilities = {
    webauthnAvailable: false,
    conditionalUIAvailable: false,
    platformAuthenticatorAvailable: false,
  };

  if (!window.PublicKeyCredential) {
    return capabilities;
  }

  capabilities.webauthnAvailable = true;

  try {
    capabilities.platformAuthenticatorAvailable =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    // Not supported
  }

  try {
    capabilities.conditionalUIAvailable =
      (await PublicKeyCredential.isConditionalMediationAvailable?.()) ?? false;
  } catch {
    // Not supported
  }

  return capabilities;
}

// Adapt login UI based on capabilities
async function initLoginPage(): Promise<void> {
  const capabilities = await detectAuthCapabilities();

  if (capabilities.conditionalUIAvailable) {
    // Show passkey-first UI with autofill
    initConditionalUI();
    showPasskeyHint();
  } else if (capabilities.webauthnAvailable) {
    // Show "Sign in with passkey" button
    showPasskeyButton();
  }

  // Always show password form as fallback
  showPasswordForm();
}
```

---

## Server-Side Implementation

### TypeScript (@simplewebauthn/server)

```typescript
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";

const rpName = "My Application";
const rpID = "example.com";
const expectedOrigin = "https://example.com";

// --- Registration ---

async function getRegistrationOptions(userId: string, userName: string) {
  const existingCredentials = await db.credentials.findByUserId(userId);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: userId,
    userName,
    attestationType: "none",
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    supportedAlgorithmIDs: [-7, -257], // ES256, RS256
  });

  // Store challenge in session (expires in 5 minutes)
  await session.set(`webauthn:challenge:${userId}`, {
    challenge: options.challenge,
    expiresAt: Date.now() + 300000,
  });

  return options;
}

async function verifyRegistration(
  userId: string,
  response: any
): Promise<{ verified: boolean; credentialId?: string }> {
  const sessionData = await session.get(`webauthn:challenge:${userId}`);
  if (!sessionData || Date.now() > sessionData.expiresAt) {
    throw new Error("Challenge expired or not found");
  }

  const verification: VerifiedRegistrationResponse =
    await verifyRegistrationResponse({
      response,
      expectedChallenge: sessionData.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

  if (verification.verified && verification.registrationInfo) {
    const { credentialPublicKey, credentialID, counter } =
      verification.registrationInfo;

    // Store credential in database
    await db.credentials.insert({
      userId,
      credentialId: credentialID,
      publicKey: credentialPublicKey,
      counter,
      transports: response.response.transports || [],
      createdAt: new Date(),
      lastUsedAt: null,
      deviceName: response.deviceName || "Unknown device",
    });

    // Clear challenge
    await session.delete(`webauthn:challenge:${userId}`);

    return { verified: true, credentialId: credentialID };
  }

  return { verified: false };
}

// --- Authentication ---

async function getAuthenticationOptions(userId?: string) {
  let allowCredentials: any[] = [];

  if (userId) {
    // If we know the user, restrict to their credentials
    const credentials = await db.credentials.findByUserId(userId);
    allowCredentials = credentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports,
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "required",
  });

  // Store challenge
  const challengeKey = userId
    ? `webauthn:challenge:${userId}`
    : `webauthn:challenge:anonymous:${options.challenge}`;

  await session.set(challengeKey, {
    challenge: options.challenge,
    expiresAt: Date.now() + 300000,
  });

  return options;
}

async function verifyAuthentication(
  response: any,
  userId?: string
): Promise<{ verified: boolean; userId?: string }> {
  // Find the credential
  const credential = await db.credentials.findByCredentialId(response.id);
  if (!credential) {
    return { verified: false };
  }

  // If userId was provided, verify it matches
  if (userId && credential.userId !== userId) {
    return { verified: false };
  }

  // Get stored challenge
  const challengeKey = userId
    ? `webauthn:challenge:${userId}`
    : `webauthn:challenge:anonymous:${response.challenge}`;
  const sessionData = await session.get(challengeKey);

  if (!sessionData || Date.now() > sessionData.expiresAt) {
    throw new Error("Challenge expired or not found");
  }

  const verification: VerifiedAuthenticationResponse =
    await verifyAuthenticationResponse({
      response,
      expectedChallenge: sessionData.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: credential.credentialId,
        credentialPublicKey: credential.publicKey,
        counter: credential.counter,
      },
      requireUserVerification: true,
    });

  if (verification.verified) {
    const { newCounter } = verification.authenticationInfo;

    // Update counter (sign count verification)
    await db.credentials.updateCounter(credential.credentialId, newCounter);
    await db.credentials.updateLastUsed(credential.credentialId, new Date());

    // Clear challenge
    await session.delete(challengeKey);

    return { verified: true, userId: credential.userId };
  }

  return { verified: false };
}
```

### Go Implementation (go-webauthn)

```go
package passkey

import (
    "encoding/json"
    "fmt"
    "net/http"
    "time"

    "github.com/go-webauthn/webauthn/protocol"
    "github.com/go-webauthn/webauthn/webauthn"
)

type PasskeyService struct {
    webAuthn      *webauthn.WebAuthn
    userStore     UserStore
    credStore     CredentialStore
    sessionStore  SessionStore
}

func NewPasskeyService(
    rpDisplayName, rpID string,
    rpOrigins []string,
    userStore UserStore,
    credStore CredentialStore,
    sessionStore SessionStore,
) (*PasskeyService, error) {
    wconfig := &webauthn.Config{
        RPDisplayName: rpDisplayName,
        RPID:          rpID,
        RPOrigins:     rpOrigins,
        AuthenticatorSelection: protocol.AuthenticatorSelection{
            ResidentKey:      protocol.ResidentKeyRequirementRequired,
            UserVerification: protocol.VerificationRequired,
        },
        Timeouts: webauthn.TimeoutsConfig{
            Login: webauthn.TimeoutConfig{
                Enforce:    true,
                Timeout:    5 * time.Minute,
            },
            Registration: webauthn.TimeoutConfig{
                Enforce:    true,
                Timeout:    5 * time.Minute,
            },
        },
    }

    w, err := webauthn.New(wconfig)
    if err != nil {
        return nil, fmt.Errorf("initializing webauthn: %w", err)
    }

    return &PasskeyService{
        webAuthn:     w,
        userStore:    userStore,
        credStore:    credStore,
        sessionStore: sessionStore,
    }, nil
}

func (s *PasskeyService) BeginRegistration(w http.ResponseWriter, r *http.Request) {
    user, err := s.getUserFromSession(r)
    if err != nil {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    options, session, err := s.webAuthn.BeginRegistration(user)
    if err != nil {
        http.Error(w, "Failed to begin registration", http.StatusInternalServerError)
        return
    }

    // Store session data for verification
    s.sessionStore.Save(r, "webauthn-registration", session)

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(options)
}

func (s *PasskeyService) FinishRegistration(w http.ResponseWriter, r *http.Request) {
    user, err := s.getUserFromSession(r)
    if err != nil {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }

    session, err := s.sessionStore.Get(r, "webauthn-registration")
    if err != nil {
        http.Error(w, "Session expired", http.StatusBadRequest)
        return
    }

    credential, err := s.webAuthn.FinishRegistration(user, *session, r)
    if err != nil {
        http.Error(w, "Registration verification failed", http.StatusBadRequest)
        return
    }

    // Store credential
    if err := s.credStore.AddCredential(user.ID(), credential); err != nil {
        http.Error(w, "Failed to store credential", http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *PasskeyService) BeginAuthentication(w http.ResponseWriter, r *http.Request) {
    // For discoverable credentials, do not specify a user
    options, session, err := s.webAuthn.BeginDiscoverableLogin()
    if err != nil {
        http.Error(w, "Failed to begin authentication", http.StatusInternalServerError)
        return
    }

    s.sessionStore.Save(r, "webauthn-authentication", session)

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(options)
}

func (s *PasskeyService) FinishAuthentication(w http.ResponseWriter, r *http.Request) {
    session, err := s.sessionStore.Get(r, "webauthn-authentication")
    if err != nil {
        http.Error(w, "Session expired", http.StatusBadRequest)
        return
    }

    // Handler to find user by credential ID
    handler := func(rawID, userHandle []byte) (webauthn.User, error) {
        return s.userStore.FindByUserHandle(userHandle)
    }

    credential, err := s.webAuthn.FinishDiscoverableLogin(handler, *session, r)
    if err != nil {
        http.Error(w, "Authentication failed", http.StatusUnauthorized)
        return
    }

    // Update sign count
    s.credStore.UpdateSignCount(credential.ID, credential.Authenticator.SignCount)

    // Create session for the authenticated user
    // ...

    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
```

### Python Implementation (py_webauthn)

```python
import json
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    ResidentKeyRequirement,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
    AuthenticatorTransport,
)

RP_ID = "example.com"
RP_NAME = "My Application"
EXPECTED_ORIGIN = "https://example.com"

def get_registration_options(user_id: bytes, user_name: str,
                              existing_credentials: list) -> str:
    """Generate registration options for a user."""
    exclude_credentials = [
        PublicKeyCredentialDescriptor(
            id=cred["credential_id"],
            transports=[AuthenticatorTransport(t) for t in cred.get("transports", [])],
        )
        for cred in existing_credentials
    ]

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=user_id,
        user_name=user_name,
        exclude_credentials=exclude_credentials,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        supported_pub_key_algs=[-7, -257],  # ES256, RS256
        timeout=300000,
    )

    return options_to_json(options), options.challenge

def complete_registration(response_json: str, expected_challenge: bytes) -> dict:
    """Verify a registration response and return credential data."""
    verification = verify_registration_response(
        credential=json.loads(response_json),
        expected_challenge=expected_challenge,
        expected_origin=EXPECTED_ORIGIN,
        expected_rp_id=RP_ID,
        require_user_verification=True,
    )

    return {
        "credential_id": verification.credential_id,
        "public_key": verification.credential_public_key,
        "sign_count": verification.sign_count,
        "aaguid": str(verification.aaguid),
    }

def get_authentication_options(credentials: list | None = None) -> tuple[str, bytes]:
    """Generate authentication options."""
    allow_credentials = None
    if credentials:
        allow_credentials = [
            PublicKeyCredentialDescriptor(
                id=cred["credential_id"],
                transports=[AuthenticatorTransport(t) for t in cred.get("transports", [])],
            )
            for cred in credentials
        ]

    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.REQUIRED,
        timeout=300000,
    )

    return options_to_json(options), options.challenge

def complete_authentication(
    response_json: str,
    expected_challenge: bytes,
    credential_public_key: bytes,
    credential_current_sign_count: int,
) -> dict:
    """Verify an authentication response."""
    verification = verify_authentication_response(
        credential=json.loads(response_json),
        expected_challenge=expected_challenge,
        expected_origin=EXPECTED_ORIGIN,
        expected_rp_id=RP_ID,
        credential_public_key=credential_public_key,
        credential_current_sign_count=credential_current_sign_count,
        require_user_verification=True,
    )

    return {
        "verified": True,
        "new_sign_count": verification.new_sign_count,
    }
```

### Sign Count Verification

The sign count is an incrementing counter maintained by the authenticator. It
increments on each authentication. The server compares the received sign count
against the stored sign count:

- If `new_sign_count > stored_sign_count`: Normal operation. Update stored count.
- If `new_sign_count <= stored_sign_count` and `new_sign_count != 0`: The
  authenticator may have been cloned. Flag the credential and require additional
  verification.
- If `new_sign_count == 0`: Some authenticators (especially synced passkeys) always
  report 0. In this case, skip sign count verification.

```typescript
async function verifySignCount(
  credentialId: string,
  newCount: number,
  storedCount: number
): Promise<{ valid: boolean; cloneDetected: boolean }> {
  if (newCount === 0) {
    // Passkey sync providers may always report 0
    return { valid: true, cloneDetected: false };
  }

  if (newCount > storedCount) {
    return { valid: true, cloneDetected: false };
  }

  // Potential cloned authenticator
  await flagCredentialForReview(credentialId);
  await notifyUser(credentialId, "Possible credential cloning detected");
  return { valid: false, cloneDetected: true };
}
```

---

## Libraries and Tools

### Recommended Libraries

| Language    | Library                    | Package                        |
|-------------|----------------------------|--------------------------------|
| TypeScript  | SimpleWebAuthn (server)    | @simplewebauthn/server         |
| TypeScript  | SimpleWebAuthn (browser)   | @simplewebauthn/browser        |
| Go          | go-webauthn                | github.com/go-webauthn/webauthn|
| Python      | py_webauthn                | webauthn                       |
| Java        | java-webauthn-server       | com.yubico:webauthn-server-core|
| Ruby        | webauthn-ruby              | webauthn                       |
| .NET        | FIDO2 .NET Library         | Fido2.AspNet                   |

### Testing Tools

- **WebAuthn Debugger:** Chrome DevTools > Application > WebAuthn for virtual authenticators.
- **FIDO Conformance Tools:** Official FIDO Alliance testing suite.
- **Passkey.io:** Interactive passkey testing and debugging.

---

## Best Practices

1. **Require `residentKey: "required"` for passkey registration.** Discoverable credentials enable username-less authentication, which is the core value proposition of passkeys. Without this, credentials are not passkeys -- they are traditional FIDO2 credentials.

2. **Implement conditional UI (autofill) for seamless passkey authentication.** Add `webauthn` to the `autocomplete` attribute on username/password fields and initiate conditional mediation on page load. This provides the best user experience by presenting passkeys alongside saved passwords.

3. **Always verify the sign count on authentication.** If the received sign count is less than or equal to the stored sign count (and not zero), flag the credential as potentially cloned. Note that synced passkeys may always report a sign count of zero, which is expected.

4. **Store challenge values server-side with a short expiration (5 minutes).** Never trust challenges sent by the client. Generate challenges using a CSPRNG with at least 16 bytes of randomness. Delete challenges after use or expiration.

5. **Use `attestation: "none"` for consumer applications.** Attestation adds complexity and provides limited benefit for most applications. Only request direct attestation in enterprise environments where authenticator verification is required by policy.

6. **Implement fallback authentication for devices without passkey support.** Always offer password + MFA as an alternative. Use feature detection to determine the user's capabilities and adapt the UI accordingly.

7. **Store credentials with transport hints.** Save the `transports` property from the registration response and include it in `allowCredentials` during authentication. This helps the browser optimize the authentication flow (e.g., activating NFC vs. USB).

8. **Display a credential management UI.** Allow users to see their registered passkeys, rename them, and delete credentials they no longer use. Show the last-used date for each credential.

9. **Use a stable, opaque user ID for the `user.id` field.** Do not use the email address or username as the user handle. Use a random UUID or database primary key. The user handle is stored on the authenticator and returned during authentication to identify the user.

10. **Test cross-platform authentication thoroughly.** Test with iOS to Windows, Android to macOS, security keys on all platforms, and third-party credential managers (1Password, Bitwarden). The hybrid transport protocol introduces additional complexity.

---

## Anti-Patterns

1. **Using email or username as the WebAuthn user ID.** The `user.id` field must be a stable, opaque identifier (UUID). If the user changes their email, using email as the user ID would break all their passkeys. Additionally, the user ID is stored on the authenticator and could leak to other origins on shared devices.

2. **Not implementing credential exclusion during registration.** Without `excludeCredentials`, users can accidentally register multiple passkeys for the same account on the same authenticator, leading to confusion. Always pass existing credential IDs to prevent duplicate registration.

3. **Trusting challenges from the client.** Challenges must be generated server-side and stored in a server-side session or cache. If the challenge is generated or stored client-side, an attacker can craft their own challenge and bypass the ceremony.

4. **Skipping user verification for primary authentication.** If passkeys replace passwords, set `userVerification: "required"`. Without user verification, anyone with physical access to the device can authenticate. User verification ensures biometric or PIN confirmation.

5. **Not handling authenticator errors gracefully.** The WebAuthn API throws `DOMException` with various names (`NotAllowedError`, `InvalidStateError`, `AbortError`). Each must be handled with appropriate user messaging. Unhandled exceptions create a poor user experience.

6. **Requiring attestation without a clear reason.** Attestation verification is complex, breaks with some authenticators, and provides minimal benefit for most applications. Requiring it without a clear enterprise need creates friction and compatibility issues.

7. **Not storing transport hints from registration.** Without transport hints in `allowCredentials`, the browser may prompt for an authenticator type that does not match the registered credential, causing authentication failures or delays.

8. **Treating passkeys as the only authentication method.** Not all users and devices support passkeys. Requiring passkeys without fallback locks out users with older browsers, older operating systems, or unsupported devices. Always maintain password + MFA as an alternative.

---

## Enforcement Checklist

### Design Phase
- [ ] Defined passkey registration and authentication flows.
- [ ] Decided on authenticator attachment strategy (platform, cross-platform, or both).
- [ ] Planned fallback authentication for unsupported devices.
- [ ] Designed credential management UI (list, rename, delete credentials).
- [ ] Defined relying party ID (domain) and origin(s).
- [ ] Planned for cross-platform authentication testing.

### Implementation Phase
- [ ] Registration options use `residentKey: "required"` for passkeys.
- [ ] `userVerification: "required"` is set for primary authentication.
- [ ] Challenges are generated server-side with CSPRNG (minimum 16 bytes).
- [ ] Challenges have a 5-minute expiration and are single-use.
- [ ] `user.id` uses a stable, opaque identifier (not email/username).
- [ ] `excludeCredentials` prevents duplicate registration.
- [ ] Transport hints are stored and included in authentication options.
- [ ] Sign count is verified and cloning is detected.
- [ ] Conditional UI is implemented with `autocomplete="username webauthn"`.
- [ ] Feature detection adapts UI based on platform capabilities.
- [ ] Fallback to password + MFA is available.
- [ ] Registration response `transports` are stored in the database.

### Testing Phase
- [ ] Registration works on iOS (Safari), Android (Chrome), Windows (Edge/Chrome), macOS (Safari/Chrome).
- [ ] Authentication works with platform authenticators on all supported platforms.
- [ ] Authentication works with roaming authenticators (USB, NFC).
- [ ] Cross-platform authentication (hybrid transport) works (phone to laptop).
- [ ] Conditional UI displays passkeys in the autofill dropdown.
- [ ] Duplicate registration is prevented by `excludeCredentials`.
- [ ] Sign count verification correctly flags potential cloning.
- [ ] Fallback authentication works when passkeys are unavailable.
- [ ] Error handling provides clear messages for all `DOMException` types.

### Deployment Phase
- [ ] HTTPS is enforced (WebAuthn requires secure context).
- [ ] Relying party ID is correctly configured for the production domain.
- [ ] Credential storage is encrypted at rest.
- [ ] Monitoring tracks passkey registration and authentication success/failure rates.
- [ ] User documentation explains how to set up and use passkeys.

### Periodic Review
- [ ] Browser and platform support matrix is updated.
- [ ] WebAuthn library is updated to the latest version.
- [ ] Credential database is reviewed for inactive or suspicious credentials.
- [ ] Cross-platform authentication is retested after platform updates.
- [ ] Passkey adoption metrics are tracked and reported.
