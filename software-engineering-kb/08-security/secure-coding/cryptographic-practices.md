# Cryptographic Practices

> **Domain:** Security > Secure Coding > Cryptographic Practices
> **Difficulty:** Advanced
> **Last Updated:** --

## Why It Matters

Cryptography is the last line of defense. When every other security control fails -- when the firewall is breached, when the database is exfiltrated, when the backup is stolen -- encryption is what stands between an attacker and your users' data. But cryptography is unforgiving: a single misused nonce, a deprecated algorithm, or a predictable random number generator can reduce a theoretically unbreakable cipher to plaintext. The difference between "encrypted" and "secure" lies entirely in the implementation details.

This guide covers every cryptographic primitive a production system needs: symmetric encryption, asymmetric encryption, digital signatures, hashing, password hashing, key derivation, random number generation, envelope encryption, key management, and the pitfalls that break each one. Every recommendation follows NIST, IETF, and OWASP standards. Every code example uses battle-tested libraries -- never hand-rolled cryptography.

---

## Symmetric Encryption

Symmetric encryption uses the same key for encryption and decryption. It is fast, efficient, and the correct choice for encrypting data at rest and in transit.

### Algorithm Selection

```
Symmetric Encryption Decision:

  Need to encrypt data?
       |
       v
  +----------------------------+
  | AES-256-GCM                |  <-- DEFAULT CHOICE
  | Authenticated encryption   |
  | NIST standard              |
  | Hardware-accelerated (AES-NI) |
  +----------------------------+
       |
       | Not available (embedded/mobile/no AES-NI)?
       v
  +----------------------------+
  | ChaCha20-Poly1305          |  <-- MOBILE / IoT
  | Authenticated encryption   |
  | No hardware dependency     |
  | Faster in software-only    |
  +----------------------------+
       |
       | Legacy system, cannot upgrade?
       v
  +----------------------------+
  | AES-256-CBC + HMAC-SHA256  |  <-- LEGACY ONLY
  | Encrypt-then-MAC required  |
  | Must be authenticated      |
  | Migrate to GCM when able   |
  +----------------------------+
```

### AES-256-GCM -- Preferred

AES-256-GCM provides authenticated encryption with associated data (AEAD). It encrypts and authenticates in a single operation, producing both ciphertext and an authentication tag. Tampering with the ciphertext or the IV causes decryption to fail. This eliminates entire classes of attacks (padding oracle, bit-flipping).

**TypeScript (Node.js crypto):**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits -- required for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

function encrypt(plaintext: Buffer, key: Buffer): EncryptedPayload {
  // Generate a unique IV for EVERY encryption operation -- NEVER reuse
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return { ciphertext, iv, authTag };
}

function decrypt(payload: EncryptedPayload, key: Buffer): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, payload.iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(payload.authTag);

  const plaintext = Buffer.concat([
    decipher.update(payload.ciphertext),
    decipher.final(), // Throws if auth tag verification fails
  ]);
  return plaintext;
}

// Serialize for storage: IV || AuthTag || Ciphertext
function serialize(payload: EncryptedPayload): Buffer {
  return Buffer.concat([payload.iv, payload.authTag, payload.ciphertext]);
}

function deserialize(data: Buffer): EncryptedPayload {
  return {
    iv: data.subarray(0, IV_LENGTH),
    authTag: data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH),
    ciphertext: data.subarray(IV_LENGTH + TAG_LENGTH),
  };
}
```

**Go (crypto/aes, crypto/cipher):**

```go
package encryption

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "errors"
    "io"
)

const (
    NonceSize = 12 // 96 bits for GCM
    KeySize   = 32 // 256 bits
)

func Encrypt(plaintext, key []byte) ([]byte, error) {
    if len(key) != KeySize {
        return nil, errors.New("key must be 32 bytes for AES-256")
    }

    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }

    // Generate random nonce -- NEVER reuse with the same key
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, err
    }

    // Seal appends ciphertext + auth tag to nonce
    // Output: nonce || ciphertext || tag
    return gcm.Seal(nonce, nonce, plaintext, nil), nil
}

func Decrypt(ciphertext, key []byte) ([]byte, error) {
    if len(key) != KeySize {
        return nil, errors.New("key must be 32 bytes for AES-256")
    }

    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }

    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }

    if len(ciphertext) < gcm.NonceSize() {
        return nil, errors.New("ciphertext too short")
    }

    nonce := ciphertext[:gcm.NonceSize()]
    ciphertext = ciphertext[gcm.NonceSize():]

    // Open verifies the auth tag and decrypts
    return gcm.Open(nil, nonce, ciphertext, nil)
}
```

**Python (cryptography library):**

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

def encrypt(plaintext: bytes, key: bytes) -> bytes:
    """Encrypt with AES-256-GCM. Returns nonce || ciphertext || tag."""
    if len(key) != 32:
        raise ValueError("Key must be 32 bytes for AES-256")

    nonce = os.urandom(12)  # 96-bit nonce -- unique per encryption
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ciphertext  # nonce || ciphertext+tag


def decrypt(data: bytes, key: bytes) -> bytes:
    """Decrypt AES-256-GCM. Input: nonce || ciphertext || tag."""
    if len(key) != 32:
        raise ValueError("Key must be 32 bytes for AES-256")

    nonce = data[:12]
    ciphertext = data[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)
```

**Java (javax.crypto):**

```java
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.security.SecureRandom;

public class AesGcmEncryption {
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int TAG_BIT_LENGTH = 128;
    private static final int IV_BYTE_LENGTH = 12;
    private static final int KEY_BIT_LENGTH = 256;

    public static SecretKey generateKey() throws Exception {
        KeyGenerator keyGen = KeyGenerator.getInstance("AES");
        keyGen.init(KEY_BIT_LENGTH, SecureRandom.getInstanceStrong());
        return keyGen.generateKey();
    }

    public static byte[] encrypt(byte[] plaintext, SecretKey key) throws Exception {
        byte[] iv = new byte[IV_BYTE_LENGTH];
        SecureRandom.getInstanceStrong().nextBytes(iv);

        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BIT_LENGTH, iv));

        byte[] ciphertext = cipher.doFinal(plaintext);

        // Prepend IV to ciphertext: IV || ciphertext || tag
        byte[] output = new byte[iv.length + ciphertext.length];
        System.arraycopy(iv, 0, output, 0, iv.length);
        System.arraycopy(ciphertext, 0, output, iv.length, ciphertext.length);
        return output;
    }

    public static byte[] decrypt(byte[] data, SecretKey key) throws Exception {
        byte[] iv = new byte[IV_BYTE_LENGTH];
        System.arraycopy(data, 0, iv, 0, IV_BYTE_LENGTH);

        byte[] ciphertext = new byte[data.length - IV_BYTE_LENGTH];
        System.arraycopy(data, IV_BYTE_LENGTH, ciphertext, 0, ciphertext.length);

        Cipher cipher = Cipher.getInstance(ALGORITHM);
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BIT_LENGTH, iv));
        return cipher.doFinal(ciphertext);
    }
}
```

