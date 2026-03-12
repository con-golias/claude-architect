# gRPC Security

Category: Application Security / API Security
Severity: Critical
Last Updated: 2025-12
Tags: grpc, protobuf, mtls, interceptors, service-mesh

---

## Overview

gRPC is a high-performance RPC framework built on HTTP/2 and Protocol Buffers. It is widely used for service-to-service communication in microservice architectures. While gRPC provides built-in TLS support and strong typing through protobuf, it requires deliberate security configuration. This guide covers TLS configuration, mutual TLS, interceptor-based authentication, per-method authorization, message validation, deadline enforcement, metadata security, and reflection control.

---

## TLS Configuration

### Server TLS (Go)

Every gRPC server must terminate TLS. Plaintext gRPC connections are unacceptable in any environment beyond local development.

```go
package main

import (
    "crypto/tls"
    "crypto/x509"
    "log"
    "net"
    "os"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials"
)

func newTLSServer() *grpc.Server {
    cert, err := tls.LoadX509KeyPair("/certs/server.crt", "/certs/server.key")
    if err != nil {
        log.Fatalf("failed to load server certificate: %v", err)
    }

    tlsConfig := &tls.Config{
        Certificates: []tls.Certificate{cert},
        MinVersion:   tls.VersionTLS13,
        CipherSuites: []uint16{
            tls.TLS_AES_256_GCM_SHA384,
            tls.TLS_AES_128_GCM_SHA256,
            tls.TLS_CHACHA20_POLY1305_SHA256,
        },
    }

    creds := credentials.NewTLS(tlsConfig)
    server := grpc.NewServer(grpc.Creds(creds))
    return server
}

func main() {
    server := newTLSServer()
    pb.RegisterMyServiceServer(server, &myServiceImpl{})

    lis, err := net.Listen("tcp", ":8443")
    if err != nil {
        log.Fatalf("failed to listen: %v", err)
    }

    log.Println("gRPC server listening on :8443 with TLS")
    if err := server.Serve(lis); err != nil {
        log.Fatalf("failed to serve: %v", err)
    }
}
```

### Client TLS (Go)

```go
func newTLSClient(serverAddr string) (*grpc.ClientConn, error) {
    // Load CA certificate to verify server
    caCert, err := os.ReadFile("/certs/ca.crt")
    if err != nil {
        return nil, fmt.Errorf("failed to read CA cert: %w", err)
    }

    caCertPool := x509.NewCertPool()
    if !caCertPool.AppendCertsFromPEM(caCert) {
        return nil, fmt.Errorf("failed to parse CA cert")
    }

    tlsConfig := &tls.Config{
        RootCAs:    caCertPool,
        MinVersion: tls.VersionTLS13,
        ServerName: "api.example.com", // Must match server certificate
    }

    creds := credentials.NewTLS(tlsConfig)
    conn, err := grpc.Dial(serverAddr,
        grpc.WithTransportCredentials(creds),
        grpc.WithBlock(),
    )
    return conn, err
}
```

### TypeScript (grpc-js) TLS

```typescript
import * as grpc from '@grpc/grpc-js';
import * as fs from 'fs';

// Server with TLS
const serverCert = fs.readFileSync('/certs/server.crt');
const serverKey = fs.readFileSync('/certs/server.key');
const caCert = fs.readFileSync('/certs/ca.crt');

const serverCredentials = grpc.ServerCredentials.createSsl(
  caCert,
  [{
    cert_chain: serverCert,
    private_key: serverKey,
  }],
  false, // Do not require client cert (use true for mTLS)
);

const server = new grpc.Server();
server.addService(MyServiceService, myServiceImpl);
server.bindAsync('0.0.0.0:8443', serverCredentials, (err, port) => {
  if (err) throw err;
  console.log(`gRPC server listening on port ${port} with TLS`);
});

// Client with TLS
const channelCredentials = grpc.credentials.createSsl(
  caCert,       // CA cert to verify server
  null,         // Client key (null if not using mTLS)
  null,         // Client cert (null if not using mTLS)
);

const client = new MyServiceClient('api.example.com:8443', channelCredentials);
```

