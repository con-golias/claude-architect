# Protocol Buffers Directive

> **AI Plugin Directive:** When designing, reviewing, or generating Protocol Buffer schemas for gRPC services, APPLY every rule in this document. USE correct proto3 syntax, naming conventions, field numbering, backwards compatibility rules, and validation patterns. NEVER generate .proto files that violate these directives. This is the definitive reference for all protobuf schema decisions.

**Core Rule: ALWAYS use proto3 syntax. ALWAYS follow Google's API style guide for naming. NEVER break backwards compatibility within a version. NEVER reuse or reassign field numbers. ALWAYS design messages for evolution from day one.**

---

## 1. Proto3 File Structure

EVERY .proto file MUST follow this structure, in this order.

### 1.1 Complete Annotated Example

```protobuf
// 1. Syntax declaration — MUST be first non-comment line
syntax = "proto3";

// 2. Package — MUST include company, service, and version
package acme.user.v1;

// 3. Options — language-specific generation settings
option go_package = "github.com/acme/proto/user/v1;userv1";
option java_package = "com.acme.user.v1";
option java_multiple_files = true;
option csharp_namespace = "Acme.User.V1";

// 4. Imports — standard library first, then project imports
import "google/protobuf/timestamp.proto";
import "google/protobuf/field_mask.proto";
import "google/protobuf/empty.proto";
import "google/api/annotations.proto";
import "buf/validate/validate.proto";

// 5. Service definitions
service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty);
}

// 6. Request/Response messages (in RPC order)
message GetUserRequest {
  string user_id = 1;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
  string filter = 3;
  string order_by = 4;
}

message ListUsersResponse {
  repeated User users = 1;
  string next_page_token = 2;
  int32 total_size = 3;
}

message CreateUserRequest {
  User user = 1;
}

message UpdateUserRequest {
  User user = 1;
  google.protobuf.FieldMask update_mask = 2;
}

message DeleteUserRequest {
  string user_id = 1;
}

// 7. Resource messages
message User {
  string id = 1;
  string email = 2;
  string display_name = 3;
  UserRole role = 4;
  google.protobuf.Timestamp created_at = 5;
  google.protobuf.Timestamp updated_at = 6;
}

// 8. Enums
enum UserRole {
  USER_ROLE_UNSPECIFIED = 0;  // MUST have zero value as unspecified
  USER_ROLE_ADMIN = 1;
  USER_ROLE_EDITOR = 2;
  USER_ROLE_VIEWER = 3;
}
```

### 1.2 File Structure Rules

- **MUST** declare `syntax = "proto3"` as the first non-comment line
- **MUST** include a package with `company.service.version` format
- **ALWAYS** set `option go_package` for Go code generation
- **ALWAYS** order imports: google/protobuf → google/api → third-party → project
- **ALWAYS** define services before messages in the file
- **MUST** keep one service per .proto file (unless tightly coupled)
- **ALWAYS** group request/response messages near their service RPCs

---

## 2. Scalar Types & Defaults

KNOW the scalar type mappings across languages. CHOOSE the right type for each field.

### 2.1 Complete Scalar Type Reference

| Proto Type | Default | Go | TypeScript | Python | Wire Type | Notes |
|-----------|---------|-----|-----------|--------|-----------|-------|
| `double` | 0.0 | `float64` | `number` | `float` | Fixed 64-bit | IEEE 754 |
| `float` | 0.0 | `float32` | `number` | `float` | Fixed 32-bit | IEEE 754 |
| `int32` | 0 | `int32` | `number` | `int` | Varint | Inefficient for negatives |
| `int64` | 0 | `int64` | `string` | `int` | Varint | TS uses string (no 64-bit int) |
| `uint32` | 0 | `uint32` | `number` | `int` | Varint | Unsigned |
| `uint64` | 0 | `uint64` | `string` | `int` | Varint | TS uses string |
| `sint32` | 0 | `int32` | `number` | `int` | ZigZag + Varint | USE for frequently negative values |
| `sint64` | 0 | `int64` | `string` | `int` | ZigZag + Varint | USE for frequently negative values |
| `fixed32` | 0 | `uint32` | `number` | `int` | Fixed 32-bit | Efficient when values > 2²⁸ |
| `fixed64` | 0 | `uint64` | `string` | `int` | Fixed 64-bit | Efficient when values > 2⁵⁶ |
| `sfixed32` | 0 | `int32` | `number` | `int` | Fixed 32-bit | Signed fixed |
| `sfixed64` | 0 | `int64` | `string` | `int` | Fixed 64-bit | Signed fixed |
| `bool` | false | `bool` | `boolean` | `bool` | Varint | |
| `string` | `""` | `string` | `string` | `str` | Length-delimited | MUST be UTF-8 |
| `bytes` | `""` | `[]byte` | `Uint8Array` | `bytes` | Length-delimited | Arbitrary binary |

### 2.2 Type Selection Decision Tree

