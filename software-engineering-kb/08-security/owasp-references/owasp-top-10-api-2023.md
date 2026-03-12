# OWASP API Security Top 10:2023 -- Comprehensive Reference Guide

## Metadata

| Field            | Value                                              |
| ---------------- | -------------------------------------------------- |
| Title            | OWASP API Security Top 10:2023                     |
| Version          | 2023 (Latest)                                      |
| Previous         | 2019                                               |
| Audience         | API Developers, Backend Engineers, Security Teams   |
| Languages        | TypeScript (Express), Go (Gin), Python (FastAPI)   |
| Last Updated     | 2023                                               |

## Overview

The OWASP API Security Top 10 addresses the most critical security risks to APIs. The 2023 edition significantly reorganizes the 2019 list, merging some categories, introducing new ones, and reflecting the shift toward API-first architectures. APIs now handle more business logic and data than ever, making them a primary attack target.

### Key Changes from 2019 to 2023

| 2023                                              | 2019 Equivalent                              | Change                                          |
| ------------------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| API1 Broken Object Level Authorization            | API1:2019 BOLA                               | Same                                            |
| API2 Broken Authentication                        | API2:2019 Broken User Authentication         | Refined                                         |
| API3 Broken Object Property Level Authorization   | API3:2019 + API6:2019 merged                 | Mass assignment + excessive exposure merged      |
| API4 Unrestricted Resource Consumption            | API4:2019 Lack of Resources & Rate Limiting  | Renamed, broader scope                          |
| API5 Broken Function Level Authorization          | API5:2019 same                               | Same                                            |
| API6 Unrestricted Access to Sensitive Flows       | NEW                                          | NEW                                             |
| API7 Server Side Request Forgery                  | NEW                                          | NEW                                             |
| API8 Security Misconfiguration                    | API7:2019 Security Misconfiguration          | Moved                                           |
| API9 Improper Inventory Management                | API9:2019 Improper Assets Management         | Renamed                                         |
| API10 Unsafe Consumption of APIs                  | NEW                                          | NEW                                             |

---

## API1:2023 -- Broken Object Level Authorization (BOLA)

### Description

Broken Object Level Authorization is the most prevalent and damaging API vulnerability. APIs expose endpoints that handle object identifiers, creating a wide attack surface. Object-level authorization checks must be implemented in every function that accesses a data source using an ID from the user. Attackers can manipulate IDs sent in the request to access other users' data.

### Attack Scenario

An attacker intercepts API traffic and notices that their order details are retrieved via `GET /api/orders/12345`. They change the ID to `12346`, `12347`, etc., and retrieve other customers' orders including names, addresses, and payment details. The API only checks that the user is authenticated, not that they own the specific order.

### Vulnerable API Code -- TypeScript (Express)

```typescript
// VULNERABLE: No object-level authorization
router.get('/api/orders/:orderId', authenticate, async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  // Returns any order to any authenticated user
  res.json(order);
});

router.delete('/api/orders/:orderId', authenticate, async (req: Request, res: Response) => {
  await Order.findByIdAndDelete(req.params.orderId); // Any user can delete any order
  res.status(204).send();
});
```

### Secure API Code -- TypeScript (Express)

```typescript
// SECURE: Object-level authorization enforced
router.get('/api/orders/:orderId', authenticate, async (req: Request, res: Response) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  // Verify the authenticated user owns this order
  if (order.userId.toString() !== req.user.id && !req.user.roles.includes('admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(order);
});

// Better pattern: query by user context, not by object ID alone
router.get('/api/orders', authenticate, async (req: Request, res: Response) => {
  const orders = await Order.find({ userId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(orders);
});
```

### Vulnerable API Code -- Go (Gin)

```go
// VULNERABLE: No ownership verification
func GetOrder(c *gin.Context) {
    orderID := c.Param("orderId")
    var order Order
    if err := db.First(&order, orderID).Error; err != nil {
        c.JSON(404, gin.H{"error": "Not found"})
        return
    }
    c.JSON(200, order) // Any authenticated user gets any order
}
```

### Secure API Code -- Go (Gin)

```go
// SECURE: Ownership verification
func GetOrder(c *gin.Context) {
    orderID := c.Param("orderId")
    userID := c.GetString("userID") // From auth middleware

    var order Order
    if err := db.Where("id = ? AND user_id = ?", orderID, userID).First(&order).Error; err != nil {
        c.JSON(404, gin.H{"error": "Not found"})
        return
    }
    c.JSON(200, order)
}
```

### Vulnerable API Code -- Python (FastAPI)

```python
# VULNERABLE: No authorization check on resource
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, current_user: User = Depends(get_current_user)):
    order = await Order.get(order_id)
    if not order:
        raise HTTPException(status_code=404)
    return order  # Returns any order to any user
```

### Secure API Code -- Python (FastAPI)

```python
# SECURE: Object-level authorization
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, current_user: User = Depends(get_current_user)):
    order = await Order.get(order_id)
    if not order:
        raise HTTPException(status_code=404)
    if order.user_id != current_user.id and "admin" not in current_user.roles:
        raise HTTPException(status_code=403, detail="Forbidden")
    return order
```

### Prevention

- [ ] Implement authorization checks using user policies and hierarchy
- [ ] Use random, non-sequential identifiers (UUIDs) for object references
- [ ] Write integration tests to verify authorization on all endpoints
- [ ] Query data scoped by the authenticated user's context
- [ ] Use a centralized authorization service or middleware

---

## API2:2023 -- Broken Authentication

