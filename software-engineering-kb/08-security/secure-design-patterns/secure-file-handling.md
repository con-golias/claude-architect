# Secure File Handling Patterns Guide

## Overview

Category: Secure Design Patterns
Scope: File upload, processing, storage, and serving security
Audience: Backend engineers, security engineers, DevOps engineers
Last Updated: 2025-06

## Purpose

File handling is one of the most dangerous areas in web application security.
Uploaded files can contain malware, exploit image parsers, cause
denial-of-service through decompression bombs, or enable path traversal
attacks. This guide provides defensive patterns for every stage of the file
handling lifecycle: upload, validation, processing, storage, and access.

---

## Pattern 1: Upload Security

### Theory

File upload validation must happen at multiple levels. Never trust the
Content-Type header -- it is set by the client and can be spoofed. Validate
the actual file content by reading magic bytes. Use an allowlist of permitted
file types, not a blocklist of dangerous ones. Rename files with UUIDs to
prevent path traversal and filename injection. Store files outside the webroot
to prevent direct access.

### TypeScript -- Complete Upload Security

```typescript
import crypto from 'crypto';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';
import { v4 as uuidv4 } from 'uuid';

// Allowlisted MIME types and their expected extensions
const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const UPLOAD_DIR = '/var/uploads'; // Outside webroot

interface UploadResult {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  hash: string;
  storedPath: string;
}

async function validateAndStoreUpload(
  fileBuffer: Buffer,
  originalName: string,
  declaredMimeType: string,
): Promise<UploadResult> {
  // Step 1: Check file size
  if (fileBuffer.length === 0) {
    throw new ValidationError('Empty file');
  }
  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new ValidationError(`File exceeds maximum size of ${MAX_FILE_SIZE} bytes`);
  }

  // Step 2: Detect actual MIME type from magic bytes (NOT the Content-Type header)
  const detectedType = await fileTypeFromBuffer(fileBuffer);
  if (!detectedType) {
    throw new ValidationError('Unable to determine file type');
  }

  // Step 3: Verify MIME type is in allowlist
  if (!ALLOWED_FILE_TYPES[detectedType.mime]) {
    throw new ValidationError(`File type ${detectedType.mime} is not allowed`);
  }

  // Step 4: Verify extension matches detected type
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_FILE_TYPES[detectedType.mime].includes(ext)) {
    throw new ValidationError('File extension does not match content type');
  }

  // Step 5: Sanitize filename -- use UUID, ignore original name for storage
  const fileId = uuidv4();
  const storedName = `${fileId}${ext}`;

  // Step 6: Compute hash for integrity verification
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // Step 7: Prevent path traversal in storage path
  const storedPath = path.join(UPLOAD_DIR, storedName);
  const resolvedPath = path.resolve(storedPath);
  if (!resolvedPath.startsWith(path.resolve(UPLOAD_DIR))) {
    throw new SecurityError('Path traversal detected');
  }

  // Step 8: Write file with restrictive permissions
  await fs.writeFile(storedPath, fileBuffer, { mode: 0o640 });

  return {
    id: fileId,
    originalName,
    storedName,
    mimeType: detectedType.mime,
    size: fileBuffer.length,
    hash,
    storedPath,
  };
}
```

### Go -- Upload Validation

```go
package upload

import (
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "io"
    "net/http"
    "os"
    "path/filepath"
    "strings"

    "github.com/google/uuid"
)

var allowedMIMETypes = map[string][]string{
    "image/jpeg":      {".jpg", ".jpeg"},
    "image/png":       {".png"},
    "image/gif":       {".gif"},
    "image/webp":      {".webp"},
    "application/pdf": {".pdf"},
}

const (
    maxFileSize = 10 << 20 // 10 MB
    uploadDir   = "/var/uploads"
)

type UploadResult struct {
    ID           string
    OriginalName string
    StoredName   string
    MIMEType     string
    Size         int64
    Hash         string
    StoredPath   string
}

func ValidateAndStore(r *http.Request) (*UploadResult, error) {
    // Limit request body size
    r.Body = http.MaxBytesReader(nil, r.Body, maxFileSize)

    file, header, err := r.FormFile("file")
    if err != nil {
        return nil, fmt.Errorf("failed to read file: %w", err)
    }
    defer file.Close()

    // Read file into memory (up to max size)
    data, err := io.ReadAll(file)
    if err != nil {
        return nil, fmt.Errorf("file too large or read error: %w", err)
    }

    // Detect MIME type from content (magic bytes), not Content-Type header
    detectedMIME := http.DetectContentType(data)

    // Verify against allowlist
    allowedExts, ok := allowedMIMETypes[detectedMIME]
    if !ok {
        return nil, fmt.Errorf("file type %s not allowed", detectedMIME)
    }

    // Verify extension matches
    ext := strings.ToLower(filepath.Ext(header.Filename))
    extAllowed := false
    for _, allowed := range allowedExts {
        if ext == allowed {
            extAllowed = true
            break
        }
    }
    if !extAllowed {
        return nil, fmt.Errorf("extension %s does not match content type %s", ext, detectedMIME)
    }

    // Generate safe filename
    fileID := uuid.New().String()
    storedName := fileID + ext

    // Prevent path traversal
    storedPath := filepath.Join(uploadDir, storedName)
    absPath, err := filepath.Abs(storedPath)
    if err != nil || !strings.HasPrefix(absPath, filepath.Clean(uploadDir)) {
        return nil, fmt.Errorf("invalid storage path")
    }

    // Compute hash
    hash := sha256.Sum256(data)

    // Write with restrictive permissions
    if err := os.WriteFile(storedPath, data, 0640); err != nil {
        return nil, fmt.Errorf("failed to store file: %w", err)
    }

    return &UploadResult{
        ID:           fileID,
        OriginalName: header.Filename,
        StoredName:   storedName,
        MIMEType:     detectedMIME,
        Size:         int64(len(data)),
        Hash:         hex.EncodeToString(hash[:]),
        StoredPath:   storedPath,
    }, nil
}
```