```
Need a number?
    │
    ├─ Floating point? ──────────▶ double (default) or float (if space matters)
    │
    ├─ Integer?
    │    ├─ Always positive? ────▶ uint32 / uint64
    │    ├─ Frequently negative? ▶ sint32 / sint64 (ZigZag is smaller)
    │    ├─ Large values (>2²⁸)? ▶ fixed32 / fixed64 (smaller than varint)
    │    └─ General purpose? ────▶ int32 / int64
    │
    ├─ Need text? ───────────────▶ string (MUST be UTF-8)
    │
    ├─ Need binary? ─────────────▶ bytes
    │
    └─ Need boolean? ────────────▶ bool
```

### 2.3 Critical Default Value Rules

In proto3, ALL fields have default values. You CANNOT distinguish "field was set to default" from "field was not set."

```protobuf
message Example {
  string name = 1;    // default: ""  — is it empty or not set?
  int32 age = 2;      // default: 0   — is it zero or not set?
  bool active = 3;    // default: false — is it false or not set?
}
```

**Solution — Use wrapper types for optional semantics:**
```protobuf
import "google/protobuf/wrappers.proto";

message Example {
  google.protobuf.StringValue name = 1;   // null = not set, "" = empty
  google.protobuf.Int32Value age = 2;     // null = not set, 0 = zero
  google.protobuf.BoolValue active = 3;   // null = not set, false = false
}
```

**Solution — Use proto3 `optional` keyword (preferred in modern proto3):**
```protobuf
message Example {
  optional string name = 1;   // has_name() method available
  optional int32 age = 2;     // has_age() method available
  optional bool active = 3;   // has_active() method available
}
```

### 2.4 Scalar Type Rules

- **USE** `int32`/`int64` for general integers — they are the default choice
- **USE** `sint32`/`sint64` when values are frequently negative (ZigZag encoding is smaller)
- **USE** `fixed32`/`fixed64` when values are consistently large (more efficient than varint)
- **NEVER** use `float`/`double` for money — use `int64` cents or a custom `Money` message
- **ALWAYS** validate `string` fields are valid UTF-8 — invalid UTF-8 causes serialization errors
- **USE** `optional` keyword when you need to distinguish "not set" from "default value"
- **KNOW** that `int64`/`uint64` map to `string` in TypeScript — plan your client code accordingly

---

## 3. Message Design

DESIGN messages for clarity, evolution, and efficient serialization.

### 3.1 Flat vs Nested Messages

```protobuf
// CORRECT — nested for logical grouping
message User {
  string id = 1;
  string email = 2;
  Address address = 3;        // nested message
  repeated PhoneNumber phones = 4;
}

message Address {
  string street = 1;
  string city = 2;
  string state = 3;
  string country = 4;
  string postal_code = 5;
}

message PhoneNumber {
  string number = 1;
  PhoneType type = 2;
}

// WRONG — flat mega-message
message User {
  string id = 1;
  string email = 2;
  string address_street = 3;    // ✗ flat — hard to reuse, hard to evolve
  string address_city = 4;
  string address_state = 5;
  string address_country = 6;
  string address_postal_code = 7;
  string phone_1_number = 8;    // ✗ numbered fields — use repeated instead
  string phone_2_number = 9;
}
```

### 3.2 Composition Patterns

```protobuf
// CORRECT — embed by reference (ID) for loose coupling
message Order {
  string id = 1;
  string user_id = 2;          // reference by ID — fetched separately
  repeated OrderItem items = 3;
  Money total = 4;
}

// CORRECT — embed by value for tightly coupled data
message OrderItem {
  string product_id = 1;
  string product_name = 2;     // denormalized — snapshot at order time
  int32 quantity = 3;
  Money unit_price = 4;        // embedded value object
}

message Money {
  string currency_code = 1;    // ISO 4217: "USD", "EUR"
  int64 units = 2;             // whole units
  int32 nanos = 3;             // nano units (10⁻⁹)
}
```

### 3.3 Message Design Rules

- **ALWAYS** use nested messages for logical groupings (Address, Money, Coordinates)
- **NEVER** create flat mega-messages with 50+ fields
- **USE** reference-by-ID for loosely coupled entities (user_id, not embedded User)
- **USE** embedded messages for value objects that have no independent identity (Money, Address)
- **KEEP** messages focused — split into separate messages at ~15-20 fields
- **ALWAYS** use `repeated` for collections — NEVER number fields (phone_1, phone_2)
- **NEVER** use `float`/`double` for monetary values — use a `Money` message

---

## 4. Enums

### 4.1 Enum Rules

EVERY enum MUST have a zero value with `_UNSPECIFIED` suffix.

```protobuf
// CORRECT
enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;  // MUST be zero — represents "not set"
  ORDER_STATUS_PENDING = 1;
  ORDER_STATUS_CONFIRMED = 2;
  ORDER_STATUS_SHIPPED = 3;
  ORDER_STATUS_DELIVERED = 4;
  ORDER_STATUS_CANCELLED = 5;
}

// WRONG — no unspecified zero value
enum OrderStatus {
  PENDING = 0;     // ✗ default value has semantic meaning
  CONFIRMED = 1;
  SHIPPED = 2;
}

// WRONG — no enum type prefix
enum OrderStatus {
  UNSPECIFIED = 0;  // ✗ collides with other enums' UNSPECIFIED
  PENDING = 1;
}
```