**C# (System.Security.Cryptography):**

```csharp
using System.Security.Cryptography;

public static class AesGcmEncryption
{
    private const int NonceSize = 12;  // 96 bits
    private const int TagSize = 16;    // 128 bits
    private const int KeySize = 32;    // 256 bits

    public static byte[] Encrypt(byte[] plaintext, byte[] key)
    {
        if (key.Length != KeySize)
            throw new ArgumentException("Key must be 32 bytes for AES-256");

        var nonce = new byte[NonceSize];
        RandomNumberGenerator.Fill(nonce);

        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, plaintext, ciphertext, tag);

        // Output: nonce || tag || ciphertext
        var result = new byte[NonceSize + TagSize + ciphertext.Length];
        Buffer.BlockCopy(nonce, 0, result, 0, NonceSize);
        Buffer.BlockCopy(tag, 0, result, NonceSize, TagSize);
        Buffer.BlockCopy(ciphertext, 0, result, NonceSize + TagSize, ciphertext.Length);
        return result;
    }

    public static byte[] Decrypt(byte[] data, byte[] key)
    {
        if (key.Length != KeySize)
            throw new ArgumentException("Key must be 32 bytes for AES-256");

        var nonce = data.AsSpan(0, NonceSize);
        var tag = data.AsSpan(NonceSize, TagSize);
        var ciphertext = data.AsSpan(NonceSize + TagSize);
        var plaintext = new byte[ciphertext.Length];

        using var aes = new AesGcm(key, TagSize);
        aes.Decrypt(nonce, ciphertext, tag, plaintext);
        return plaintext;
    }
}
```

**Rust (aes-gcm crate):**

```rust
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use aes_gcm::aead::rand_core::RngCore;

const NONCE_SIZE: usize = 12;

pub fn encrypt(plaintext: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, aes_gcm::Error> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| aes_gcm::Error)?;

    let mut nonce_bytes = [0u8; NONCE_SIZE];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher.encrypt(nonce, plaintext)?;

    // Output: nonce || ciphertext || tag
    let mut output = Vec::with_capacity(NONCE_SIZE + ciphertext.len());
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

pub fn decrypt(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, aes_gcm::Error> {
    if data.len() < NONCE_SIZE {
        return Err(aes_gcm::Error);
    }

    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|_| aes_gcm::Error)?;

    let nonce = Nonce::from_slice(&data[..NONCE_SIZE]);
    let ciphertext = &data[NONCE_SIZE..];

    cipher.decrypt(nonce, ciphertext)
}
```

### ChaCha20-Poly1305 -- Mobile and IoT

Use ChaCha20-Poly1305 when AES hardware acceleration (AES-NI) is unavailable. It is faster than AES in pure software and provides the same AEAD guarantees.

```python
# Python -- ChaCha20-Poly1305
from cryptography.hazmat.primitives.ciphers.aead import ChaCha20Poly1305
import os

def encrypt_chacha(plaintext: bytes, key: bytes) -> bytes:
    """ChaCha20-Poly1305 encryption. Key must be 32 bytes."""
    nonce = os.urandom(12)
    chacha = ChaCha20Poly1305(key)
    ciphertext = chacha.encrypt(nonce, plaintext, None)
    return nonce + ciphertext

def decrypt_chacha(data: bytes, key: bytes) -> bytes:
    nonce = data[:12]
    ciphertext = data[12:]
    chacha = ChaCha20Poly1305(key)
    return chacha.decrypt(nonce, ciphertext, None)
```

```go
// Go -- ChaCha20-Poly1305
import "golang.org/x/crypto/chacha20poly1305"

func EncryptChaCha(plaintext, key []byte) ([]byte, error) {
    aead, err := chacha20poly1305.New(key)
    if err != nil {
        return nil, err
    }

    nonce := make([]byte, aead.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, err
    }

    return aead.Seal(nonce, nonce, plaintext, nil), nil
}
```

---

## Asymmetric Encryption

Asymmetric encryption uses a key pair: a public key for encryption and a private key for decryption. It is slow -- 100 to 1000 times slower than symmetric encryption -- and must never be used to encrypt bulk data directly.

### When to Use Asymmetric vs. Symmetric

```
Use asymmetric encryption when:
  - Two parties need to communicate without a pre-shared secret
  - Key exchange is needed (TLS handshake)
  - Digital signatures are needed (JWT, code signing)
  - Encrypting small payloads (symmetric keys, tokens)

Use symmetric encryption when:
  - Encrypting data at rest (files, database columns)
  - Encrypting bulk data (any payload larger than a few hundred bytes)
  - Both parties already share a key
  - Performance matters (high throughput)

Common pattern: Use asymmetric to exchange a symmetric key,
then use symmetric for bulk encryption (this is how TLS works).
```

### RSA-OAEP (2048+ bits)

RSA-OAEP (Optimal Asymmetric Encryption Padding) is the current standard for RSA encryption. NEVER use RSA PKCS#1 v1.5 padding -- it is vulnerable to Bleichenbacher's attack.

```typescript
// TypeScript -- RSA-OAEP key generation and encryption
import { generateKeyPairSync, publicEncrypt, privateDecrypt, constants } from "crypto";

// Generate RSA key pair -- minimum 2048 bits, prefer 4096
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function rsaEncrypt(plaintext: Buffer, pubKey: string): Buffer {
  return publicEncrypt(
    {
      key: pubKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    plaintext
  );
}

function rsaDecrypt(ciphertext: Buffer, privKey: string): Buffer {
  return privateDecrypt(
    {
      key: privKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    ciphertext
  );
}
```