### Description

Authentication mechanisms in APIs are exposed and vulnerable to attack. APIs that handle authentication must be treated with extra care. Attackers can target token generation, password management, and session handling. Weak API keys, missing rate limiting on auth endpoints, and improper token validation are common issues.

### Attack Scenario

An attacker discovers that the password reset API accepts a 4-digit OTP code via `POST /api/reset-password`. The API has no rate limiting on this endpoint. The attacker brute-forces all 10,000 combinations in under a minute, resets the victim's password, and gains account access.

### Vulnerable API Code -- TypeScript (Express)

```typescript
// VULNERABLE: No rate limiting, short OTP, tokens in URL
router.post('/api/reset-password', async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;
  const resetRecord = await PasswordReset.findOne({ email, otp });
  // No rate limiting -- brute force possible
  // No OTP expiration check
  // 4-digit OTP = 10,000 possibilities
  if (!resetRecord) {
    return res.status(400).json({ error: 'Invalid OTP' });
  }
  await User.updateOne({ email }, { password: newPassword }); // Plaintext!
  res.json({ message: 'Password reset successful' });
});

// VULNERABLE: API key in URL
router.get('/api/data?apiKey=abc123', async (req: Request, res: Response) => {
  // API key visible in logs, browser history, referrer headers
});
```

### Secure API Code -- TypeScript (Express)

```typescript
// SECURE: Rate-limited, strong OTP, proper token handling
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.body.email || req.ip,
});

router.post('/api/reset-password', resetLimiter, async (req: Request, res: Response) => {
  const { email, otp, newPassword } = req.body;

  // Validate password strength
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ error: 'Password does not meet requirements' });
  }

  const resetRecord = await PasswordReset.findOne({
    email,
    otp, // 6+ digit OTP
    expiresAt: { $gt: new Date() },
    used: false,
  });

  if (!resetRecord) {
    // Increment failed attempt counter
    await incrementResetAttempts(email);
    const attempts = await getResetAttempts(email);
    if (attempts > 5) {
      await lockResetForEmail(email, '1h');
    }
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }

  // Mark OTP as used
  await PasswordReset.updateOne({ _id: resetRecord._id }, { used: true });

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await User.updateOne({ email }, { password: hashedPassword });

  // Invalidate all existing sessions for this user
  await Session.deleteMany({ email });

  res.json({ message: 'Password reset successful' });
});
```

### Secure API Code -- Go (Gin)

```go
// SECURE: Proper JWT validation
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Token from Authorization header, not URL
        authHeader := c.GetHeader("Authorization")
        if !strings.HasPrefix(authHeader, "Bearer ") {
            c.AbortWithStatusJSON(401, gin.H{"error": "Missing token"})
            return
        }
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")

        token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
            // Verify signing algorithm
            if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
                return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
            }
            return []byte(os.Getenv("JWT_SECRET")), nil
        })
        if err != nil || !token.Valid {
            c.AbortWithStatusJSON(401, gin.H{"error": "Invalid token"})
            return
        }

        claims, ok := token.Claims.(jwt.MapClaims)
        if !ok {
            c.AbortWithStatusJSON(401, gin.H{"error": "Invalid claims"})
            return
        }

        c.Set("userID", claims["sub"])
        c.Set("roles", claims["roles"])
        c.Next()
    }
}
```

### Secure API Code -- Python (FastAPI)

```python
# SECURE: Proper token validation with FastAPI
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["exp", "sub", "iat"]},
        )
        user = await User.get(payload["sub"])
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### Prevention

- [ ] Implement rate limiting and account lockout on authentication endpoints
- [ ] Use strong, long OTP codes (6+ digits) with short expiration times
- [ ] Never send tokens, API keys, or credentials in URLs
- [ ] Validate JWT signing algorithm on the server side
- [ ] Implement token rotation and short-lived access tokens
- [ ] Use strong password hashing (Argon2id, bcrypt)
- [ ] Invalidate sessions/tokens after password change

---

## API3:2023 -- Broken Object Property Level Authorization

### Description

This category merges two 2019 categories: Excessive Data Exposure (API3:2019) and Mass Assignment (API6:2019). APIs often expose all object properties without filtering, returning more data than the client needs. Similarly, APIs that automatically bind client input to object properties without filtering allow attackers to modify fields they should not access.

### Attack Scenario -- Excessive Data Exposure

The `/api/users/me` endpoint returns the full user object including internal fields like `role`, `passwordHash`, `internalNotes`, and `isAdmin`. The frontend only displays the name and email, but the full response is visible in browser developer tools.

### Attack Scenario -- Mass Assignment

An attacker sends `PUT /api/users/me` with `{"name": "Hacker", "role": "admin"}`. The API blindly applies all request body properties to the user object, escalating the attacker's privileges.

### Vulnerable API Code -- TypeScript (Express)

```typescript
// VULNERABLE: Returns all fields, accepts all fields
router.get('/api/users/me', authenticate, async (req: Request, res: Response) => {
  const user = await User.findById(req.user.id);
  res.json(user); // Exposes passwordHash, role, internalNotes, etc.
});

router.put('/api/users/me', authenticate, async (req: Request, res: Response) => {
  // Mass assignment -- attacker can set role, isAdmin, etc.
  const updatedUser = await User.findByIdAndUpdate(req.user.id, req.body, { new: true });
  res.json(updatedUser);
});
```

### Secure API Code -- TypeScript (Express)

```typescript
// SECURE: Explicit field selection for output and input
interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

