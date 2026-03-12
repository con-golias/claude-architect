# Fuzz Testing

## Metadata
- **Category:** Security Testing
- **Scope:** Automated input generation to discover crashes, bugs, and security vulnerabilities
- **Audience:** Software engineers, security engineers, QA engineers
- **Prerequisites:** Programming fundamentals, unit testing basics, understanding of memory safety
- **Last Updated:** 2025-01

---

## 1. What Is Fuzzing

Fuzzing (fuzz testing) is an automated testing technique that sends random,
malformed, or unexpected inputs to a program to discover bugs, crashes, memory
corruption, and security vulnerabilities. Unlike traditional unit tests that
verify expected behavior with known inputs, fuzzing explores unknown input
spaces to find edge cases that developers did not anticipate.

### 1.1 Why Fuzzing Finds Bugs Other Testing Misses

```
Traditional Testing:
  - Tests known inputs with known expected outputs
  - Coverage limited by developer imagination
  - Tests the "happy path" and a few edge cases

Fuzz Testing:
  - Generates millions of inputs automatically
  - Explores input spaces no human would think to test
  - Finds crashes, hangs, memory corruption, assertion failures
  - Discovers vulnerabilities in parsers, decoders, validators
  - Particularly effective for:
    - Buffer overflows
    - Integer overflows
    - Null pointer dereferences
    - Format string vulnerabilities
    - Denial of service (resource exhaustion)
    - Logic errors triggered by unexpected input combinations
```

### 1.2 Fuzzing Types

```
+-------------------------------------------------------------------+
| Type             | Approach              | Strengths               |
|------------------|-----------------------|-------------------------|
| Mutation-based   | Mutate valid inputs   | Simple setup, fast,     |
|                  | (bit flips, byte      | works without protocol  |
|                  | insertion, deletion)  | knowledge               |
|------------------|-----------------------|-------------------------|
| Generation-based | Generate inputs from  | Protocol-aware, better  |
|                  | grammar or schema     | coverage of structured  |
|                  |                       | input formats           |
|------------------|-----------------------|-------------------------|
| Coverage-guided  | Use code coverage     | Most effective for      |
|                  | feedback to guide     | finding deep bugs,      |
|                  | mutation decisions    | industry standard       |
+-------------------------------------------------------------------+
```

---

## 2. Coverage-Guided Fuzzing

Coverage-guided fuzzing is the most effective modern approach. The fuzzer
instruments the target program to track which code paths are executed, then
uses this feedback to generate inputs that explore new code paths.

### 2.1 How Coverage-Guided Fuzzing Works

```
1. Start with seed corpus (example inputs)
2. Pick an input from the corpus
3. Mutate the input (bit flips, byte insertion, dictionary-based mutations)
4. Execute target program with mutated input
5. Measure code coverage achieved
6. If new coverage discovered:
   - Save the input to the corpus (it is "interesting")
7. If crash detected:
   - Save the crashing input to crash directory
   - Log the crash details (stack trace, signal)
8. Repeat from step 2 (millions of iterations)

     +---> Pick from corpus
     |            |
     |     Mutate input
     |            |
     |     Execute target
     |            |
     |     Measure coverage
     |            |
     |     +------+-------+
     |     |              |
     |   New coverage?  Crash?
     |     |              |
     |   Add to         Save to
     |   corpus         crashes/
     |     |              |
     +-----+--------------+
```

### 2.2 AFL++ (C/C++)

AFL++ (American Fuzzy Lop Plus Plus) is the most widely used coverage-guided
fuzzer for C and C++ programs.

**Installation:**

```bash
# Ubuntu/Debian
apt-get install afl++

# From source
git clone https://github.com/AFLplusplus/AFLplusplus.git
cd AFLplusplus
make all
sudo make install
```

**Basic fuzzing workflow:**

```bash
# Step 1: Compile target with AFL++ instrumentation
afl-cc -o target_afl target.c

# Step 2: Create seed corpus directory with sample inputs
mkdir -p seeds/
echo "valid input example" > seeds/example1.txt
echo "another valid input" > seeds/example2.txt

# Step 3: Create output directory
mkdir -p findings/

# Step 4: Start fuzzing
afl-fuzz -i seeds/ -o findings/ -- ./target_afl @@

# @@ is replaced by the input file path
# The fuzzer will run indefinitely; Ctrl+C to stop
```

**AFL++ with persistent mode (much faster):**

```c
// target_persistent.c - AFL++ persistent mode fuzzing harness
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

// Include AFL++ header
__AFL_FUZZ_INIT();

// The function under test
int parse_message(const unsigned char *data, size_t size);

int main(int argc, char **argv) {
    // Enable AFL++ deferred initialization
    __AFL_INIT();

    // Get the shared memory buffer
    unsigned char *buf = __AFL_FUZZ_TESTCASE_BUF;

    // Persistent mode loop - processes many inputs per process
    while (__AFL_LOOP(10000)) {
        int len = __AFL_FUZZ_TESTCASE_LEN;

        // Call the function under test
        parse_message(buf, len);
    }

    return 0;
}
```