```python
# Python -- RSA-OAEP
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import hashes

private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=4096,
)
public_key = private_key.public_key()

def rsa_encrypt(plaintext: bytes, pub_key) -> bytes:
    return pub_key.encrypt(
        plaintext,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )

def rsa_decrypt(ciphertext: bytes, priv_key) -> bytes:
    return priv_key.decrypt(
        ciphertext,
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )
```

---

## Digital Signatures

Digital signatures prove authenticity (the message came from the claimed sender) and integrity (the message was not modified). They use asymmetric key pairs: the private key signs, the public key verifies.

### Algorithm Selection

```
Digital Signature Decision:

  Ed25519          <-- PREFERRED. Fast, small keys, no parameter choices.
  ECDSA (P-256)    <-- Widely supported. Required by some standards.
  RSA-PSS (2048+)  <-- Legacy compatibility. Large keys and signatures.

  NEVER use RSA PKCS#1 v1.5 signatures for new systems.
```

### Ed25519 -- Preferred

```typescript
// TypeScript -- Ed25519 sign and verify
import { generateKeyPairSync, sign, verify } from "crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function signMessage(message: Buffer, privKey: string): Buffer {
  return sign(null, message, privKey); // Ed25519 does not need a hash param
}

function verifySignature(message: Buffer, signature: Buffer, pubKey: string): boolean {
  return verify(null, message, pubKey, signature);
}
```

```go
// Go -- Ed25519
import (
    "crypto/ed25519"
    "crypto/rand"
)

func GenerateKeyPair() (ed25519.PublicKey, ed25519.PrivateKey, error) {
    return ed25519.GenerateKey(rand.Reader)
}

func Sign(message []byte, privateKey ed25519.PrivateKey) []byte {
    return ed25519.Sign(privateKey, message)
}

func Verify(message, signature []byte, publicKey ed25519.PublicKey) bool {
    return ed25519.Verify(publicKey, message, signature)
}
```

```python
# Python -- Ed25519
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

private_key = Ed25519PrivateKey.generate()
public_key = private_key.public_key()

def sign_message(message: bytes, priv_key) -> bytes:
    return priv_key.sign(message)

def verify_signature(message: bytes, signature: bytes, pub_key) -> bool:
    try:
        pub_key.verify(signature, message)
        return True
    except Exception:
        return False
```

```java
// Java -- Ed25519 (Java 15+)
import java.security.KeyPairGenerator;
import java.security.KeyPair;
import java.security.Signature;

KeyPairGenerator kpg = KeyPairGenerator.getInstance("Ed25519");
KeyPair keyPair = kpg.generateKeyPair();

// Sign
Signature signer = Signature.getInstance("Ed25519");
signer.initSign(keyPair.getPrivate());
signer.update(message);
byte[] signature = signer.sign();

// Verify
Signature verifier = Signature.getInstance("Ed25519");
verifier.initVerify(keyPair.getPublic());
verifier.update(message);
boolean valid = verifier.verify(signature);
```

### Use Cases for Digital Signatures

- **JWT tokens:** Sign claims with Ed25519 or RS256. Verify on every request.
- **Code signing:** Sign release artifacts. Verify before deployment.
- **Document signing:** Sign contracts, invoices. Non-repudiation.
- **API request signing:** Sign request body + timestamp. Prevents replay and tampering.
- **Git commits:** Sign commits with GPG/SSH keys. Verify contributor identity.

---

## Hashing

A hash function takes arbitrary input and produces a fixed-size output (digest). It is a one-way function: you cannot recover the input from the output. Hashing is NOT encryption -- there is no key and no way to reverse it.

### When to Hash vs. When to Encrypt

```
HASH when:
  - You never need the original data back
  - File integrity checks (checksums)
  - Content addressing (deduplication, CAS)
  - Data integrity verification
  - Commit identifiers, ETags

ENCRYPT when:
  - You need the original data back later
  - Storing sensitive data (SSN, credit cards)
  - Transmitting confidential data
  - Data at rest protection
```

### Algorithm Selection

| Algorithm | Output Size | Status | Use Case |
|-----------|-------------|--------|----------|
| SHA-256 | 256 bits | Standard, recommended | General purpose, checksums, integrity |
| SHA-3 (SHA3-256) | 256 bits | Standard, recommended | When SHA-2 diversity is needed |
| BLAKE2b | Up to 512 bits | Recommended | High performance, file hashing |
| BLAKE3 | 256 bits | Recommended | Highest performance, parallelizable |
| MD5 | 128 bits | **BROKEN** | NEVER use for security |
| SHA-1 | 160 bits | **BROKEN** | NEVER use for security |

```typescript
// TypeScript -- SHA-256 hashing
import { createHash } from "crypto";

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

// File integrity check
import { createReadStream } from "fs";

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}
```

```go
// Go -- SHA-256
import (
    "crypto/sha256"
    "encoding/hex"
    "io"
    "os"
)

func SHA256Hash(data []byte) string {
    h := sha256.Sum256(data)
    return hex.EncodeToString(h[:])
}

func HashFile(path string) (string, error) {
    f, err := os.Open(path)
    if err != nil {
        return "", err
    }
    defer f.Close()

    h := sha256.New()
    if _, err := io.Copy(h, f); err != nil {
        return "", err
    }
    return hex.EncodeToString(h.Sum(nil)), nil
}
```

```python
# Python -- SHA-256 and BLAKE2b
import hashlib

def sha256_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def blake2b_hash(data: bytes) -> str:
    return hashlib.blake2b(data, digest_size=32).hexdigest()

# File integrity
def hash_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()
```

---

## Password Hashing

General-purpose hash functions (SHA-256, BLAKE2) are WRONG for passwords. They are designed to be fast -- an attacker with a GPU can compute billions of SHA-256 hashes per second. Password hashing algorithms are deliberately slow, memory-intensive, and resistant to parallelization.

### Algorithm Selection

```
Password Hashing Decision:

  Argon2id    <-- PREFERRED. Winner of the Password Hashing Competition.
                  Memory-hard, resistant to GPU and ASIC attacks.

  bcrypt      <-- WIDELY SUPPORTED. Good default when Argon2 is unavailable.
                  CPU-hard. 72-byte password limit.

  scrypt      <-- MEMORY-HARD alternative. Used by some cryptocurrency systems.
                  More complex to tune than Argon2.

  PBKDF2      <-- LEGACY. Only acceptable with >= 600,000 iterations (OWASP 2023).
                  NOT memory-hard. Vulnerable to GPU attacks.

  NEVER use: MD5, SHA-1, SHA-256, SHA-3, BLAKE2 for password hashing.
  NEVER use: unsalted hashes, single-iteration hashes, or reversible encryption.
```