### 4.2 Enum Naming Convention

```
ENUM_TYPE_NAME + _ + VALUE_NAME

enum Foo {
  FOO_UNSPECIFIED = 0;
  FOO_BAR = 1;
  FOO_BAZ = 2;
}
```

### 4.3 Enum Evolution

```protobuf
enum Color {
  COLOR_UNSPECIFIED = 0;
  COLOR_RED = 1;
  COLOR_GREEN = 2;
  COLOR_BLUE = 3;
  // Adding new values is SAFE
  COLOR_YELLOW = 4;

  // NEVER remove or renumber existing values
  // Instead, deprecate:
  reserved 5;                   // reserve removed field numbers
  reserved "COLOR_OBSOLETE";    // reserve removed names
}
```

### 4.4 allow_alias Option

USE `allow_alias` ONLY when two names represent the same concept.

```protobuf
enum Priority {
  option allow_alias = true;
  PRIORITY_UNSPECIFIED = 0;
  PRIORITY_LOW = 1;
  PRIORITY_DEFAULT = 1;       // alias for LOW
  PRIORITY_HIGH = 2;
  PRIORITY_URGENT = 3;
}
```

### 4.5 Enum Rules

- **MUST** have zero value as `TYPE_UNSPECIFIED` — it is the default for unset fields
- **ALWAYS** prefix enum values with the enum type name in UPPER_SNAKE_CASE
- **NEVER** reuse or reassign enum numbers
- **USE** `reserved` for removed values — prevents accidental reuse
- **NEVER** rely on the zero value having semantic meaning
- **DO NOT** use `allow_alias` unless two names genuinely mean the same thing

---

## 5. Field Numbers & Wire Format

UNDERSTAND field numbers — they are the permanent identity of each field on the wire.

### 5.1 Wire Types

| Wire Type | ID | Proto Types | Encoding |
|-----------|----|------------|----------|
| Varint | 0 | int32, int64, uint32, uint64, sint32, sint64, bool, enum | Variable-length integer |
| 64-bit | 1 | fixed64, sfixed64, double | Fixed 8 bytes |
| Length-delimited | 2 | string, bytes, embedded messages, repeated (packed) | Length prefix + data |
| 32-bit | 5 | fixed32, sfixed32, float | Fixed 4 bytes |

### 5.2 Field Number Encoding

```
Field key = (field_number << 3) | wire_type

Field numbers 1-15:   1 byte on wire  ← USE for frequently set fields
Field numbers 16-2047: 2 bytes on wire
Field numbers 2048+:   3+ bytes on wire

Reserved ranges:
  19000-19999: Reserved by protobuf implementation (NEVER use)
  Maximum:     2²⁹ - 1 (536,870,911)
```

### 5.3 Field Number Strategy

```protobuf
message Event {
  // Fields 1-15: high-frequency fields (1 byte on wire)
  string id = 1;                          // always present
  string type = 2;                        // always present
  google.protobuf.Timestamp timestamp = 3; // always present
  string source = 4;                      // almost always present
  bytes payload = 5;                      // usually present

  // Fields 16+: less common fields (2 bytes on wire)
  map<string, string> metadata = 16;      // sometimes present
  string correlation_id = 17;             // sometimes present
  int32 priority = 18;                    // rarely set

  // Leave gaps for future high-frequency fields
  // Fields 6-15 reserved for future must-have fields
}
```

### 5.4 Reserved Fields

USE `reserved` to prevent reuse of removed fields.

```protobuf
message User {
  reserved 4, 8 to 10;                    // reserve removed field numbers
  reserved "middle_name", "nickname";      // reserve removed field names

  string id = 1;
  string email = 2;
  string display_name = 3;
  // field 4 was middle_name — removed in v1.2
  UserRole role = 5;
}
```

### 5.5 Field Number Rules

- **ALWAYS** use field numbers 1-15 for the most frequently set fields (saves 1 byte per field)
- **NEVER** reuse a field number — ever, even after removing a field
- **MUST** use `reserved` when removing fields to prevent accidental reuse
- **NEVER** use field numbers 19000-19999 — they are reserved by protobuf
- **LEAVE** gaps in field numbers for future additions to the 1-15 range
- **MUST** reserve both the field number AND the name when removing a field

---

## 6. Advanced Types

### 6.1 Oneof

USE `oneof` when exactly one of several fields will be set. The fields share memory.

```protobuf
message Notification {
  string id = 1;
  string user_id = 2;

  oneof content {
    EmailNotification email = 3;
    SmsNotification sms = 4;
    PushNotification push = 5;
  }
}

message EmailNotification {
  string subject = 1;
  string body = 2;
}

message SmsNotification {
  string phone_number = 1;
  string message = 2;
}

message PushNotification {
  string title = 1;
  string body = 2;
  string deep_link = 3;
}
```