```bash
# Compile and run persistent mode harness
afl-cc -o target_persistent target_persistent.c -lmylibrary
afl-fuzz -i seeds/ -o findings/ -- ./target_persistent
```

**AFL++ with ASAN (AddressSanitizer) for memory bug detection:**

```bash
# Compile with ASAN for better bug detection
AFL_USE_ASAN=1 afl-cc -o target_asan target.c

# Run fuzzer with ASAN-instrumented binary
afl-fuzz -i seeds/ -o findings/ -m none -- ./target_asan @@
```

### 2.3 libFuzzer (C/C++, LLVM)

libFuzzer is built into LLVM/Clang and provides in-process, coverage-guided fuzzing.

**Writing a libFuzzer harness:**

```c
// fuzz_target.c - libFuzzer harness
#include <stdint.h>
#include <stddef.h>

// Forward declaration of the function to fuzz
int parse_json(const uint8_t *data, size_t size);

// libFuzzer entry point - called for each generated input
int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
    // Reject very large inputs to avoid timeouts
    if (size > 1024 * 1024) return 0;

    // Call the function under test
    parse_json(data, size);

    return 0;
}
```

```bash
# Compile with libFuzzer and sanitizers
clang -g -fsanitize=fuzzer,address,undefined \
  -o fuzz_target fuzz_target.c libjson.a

# Run fuzzer with seed corpus
./fuzz_target corpus/ seeds/ \
  -max_len=4096 \
  -timeout=10 \
  -jobs=4 \
  -workers=4

# Options explained:
# corpus/    - directory to store interesting inputs
# seeds/     - directory with initial seed inputs
# -max_len   - maximum input size in bytes
# -timeout   - per-input timeout in seconds
# -jobs      - number of fuzzing jobs in parallel
# -workers   - number of worker processes
```

**libFuzzer with structured inputs (FuzzedDataProvider):**

```cpp
// fuzz_structured.cc - libFuzzer with FuzzedDataProvider
#include <cstdint>
#include <cstddef>
#include <string>
#include <fuzzer/FuzzedDataProvider.h>

// Function under test
struct Config {
    std::string host;
    int port;
    bool use_tls;
    int timeout_ms;
};

int configure_connection(const Config& config);

extern "C" int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
    FuzzedDataProvider provider(data, size);

    Config config;
    config.host = provider.ConsumeRandomLengthString(256);
    config.port = provider.ConsumeIntegralInRange<int>(0, 65535);
    config.use_tls = provider.ConsumeBool();
    config.timeout_ms = provider.ConsumeIntegralInRange<int>(0, 30000);

    configure_connection(config);

    return 0;
}
```

### 2.4 OSS-Fuzz (Google)

OSS-Fuzz provides continuous fuzzing for open-source projects, running thousands
of CPU cores 24/7.

**Project integration (project.yaml):**

```yaml
# project.yaml for OSS-Fuzz
homepage: "https://github.com/example/myproject"
language: c++
primary_contact: "security@example.com"
auto_ccs:
  - "dev1@example.com"
  - "dev2@example.com"
main_repo: "https://github.com/example/myproject.git"
sanitizers:
  - address
  - memory
  - undefined
architectures:
  - x86_64
fuzzing_engines:
  - libfuzzer
  - afl
  - honggfuzz
```

**Build script (Dockerfile):**

```dockerfile
# Dockerfile for OSS-Fuzz
FROM gcr.io/oss-fuzz-base/base-builder
RUN apt-get update && apt-get install -y make cmake
RUN git clone --depth 1 https://github.com/example/myproject.git
WORKDIR myproject
COPY build.sh $SRC/
```

```bash
#!/bin/bash
# build.sh for OSS-Fuzz
cd $SRC/myproject
mkdir build && cd build
cmake .. -DCMAKE_C_COMPILER=$CC -DCMAKE_CXX_COMPILER=$CXX \
  -DCMAKE_C_FLAGS="$CFLAGS" -DCMAKE_CXX_FLAGS="$CXXFLAGS"
make -j$(nproc)

# Copy fuzz targets to output
cp fuzz_* $OUT/

# Copy seed corpus
cp -r $SRC/myproject/fuzz/corpus $OUT/fuzz_target_seed_corpus

# Copy dictionary
cp $SRC/myproject/fuzz/json.dict $OUT/fuzz_target.dict
```

---

## 3. Language-Specific Fuzzers

### 3.1 Go Native Fuzzing (go test -fuzz)

Go 1.18+ includes built-in support for fuzz testing.