### Python TLS

```python
import grpc

# Server with TLS
server_cert = open('/certs/server.crt', 'rb').read()
server_key = open('/certs/server.key', 'rb').read()
ca_cert = open('/certs/ca.crt', 'rb').read()

server_credentials = grpc.ssl_server_credentials(
    [(server_key, server_cert)],
    root_certificates=ca_cert,
    require_client_auth=False,  # Set True for mTLS
)

server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
my_service_pb2_grpc.add_MyServiceServicer_to_server(MyServiceServicer(), server)
server.add_secure_port('[::]:8443', server_credentials)
server.start()

# Client with TLS
channel_credentials = grpc.ssl_channel_credentials(
    root_certificates=ca_cert,
    # private_key=client_key,  # For mTLS
    # certificate_chain=client_cert,  # For mTLS
)
channel = grpc.secure_channel('api.example.com:8443', channel_credentials)
stub = my_service_pb2_grpc.MyServiceStub(channel)
```

---

## Mutual TLS (mTLS)

In zero-trust architectures, both the client and server must present certificates. mTLS ensures that only authorized services can communicate.

### Go mTLS Server

```go
func newMTLSServer() *grpc.Server {
    cert, err := tls.LoadX509KeyPair("/certs/server.crt", "/certs/server.key")
    if err != nil {
        log.Fatalf("failed to load server cert: %v", err)
    }

    // Load CA certificate used to sign client certificates
    caCert, err := os.ReadFile("/certs/ca.crt")
    if err != nil {
        log.Fatalf("failed to read CA cert: %v", err)
    }
    caCertPool := x509.NewCertPool()
    caCertPool.AppendCertsFromPEM(caCert)

    tlsConfig := &tls.Config{
        Certificates: []tls.Certificate{cert},
        ClientCAs:    caCertPool,
        ClientAuth:   tls.RequireAndVerifyClientCert, // mTLS: require client cert
        MinVersion:   tls.VersionTLS13,
    }

    creds := credentials.NewTLS(tlsConfig)
    server := grpc.NewServer(
        grpc.Creds(creds),
        grpc.UnaryInterceptor(extractClientCertInterceptor),
    )
    return server
}

// Extract client identity from TLS certificate
func extractClientCertInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    peer, ok := peer.FromContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "no peer info")
    }

    tlsInfo, ok := peer.AuthInfo.(credentials.TLSInfo)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "no TLS info")
    }

    if len(tlsInfo.State.PeerCertificates) == 0 {
        return nil, status.Error(codes.Unauthenticated, "no client certificate")
    }

    clientCert := tlsInfo.State.PeerCertificates[0]
    serviceID := clientCert.Subject.CommonName

    // Verify the client service is in the allowed list
    allowedServices := map[string]bool{
        "payment-service": true,
        "order-service":   true,
        "user-service":    true,
    }

    if !allowedServices[serviceID] {
        return nil, status.Errorf(codes.PermissionDenied, "service %q not authorized", serviceID)
    }

    // Add service identity to context
    ctx = context.WithValue(ctx, "serviceID", serviceID)
    return handler(ctx, req)
}
```

### Go mTLS Client

```go
func newMTLSClient(serverAddr string) (*grpc.ClientConn, error) {
    // Load client certificate
    clientCert, err := tls.LoadX509KeyPair("/certs/client.crt", "/certs/client.key")
    if err != nil {
        return nil, fmt.Errorf("failed to load client cert: %w", err)
    }

    // Load CA certificate to verify server
    caCert, err := os.ReadFile("/certs/ca.crt")
    if err != nil {
        return nil, fmt.Errorf("failed to read CA cert: %w", err)
    }
    caCertPool := x509.NewCertPool()
    caCertPool.AppendCertsFromPEM(caCert)

    tlsConfig := &tls.Config{
        Certificates: []tls.Certificate{clientCert},
        RootCAs:      caCertPool,
        MinVersion:   tls.VersionTLS13,
        ServerName:   "api.example.com",
    }

    creds := credentials.NewTLS(tlsConfig)
    return grpc.Dial(serverAddr, grpc.WithTransportCredentials(creds))
}
```