### Python -- Upload Validation

```python
import hashlib
import os
import uuid
from pathlib import Path

import magic  # python-magic library

ALLOWED_MIME_TYPES = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
UPLOAD_DIR = Path('/var/uploads')


def validate_and_store(file_data: bytes, original_name: str) -> dict:
    """Validate file content and store securely."""

    # Check size
    if len(file_data) == 0:
        raise ValidationError('Empty file')
    if len(file_data) > MAX_FILE_SIZE:
        raise ValidationError(f'File exceeds {MAX_FILE_SIZE} bytes')

    # Detect MIME type from magic bytes (not Content-Type header)
    detected_mime = magic.from_buffer(file_data, mime=True)

    # Verify against allowlist
    if detected_mime not in ALLOWED_MIME_TYPES:
        raise ValidationError(f'File type {detected_mime} not allowed')

    # Verify extension matches
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_MIME_TYPES[detected_mime]:
        raise ValidationError('Extension does not match content type')

    # Generate safe filename
    file_id = str(uuid.uuid4())
    stored_name = f'{file_id}{ext}'

    # Prevent path traversal
    stored_path = UPLOAD_DIR / stored_name
    resolved = stored_path.resolve()
    if not str(resolved).startswith(str(UPLOAD_DIR.resolve())):
        raise SecurityError('Path traversal detected')

    # Compute hash
    file_hash = hashlib.sha256(file_data).hexdigest()

    # Write with restrictive permissions
    stored_path.write_bytes(file_data)
    os.chmod(stored_path, 0o640)

    return {
        'id': file_id,
        'original_name': original_name,
        'stored_name': stored_name,
        'mime_type': detected_mime,
        'size': len(file_data),
        'hash': file_hash,
        'stored_path': str(stored_path),
    }
```

---

## Pattern 2: Malware Scanning

### Theory

Every uploaded file must be scanned for malware before it is stored or served
to other users. Integrate ClamAV or a similar scanner into the upload pipeline.
Quarantine files that fail scanning.

### TypeScript -- ClamAV Integration

```typescript
import NodeClam from 'clamscan';

const clamav = await new NodeClam().init({
  clamdscan: {
    socket: '/var/run/clamav/clamd.ctl',
    timeout: 30000,
    localFallback: true,
  },
  preference: 'clamdscan',
});

async function scanForMalware(filePath: string): Promise<{
  clean: boolean;
  viruses: string[];
}> {
  try {
    const { isInfected, viruses } = await clamav.isInfected(filePath);

    if (isInfected) {
      // Quarantine the file
      const quarantinePath = path.join('/var/quarantine', path.basename(filePath));
      await fs.rename(filePath, quarantinePath);

      logger.warn('Malware detected in upload', {
        originalPath: filePath,
        quarantinePath,
        viruses,
      });

      return { clean: false, viruses: viruses || [] };
    }

    return { clean: true, viruses: [] };
  } catch (err) {
    // Scanner failure -- fail closed (reject the file)
    logger.error('Malware scan failed', { filePath, error: err });
    throw new Error('File scanning failed -- upload rejected');
  }
}

// Integration in upload pipeline
async function processUpload(fileBuffer: Buffer, originalName: string) {
  // Step 1: Validate file type and store temporarily
  const result = await validateAndStoreUpload(fileBuffer, originalName, '');

  // Step 2: Scan for malware
  const scanResult = await scanForMalware(result.storedPath);
  if (!scanResult.clean) {
    throw new SecurityError('File contains malware');
  }

  // Step 3: Process file (resize images, strip metadata, etc.)
  await processFile(result);

  // Step 4: Move to permanent storage
  await moveToStorage(result);

  return result;
}
```

---

## Pattern 3: Image Processing Security

### Theory

Images can contain malicious payloads embedded in EXIF metadata, ICC profiles,
or through specially crafted pixel data that exploits parser vulnerabilities.
Defense: strip all metadata, re-encode the image (destroying embedded content),
limit dimensions to prevent decompression bombs, and use memory-safe libraries.

### TypeScript -- Sharp for Secure Image Processing

