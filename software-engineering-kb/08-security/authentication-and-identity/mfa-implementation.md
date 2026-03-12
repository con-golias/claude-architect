# Multi-Factor Authentication Implementation Guide

## Metadata
- **Category**: Authentication and Identity
- **Priority**: Critical
- **Last Updated**: 2025-01-15
- **Standards**: RFC 6238 (TOTP), RFC 4226 (HOTP), WebAuthn Level 2, FIDO2
- **Applicable Languages**: TypeScript, Go, Python

---

## Table of Contents

1. [Overview](#overview)
2. [MFA Factor Categories](#mfa-factor-categories)
3. [TOTP Implementation (RFC 6238)](#totp-implementation)
4. [HOTP Implementation (RFC 4226)](#hotp-implementation)
5. [WebAuthn/FIDO2](#webauthn-fido2)
6. [Push Notification MFA](#push-notification-mfa)
7. [SMS OTP](#sms-otp)
8. [Email OTP](#email-otp)
9. [Backup and Recovery Codes](#backup-and-recovery-codes)
10. [MFA Fatigue and Bombing Attacks](#mfa-fatigue-and-bombing-attacks)
11. [Adaptive MFA](#adaptive-mfa)
12. [MFA Enrollment Flow](#mfa-enrollment-flow)
13. [Best Practices](#best-practices)
14. [Anti-Patterns](#anti-patterns)
15. [Enforcement Checklist](#enforcement-checklist)

---

## Overview

Multi-Factor Authentication (MFA) requires users to present two or more independent
authentication factors to verify their identity. MFA dramatically reduces the risk of
account compromise because an attacker must obtain multiple independent factors rather
than a single password. According to Microsoft, MFA blocks over 99.9% of account
compromise attacks.

This guide covers implementation details for each MFA method, from the most secure
(WebAuthn/FIDO2) to the least secure but most widely available (SMS OTP). Every
production system must offer MFA, and high-value systems must mandate it.

---

## MFA Factor Categories

Authentication factors fall into three categories:

| Factor Category        | Description                    | Examples                        |
|------------------------|--------------------------------|----------------------------------|
| Something you know     | Knowledge factor               | Password, PIN                   |
| Something you have     | Possession factor              | Phone, security key, smart card |
| Something you are      | Inherence factor               | Fingerprint, face, voice        |

True MFA requires factors from at least two different categories. A password plus a
security question is NOT MFA because both are knowledge factors. A password plus a
TOTP code IS MFA because the TOTP code requires possession of the authenticator device.

### Factor Strength Ranking

1. **WebAuthn/FIDO2 (hardware keys, passkeys)** -- Phishing-resistant, strongest factor.
2. **TOTP (authenticator apps)** -- Strong, widely supported.
3. **Push notifications (with number matching)** -- Convenient, moderately strong.
4. **Email OTP** -- Moderate security, depends on email account security.
5. **SMS OTP** -- Weakest factor, vulnerable to SIM swapping and SS7 attacks.

---

## TOTP Implementation (RFC 6238)

### Theory

TOTP (Time-based One-Time Password) generates short-lived codes using a shared secret
and the current time. The algorithm:

1. Compute `T = floor((current_unix_time - T0) / time_step)` where T0=0, time_step=30s.
2. Generate HMAC-SHA1(secret, T) -- the secret is shared between server and authenticator.
3. Dynamic truncation: extract 4 bytes from the HMAC based on the last nibble offset.
4. Compute `code = truncated_value mod 10^digits` (typically 6 digits).

### Secret Generation and Storage

Generate a 20-byte (160-bit) random secret per user using a CSPRNG. Store the secret
encrypted at rest in the database. The secret must be displayed to the user only once
during enrollment, typically as a QR code containing an `otpauth://` URI.

**otpauth URI format:**
```
otpauth://totp/{issuer}:{account}?secret={base32_secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30
```

### TypeScript Implementation

```typescript
import crypto from "crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";

interface TOTPSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
  backupCodes: string[];
}

// Configure TOTP parameters
authenticator.options = {
  digits: 6,
  step: 30,
  window: 1, // Allow 1 step before and after current time
};

async function setupTOTP(
  userId: string,
  userEmail: string,
  issuer: string
): Promise<TOTPSetupResult> {
  // Generate a cryptographically secure secret
  const secret = authenticator.generateSecret(20); // 20 bytes = 160 bits

  // Build the otpauth URL
  const otpauthUrl = authenticator.keyuri(userEmail, issuer, secret);

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Generate backup codes
  const backupCodes = generateBackupCodes(10);

  // Store encrypted secret and hashed backup codes
  // DO NOT store these in plaintext
  await storeTOTPSecret(userId, encrypt(secret));
  await storeBackupCodes(userId, backupCodes.map(hashBackupCode));

  return {
    secret,
    qrCodeDataUrl,
    otpauthUrl,
    backupCodes,
  };
}

function verifyTOTPCode(secret: string, token: string): boolean {
  // The window option allows for clock skew
  return authenticator.verify({ token, secret });
}

// Verify with replay protection
async function verifyTOTPWithReplayProtection(
  userId: string,
  secret: string,
  token: string
): Promise<boolean> {
  // Check if this token was already used
  const tokenKey = `totp:${userId}:${token}`;
  const alreadyUsed = await redis.get(tokenKey);
  if (alreadyUsed) {
    return false; // Replay attack
  }

  const isValid = authenticator.verify({ token, secret });

  if (isValid) {
    // Mark token as used, expire after 2 time steps (60s)
    await redis.set(tokenKey, "1", "EX", 60);
  }

  return isValid;
}
```

### Go Implementation

```go
package mfa

import (
    "crypto/rand"
    "encoding/base32"
    "fmt"
    "net/url"
    "time"

    "github.com/pquerna/otp"
    "github.com/pquerna/otp/totp"
    "github.com/skip2/go-qrcode"
)

type TOTPSetupResult struct {
    Secret       string
    QRCodePNG    []byte
    OTPAuthURL   string
    BackupCodes  []string
}

func SetupTOTP(userEmail, issuer string) (*TOTPSetupResult, error) {
    key, err := totp.Generate(totp.GenerateOpts{
        Issuer:      issuer,
        AccountName: userEmail,
        Period:      30,
        Digits:      otp.DigitsSix,
        Algorithm:   otp.AlgorithmSHA1,
        SecretSize:  20,
    })
    if err != nil {
        return nil, fmt.Errorf("generating TOTP key: %w", err)
    }

    // Generate QR code PNG
    qrCode, err := qrcode.Encode(key.URL(), qrcode.Medium, 256)
    if err != nil {
        return nil, fmt.Errorf("generating QR code: %w", err)
    }

    // Generate backup codes
    backupCodes, err := GenerateBackupCodes(10)
    if err != nil {
        return nil, fmt.Errorf("generating backup codes: %w", err)
    }

    return &TOTPSetupResult{
        Secret:      key.Secret(),
        QRCodePNG:   qrCode,
        OTPAuthURL:  key.URL(),
        BackupCodes: backupCodes,
    }, nil
}

func VerifyTOTP(secret, code string) bool {
    valid, err := totp.ValidateCustom(code, secret, time.Now(), totp.ValidateOpts{
        Period:    30,
        Skew:     1, // Allow 1 period before and after
        Digits:   otp.DigitsSix,
        Algorithm: otp.AlgorithmSHA1,
    })
    if err != nil {
        return false
    }
    return valid
}
```

### Python Implementation

```python
import pyotp
import qrcode
import io
import base64
import secrets

def setup_totp(user_email: str, issuer: str) -> dict:
    """Set up TOTP for a user. Returns secret, QR code, and backup codes."""
    # Generate a 20-byte random secret
    secret = pyotp.random_base32(length=32)  # 32 base32 chars = 20 bytes

    # Create TOTP instance
    totp_instance = pyotp.TOTP(secret)

    # Generate provisioning URI
    otpauth_url = totp_instance.provisioning_uri(
        name=user_email,
        issuer_name=issuer,
    )

    # Generate QR code as base64 data URL
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(otpauth_url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()

    # Generate backup codes
    backup_codes = generate_backup_codes(10)

    return {
        "secret": secret,
        "qr_code_data_url": f"data:image/png;base64,{qr_base64}",
        "otpauth_url": otpauth_url,
        "backup_codes": backup_codes,
    }


def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """Verify a TOTP code with time window tolerance."""
    totp_instance = pyotp.TOTP(secret)
    return totp_instance.verify(code, valid_window=window)
```

### Time Window Tolerance

Allow a tolerance window of +/- 1 time step (30 seconds) to account for:
- Clock skew between server and authenticator device.
- User taking time to type the code.
- Network latency.

A window of 1 means accepting codes from T-1, T, and T+1, giving an effective
validity of 90 seconds. Do not increase this beyond 1 unless necessary, as larger
windows increase the attack surface.

---

## HOTP Implementation (RFC 4226)

HOTP (HMAC-based One-Time Password) uses a counter instead of time. Each code is
valid until used, and the counter increments on each successful verification.

### Key Differences from TOTP

| Feature        | TOTP                     | HOTP                      |
|----------------|--------------------------|----------------------------|
| Based on       | Time                     | Counter                    |
| Code validity  | 30 seconds (typically)   | Until used                 |
| Synchronization| Time-based (automatic)   | Counter-based (can desync) |
| Use case       | General MFA              | Hardware tokens, legacy    |

### Counter Resynchronization

If a user generates codes without verifying them (e.g., by pressing the button on
a hardware token), the server counter falls behind. Implement a look-ahead window
of 10-20 codes to handle this. When verification succeeds at counter C+N, update
the stored counter to C+N+1.

```typescript
function verifyHOTP(secret: string, token: string, counter: number): {
  valid: boolean;
  newCounter: number;
} {
  const lookAheadWindow = 20;

  for (let i = 0; i < lookAheadWindow; i++) {
    const expectedToken = generateHOTP(secret, counter + i);
    if (constantTimeEqual(token, expectedToken)) {
      return { valid: true, newCounter: counter + i + 1 };
    }
  }

  return { valid: false, newCounter: counter };
}
```

---

## WebAuthn/FIDO2

WebAuthn provides phishing-resistant authentication using public key cryptography.
Credentials are bound to the origin (domain), making them immune to phishing attacks
because the browser enforces origin verification during the authentication ceremony.

### Registration Ceremony

```typescript
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";

const rpName = "My Application";
const rpID = "example.com";
const origin = "https://example.com";

async function startRegistration(userId: string, userName: string) {
  // Retrieve existing credentials to prevent re-registration
  const existingCredentials = await getCredentialsForUser(userId);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: userId,
    userName,
    attestationType: "none", // "none" for most use cases
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "cross-platform", // or "platform"
    },
  });

  // Store challenge for verification
  await storeChallenge(userId, options.challenge);

  return options; // Send to client
}

async function completeRegistration(
  userId: string,
  response: any
): Promise<VerifiedRegistrationResponse> {
  const expectedChallenge = await getStoredChallenge(userId);

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (verification.verified && verification.registrationInfo) {
    // Store credential
    await storeCredential(userId, {
      credentialId: verification.registrationInfo.credentialID,
      publicKey: verification.registrationInfo.credentialPublicKey,
      counter: verification.registrationInfo.counter,
      transports: response.response.transports,
    });
  }

  return verification;
}
```

### Authentication Ceremony

```typescript
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

async function startAuthentication(userId: string) {
  const credentials = await getCredentialsForUser(userId);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports,
    })),
    userVerification: "preferred",
  });

  await storeChallenge(userId, options.challenge);

  return options;
}

async function completeAuthentication(userId: string, response: any) {
  const expectedChallenge = await getStoredChallenge(userId);
  const credential = await getCredentialById(response.id);

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    authenticator: {
      credentialID: credential.credentialId,
      credentialPublicKey: credential.publicKey,
      counter: credential.counter,
    },
  });

  if (verification.verified) {
    // Update the counter to prevent replay attacks
    await updateCredentialCounter(
      credential.credentialId,
      verification.authenticationInfo.newCounter
    );
  }

  return verification;
}
```

### Go Implementation (WebAuthn)

```go
package mfa

import (
    "github.com/go-webauthn/webauthn/webauthn"
)

var webAuthn *webauthn.WebAuthn

func InitWebAuthn() error {
    var err error
    webAuthn, err = webauthn.New(&webauthn.Config{
        RPDisplayName: "My Application",
        RPID:          "example.com",
        RPOrigins:     []string{"https://example.com"},
        AuthenticatorSelection: protocol.AuthenticatorSelection{
            ResidentKey:        protocol.ResidentKeyRequirementPreferred,
            UserVerification:   protocol.VerificationPreferred,
        },
    })
    return err
}

// User must implement webauthn.User interface
type WebAuthnUser struct {
    ID          []byte
    Name        string
    DisplayName string
    Credentials []webauthn.Credential
}

func (u *WebAuthnUser) WebAuthnID() []byte                         { return u.ID }
func (u *WebAuthnUser) WebAuthnName() string                       { return u.Name }
func (u *WebAuthnUser) WebAuthnDisplayName() string                { return u.DisplayName }
func (u *WebAuthnUser) WebAuthnCredentials() []webauthn.Credential { return u.Credentials }

func BeginRegistration(user *WebAuthnUser) (*protocol.CredentialCreation, error) {
    options, session, err := webAuthn.BeginRegistration(user)
    if err != nil {
        return nil, err
    }
    // Store session data (challenge) for verification
    StoreWebAuthnSession(user.Name, session)
    return options, nil
}

func FinishRegistration(user *WebAuthnUser, response *http.Request) (*webauthn.Credential, error) {
    session := GetWebAuthnSession(user.Name)
    credential, err := webAuthn.FinishRegistration(user, *session, response)
    if err != nil {
        return nil, err
    }
    // Store the credential for the user
    user.Credentials = append(user.Credentials, *credential)
    return credential, nil
}
```

---

## Push Notification MFA

Push-based MFA sends a notification to the user's registered mobile device. The user
approves or denies the authentication request directly from the notification.

### Architecture

1. User initiates login with username and password.
2. Server sends push notification to registered device via APNs/FCM.
3. User's device displays the authentication request with context.
4. User approves or denies. The device sends the response back to the server.
5. Server completes or rejects the authentication.

### Number Matching (Critical)

Number matching is essential to prevent MFA fatigue/bombing attacks. Instead of a
simple approve/deny prompt, display a number on the login screen and require the user
to select or enter that number on their mobile device.

```typescript
interface PushMFARequest {
  userId: string;
  ipAddress: string;
  location: string;
  timestamp: Date;
  matchingNumber: number; // 2-digit number displayed on login screen
}

function generatePushRequest(userId: string, ip: string): PushMFARequest {
  const matchingNumber = crypto.randomInt(10, 99); // 2-digit number

  return {
    userId,
    ipAddress: ip,
    location: geolocateIP(ip),
    timestamp: new Date(),
    matchingNumber,
  };
}

// On the mobile device, the user must enter this number
function verifyPushResponse(
  request: PushMFARequest,
  userEnteredNumber: number
): boolean {
  return request.matchingNumber === userEnteredNumber;
}
```

### Context Display

Always display the following context in push notifications:
- Application name
- Location (city, country) based on IP geolocation
- Device and browser information
- Timestamp
- Number matching challenge

---

## SMS OTP

### Risks and Limitations

SMS OTP is the weakest form of MFA and must only be used as a fallback when stronger
methods are unavailable. Known vulnerabilities include:

1. **SIM Swapping:** An attacker convinces the mobile carrier to transfer the victim's
   phone number to a new SIM card. This is a social engineering attack against the
   carrier and requires no technical sophistication.

2. **SS7 Attacks:** The Signaling System 7 protocol used by telecom networks has known
   vulnerabilities that allow message interception. Nation-state actors and sophisticated
   attackers can intercept SMS messages in transit.

3. **Malware:** Mobile malware can read SMS messages, defeating the security of SMS OTP.

4. **Social Engineering:** Attackers may call victims and trick them into reading out
   their OTP codes.

### Implementation (When SMS OTP Is Necessary)

```typescript
interface SMSOTPConfig {
  codeLength: number;
  expirationSeconds: number;
  maxAttempts: number;
  rateLimitPerHour: number;
}

const smsConfig: SMSOTPConfig = {
  codeLength: 6,
  expirationSeconds: 300, // 5 minutes
  maxAttempts: 3,
  rateLimitPerHour: 5,
};

async function sendSMSOTP(userId: string, phoneNumber: string): Promise<void> {
  // Rate limiting
  const recentCount = await getRecentOTPCount(userId, 3600);
  if (recentCount >= smsConfig.rateLimitPerHour) {
    throw new Error("Too many OTP requests. Try again later.");
  }

  // Generate a cryptographically random code
  const code = generateNumericCode(smsConfig.codeLength);

  // Store hashed code with expiration
  const hashedCode = await hashOTPCode(code);
  await storeOTPCode(userId, hashedCode, smsConfig.expirationSeconds);

  // Send via SMS provider
  await smsProvider.send(phoneNumber, `Your verification code is: ${code}`);
}

function generateNumericCode(length: number): string {
  const max = Math.pow(10, length);
  const code = crypto.randomInt(0, max);
  return code.toString().padStart(length, "0");
}

async function verifySMSOTP(userId: string, code: string): Promise<boolean> {
  const storedData = await getStoredOTP(userId);
  if (!storedData) return false;

  // Check expiration
  if (Date.now() > storedData.expiresAt) {
    await deleteStoredOTP(userId);
    return false;
  }

  // Check attempts
  if (storedData.attempts >= smsConfig.maxAttempts) {
    await deleteStoredOTP(userId);
    return false;
  }

  // Increment attempt counter
  await incrementOTPAttempts(userId);

  // Verify code using constant-time comparison
  const hashedInput = await hashOTPCode(code);
  const isValid = crypto.timingSafeEqual(
    Buffer.from(hashedInput),
    Buffer.from(storedData.hashedCode)
  );

  if (isValid) {
    await deleteStoredOTP(userId); // Single use
  }

  return isValid;
}
```

### SMS OTP Mitigation Measures

1. Display only as a fallback option when TOTP and WebAuthn are unavailable.
2. Limit to 5 SMS OTP requests per hour per user.
3. Use 6-digit codes with a 5-minute expiration.
4. Hash stored OTP codes.
5. Invalidate code after 3 failed attempts.
6. Log and alert on unusual SMS OTP patterns (e.g., many requests from different IPs).

---

## Email OTP

Email OTP sends a one-time code to the user's registered email address. It is more
secure than SMS but depends on the security of the user's email account.

```python
import secrets
import hashlib
import time

class EmailOTPService:
    CODE_LENGTH = 6
    EXPIRATION_SECONDS = 600  # 10 minutes
    MAX_ATTEMPTS = 3

    def __init__(self, email_sender, store):
        self.email_sender = email_sender
        self.store = store

    def generate_and_send(self, user_id: str, email: str) -> None:
        """Generate an OTP code and send it via email."""
        code = self._generate_code()
        hashed_code = self._hash_code(code)

        self.store.save_otp(
            user_id=user_id,
            hashed_code=hashed_code,
            expires_at=time.time() + self.EXPIRATION_SECONDS,
            attempts=0,
        )

        self.email_sender.send(
            to=email,
            subject="Your verification code",
            body=f"Your verification code is: {code}\n\n"
                 f"This code expires in {self.EXPIRATION_SECONDS // 60} minutes.\n"
                 f"If you did not request this code, ignore this email.",
        )

    def verify(self, user_id: str, code: str) -> bool:
        """Verify an email OTP code."""
        stored = self.store.get_otp(user_id)
        if not stored:
            return False

        if time.time() > stored["expires_at"]:
            self.store.delete_otp(user_id)
            return False

        if stored["attempts"] >= self.MAX_ATTEMPTS:
            self.store.delete_otp(user_id)
            return False

        self.store.increment_attempts(user_id)

        hashed_input = self._hash_code(code)
        if secrets.compare_digest(hashed_input, stored["hashed_code"]):
            self.store.delete_otp(user_id)  # Single use
            return True

        return False

    def _generate_code(self) -> str:
        code = secrets.randbelow(10 ** self.CODE_LENGTH)
        return str(code).zfill(self.CODE_LENGTH)

    def _hash_code(self, code: str) -> str:
        return hashlib.sha256(code.encode()).hexdigest()
```

---

## Backup and Recovery Codes

Backup codes provide a fallback authentication method when the primary MFA device
is lost or unavailable. They are critical for account recovery.

### Generation Rules

1. Generate exactly 10 backup codes per enrollment.
2. Each code must be 8 alphanumeric characters, grouped as 4-4 (e.g., "ABCD-1234").
3. Use a CSPRNG for generation.
4. Hash each code individually before storage (bcrypt or SHA-256 with salt).
5. Each code is single-use. Mark as used after successful verification.
6. Display codes only once during enrollment. Require the user to acknowledge them.

### Implementation

```typescript
import crypto from "crypto";
import bcrypt from "bcrypt";

function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude ambiguous: 0/O, 1/I/L

  for (let i = 0; i < count; i++) {
    let code = "";
    for (let j = 0; j < 8; j++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      code += charset[randomIndex];
    }
    codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
  }

  return codes;
}

async function storeBackupCodes(
  userId: string,
  codes: string[]
): Promise<void> {
  const hashedCodes = await Promise.all(
    codes.map(async (code) => {
      const normalized = code.replace("-", "").toUpperCase();
      const hash = await bcrypt.hash(normalized, 10);
      return { hash, used: false };
    })
  );

  await db.backupCodes.deleteMany({ userId }); // Remove old codes
  await db.backupCodes.insertMany(
    hashedCodes.map((hc) => ({
      userId,
      codeHash: hc.hash,
      used: false,
      createdAt: new Date(),
    }))
  );
}

async function verifyBackupCode(
  userId: string,
  inputCode: string
): Promise<boolean> {
  const normalized = inputCode.replace("-", "").toUpperCase();
  const storedCodes = await db.backupCodes.find({
    userId,
    used: false,
  });

  for (const stored of storedCodes) {
    const match = await bcrypt.compare(normalized, stored.codeHash);
    if (match) {
      // Mark as used (single-use)
      await db.backupCodes.updateOne(
        { _id: stored._id },
        { $set: { used: true, usedAt: new Date() } }
      );
      return true;
    }
  }

  return false;
}
```

### Go Implementation

```go
package mfa

import (
    "crypto/rand"
    "fmt"
    "math/big"
    "strings"

    "golang.org/x/crypto/bcrypt"
)

const backupCodeCharset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func GenerateBackupCodes(count int) ([]string, error) {
    codes := make([]string, count)
    for i := 0; i < count; i++ {
        code := make([]byte, 8)
        for j := 0; j < 8; j++ {
            idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(backupCodeCharset))))
            if err != nil {
                return nil, fmt.Errorf("generating random index: %w", err)
            }
            code[j] = backupCodeCharset[idx.Int64()]
        }
        codes[i] = fmt.Sprintf("%s-%s", string(code[:4]), string(code[4:]))
    }
    return codes, nil
}

func HashBackupCode(code string) (string, error) {
    normalized := strings.ToUpper(strings.ReplaceAll(code, "-", ""))
    hash, err := bcrypt.GenerateFromPassword([]byte(normalized), 10)
    if err != nil {
        return "", err
    }
    return string(hash), nil
}

func VerifyBackupCode(code, hashedCode string) bool {
    normalized := strings.ToUpper(strings.ReplaceAll(code, "-", ""))
    err := bcrypt.CompareHashAndPassword([]byte(hashedCode), []byte(normalized))
    return err == nil
}
```

---

## MFA Fatigue and Bombing Attacks

### Attack Description

MFA fatigue (also called MFA bombing or push exhaustion) is an attack where the
adversary repeatedly triggers MFA push notifications to a victim until the victim
approves one out of frustration, confusion, or to stop the notifications. This attack
was used in the 2022 Uber breach.

### Prevention Measures

1. **Number Matching (mandatory):** Require the user to enter a number displayed
   on the login screen into the authenticator app. This prevents blind approval.

2. **Rate Limiting Push Requests:** Limit the number of MFA push notifications
   to 3 per 15-minute window. After the limit, require a different MFA method.

3. **Context Display:** Show IP address, location, device, and timestamp in push
   notifications so users can identify fraudulent requests.

4. **Deny Reporting:** When a user denies a push request, offer an option to report
   it as suspicious. Escalate to security team on repeated denials.

5. **Automatic Lockout:** After 5 consecutive denied push requests, lock the account
   and require admin intervention or a recovery flow.

6. **Notification Cooldown:** Enforce a minimum 60-second delay between push
   notifications to the same user.

```typescript
interface PushRateLimitConfig {
  maxPushesPerWindow: number;
  windowSeconds: number;
  cooldownSeconds: number;
  lockoutAfterDenials: number;
}

const pushConfig: PushRateLimitConfig = {
  maxPushesPerWindow: 3,
  windowSeconds: 900, // 15 minutes
  cooldownSeconds: 60,
  lockoutAfterDenials: 5,
};

async function canSendPush(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  // Check cooldown
  const lastPush = await getLastPushTimestamp(userId);
  if (lastPush && Date.now() - lastPush < pushConfig.cooldownSeconds * 1000) {
    return { allowed: false, reason: "cooldown_active" };
  }

  // Check rate limit
  const recentPushes = await countRecentPushes(
    userId,
    pushConfig.windowSeconds
  );
  if (recentPushes >= pushConfig.maxPushesPerWindow) {
    return { allowed: false, reason: "rate_limit_exceeded" };
  }

  // Check denial count
  const recentDenials = await countRecentDenials(userId, 3600);
  if (recentDenials >= pushConfig.lockoutAfterDenials) {
    await lockAccount(userId, "mfa_bombing_suspected");
    return { allowed: false, reason: "account_locked" };
  }

  return { allowed: true };
}
```

---

## Adaptive MFA

Adaptive (risk-based) MFA adjusts authentication requirements based on contextual
risk signals. Low-risk logins may skip MFA entirely, while high-risk logins may
require multiple additional factors.

### Risk Signals

| Signal                | Low Risk                | High Risk                    |
|-----------------------|-------------------------|-------------------------------|
| IP address            | Known, trusted IP       | New, foreign IP, VPN/Tor     |
| Geolocation           | Usual location          | Different country, impossible travel |
| Device                | Recognized device       | New device                    |
| Time of day           | Normal hours            | Unusual hours (3 AM)          |
| Login velocity        | Normal pattern          | Multiple rapid attempts       |
| Password breach       | Not breached            | Password found in breach DB   |

### Risk Score Calculation

```typescript
interface RiskSignals {
  knownIP: boolean;
  knownDevice: boolean;
  usualLocation: boolean;
  usualTime: boolean;
  impossibleTravel: boolean;
  recentFailedAttempts: number;
  passwordAge: number; // days
}

interface RiskAssessment {
  score: number; // 0-100, higher = riskier
  requiredFactors: string[];
  stepUp: boolean;
}

function assessRisk(signals: RiskSignals): RiskAssessment {
  let score = 0;

  if (!signals.knownIP) score += 20;
  if (!signals.knownDevice) score += 25;
  if (!signals.usualLocation) score += 15;
  if (!signals.usualTime) score += 10;
  if (signals.impossibleTravel) score += 40;
  score += Math.min(signals.recentFailedAttempts * 10, 30);

  let requiredFactors: string[] = ["password"];

  if (score >= 30) {
    requiredFactors.push("totp");
  }
  if (score >= 60) {
    requiredFactors.push("webauthn");
  }
  if (score >= 80) {
    // Require admin approval or block entirely
    requiredFactors.push("admin_approval");
  }

  return {
    score,
    requiredFactors,
    stepUp: score >= 30,
  };
}
```

---

## MFA Enrollment Flow

### Secure Enrollment Process

1. **Initiation:** User navigates to security settings. Require re-authentication
   (password entry) before showing MFA enrollment options.

2. **Method Selection:** Present available MFA methods ranked by security strength.
   Recommend WebAuthn/FIDO2 or TOTP as primary methods.

3. **Setup:** Guide user through method-specific setup (scan QR code, register
   security key, verify phone number).

4. **Verification:** Require the user to complete one successful MFA challenge
   before enabling MFA. For TOTP, require entering a valid code. For WebAuthn,
   require completing an authentication ceremony.

5. **Backup Codes:** Generate and display 10 backup codes. Require the user to
   acknowledge that they have saved the codes (checkbox or code entry verification).

6. **Confirmation:** Enable MFA on the account. Send a confirmation email.

### Mandatory MFA Enrollment

For organizations requiring MFA, implement a grace period flow:

```typescript
interface MFAEnrollmentPolicy {
  required: boolean;
  gracePeriodDays: number;
  allowedMethods: string[];
  minimumMethods: number;
}

async function checkMFACompliance(userId: string): Promise<{
  compliant: boolean;
  enrollmentRequired: boolean;
  gracePeriodRemaining?: number;
  redirectUrl?: string;
}> {
  const user = await getUser(userId);
  const policy = await getMFAPolicy(user.organizationId);

  if (!policy.required) {
    return { compliant: true, enrollmentRequired: false };
  }

  const methods = await getActiveMFAMethods(userId);

  if (methods.length >= policy.minimumMethods) {
    return { compliant: true, enrollmentRequired: false };
  }

  const daysSinceCreation = getDaysSince(user.createdAt);
  const gracePeriodRemaining = policy.gracePeriodDays - daysSinceCreation;

  if (gracePeriodRemaining > 0) {
    return {
      compliant: false,
      enrollmentRequired: true,
      gracePeriodRemaining,
      redirectUrl: "/settings/security/mfa-setup",
    };
  }

  // Grace period expired, block access until MFA is enrolled
  return {
    compliant: false,
    enrollmentRequired: true,
    gracePeriodRemaining: 0,
    redirectUrl: "/mfa-enrollment-required",
  };
}
```

---

## Best Practices

1. **Offer WebAuthn/FIDO2 as the primary MFA method.** It is phishing-resistant, user-friendly, and provides the strongest authentication assurance. TOTP is the recommended secondary method.

2. **Implement number matching for all push-based MFA.** Display a 2-digit number on the login screen that the user must enter in the authenticator app. This prevents MFA fatigue and bombing attacks.

3. **Always generate and display backup codes during MFA enrollment.** Generate exactly 10 codes, hash each individually before storage, enforce single-use, and require user acknowledgment before enabling MFA.

4. **Use SMS OTP only as a last-resort fallback.** Display it below stronger options, add warnings about its limitations, and enforce strict rate limiting (5 per hour). Plan to deprecate SMS OTP when adoption of stronger methods is sufficient.

5. **Implement TOTP replay protection.** Cache the most recently used TOTP code (per user) and reject reuse within the same time step. This prevents an attacker from reusing an intercepted code within the validity window.

6. **Implement adaptive/risk-based MFA.** Assess risk signals (device, location, IP, behavior) and adjust MFA requirements accordingly. Skip MFA for low-risk, trusted contexts; require additional factors for high-risk scenarios.

7. **Require re-authentication before MFA changes.** Before enrolling, modifying, or removing MFA methods, require the user to re-enter their password and complete an existing MFA challenge.

8. **Enforce rate limiting on all OTP verification endpoints.** Limit attempts per code (3 max), limit codes per hour (5 max), and implement progressive delays after failures.

9. **Store all MFA secrets encrypted at rest.** TOTP secrets, WebAuthn public keys, and phone numbers used for SMS OTP must be encrypted in the database with keys managed through a KMS or HSM.

10. **Log all MFA events for security monitoring.** Log enrollment, successful verification, failed verification, backup code usage, and MFA removal. Alert on anomalous patterns such as multiple failed MFA attempts or backup code usage.

---

## Anti-Patterns

1. **Allowing MFA bypass through account recovery flows.** If a password reset flow bypasses MFA, attackers will use password reset as the attack vector. Account recovery must also require a second factor (backup code, admin verification, or identity proofing).

2. **Storing TOTP secrets in plaintext.** TOTP secrets are symmetric keys. If an attacker dumps the database, they can generate valid TOTP codes for every user. Encrypt TOTP secrets at rest with a key managed outside the database.

3. **Using SMS OTP as the sole MFA method.** SMS is vulnerable to SIM swapping, SS7 interception, and social engineering. Always offer and recommend stronger alternatives. Never make SMS the default or only option.

4. **Implementing push MFA without number matching.** Simple approve/deny push notifications are vulnerable to MFA fatigue attacks. The 2022 Uber breach demonstrated this attack in practice. Always implement number matching.

5. **Not implementing rate limiting on MFA endpoints.** Without rate limiting, attackers can brute-force 6-digit OTP codes (1 million combinations) in minutes. Limit attempts per code and implement cooldown periods.

6. **Allowing unlimited backup code regeneration.** If users can regenerate backup codes at will without MFA verification, an attacker with session access can generate codes for later use. Require full re-authentication before regeneration.

7. **Trusting client-side MFA enforcement.** The MFA check must be enforced on the server side. Client-side checks (hiding UI elements, redirecting) can be bypassed. The server must verify MFA completion before issuing a session token.

8. **Not implementing impossible travel detection.** If a user logs in from New York and then from Tokyo 30 minutes later, this is physically impossible and indicates account compromise. Flag and challenge these scenarios with additional verification.

---

## Enforcement Checklist

### Design Phase
- [ ] Selected primary MFA method (WebAuthn/FIDO2 or TOTP recommended).
- [ ] Defined fallback methods and their priority order.
- [ ] Designed MFA enrollment flow with backup code generation.
- [ ] Defined adaptive MFA risk signals and thresholds.
- [ ] Planned MFA recovery flow (backup codes, admin recovery).
- [ ] Defined rate limiting thresholds for all MFA endpoints.

### Implementation Phase
- [ ] TOTP implementation uses RFC 6238 with SHA-1, 6 digits, 30-second step.
- [ ] TOTP secret is generated using CSPRNG (minimum 20 bytes).
- [ ] TOTP time window tolerance is set to +/- 1 step.
- [ ] TOTP replay protection is implemented (reject recently used codes).
- [ ] WebAuthn registration and authentication ceremonies are implemented.
- [ ] WebAuthn sign count verification is implemented to detect cloned keys.
- [ ] Push MFA includes number matching.
- [ ] Push MFA includes rate limiting and cooldown periods.
- [ ] SMS OTP uses CSPRNG for code generation (not sequential or predictable).
- [ ] SMS OTP codes have a maximum 5-minute expiration.
- [ ] SMS OTP attempts are limited to 3 per code.
- [ ] Backup codes: 10 generated, individually hashed, single-use.
- [ ] All MFA secrets are encrypted at rest.
- [ ] MFA enrollment requires re-authentication.
- [ ] MFA removal requires re-authentication and MFA verification.

### Testing Phase
- [ ] Unit tests cover TOTP generation and verification with time skew.
- [ ] Unit tests verify backup code generation, hashing, and single-use enforcement.
- [ ] Integration tests verify WebAuthn registration and authentication flows.
- [ ] Security tests confirm rate limiting works correctly.
- [ ] Security tests confirm MFA cannot be bypassed through alternative endpoints.
- [ ] Recovery flow tests verify backup code authentication works.

### Deployment Phase
- [ ] MFA enrollment is available and promoted to all users.
- [ ] Mandatory MFA policy is enforced for privileged accounts.
- [ ] Monitoring and alerting configured for MFA-related events.
- [ ] Incident response plan covers MFA bypass scenarios.
- [ ] Documentation and user guides available for all MFA methods.

### Periodic Review
- [ ] MFA adoption metrics are tracked and reported.
- [ ] SMS OTP deprecation timeline is reviewed.
- [ ] Push notification fatigue attack patterns are monitored.
- [ ] Backup code usage is monitored (high usage may indicate enrollment issues).
- [ ] WebAuthn authenticator firmware and security advisories are tracked.