---

## Interceptor-Based Authentication

### JWT Validation in Unary Interceptors (Go)

```go
import (
    "context"
    "strings"

    "github.com/golang-jwt/jwt/v5"
    "google.golang.org/grpc"
    "google.golang.org/grpc/codes"
    "google.golang.org/grpc/metadata"
    "google.golang.org/grpc/status"
)

// Methods that do not require authentication
var publicMethods = map[string]bool{
    "/myservice.AuthService/Login":    true,
    "/myservice.HealthService/Check":  true,
}

func jwtUnaryInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    // Skip authentication for public methods
    if publicMethods[info.FullMethod] {
        return handler(ctx, req)
    }

    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return nil, status.Error(codes.Unauthenticated, "missing metadata")
    }

    authHeader := md.Get("authorization")
    if len(authHeader) == 0 {
        return nil, status.Error(codes.Unauthenticated, "missing authorization header")
    }

    tokenString := strings.TrimPrefix(authHeader[0], "Bearer ")
    claims, err := validateJWT(tokenString)
    if err != nil {
        return nil, status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
    }

    // Add claims to context
    ctx = context.WithValue(ctx, "userID", claims.Subject)
    ctx = context.WithValue(ctx, "userRole", claims["role"])

    return handler(ctx, req)
}

func validateJWT(tokenString string) (jwt.MapClaims, error) {
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
            return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
        }
        return publicKey, nil
    },
        jwt.WithValidMethods([]string{"RS256"}),
        jwt.WithIssuer("https://auth.example.com"),
        jwt.WithAudience("https://api.example.com"),
    )
    if err != nil {
        return nil, err
    }

    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok || !token.Valid {
        return nil, fmt.Errorf("invalid token claims")
    }
    return claims, nil
}
```

### JWT Validation in Stream Interceptors (Go)

```go
func jwtStreamInterceptor(
    srv interface{},
    ss grpc.ServerStream,
    info *grpc.StreamServerInfo,
    handler grpc.StreamHandler,
) error {
    if publicMethods[info.FullMethod] {
        return handler(srv, ss)
    }

    md, ok := metadata.FromIncomingContext(ss.Context())
    if !ok {
        return status.Error(codes.Unauthenticated, "missing metadata")
    }

    authHeader := md.Get("authorization")
    if len(authHeader) == 0 {
        return status.Error(codes.Unauthenticated, "missing authorization header")
    }

    tokenString := strings.TrimPrefix(authHeader[0], "Bearer ")
    claims, err := validateJWT(tokenString)
    if err != nil {
        return status.Errorf(codes.Unauthenticated, "invalid token: %v", err)
    }

    // Wrap the stream with an authenticated context
    wrappedStream := &authenticatedStream{
        ServerStream: ss,
        ctx: context.WithValue(
            context.WithValue(ss.Context(), "userID", claims.Subject),
            "userRole", claims["role"],
        ),
    }

    return handler(srv, wrappedStream)
}

type authenticatedStream struct {
    grpc.ServerStream
    ctx context.Context
}

func (s *authenticatedStream) Context() context.Context {
    return s.ctx
}
```

### TypeScript (grpc-js) Interceptor