**Go Usage:**
```go
switch content := notification.GetContent().(type) {
case *pb.Notification_Email:
    sendEmail(content.Email)
case *pb.Notification_Sms:
    sendSms(content.Sms)
case *pb.Notification_Push:
    sendPush(content.Push)
case nil:
    return status.Error(codes.InvalidArgument, "content is required")
}
```

**Oneof Rules:**
- **NEVER** put `repeated` or `map` fields inside `oneof`
- **ALWAYS** handle the `nil` / unset case
- **USE** oneof for polymorphic payloads — NOT for optional fields (use `optional` instead)
- **KNOW** that setting any oneof field clears all other oneof fields

### 6.2 Maps

```protobuf
message Config {
  map<string, string> labels = 1;         // string → string
  map<string, FeatureFlag> features = 2;  // string → message
  // map<int32, string> codes = 3;        // int keys are allowed but unusual
}
```

**Map Rules:**
- **ALWAYS** use `string` keys for maps — other key types have poor JSON compatibility
- **NEVER** use `float`, `double`, `bytes`, or `enum` as map keys
- **KNOW** that map ordering is NOT preserved — never depend on iteration order
- **DO NOT** put maps inside `oneof`

### 6.3 google.protobuf.Any

USE `Any` for truly polymorphic fields. PREFER oneof when the set of types is known.

```protobuf
import "google/protobuf/any.proto";

message Event {
  string type = 1;
  google.protobuf.Timestamp occurred_at = 2;
  google.protobuf.Any payload = 3;  // can hold any message type
}
```

**Go — Packing/Unpacking:**
```go
import "google.golang.org/protobuf/types/known/anypb"

// Pack
anyPayload, err := anypb.New(&pb.UserCreatedEvent{UserId: "123"})
event := &pb.Event{Type: "user.created", Payload: anyPayload}

// Unpack
var userEvent pb.UserCreatedEvent
if err := event.Payload.UnmarshalTo(&userEvent); err != nil {
    // wrong type or corrupt data
}
```

**Any Rules:**
- **PREFER** `oneof` over `Any` when the set of types is known at compile time
- **USE** `Any` only for plugin/extension systems where types are not known ahead of time
- **ALWAYS** include a `type` discriminator field alongside `Any` for efficient routing
- **KNOW** that `Any` requires the type URL to be registered for deserialization

### 6.4 Timestamps & Durations

```protobuf
import "google/protobuf/timestamp.proto";
import "google/protobuf/duration.proto";

message Task {
  string id = 1;
  google.protobuf.Timestamp created_at = 2;   // absolute point in time
  google.protobuf.Timestamp deadline = 3;
  google.protobuf.Duration timeout = 4;        // relative time span
  google.protobuf.Duration estimated_time = 5;
}
```

**Go Usage:**
```go
import "google.golang.org/protobuf/types/known/timestamppb"
import "google.golang.org/protobuf/types/known/durationpb"

// Create
task := &pb.Task{
    CreatedAt: timestamppb.Now(),
    Timeout:   durationpb.New(30 * time.Second),
}

// Read
createdTime := task.GetCreatedAt().AsTime()   // → time.Time
timeoutDur := task.GetTimeout().AsDuration()  // → time.Duration
```

**Timestamp/Duration Rules:**
- **ALWAYS** use `google.protobuf.Timestamp` for absolute times — NEVER use `int64` epoch
- **ALWAYS** use `google.protobuf.Duration` for time spans — NEVER use `int64` milliseconds
- **KNOW** that Timestamp is UTC — never store timezone in a separate field
- **ALWAYS** check for nil before calling `AsTime()` or `AsDuration()`

---

## 7. Well-Known Types Reference

ALWAYS use well-known types instead of inventing custom equivalents.

| Type | Import | Use Case | Go Type |
|------|--------|----------|---------|
| `Timestamp` | `google/protobuf/timestamp.proto` | Absolute point in time | `*timestamppb.Timestamp` |
| `Duration` | `google/protobuf/duration.proto` | Time span | `*durationpb.Duration` |
| `Empty` | `google/protobuf/empty.proto` | No data (Delete responses) | `*emptypb.Empty` |
| `FieldMask` | `google/protobuf/field_mask.proto` | Partial updates, field selection | `*fieldmaskpb.FieldMask` |
| `Struct` | `google/protobuf/struct.proto` | Arbitrary JSON-like data | `*structpb.Struct` |
| `Value` | `google/protobuf/struct.proto` | Single dynamic value | `*structpb.Value` |
| `Any` | `google/protobuf/any.proto` | Any protobuf message | `*anypb.Any` |
| `BoolValue` | `google/protobuf/wrappers.proto` | Nullable bool | `*wrapperspb.BoolValue` |
| `StringValue` | `google/protobuf/wrappers.proto` | Nullable string | `*wrapperspb.StringValue` |
| `Int32Value` | `google/protobuf/wrappers.proto` | Nullable int32 | `*wrapperspb.Int32Value` |
| `Int64Value` | `google/protobuf/wrappers.proto` | Nullable int64 | `*wrapperspb.Int64Value` |
| `FloatValue` | `google/protobuf/wrappers.proto` | Nullable float | `*wrapperspb.FloatValue` |
| `DoubleValue` | `google/protobuf/wrappers.proto` | Nullable double | `*wrapperspb.DoubleValue` |
| `BytesValue` | `google/protobuf/wrappers.proto` | Nullable bytes | `*wrapperspb.BytesValue` |
| `UInt32Value` | `google/protobuf/wrappers.proto` | Nullable uint32 | `*wrapperspb.UInt32Value` |