```typescript
import sharp from 'sharp';

const IMAGE_LIMITS = {
  maxWidth: 8192,
  maxHeight: 8192,
  maxPixels: 8192 * 8192,    // ~67 million pixels max
  maxFileSize: 20 * 1024 * 1024,  // 20 MB input
  outputQuality: 85,
  thumbnailSize: 200,
};

async function processImageSecurely(
  inputBuffer: Buffer,
  options: { maxWidth?: number; maxHeight?: number } = {},
): Promise<{
  processed: Buffer;
  thumbnail: Buffer;
  metadata: { width: number; height: number; format: string };
}> {
  // Step 1: Read metadata without fully decoding
  const metadata = await sharp(inputBuffer, {
    limitInputPixels: IMAGE_LIMITS.maxPixels,  // Prevent decompression bombs
    sequentialRead: true,                       // Lower memory usage
  }).metadata();

  if (!metadata.width || !metadata.height) {
    throw new ValidationError('Invalid image dimensions');
  }

  // Step 2: Check dimensions
  if (metadata.width > IMAGE_LIMITS.maxWidth ||
      metadata.height > IMAGE_LIMITS.maxHeight) {
    throw new ValidationError(
      `Image dimensions exceed ${IMAGE_LIMITS.maxWidth}x${IMAGE_LIMITS.maxHeight}`
    );
  }

  // Step 3: Re-encode image (strips ALL metadata, destroys embedded payloads)
  const maxWidth = options.maxWidth || 2048;
  const maxHeight = options.maxHeight || 2048;

  const processed = await sharp(inputBuffer, {
    limitInputPixels: IMAGE_LIMITS.maxPixels,
  })
    .rotate()              // Auto-rotate based on EXIF, then strip EXIF
    .resize(maxWidth, maxHeight, {
      fit: 'inside',       // Maintain aspect ratio
      withoutEnlargement: true,
    })
    .removeAlpha()         // Remove alpha if not needed (reduces attack surface)
    .jpeg({
      quality: IMAGE_LIMITS.outputQuality,
      progressive: true,
      mozjpeg: true,
    })
    .toBuffer();

  // Step 4: Generate thumbnail (also re-encoded, safe)
  const thumbnail = await sharp(inputBuffer, {
    limitInputPixels: IMAGE_LIMITS.maxPixels,
  })
    .resize(IMAGE_LIMITS.thumbnailSize, IMAGE_LIMITS.thumbnailSize, {
      fit: 'cover',
      position: 'centre',
    })
    .jpeg({ quality: 70 })
    .toBuffer();

  return {
    processed,
    thumbnail,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format || 'unknown',
    },
  };
}
```

### Python -- Pillow Secure Image Processing

```python
from PIL import Image
import io

IMAGE_LIMITS = {
    'max_pixels': 67_108_864,   # 8192 x 8192
    'max_width': 8192,
    'max_height': 8192,
    'max_file_size': 20 * 1024 * 1024,
    'output_quality': 85,
}

# Set Pillow decompression bomb limit
Image.MAX_IMAGE_PIXELS = IMAGE_LIMITS['max_pixels']


def process_image_securely(
    image_data: bytes,
    max_width: int = 2048,
    max_height: int = 2048,
) -> tuple[bytes, bytes, dict]:
    """Process image: strip metadata, re-encode, generate thumbnail."""

    if len(image_data) > IMAGE_LIMITS['max_file_size']:
        raise ValidationError('Image file too large')

    try:
        img = Image.open(io.BytesIO(image_data))
    except Exception as e:
        raise ValidationError(f'Invalid image: {e}')

    # Check dimensions
    if img.width > IMAGE_LIMITS['max_width'] or img.height > IMAGE_LIMITS['max_height']:
        raise ValidationError('Image dimensions too large')

    # Strip ALL metadata by creating a new image from pixel data only
    # This destroys any embedded malicious content
    clean_img = Image.new(img.mode, img.size)
    clean_img.putdata(list(img.getdata()))

    # Convert to RGB (remove alpha channel if not needed)
    if clean_img.mode in ('RGBA', 'LA', 'P'):
        clean_img = clean_img.convert('RGB')

    # Resize if needed
    clean_img.thumbnail((max_width, max_height), Image.LANCZOS)

    # Re-encode as JPEG
    output = io.BytesIO()
    clean_img.save(output, format='JPEG', quality=IMAGE_LIMITS['output_quality'])
    processed_data = output.getvalue()

    # Generate thumbnail
    thumb_img = clean_img.copy()
    thumb_img.thumbnail((200, 200), Image.LANCZOS)
    thumb_output = io.BytesIO()
    thumb_img.save(thumb_output, format='JPEG', quality=70)
    thumbnail_data = thumb_output.getvalue()

    metadata = {
        'width': clean_img.width,
        'height': clean_img.height,
        'format': 'jpeg',
    }

    return processed_data, thumbnail_data, metadata
```

### Go -- Image Processing with imaging

```go
package imageproc

import (
    "bytes"
    "fmt"
    "image"
    "image/jpeg"
    _ "image/gif"
    _ "image/png"

    "github.com/disintegration/imaging"
    "golang.org/x/image/webp"
)

const (
    maxWidth  = 8192
    maxHeight = 8192
    maxPixels = 8192 * 8192
)

type ProcessedImage struct {
    Data      []byte
    Thumbnail []byte
    Width     int
    Height    int
}

func ProcessImageSecurely(data []byte, targetWidth, targetHeight int) (*ProcessedImage, error) {
    // Decode image
    reader := bytes.NewReader(data)
    config, _, err := image.DecodeConfig(reader)
    if err != nil {
        return nil, fmt.Errorf("invalid image: %w", err)
    }

    // Check dimensions before full decode
    if config.Width > maxWidth || config.Height > maxHeight {
        return nil, fmt.Errorf("image dimensions %dx%d exceed limit", config.Width, config.Height)
    }
    if config.Width*config.Height > maxPixels {
        return nil, fmt.Errorf("image pixel count exceeds limit")
    }

    // Full decode
    reader.Reset(data)
    img, _, err := image.Decode(reader)
    if err != nil {
        return nil, fmt.Errorf("failed to decode image: %w", err)
    }

    // Resize (also strips metadata since we re-encode)
    resized := imaging.Fit(img, targetWidth, targetHeight, imaging.Lanczos)

    // Re-encode as JPEG (destroys any embedded payloads)
    var processed bytes.Buffer
    err = jpeg.Encode(&processed, resized, &jpeg.Options{Quality: 85})
    if err != nil {
        return nil, fmt.Errorf("failed to encode image: %w", err)
    }

    // Generate thumbnail
    thumb := imaging.Thumbnail(img, 200, 200, imaging.Lanczos)
    var thumbBuf bytes.Buffer
    err = jpeg.Encode(&thumbBuf, thumb, &jpeg.Options{Quality: 70})
    if err != nil {
        return nil, fmt.Errorf("failed to encode thumbnail: %w", err)
    }

    return &ProcessedImage{
        Data:      processed.Bytes(),
        Thumbnail: thumbBuf.Bytes(),
        Width:     resized.Bounds().Dx(),
        Height:    resized.Bounds().Dy(),
    }, nil
}
```