```go
// fuzz_test.go
package parser

import (
    "testing"
)

// FuzzParseJSON fuzzes the JSON parser
func FuzzParseJSON(f *testing.F) {
    // Add seed corpus entries
    f.Add([]byte(`{"key": "value"}`))
    f.Add([]byte(`{"numbers": [1, 2, 3]}`))
    f.Add([]byte(`{"nested": {"a": {"b": "c"}}}`))
    f.Add([]byte(`[]`))
    f.Add([]byte(`""`))
    f.Add([]byte(`null`))
    f.Add([]byte(``))

    // Fuzz function
    f.Fuzz(func(t *testing.T, data []byte) {
        // The fuzzer calls this with generated inputs
        result, err := ParseJSON(data)
        if err != nil {
            // Expected: invalid inputs should return error, not panic
            return
        }

        // If parsing succeeds, verify round-trip
        encoded, err := EncodeJSON(result)
        if err != nil {
            t.Fatalf("Failed to encode parsed result: %v", err)
        }

        result2, err := ParseJSON(encoded)
        if err != nil {
            t.Fatalf("Failed to re-parse encoded result: %v", err)
        }

        if !Equal(result, result2) {
            t.Fatalf("Round-trip mismatch: %v != %v", result, result2)
        }
    })
}

// FuzzParseURL fuzzes URL parsing
func FuzzParseURL(f *testing.F) {
    f.Add("https://example.com/path?query=value#fragment")
    f.Add("http://user:pass@host:8080/path")
    f.Add("ftp://files.example.com/pub/file.txt")
    f.Add("")
    f.Add("://invalid")

    f.Fuzz(func(t *testing.T, input string) {
        parsed, err := ParseURL(input)
        if err != nil {
            return // Invalid URLs should error, not panic
        }

        // Verify that the parsed URL can be reconstructed
        reconstructed := parsed.String()
        reparsed, err := ParseURL(reconstructed)
        if err != nil {
            t.Fatalf("Reconstructed URL %q failed to parse: %v",
                reconstructed, err)
        }

        if parsed.Host != reparsed.Host {
            t.Fatalf("Host mismatch: %q != %q", parsed.Host, reparsed.Host)
        }
    })
}
```

```bash
# Run Go fuzz tests
go test -fuzz=FuzzParseJSON -fuzztime=60s ./parser/

# Run with specific timeout
go test -fuzz=FuzzParseURL -fuzztime=5m ./parser/

# Run with race detector
go test -fuzz=FuzzParseJSON -race -fuzztime=60s ./parser/

# View corpus (saved interesting inputs)
ls testdata/fuzz/FuzzParseJSON/
```

### 3.2 Atheris (Python)

Atheris is a coverage-guided Python fuzzer based on libFuzzer.

```python
# fuzz_parser.py - Atheris fuzzing harness for Python
import atheris
import sys

# Import the module to fuzz
with atheris.instrument_imports():
    import json
    import yaml
    import xml.etree.ElementTree as ET


def fuzz_json_parser(data):
    """Fuzz the JSON parser."""
    try:
        fdp = atheris.FuzzedDataProvider(data)
        input_str = fdp.ConsumeUnicodeNoSurrogates(
            fdp.ConsumeIntInRange(0, 1024)
        )
        json.loads(input_str)
    except (json.JSONDecodeError, ValueError):
        pass  # Expected for invalid input


def fuzz_yaml_parser(data):
    """Fuzz the YAML parser."""
    try:
        fdp = atheris.FuzzedDataProvider(data)
        input_str = fdp.ConsumeUnicodeNoSurrogates(
            fdp.ConsumeIntInRange(0, 4096)
        )
        # Use safe_load to prevent code execution
        yaml.safe_load(input_str)
    except yaml.YAMLError:
        pass


def fuzz_xml_parser(data):
    """Fuzz the XML parser."""
    try:
        fdp = atheris.FuzzedDataProvider(data)
        input_bytes = fdp.ConsumeBytes(fdp.ConsumeIntInRange(0, 4096))
        ET.fromstring(input_bytes)
    except ET.ParseError:
        pass


def fuzz_custom_protocol(data):
    """Fuzz a custom binary protocol parser."""
    fdp = atheris.FuzzedDataProvider(data)

    # Generate structured but fuzzed protocol message
    version = fdp.ConsumeIntInRange(0, 255)
    msg_type = fdp.ConsumeIntInRange(0, 255)
    payload_len = fdp.ConsumeIntInRange(0, 65535)
    payload = fdp.ConsumeBytes(payload_len)

    # Construct message
    import struct
    try:
        message = struct.pack(
            f'!BBH{len(payload)}s',
            version, msg_type, len(payload), payload
        )
        # Call the function under test
        from myapp.protocol import parse_message
        parse_message(message)
    except (struct.error, ValueError):
        pass


if __name__ == '__main__':
    # Choose which function to fuzz based on environment variable
    import os
    target = os.environ.get('FUZZ_TARGET', 'json')

    targets = {
        'json': fuzz_json_parser,
        'yaml': fuzz_yaml_parser,
        'xml': fuzz_xml_parser,
        'protocol': fuzz_custom_protocol,
    }

    atheris.Setup(sys.argv, targets[target])
    atheris.Fuzz()
```