### 7.1 Well-Known Type Rules

- **ALWAYS** use `Timestamp` instead of `int64` for times
- **ALWAYS** use `Duration` instead of `int64` for time spans
- **ALWAYS** use `Empty` for RPCs with no response payload (like Delete)
- **USE** `FieldMask` for partial update operations
- **USE** `Struct` only when schema-less JSON-like data is truly needed (config, metadata)
- **PREFER** `optional` over wrappers for nullable fields in modern proto3
- **NEVER** define your own Timestamp, Money, or Empty messages — use the standard types

---

## 8. Service & RPC Definitions

### 8.1 RPC Method Patterns

```protobuf
service ProductService {
  // Standard CRUD
  rpc GetProduct(GetProductRequest) returns (Product);
  rpc ListProducts(ListProductsRequest) returns (ListProductsResponse);
  rpc CreateProduct(CreateProductRequest) returns (Product);
  rpc UpdateProduct(UpdateProductRequest) returns (Product);
  rpc DeleteProduct(DeleteProductRequest) returns (google.protobuf.Empty);

  // Custom methods
  rpc SearchProducts(SearchProductsRequest) returns (SearchProductsResponse);
  rpc ArchiveProduct(ArchiveProductRequest) returns (Product);

  // Streaming
  rpc WatchProducts(WatchProductsRequest) returns (stream ProductEvent);
  rpc ImportProducts(stream ImportProductRequest) returns (ImportProductsResponse);
  rpc SyncProducts(stream SyncRequest) returns (stream SyncResponse);

  // Long-running
  rpc ExportCatalog(ExportCatalogRequest) returns (google.longrunning.Operation);
}
```

### 8.2 Request/Response Message Conventions

```protobuf
// GET — request by resource ID
message GetProductRequest {
  string product_id = 1;   // ALWAYS use resource_id naming
}
// Returns: the resource directly (Product)

// LIST — paginated collection
message ListProductsRequest {
  int32 page_size = 1;
  string page_token = 2;
  string filter = 3;         // optional CEL expression
  string order_by = 4;       // optional ordering
}
message ListProductsResponse {
  repeated Product products = 1;
  string next_page_token = 2;
}

// CREATE — resource in request, resource in response
message CreateProductRequest {
  Product product = 1;        // client provides the resource
  string request_id = 2;     // idempotency key
}
// Returns: the created resource with server-assigned fields (id, created_at)

// UPDATE — resource + field mask
message UpdateProductRequest {
  Product product = 1;
  google.protobuf.FieldMask update_mask = 2;
}
// Returns: the full updated resource

// DELETE — by resource ID
message DeleteProductRequest {
  string product_id = 1;
}
// Returns: google.protobuf.Empty
```

### 8.3 Service Definition Rules

- **ALWAYS** use verb-noun naming: `GetUser`, `ListOrders`, `CreatePayment`
- **ALWAYS** suffix request messages with `Request` and response messages with `Response`
- **USE** the resource type directly as Get response (not `GetUserResponse`)
- **USE** `google.protobuf.Empty` for Delete responses
- **ALWAYS** include `page_size` and `page_token` in List requests
- **MUST** include `update_mask` in Update requests
- **ALWAYS** include `request_id` in Create requests for idempotency
- **KEEP** one service per .proto file unless services are tightly coupled

---

## 9. Backwards Compatibility & Schema Evolution

BACKWARDS COMPATIBILITY IS NON-NEGOTIABLE. A single breaking change can bring down an entire microservices system.

### 9.1 Safe vs Breaking Changes

| Change | Safe? | Notes |
|--------|-------|-------|
| Add new field | ✅ Safe | Old code ignores unknown fields |
| Add new enum value | ✅ Safe | Old code treats unknown values as 0 (unspecified) |
| Add new RPC method | ✅ Safe | Old clients don't call it |
| Add new service | ✅ Safe | Old clients don't use it |
| Add new message type | ✅ Safe | No impact on existing code |
| Remove field | ❌ Breaking | Old clients still send it, new code ignores |
| Rename field | ✅ Safe (wire) | Field numbers are what matter, not names |
| Change field number | ❌ Breaking | Wire format changes completely |
| Change field type | ❌ Breaking | Deserialization fails or corrupts data |
| Remove enum value | ❌ Breaking | Existing data with that value becomes invalid |
| Change enum number | ❌ Breaking | Stored values decode to wrong name |
| Rename RPC method | ❌ Breaking | Clients call by full method path |
| Change RPC signature | ❌ Breaking | Request/response types must match |
| Change package name | ❌ Breaking | Full method path includes package |
| Move field in/out of oneof | ❌ Breaking | Wire format changes |