### Work Factor Tuning

Target: password hashing should take 250ms to 1 second on your production hardware. Measure and adjust.

```python
# Python -- Argon2id (preferred)
from argon2 import PasswordHasher

# OWASP recommended parameters for Argon2id:
# memory_cost: 19456 KB (19 MB minimum), time_cost: 2, parallelism: 1
ph = PasswordHasher(
    time_cost=2,        # Number of iterations
    memory_cost=65536,  # 64 MB of memory
    parallelism=1,      # Degree of parallelism
    hash_len=32,        # Output hash length
    salt_len=16,        # Salt length
    type=argon2.Type.ID # Argon2id variant
)

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        return ph.verify(hashed, password)
    except Exception:
        return False

# Check if rehash is needed (parameters changed)
def needs_rehash(hashed: str) -> bool:
    return ph.check_needs_rehash(hashed)
```

```typescript
// TypeScript -- bcrypt
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12; // Adjust: should take ~250ms on your hardware

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash); // Constant-time comparison built in
}
```

```go
// Go -- bcrypt
import "golang.org/x/crypto/bcrypt"

func HashPassword(password string) (string, error) {
    hash, err := bcrypt.GenerateFromPassword(
        []byte(password),
        bcrypt.DefaultCost, // Cost of 10 -- adjust for your hardware
    )
    return string(hash), err
}

func VerifyPassword(password, hash string) bool {
    err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
    return err == nil
}
```

```java
// Java -- Argon2 (via Bouncy Castle or de.mkammerer.argon2)
import de.mkammerer.argon2.Argon2;
import de.mkammerer.argon2.Argon2Factory;

Argon2 argon2 = Argon2Factory.create(Argon2Factory.Argon2Types.ARGON2id);

String hash = argon2.hash(
    2,      // iterations
    65536,  // memory in KB (64 MB)
    1,      // parallelism
    password.toCharArray()
);

boolean valid = argon2.verify(hash, password.toCharArray());
```

---

## Key Derivation Functions

Key Derivation Functions (KDFs) derive one or more cryptographic keys from a source of key material (a password, a shared secret, or a master key). They are distinct from password hashing: KDFs produce key material for encryption, while password hashes produce verifiable digests.

### HKDF -- Deriving Keys from High-Entropy Input

Use HKDF when the input already has high entropy (a Diffie-Hellman shared secret, a master key). HKDF is NOT suitable for passwords.

```typescript
// TypeScript -- HKDF: derive multiple keys from one master key
import { hkdfSync } from "crypto";

function deriveKeys(masterKey: Buffer, salt: Buffer) {
  // Derive separate keys for different purposes
  const encryptionKey = Buffer.from(
    hkdfSync("sha256", masterKey, salt, "encryption", 32)
  );
  const signingKey = Buffer.from(
    hkdfSync("sha256", masterKey, salt, "signing", 32)
  );
  const authKey = Buffer.from(
    hkdfSync("sha256", masterKey, salt, "authentication", 32)
  );

  return { encryptionKey, signingKey, authKey };
}
```

```go
// Go -- HKDF
import (
    "crypto/sha256"
    "golang.org/x/crypto/hkdf"
    "io"
)

func DeriveKey(masterKey, salt, info []byte, length int) ([]byte, error) {
    reader := hkdf.New(sha256.New, masterKey, salt, info)
    key := make([]byte, length)
    if _, err := io.ReadFull(reader, key); err != nil {
        return nil, err
    }
    return key, nil
}
```

### PBKDF2 -- Deriving Keys from Passwords

Use PBKDF2 only when Argon2 or scrypt is unavailable. Minimum 600,000 iterations with SHA-256 (OWASP 2023).

```python
# Python -- PBKDF2 key derivation
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import os

def derive_key_from_password(password: str, salt: bytes = None) -> tuple[bytes, bytes]:
    """Derive a 256-bit encryption key from a password."""
    if salt is None:
        salt = os.urandom(16)  # Always generate a unique salt

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=600_000,  # OWASP 2023 minimum
    )
    key = kdf.derive(password.encode())
    return key, salt
```

### Salt Generation

Always generate a unique salt for every password hash or key derivation. Salts prevent rainbow table attacks and ensure identical passwords produce different hashes.

```
Salt rules:
  - Minimum 16 bytes (128 bits) of cryptographically random data
  - Unique per user, per password, per operation
  - Stored alongside the hash (not secret, but must be unique)
  - Generated with CSPRNG (see Random Number Generation section)
```

---

## Random Number Generation

Cryptographic security depends on unpredictable randomness. Using a weak random source for keys, IVs, nonces, or tokens makes the entire system breakable regardless of algorithm choice.

### CSPRNG -- The Only Acceptable Source

```
SECURE random sources (CSPRNG):
  - Node.js:   crypto.randomBytes(), crypto.randomUUID()
  - Go:        crypto/rand.Read(), crypto/rand.Reader
  - Python:    secrets.token_bytes(), secrets.token_hex(), os.urandom()
  - Java:      SecureRandom.getInstanceStrong()
  - C#:        RandomNumberGenerator.Fill(), RandomNumberGenerator.GetBytes()
  - Rust:      rand::rngs::OsRng, getrandom crate

INSECURE random sources (NEVER use for security):
  - JavaScript: Math.random()          -- predictable, not cryptographic
  - Go:         math/rand              -- seeded PRNG, predictable
  - Python:     random.random()        -- Mersenne Twister, predictable
  - Java:       java.util.Random       -- linear congruential, predictable
  - C:          rand(), srand()        -- trivially predictable
  - C#:         System.Random          -- not cryptographic
  - Rust:       rand::thread_rng()     -- acceptable for non-security use only
```

```typescript
// TypeScript -- Secure random generation
import { randomBytes, randomUUID } from "crypto";

// Generate a 256-bit key
const key = randomBytes(32);

// Generate a secure token
const token = randomBytes(48).toString("base64url");

// Generate a UUID v4
const id = randomUUID();

// WRONG -- NEVER use for security
// const insecureToken = Math.random().toString(36); // PREDICTABLE
```