```bash
# Run Atheris fuzzer
FUZZ_TARGET=json python fuzz_parser.py -max_len=1024 -timeout=10

# With seed corpus
FUZZ_TARGET=yaml python fuzz_parser.py corpus/ seeds/ -max_len=4096

# With specific number of runs
FUZZ_TARGET=xml python fuzz_parser.py -runs=1000000
```

### 3.3 Jazzer (Java)

Jazzer is a coverage-guided Java fuzzer integrated with JUnit 5.

```java
// FuzzJsonParser.java - Jazzer fuzz test
import com.code_intelligence.jazzer.api.FuzzedDataProvider;
import com.code_intelligence.jazzer.junit.FuzzTest;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;

public class FuzzJsonParser {

    private static final ObjectMapper mapper = new ObjectMapper();

    @FuzzTest
    void fuzzJsonDeserialization(FuzzedDataProvider data) {
        String jsonInput = data.consumeRemainingAsString();
        try {
            Object result = mapper.readValue(jsonInput, Object.class);
            // If parsing succeeds, verify serialization
            String serialized = mapper.writeValueAsString(result);
            // No assertion needed - we are looking for crashes/exceptions
        } catch (JsonProcessingException e) {
            // Expected for invalid JSON input
        }
    }

    @FuzzTest
    void fuzzXmlParser(FuzzedDataProvider data) {
        byte[] xmlInput = data.consumeRemainingAsBytes();
        try {
            javax.xml.parsers.DocumentBuilderFactory factory =
                javax.xml.parsers.DocumentBuilderFactory.newInstance();
            // Secure configuration
            factory.setFeature(
                "http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature(
                "http://xml.org/sax/features/external-general-entities", false);

            javax.xml.parsers.DocumentBuilder builder = factory.newDocumentBuilder();
            builder.parse(new java.io.ByteArrayInputStream(xmlInput));
        } catch (Exception e) {
            // Expected for invalid XML
        }
    }

    @FuzzTest(maxDuration = "5m")
    void fuzzUrlParser(FuzzedDataProvider data) {
        String url = data.consumeRemainingAsString();
        try {
            java.net.URI uri = new java.net.URI(url);
            uri.getHost();
            uri.getPort();
            uri.getPath();
            uri.getQuery();
        } catch (java.net.URISyntaxException e) {
            // Expected for invalid URLs
        }
    }
}
```

```xml
<!-- pom.xml - Jazzer dependency -->
<dependency>
    <groupId>com.code-intelligence</groupId>
    <artifactId>jazzer-junit</artifactId>
    <version>0.22.1</version>
    <scope>test</scope>
</dependency>
```

```bash
# Run Jazzer fuzz tests via Maven
mvn test -Djazzer.fuzz=FuzzJsonParser

# With JUnit
mvn test -pl fuzz-tests -Djunit.jupiter.execution.timeout.testable.method.default=300s
```

### 3.4 cargo-fuzz (Rust)

```bash
# Install cargo-fuzz
cargo install cargo-fuzz

# Initialize fuzzing in a Rust project
cargo fuzz init
```

```rust
// fuzz/fuzz_targets/fuzz_parser.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use my_library::parser::parse;

fuzz_target!(|data: &[u8]| {
    // Convert bytes to string if needed
    if let Ok(input) = std::str::from_utf8(data) {
        // Fuzz the parser
        let _ = parse(input);
    }
});
```

```rust
// fuzz/fuzz_targets/fuzz_structured.rs - Structured fuzzing with Arbitrary
#![no_main]
use libfuzzer_sys::fuzz_target;
use arbitrary::Arbitrary;

#[derive(Arbitrary, Debug)]
struct FuzzInput {
    name: String,
    age: u32,
    scores: Vec<f64>,
    metadata: Option<String>,
}

fuzz_target!(|input: FuzzInput| {
    // Fuzz with structured, type-safe inputs
    let _ = my_library::process_user(
        &input.name,
        input.age,
        &input.scores,
        input.metadata.as_deref(),
    );
});
```

```bash
# Run cargo-fuzz
cargo fuzz run fuzz_parser -- -max_len=4096 -timeout=10

# Run for specific duration
cargo fuzz run fuzz_parser -- -max_total_time=300

# List crash inputs
cargo fuzz list

# Minimize corpus
cargo fuzz cmin fuzz_parser

# Minimize a crash input
cargo fuzz tmin fuzz_parser artifacts/fuzz_parser/crash-abc123
```

---

## 4. API Fuzzing

### 4.1 RESTler (Microsoft)

