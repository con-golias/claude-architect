# HATEOAS

> **Domain:** Backend > API > REST
> **Difficulty:** Advanced
> **Last Updated:** 2026-03-09

## Table of Contents

- [What It Is](#what-it-is)
- [Why It Matters](#why-it-matters)
- [Core Concepts](#core-concepts)
- [Hypermedia Formats](#hypermedia-formats)
  - [HAL (Hypertext Application Language)](#1-hal-hypertext-application-language)
  - [JSON:API](#2-jsonapi)
  - [Siren](#3-siren)
  - [JSON-LD + Hydra](#4-json-ld--hydra)
  - [Collection+JSON](#5-collectionjson)
- [Format Comparison Matrix](#format-comparison-matrix)
- [Link Relations](#link-relations)
- [Pagination with HATEOAS](#pagination-with-hateoas)
- [State Transitions via Links](#state-transitions-via-links)
- [Discoverability and API Entry Points](#discoverability-and-api-entry-points)
- [Server-Side Implementation](#server-side-implementation)
- [Client-Side Consumption](#client-side-consumption)
- [When to Use HATEOAS](#when-to-use-hateoas)
- [When NOT to Use HATEOAS](#when-not-to-use-hateoas)
- [Decision Tree](#decision-tree)
- [Implementation Complexity vs Benefit Analysis](#implementation-complexity-vs-benefit-analysis)
- [Best Practices](#best-practices)
- [Anti-patterns / Common Mistakes](#anti-patterns--common-mistakes)
- [Real-World Examples](#real-world-examples)
- [Sources](#sources)

---

## What It Is

**HATEOAS** stands for **Hypermedia as the Engine of Application State**. It is a constraint of the REST application architecture defined by Roy Fielding in his 2000 doctoral dissertation.

**Core idea:** A REST client should need no prior knowledge of how to interact with an API beyond a generic understanding of hypermedia. The API itself tells the client what actions are available at any given point by including **hypermedia links** in responses. The client navigates the API by following these links, just as a human navigates the web by clicking hyperlinks.

**In plain terms:** Instead of hardcoding URLs in your client, the server response includes links that tell the client:
- Where to go next
- What actions are available
- What the current state of the resource allows

**Example contrast:**

```json
// WITHOUT HATEOAS -- client must know URL patterns
{
  "id": 1,
  "name": "Alice",
  "status": "active"
}
// Client must hardcode: DELETE /users/1, PATCH /users/1, GET /users/1/orders

// WITH HATEOAS -- client discovers available actions
{
  "id": 1,
  "name": "Alice",
  "status": "active",
  "_links": {
    "self": { "href": "/users/1" },
    "edit": { "href": "/users/1", "method": "PATCH" },
    "deactivate": { "href": "/users/1/deactivate", "method": "POST" },
    "orders": { "href": "/users/1/orders" },
    "collection": { "href": "/users" }
  }
}
```

**Richardson Maturity Model context:**
- Level 0: The Swamp of POX (single URI, single method)
- Level 1: Resources (multiple URIs)
- Level 2: HTTP Verbs (proper use of GET, POST, PUT, DELETE, status codes)
- **Level 3: Hypermedia Controls (HATEOAS)** -- the highest level of REST maturity

---

## Why It Matters

- **Decoupling:** Clients are decoupled from URL structure. If URLs change, clients follow links instead of breaking.
- **Discoverability:** New API capabilities can be discovered without reading updated documentation.
- **State-Driven UI:** The server controls what actions are available based on resource state (e.g., an order that is already shipped cannot be cancelled -- the "cancel" link simply is not present).
- **Evolvability:** The server can add new links (new capabilities) without breaking existing clients.
- **Self-Documentation:** API responses describe themselves and their available transitions.
- **Reduced Client Complexity:** Clients do not need to encode business rules about which actions are valid -- they simply check if a link is present.
- **API Versioning Alternative:** HATEOAS can reduce the need for API versioning since clients follow links rather than hardcode URLs.

---

## Core Concepts

### Hypermedia

Hypermedia extends the concept of hypertext (links in text) to include other media types. In REST APIs, hypermedia means embedding actionable links and controls within API responses.

### Link Relations (rel)

Every link has a **relation type** (`rel`) that describes the semantic relationship between the current resource and the linked resource. These are standardized by IANA.

### Hypermedia Controls

Three types of controls can appear in a hypermedia response:

1. **Links:** Navigate to related resources (GET operations)
2. **Actions/Forms:** Describe how to modify state (POST, PUT, PATCH, DELETE with expected payloads)
3. **Embedded Resources:** Include related resources inline to reduce the number of requests

---

## Hypermedia Formats

### 1. HAL (Hypertext Application Language)

HAL is the simplest and most widely adopted hypermedia format. Specified in an IETF Internet Draft.

**Media type:** `application/hal+json`

**Structure:**
- `_links` -- contains link objects keyed by relation type
- `_embedded` -- contains embedded resources (related resources included inline)
- All other properties are the resource's own data

#### Single Resource

```json
{
  "id": 42,
  "first_name": "Alice",
  "last_name": "Smith",
  "email": "alice@example.com",
  "status": "active",
  "_links": {
    "self": {
      "href": "/users/42"
    },
    "edit": {
      "href": "/users/42"
    },
    "orders": {
      "href": "/users/42/orders"
    },
    "deactivate": {
      "href": "/users/42/deactivate"
    },
    "collection": {
      "href": "/users"
    }
  }
}
```

#### Collection with Pagination

```json
{
  "_links": {
    "self": {
      "href": "/users?page=2&per_page=20"
    },
    "first": {
      "href": "/users?page=1&per_page=20"
    },
    "prev": {
      "href": "/users?page=1&per_page=20"
    },
    "next": {
      "href": "/users?page=3&per_page=20"
    },
    "last": {
      "href": "/users?page=5&per_page=20"
    }
  },
  "_embedded": {
    "users": [
      {
        "id": 21,
        "first_name": "Bob",
        "email": "bob@example.com",
        "_links": {
          "self": { "href": "/users/21" },
          "orders": { "href": "/users/21/orders" }
        }
      },
      {
        "id": 22,
        "first_name": "Carol",
        "email": "carol@example.com",
        "_links": {
          "self": { "href": "/users/22" },
          "orders": { "href": "/users/22/orders" }
        }
      }
    ]
  },
  "page": 2,
  "per_page": 20,
  "total": 95,
  "total_pages": 5
}
```

#### Embedded Resources (Reducing N+1 Requests)

```json
{
  "id": 1001,
  "order_number": "ORD-2025-1001",
  "status": "shipped",
  "total": 149.99,
  "_links": {
    "self": { "href": "/orders/1001" },
    "customer": { "href": "/users/42" },
    "invoice": { "href": "/orders/1001/invoice" },
    "tracking": { "href": "/shipments/SHP-5678" }
  },
  "_embedded": {
    "customer": {
      "id": 42,
      "first_name": "Alice",
      "last_name": "Smith",
      "_links": {
        "self": { "href": "/users/42" }
      }
    },
    "items": [
      {
        "id": 5001,
        "product_name": "Wireless Mouse",
        "quantity": 2,
        "unit_price": 29.99,
        "_links": {
          "self": { "href": "/order-items/5001" },
          "product": { "href": "/products/101" }
        }
      },
      {
        "id": 5002,
        "product_name": "USB-C Hub",
        "quantity": 1,
        "unit_price": 89.99,
        "_links": {
          "self": { "href": "/order-items/5002" },
          "product": { "href": "/products/205" }
        }
      }
    ]
  }
}
```

#### HAL Link Object Properties

```json
{
  "_links": {
    "next": {
      "href": "/users?page=3",          // Required: URL
      "templated": false,                // Is href a URI template?
      "type": "application/hal+json",    // Expected media type
      "deprecation": "https://api.example.com/deprecation/next-link",
      "name": "next_page",              // Secondary key for link arrays
      "profile": "https://api.example.com/profiles/pagination",
      "title": "Next page of results",  // Human-readable title
      "hreflang": "en"                  // Language of the target resource
    },
    "search": {
      "href": "/users{?q,status,sort}",
      "templated": true                 // URI Template (RFC 6570)
    }
  }
}
```

**HAL Pros:**
- Simple, minimal overhead
- Most widely adopted (Amazon API Gateway, Spring HATEOAS)
- Easy to implement and understand
- Low learning curve

**HAL Cons:**
- No standard way to describe actions (methods, expected payloads)
- Links only support navigation (GET); mutations need out-of-band knowledge
- No built-in support for forms or input descriptions
- Specification is only an Internet Draft, not a full standard

---

### 2. JSON:API

JSON:API is a comprehensive specification for building APIs in JSON. It covers not only hypermedia but also data formatting, pagination, filtering, sorting, sparse fieldsets, and compound documents.

**Media type:** `application/vnd.api+json`

**Specification:** https://jsonapi.org/

#### Single Resource

```json
{
  "data": {
    "type": "users",
    "id": "42",
    "attributes": {
      "first_name": "Alice",
      "last_name": "Smith",
      "email": "alice@example.com",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z"
    },
    "relationships": {
      "orders": {
        "links": {
          "self": "/users/42/relationships/orders",
          "related": "/users/42/orders"
        },
        "data": [
          { "type": "orders", "id": "1001" },
          { "type": "orders", "id": "1002" }
        ]
      },
      "organization": {
        "links": {
          "self": "/users/42/relationships/organization",
          "related": "/users/42/organization"
        },
        "data": { "type": "organizations", "id": "7" }
      }
    },
    "links": {
      "self": "/users/42"
    }
  },
  "included": [
    {
      "type": "orders",
      "id": "1001",
      "attributes": {
        "order_number": "ORD-2025-1001",
        "total": 149.99,
        "status": "shipped"
      },
      "links": {
        "self": "/orders/1001"
      }
    },
    {
      "type": "organizations",
      "id": "7",
      "attributes": {
        "name": "Acme Corp"
      },
      "links": {
        "self": "/organizations/7"
      }
    }
  ],
  "links": {
    "self": "/users/42"
  },
  "meta": {
    "api_version": "2.1.0",
    "request_id": "req_abc123"
  }
}
```

#### Collection with Pagination, Filtering, and Sorting

```json
{
  "data": [
    {
      "type": "users",
      "id": "21",
      "attributes": {
        "first_name": "Bob",
        "email": "bob@example.com"
      },
      "links": {
        "self": "/users/21"
      }
    },
    {
      "type": "users",
      "id": "22",
      "attributes": {
        "first_name": "Carol",
        "email": "carol@example.com"
      },
      "links": {
        "self": "/users/22"
      }
    }
  ],
  "links": {
    "self": "/users?page[number]=2&page[size]=20&sort=first_name&filter[status]=active",
    "first": "/users?page[number]=1&page[size]=20&sort=first_name&filter[status]=active",
    "prev": "/users?page[number]=1&page[size]=20&sort=first_name&filter[status]=active",
    "next": "/users?page[number]=3&page[size]=20&sort=first_name&filter[status]=active",
    "last": "/users?page[number]=5&page[size]=20&sort=first_name&filter[status]=active"
  },
  "meta": {
    "total": 95,
    "page": {
      "number": 2,
      "size": 20
    }
  }
}
```

#### JSON:API Error Format

```json
{
  "errors": [
    {
      "id": "err_abc123",
      "status": "422",
      "code": "VALIDATION_ERROR",
      "title": "Invalid Attribute",
      "detail": "Email address is not valid.",
      "source": {
        "pointer": "/data/attributes/email",
        "parameter": null
      },
      "links": {
        "about": "/docs/errors/VALIDATION_ERROR",
        "type": "/docs/error-types/validation"
      },
      "meta": {
        "constraint": "email_format",
        "received_value": "not-an-email"
      }
    }
  ]
}
```

#### JSON:API Features Summary

| Feature | Description |
|---|---|
| **Sparse fieldsets** | `?fields[users]=first_name,email` -- return only requested fields |
| **Compound documents** | `?include=orders,organization` -- sideload related resources |
| **Sorting** | `?sort=-created_at,first_name` -- sort by fields (- for descending) |
| **Filtering** | `?filter[status]=active` -- filter resources |
| **Pagination** | `?page[number]=2&page[size]=20` -- paginate results |
| **Relationships** | Explicit relationship objects with links and resource identifiers |

**JSON:API Pros:**
- Most comprehensive specification -- covers almost all API concerns
- Standardized filtering, sorting, pagination, sparse fieldsets, includes
- Strong client library ecosystem (Ember Data, JSONAPI::Resources)
- Eliminates bikeshedding on API format decisions
- Compound documents reduce N+1 request problems

**JSON:API Cons:**
- Verbose: simple resources require significantly more JSON
- Opinionated: may conflict with existing API conventions
- Learning curve: the specification is large and complex
- `type` and `id` as strings only can be awkward (no integer IDs)
- Overkill for simple APIs or internal services
- Not suitable for all resource types (e.g., aggregate responses, analytics)

---

### 3. Siren

Siren is a hypermedia format that emphasizes **actions** (what you can do) as first-class citizens alongside links and embedded entities.

**Media type:** `application/vnd.siren+json`

#### Single Resource with Actions

```json
{
  "class": ["user"],
  "properties": {
    "id": 42,
    "first_name": "Alice",
    "last_name": "Smith",
    "email": "alice@example.com",
    "status": "active"
  },
  "entities": [
    {
      "class": ["order", "collection"],
      "rel": ["orders"],
      "href": "/users/42/orders",
      "title": "Alice's Orders"
    },
    {
      "class": ["organization"],
      "rel": ["organization"],
      "properties": {
        "id": 7,
        "name": "Acme Corp"
      },
      "links": [
        { "rel": ["self"], "href": "/organizations/7" }
      ]
    }
  ],
  "actions": [
    {
      "name": "update-user",
      "title": "Update User",
      "method": "PATCH",
      "href": "/users/42",
      "type": "application/json",
      "fields": [
        { "name": "first_name", "type": "text", "value": "Alice" },
        { "name": "last_name", "type": "text", "value": "Smith" },
        { "name": "email", "type": "email", "value": "alice@example.com" }
      ]
    },
    {
      "name": "deactivate-user",
      "title": "Deactivate User",
      "method": "POST",
      "href": "/users/42/deactivate",
      "type": "application/json",
      "fields": [
        { "name": "reason", "type": "text" }
      ]
    },
    {
      "name": "delete-user",
      "title": "Delete User",
      "method": "DELETE",
      "href": "/users/42"
    }
  ],
  "links": [
    { "rel": ["self"], "href": "/users/42" },
    { "rel": ["collection"], "href": "/users" }
  ]
}
```

**Key Siren concepts:**
- `class` -- semantic classification of the entity (like a CSS class)
- `properties` -- the actual resource data
- `entities` -- related sub-entities (can be embedded or linked)
- `actions` -- available state transitions with **full form descriptions** (method, fields, types)
- `links` -- navigation links

**Siren Pros:**
- Actions with field descriptions enable **fully generic clients** (no hardcoded forms)
- The most expressive format for describing available mutations
- Actions naturally model workflows and state machines
- Conditionally including/excluding actions based on state is powerful

**Siren Cons:**
- Verbose, especially for simple resources
- Low adoption compared to HAL and JSON:API
- Limited tooling and client library support
- Steeper learning curve
- Can be overkill for read-heavy APIs

---

### 4. JSON-LD + Hydra

JSON-LD (JSON for Linked Data) combined with the Hydra vocabulary provides a semantically rich hypermedia format designed for the Semantic Web.

**Media type:** `application/ld+json`

#### Example with Hydra

```json
{
  "@context": {
    "@vocab": "https://schema.org/",
    "hydra": "http://www.w3.org/ns/hydra/core#"
  },
  "@type": "Person",
  "@id": "/users/42",
  "givenName": "Alice",
  "familyName": "Smith",
  "email": "alice@example.com",
  "hydra:operation": [
    {
      "@type": "hydra:Operation",
      "hydra:method": "PATCH",
      "hydra:title": "Update user",
      "hydra:expects": {
        "@type": "hydra:Class",
        "hydra:supportedProperty": [
          {
            "hydra:property": { "@id": "givenName" },
            "hydra:required": false
          },
          {
            "hydra:property": { "@id": "familyName" },
            "hydra:required": false
          }
        ]
      }
    }
  ],
  "hydra:collection": {
    "@id": "/users",
    "@type": "hydra:Collection"
  }
}
```

#### Hydra Collection with Pagination

```json
{
  "@context": "http://www.w3.org/ns/hydra/context.jsonld",
  "@type": "hydra:Collection",
  "@id": "/users",
  "hydra:totalItems": 95,
  "hydra:member": [
    {
      "@type": "Person",
      "@id": "/users/21",
      "givenName": "Bob"
    },
    {
      "@type": "Person",
      "@id": "/users/22",
      "givenName": "Carol"
    }
  ],
  "hydra:view": {
    "@type": "hydra:PartialCollectionView",
    "@id": "/users?page=2",
    "hydra:first": "/users?page=1",
    "hydra:previous": "/users?page=1",
    "hydra:next": "/users?page=3",
    "hydra:last": "/users?page=5"
  }
}
```

**JSON-LD + Hydra Pros:**
- Semantically richest format: leverages the entire Semantic Web ecosystem
- Machine-readable API descriptions with formal vocabulary
- Interoperable with RDF, SPARQL, and other Linked Data technologies
- Schema.org integration for standardized property names

**JSON-LD + Hydra Cons:**
- Very complex: requires understanding of Linked Data concepts
- Heavy payload sizes due to context objects
- Very low adoption in mainstream web APIs
- Overkill for nearly all business applications
- Tooling is academic-oriented, not production-ready for most teams
- Performance overhead from context resolution

---

### 5. Collection+JSON

A read/write hypermedia format specifically designed for managing collections.

**Media type:** `application/vnd.collection+json`

```json
{
  "collection": {
    "version": "1.0",
    "href": "/users",
    "links": [
      { "rel": "feed", "href": "/users/feed" }
    ],
    "items": [
      {
        "href": "/users/42",
        "data": [
          { "name": "first_name", "value": "Alice", "prompt": "First Name" },
          { "name": "last_name", "value": "Smith", "prompt": "Last Name" },
          { "name": "email", "value": "alice@example.com", "prompt": "Email" }
        ],
        "links": [
          { "rel": "orders", "href": "/users/42/orders", "prompt": "Orders" }
        ]
      }
    ],
    "queries": [
      {
        "rel": "search",
        "href": "/users",
        "prompt": "Search Users",
        "data": [
          { "name": "q", "value": "" },
          { "name": "status", "value": "" }
        ]
      }
    ],
    "template": {
      "data": [
        { "name": "first_name", "value": "", "prompt": "First Name" },
        { "name": "last_name", "value": "", "prompt": "Last Name" },
        { "name": "email", "value": "", "prompt": "Email" }
      ]
    }
  }
}
```

**Pros:** Explicit templates for creating/editing, good for CRUD-heavy APIs
**Cons:** Uncommon, verbose, data represented as name-value pairs instead of direct objects

---

## Format Comparison Matrix

| Feature | HAL | JSON:API | Siren | JSON-LD+Hydra | Collection+JSON |
|---|---|---|---|---|---|
| **Complexity** | Low | Medium-High | Medium | Very High | Medium |
| **Link support** | Yes | Yes | Yes | Yes | Yes |
| **Action/Form support** | No | No | Yes | Yes (Hydra) | Yes (template) |
| **Embedded resources** | Yes | Yes (included) | Yes (entities) | Yes | Yes (items) |
| **Pagination standard** | Convention | Specified | Convention | Hydra views | Convention |
| **Filtering/Sorting** | No | Yes | No | No | Queries |
| **Tooling ecosystem** | Good | Excellent | Poor | Poor | Poor |
| **Adoption** | High | Medium | Low | Very Low | Very Low |
| **Spec maturity** | Draft | Stable (1.1) | Stable | W3C Rec (LD) | Stable |
| **Media type** | `hal+json` | `vnd.api+json` | `vnd.siren+json` | `ld+json` | `vnd.collection+json` |
| **Best for** | Simple APIs | Full-featured APIs | Workflow APIs | Semantic Web | Collection-heavy APIs |

**Recommendation:**
- **Default choice:** HAL -- simple, well-supported, low overhead
- **Full-featured needs:** JSON:API -- if you need standardized filtering, sorting, includes
- **Workflow-heavy APIs:** Siren -- when actions and state transitions are central
- **Avoid for most cases:** JSON-LD+Hydra and Collection+JSON -- too niche

---

## Link Relations

### Standard IANA Link Relations

Link relations are standardized by IANA (Internet Assigned Numbers Authority). Use standard relations whenever possible.

```
self        -- The resource itself (canonical URL)
next        -- Next page in a paginated collection
prev        -- Previous page in a paginated collection
first       -- First page in a paginated collection
last        -- Last page in a paginated collection
collection  -- The collection this resource belongs to
item        -- An item in the collection
related     -- A related resource
edit        -- A resource that can be edited (same URL, different method)
create-form -- A form template for creating a new resource
edit-form   -- A form template for editing the resource
search      -- A search interface
up          -- Parent resource
author      -- The author of the resource
bookmark    -- A permanent link to the resource
canonical   -- The preferred/canonical URL for the resource
describedby -- A description of the resource (schema, documentation)
alternate   -- An alternate representation
enclosure   -- An attached file or resource
payment     -- A payment link
preview     -- A preview of the resource
```

### Custom Link Relations

When standard relations do not suffice, define custom relations using a URL namespace:

```json
{
  "_links": {
    "self": { "href": "/orders/1001" },
    "https://api.example.com/rels/cancel": {
      "href": "/orders/1001/cancel",
      "title": "Cancel this order"
    },
    "https://api.example.com/rels/ship": {
      "href": "/orders/1001/ship",
      "title": "Mark as shipped"
    },
    "https://api.example.com/rels/refund": {
      "href": "/orders/1001/refund",
      "title": "Issue a refund"
    }
  }
}
```

**Best practice for custom rels:**
- Use full URL (URI) as the relation type
- The URL should resolve to documentation explaining the relation
- Alternatively, use a short prefix: `"x:cancel"`, but full URLs are more durable

---

## Pagination with HATEOAS

### Offset-Based Pagination (HAL)

```json
{
  "_links": {
    "self": { "href": "/users?page=3&per_page=20" },
    "first": { "href": "/users?page=1&per_page=20" },
    "prev": { "href": "/users?page=2&per_page=20" },
    "next": { "href": "/users?page=4&per_page=20" },
    "last": { "href": "/users?page=10&per_page=20" }
  },
  "page": 3,
  "per_page": 20,
  "total": 193,
  "total_pages": 10,
  "_embedded": {
    "users": [ /* ... */ ]
  }
}
```

### Cursor-Based Pagination (HAL)

```json
{
  "_links": {
    "self": { "href": "/events?limit=50" },
    "next": { "href": "/events?cursor=eyJpZCI6MTAwfQ&limit=50" }
  },
  "has_more": true,
  "_embedded": {
    "events": [ /* ... */ ]
  }
}
```

**Key rules for HATEOAS pagination:**
- `next` link is **absent** on the last page (not null, not empty -- absent)
- `prev` link is **absent** on the first page
- Clients should check for the **existence** of the link, not compute page numbers
- Cursor values are opaque: clients must never parse or construct cursors

### Client-Side Pagination Traversal (TypeScript)

```typescript
interface HalCollection<T> {
  _links: {
    self: { href: string };
    next?: { href: string };
    prev?: { href: string };
    first?: { href: string };
    last?: { href: string };
  };
  _embedded: {
    [key: string]: T[];
  };
  total?: number;
}

async function fetchAllPages<T>(
  baseUrl: string,
  embeddedKey: string
): Promise<T[]> {
  const allItems: T[] = [];
  let url: string | undefined = baseUrl;

  while (url) {
    const response = await fetch(url);
    const data: HalCollection<T> = await response.json();

    const items = data._embedded[embeddedKey] || [];
    allItems.push(...items);

    // Follow the next link if it exists
    url = data._links.next?.href;
  }

  return allItems;
}

// Usage
const allUsers = await fetchAllPages<User>(
  'https://api.example.com/users?per_page=100',
  'users'
);
```

---

## State Transitions via Links

One of the most powerful aspects of HATEOAS is modeling **state machines** through conditional links. The server includes links only for valid transitions from the current state.

### Order Workflow Example

```typescript
// Server-side: Determine available actions based on order state
function getOrderLinks(order: Order, baseUrl: string): Record<string, HalLink> {
  const links: Record<string, HalLink> = {
    self: { href: `${baseUrl}/orders/${order.id}` },
    collection: { href: `${baseUrl}/orders` },
    customer: { href: `${baseUrl}/users/${order.customerId}` },
  };

  switch (order.status) {
    case 'draft':
      links['submit'] = { href: `${baseUrl}/orders/${order.id}/submit` };
      links['edit'] = { href: `${baseUrl}/orders/${order.id}` };
      links['delete'] = { href: `${baseUrl}/orders/${order.id}` };
      break;

    case 'pending_payment':
      links['pay'] = { href: `${baseUrl}/orders/${order.id}/pay` };
      links['cancel'] = { href: `${baseUrl}/orders/${order.id}/cancel` };
      break;

    case 'paid':
      links['ship'] = { href: `${baseUrl}/orders/${order.id}/ship` };
      links['refund'] = { href: `${baseUrl}/orders/${order.id}/refund` };
      break;

    case 'shipped':
      links['tracking'] = { href: `${baseUrl}/shipments/${order.shipmentId}` };
      links['deliver'] = { href: `${baseUrl}/orders/${order.id}/deliver` };
      links['return'] = { href: `${baseUrl}/orders/${order.id}/return` };
      break;

    case 'delivered':
      links['return'] = { href: `${baseUrl}/orders/${order.id}/return` };
      links['review'] = { href: `${baseUrl}/orders/${order.id}/review` };
      links['invoice'] = { href: `${baseUrl}/orders/${order.id}/invoice` };
      break;

    case 'cancelled':
    case 'refunded':
      // No state transitions available -- terminal states
      links['invoice'] = { href: `${baseUrl}/orders/${order.id}/invoice` };
      break;
  }

  return links;
}
```

### State Machine Responses

```json
// Order in "paid" state -- can be shipped or refunded
{
  "id": 1001,
  "order_number": "ORD-2025-1001",
  "status": "paid",
  "total": 149.99,
  "paid_at": "2025-03-01T14:30:00Z",
  "_links": {
    "self": { "href": "/orders/1001" },
    "customer": { "href": "/users/42" },
    "ship": { "href": "/orders/1001/ship" },
    "refund": { "href": "/orders/1001/refund" },
    "collection": { "href": "/orders" }
  }
}

// Same order after shipping -- can be delivered or returned, but NOT refunded
{
  "id": 1001,
  "order_number": "ORD-2025-1001",
  "status": "shipped",
  "total": 149.99,
  "paid_at": "2025-03-01T14:30:00Z",
  "shipped_at": "2025-03-02T09:00:00Z",
  "_links": {
    "self": { "href": "/orders/1001" },
    "customer": { "href": "/users/42" },
    "tracking": { "href": "/shipments/SHP-5678" },
    "deliver": { "href": "/orders/1001/deliver" },
    "return": { "href": "/orders/1001/return" },
    "collection": { "href": "/orders" }
  }
}
```

### Client-Side State Transition Handling (TypeScript)

```typescript
interface OrderResponse {
  id: number;
  order_number: string;
  status: string;
  total: number;
  _links: Record<string, { href: string }>;
}

class OrderClient {
  constructor(private baseUrl: string, private httpClient: HttpClient) {}

  async getOrder(id: number): Promise<OrderResponse> {
    return this.httpClient.get(`${this.baseUrl}/orders/${id}`);
  }

  // Check if an action is available based on HATEOAS links
  canShip(order: OrderResponse): boolean {
    return 'ship' in order._links;
  }

  canCancel(order: OrderResponse): boolean {
    return 'cancel' in order._links;
  }

  canRefund(order: OrderResponse): boolean {
    return 'refund' in order._links;
  }

  // Execute actions by following links
  async ship(order: OrderResponse, trackingNumber: string): Promise<OrderResponse> {
    if (!this.canShip(order)) {
      throw new Error(`Cannot ship order ${order.id} in status ${order.status}`);
    }
    return this.httpClient.post(order._links['ship'].href, { trackingNumber });
  }

  async cancel(order: OrderResponse, reason: string): Promise<OrderResponse> {
    if (!this.canCancel(order)) {
      throw new Error(`Cannot cancel order ${order.id} in status ${order.status}`);
    }
    return this.httpClient.post(order._links['cancel'].href, { reason });
  }

  async refund(order: OrderResponse): Promise<OrderResponse> {
    if (!this.canRefund(order)) {
      throw new Error(`Cannot refund order ${order.id} in status ${order.status}`);
    }
    return this.httpClient.post(order._links['refund'].href, {});
  }
}

// UI usage: conditionally render buttons based on available links
function OrderActions({ order }: { order: OrderResponse }) {
  const client = new OrderClient(API_BASE_URL, httpClient);

  return (
    <div>
      {client.canShip(order) && (
        <button onClick={() => client.ship(order, trackingNumber)}>
          Ship Order
        </button>
      )}
      {client.canCancel(order) && (
        <button onClick={() => client.cancel(order, reason)}>
          Cancel Order
        </button>
      )}
      {client.canRefund(order) && (
        <button onClick={() => client.refund(order)}>
          Refund Order
        </button>
      )}
    </div>
  );
}
```

---

## Discoverability and API Entry Points

### Root Resource (API Entry Point)

A fully HATEOAS-compliant API has a single entry point (root URL) from which all other resources can be discovered.

```json
// GET /api
{
  "_links": {
    "self": { "href": "/api" },
    "users": {
      "href": "/api/users{?page,per_page,status,sort}",
      "templated": true,
      "title": "User collection"
    },
    "orders": {
      "href": "/api/orders{?page,per_page,status,customer_id}",
      "templated": true,
      "title": "Order collection"
    },
    "products": {
      "href": "/api/products{?page,per_page,category,search}",
      "templated": true,
      "title": "Product catalog"
    },
    "current_user": {
      "href": "/api/me",
      "title": "Currently authenticated user"
    },
    "docs": {
      "href": "https://api.example.com/docs",
      "title": "API documentation"
    },
    "health": {
      "href": "/api/health",
      "title": "API health status"
    }
  },
  "api_name": "Example API",
  "api_version": "2.1.0"
}
```

### URI Templates (RFC 6570)

HATEOAS links can use URI templates to indicate parameterized URLs:

```json
{
  "_links": {
    "user": {
      "href": "/users/{user_id}",
      "templated": true
    },
    "search": {
      "href": "/users{?q,status,page,per_page}",
      "templated": true
    },
    "user_orders": {
      "href": "/users/{user_id}/orders{?status,sort}",
      "templated": true
    }
  }
}
```

**Client resolves templates:**

```typescript
import { parse as parseTemplate } from 'uri-templates'; // RFC 6570 library

const template = parseTemplate('/users/{user_id}/orders{?status,sort}');
const url = template.expand({
  user_id: '42',
  status: 'shipped',
  sort: '-created_at'
});
// Result: /users/42/orders?status=shipped&sort=-created_at
```

---

## Server-Side Implementation

### Express/TypeScript HAL Response Builder

```typescript
// src/hal/HalBuilder.ts

interface HalLink {
  href: string;
  templated?: boolean;
  type?: string;
  deprecation?: string;
  title?: string;
}

interface HalResource {
  _links: Record<string, HalLink | HalLink[]>;
  _embedded?: Record<string, any[]>;
  [key: string]: any;
}

class HalBuilder {
  private resource: HalResource;

  constructor(data: Record<string, any>) {
    this.resource = {
      ...data,
      _links: {},
    };
  }

  addLink(rel: string, href: string, options?: Partial<HalLink>): this {
    this.resource._links[rel] = { href, ...options };
    return this;
  }

  addLinks(links: Record<string, HalLink>): this {
    Object.assign(this.resource._links, links);
    return this;
  }

  addEmbedded(rel: string, resources: any[]): this {
    if (!this.resource._embedded) {
      this.resource._embedded = {};
    }
    this.resource._embedded[rel] = resources;
    return this;
  }

  build(): HalResource {
    return this.resource;
  }
}

// Collection builder with pagination
class HalCollectionBuilder<T> {
  private links: Record<string, HalLink> = {};
  private items: T[] = [];
  private meta: Record<string, any> = {};

  constructor(
    private embeddedKey: string,
    private baseUrl: string,
  ) {}

  setItems(items: T[]): this {
    this.items = items;
    return this;
  }

  setPagination(page: number, perPage: number, total: number): this {
    const totalPages = Math.ceil(total / perPage);

    this.links['self'] = { href: `${this.baseUrl}?page=${page}&per_page=${perPage}` };
    this.links['first'] = { href: `${this.baseUrl}?page=1&per_page=${perPage}` };
    this.links['last'] = { href: `${this.baseUrl}?page=${totalPages}&per_page=${perPage}` };

    if (page > 1) {
      this.links['prev'] = { href: `${this.baseUrl}?page=${page - 1}&per_page=${perPage}` };
    }
    if (page < totalPages) {
      this.links['next'] = { href: `${this.baseUrl}?page=${page + 1}&per_page=${perPage}` };
    }

    this.meta = { page, per_page: perPage, total, total_pages: totalPages };
    return this;
  }

  build(): HalResource {
    return {
      _links: this.links,
      _embedded: {
        [this.embeddedKey]: this.items,
      },
      ...this.meta,
    };
  }
}

// Usage in route handler
router.get('/users', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const perPage = parseInt(req.query.per_page as string) || 20;

  const { users, total } = await userService.findAll({ page, perPage });

  const halUsers = users.map(user =>
    new HalBuilder({
      id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      email: user.email,
    })
    .addLink('self', `/users/${user.id}`)
    .addLink('orders', `/users/${user.id}/orders`)
    .build()
  );

  const collection = new HalCollectionBuilder<HalResource>('users', '/users')
    .setItems(halUsers)
    .setPagination(page, perPage, total)
    .build();

  res.setHeader('Content-Type', 'application/hal+json');
  res.json(collection);
});

router.get('/users/:id', async (req, res) => {
  const user = await userService.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const hal = new HalBuilder({
    id: user.id,
    first_name: user.firstName,
    last_name: user.lastName,
    email: user.email,
    status: user.status,
  })
  .addLink('self', `/users/${user.id}`)
  .addLink('collection', '/users')
  .addLink('orders', `/users/${user.id}/orders`)
  .addLink('edit', `/users/${user.id}`);

  // Conditional links based on state
  if (user.status === 'active') {
    hal.addLink('deactivate', `/users/${user.id}/deactivate`);
  } else if (user.status === 'inactive') {
    hal.addLink('activate', `/users/${user.id}/activate`);
  }

  res.setHeader('Content-Type', 'application/hal+json');
  res.json(hal.build());
});
```

### FastAPI/Python HAL Response Builder

```python
from typing import Optional
from dataclasses import dataclass, field
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
import math

@dataclass
class HalLink:
    href: str
    templated: bool = False
    title: Optional[str] = None

    def to_dict(self):
        result = {"href": self.href}
        if self.templated:
            result["templated"] = True
        if self.title:
            result["title"] = self.title
        return result


class HalResource:
    def __init__(self, data: dict):
        self.data = data
        self.links: dict[str, HalLink] = {}
        self.embedded: dict[str, list] = {}

    def add_link(self, rel: str, href: str, **kwargs) -> "HalResource":
        self.links[rel] = HalLink(href=href, **kwargs)
        return self

    def add_embedded(self, rel: str, resources: list) -> "HalResource":
        self.embedded[rel] = resources
        return self

    def to_dict(self) -> dict:
        result = {**self.data}
        result["_links"] = {rel: link.to_dict() for rel, link in self.links.items()}
        if self.embedded:
            result["_embedded"] = self.embedded
        return result


def build_pagination_links(
    base_url: str, page: int, per_page: int, total: int
) -> dict[str, HalLink]:
    total_pages = math.ceil(total / per_page)
    links = {
        "self": HalLink(href=f"{base_url}?page={page}&per_page={per_page}"),
        "first": HalLink(href=f"{base_url}?page=1&per_page={per_page}"),
        "last": HalLink(href=f"{base_url}?page={total_pages}&per_page={per_page}"),
    }
    if page > 1:
        links["prev"] = HalLink(href=f"{base_url}?page={page - 1}&per_page={per_page}")
    if page < total_pages:
        links["next"] = HalLink(href=f"{base_url}?page={page + 1}&per_page={per_page}")
    return links


router = APIRouter()


@router.get("/users")
async def list_users(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100)):
    users, total = await user_service.find_all(page=page, per_page=per_page)

    hal_users = []
    for user in users:
        resource = HalResource({
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
        })
        resource.add_link("self", f"/users/{user.id}")
        resource.add_link("orders", f"/users/{user.id}/orders")
        hal_users.append(resource.to_dict())

    pagination_links = build_pagination_links("/users", page, per_page, total)

    response = {
        "_links": {rel: link.to_dict() for rel, link in pagination_links.items()},
        "_embedded": {"users": hal_users},
        "page": page,
        "per_page": per_page,
        "total": total,
        "total_pages": math.ceil(total / per_page),
    }

    return JSONResponse(content=response, media_type="application/hal+json")


@router.get("/users/{user_id}")
async def get_user(user_id: int):
    user = await user_service.find_by_id(user_id)

    resource = HalResource({
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "status": user.status,
    })
    resource.add_link("self", f"/users/{user.id}")
    resource.add_link("collection", "/users")
    resource.add_link("orders", f"/users/{user.id}/orders")

    if user.status == "active":
        resource.add_link("deactivate", f"/users/{user.id}/deactivate")
    elif user.status == "inactive":
        resource.add_link("activate", f"/users/{user.id}/activate")

    return JSONResponse(content=resource.to_dict(), media_type="application/hal+json")
```

### Spring Boot HATEOAS (Java -- for reference)

Spring HATEOAS is the most mature server-side HATEOAS framework in any ecosystem:

```java
// Spring HATEOAS provides first-class HATEOAS support
@RestController
@RequestMapping("/users")
public class UserController {

    @GetMapping("/{id}")
    public EntityModel<User> getUser(@PathVariable Long id) {
        User user = userService.findById(id);

        EntityModel<User> model = EntityModel.of(user,
            linkTo(methodOn(UserController.class).getUser(id)).withSelfRel(),
            linkTo(methodOn(UserController.class).getAllUsers()).withRel("collection"),
            linkTo(methodOn(OrderController.class).getOrdersForUser(id)).withRel("orders")
        );

        // Conditional links based on state
        if (user.getStatus() == UserStatus.ACTIVE) {
            model.add(linkTo(methodOn(UserController.class).deactivate(id))
                .withRel("deactivate"));
        }

        return model;
    }
}
```

---

## Client-Side Consumption

### Generic HATEOAS Client (TypeScript)

```typescript
// A generic client that navigates HATEOAS APIs without hardcoded URLs

interface HalLink {
  href: string;
  templated?: boolean;
  type?: string;
  title?: string;
}

interface HalResponse {
  _links: Record<string, HalLink>;
  _embedded?: Record<string, any[]>;
  [key: string]: any;
}

class HateoasClient {
  private baseUrl: string;
  private cache = new Map<string, HalResponse>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Start from the API root and discover available resources
   */
  async discover(): Promise<HalResponse> {
    return this.get(this.baseUrl);
  }

  /**
   * Follow a link relation from a resource
   */
  async follow(resource: HalResponse, rel: string, params?: Record<string, string>): Promise<HalResponse> {
    const link = resource._links[rel];
    if (!link) {
      throw new Error(
        `Link relation '${rel}' not found. Available: ${Object.keys(resource._links).join(', ')}`
      );
    }

    let url = link.href;

    // Resolve URI template if needed
    if (link.templated && params) {
      url = this.resolveTemplate(url, params);
    }

    return this.get(url);
  }

  /**
   * Check if a link relation exists (used for conditional UI rendering)
   */
  hasLink(resource: HalResponse, rel: string): boolean {
    return rel in resource._links;
  }

  /**
   * Get the href of a link relation
   */
  getLink(resource: HalResponse, rel: string): string | undefined {
    return resource._links[rel]?.href;
  }

  /**
   * Get embedded resources
   */
  getEmbedded<T>(resource: HalResponse, key: string): T[] {
    return (resource._embedded?.[key] || []) as T[];
  }

  /**
   * Execute an action (POST/PUT/PATCH/DELETE) on a link
   */
  async execute(
    resource: HalResponse,
    rel: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body?: any
  ): Promise<HalResponse> {
    const link = resource._links[rel];
    if (!link) {
      throw new Error(`Action '${rel}' not available on this resource`);
    }

    const response = await fetch(this.resolveUrl(link.href), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`${method} ${link.href} failed: ${response.status}`);
    }

    return response.json();
  }

  private async get(url: string): Promise<HalResponse> {
    const resolvedUrl = this.resolveUrl(url);

    const response = await fetch(resolvedUrl, {
      headers: { 'Accept': 'application/hal+json' },
    });

    if (!response.ok) {
      throw new Error(`GET ${url} failed: ${response.status}`);
    }

    return response.json();
  }

  private resolveUrl(url: string): string {
    if (url.startsWith('http')) return url;
    return `${this.baseUrl}${url}`;
  }

  private resolveTemplate(template: string, params: Record<string, string>): string {
    let resolved = template;
    for (const [key, value] of Object.entries(params)) {
      resolved = resolved.replace(`{${key}}`, encodeURIComponent(value));
    }
    // Remove remaining template parameters
    resolved = resolved.replace(/\{[^}]+\}/g, '');
    return resolved;
  }
}

// ---- Usage Example ----

async function example() {
  const client = new HateoasClient('https://api.example.com');

  // Step 1: Discover the API
  const root = await client.discover();

  // Step 2: Follow "users" link to get user collection
  const usersCollection = await client.follow(root, 'users', {
    page: '1',
    per_page: '10',
  });

  // Step 3: Get embedded users
  const users = client.getEmbedded<HalResponse>(usersCollection, 'users');
  console.log(`Found ${users.length} users`);

  // Step 4: Follow "self" link of first user
  const firstUser = await client.follow(users[0], 'self');
  console.log('User:', firstUser);

  // Step 5: Check if we can deactivate
  if (client.hasLink(firstUser, 'deactivate')) {
    const deactivated = await client.execute(firstUser, 'deactivate', 'POST', {
      reason: 'User requested account closure',
    });
    console.log('User deactivated:', deactivated);
  } else {
    console.log('Cannot deactivate this user (link not available)');
  }

  // Step 6: Paginate through all users
  let page = usersCollection;
  while (client.hasLink(page, 'next')) {
    page = await client.follow(page, 'next');
    const pageUsers = client.getEmbedded<HalResponse>(page, 'users');
    console.log(`Page: ${pageUsers.length} users`);
  }
}
```

### React Component Consuming HATEOAS

```typescript
// React hook for HATEOAS-driven UI
import { useState, useEffect } from 'react';

function useHateoasResource(url: string) {
  const [resource, setResource] = useState<HalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchResource = async () => {
      setLoading(true);
      try {
        const response = await fetch(url, {
          headers: { 'Accept': 'application/hal+json' },
        });
        const data = await response.json();
        setResource(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    fetchResource();
  }, [url]);

  const hasLink = (rel: string): boolean => {
    return resource ? rel in resource._links : false;
  };

  const followLink = async (rel: string): Promise<HalResponse> => {
    if (!resource || !resource._links[rel]) {
      throw new Error(`Link '${rel}' not available`);
    }
    const response = await fetch(resource._links[rel].href, {
      headers: { 'Accept': 'application/hal+json' },
    });
    return response.json();
  };

  const executeAction = async (rel: string, method: string, body?: any) => {
    if (!resource || !resource._links[rel]) {
      throw new Error(`Action '${rel}' not available`);
    }
    const response = await fetch(resource._links[rel].href, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    setResource(data); // Update resource with new state
    return data;
  };

  return { resource, loading, error, hasLink, followLink, executeAction };
}

// Usage in a component
function OrderDetail({ orderId }: { orderId: number }) {
  const {
    resource: order,
    loading,
    hasLink,
    executeAction,
  } = useHateoasResource(`/api/orders/${orderId}`);

  if (loading || !order) return <div>Loading...</div>;

  return (
    <div>
      <h1>Order {order.order_number}</h1>
      <p>Status: {order.status}</p>
      <p>Total: ${order.total}</p>

      <div className="actions">
        {/* Buttons only appear if the action is available for the current state */}
        {hasLink('ship') && (
          <button onClick={() => executeAction('ship', 'POST', { carrier: 'ups' })}>
            Ship Order
          </button>
        )}

        {hasLink('cancel') && (
          <button onClick={() => executeAction('cancel', 'POST', { reason: 'Customer request' })}>
            Cancel Order
          </button>
        )}

        {hasLink('refund') && (
          <button onClick={() => executeAction('refund', 'POST')}>
            Issue Refund
          </button>
        )}

        {hasLink('tracking') && (
          <a href={order._links.tracking.href}>View Tracking</a>
        )}

        {hasLink('invoice') && (
          <a href={order._links.invoice.href}>Download Invoice</a>
        )}
      </div>
    </div>
  );
}
```

---

## When to Use HATEOAS

HATEOAS is worth the effort in these scenarios:

1. **Workflow-driven APIs:** When resources have complex state machines (orders, approvals, insurance claims, support tickets). The server communicating valid transitions via links is extremely valuable.

2. **Long-lived public APIs:** When you need to evolve API URLs without breaking clients. Clients following links are decoupled from URL changes.

3. **APIs consumed by generic/automated clients:** Bots, crawlers, or systems that must adapt dynamically to available operations.

4. **Multi-tenant APIs with varying capabilities:** When different users or plans have different available actions, conditional links naturally express permission-based capabilities.

5. **APIs where discoverability matters:** Developer-facing platforms where exploring the API from a root endpoint is useful.

6. **APIs with complex authorization:** Instead of the client guessing whether an action is allowed, the server includes the link only if the user has permission.

---

## When NOT to Use HATEOAS

HATEOAS adds complexity that is not justified in many common scenarios:

1. **Single-page applications (SPAs) with typed API clients:** Modern SPAs use generated TypeScript clients (from OpenAPI specs) with compile-time type safety. URL patterns are known at build time. HATEOAS links are largely redundant.

2. **Mobile applications:** Mobile apps have tight coupling to specific API shapes. They rarely benefit from dynamic link discovery. Generated SDKs are preferred.

3. **Internal microservice-to-microservice APIs:** Services are deployed together and versioned together. URL patterns are shared via service registries or API gateways, not hypermedia.

4. **High-performance APIs:** HATEOAS adds payload size overhead. For APIs where response size matters (real-time, mobile on slow networks), the extra bytes for links may not be justified.

5. **Simple CRUD APIs:** If the API is straightforward CRUD with no complex state transitions, HATEOAS adds ceremony without meaningful benefit.

6. **GraphQL APIs:** GraphQL has its own schema introspection mechanism that serves a similar purpose. HATEOAS is a REST concept.

7. **APIs with few consumers:** If you have 1-5 known consumers, you can coordinate URL changes directly. HATEOAS provides the most value at scale (hundreds of unknown consumers).

---

## Decision Tree

```
Should you implement HATEOAS?
|
+-- Does your API have complex state machines / workflows?
|   +-- YES --> HATEOAS for state transitions is highly valuable
|   |           Use Siren for full action descriptions
|   |           Use HAL for navigation links + conditional link inclusion
|   |
|   +-- NO --> Does your API have many unknown third-party consumers?
|       +-- YES --> HATEOAS for evolvability and discoverability
|       |           Use HAL (simplest) or JSON:API (most full-featured)
|       |
|       +-- NO --> Is the API consumed by generated typed clients?
|           +-- YES --> HATEOAS is likely not worth the effort
|           |           Use OpenAPI spec + generated clients instead
|           |
|           +-- NO --> Is the API internal (microservice-to-microservice)?
|               +-- YES --> Skip HATEOAS. Use service discovery instead.
|               +-- NO --> Consider HATEOAS for pagination links at minimum
|                          (self, next, prev, first, last)
|
Which format?
|
+-- Need minimal overhead, wide compatibility?
|   --> HAL
|
+-- Need standardized filtering, sorting, includes, sparse fieldsets?
|   --> JSON:API
|
+-- Need describable actions with form fields?
|   --> Siren
|
+-- Need Semantic Web / Linked Data interoperability?
|   --> JSON-LD + Hydra
|
What level of HATEOAS?
|
+-- Minimum (recommended for most REST APIs):
|   - Include self links on every resource
|   - Include pagination links on collections
|   - Include links to related resources
|
+-- Medium (recommended for workflow APIs):
|   - All of the above
|   - Conditional links based on resource state
|   - State transitions as links
|
+-- Full (rare, for API platform products):
|   - All of the above
|   - API root entry point
|   - URI templates for parameterized discovery
|   - Action descriptions with field schemas
```

---

## Implementation Complexity vs Benefit Analysis

### Cost-Benefit by HATEOAS Level

| Level | Implementation Cost | Maintenance Cost | Benefit |
|---|---|---|---|
| **No HATEOAS** (Level 2 REST) | None | None | Clients must hardcode URLs; changes break clients |
| **Self links only** | Very Low (1-2 days) | Negligible | Canonical URLs, client consistency |
| **Pagination links** | Low (2-3 days) | Low | Clients do not compute pagination URLs |
| **Related resource links** | Medium (1 week) | Medium | Reduced documentation dependency |
| **Conditional state links** | Medium-High (2 weeks) | Medium | Server-driven UI, state machine communication |
| **Full HATEOAS with actions** | High (1 month+) | High | Fully self-describing API, maximum decoupling |

### Team Size Consideration

- **1-5 developers:** Self links + pagination links (minimal, high value)
- **5-20 developers:** Add conditional state links for workflow resources
- **20+ developers / API platform team:** Consider full HATEOAS with formal media types

### Payload Size Impact

```json
// Without HATEOAS: ~120 bytes
{ "id": 42, "first_name": "Alice", "last_name": "Smith", "email": "alice@example.com" }

// With HAL links: ~350 bytes (~3x)
{
  "id": 42,
  "first_name": "Alice",
  "last_name": "Smith",
  "email": "alice@example.com",
  "_links": {
    "self": { "href": "/users/42" },
    "orders": { "href": "/users/42/orders" },
    "edit": { "href": "/users/42" },
    "collection": { "href": "/users" }
  }
}

// With JSON:API: ~500 bytes (~4x)
// With Siren (full actions): ~800+ bytes (~7x)
```

For collections of 100 items, this means:
- No HATEOAS: ~12 KB
- HAL: ~35 KB
- JSON:API: ~50 KB
- Siren: ~80 KB

The overhead is usually negligible for most use cases but can matter for mobile on slow networks or high-frequency polling APIs.

---

## Best Practices

1. **Start with self links:** Every resource should always include a `self` link. This is the lowest-effort, highest-value HATEOAS addition.

2. **Always include pagination links:** Collections must include `next`, `prev`, `first`, `last` links. Clients should never compute pagination URLs.

3. **Use standard IANA link relations:** Do not invent custom `rel` values when standard ones exist. Check https://www.iana.org/assignments/link-relations/link-relations.xhtml first.

4. **Conditionally include links:** Only include a link if the action is valid for the current resource state AND the current user has permission. An absent link means "you cannot do this."

5. **Do not hardcode URLs on the client:** If you implement HATEOAS, clients must follow links, not construct URLs. Otherwise, the benefit is lost.

6. **Use a consistent format:** Pick one hypermedia format (HAL, JSON:API, Siren) and use it consistently across the entire API. Do not mix formats.

7. **Document link relations:** Even though HATEOAS makes APIs more self-describing, document what each link relation means and when it appears.

8. **Return the correct Content-Type:** Use `application/hal+json` or `application/vnd.api+json`, not just `application/json`. This signals to clients that hypermedia controls are present.

9. **Test link correctness:** Verify that every link in every response is reachable and returns the expected resource. Broken links undermine the entire HATEOAS contract.

10. **Layer HATEOAS on top:** Implement it as a response serialization layer, not deeply coupled to business logic. A `HalSerializer` or `ResponseEnricher` pattern works well.

---

## Anti-patterns / Common Mistakes

1. **Including links that clients cannot use:** Including a "delete" link for a user who does not have delete permission defeats the purpose. Links must reflect actual permissions.

2. **Clients ignoring links and hardcoding URLs:** If the client hardcodes URLs, you have HATEOAS overhead without HATEOAS benefits. Enforce link-following on the client side.

3. **Over-engineering for simple APIs:** Implementing full Siren actions with form descriptions for a simple CRUD API with 2 consumers is unnecessary complexity.

4. **Inconsistent link inclusion:** Some endpoints return links, others do not. Partial HATEOAS is confusing and unreliable for clients.

5. **Mixing hypermedia formats:** Using HAL for some endpoints and JSON:API for others within the same API.

6. **Not handling absent links on the client:** Client code crashes when `_links.cancel` is undefined instead of gracefully disabling the cancel button.

7. **Including every possible link on every resource:** Links should be contextual and relevant, not a dump of every URL in the system. Too many links make responses noisy and confusing.

8. **Using HATEOAS as a substitute for documentation:** HATEOAS improves discoverability but does not replace human-readable API documentation.

9. **Putting business logic in link generation:** The `HalBuilder` / serializer should read state and permissions, not compute business rules. Keep link generation simple.

10. **Forgetting templated links:** When a link contains path parameters or query parameters, mark it as `"templated": true` and use RFC 6570 URI template syntax.

---

## Real-World Examples

### GitHub API (Partial HATEOAS)

GitHub is one of the most cited examples of HATEOAS in practice, though its implementation is partial.

```json
// GET https://api.github.com/repos/octocat/hello-world/issues/1
{
  "id": 1,
  "url": "https://api.github.com/repos/octocat/hello-world/issues/1",
  "html_url": "https://github.com/octocat/hello-world/issues/1",
  "comments_url": "https://api.github.com/repos/octocat/hello-world/issues/1/comments",
  "events_url": "https://api.github.com/repos/octocat/hello-world/issues/1/events",
  "labels_url": "https://api.github.com/repos/octocat/hello-world/issues/1/labels{/name}",
  "title": "Found a bug",
  "state": "open",
  "user": {
    "login": "octocat",
    "url": "https://api.github.com/users/octocat",
    "html_url": "https://github.com/octocat"
  }
}
```

**What GitHub does well:**
- Includes `url` (self link) on every resource
- Related resources have `*_url` fields
- Templated URLs (e.g., `labels_url` with `{/name}`)
- Root entry point at `https://api.github.com`

**What GitHub does not do:**
- Does not use a standard hypermedia format (no HAL, no JSON:API)
- Does not conditionally include links based on permissions
- Links are flat fields, not nested under `_links`

### Amazon API Gateway + Spring HATEOAS

Amazon API Gateway natively supports HAL format. Spring HATEOAS (Java) is the most production-ready HATEOAS framework, used by many enterprise Java APIs.

### PayPal REST API

PayPal's API uses HATEOAS-style links extensively for payment workflows:

```json
{
  "id": "PAY-12345",
  "state": "created",
  "links": [
    {
      "href": "https://api.paypal.com/v1/payments/payment/PAY-12345",
      "rel": "self",
      "method": "GET"
    },
    {
      "href": "https://www.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=TOKEN",
      "rel": "approval_url",
      "method": "REDIRECT"
    },
    {
      "href": "https://api.paypal.com/v1/payments/payment/PAY-12345/execute",
      "rel": "execute",
      "method": "POST"
    }
  ]
}
```

PayPal's approach is workflow-driven: the `links` array tells the client exactly what to do next (redirect user to approval URL, then execute payment).

---

## Sources

- **Roy Fielding's Dissertation -- Chapter 5:** https://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm
- **HAL Specification (Internet Draft):** https://datatracker.ietf.org/doc/html/draft-kelly-json-hal
- **JSON:API Specification:** https://jsonapi.org/
- **Siren Specification:** https://github.com/kevinswiber/siren
- **JSON-LD Specification (W3C):** https://www.w3.org/TR/json-ld/
- **Hydra Vocabulary (W3C):** https://www.w3.org/ns/hydra/spec/latest/core/
- **Collection+JSON:** http://amundsen.com/media-types/collection/format/
- **RFC 6570 -- URI Template:** https://www.rfc-editor.org/rfc/rfc6570
- **IANA Link Relations:** https://www.iana.org/assignments/link-relations/link-relations.xhtml
- **Richardson Maturity Model -- Martin Fowler:** https://martinfowler.com/articles/richardsonMaturityModel.html
- **Spring HATEOAS Documentation:** https://spring.io/projects/spring-hateoas
- **GitHub REST API -- Hypermedia:** https://docs.github.com/en/rest/overview/resources-in-the-rest-api
- **PayPal REST API -- HATEOAS Links:** https://developer.paypal.com/api/rest/responses/#link-hateoaslinks
- **RESTful Web APIs (O'Reilly):** Leonard Richardson, Mike Amundsen, Sam Ruby