```go
// Go -- Secure random generation
import "crypto/rand"

func GenerateKey(size int) ([]byte, error) {
    key := make([]byte, size)
    _, err := rand.Read(key)
    return key, err
}

// WRONG: math/rand is NOT cryptographically secure
// import "math/rand"
// key := make([]byte, 32)
// rand.Read(key) // INSECURE -- predictable output
```

```python
# Python -- Secure random generation
import secrets
import os

# Generate a 256-bit key
key = secrets.token_bytes(32)

# Generate a URL-safe token
token = secrets.token_urlsafe(48)

# Generate a hex token
hex_token = secrets.token_hex(32)

# Also acceptable
key_alt = os.urandom(32)

# WRONG -- NEVER use for security
# import random
# token = random.getrandbits(256)  # PREDICTABLE -- Mersenne Twister
```

```java
// Java -- Secure random generation
import java.security.SecureRandom;

SecureRandom sr = SecureRandom.getInstanceStrong();
byte[] key = new byte[32];
sr.nextBytes(key);

// WRONG -- NEVER use for security
// java.util.Random rand = new java.util.Random();
// rand.nextBytes(key); // PREDICTABLE -- linear congruential generator
```

---

## Envelope Encryption

Envelope encryption separates the data encryption key (DEK) from the key encryption key (KEK). The DEK encrypts the data. The KEK (stored in a KMS) encrypts the DEK. This limits the amount of data encrypted under any single key and enables efficient key rotation.

```
Envelope Encryption Flow:

  ENCRYPT:
  1. Generate random DEK (256-bit AES key)
  2. Encrypt data with DEK (AES-256-GCM)
  3. Encrypt DEK with KEK (via KMS API call)
  4. Store: encrypted_data + encrypted_DEK + IV + metadata
  5. Discard plaintext DEK from memory

  DECRYPT:
  1. Read encrypted_DEK from storage
  2. Decrypt DEK with KEK (via KMS API call)
  3. Decrypt data with plaintext DEK
  4. Discard plaintext DEK from memory

  KEY ROTATION:
  1. Decrypt DEK with old KEK
  2. Re-encrypt DEK with new KEK
  3. Store new encrypted_DEK
  -- Data is NOT re-encrypted -- only the DEK wrapper changes
```

### Implementation

```typescript
// TypeScript -- Envelope encryption with AWS KMS
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const kms = new KMSClient({ region: "us-east-1" });
const KEK_ARN = "arn:aws:kms:us-east-1:123456789:key/your-kms-key-id";

interface EnvelopeEncryptedData {
  encryptedDEK: Buffer;     // DEK encrypted by KMS
  iv: Buffer;               // IV for AES-GCM
  authTag: Buffer;          // Authentication tag
  ciphertext: Buffer;       // Data encrypted with DEK
}

async function envelopeEncrypt(plaintext: Buffer): Promise<EnvelopeEncryptedData> {
  // Step 1-2: KMS generates DEK and returns both plaintext and encrypted versions
  const { Plaintext: plaintextDEK, CiphertextBlob: encryptedDEK } =
    await kms.send(
      new GenerateDataKeyCommand({
        KeyId: KEK_ARN,
        KeySpec: "AES_256",
      })
    );

  // Step 3: Encrypt data with plaintext DEK
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(plaintextDEK!), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Step 4: Zero out plaintext DEK from memory
  Buffer.from(plaintextDEK!).fill(0);

  return {
    encryptedDEK: Buffer.from(encryptedDEK!),
    iv,
    authTag,
    ciphertext,
  };
}

async function envelopeDecrypt(data: EnvelopeEncryptedData): Promise<Buffer> {
  // Step 1: Decrypt DEK using KMS
  const { Plaintext: plaintextDEK } = await kms.send(
    new DecryptCommand({
      CiphertextBlob: data.encryptedDEK,
    })
  );

  // Step 2: Decrypt data with DEK
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(plaintextDEK!),
    data.iv
  );
  decipher.setAuthTag(data.authTag);
  const plaintext = Buffer.concat([
    decipher.update(data.ciphertext),
    decipher.final(),
  ]);

  // Step 3: Zero out plaintext DEK
  Buffer.from(plaintextDEK!).fill(0);

  return plaintext;
}
```

```python
# Python -- Envelope encryption with GCP Cloud KMS
from google.cloud import kms_v1
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

KMS_KEY_NAME = "projects/my-project/locations/global/keyRings/my-ring/cryptoKeys/my-key"

def envelope_encrypt(plaintext: bytes) -> dict:
    """Encrypt data using envelope encryption with GCP KMS."""
    # Generate a random DEK
    dek = os.urandom(32)

    # Encrypt data with DEK
    nonce = os.urandom(12)
    aesgcm = AESGCM(dek)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)

    # Encrypt DEK with KEK via KMS
    client = kms_v1.KeyManagementServiceClient()
    response = client.encrypt(
        request={"name": KMS_KEY_NAME, "plaintext": dek}
    )

    # Zero out plaintext DEK
    dek = b"\x00" * 32

    return {
        "encrypted_dek": response.ciphertext,
        "nonce": nonce,
        "ciphertext": ciphertext,
    }

def envelope_decrypt(data: dict) -> bytes:
    """Decrypt envelope-encrypted data."""
    client = kms_v1.KeyManagementServiceClient()
    response = client.decrypt(
        request={"name": KMS_KEY_NAME, "ciphertext": data["encrypted_dek"]}
    )

    aesgcm = AESGCM(response.plaintext)
    return aesgcm.decrypt(data["nonce"], data["ciphertext"], None)
```

---

## Key Management

Key management is the most operationally difficult part of cryptography. A perfect algorithm with poor key management provides no security.

### Key Lifecycle

```
Key Lifecycle:

  Generation -----> Storage -----> Usage -----> Rotation -----> Destruction
      |                |              |              |                |
  CSPRNG only     Never in code   Audit access  Periodic +       Crypto-shred
  Full entropy    KMS / HSM       Least priv    on compromise    Zero memory
  Correct size    Encrypted       Log usage     Re-wrap DEKs     Purge backups
```

### Key Hierarchy