interface UserUpdateRequest {
  name?: string;
  email?: string;
  avatarUrl?: string;
}

router.get('/api/users/me', authenticate, async (req: Request, res: Response) => {
  const user = await User.findById(req.user.id)
    .select('id name email avatarUrl'); // Only select needed fields
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const response: UserProfileResponse = {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  };
  res.json(response);
});

router.put('/api/users/me', authenticate, async (req: Request, res: Response) => {
  // Allowlist of permitted fields
  const allowedFields: (keyof UserUpdateRequest)[] = ['name', 'email', 'avatarUrl'];
  const updateData: Partial<UserUpdateRequest> = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    { $set: updateData },
    { new: true, select: 'id name email avatarUrl' }
  );
  res.json(updatedUser);
});
```

### Secure API Code -- Go (Gin)

```go
// SECURE: Explicit DTOs for input and output
type UserProfileResponse struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    Email     string `json:"email"`
    AvatarURL string `json:"avatarUrl"`
}

type UserUpdateRequest struct {
    Name      *string `json:"name" binding:"omitempty,min=1,max=100"`
    Email     *string `json:"email" binding:"omitempty,email"`
    AvatarURL *string `json:"avatarUrl" binding:"omitempty,url"`
}

func GetProfile(c *gin.Context) {
    userID := c.GetString("userID")
    var user User
    if err := db.Select("id, name, email, avatar_url").Where("id = ?", userID).First(&user).Error; err != nil {
        c.JSON(404, gin.H{"error": "Not found"})
        return
    }
    c.JSON(200, UserProfileResponse{
        ID:        user.ID,
        Name:      user.Name,
        Email:     user.Email,
        AvatarURL: user.AvatarURL,
    })
}

func UpdateProfile(c *gin.Context) {
    userID := c.GetString("userID")
    var req UserUpdateRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "Invalid input"})
        return
    }
    updates := map[string]interface{}{}
    if req.Name != nil {
        updates["name"] = *req.Name
    }
    if req.Email != nil {
        updates["email"] = *req.Email
    }
    if req.AvatarURL != nil {
        updates["avatar_url"] = *req.AvatarURL
    }
    db.Model(&User{}).Where("id = ?", userID).Updates(updates)
    c.JSON(200, gin.H{"message": "Updated"})
}
```

### Secure API Code -- Python (FastAPI)

```python
# SECURE: Pydantic models enforce input/output schemas
from pydantic import BaseModel, EmailStr
from typing import Optional

class UserProfileResponse(BaseModel):
    id: str
    name: str
    email: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None

@app.get("/api/users/me", response_model=UserProfileResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    return UserProfileResponse.model_validate(current_user)

@app.put("/api/users/me", response_model=UserProfileResponse)
async def update_profile(
    update: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    update_data = update.model_dump(exclude_unset=True)
    # Only allowed fields are in the Pydantic model -- role, is_admin excluded
    for field, value in update_data.items():
        setattr(current_user, field, value)
    await current_user.save()
    return UserProfileResponse.model_validate(current_user)
```

### Prevention

- [ ] Never rely on the client to filter data -- filter on the server
- [ ] Use response DTOs/schemas to control exactly which fields are returned
- [ ] Use request DTOs/schemas with allowlists for writable fields
- [ ] Never automatically bind request bodies to internal data models
- [ ] Review GraphQL schemas for excessive field exposure
- [ ] Implement field-level access control for sensitive properties

---

## API4:2023 -- Unrestricted Resource Consumption

### Description

APIs that do not limit the size or number of resources requested by the client are vulnerable to denial of service and excessive billing. This includes missing rate limiting, no pagination limits, unbounded query complexity, and uncontrolled file upload sizes. The expanded name (from "Lack of Resources & Rate Limiting") reflects the broader scope.

### Attack Scenario

An attacker discovers that `GET /api/search?q=*&limit=1000000` returns all records with no pagination cap. They also find that `POST /api/export` triggers an expensive report generation that takes 30 seconds per request. By sending 100 concurrent export requests, they exhaust server resources and cause a denial of service.

### Vulnerable API Code -- TypeScript (Express)

```typescript
// VULNERABLE: No rate limiting, no pagination limits, no request size limits
const app = express();
app.use(express.json()); // No body size limit

router.get('/api/search', authenticate, async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 1000000; // No max
  const results = await db.collection('items').find({}).limit(limit).toArray();
  res.json(results);
});

router.post('/api/upload', authenticate, async (req: Request, res: Response) => {
  // No file size limit, no file type validation
  const file = req.files?.document;
  await saveFile(file);
  res.json({ message: 'Uploaded' });
});

router.post('/api/export', authenticate, async (req: Request, res: Response) => {
  // No concurrency limit -- expensive operation
  const report = await generateExpensiveReport(req.body);
  res.json(report);
});
```

### Secure API Code -- TypeScript (Express)

```typescript
// SECURE: Rate limiting, pagination, request size limits
import rateLimit from 'express-rate-limit';
import multer from 'multer';

const app = express();
app.use(express.json({ limit: '10kb' })); // Limit body size

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

const MAX_PAGE_SIZE = 100;

router.get('/api/search', authenticate, async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;

  const [results, total] = await Promise.all([
    db.collection('items').find({}).skip(skip).limit(limit).toArray(),
    db.collection('items').countDocuments({}),
  ]);

  res.json({
    data: results,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// File upload with size and type restrictions
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

router.post('/api/upload', authenticate, upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }
  await saveFile(req.file);
  res.json({ message: 'Uploaded', size: req.file.size });
});

// Expensive operations with concurrency control
import pLimit from 'p-limit';
const exportLimit = pLimit(5); // Max 5 concurrent exports

const exportLimiter = rateLimit({ windowMs: 60 * 1000, max: 2 }); // 2 per minute

router.post('/api/export', authenticate, exportLimiter, async (req, res) => {
  try {
    const report = await exportLimit(() =>
      Promise.race([
        generateExpensiveReport(req.body),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000)),
      ])
    );
    res.json(report);
  } catch (error) {
    res.status(503).json({ error: 'Service busy, try again later' });
  }
});
```

### Secure API Code -- Go (Gin)

```go
// SECURE: Rate limiting and pagination in Go
func SearchItems(c *gin.Context) {
    page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
    limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

    if page < 1 { page = 1 }
    if limit < 1 { limit = 1 }
    if limit > 100 { limit = 100 } // Cap at 100

    offset := (page - 1) * limit
    var items []Item
    var total int64

    db.Model(&Item{}).Count(&total)
    db.Offset(offset).Limit(limit).Find(&items)

    c.JSON(200, gin.H{
        "data":       items,
        "page":       page,
        "limit":      limit,
        "total":      total,
        "totalPages": (total + int64(limit) - 1) / int64(limit),
    })
}
```

### Secure API Code -- Python (FastAPI)

```python
# SECURE: Rate limiting and pagination in FastAPI
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