```typescript
import * as grpc from '@grpc/grpc-js';

const PUBLIC_METHODS = new Set([
  '/myservice.AuthService/Login',
  '/myservice.HealthService/Check',
]);

function authInterceptor(
  methodDescriptor: grpc.MethodDefinition<any, any>,
  call: grpc.ServerUnaryCall<any, any> | grpc.ServerReadableStream<any, any>,
): void {
  // Implemented as middleware in the service handler
}

// Server middleware pattern for grpc-js
function withAuth<TReq, TRes>(
  handler: grpc.handleUnaryCall<TReq, TRes>,
): grpc.handleUnaryCall<TReq, TRes> {
  return async (call, callback) => {
    const metadata = call.metadata;
    const authHeader = metadata.get('authorization')[0] as string;

    if (!authHeader) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Missing authorization header',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    try {
      const claims = await validateJWT(token);
      // Attach user info to metadata for downstream access
      call.metadata.set('x-user-id', claims.sub);
      call.metadata.set('x-user-role', claims.role);
      handler(call, callback);
    } catch (err) {
      callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Invalid token',
      });
    }
  };
}

// Usage
server.addService(MyServiceService, {
  getUser: withAuth(getUserHandler),
  listUsers: withAuth(listUsersHandler),
  login: loginHandler, // No auth required
});
```

### Python Interceptor

```python
import grpc
from grpc import ServerInterceptor

PUBLIC_METHODS = {
    "/myservice.AuthService/Login",
    "/myservice.HealthService/Check",
}

class AuthInterceptor(ServerInterceptor):
    def __init__(self, jwt_secret: str):
        self.jwt_secret = jwt_secret

    def intercept_service(self, continuation, handler_call_details):
        method = handler_call_details.method

        if method in PUBLIC_METHODS:
            return continuation(handler_call_details)

        # Get metadata from the call
        metadata = dict(handler_call_details.invocation_metadata or [])
        auth_header = metadata.get("authorization", "")

        if not auth_header.startswith("Bearer "):
            return self._unauthenticated_handler()

        token = auth_header[7:]
        try:
            claims = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=["RS256"],
                audience="https://api.example.com",
                issuer="https://auth.example.com",
            )
        except jwt.InvalidTokenError:
            return self._unauthenticated_handler()

        # Store claims in context (via metadata forwarding)
        handler_call_details.invocation_metadata.append(
            ("x-user-id", claims["sub"]),
        )
        return continuation(handler_call_details)

    def _unauthenticated_handler(self):
        def handler(request, context):
            context.abort(grpc.StatusCode.UNAUTHENTICATED, "Invalid or missing token")
        return grpc.unary_unary_rpc_method_handler(handler)


# Server setup with interceptor
server = grpc.server(
    futures.ThreadPoolExecutor(max_workers=10),
    interceptors=[AuthInterceptor(jwt_public_key)],
)
```

---

## Per-Method Authorization

### Go (method-level RBAC)

```go
// Define method-to-role mappings
var methodPermissions = map[string][]string{
    "/myservice.UserService/GetUser":    {"user", "admin"},
    "/myservice.UserService/ListUsers":  {"admin"},
    "/myservice.UserService/DeleteUser": {"admin"},
    "/myservice.UserService/UpdateUser": {"user", "admin"},
    "/myservice.OrderService/CreateOrder": {"user", "admin"},
    "/myservice.OrderService/CancelOrder": {"user", "admin"},
}

func authorizationInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    // Skip for public methods
    if publicMethods[info.FullMethod] {
        return handler(ctx, req)
    }

    userRole, ok := ctx.Value("userRole").(string)
    if !ok {
        return nil, status.Error(codes.Internal, "missing user role in context")
    }

    allowedRoles, exists := methodPermissions[info.FullMethod]
    if !exists {
        // Deny by default for unmapped methods
        return nil, status.Error(codes.PermissionDenied, "method not configured for access")
    }

    authorized := false
    for _, role := range allowedRoles {
        if role == userRole {
            authorized = true
            break
        }
    }

    if !authorized {
        return nil, status.Errorf(codes.PermissionDenied,
            "role %q is not authorized for %s", userRole, info.FullMethod)
    }

    return handler(ctx, req)
}

// Chain interceptors: authentication first, then authorization
server := grpc.NewServer(
    grpc.ChainUnaryInterceptor(
        jwtUnaryInterceptor,
        authorizationInterceptor,
    ),
    grpc.ChainStreamInterceptor(
        jwtStreamInterceptor,
        authorizationStreamInterceptor,
    ),
)
```