---

## Pattern 4: Document Processing Security

### Theory

Documents (PDF, Office files, SVGs) can contain active content -- macros,
JavaScript, embedded objects, and XSS payloads. Process all documents through
sanitization before storage or serving.

### SVG Sanitization (XSS Prevention)

```typescript
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeSVG(svgContent: string): string {
  // SVGs can contain JavaScript, event handlers, and external references
  const clean = DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true },
    // Remove dangerous elements
    FORBID_TAGS: [
      'script',           // JavaScript execution
      'foreignObject',    // Can embed HTML with scripts
      'set',              // Can animate to dangerous values
      'animate',          // Can modify attributes
      'animateTransform',
    ],
    // Remove dangerous attributes
    FORBID_ATTR: [
      'onload',
      'onerror',
      'onclick',
      'onmouseover',
      'onfocus',
      'xlink:href',      // Can reference external resources
    ],
    // Only allow safe SVG elements
    ALLOWED_TAGS: [
      'svg', 'g', 'path', 'circle', 'ellipse', 'line', 'polygon',
      'polyline', 'rect', 'text', 'tspan', 'defs', 'clipPath',
      'linearGradient', 'radialGradient', 'stop', 'use', 'symbol',
      'title', 'desc',
    ],
    ALLOWED_ATTR: [
      'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width',
      'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1',
      'x2', 'y2', 'transform', 'class', 'id', 'opacity',
      'font-size', 'font-family', 'text-anchor',
    ],
  });

  return clean;
}
```

### Python -- PDF Content Extraction (Safe)

```python
import subprocess
import tempfile
from pathlib import Path


def sanitize_pdf(pdf_data: bytes, max_pages: int = 100) -> bytes:
    """
    Sanitize PDF by re-rendering it, removing JavaScript,
    forms, embedded files, and active content.
    Uses Ghostscript to re-render the PDF.
    """
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as input_file:
        input_file.write(pdf_data)
        input_path = input_file.name

    output_path = input_path + '.clean.pdf'

    try:
        result = subprocess.run(
            [
                'gs',
                '-dBATCH',
                '-dNOPAUSE',
                '-dSAFER',              # Sandboxed mode
                '-dNoOutputFonts',
                '-sDEVICE=pdfwrite',
                '-dCompatibilityLevel=1.4',
                f'-dLastPage={max_pages}',
                '-dAutoFilterColorImages=false',
                '-sColorImageFilter=FlateEncode',
                f'-sOutputFile={output_path}',
                input_path,
            ],
            capture_output=True,
            timeout=60,
            check=True,
        )

        return Path(output_path).read_bytes()

    except subprocess.TimeoutExpired:
        raise ValidationError('PDF processing timed out')
    except subprocess.CalledProcessError as e:
        raise ValidationError(f'PDF processing failed: {e.stderr.decode()}')
    finally:
        Path(input_path).unlink(missing_ok=True)
        Path(output_path).unlink(missing_ok=True)
```

---

## Pattern 5: Archive Handling Security

### Theory

Archives (ZIP, TAR, GZIP) present three major attack vectors:
1. **Zip Slip**: Malicious entries with `../../` in paths escape the
   extraction directory and overwrite system files.
2. **Zip Bomb**: Highly compressed files that expand to enormous sizes,
   causing disk exhaustion and denial-of-service.
3. **Tar Symlink Attack**: Symlinks in archives that point to sensitive
   system files, allowing file read or overwrite when extracted.

### TypeScript -- Safe Archive Extraction