### 9.2 Evolution Workflow

```
Need to change a field?
    │
    ├─ Add new field? ──────────▶ SAFE: just add it with new field number
    │
    ├─ Remove field? ───────────▶ 1. Stop reading field in server code
    │                              2. Mark field as deprecated in .proto
    │                              3. After all clients migrated: add to reserved
    │
    ├─ Change field type? ──────▶ 1. Add NEW field with new type and new number
    │                              2. Migrate clients to new field
    │                              3. Deprecate + reserve old field
    │
    ├─ Rename field? ───────────▶ SAFE on wire (field number is identity)
    │                              but regenerate client code
    │
    └─ Major restructure? ─────▶ Create new v2 package
```

### 9.3 Field Deprecation Pattern

```protobuf
message User {
  string id = 1;
  string email = 2;

  // Deprecated: use display_name (field 5) instead.
  // Will be removed in v1.3.
  string name = 3 [deprecated = true];

  reserved 4;                        // previously: middle_name
  reserved "middle_name";

  string display_name = 5;          // replacement for name
}
```

### 9.4 Compatibility Rules

- **NEVER** change a field number — it is the permanent identity
- **NEVER** change a field type — it breaks deserialization
- **NEVER** remove an enum value that might exist in stored data
- **ALWAYS** use `reserved` for removed fields — prevents accidental reuse
- **ALWAYS** reserve both the field number AND the name
- **MUST** add `[deprecated = true]` annotation before removing a field
- **ALWAYS** add new fields with new, unused field numbers
- **NEVER** move a field into or out of a `oneof`
- **MUST** create a new version package (v2) for breaking structural changes

---

## 10. Style Guide & Naming Conventions

FOLLOW Google's official .proto style guide. Consistency across all .proto files is mandatory.

### 10.1 Naming Matrix

| Element | Convention | Example | Anti-Pattern |
|---------|-----------|---------|-------------|
| File name | `lower_snake_case.proto` | `user_service.proto` | `UserService.proto` |
| Package | `lower.dot.separated.v1` | `acme.user.v1` | `Acme.User.V1` |
| Service | `PascalCase` + `Service` | `UserService` | `userService`, `Users` |
| RPC method | `PascalCase` verb-noun | `GetUser` | `getUser`, `get_user` |
| Message | `PascalCase` | `UserProfile` | `user_profile`, `userProfile` |
| Field | `lower_snake_case` | `display_name` | `displayName`, `DisplayName` |
| Enum type | `PascalCase` | `OrderStatus` | `order_status` |
| Enum value | `UPPER_SNAKE_CASE` with type prefix | `ORDER_STATUS_PENDING` | `PENDING`, `pending` |
| oneof name | `lower_snake_case` | `delivery_address` | `DeliveryAddress` |
| map field | `lower_snake_case` | `string_labels` | `StringLabels` |

### 10.2 File Organization

```
proto/
├── buf.yaml                    # buf configuration
├── buf.gen.yaml                # code generation config
├── acme/
│   ├── common/
│   │   └── v1/
│   │       ├── money.proto     # shared types
│   │       └── pagination.proto
│   ├── user/
│   │   └── v1/
│   │       ├── user_service.proto   # service + request/response
│   │       └── user.proto           # resource messages
│   └── order/
│       └── v1/
│           ├── order_service.proto
│           └── order.proto
```

### 10.3 Style Rules

- **ALWAYS** use `lower_snake_case` for field names — all languages follow this on the wire
- **ALWAYS** use `PascalCase` for message and service names
- **ALWAYS** prefix enum values with the enum type name in `UPPER_SNAKE_CASE`
- **ALWAYS** put version in directory structure AND package name
- **MUST** keep one service per file (separate resource messages into their own file if large)
- **NEVER** mix naming conventions within a project

---

## 11. Code Generation

### 11.1 protoc Compiler

```bash
# Install protoc (Linux)
apt install -y protobuf-compiler

# Install Go plugins
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Generate Go code
protoc \
  --go_out=. --go_opt=paths=source_relative \
  --go-grpc_out=. --go-grpc_opt=paths=source_relative \
  proto/acme/user/v1/user_service.proto

# Install TypeScript plugins
npm install -g @bufbuild/protoc-gen-es @connectrpc/protoc-gen-connect-es

# Generate Python code
pip install grpcio-tools
python -m grpc_tools.protoc \
  -I. \
  --python_out=./gen \
  --grpc_python_out=./gen \
  proto/acme/user/v1/user_service.proto
```

### 11.2 Generated Code Structure

**Go:**
```
gen/
└── acme/user/v1/
    ├── user_service.pb.go          # message types
    └── user_service_grpc.pb.go     # service interfaces + client stubs
```