### Java (Spring Boot gRPC)

```java
import io.grpc.*;
import net.devh.boot.grpc.server.interceptor.GrpcGlobalServerInterceptor;

@GrpcGlobalServerInterceptor
public class AuthorizationInterceptor implements ServerInterceptor {

    private static final Map<String, Set<String>> METHOD_PERMISSIONS = Map.of(
        "/myservice.UserService/GetUser", Set.of("user", "admin"),
        "/myservice.UserService/ListUsers", Set.of("admin"),
        "/myservice.UserService/DeleteUser", Set.of("admin")
    );

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next) {

        String method = call.getMethodDescriptor().getFullMethodName();
        Set<String> allowedRoles = METHOD_PERMISSIONS.get(method);

        if (allowedRoles == null) {
            call.close(Status.PERMISSION_DENIED.withDescription("Method not configured"), new Metadata());
            return new ServerCall.Listener<>() {};
        }

        String userRole = headers.get(Metadata.Key.of("x-user-role", Metadata.ASCII_STRING_MARSHALLER));
        if (userRole == null || !allowedRoles.contains(userRole)) {
            call.close(Status.PERMISSION_DENIED.withDescription("Insufficient permissions"), new Metadata());
            return new ServerCall.Listener<>() {};
        }

        return next.startCall(call, headers);
    }
}
```

---

## Protobuf Message Validation

### Using buf validate (protovalidate)

Define validation rules directly in your `.proto` files.

```protobuf
syntax = "proto3";

import "buf/validate/validate.proto";

message CreateUserRequest {
  string email = 1 [(buf.validate.field).string = {
    min_len: 5,
    max_len: 255,
    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
  }];

  string display_name = 2 [(buf.validate.field).string = {
    min_len: 1,
    max_len: 100,
    pattern: "^[a-zA-Z0-9 .\\-]+$"
  }];

  string password = 3 [(buf.validate.field).string = {
    min_len: 12,
    max_len: 128
  }];

  UserRole role = 4 [(buf.validate.field).enum = {
    defined_only: true,
    not_in: [0]  // Prevent UNKNOWN role
  }];

  repeated string tags = 5 [(buf.validate.field).repeated = {
    max_items: 10,
    items: {
      string: { min_len: 1, max_len: 50 }
    }
  }];
}

message GetUserRequest {
  string user_id = 1 [(buf.validate.field).string = {
    min_len: 36,
    max_len: 36,
    pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
  }];
}

enum UserRole {
  USER_ROLE_UNSPECIFIED = 0;
  USER_ROLE_USER = 1;
  USER_ROLE_ADMIN = 2;
}
```

### Go validation interceptor

```go
import (
    "github.com/bufbuild/protovalidate-go"
    "google.golang.org/protobuf/proto"
)

func validationInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    // Validate the request message
    if msg, ok := req.(proto.Message); ok {
        validator, err := protovalidate.New()
        if err != nil {
            return nil, status.Error(codes.Internal, "validator initialization failed")
        }

        if err := validator.Validate(msg); err != nil {
            return nil, status.Errorf(codes.InvalidArgument, "validation failed: %v", err)
        }
    }

    return handler(ctx, req)
}

// Chain: auth -> authz -> validation -> handler
server := grpc.NewServer(
    grpc.ChainUnaryInterceptor(
        jwtUnaryInterceptor,
        authorizationInterceptor,
        validationInterceptor,
    ),
)
```

### Python validation