RESTler is a stateful REST API fuzzer that learns API dependencies from
OpenAPI specifications.

```bash
# Install RESTler
dotnet tool install --global RESTler

# Step 1: Compile API specification
restler compile --api_spec openapi.json

# Step 2: Run in test mode (learn API dependencies)
restler test \
  --grammar_file Compile/grammar.py \
  --dictionary_file Compile/dict.json \
  --settings Compile/engine_settings.json \
  --no_ssl

# Step 3: Fuzz in fuzz-lean mode (quick fuzzing)
restler fuzz-lean \
  --grammar_file Compile/grammar.py \
  --dictionary_file Compile/dict.json \
  --settings Compile/engine_settings.json \
  --no_ssl \
  --time_budget 1  # hours

# Step 4: Full fuzzing
restler fuzz \
  --grammar_file Compile/grammar.py \
  --dictionary_file Compile/dict.json \
  --settings Compile/engine_settings.json \
  --no_ssl \
  --time_budget 4  # hours
```

**RESTler configuration:**

```json
{
  "max_combinations": 20,
  "max_request_execution_time": 60,
  "no_ssl": false,
  "host": "staging.example.com",
  "token_refresh_interval": 300,
  "token_refresh_command": "python get_token.py",
  "custom_mutations": {
    "restler_custom_payload": {
      "user_id": ["1", "2", "99999", "-1", "0", "null", "undefined"],
      "amount": ["0", "-1", "999999999", "0.001", "NaN", "Infinity"]
    }
  }
}
```

### 4.2 Schemathesis

Schemathesis generates test cases from OpenAPI/GraphQL schemas using
property-based testing.

```bash
# Install Schemathesis
pip install schemathesis

# Run against OpenAPI spec
schemathesis run https://staging.example.com/api/openapi.json

# Run with authentication
schemathesis run https://staging.example.com/api/openapi.json \
  --auth user:password \
  --header "Authorization: Bearer $TOKEN"

# Run specific checks
schemathesis run https://staging.example.com/api/openapi.json \
  --checks all \
  --max-response-time 5000

# Run against GraphQL
schemathesis run https://staging.example.com/graphql \
  --hypothesis-max-examples 1000

# Output in JUnit format for CI
schemathesis run https://staging.example.com/api/openapi.json \
  --junit-xml=schemathesis-results.xml
```

**Schemathesis in Python tests:**

```python
# test_api_fuzz.py - Schemathesis integrated with pytest
import schemathesis

schema = schemathesis.from_uri(
    "https://staging.example.com/api/openapi.json",
    base_url="https://staging.example.com",
)

@schema.parametrize()
def test_api(case):
    """Property-based API testing from OpenAPI spec."""
    response = case.call()
    case.validate_response(response)

# Run with: pytest test_api_fuzz.py -v --hypothesis-max-examples=500
```

### 4.3 Custom API Fuzzer

```python
# custom_api_fuzzer.py - Simple custom API fuzzer
import requests
import random
import string
import json
import sys

class APIFuzzer:
    """Simple API endpoint fuzzer for custom protocols."""

    FUZZ_STRINGS = [
        "", " ", "\t", "\n", "\r\n",
        "null", "undefined", "NaN", "Infinity",
        "true", "false", "0", "-1", "999999999999",
        "' OR '1'='1", "<script>alert(1)</script>",
        "{{7*7}}", "${7*7}", "#{7*7}",
        "../../../etc/passwd", "/dev/null",
        "A" * 10000, "\x00" * 100,
        '{"__proto__": {"admin": true}}',
        "eyJhbGciOiJub25lIn0.eyJhZG1pbiI6dHJ1ZX0.",
    ]

    FUZZ_NUMBERS = [
        0, -1, 1, -999999999, 999999999,
        0.1, -0.1, float('inf'), float('-inf'),
        2**31 - 1, 2**31, 2**63 - 1, 2**63,
    ]

    def __init__(self, base_url, auth_header=None):
        self.base_url = base_url
        self.headers = {"Content-Type": "application/json"}
        if auth_header:
            self.headers["Authorization"] = auth_header
        self.findings = []

    def fuzz_endpoint(self, method, path, schema):
        """Fuzz a single endpoint with generated inputs."""
        url = f"{self.base_url}{path}"

        for i in range(100):
            payload = self._generate_payload(schema)
            try:
                response = requests.request(
                    method, url, json=payload,
                    headers=self.headers, timeout=10
                )
                self._analyze_response(method, path, payload, response)
            except requests.exceptions.Timeout:
                self.findings.append({
                    'type': 'timeout',
                    'endpoint': f"{method} {path}",
                    'payload': payload,
                    'detail': 'Request timed out (possible DoS)',
                })
            except Exception as e:
                self.findings.append({
                    'type': 'error',
                    'endpoint': f"{method} {path}",
                    'payload': payload,
                    'detail': str(e),
                })

    def _generate_payload(self, schema):
        """Generate a fuzzed payload based on schema."""
        payload = {}
        for field, field_type in schema.items():
            if field_type == 'string':
                payload[field] = random.choice(self.FUZZ_STRINGS)
            elif field_type == 'number':
                payload[field] = random.choice(self.FUZZ_NUMBERS)
            elif field_type == 'boolean':
                payload[field] = random.choice([True, False, "true", 0, 1, None])
            elif field_type == 'array':
                payload[field] = [random.choice(self.FUZZ_STRINGS) for _ in range(random.randint(0, 100))]
            else:
                payload[field] = random.choice(self.FUZZ_STRINGS)
        return payload

    def _analyze_response(self, method, path, payload, response):
        """Check response for indicators of vulnerabilities."""
        body = response.text.lower()
        indicators = []

        if response.status_code == 500:
            indicators.append("Internal server error (500)")
        if any(kw in body for kw in ['stack trace', 'traceback', 'exception']):
            indicators.append("Stack trace in response")
        if any(kw in body for kw in ['sql', 'syntax error', 'mysql', 'postgresql']):
            indicators.append("Database error in response")
        if '<script>' in body and '<script>' in json.dumps(payload):
            indicators.append("Potential XSS (reflected script tag)")

        if indicators:
            self.findings.append({
                'endpoint': f"{method} {path}",
                'payload': payload,
                'status_code': response.status_code,
                'indicators': indicators,
            })


# Usage
if __name__ == '__main__':
    fuzzer = APIFuzzer(
        base_url="https://staging.example.com/api",
        auth_header="Bearer test-token"
    )

    fuzzer.fuzz_endpoint("POST", "/users", {
        "name": "string",
        "email": "string",
        "age": "number",
        "active": "boolean",
    })

    for finding in fuzzer.findings:
        print(json.dumps(finding, indent=2, default=str))
```

