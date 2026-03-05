# API Design Document

## Overview
- **Service Name**: [name]
- **Base URL**: `/api/v1/[resource]`
- **Authentication**: Bearer token / API key / OAuth2
- **Content Type**: `application/json`

## Endpoints

### List Resources
```
GET /api/v1/[resources]
Query: ?page=1&limit=20&sort=created_at&order=desc&filter[status]=active
Response: 200 { data: [], meta: { total, page, limit } }
```

### Get Single Resource
```
GET /api/v1/[resources]/:id
Response: 200 { data: { id, ...fields } }
Error: 404 { error: { code: "NOT_FOUND", message: "..." } }
```

### Create Resource
```
POST /api/v1/[resources]
Body: { ...required_fields }
Response: 201 { data: { id, ...fields } }
Error: 400 { error: { code: "VALIDATION_ERROR", details: [...] } }
```

### Update Resource
```
PATCH /api/v1/[resources]/:id
Body: { ...fields_to_update }
Response: 200 { data: { id, ...fields } }
```

### Delete Resource
```
DELETE /api/v1/[resources]/:id
Response: 204 (no body)
```

## Error Response Format
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": []
  }
}
```

## Rate Limiting
- **Default**: 100 requests/minute per API key
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

## Versioning Strategy
- URL-based: `/api/v1/`, `/api/v2/`
- Breaking changes require new version
- Deprecation notice: 6 months before removal