```python
from google.protobuf import descriptor as _descriptor

def validate_request(request):
    """Manual validation for protobuf messages in Python."""
    errors = []

    descriptor = request.DESCRIPTOR
    for field in descriptor.fields:
        value = getattr(request, field.name)

        # Check required fields (proto3: check for default values)
        if field.name == "email" and not value:
            errors.append("email is required")
        elif field.name == "email" and not re.match(
            r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value
        ):
            errors.append("invalid email format")

        if field.name == "display_name" and len(value) > 100:
            errors.append("display_name must be at most 100 characters")

        if field.name == "password" and len(value) < 12:
            errors.append("password must be at least 12 characters")

    if errors:
        context.abort(
            grpc.StatusCode.INVALID_ARGUMENT,
            f"Validation failed: {'; '.join(errors)}",
        )
```

---

## Deadline and Timeout Enforcement

Deadlines prevent resource exhaustion from slow or hanging requests. Always set deadlines on both client and server.

### Go (deadline enforcement)

```go
// Client: Always set a deadline
func callWithDeadline(client pb.UserServiceClient, userID string) (*pb.User, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    return client.GetUser(ctx, &pb.GetUserRequest{UserId: userID})
}

// Server: Enforce maximum deadline
func maxDeadlineInterceptor(maxDuration time.Duration) grpc.UnaryServerInterceptor {
    return func(
        ctx context.Context,
        req interface{},
        info *grpc.UnaryServerInfo,
        handler grpc.UnaryHandler,
    ) (interface{}, error) {
        deadline, ok := ctx.Deadline()
        if !ok {
            // No deadline set by client -- enforce a server-side maximum
            var cancel context.CancelFunc
            ctx, cancel = context.WithTimeout(ctx, maxDuration)
            defer cancel()
        } else {
            // Client set a deadline -- cap it to server maximum
            maxDeadline := time.Now().Add(maxDuration)
            if deadline.After(maxDeadline) {
                var cancel context.CancelFunc
                ctx, cancel = context.WithDeadline(ctx, maxDeadline)
                defer cancel()
            }
        }

        return handler(ctx, req)
    }
}

// Usage: Maximum 30 seconds per RPC
server := grpc.NewServer(
    grpc.ChainUnaryInterceptor(
        maxDeadlineInterceptor(30 * time.Second),
        jwtUnaryInterceptor,
        authorizationInterceptor,
        validationInterceptor,
    ),
)
```

### TypeScript (deadline)

```typescript
// Client: Set deadline
const deadline = new Date();
deadline.setSeconds(deadline.getSeconds() + 5);

client.getUser({ userId: '123' }, { deadline }, (err, response) => {
  if (err) {
    if (err.code === grpc.status.DEADLINE_EXCEEDED) {
      console.error('Request timed out');
    }
  }
});

// Server: Check deadline in handler
function getUserHandler(
  call: grpc.ServerUnaryCall<GetUserRequest, UserResponse>,
  callback: grpc.sendUnaryData<UserResponse>,
) {
  const deadline = call.getDeadline();
  if (deadline && Date.now() > deadline) {
    return callback({
      code: grpc.status.DEADLINE_EXCEEDED,
      message: 'Deadline exceeded before processing started',
    });
  }
  // Process request...
}
```

### Python (deadline)

```python
# Client: set timeout
try:
    response = stub.GetUser(
        GetUserRequest(user_id="123"),
        timeout=5.0,  # 5 seconds
    )
except grpc.RpcError as e:
    if e.code() == grpc.StatusCode.DEADLINE_EXCEEDED:
        print("Request timed out")

# Server: check remaining time
class UserServicer(my_service_pb2_grpc.UserServiceServicer):
    def GetUser(self, request, context):
        time_remaining = context.time_remaining()
        if time_remaining is not None and time_remaining <= 0:
            context.abort(grpc.StatusCode.DEADLINE_EXCEEDED, "Deadline exceeded")

        # Process with awareness of remaining time
        if time_remaining and time_remaining < 1.0:
            # Not enough time for a full query, return cached data
            return self._get_cached_user(request.user_id)

        return self._get_user_from_db(request.user_id)
```

---

## Metadata Security

gRPC metadata (similar to HTTP headers) can leak internal information. Sanitize outgoing metadata and validate incoming metadata.