MAX_PAGE_SIZE = 100

@app.get("/api/search")
@limiter.limit("100/15minutes")
async def search_items(
    request: Request,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=MAX_PAGE_SIZE),
    current_user: User = Depends(get_current_user),
):
    skip = (page - 1) * limit
    items = await Item.find().skip(skip).limit(limit).to_list()
    total = await Item.count()
    return {
        "data": items,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": (total + limit - 1) // limit,
        },
    }
```

### Prevention

- [ ] Implement rate limiting on all endpoints based on business needs
- [ ] Enforce maximum pagination size (e.g., 100 items per page)
- [ ] Limit request body size and upload file size
- [ ] Set timeouts for expensive operations
- [ ] Implement concurrency limits for resource-intensive endpoints
- [ ] Use query complexity analysis for GraphQL APIs
- [ ] Monitor and alert on abnormal resource consumption patterns
- [ ] Implement billing alerts for cloud-based APIs

---

## API5:2023 -- Broken Function Level Authorization

### Description

APIs tend to expose more endpoints than traditional web applications, making proper administration and authorization crucial. Attackers can find hidden or administrative endpoints by guessing URL patterns or reading API documentation. Function-level authorization flaws allow regular users to access administrative functions.

### Attack Scenario

An attacker discovers that while `/api/users` is their accessible endpoint, changing the path to `/api/admin/users` or using `DELETE /api/users/123` (an admin-only action) works because the API does not verify that the user has admin privileges for these functions.

### Vulnerable API Code -- TypeScript (Express)

```typescript
// VULNERABLE: Admin endpoints accessible to any authenticated user
router.get('/api/users', authenticate, async (req, res) => {
  const users = await User.find({});
  res.json(users); // Any authenticated user can list all users
});

router.delete('/api/users/:id', authenticate, async (req, res) => {
  await User.findByIdAndDelete(req.params.id); // Any user can delete any user
  res.status(204).send();
});

router.put('/api/users/:id/role', authenticate, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { role: req.body.role });
  res.json({ message: 'Role updated' }); // Privilege escalation
});
```

### Secure API Code -- TypeScript (Express)

```typescript
// SECURE: Role-based function authorization
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.some(role => req.user.roles.includes(role))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Regular users -- can only list users if admin
router.get('/api/users', authenticate, requireRole('admin'), async (req, res) => {
  const users = await User.find({}).select('id name email role');
  res.json(users);
});

// Only admins can delete users
router.delete('/api/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  // Prevent self-deletion
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  await User.findByIdAndDelete(req.params.id);
  auditLog.info('user_deleted', { deletedBy: req.user.id, targetUser: req.params.id });
  res.status(204).send();
});