```typescript
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs/promises';

const ARCHIVE_LIMITS = {
  maxFileCount: 1000,
  maxTotalSize: 500 * 1024 * 1024,    // 500 MB extracted
  maxSingleFileSize: 100 * 1024 * 1024, // 100 MB per file
  maxCompressionRatio: 100,             // Reject if ratio > 100:1
  maxArchiveSize: 50 * 1024 * 1024,     // 50 MB compressed
  maxNestingDepth: 1,                   // No nested archives
};

async function extractZipSecurely(
  zipBuffer: Buffer,
  extractDir: string,
): Promise<string[]> {
  // Check compressed size
  if (zipBuffer.length > ARCHIVE_LIMITS.maxArchiveSize) {
    throw new ValidationError('Archive too large');
  }

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // Check entry count
  if (entries.length > ARCHIVE_LIMITS.maxFileCount) {
    throw new ValidationError(`Archive contains too many files (${entries.length})`);
  }

  // Calculate total uncompressed size and check compression ratio
  let totalSize = 0;
  const extractedPaths: string[] = [];

  for (const entry of entries) {
    // Skip directories
    if (entry.isDirectory) continue;

    // ZIP SLIP PREVENTION: Validate extracted path
    const entryPath = path.join(extractDir, entry.entryName);
    const resolvedPath = path.resolve(entryPath);
    const resolvedExtractDir = path.resolve(extractDir);

    if (!resolvedPath.startsWith(resolvedExtractDir + path.sep)) {
      throw new SecurityError(
        `Zip Slip detected: "${entry.entryName}" escapes extraction directory`
      );
    }

    // Check individual file size
    if (entry.header.size > ARCHIVE_LIMITS.maxSingleFileSize) {
      throw new ValidationError(
        `File "${entry.entryName}" exceeds size limit`
      );
    }

    // ZIP BOMB DETECTION: Check compression ratio
    if (entry.header.compressedSize > 0) {
      const ratio = entry.header.size / entry.header.compressedSize;
      if (ratio > ARCHIVE_LIMITS.maxCompressionRatio) {
        throw new SecurityError(
          `Suspicious compression ratio (${ratio.toFixed(1)}:1) for "${entry.entryName}"`
        );
      }
    }

    // Check total uncompressed size
    totalSize += entry.header.size;
    if (totalSize > ARCHIVE_LIMITS.maxTotalSize) {
      throw new ValidationError('Total extracted size exceeds limit');
    }

    // Check for nested archives
    const ext = path.extname(entry.entryName).toLowerCase();
    if (['.zip', '.tar', '.gz', '.bz2', '.7z', '.rar'].includes(ext)) {
      throw new SecurityError('Nested archives are not allowed');
    }

    // Create directory structure
    const dir = path.dirname(resolvedPath);
    await fs.mkdir(dir, { recursive: true });

    // Extract with restrictive permissions
    const data = entry.getData();
    await fs.writeFile(resolvedPath, data, { mode: 0o640 });
    extractedPaths.push(resolvedPath);
  }

  return extractedPaths;
}
```

### Go -- Safe TAR Extraction (Symlink Prevention)

```go
package archive

import (
    "archive/tar"
    "compress/gzip"
    "fmt"
    "io"
    "os"
    "path/filepath"
    "strings"
)

const (
    maxFileCount      = 1000
    maxTotalSize      = 500 << 20 // 500 MB
    maxSingleFileSize = 100 << 20 // 100 MB
)

func ExtractTarGzSecurely(archivePath, extractDir string) ([]string, error) {
    f, err := os.Open(archivePath)
    if err != nil {
        return nil, err
    }
    defer f.Close()

    gz, err := gzip.NewReader(f)
    if err != nil {
        return nil, err
    }
    defer gz.Close()

    tr := tar.NewReader(gz)
    absExtractDir, _ := filepath.Abs(extractDir)

    var extractedPaths []string
    var totalSize int64
    var fileCount int

    for {
        header, err := tr.Next()
        if err == io.EOF {
            break
        }
        if err != nil {
            return nil, fmt.Errorf("tar read error: %w", err)
        }

        fileCount++
        if fileCount > maxFileCount {
            return nil, fmt.Errorf("too many files in archive")
        }

        // SYMLINK ATTACK PREVENTION: Reject symlinks and hardlinks
        if header.Typeflag == tar.TypeSymlink || header.Typeflag == tar.TypeLink {
            return nil, fmt.Errorf("symlinks not allowed: %s", header.Name)
        }

        // ZIP SLIP PREVENTION: Validate path
        target := filepath.Join(extractDir, header.Name)
        absTarget, _ := filepath.Abs(target)
        if !strings.HasPrefix(absTarget, absExtractDir+string(filepath.Separator)) {
            return nil, fmt.Errorf("path traversal detected: %s", header.Name)
        }

        // Check individual file size
        if header.Size > maxSingleFileSize {
            return nil, fmt.Errorf("file too large: %s (%d bytes)", header.Name, header.Size)
        }

        totalSize += header.Size
        if totalSize > maxTotalSize {
            return nil, fmt.Errorf("total extracted size exceeds limit")
        }

        switch header.Typeflag {
        case tar.TypeDir:
            if err := os.MkdirAll(absTarget, 0750); err != nil {
                return nil, err
            }
        case tar.TypeReg:
            dir := filepath.Dir(absTarget)
            if err := os.MkdirAll(dir, 0750); err != nil {
                return nil, err
            }

            outFile, err := os.OpenFile(absTarget, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0640)
            if err != nil {
                return nil, err
            }

            // Limit read to declared size (prevent tar bomb with wrong header)
            written, err := io.Copy(outFile, io.LimitReader(tr, header.Size))
            outFile.Close()
            if err != nil {
                return nil, err
            }
            if written != header.Size {
                return nil, fmt.Errorf("size mismatch for %s", header.Name)
            }

            extractedPaths = append(extractedPaths, absTarget)
        }
    }

    return extractedPaths, nil
}
```

### Python -- Safe ZIP Extraction