```go
// Interceptor to sanitize outgoing metadata
func metadataSanitizationInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    resp, err := handler(ctx, req)

    // Remove internal headers from outgoing metadata
    internalHeaders := []string{
        "x-internal-request-id",
        "x-service-version",
        "x-database-host",
        "x-debug-info",
        "x-server-hostname",
    }

    md, ok := metadata.FromOutgoingContext(ctx)
    if ok {
        for _, header := range internalHeaders {
            md.Delete(header)
        }
    }

    return resp, err
}

// Interceptor to validate incoming metadata
func metadataValidationInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    md, ok := metadata.FromIncomingContext(ctx)
    if !ok {
        return handler(ctx, req)
    }

    // Check for suspicious metadata values
    for key, values := range md {
        for _, value := range values {
            if len(value) > 8192 { // Max metadata value size
                return nil, status.Errorf(codes.InvalidArgument,
                    "metadata value for %q exceeds maximum length", key)
            }
        }
    }

    // Limit total metadata size
    totalSize := 0
    for key, values := range md {
        for _, value := range values {
            totalSize += len(key) + len(value)
        }
    }
    if totalSize > 64*1024 { // 64KB max total metadata
        return nil, status.Error(codes.InvalidArgument, "total metadata size exceeds limit")
    }

    return handler(ctx, req)
}
```

---

## Reflection Control

gRPC server reflection allows clients to discover available services and methods at runtime. Like GraphQL introspection, this must be disabled in production.

### Go

```go
import "google.golang.org/grpc/reflection"

func main() {
    server := grpc.NewServer(/* ... */)
    pb.RegisterMyServiceServer(server, &myServiceImpl{})

    // Only enable reflection in development
    if os.Getenv("ENV") != "production" {
        reflection.Register(server)
    }

    // ...
}
```

### Python

```python
from grpc_reflection.v1alpha import reflection

server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
my_service_pb2_grpc.add_MyServiceServicer_to_server(MyServiceServicer(), server)

# Only enable reflection in development
if os.environ.get("ENV") != "production":
    service_names = (
        my_service_pb2.DESCRIPTOR.services_by_name['MyService'].full_name,
        reflection.SERVICE_NAME,
    )
    reflection.enable_server_reflection(service_names, server)
```

### TypeScript

```typescript
import { addReflection } from 'grpc-js-reflection';

const server = new grpc.Server();
server.addService(MyServiceService, myServiceImpl);

// Only enable reflection in development
if (process.env.NODE_ENV !== 'production') {
  addReflection(server, 'path/to/descriptor_set.bin');
}
```

---

## Load Balancer Security

### Health Check with Authentication

```go
import "google.golang.org/grpc/health"
import healthpb "google.golang.org/grpc/health/grpc_health_v1"

func setupHealthCheck(server *grpc.Server) {
    healthServer := health.NewServer()
    healthpb.RegisterHealthServer(server, healthServer)

    // Set service status
    healthServer.SetServingStatus("myservice.UserService", healthpb.HealthCheckResponse_SERVING)
}

// Restrict health check to internal networks via interceptor
func healthCheckAccessInterceptor(
    ctx context.Context,
    req interface{},
    info *grpc.UnaryServerInfo,
    handler grpc.UnaryHandler,
) (interface{}, error) {
    if info.FullMethod == "/grpc.health.v1.Health/Check" {
        // Only allow from internal IPs
        peer, _ := peer.FromContext(ctx)
        if peer != nil {
            addr := peer.Addr.String()
            if !isInternalIP(addr) {
                return nil, status.Error(codes.PermissionDenied, "health check restricted to internal network")
            }
        }
    }
    return handler(ctx, req)
}
```

### Connection Limits