// Only super-admins can change roles
router.put('/api/users/:id/role', authenticate, requireRole('super-admin'), async (req, res) => {
  const allowedRoles = ['user', 'moderator', 'admin'];
  if (!allowedRoles.includes(req.body.role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  await User.findByIdAndUpdate(req.params.id, { role: req.body.role });
  auditLog.info('role_changed', {
    changedBy: req.user.id, targetUser: req.params.id, newRole: req.body.role,
  });
  res.json({ message: 'Role updated' });
});
```

### Secure API Code -- Go (Gin)

```go
// SECURE: Middleware-based role authorization
func RequireRole(roles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        userRoles, exists := c.Get("roles")
        if !exists {
            c.AbortWithStatusJSON(403, gin.H{"error": "No roles found"})
            return
        }

        roleList, ok := userRoles.([]string)
        if !ok {
            c.AbortWithStatusJSON(403, gin.H{"error": "Invalid role format"})
            return
        }

        for _, required := range roles {
            for _, has := range roleList {
                if required == has {
                    c.Next()
                    return
                }
            }
        }

        c.AbortWithStatusJSON(403, gin.H{"error": "Insufficient permissions"})
    }
}

// Usage
adminGroup := router.Group("/api/admin", AuthMiddleware(), RequireRole("admin"))
{
    adminGroup.GET("/users", ListAllUsers)
    adminGroup.DELETE("/users/:id", DeleteUser)
}
```

### Secure API Code -- Python (FastAPI)

```python
# SECURE: Dependency-based role authorization
from functools import wraps

def require_role(*required_roles: str):
    async def role_checker(current_user: User = Depends(get_current_user)):
        if not any(role in current_user.roles for role in required_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

@app.get("/api/admin/users")
async def list_users(admin: User = Depends(require_role("admin"))):
    users = await User.find().to_list()
    return [UserResponse.model_validate(u) for u in users]

@app.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: User = Depends(require_role("admin")),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await User.find_one_and_delete({"_id": user_id})
    return {"message": "User deleted"}
```

### Prevention

- [ ] Deny all access by default and require explicit grants
- [ ] Implement consistent authorization checks in a centralized middleware
- [ ] Ensure administrative functions enforce role/group checks
- [ ] Hide admin endpoints from API documentation served to regular users
- [ ] Test authorization for every API function with different roles
- [ ] Separate admin and user API paths for clarity

---

## API6:2023 -- Unrestricted Access to Sensitive Business Flows

### Description

This is a NEW category in 2023. It addresses APIs that expose sensitive business flows (purchasing, reservation, commenting) without adequate controls to prevent automated abuse. Attackers use bots to exploit these flows at scale for scalping, spam, credential stuffing, or fraud. The focus is not on implementation bugs but on business logic protection.

### Attack Scenario

A sneaker retailer releases limited-edition shoes. Scalpers use automated bots to purchase hundreds of pairs within seconds of release, before legitimate customers can complete a single purchase. The API has no bot detection, CAPTCHA, or purchase velocity limits.

### Vulnerable API Code -- TypeScript (Express)

```typescript
// VULNERABLE: No bot protection on purchase flow
router.post('/api/purchases', authenticate, async (req: Request, res: Response) => {
  const { productId, quantity } = req.body;
  const product = await Product.findById(productId);
  if (!product || product.stock < quantity) {
    return res.status(400).json({ error: 'Insufficient stock' });
  }
  const purchase = await Purchase.create({
    userId: req.user.id,
    productId,
    quantity,
  });
  await Product.updateOne({ _id: productId }, { $inc: { stock: -quantity } });
  res.json(purchase);
});
```

### Secure API Code -- TypeScript (Express)

```typescript
// SECURE: Multi-layered bot protection on sensitive business flow
import { verifyCaptcha } from './captcha';
import { checkDeviceFingerprint } from './fingerprint';

const purchaseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3, // 3 purchases per minute
  keyGenerator: (req) => req.user.id,
});

router.post('/api/purchases', authenticate, purchaseLimiter, async (req: Request, res: Response) => {
  const { productId, quantity, captchaToken, deviceFingerprint } = req.body;

  // Step 1: CAPTCHA verification for high-demand items
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (product.isHighDemand) {
    const captchaValid = await verifyCaptcha(captchaToken);
    if (!captchaValid) {
      return res.status(400).json({ error: 'CAPTCHA verification failed' });
    }
  }

  // Step 2: Device fingerprint analysis
  const fingerprintScore = await checkDeviceFingerprint(deviceFingerprint, req.user.id);
  if (fingerprintScore < 0.5) {
    securityLogger.warn('suspicious_purchase_attempt', {
      userId: req.user.id,
      score: fingerprintScore,
    });
    return res.status(403).json({ error: 'Suspicious activity detected' });
  }

  // Step 3: Per-user quantity limits
  const recentPurchases = await Purchase.countDocuments({
    userId: req.user.id,
    productId,
    createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });

  const maxPerUser = product.maxPerCustomer || 2;
  if (recentPurchases + quantity > maxPerUser) {
    return res.status(400).json({ error: `Maximum ${maxPerUser} per customer` });
  }

  // Step 4: Atomic stock check and decrement
  const result = await Product.updateOne(
    { _id: productId, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } }
  );

  if (result.modifiedCount === 0) {
    return res.status(400).json({ error: 'Insufficient stock' });
  }

  const purchase = await Purchase.create({
    userId: req.user.id,
    productId,
    quantity,
  });

  res.json(purchase);
});
```

### Prevention

- [ ] Identify business flows that could be abused by bots
- [ ] Implement CAPTCHA or proof-of-work challenges for sensitive flows
- [ ] Use device fingerprinting and behavioral analysis
- [ ] Implement per-user rate limits and quantity limits
- [ ] Monitor for automated patterns (consistent timing, user-agent anomalies)
- [ ] Use queuing systems for high-demand releases
- [ ] Implement purchase velocity checks and cooldown periods

---

## API7:2023 -- Server Side Request Forgery (SSRF)

### Description

SSRF is a NEW category in the 2023 API Top 10. SSRF occurs when an API fetches a remote resource without validating the user-supplied URL. Attackers can coerce the application to send crafted requests to internal services, cloud metadata endpoints, or other unexpected destinations. In cloud environments, SSRF can expose instance metadata and credentials.

### Attack Scenario

An API endpoint accepts a URL for a webhook or image preview. An attacker provides `http://169.254.169.254/latest/meta-data/iam/security-credentials/` as the URL. The server fetches AWS instance metadata, returning temporary credentials that the attacker uses to access cloud resources.

### Vulnerable API Code -- TypeScript (Express)