```python
import zipfile
import os
from pathlib import Path

ARCHIVE_LIMITS = {
    'max_file_count': 1000,
    'max_total_size': 500 * 1024 * 1024,
    'max_single_file_size': 100 * 1024 * 1024,
    'max_compression_ratio': 100,
    'forbidden_extensions': {'.zip', '.tar', '.gz', '.bz2', '.7z', '.rar'},
}


def extract_zip_securely(zip_path: str, extract_dir: str) -> list[str]:
    """Extract ZIP file with security checks."""

    extract_dir = os.path.realpath(extract_dir)
    extracted_paths = []
    total_size = 0

    with zipfile.ZipFile(zip_path, 'r') as zf:
        entries = zf.infolist()

        # Check file count
        if len(entries) > ARCHIVE_LIMITS['max_file_count']:
            raise ValidationError(f'Too many files: {len(entries)}')

        for entry in entries:
            if entry.is_dir():
                continue

            # Zip Slip prevention
            target_path = os.path.realpath(
                os.path.join(extract_dir, entry.filename)
            )
            if not target_path.startswith(extract_dir + os.sep):
                raise SecurityError(
                    f'Path traversal detected: {entry.filename}'
                )

            # Size checks
            if entry.file_size > ARCHIVE_LIMITS['max_single_file_size']:
                raise ValidationError(f'File too large: {entry.filename}')

            total_size += entry.file_size
            if total_size > ARCHIVE_LIMITS['max_total_size']:
                raise ValidationError('Total extracted size exceeds limit')

            # Compression ratio check (zip bomb detection)
            if entry.compress_size > 0:
                ratio = entry.file_size / entry.compress_size
                if ratio > ARCHIVE_LIMITS['max_compression_ratio']:
                    raise SecurityError(
                        f'Suspicious compression ratio: {ratio:.1f}:1'
                    )

            # Check for nested archives
            ext = Path(entry.filename).suffix.lower()
            if ext in ARCHIVE_LIMITS['forbidden_extensions']:
                raise SecurityError('Nested archives not allowed')

            # Extract with safe permissions
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            with zf.open(entry) as src, open(target_path, 'wb') as dst:
                dst.write(src.read())
            os.chmod(target_path, 0o640)

            extracted_paths.append(target_path)

    return extracted_paths
```

---

## Pattern 6: Temporary File Security

### Theory

Temporary files must be created with restrictive permissions, in a secure
temporary directory, and cleaned up reliably -- even if the process crashes.
Use language-provided secure temp file functions instead of manual approaches.

### TypeScript -- Secure Temporary Files

```typescript
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

class SecureTempFile {
  private path: string;
  private fd: fs.FileHandle | null = null;

  private constructor(filePath: string) {
    this.path = filePath;
  }

  static async create(prefix: string = 'tmp-', suffix: string = ''): Promise<SecureTempFile> {
    const tmpDir = os.tmpdir();
    const randomName = crypto.randomBytes(16).toString('hex');
    const filePath = path.join(tmpDir, `${prefix}${randomName}${suffix}`);

    // Create with restrictive permissions (owner read/write only)
    const fd = await fs.open(filePath, 'wx', 0o600);
    const tempFile = new SecureTempFile(filePath);
    tempFile.fd = fd;
    return tempFile;
  }

  async write(data: Buffer | string): Promise<void> {
    if (!this.fd) throw new Error('File is closed');
    await this.fd.write(typeof data === 'string' ? Buffer.from(data) : data);
  }

  async read(): Promise<Buffer> {
    return fs.readFile(this.path);
  }

  getPath(): string {
    return this.path;
  }

  async cleanup(): Promise<void> {
    try {
      if (this.fd) {
        await this.fd.close();
        this.fd = null;
      }
      await fs.unlink(this.path);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        console.error('Failed to clean up temp file:', err);
      }
    }
  }
}

// Usage with guaranteed cleanup
async function processWithTempFile(data: Buffer): Promise<Buffer> {
  const tempFile = await SecureTempFile.create('process-', '.dat');
  try {
    await tempFile.write(data);
    // Process the file...
    const result = await someProcessing(tempFile.getPath());
    return result;
  } finally {
    await tempFile.cleanup(); // Always runs, even on error
  }
}
```

### Go -- Secure Temporary Files with Cleanup

```go
package tempfile

import (
    "os"
    "path/filepath"
)

type SecureTempFile struct {
    file *os.File
    path string
}

func Create(dir, pattern string) (*SecureTempFile, error) {
    if dir == "" {
        dir = os.TempDir()
    }

    f, err := os.CreateTemp(dir, pattern)
    if err != nil {
        return nil, err
    }

    // Set restrictive permissions
    if err := f.Chmod(0600); err != nil {
        f.Close()
        os.Remove(f.Name())
        return nil, err
    }

    return &SecureTempFile{file: f, path: f.Name()}, nil
}

func (t *SecureTempFile) Write(data []byte) (int, error) {
    return t.file.Write(data)
}

func (t *SecureTempFile) Path() string {
    return t.path
}

func (t *SecureTempFile) Cleanup() error {
    if t.file != nil {
        t.file.Close()
    }
    return os.Remove(t.path)
}

// Usage with defer for guaranteed cleanup
func ProcessFile(data []byte) ([]byte, error) {
    tmp, err := Create("", "process-*.dat")
    if err != nil {
        return nil, err
    }
    defer tmp.Cleanup() // Guaranteed cleanup

    if _, err := tmp.Write(data); err != nil {
        return nil, err
    }

    return processData(tmp.Path())
}
```

### Python -- Context Manager for Temp Files