---

## 5. Protocol Fuzzing

### 5.1 gRPC Fuzzing

```python
# grpc_fuzz.py - gRPC service fuzzer
import grpc
import atheris
import sys

# Import generated protobuf classes
from myservice_pb2 import Request
from myservice_pb2_grpc import MyServiceStub

def fuzz_grpc(data):
    """Fuzz a gRPC service endpoint."""
    fdp = atheris.FuzzedDataProvider(data)

    # Create a fuzzed request
    request = Request()
    request.name = fdp.ConsumeUnicodeNoSurrogates(256)
    request.value = fdp.ConsumeInt(4)
    request.data = fdp.ConsumeBytes(1024)

    channel = grpc.insecure_channel('localhost:50051')
    stub = MyServiceStub(channel)

    try:
        response = stub.ProcessRequest(request, timeout=5)
    except grpc.RpcError:
        pass  # Expected for invalid inputs
    finally:
        channel.close()

if __name__ == '__main__':
    atheris.Setup(sys.argv, fuzz_grpc)
    atheris.Fuzz()
```

### 5.2 WebSocket Fuzzing

```python
# websocket_fuzz.py - WebSocket fuzzer
import asyncio
import websockets
import random
import json
import struct

FUZZ_MESSAGES = [
    b"",
    b"\x00" * 1000,
    b"\xff" * 1000,
    json.dumps({"type": "' OR 1=1 --"}).encode(),
    json.dumps({"type": "a" * 100000}).encode(),
    json.dumps({"type": None}).encode(),
    b"not json at all",
    struct.pack("!I", 0xdeadbeef),
    json.dumps({"__proto__": {"admin": True}}).encode(),
]

async def fuzz_websocket(url, num_iterations=1000):
    """Fuzz a WebSocket endpoint."""
    findings = []

    for i in range(num_iterations):
        try:
            async with websockets.connect(url, open_timeout=5) as ws:
                message = random.choice(FUZZ_MESSAGES)

                # Optionally mutate the message
                if random.random() > 0.5:
                    pos = random.randint(0, max(0, len(message) - 1))
                    byte_val = random.randint(0, 255)
                    message = message[:pos] + bytes([byte_val]) + message[pos+1:]

                await ws.send(message)

                try:
                    response = await asyncio.wait_for(ws.recv(), timeout=5)
                    if b"error" in response.lower() if isinstance(response, bytes) \
                            else "error" in response.lower():
                        findings.append({
                            'iteration': i,
                            'message': message.hex()[:100],
                            'response': response[:200] if isinstance(response, str)
                                else response.hex()[:200],
                        })
                except asyncio.TimeoutError:
                    findings.append({
                        'iteration': i,
                        'message': message.hex()[:100],
                        'issue': 'timeout - possible hang',
                    })

        except Exception as e:
            findings.append({
                'iteration': i,
                'issue': str(e),
            })

    return findings

if __name__ == '__main__':
    results = asyncio.run(fuzz_websocket("ws://localhost:8080/ws"))
    print(json.dumps(results, indent=2))
```