```
Key Hierarchy (defense in depth for keys):

  +-------------------------------+
  | Root Key (HSM-protected)      |  Never leaves hardware
  | Owner: Security team          |
  +-------------------------------+
               |
               v
  +-------------------------------+
  | Master Key / KEK (KMS)        |  Encrypts/decrypts DEKs
  | Owner: Platform team          |  Rotated annually
  +-------------------------------+
               |
               v
  +-------------------------------+
  | Data Encryption Key (DEK)     |  Encrypts actual data
  | Owner: Application            |  Rotated per policy
  | Stored encrypted by KEK       |  One per data scope
  +-------------------------------+
```

### Key Storage Rules

```
WHERE to store keys:

  CORRECT:
    - AWS KMS, GCP Cloud KMS, Azure Key Vault
    - HashiCorp Vault
    - Hardware Security Module (HSM)
    - OS keychain (for client-side applications)

  WRONG:
    - Source code (hardcoded)
    - Configuration files (application.yml, .env committed to git)
    - Environment variables alone (visible in process listings)
    - Database (unless encrypted by KMS)
    - Log files
    - Client-side storage (localStorage, cookies) for server keys
```

### Key Rotation

```go
// Go -- Key rotation for envelope encryption
type KeyRotator struct {
    kms       KMSClient
    store     DataStore
    oldKeyID  string
    newKeyID  string
}

func (r *KeyRotator) RotateKeys(ctx context.Context) error {
    // Fetch all records with encrypted DEKs
    records, err := r.store.ListEncryptedRecords(ctx)
    if err != nil {
        return err
    }

    for _, record := range records {
        // Decrypt DEK with old KEK
        plaintextDEK, err := r.kms.Decrypt(ctx, record.EncryptedDEK, r.oldKeyID)
        if err != nil {
            return fmt.Errorf("decrypting DEK for record %s: %w", record.ID, err)
        }

        // Re-encrypt DEK with new KEK
        newEncryptedDEK, err := r.kms.Encrypt(ctx, plaintextDEK, r.newKeyID)
        if err != nil {
            return fmt.Errorf("re-encrypting DEK for record %s: %w", record.ID, err)
        }

        // Update stored encrypted DEK -- data itself is NOT re-encrypted
        err = r.store.UpdateEncryptedDEK(ctx, record.ID, newEncryptedDEK, r.newKeyID)
        if err != nil {
            return fmt.Errorf("updating record %s: %w", record.ID, err)
        }

        // Zero out plaintext DEK
        for i := range plaintextDEK {
            plaintextDEK[i] = 0
        }
    }

    return nil
}
```

---

## Deprecated and Dangerous Algorithms

| Algorithm | Status | Vulnerability | Use Instead |
|-----------|--------|---------------|-------------|
| **MD5** | BROKEN | Collision attacks in seconds. Forged certificates demonstrated. | SHA-256, SHA-3, BLAKE2b |
| **SHA-1** | BROKEN | Collision demonstrated (SHAttered, 2017). Chosen-prefix collisions practical. | SHA-256, SHA-3, BLAKE2b |
| **DES** | BROKEN | 56-bit key. Brute-forced in hours. | AES-256 |
| **3DES (Triple DES)** | DEPRECATED | 64-bit block size. Sweet32 attack. NIST deprecated after 2023. | AES-256 |
| **RC4** | BROKEN | Statistical biases in keystream. Prohibited in TLS since RFC 7465. | AES-256-GCM, ChaCha20-Poly1305 |
| **ECB mode** | DANGEROUS | Identical plaintext blocks produce identical ciphertext blocks. Leaks patterns. | GCM, CTR, CBC (with HMAC) |
| **RSA PKCS#1 v1.5 (encryption)** | DANGEROUS | Bleichenbacher padding oracle attack. | RSA-OAEP |
| **RSA PKCS#1 v1.5 (signatures)** | WEAK | Various attacks possible. | RSA-PSS, Ed25519, ECDSA |
| **Blowfish** | DEPRECATED | 64-bit block size. Sweet32 attack. bcrypt (password hashing) is still acceptable. | AES-256 |

### ECB Mode -- Why It Is Broken

```
ECB mode encrypts each block independently:

  Plaintext:     [Block1] [Block2] [Block1] [Block3]
  Key:            K        K        K        K
  Ciphertext:    [AAAA]   [BBBB]   [AAAA]   [CCCC]
                  ^                  ^
                  Same input = same output -- LEAKS PATTERNS

  The famous "ECB penguin" demonstrates this:
  encrypting a bitmap image with ECB mode
  preserves the image outline in the ciphertext.

  GCM/CTR mode with unique nonce:
  Plaintext:     [Block1] [Block2] [Block1] [Block3]
  Nonce:          N1       N2       N3       N4
  Ciphertext:    [XXXX]   [YYYY]   [ZZZZ]   [WWWW]
                  ^                  ^
                  Different output -- no pattern leakage
```

---

## Timing Attacks and Constant-Time Comparison

When comparing secrets (passwords, tokens, HMACs, signatures), standard string comparison (`===`, `==`, `strcmp`) leaks information through timing. It short-circuits on the first differing byte, so an attacker can guess secrets one byte at a time by measuring response time.

### Constant-Time Comparison

```typescript
// TypeScript -- constant-time comparison
import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string): boolean {
  // Must be same length -- pad if needed to avoid length oracle
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    // Compare against itself to maintain constant time,
    // then return false
    timingSafeEqual(bufA, bufA);
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}

// WRONG: standard comparison leaks timing information
// if (userToken === storedToken) { ... }  // INSECURE

// RIGHT: constant-time comparison
// if (safeCompare(userToken, storedToken)) { ... }  // SECURE
```

```go
// Go -- constant-time comparison
import "crypto/subtle"

func SafeCompare(a, b string) bool {
    // ConstantTimeCompare returns 1 if equal, 0 if not
    // Runs in constant time regardless of where strings differ
    return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// WRONG: if userToken == storedToken { ... }        // INSECURE
// RIGHT: if SafeCompare(userToken, storedToken) { } // SECURE
```

```python
# Python -- constant-time comparison
import hmac
import secrets

def safe_compare(a: str, b: str) -> bool:
    """Constant-time string comparison to prevent timing attacks."""
    return hmac.compare_digest(a.encode(), b.encode())

# Also available:
# secrets.compare_digest(a, b)

# WRONG: if user_token == stored_token:      # INSECURE
# RIGHT: if safe_compare(user_token, stored): # SECURE
```