Generated Go includes:
- Message structs with getters: `GetUserId()`, `GetEmail()`
- `Marshal()` / `Unmarshal()` for serialization
- Service interface: `UserServiceServer`
- Client stub: `UserServiceClient`
- Registration: `RegisterUserServiceServer()`

**TypeScript (Connect):**
```
gen/
└── acme/user/v1/
    ├── user_service_pb.ts          # message classes
    └── user_service_connect.ts     # service definition + client
```

**Python:**
```
gen/
└── acme/user/v1/
    ├── user_service_pb2.py         # message classes
    ├── user_service_pb2_grpc.py    # service stubs + servicer
    └── user_service_pb2.pyi        # type stubs
```

### 11.3 Code Generation Rules

- **ALWAYS** generate code into a separate `gen/` directory — NEVER mix with hand-written code
- **ALWAYS** commit generated code to version control (or generate in CI)
- **PREFER** buf over raw protoc — it handles dependencies and plugins more reliably
- **NEVER** edit generated code — your changes will be overwritten
- **ALWAYS** set `option go_package` for Go generation

---

## 12. Validation

### 12.1 buf validate (protovalidate)

USE `buf/validate` annotations for declarative field validation.

```protobuf
import "buf/validate/validate.proto";

message CreateUserRequest {
  string email = 1 [(buf.validate.field).string = {
    min_len: 5,
    max_len: 254,
    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
  }];

  string display_name = 2 [(buf.validate.field).string = {
    min_len: 1,
    max_len: 100
  }];

  int32 age = 3 [(buf.validate.field).int32 = {
    gte: 0,
    lte: 150
  }];

  repeated string tags = 4 [(buf.validate.field).repeated = {
    min_items: 0,
    max_items: 10,
    items: {
      string: { min_len: 1, max_len: 50 }
    }
  }];

  UserRole role = 5 [(buf.validate.field).enum = {
    defined_only: true  // reject unknown enum values
  }];
}
```

### 12.2 Common Validation Patterns

```protobuf
// Required field (string must not be empty)
string id = 1 [(buf.validate.field).string.min_len = 1];

// UUID format
string request_id = 2 [(buf.validate.field).string.uuid = true];

// Bounded integer
int32 page_size = 3 [(buf.validate.field).int32 = { gte: 1, lte: 100 }];

// Required message (must not be null)
User user = 4 [(buf.validate.field).required = true];

// Timestamp in the past
google.protobuf.Timestamp birth_date = 5 [(buf.validate.field).timestamp.lt_now = true];

// Duration range
google.protobuf.Duration timeout = 6 [(buf.validate.field).duration = {
  gte: { seconds: 1 },
  lte: { seconds: 300 }
}];

// Map constraints
map<string, string> labels = 7 [(buf.validate.field).map = {
  min_pairs: 0,
  max_pairs: 20,
  keys: { string: { min_len: 1, max_len: 63 } },
  values: { string: { max_len: 256 } }
}];

// Oneof must be set
oneof contact {
  option (buf.validate.oneof).required = true;
  string email = 8;
  string phone = 9;
}
```

### 12.3 Server-Side Validation (Go)

```go
import "github.com/bufbuild/protovalidate-go"

func validationInterceptor(validator *protovalidate.Validator) grpc.UnaryServerInterceptor {
    return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
        if msg, ok := req.(proto.Message); ok {
            if err := validator.Validate(msg); err != nil {
                // Convert validation errors to gRPC status
                var violations []*errdetails.BadRequest_FieldViolation
                var valErr *protovalidate.ValidationError
                if errors.As(err, &valErr) {
                    for _, v := range valErr.Violations {
                        violations = append(violations, &errdetails.BadRequest_FieldViolation{
                            Field:       v.FieldPath,
                            Description: v.Message,
                        })
                    }
                }
                st := status.New(codes.InvalidArgument, "validation failed")
                detailed, _ := st.WithDetails(&errdetails.BadRequest{FieldViolations: violations})
                return nil, detailed.Err()
            }
        }
        return handler(ctx, req)
    }
}
```

### 12.4 Validation Rules

- **ALWAYS** add validation annotations to Create and Update request messages
- **MUST** validate on the server side — client validation is a UX convenience, not security
- **USE** a validation interceptor to centralize validation logic
- **ALWAYS** return `INVALID_ARGUMENT` with `BadRequest` details for validation failures
- **NEVER** rely on client-side validation alone
- **PREFER** `buf/validate` (protovalidate) over custom validation code

---

## 13. Buf Tooling

USE `buf` as the primary protobuf toolchain. It replaces raw `protoc` with better dependency management, linting, and breaking change detection.

### 13.1 buf.yaml Configuration

```yaml
# buf.yaml — at project root
version: v2
modules:
  - path: proto
    name: buf.build/acme/api
deps:
  - buf.build/googleapis/googleapis
  - buf.build/bufbuild/protovalidate
lint:
  use:
    - STANDARD                    # Google's style guide rules
  except:
    - PACKAGE_VERSION_SUFFIX      # if you don't version all packages
breaking:
  use:
    - FILE                        # strictest breaking change detection
```