---

## 6. Corpus Management

### 6.1 Seed Corpus

A good seed corpus dramatically improves fuzzing effectiveness by providing
starting inputs that already exercise interesting code paths.

```bash
# Seed corpus best practices:
# 1. Include valid inputs for each supported format
# 2. Include edge cases (empty, minimum, maximum)
# 3. Include inputs that exercise different code paths
# 4. Keep seeds small (large seeds slow mutation)

# Example seed corpus for a JSON parser:
seeds/
  valid-object.json      # {"key": "value"}
  valid-array.json       # [1, 2, 3]
  valid-nested.json      # {"a": {"b": [1, {"c": true}]}}
  empty-object.json      # {}
  empty-array.json       # []
  empty-string.json      # ""
  null.json              # null
  unicode.json           # {"key": "\u00e9\u00e8\u00ea"}
  large-number.json      # 9999999999999999999999999
  deep-nesting.json      # {"a":{"a":{"a":{"a":...}}}}
```

### 6.2 Corpus Minimization

```bash
# AFL++ corpus minimization
afl-cmin -i full-corpus/ -o minimized-corpus/ -- ./target_afl @@

# libFuzzer corpus minimization
./fuzz_target -merge=1 minimized-corpus/ full-corpus/

# cargo-fuzz corpus minimization
cargo fuzz cmin fuzz_parser
```

---

## 7. Crash Triage and Deduplication

### 7.1 Crash Triage Workflow

```
Crash found by fuzzer
    |
    v
Minimize crashing input (tmin/minimize)
    |
    v
Run under sanitizer (ASAN/MSAN/UBSAN)
    |
    v
Capture stack trace
    |
    v
Deduplicate (same stack trace = same bug)
    |
    v
Determine severity:
    - Memory corruption (buffer overflow, use-after-free) = CRITICAL
    - Assertion failure = MEDIUM
    - Unhandled exception / panic = MEDIUM
    - Timeout / hang = LOW-MEDIUM
    - OOM (out of memory) = LOW
    |
    v
File bug with:
    - Minimized crashing input
    - Stack trace
    - Sanitizer report
    - Severity assessment
    - Reproduction command
```

### 7.2 Crash Minimization

```bash
# AFL++ crash minimization
afl-tmin -i crash-input -o minimized-crash -- ./target_afl @@

# libFuzzer crash minimization
./fuzz_target -minimize_crash=1 -exact_artifact_path=minimized-crash crash-input

# cargo-fuzz crash minimization
cargo fuzz tmin fuzz_parser artifacts/fuzz_parser/crash-abc123
```

---

## 8. CI Integration

### 8.1 Go Fuzz Tests in CI

```yaml
# .github/workflows/fuzz.yml
name: Fuzz Testing
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM

jobs:
  go-fuzz:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - name: Run fuzz tests (5 minutes each)
        run: |
          for fuzz_func in $(go test -list 'Fuzz.*' ./... 2>/dev/null | grep '^Fuzz'); do
            echo "Fuzzing $fuzz_func..."
            go test -fuzz="^${fuzz_func}$" -fuzztime=5m ./... || true
          done

      - name: Upload crash artifacts
        uses: actions/upload-artifact@v4
        with:
          name: fuzz-crashes
          path: testdata/fuzz/*/
        if: failure()
```

### 8.2 Schemathesis API Fuzzing in CI

```yaml
# .github/workflows/api-fuzz.yml
name: API Fuzz Testing
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 3 * * 1'  # Weekly Monday at 3 AM

jobs:
  api-fuzz:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start application
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 15

      - name: Install Schemathesis
        run: pip install schemathesis

      - name: Run API fuzz testing
        run: |
          schemathesis run http://localhost:8080/api/openapi.json \
            --checks all \
            --max-response-time 5000 \
            --hypothesis-max-examples 500 \
            --junit-xml=schemathesis-results.xml \
            --header "Authorization: Bearer ${{ secrets.TEST_API_TOKEN }}"

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: schemathesis-results
          path: schemathesis-results.xml
        if: always()
```

---

## 9. Best Practices

1. **Start with coverage-guided fuzzing.** Coverage-guided fuzzers (AFL++, libFuzzer,
   go test -fuzz) are dramatically more effective than random mutation because they
   learn which inputs explore new code paths. Always prefer coverage-guided over
   purely random fuzzing.

2. **Write focused fuzzing harnesses.** Each harness should target one function or
   module. Fuzzing an entire application is less effective than fuzzing individual
   parsers, decoders, and validators in isolation.

3. **Provide a high-quality seed corpus.** Start with valid inputs that exercise
   different code paths. Include edge cases (empty input, maximum size, special
   characters). Small, diverse seeds produce better results than large, similar ones.