```typescript
// VULNERABLE: Fetches arbitrary URLs without validation
router.post('/api/webhooks/test', authenticate, async (req: Request, res: Response) => {
  const { url } = req.body;
  const response = await fetch(url); // SSRF -- fetches any URL
  const data = await response.text();
  res.json({ status: response.status, preview: data.substring(0, 500) });
});

// VULNERABLE: Image proxy fetches user-supplied URLs
router.get('/api/image-proxy', async (req: Request, res: Response) => {
  const imageUrl = req.query.url as string;
  const imageResponse = await fetch(imageUrl); // SSRF
  const buffer = await imageResponse.buffer();
  res.contentType('image/jpeg').send(buffer);
});
```

### Secure API Code -- TypeScript (Express)

```typescript
// SECURE: URL validation, allowlisting, and SSRF protection
import { URL } from 'url';
import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';

async function isUrlSafe(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS
    if (url.protocol !== 'https:') {
      return false;
    }

    // Block internal hostnames
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', 'metadata.google.internal'];
    if (blockedHosts.includes(url.hostname)) {
      return false;
    }

    // Resolve DNS and check for internal IPs
    const addresses = await dns.resolve4(url.hostname);
    for (const addr of addresses) {
      const parsed = ipaddr.parse(addr);
      if (parsed.range() !== 'unicast') {
        return false; // Block private, loopback, link-local, etc.
      }
    }

    return true;
  } catch {
    return false;
  }
}

router.post('/api/webhooks/test', authenticate, async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!(await isUrlSafe(url))) {
    return res.status(400).json({ error: 'Invalid or blocked URL' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'error', // Do not follow redirects (could redirect to internal)
      headers: { 'User-Agent': 'WebhookTester/1.0' },
    });
    clearTimeout(timeout);
    res.json({ status: response.status });
  } catch (error) {
    clearTimeout(timeout);
    res.status(502).json({ error: 'Request failed' });
  }
});
```

### Secure API Code -- Go (Gin)

```go
// SECURE: SSRF protection in Go
import (
    "net"
    "net/url"
)

func isInternalIP(ip net.IP) bool {
    privateRanges := []string{
        "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",
        "127.0.0.0/8", "169.254.0.0/16", "::1/128",
    }
    for _, cidr := range privateRanges {
        _, network, _ := net.ParseCIDR(cidr)
        if network.Contains(ip) {
            return true
        }
    }
    return false
}

func validateURL(rawURL string) error {
    parsed, err := url.Parse(rawURL)
    if err != nil {
        return fmt.Errorf("invalid URL")
    }
    if parsed.Scheme != "https" {
        return fmt.Errorf("only HTTPS allowed")
    }
    ips, err := net.LookupIP(parsed.Hostname())
    if err != nil {
        return fmt.Errorf("DNS resolution failed")
    }
    for _, ip := range ips {
        if isInternalIP(ip) {
            return fmt.Errorf("internal IP addresses are blocked")
        }
    }
    return nil
}
```

### Secure API Code -- Python (FastAPI)

```python
# SECURE: SSRF protection in Python
import ipaddress
import socket
from urllib.parse import urlparse

def is_url_safe(url_string: str) -> bool:
    try:
        parsed = urlparse(url_string)
        if parsed.scheme != "https":
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        blocked = {"localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254"}
        if hostname in blocked:
            return False

        # Resolve and check IP
        addrs = socket.getaddrinfo(hostname, None)
        for addr in addrs:
            ip = ipaddress.ip_address(addr[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        return True
    except Exception:
        return False

@app.post("/api/webhooks/test")
async def test_webhook(
    request: WebhookTestRequest,
    current_user: User = Depends(get_current_user),
):
    if not is_url_safe(request.url):
        raise HTTPException(status_code=400, detail="Invalid or blocked URL")

    async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
        response = await client.post(request.url, json={"test": True})

    return {"status": response.status_code}
```

### Prevention

- [ ] Validate and sanitize all user-supplied URLs
- [ ] Enforce an allowlist of permitted URL schemes (HTTPS only)
- [ ] Resolve DNS and verify the resulting IP is not internal/private
- [ ] Do not follow redirects (they can redirect to internal addresses)
- [ ] Use network-level controls (firewall rules) to block outbound requests to internal networks
- [ ] Set timeouts on outbound requests
- [ ] Use the IMDSv2 (token-required) for cloud instance metadata

---

## API8:2023 -- Security Misconfiguration

### Description

APIs and their supporting infrastructure can contain misconfigurations at any level, from transport layer to application settings. Missing security headers, open CORS policies, verbose error messages, unnecessary HTTP methods, and unpatched services all fall under this category.

### Attack Scenario

An API returns detailed error stack traces in production including database connection strings and internal service URLs. CORS is configured with `*` allowing any domain to make authenticated requests. The `OPTIONS` method reveals all supported HTTP methods including `TRACE` and `DEBUG`.

### Vulnerable API Code -- TypeScript (Express)

```typescript
// VULNERABLE: Multiple misconfigurations
const app = express();
app.use(cors()); // Allows all origins
app.use(express.json()); // No size limit

// Verbose error handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack,
    env: process.env, // Leaks all environment variables
  });
});

// Unnecessary methods not disabled
// TRACE, OPTIONS, DEBUG all accessible
```

### Secure API Code -- TypeScript (Express)

```typescript
// SECURE: Hardened configuration
import helmet from 'helmet';

const app = express();
app.use(helmet()); // Security headers

// Restrictive CORS
app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));

app.use(express.json({ limit: '10kb' }));

// Disable unnecessary methods
app.use((req, res, next) => {
  if (['TRACE', 'TRACK'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  next();
});

// Remove server identification
app.disable('x-powered-by');

// Generic error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorId = crypto.randomUUID();
  logger.error({ errorId, error: err.message, path: req.path });
  res.status(500).json({ error: 'Internal server error', errorId });
});
```