### 13.2 buf.gen.yaml

```yaml
# buf.gen.yaml — code generation config
version: v2
plugins:
  # Go
  - remote: buf.build/protocolbuffers/go
    out: gen/go
    opt: paths=source_relative
  - remote: buf.build/grpc/go
    out: gen/go
    opt: paths=source_relative

  # TypeScript (Connect)
  - remote: buf.build/bufbuild/es
    out: gen/ts
  - remote: buf.build/connectrpc/es
    out: gen/ts

  # Python
  - local: protoc-gen-python-grpc
    out: gen/python
```

### 13.3 Essential buf Commands

```bash
# Install buf
# macOS
brew install bufbuild/buf/buf
# Linux
curl -sSL https://github.com/bufbuild/buf/releases/latest/download/buf-Linux-x86_64 -o /usr/local/bin/buf

# Lint .proto files
buf lint                          # check style violations

# Detect breaking changes
buf breaking --against '.git#branch=main'    # compare against main branch
buf breaking --against 'buf.build/acme/api'  # compare against published module

# Generate code
buf generate                      # run all plugins in buf.gen.yaml

# Update dependencies
buf dep update                    # update buf.lock

# Format .proto files
buf format -w                     # auto-format in place

# Push module to BSR (Buf Schema Registry)
buf push                          # publish to registry
```

### 13.4 CI/CD Integration

```yaml
# GitHub Actions
name: Proto CI
on: [push, pull_request]
jobs:
  proto:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: bufbuild/buf-setup-action@v1
      - name: Lint
        run: buf lint
      - name: Breaking change detection
        run: buf breaking --against '.git#branch=main'
      - name: Generate
        run: buf generate
      - name: Verify no uncommitted changes
        run: git diff --exit-code gen/
```

### 13.5 Buf Tooling Rules

- **ALWAYS** use `buf lint` in CI — enforce style consistency
- **ALWAYS** use `buf breaking` in CI — prevent accidental breaking changes
- **USE** `buf generate` instead of raw `protoc` — better dependency resolution
- **ALWAYS** commit `buf.lock` to version control
- **USE** Buf Schema Registry (BSR) for sharing proto modules across teams
- **RUN** `buf format -w` before committing .proto changes

---

## 14. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No package versioning | Breaking changes affect all clients at once | ALWAYS use `company.service.v1` packages |
| Reusing field numbers | Data corruption, wrong deserialization | NEVER reuse — use `reserved` for removed fields |
| Mega-messages (50+ fields) | Hard to evolve, hard to understand | Split into composed smaller messages |
| Missing zero-value enum | Default value has unintended meaning | ALWAYS add `TYPE_UNSPECIFIED = 0` |
| `int64` for timestamps | No timezone info, ambiguous units | Use `google.protobuf.Timestamp` |
| `string` for enums | No type safety, typos cause bugs | Use proper `enum` types |
| `float`/`double` for money | Floating point precision errors | Use `int64` cents or `Money` message |
| No field validation | Invalid data reaches business logic | Add `buf/validate` annotations |
| Editing generated code | Changes overwritten on regeneration | NEVER modify generated files |
| Fields 1-15 wasted on rarely-set fields | Frequently-set fields use 2+ bytes | Reserve 1-15 for high-frequency fields |
| Breaking changes in same version | Client deserialization failures | Create new v2 package for breaking changes |
| No `reserved` on removed fields | Someone reuses the field number later | ALWAYS reserve number AND name |
| Inconsistent naming conventions | Confusion across teams, lint failures | Follow Google's proto style guide strictly |

---

## 15. Enforcement Checklist

- [ ] Every .proto file starts with `syntax = "proto3"`
- [ ] Every file has a package with `company.service.version` format
- [ ] `option go_package` is set for Go generation
- [ ] Every enum has a zero value with `_UNSPECIFIED` suffix
- [ ] Enum values are prefixed with enum type name in `UPPER_SNAKE_CASE`
- [ ] Field numbers 1-15 are reserved for frequently-set fields
- [ ] Removed fields have `reserved` for both number and name
- [ ] No field number reuse anywhere in the schema history
- [ ] Messages use `PascalCase`, fields use `lower_snake_case`
- [ ] `google.protobuf.Timestamp` used for times (not `int64`)
- [ ] `google.protobuf.Duration` used for time spans (not `int64`)
- [ ] `google.protobuf.Empty` used for Delete responses
- [ ] `FieldMask` included in Update requests
- [ ] Pagination fields (`page_size`, `page_token`) in all List requests
- [ ] `buf/validate` annotations on Create and Update request messages
- [ ] `buf lint` passes with STANDARD rules
- [ ] `buf breaking` runs in CI against main branch
- [ ] Generated code is in a separate `gen/` directory
- [ ] No hand-edits in generated code
- [ ] One service per .proto file