4. **Enable sanitizers during fuzzing.** Address Sanitizer (ASAN), Memory Sanitizer
   (MSAN), and Undefined Behavior Sanitizer (UBSAN) detect bugs that might not
   cause visible crashes but are still exploitable. Always fuzz with sanitizers
   enabled.

5. **Run fuzzing continuously, not just once.** Fuzzing finds more bugs over time.
   Set up nightly or continuous fuzzing (OSS-Fuzz, ClusterFuzz, or scheduled CI
   jobs) to accumulate coverage and find deeper bugs.

6. **Minimize and deduplicate crashes promptly.** Use tmin/minimize to reduce crashing
   inputs to the smallest reproducer. Deduplicate by stack trace to avoid filing
   multiple reports for the same bug.

7. **Fuzz APIs with schema-based fuzzers.** Use Schemathesis or RESTler for REST
   APIs, which understand API structure and can test stateful interactions. Generic
   HTTP fuzzing misses API-specific issues.

8. **Integrate fuzz testing into CI/CD.** Run short fuzz sessions (5-15 minutes) in
   CI on every merge. Run extended sessions (hours) on a nightly schedule. Fail
   the build if new crashes are found.

9. **Fuzz all input parsers and decoders.** Any function that processes external
   input (JSON, XML, YAML, protobuf, custom binary formats, URLs, headers) is a
   high-value fuzzing target. Prioritize parsers that handle untrusted input.

10. **Track fuzzing coverage over time.** Monitor which code paths have been fuzzed
    and which remain uncovered. Use coverage reports to identify under-tested areas
    and write additional harnesses for them.

---

## 10. Anti-Patterns

1. **Fuzzing only with random bytes.** Pure random input rarely exercises deep code
   paths. Use coverage-guided fuzzing with a seed corpus to reach meaningful
   program states.

2. **Writing a single harness for the entire application.** Application-level fuzzing
   is too slow and imprecise. Write separate harnesses for each parser, decoder,
   and input processing function.

3. **Ignoring crashes because "fuzzing always finds crashes."** Every crash from
   a fuzzer is a potential vulnerability. Triage every unique crash, assess severity,
   and fix security-relevant issues promptly.

4. **Fuzzing without sanitizers.** Without ASAN/MSAN/UBSAN, many memory corruption
   bugs do not cause visible crashes. The program may silently corrupt memory without
   the fuzzer detecting a problem.

5. **Running fuzzing for a few minutes and declaring it complete.** Fuzzing is a
   time-dependent process. Short runs find shallow bugs; deep bugs require hours
   or days of continuous fuzzing. Allocate sufficient time for meaningful results.

6. **Not minimizing the corpus.** Over time, the corpus grows with redundant inputs.
   Periodically minimize the corpus to remove inputs that do not contribute unique
   coverage. Smaller corpora are faster to process.

7. **Fuzzing only at development time, not continuously.** New code changes can
   introduce regressions in previously fuzzed components. Continuous fuzzing
   catches regressions as they are introduced.

8. **Not fuzzing third-party library integrations.** Even if a library is well-tested,
   the way your application calls it may trigger unexpected behavior. Fuzz the
   integration points between your code and third-party libraries.

---

## 11. Enforcement Checklist

```
FUZZ TESTING ENFORCEMENT CHECKLIST
====================================

Harness Development:
[ ] Fuzzing harnesses written for all input parsers and decoders
[ ] Harnesses written for all network protocol handlers
[ ] Harnesses use FuzzedDataProvider for structured input generation
[ ] Harnesses include boundary checks to avoid false timeouts
[ ] Seed corpus created with representative valid inputs
[ ] Dictionary files created for format-specific tokens

Infrastructure:
[ ] Coverage-guided fuzzer selected for each language (AFL++, libFuzzer, etc.)
[ ] Sanitizers enabled (ASAN, MSAN, UBSAN) during fuzzing
[ ] Fuzzing infrastructure provisioned (CI runners, dedicated servers)
[ ] Corpus stored in version control or artifact storage

CI Integration:
[ ] Short fuzz sessions (5-15 min) run in CI on every merge to main
[ ] Extended fuzz sessions (1-8 hours) run on nightly schedule
[ ] API fuzz testing integrated (Schemathesis or RESTler)
[ ] CI fails on new crashes
[ ] Crash artifacts uploaded for analysis

Crash Management:
[ ] Crash triage workflow defined
[ ] Crash minimization performed for all unique crashes
[ ] Crash deduplication by stack trace implemented
[ ] Security-relevant crashes have SLAs for remediation
[ ] Crash fixes include regression test (crashing input as test case)

Governance:
[ ] Fuzzing coverage tracked and reported
[ ] Corpus minimized periodically (monthly)
[ ] Fuzzing harnesses reviewed in code review
[ ] OSS-Fuzz integration evaluated for open-source components
[ ] Fuzzing effectiveness metrics reported (bugs found, coverage gained)
```