### Prevention

- [ ] Implement a hardening process for all API environments
- [ ] Configure restrictive CORS policies
- [ ] Set appropriate security headers (CSP, HSTS, X-Content-Type-Options)
- [ ] Disable unnecessary HTTP methods
- [ ] Limit request body size
- [ ] Remove server version headers and banners
- [ ] Review cloud storage and service ACLs
- [ ] Use automated configuration scanning tools
- [ ] Ensure error responses do not reveal internal details

---

## API9:2023 -- Improper Inventory Management

### Description

APIs tend to expose more endpoints than traditional web applications. Organizations often lose track of old API versions, deprecated endpoints, and debug interfaces left in production. Shadow APIs, undocumented endpoints, and forgotten development/staging instances represent significant risk.

### Attack Scenario

An attacker discovers that while `api.example.com/v2/users` requires authentication and rate limiting, the old version at `api.example.com/v1/users` still exists without those controls. The attacker uses the v1 endpoint to dump the entire user database. Additionally, a staging API at `staging-api.example.com` is publicly accessible with test credentials.

### Vulnerable Pattern

```text
Production:
  api.example.com/v2/users       -- Secured, rate-limited
  api.example.com/v1/users       -- Forgotten, no auth required
  api.example.com/debug/routes   -- Debug endpoint exposed

Staging:
  staging-api.example.com        -- Public, uses production database
  dev-api.example.com            -- Public, default admin/admin credentials

Documentation:
  api.example.com/swagger        -- Unrestricted access to full API docs
  api.example.com/graphql        -- Introspection enabled
```

### Secure Pattern

```text
Production:
  api.example.com/v2/users       -- Secured, rate-limited, monitored
  api.example.com/v1/            -- Returns 410 Gone, redirect to v2
  No debug endpoints in production

Staging:
  staging-api.internal.com       -- VPN-only access, separate database
  dev-api.internal.com           -- VPN-only, no production data

Documentation:
  api.example.com/docs           -- Requires authentication
  GraphQL introspection disabled in production
```

```typescript
// SECURE: API versioning with deprecation
router.use('/v1/*', (req: Request, res: Response) => {
  res.status(410).json({
    error: 'API v1 has been deprecated',
    migration: 'https://docs.example.com/migration-guide',
    currentVersion: '/v2',
  });
});

// Disable GraphQL introspection in production
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: process.env.NODE_ENV !== 'production',
});
```

### Prevention

- [ ] Maintain a complete inventory of all API hosts and versions
- [ ] Decommission old API versions with proper deprecation notices
- [ ] Restrict access to API documentation in production
- [ ] Disable GraphQL introspection in production
- [ ] Use API gateways to centralize access control and monitoring
- [ ] Ensure staging/dev environments are not publicly accessible
- [ ] Scan for shadow APIs and undocumented endpoints regularly
- [ ] Implement strict data isolation between environments

---

## API10:2023 -- Unsafe Consumption of APIs

### Description

This is a NEW category in 2023. Developers tend to trust data received from third-party APIs more than user input, applying weaker validation and security standards. Attackers may compromise a third-party service to indirectly attack APIs that consume data from it. This includes supply chain attacks through API integrations, SSRF via redirects, and injection through trusted data sources.

### Attack Scenario

An application integrates with a third-party address validation API. The API is compromised and begins returning responses containing SQL injection payloads in the "formatted_address" field. Because the application trusts the third-party response, it inserts the data directly into its database without sanitization, leading to SQL injection.

### Vulnerable API Code -- TypeScript (Express)

```typescript
// VULNERABLE: Trusting third-party API response without validation
router.post('/api/validate-address', authenticate, async (req: Request, res: Response) => {
  const thirdPartyResponse = await fetch('https://api.addressvalidator.com/validate', {
    method: 'POST',
    body: JSON.stringify({ address: req.body.address }),
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await thirdPartyResponse.json();

  // VULNERABLE: Directly using unvalidated third-party data in SQL
  await db.query(
    `INSERT INTO addresses (user_id, formatted) VALUES ($1, '${data.formatted_address}')`,
    [req.user.id]
  );

  // VULNERABLE: Rendering third-party data without encoding
  res.json({ address: data.formatted_address }); // Potential stored XSS
});
```

### Secure API Code -- TypeScript (Express)

```typescript
// SECURE: Validate and sanitize all third-party API responses
import { z } from 'zod';

const AddressResponseSchema = z.object({
  formatted_address: z.string().max(500).regex(/^[a-zA-Z0-9\s,.\-#]+$/),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  confidence: z.number().min(0).max(1),
});

router.post('/api/validate-address', authenticate, async (req: Request, res: Response) => {
  let thirdPartyResponse;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    thirdPartyResponse = await fetch('https://api.addressvalidator.com/validate', {
      method: 'POST',
      body: JSON.stringify({ address: req.body.address }),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADDRESS_API_KEY}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (error) {
    return res.status(502).json({ error: 'Address validation service unavailable' });
  }

  if (!thirdPartyResponse.ok) {
    return res.status(502).json({ error: 'Address validation failed' });
  }

  const rawData = await thirdPartyResponse.json();

  // Validate the response schema
  const parsed = AddressResponseSchema.safeParse(rawData);
  if (!parsed.success) {
    logger.warn('invalid_third_party_response', { errors: parsed.error.issues });
    return res.status(502).json({ error: 'Invalid response from address service' });
  }

  // Use parameterized query even for trusted data
  await db.query(
    'INSERT INTO addresses (user_id, formatted) VALUES ($1, $2)',
    [req.user.id, parsed.data.formatted_address]
  );

  res.json({ address: parsed.data.formatted_address });
});
```