```python
import tempfile
import os
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def secure_temp_file(suffix: str = '', prefix: str = 'tmp-', dir: str | None = None):
    """Create a secure temporary file with guaranteed cleanup."""
    fd, path = tempfile.mkstemp(suffix=suffix, prefix=prefix, dir=dir)
    try:
        os.fchmod(fd, 0o600)  # Restrictive permissions
        yield fd, path
    finally:
        try:
            os.close(fd)
        except OSError:
            pass
        try:
            os.unlink(path)
        except OSError:
            pass


# Usage
def process_upload(data: bytes) -> bytes:
    with secure_temp_file(suffix='.dat', prefix='upload-') as (fd, path):
        os.write(fd, data)
        os.fsync(fd)  # Ensure written to disk
        return process_data(path)
    # File is automatically cleaned up here
```

---

## Pattern 7: Signed URL Pattern

### Theory

Serve files through signed URLs rather than direct file paths. Signed URLs
contain an expiration time, authorized user context, and a cryptographic
signature that prevents tampering. Use cloud provider pre-signed URLs for
uploads and downloads.

### TypeScript -- Pre-Signed URLs with AWS S3

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: 'us-east-1' });

// Generate pre-signed upload URL (client uploads directly to S3)
async function generateUploadUrl(
  userId: string,
  filename: string,
  contentType: string,
  maxSizeBytes: number = 10 * 1024 * 1024,
): Promise<{ uploadUrl: string; key: string }> {
  // Validate content type against allowlist
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(contentType)) {
    throw new ValidationError(`Content type ${contentType} not allowed`);
  }

  const key = `uploads/${userId}/${uuidv4()}/${sanitizeFilename(filename)}`;

  const command = new PutObjectCommand({
    Bucket: 'secure-uploads',
    Key: key,
    ContentType: contentType,
    ContentLengthRange: [1, maxSizeBytes],  // Enforce size limits
    Metadata: {
      'uploaded-by': userId,
      'original-name': filename,
    },
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: 300,  // 5 minutes to upload
  });

  return { uploadUrl, key };
}

// Generate pre-signed download URL
async function generateDownloadUrl(
  key: string,
  userId: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  // Verify user has access to this file
  const fileRecord = await db('files').where({ storage_key: key }).first();
  if (!fileRecord) {
    throw new NotFoundError('File not found');
  }

  const hasAccess = await checkFileAccess(userId, fileRecord);
  if (!hasAccess) {
    throw new ForbiddenError('Access denied');
  }

  const command = new GetObjectCommand({
    Bucket: 'secure-uploads',
    Key: key,
    ResponseContentDisposition: `attachment; filename="${fileRecord.original_name}"`,
  });

  return getSignedUrl(s3, command, {
    expiresIn: expiresInSeconds,
  });
}
```

### Go -- Custom Signed URL Implementation

```go
package signedurl

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/base64"
    "fmt"
    "net/http"
    "net/url"
    "strconv"
    "time"
)

type SignedURLGenerator struct {
    secret  []byte
    baseURL string
}

func NewSignedURLGenerator(secret, baseURL string) *SignedURLGenerator {
    return &SignedURLGenerator{
        secret:  []byte(secret),
        baseURL: baseURL,
    }
}

func (g *SignedURLGenerator) Generate(filePath string, userID string, ttl time.Duration) string {
    expires := time.Now().Add(ttl).Unix()
    payload := fmt.Sprintf("%s:%s:%d", filePath, userID, expires)

    mac := hmac.New(sha256.New, g.secret)
    mac.Write([]byte(payload))
    signature := base64.URLEncoding.EncodeToString(mac.Sum(nil))

    u, _ := url.Parse(g.baseURL)
    u.Path = "/files/" + filePath
    q := u.Query()
    q.Set("user", userID)
    q.Set("expires", strconv.FormatInt(expires, 10))
    q.Set("sig", signature)
    u.RawQuery = q.Encode()

    return u.String()
}

func (g *SignedURLGenerator) Verify(r *http.Request) (string, string, error) {
    filePath := r.URL.Path[len("/files/"):]
    userID := r.URL.Query().Get("user")
    expiresStr := r.URL.Query().Get("expires")
    signature := r.URL.Query().Get("sig")

    if filePath == "" || userID == "" || expiresStr == "" || signature == "" {
        return "", "", fmt.Errorf("missing required parameters")
    }

    expires, err := strconv.ParseInt(expiresStr, 10, 64)
    if err != nil {
        return "", "", fmt.Errorf("invalid expiration")
    }

    if time.Now().Unix() > expires {
        return "", "", fmt.Errorf("URL has expired")
    }

    // Verify signature
    payload := fmt.Sprintf("%s:%s:%d", filePath, userID, expires)
    mac := hmac.New(sha256.New, g.secret)
    mac.Write([]byte(payload))
    expectedSig := base64.URLEncoding.EncodeToString(mac.Sum(nil))

    if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
        return "", "", fmt.Errorf("invalid signature")
    }

    return filePath, userID, nil
}
```

---

## Pattern 8: Streaming Upload with Size Enforcement

### Theory

For large file uploads, stream data to storage without buffering the entire
file in memory. Enforce size limits during the stream to reject oversized
files early.

### TypeScript -- Streaming Upload with Hash Verification

```typescript
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

class SizeLimitedStream extends Transform {
  private bytesRead = 0;

  constructor(private maxBytes: number) {
    super();
  }

  _transform(chunk: Buffer, encoding: string, callback: Function) {
    this.bytesRead += chunk.length;
    if (this.bytesRead > this.maxBytes) {
      callback(new Error(`Upload exceeds maximum size of ${this.maxBytes} bytes`));
      return;
    }
    this.push(chunk);
    callback();
  }
}