```java
// Java -- constant-time comparison
import java.security.MessageDigest;

boolean safeEquals = MessageDigest.isEqual(
    userToken.getBytes(),
    storedToken.getBytes()
);

// WRONG: if (userToken.equals(storedToken)) { ... }  // INSECURE
// RIGHT: if (safeEquals) { ... }                      // SECURE
```

```csharp
// C# -- constant-time comparison
using System.Security.Cryptography;

bool isEqual = CryptographicOperations.FixedTimeEquals(
    System.Text.Encoding.UTF8.GetBytes(userToken),
    System.Text.Encoding.UTF8.GetBytes(storedToken)
);

// WRONG: if (userToken == storedToken) { ... }  // INSECURE
// RIGHT: if (isEqual) { ... }                   // SECURE
```

---

## Nonce and IV Management

A nonce (Number used ONCE) or IV (Initialization Vector) ensures that encrypting the same plaintext with the same key produces different ciphertext each time. Nonce misuse is one of the most common and catastrophic cryptographic failures.

### GCM Nonce Rules

```
AES-GCM nonce rules:

  - Size: 96 bits (12 bytes) -- MANDATORY for GCM
  - NEVER reuse a nonce with the same key
  - Nonce reuse with GCM = COMPLETE key recovery
    (the attacker can XOR ciphertexts to cancel the keystream
     and recover both plaintexts and the authentication key)

  Two strategies for nonce generation:

  1. Random nonces (RECOMMENDED for most applications):
     - Generate 12 random bytes from CSPRNG
     - Collision probability: negligible below 2^32 encryptions per key
     - Rotate key after 2^32 operations (approximately 4 billion)

  2. Counter-based nonces (for high-throughput systems):
     - Monotonically increasing counter
     - Must guarantee no counter reuse (even across restarts)
     - Requires persistent, atomic counter storage
     - More suitable for disk encryption, database encryption
```

### Nonce-Misuse Resistant Algorithms

When the risk of nonce reuse is high (distributed systems, multiple encryptors sharing a key), use AES-GCM-SIV. It degrades gracefully: nonce reuse leaks only whether two plaintexts are identical, rather than leaking the key.

```python
# Python -- AES-GCM-SIV (nonce-misuse resistant)
from cryptography.hazmat.primitives.ciphers.aead import AESGCMSIV
import os

def encrypt_misuse_resistant(plaintext: bytes, key: bytes) -> bytes:
    """AES-GCM-SIV: safe even if nonce is accidentally reused."""
    nonce = os.urandom(12)
    aesgcmsiv = AESGCMSIV(key)
    ciphertext = aesgcmsiv.encrypt(nonce, plaintext, None)
    return nonce + ciphertext

def decrypt_misuse_resistant(data: bytes, key: bytes) -> bytes:
    nonce = data[:12]
    ciphertext = data[12:]
    aesgcmsiv = AESGCMSIV(key)
    return aesgcmsiv.decrypt(nonce, ciphertext, None)
```

### Nonce Tracking for Counter-Based Approach

```go
// Go -- Counter-based nonce with persistence
import (
    "encoding/binary"
    "sync/atomic"
)

type NonceGenerator struct {
    counter uint64
    prefix  [4]byte // Unique per instance to avoid collision across processes
}

func NewNonceGenerator(instanceID uint32) *NonceGenerator {
    ng := &NonceGenerator{}
    binary.BigEndian.PutUint32(ng.prefix[:], instanceID)
    return ng
}

func (ng *NonceGenerator) Next() [12]byte {
    var nonce [12]byte
    copy(nonce[:4], ng.prefix[:])
    count := atomic.AddUint64(&ng.counter, 1)
    binary.BigEndian.PutUint64(nonce[4:], count)
    return nonce
}
```

---

## Best Practices

1. **ALWAYS use authenticated encryption (AEAD)** -- AES-256-GCM or ChaCha20-Poly1305. Never use unauthenticated modes (raw CBC, CTR without MAC) for any new system. Authenticated encryption prevents tampering, not just eavesdropping.

2. **ALWAYS generate keys and nonces with a CSPRNG** -- `crypto.randomBytes` (Node), `crypto/rand` (Go), `secrets` (Python), `SecureRandom` (Java). Never use `Math.random()`, `math/rand`, `random.random()`, or `java.util.Random` for any security purpose.

3. **ALWAYS use purpose-built password hashing algorithms** -- Argon2id (preferred), bcrypt, or scrypt. Never hash passwords with SHA-256, SHA-3, BLAKE2, or any general-purpose hash function. General-purpose hash functions are too fast and lack memory-hardness.

4. **ALWAYS use envelope encryption for data at rest** -- encrypt data with a DEK, encrypt the DEK with a KEK stored in KMS. This enables key rotation without re-encrypting all data and limits the blast radius of a compromised key.

5. **ALWAYS use constant-time comparison for secrets** -- `timingSafeEqual` (Node), `subtle.ConstantTimeCompare` (Go), `hmac.compare_digest` (Python), `MessageDigest.isEqual` (Java). Standard equality operators leak timing information.

6. **NEVER reuse a nonce with the same key in GCM mode** -- nonce reuse in AES-GCM enables complete key recovery. Generate random nonces for each encryption, and rotate keys before the nonce space is exhausted (2^32 operations per key for random nonces).

7. **NEVER store cryptographic keys in source code, configuration files, or environment variables** -- use a dedicated key management service (AWS KMS, GCP Cloud KMS, Azure Key Vault, HashiCorp Vault) or a Hardware Security Module (HSM).

8. **NEVER use deprecated algorithms** -- MD5, SHA-1, DES, 3DES, RC4, ECB mode, and RSA PKCS#1 v1.5 encryption are all broken or deprecated. Replace every occurrence in your codebase.

9. **ALWAYS derive separate keys for separate purposes** -- use HKDF to derive an encryption key, a signing key, and an authentication key from a single master key. Never use the same key for encryption and authentication.

10. **ALWAYS rotate keys on a defined schedule and immediately on compromise** -- define maximum key lifetimes (90 days for DEKs, 1 year for KEKs). Automate rotation. On suspected compromise, rotate immediately and re-encrypt affected data.

---

## Anti-Patterns

### 1. Using Math.random() for Security Tokens

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Generating tokens, session IDs, or keys with non-cryptographic PRNGs | Attacker predicts future tokens by observing a few outputs. Full account takeover. | Use CSPRNG: `crypto.randomBytes`, `crypto/rand`, `secrets.token_bytes` |