### Secure API Code -- Python (FastAPI)

```python
# SECURE: Validate third-party API responses
from pydantic import BaseModel, constr, confloat

class AddressResponse(BaseModel):
    formatted_address: constr(max_length=500, pattern=r'^[a-zA-Z0-9\s,.\-#]+$')
    latitude: confloat(ge=-90, le=90)
    longitude: confloat(ge=-180, le=180)

@app.post("/api/validate-address")
async def validate_address(
    request: AddressRequest,
    current_user: User = Depends(get_current_user),
):
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            response = await client.post(
                "https://api.addressvalidator.com/validate",
                json={"address": request.address},
                headers={"Authorization": f"Bearer {settings.ADDRESS_API_KEY}"},
            )
            response.raise_for_status()
        except httpx.HTTPError:
            raise HTTPException(status_code=502, detail="Service unavailable")

    # Validate response with Pydantic
    try:
        validated = AddressResponse(**response.json())
    except ValidationError:
        logger.warning("Invalid third-party response", extra={"raw": response.text[:200]})
        raise HTTPException(status_code=502, detail="Invalid service response")

    # Parameterized query
    await db.execute(
        "INSERT INTO addresses (user_id, formatted) VALUES ($1, $2)",
        current_user.id, validated.formatted_address,
    )

    return {"address": validated.formatted_address}
```

### Prevention

- [ ] Validate and sanitize all data from third-party APIs
- [ ] Define strict schemas for expected third-party responses
- [ ] Use parameterized queries even for data from trusted sources
- [ ] Implement timeouts and circuit breakers for external API calls
- [ ] Use TLS for all communication with third-party services
- [ ] Verify TLS certificates of third-party APIs (do not skip verification)
- [ ] Do not blindly follow redirects from third-party responses
- [ ] Maintain an inventory of all third-party API integrations
- [ ] Monitor third-party API responses for anomalies

---

## Summary Table

| Rank  | Category                                       | Severity | New in 2023 | Primary Risk                        |
| ----- | ---------------------------------------------- | -------- | ----------- | ----------------------------------- |
| API1  | Broken Object Level Authorization              | Critical | No          | Unauthorized data access            |
| API2  | Broken Authentication                          | Critical | No          | Account takeover                    |
| API3  | Broken Object Property Level Authorization     | High     | Merged      | Data exposure, privilege escalation |
| API4  | Unrestricted Resource Consumption              | High     | Renamed     | DoS, excessive billing              |
| API5  | Broken Function Level Authorization            | High     | No          | Privilege escalation                |
| API6  | Unrestricted Access to Sensitive Business Flows| High     | Yes         | Business logic abuse                |
| API7  | Server Side Request Forgery                    | High     | Yes         | Internal service access             |
| API8  | Security Misconfiguration                      | Medium   | No          | Information disclosure              |
| API9  | Improper Inventory Management                  | Medium   | Renamed     | Shadow API exploitation             |
| API10 | Unsafe Consumption of APIs                     | Medium   | Yes         | Supply chain compromise             |

---

## Best Practices for API Security

### Design Phase

1. Use OpenAPI/Swagger specifications to define API contracts.
2. Design authorization models before implementation.
3. Plan for rate limiting and resource quotas from the start.
4. Define response schemas that never include internal fields.
5. Use API versioning from the first release.

### Implementation Phase

1. Implement object-level and function-level authorization on every endpoint.
2. Use request/response DTOs to control data flow.
3. Validate all input including headers, query parameters, and request bodies.
4. Treat third-party API responses as untrusted input.
5. Use parameterized queries for all database operations.

### Deployment Phase

1. Deploy behind an API gateway with centralized security controls.
2. Enforce TLS 1.2+ on all API endpoints.
3. Configure restrictive CORS policies.
4. Disable debug endpoints and verbose errors in production.
5. Implement health checks that do not expose internal state.

### Operations Phase

1. Monitor API usage patterns for anomalies.
2. Maintain a complete inventory of all API endpoints and versions.
3. Set up alerting for authentication failures and authorization violations.
4. Conduct regular API security assessments and penetration testing.
5. Decommission deprecated API versions with proper migration paths.

---

## Enforcement Checklist

### Per-Endpoint Verification

- [ ] Object-level authorization check present (API1)
- [ ] Authentication mechanism validates tokens correctly (API2)
- [ ] Response uses DTO with explicit field selection (API3)
- [ ] Rate limiting configured per user and per IP (API4)
- [ ] Function-level authorization enforced via middleware (API5)
- [ ] Bot protection on sensitive business flows (API6)
- [ ] Outbound URL validation for SSRF prevention (API7)
- [ ] Security headers and restrictive CORS set (API8)
- [ ] Endpoint documented and inventoried (API9)
- [ ] Third-party responses validated with schemas (API10)

### Infrastructure Verification

- [ ] API gateway deployed with centralized policies
- [ ] TLS 1.2+ enforced on all endpoints
- [ ] API documentation requires authentication in production
- [ ] GraphQL introspection disabled in production
- [ ] Old API versions properly deprecated or removed
- [ ] Staging/dev environments isolated from production
- [ ] Automated API security testing in CI/CD pipeline
- [ ] SBOM generated for API dependencies