async function streamUpload(
  inputStream: NodeJS.ReadableStream,
  storagePath: string,
  maxSizeBytes: number,
  expectedHash?: string,
): Promise<{ size: number; hash: string }> {
  const sizeLimit = new SizeLimitedStream(maxSizeBytes);
  const hash = createHash('sha256');
  let totalSize = 0;

  const hashStream = new Transform({
    transform(chunk, encoding, callback) {
      hash.update(chunk);
      totalSize += chunk.length;
      this.push(chunk);
      callback();
    },
  });

  const output = fs.createWriteStream(storagePath, { mode: 0o640 });

  try {
    await pipeline(inputStream, sizeLimit, hashStream, output);
  } catch (err) {
    // Clean up partial file on error
    await fs.unlink(storagePath).catch(() => {});
    throw err;
  }

  const computedHash = hash.digest('hex');

  // Verify hash if provided (integrity check)
  if (expectedHash && computedHash !== expectedHash) {
    await fs.unlink(storagePath).catch(() => {});
    throw new ValidationError('File hash mismatch -- upload corrupted');
  }

  return { size: totalSize, hash: computedHash };
}
```

---

## Best Practices

1. **Validate file content, not headers**: Always check magic bytes to
   determine the true file type. Never rely on the Content-Type header
   or file extension alone.

2. **Use allowlists for file types**: Permit only specific, known-safe file
   types. Never use a blocklist of dangerous types -- you will miss something.

3. **Rename files with UUIDs**: Never use the client-provided filename for
   storage. Generate a UUID and map it in the database. This prevents path
   traversal, filename injection, and name collisions.

4. **Store files outside the webroot**: Uploaded files must never be directly
   accessible via a URL path. Serve them through application logic with
   authorization checks or signed URLs.

5. **Re-encode all images**: Processing images through resize/re-encode
   destroys embedded payloads and strips EXIF metadata. Never serve
   user-uploaded images without re-encoding.

6. **Scan for malware**: Integrate ClamAV or a cloud-based scanning service
   into the upload pipeline. Quarantine infected files and alert security.

7. **Prevent archive attacks**: Validate all archive entries before extraction.
   Check for path traversal (Zip Slip), compression bombs, symlinks, and
   nested archives.

8. **Clean up temporary files**: Use language-provided secure temp file
   functions with finally/defer/context manager patterns to guarantee
   cleanup even on errors.

9. **Use signed URLs for file access**: Generate time-limited, user-scoped
   signed URLs instead of serving files directly. This provides fine-grained
   access control and prevents URL sharing.

10. **Enforce size limits at every layer**: Limit request body size at the
    reverse proxy, application framework, and streaming layer. Reject
    oversized files as early as possible.

---

## Anti-Patterns

1. **Trusting Content-Type headers**: The client sets Content-Type; it can
   be anything. A file claimed to be `image/jpeg` could be a PHP script
   or HTML file with JavaScript.

2. **Using original filenames for storage**: Filenames like
   `../../etc/passwd` or `<script>alert(1)</script>.html` exploit path
   traversal and XSS. Always use UUID-based names.

3. **Serving uploads from the same domain**: User-uploaded files served
   from the main domain can execute JavaScript in the application's
   security context. Use a separate domain or CDN.

4. **No size limits on uploads**: Without size limits, attackers can
   exhaust disk space, memory, or bandwidth. Enforce limits at the
   network, framework, and application layers.

5. **Extracting archives without validation**: Blindly extracting ZIP or
   TAR files enables Zip Slip (path traversal), zip bombs (disk
   exhaustion), and symlink attacks (file read/overwrite).

6. **Serving images without re-encoding**: Raw user-uploaded images may
   contain EXIF metadata with GPS coordinates, embedded XSS in SVGs,
   or exploit payloads targeting image parsers.

7. **Storing files in publicly accessible directories**: Placing uploads
   in `/public/uploads/` allows direct access without authorization.
   Files must be served through application logic.

8. **No malware scanning**: Accepting and storing files without scanning
   turns the application into a malware distribution platform. Users
   downloading infected files blame the application.

---

## Enforcement Checklist

### Upload Validation
- [ ] File type validated by magic bytes (not Content-Type header)
- [ ] File extension validated against allowlist
- [ ] File size limited (reject before fully reading)
- [ ] Filename sanitized (UUID-based storage name)
- [ ] Unknown/extra file types rejected

### Storage Security
- [ ] Files stored outside webroot
- [ ] Files stored with restrictive permissions (0640 or more restrictive)
- [ ] Storage paths validated against path traversal
- [ ] Files served through application logic, not direct URLs
- [ ] Separate domain for user-uploaded content

### Processing
- [ ] Images re-encoded (metadata stripped, payloads destroyed)
- [ ] Image dimensions limited (decompression bomb prevention)
- [ ] SVGs sanitized (script removal)
- [ ] PDFs sanitized (JavaScript/macro removal)
- [ ] Malware scanning integrated

### Archive Handling
- [ ] Zip Slip prevention (path validation for all entries)
- [ ] Zip bomb detection (compression ratio check)
- [ ] Symlink rejection in TAR archives
- [ ] Nested archive rejection
- [ ] Maximum file count and total size limits

### Operational
- [ ] Temporary files use secure creation (mkstemp/CreateTemp)
- [ ] Temporary files cleaned up in finally/defer blocks
- [ ] Signed URLs used for file access
- [ ] Upload/download audit logged
- [ ] File hash stored for integrity verification