### 2. ECB Mode Encryption

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Using AES-ECB (or any block cipher in ECB mode) | Identical plaintext blocks produce identical ciphertext blocks. Leaks data patterns. | Use AES-256-GCM (authenticated) or AES-CBC with HMAC (legacy) |

### 3. Nonce Reuse in GCM

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Reusing the same nonce (IV) with the same key in AES-GCM | Complete key recovery. Attacker can decrypt all past and future messages. | Generate random nonce per encryption. Rotate keys before 2^32 operations. Use AES-GCM-SIV if nonce reuse risk is high. |

### 4. SHA-256 for Password Hashing

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Hashing passwords with SHA-256, even with a salt | GPUs compute billions of SHA-256 hashes per second. Entire password database cracked in hours. | Use Argon2id, bcrypt, or scrypt. These are deliberately slow and memory-hard. |

### 5. Hardcoded Encryption Keys

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Encryption key stored in source code or committed configuration | Key exposed in version control, CI logs, container images, decompiled binaries. Everyone with repo access has the key. | Store keys in KMS or Vault. Inject at runtime. Never commit keys. |

### 6. Encrypt-and-MAC or MAC-then-Encrypt

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Applying MAC alongside or before encryption (instead of after) with CBC mode | Padding oracle attacks. Attacker decrypts ciphertext one byte at a time by observing error responses. | Use AEAD (GCM, ChaCha20-Poly1305) which handles MAC internally. If forced to use CBC, always Encrypt-then-MAC. |

### 7. Rolling Your Own Cryptography

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Implementing custom encryption, custom MAC, custom key exchange, or "improved" versions of standard algorithms | Custom cryptography almost always has fatal flaws invisible to the author. No peer review, no formal analysis. | Use well-known libraries: Node crypto, Go crypto, Python cryptography, Java JCA, Rust ring/aes-gcm. Never modify algorithms. |

### 8. Not Zeroing Key Material in Memory

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Leaving plaintext keys, passwords, or DEKs in memory after use | Memory dumps, core dumps, swap files, and garbage collection can expose keys. | Zero out key material immediately after use. Use `Buffer.fill(0)` (Node), `crypto.PurgeKey` where available, secure memory allocators (Rust `zeroize` crate). |

---

## Enforcement Checklist

### Symmetric Encryption
- [ ] AES-256-GCM or ChaCha20-Poly1305 is used for all symmetric encryption
- [ ] No use of ECB mode anywhere in the codebase
- [ ] No use of unauthenticated CBC without Encrypt-then-MAC
- [ ] 12-byte random nonces generated per encryption operation via CSPRNG
- [ ] Key size is 256 bits (32 bytes) for AES-256

### Asymmetric Encryption
- [ ] RSA keys are minimum 2048 bits (prefer 4096)
- [ ] RSA uses OAEP padding (not PKCS#1 v1.5)
- [ ] Private keys stored in KMS/HSM, never in source code
- [ ] Asymmetric encryption used only for key exchange and small payloads

### Digital Signatures
- [ ] Ed25519 used for new signature schemes (or ECDSA P-256 where required)
- [ ] RSA signatures use PSS padding (not PKCS#1 v1.5)
- [ ] Signature verification enforced before trusting signed data
- [ ] JWT tokens validated with correct algorithm, issuer, and audience

### Hashing
- [ ] SHA-256 or SHA-3 used for integrity checks and content addressing
- [ ] No use of MD5 or SHA-1 for any security-relevant purpose
- [ ] File checksums use SHA-256 minimum
- [ ] Hash outputs are compared using constant-time functions

### Password Hashing
- [ ] Argon2id, bcrypt, or scrypt used for all password storage
- [ ] No general-purpose hash functions (SHA-256, BLAKE2) used for passwords
- [ ] Work factor calibrated to take 250ms-1s on production hardware
- [ ] Unique salt generated per password via CSPRNG
- [ ] Password hash parameters stored alongside hash for future rehashing

### Key Derivation
- [ ] HKDF used to derive multiple keys from a master key
- [ ] PBKDF2 uses minimum 600,000 iterations with SHA-256 (if Argon2 unavailable)
- [ ] Separate keys derived for separate purposes (encryption, signing, auth)
- [ ] Salts are minimum 16 bytes, unique per derivation

### Random Number Generation
- [ ] All security-relevant random values generated with CSPRNG
- [ ] No use of Math.random(), math/rand, random.random(), or java.util.Random for security
- [ ] Token generation uses minimum 256 bits of entropy
- [ ] UUID generation uses crypto.randomUUID() or equivalent

### Envelope Encryption
- [ ] Data at rest encrypted with envelope encryption (DEK + KEK)
- [ ] DEKs generated with CSPRNG, encrypted by KMS-managed KEK
- [ ] Plaintext DEKs zeroed from memory after use
- [ ] Key rotation re-wraps DEKs without re-encrypting data

### Key Management
- [ ] Keys stored in KMS (AWS KMS, GCP Cloud KMS, Azure Key Vault) or HSM
- [ ] No cryptographic keys in source code, config files, or environment variables alone
- [ ] Key rotation schedule defined and automated (DEKs: 90 days, KEKs: 1 year)
- [ ] Key destruction procedure documented (crypto-shredding for data deletion)
- [ ] Key access audited -- all key usage logged

### Deprecated Algorithms
- [ ] No MD5, SHA-1, DES, 3DES, RC4, Blowfish (non-bcrypt) in the codebase
- [ ] No ECB mode encryption
- [ ] No RSA PKCS#1 v1.5 encryption padding
- [ ] Dependency scanner configured to flag deprecated cryptographic usage
- [ ] TLS configuration enforces minimum TLS 1.2 (prefer 1.3)

### Timing Attacks
- [ ] All secret comparisons use constant-time functions
- [ ] No standard equality operators (===, ==, strcmp) used for tokens, HMACs, or keys
- [ ] Authentication endpoints return in constant time regardless of failure mode

### Nonce/IV Management
- [ ] GCM nonces are 12 bytes, generated randomly or with a provably unique counter
- [ ] Keys are rotated before 2^32 encryptions (for random nonces with GCM)
- [ ] AES-GCM-SIV used where nonce reuse risk is elevated (distributed encryption)
- [ ] No hard-coded or static IVs/nonces anywhere in the codebase