```go
// Limit maximum concurrent streams and connections
server := grpc.NewServer(
    grpc.MaxConcurrentStreams(100),               // Max streams per connection
    grpc.MaxRecvMsgSize(4 * 1024 * 1024),         // 4MB max receive message
    grpc.MaxSendMsgSize(4 * 1024 * 1024),         // 4MB max send message
    grpc.KeepaliveParams(keepalive.ServerParameters{
        MaxConnectionIdle:     5 * time.Minute,    // Close idle connections
        MaxConnectionAge:      30 * time.Minute,   // Maximum connection lifetime
        MaxConnectionAgeGrace: 10 * time.Second,   // Grace period for closing
        Time:                  1 * time.Minute,    // Ping interval
        Timeout:               20 * time.Second,   // Ping timeout
    }),
    grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
        MinTime:             10 * time.Second,     // Minimum time between pings
        PermitWithoutStream: false,                // Require active streams for pings
    }),
)
```

---

## Best Practices

1. **Enforce TLS 1.3 on all gRPC connections** -- Never allow plaintext gRPC in any environment except local development.

2. **Use mTLS for service-to-service communication** -- Both services must present and verify certificates signed by a trusted CA.

3. **Chain interceptors in the correct order** -- Order matters: deadline enforcement, authentication, authorization, validation, then the handler.

4. **Set deadlines on every RPC call** -- Both clients and servers must enforce deadlines. Cap server-side deadlines to prevent resource exhaustion.

5. **Validate protobuf messages with protovalidate** -- Define validation rules in `.proto` files and enforce them in a dedicated interceptor.

6. **Disable reflection in production** -- Reflection exposes your full service API. Enable it only in development.

7. **Sanitize outgoing metadata** -- Remove internal debugging headers, server hostnames, and database identifiers before sending responses.

8. **Limit message sizes** -- Set `MaxRecvMsgSize` and `MaxSendMsgSize` to prevent memory exhaustion from oversized messages.

9. **Use per-method authorization** -- Define which roles can access which methods. Deny by default for unmapped methods.

10. **Configure keepalive timeouts** -- Set maximum connection idle times and lifetimes to prevent connection exhaustion attacks.

---

## Anti-Patterns

1. **Disabling TLS certificate validation in clients** -- Setting `InsecureSkipVerify: true` or equivalent enables man-in-the-middle attacks.

2. **Using the same interceptor chain for all methods** -- Public methods (health checks, login) and private methods should have different interceptor chains.

3. **Not setting server-side deadlines** -- If the client does not set a deadline, the request can run forever. The server must enforce a maximum.

4. **Logging full protobuf messages** -- Messages may contain sensitive data (passwords, tokens, PII). Log only safe fields.

5. **Trusting metadata values without validation** -- Metadata can contain injection payloads. Validate and sanitize all metadata.

6. **Enabling reflection in production** -- Exposes all services, methods, and message types to any client.

7. **Using plaintext gRPC in production** -- Even in internal networks, plaintext gRPC is vulnerable to eavesdropping and modification.

8. **Not limiting concurrent streams** -- Unbounded streams allow a single client to exhaust server resources.

---

## Enforcement Checklist

- [ ] TLS 1.3 is enforced on all gRPC server listeners
- [ ] mTLS is configured for service-to-service communication
- [ ] JWT validation is implemented in unary and stream interceptors
- [ ] Per-method authorization is enforced with deny-by-default
- [ ] Protobuf message validation is implemented (protovalidate or equivalent)
- [ ] Deadlines are enforced on both client and server sides
- [ ] Server-side deadline cap is configured (e.g., 30 seconds max)
- [ ] Outgoing metadata is sanitized (no internal headers leaked)
- [ ] Incoming metadata is validated (size limits, format checks)
- [ ] Server reflection is disabled in production
- [ ] Health check endpoints are restricted to internal networks
- [ ] MaxRecvMsgSize and MaxSendMsgSize are configured
- [ ] MaxConcurrentStreams is set per connection
- [ ] Keepalive parameters enforce connection lifecycle limits
- [ ] Interceptor chain order is: deadline, auth, authz, validation, handler
