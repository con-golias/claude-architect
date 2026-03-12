# Search API Design & Advanced Patterns

> **AI Plugin Directive — Search API Design, Faceted Search, Autocomplete & Pagination**
> You are an AI coding assistant. When generating, reviewing, or refactoring search API endpoints
> and UI integration patterns, follow EVERY rule in this document. Search UX is make-or-break for
> product adoption — bad search loses users. Treat each section as non-negotiable.

**Core Rule: ALWAYS return facets/aggregations alongside results (not as separate requests). ALWAYS implement cursor-based pagination for search results. ALWAYS provide highlighted snippets for text matches. ALWAYS log search queries and click-through for quality measurement. NEVER allow arbitrary user input to reach the search engine query DSL.**

---

## 1. Search API Design

```
┌──────────────────────────────────────────────────────────────┐
│              Search API Architecture                          │
│                                                               │
│  Client Request:                                             │
│  GET /api/search?q=wireless+headphones                      │
│       &category=electronics                                  │
│       &brand=sony,bose                                       │
│       &price_min=50&price_max=200                            │
│       &rating_min=4                                          │
│       &sort=relevance                                        │
│       &page_size=20                                          │
│       &cursor=eyJzY29yZSI6...                               │
│                                                               │
│  Response Structure:                                          │
│  {                                                           │
│    "query": "wireless headphones",                           │
│    "results": [...],              ← Matched documents        │
│    "facets": {                    ← Aggregations for filters  │
│      "categories": [...],                                    │
│      "brands": [...],                                        │
│      "price_ranges": [...],                                  │
│      "ratings": [...]                                        │
│    },                                                        │
│    "pagination": {                ← Cursor-based pagination   │
│      "total": 1247,                                          │
│      "next_cursor": "...",                                   │
│      "has_more": true                                        │
│    },                                                        │
│    "metadata": {                  ← Search telemetry          │
│      "took_ms": 42,                                          │
│      "applied_filters": [...],                               │
│      "spell_correction": null                                │
│    }                                                         │
│  }                                                           │
│                                                               │
│  RULE: Return EVERYTHING in a single response                │
│  RULE: NEVER make the client request facets separately       │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Search API Implementation

```typescript
import { Router, Request, Response } from "express";
import { z } from "zod";

// Input validation schema
const SearchParamsSchema = z.object({
  q: z.string().min(1).max(500).optional(),
  category: z.string().optional(),
  brand: z.string().transform(s => s.split(",")).optional(),
  price_min: z.coerce.number().min(0).optional(),
  price_max: z.coerce.number().min(0).optional(),
  rating_min: z.coerce.number().min(1).max(5).optional(),
  in_stock: z.coerce.boolean().optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "newest", "rating", "popular"]).default("relevance"),
  page_size: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
  fields: z.string().transform(s => s.split(",")).optional(), // Sparse fieldsets
});

type SearchParams = z.infer<typeof SearchParamsSchema>;

const router = Router();

router.get("/api/search", async (req: Request, res: Response) => {
  // 1. Validate & sanitize input
  const parseResult = SearchParamsSchema.safeParse(req.query);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "invalid_search_params",
      details: parseResult.error.issues,
    });
  }
  const params = parseResult.data;

  // 2. Build search query
  const searchRequest = buildSearchRequest(params);

  // 3. Execute search
  const startTime = Date.now();
  const rawResult = await searchEngine.search(searchRequest);
  const tookMs = Date.now() - startTime;

  // 4. Map response
  const response: SearchResponse = {
    query: params.q || "",
    results: rawResult.hits.map(mapSearchResult),
    facets: mapFacets(rawResult.aggregations),
    pagination: {
      total: rawResult.total,
      page_size: params.page_size,
      next_cursor: encodeNextCursor(rawResult.hits),
      has_more: rawResult.hits.length === params.page_size,
    },
    metadata: {
      took_ms: tookMs,
      applied_filters: getAppliedFilters(params),
      spell_correction: rawResult.suggest?.correction || null,
    },
  };

  // 5. Log search event for analytics
  await searchAnalytics.logSearch({
    query: params.q,
    filters: getAppliedFilters(params),
    total_results: rawResult.total,
    latency_ms: tookMs,
    user_id: req.user?.id,
    session_id: req.sessionId,
    request_id: req.requestId,
  });

  // 6. Cache headers
  res.set({
    "Cache-Control": "private, max-age=60",  // Short cache for personalized results
    "X-Search-Took": tookMs.toString(),
    "X-Total-Count": rawResult.total.toString(),
  });

  res.json(response);
});

// Response types
interface SearchResponse {
  query: string;
  results: SearchResult[];
  facets: SearchFacets;
  pagination: PaginationInfo;
  metadata: SearchMetadata;
}

interface SearchResult {
  id: string;
  type: string;
  title: string;
  highlight: {
    title?: string;
    description?: string;
  };
  score: number;
  data: Record<string, unknown>;
}

interface SearchFacets {
  categories: FacetBucket[];
  brands: FacetBucket[];
  price_ranges: FacetBucket[];
  ratings: FacetBucket[];
  in_stock_count: number;
}

interface FacetBucket {
  key: string;
  label: string;
  count: number;
  selected: boolean;
}

function mapSearchResult(hit: any): SearchResult {
  return {
    id: hit._id,
    type: hit._source.type || "product",
    title: hit._source.name || hit._source.title,
    highlight: {
      title: hit.highlight?.name?.[0] || hit.highlight?.title?.[0],
      description: hit.highlight?.description?.[0],
    },
    score: hit._score,
    data: hit._source,
  };
}

function mapFacets(aggs: any): SearchFacets {
  return {
    categories: aggs?.categories?.buckets?.map((b: any) => ({
      key: b.key,
      label: formatCategoryLabel(b.key),
      count: b.doc_count,
      selected: false,   // Client determines from URL params
    })) || [],
    brands: aggs?.brands?.buckets?.map((b: any) => ({
      key: b.key,
      label: b.key,
      count: b.doc_count,
      selected: false,
    })) || [],
    price_ranges: aggs?.price_ranges?.buckets?.map((b: any) => ({
      key: b.key,
      label: formatPriceRange(b),
      count: b.doc_count,
      selected: false,
    })) || [],
    ratings: aggs?.rating_histogram?.buckets?.map((b: any) => ({
      key: b.key.toString(),
      label: `${b.key}+ stars`,
      count: b.doc_count,
      selected: false,
    })) || [],
    in_stock_count: aggs?.in_stock_count?.doc_count || 0,
  };
}
```

### Go — Search API Handler

```go
type SearchParams struct {
    Query     string   `form:"q"`
    Category  string   `form:"category"`
    Brands    []string `form:"brand"`
    PriceMin  *float64 `form:"price_min"`
    PriceMax  *float64 `form:"price_max"`
    RatingMin *float64 `form:"rating_min"`
    InStock   *bool    `form:"in_stock"`
    Sort      string   `form:"sort" binding:"oneof=relevance price_asc price_desc newest rating"`
    PageSize  int      `form:"page_size" binding:"min=1,max=100"`
    Cursor    string   `form:"cursor"`
}

func (h *SearchHandler) Search(c *gin.Context) {
    var params SearchParams
    if err := c.ShouldBindQuery(&params); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_params", "details": err.Error()})
        return
    }

    if params.PageSize == 0 {
        params.PageSize = 20
    }
    if params.Sort == "" {
        params.Sort = "relevance"
    }

    start := time.Now()
    results, err := h.searchService.Search(c.Request.Context(), params)
    if err != nil {
        slog.Error("search failed", "error", err, "query", params.Query)
        c.JSON(http.StatusInternalServerError, gin.H{"error": "search_failed"})
        return
    }
    took := time.Since(start)

    // Log search analytics
    go h.analytics.LogSearch(SearchEvent{
        Query:        params.Query,
        TotalResults: results.Total,
        LatencyMs:    took.Milliseconds(),
        UserID:       auth.GetUserID(c),
    })

    c.Header("X-Search-Took", fmt.Sprintf("%d", took.Milliseconds()))
    c.JSON(http.StatusOK, results)
}
```

### Python — Search API

```python
from fastapi import APIRouter, Query, Depends
from pydantic import BaseModel, Field

router = APIRouter()

class SearchQuery(BaseModel):
    q: str | None = Field(None, min_length=1, max_length=500)
    category: str | None = None
    brand: list[str] | None = None
    price_min: float | None = Field(None, ge=0)
    price_max: float | None = Field(None, ge=0)
    rating_min: float | None = Field(None, ge=1, le=5)
    in_stock: bool | None = None
    sort: str = Field("relevance", pattern="^(relevance|price_asc|price_desc|newest|rating)$")
    page_size: int = Field(20, ge=1, le=100)
    cursor: str | None = None

class SearchResult(BaseModel):
    id: str
    title: str
    highlight: dict[str, str | None]
    score: float
    data: dict

class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
    facets: dict
    pagination: dict
    metadata: dict

@router.get("/api/search", response_model=SearchResponse)
async def search(
    params: SearchQuery = Depends(),
    search_service: SearchService = Depends(get_search_service),
    analytics: AnalyticsService = Depends(get_analytics),
    user: User | None = Depends(get_optional_user),
):
    import time
    start = time.monotonic()

    result = await search_service.search(params)

    took_ms = int((time.monotonic() - start) * 1000)

    # Log asynchronously
    await analytics.log_search(
        query=params.q,
        total_results=result.total,
        latency_ms=took_ms,
        user_id=user.id if user else None,
    )

    return SearchResponse(
        query=params.q or "",
        results=[map_result(hit) for hit in result.hits],
        facets=map_facets(result.aggregations),
        pagination={
            "total": result.total,
            "page_size": params.page_size,
            "next_cursor": encode_cursor(result.hits),
            "has_more": len(result.hits) == params.page_size,
        },
        metadata={
            "took_ms": took_ms,
            "applied_filters": get_applied_filters(params),
        },
    )
```

---

## 3. Faceted Search

```
┌──────────────────────────────────────────────────────────────┐
│              Faceted Search Architecture                       │
│                                                               │
│  User sees:                                                  │
│  ┌─────────────────────┬──────────────────────────┐         │
│  │  Filters (Facets)   │  Results                 │         │
│  │                     │                          │         │
│  │  Category           │  Result 1               │         │
│  │  ☑ Electronics (45) │  Result 2               │         │
│  │  ☐ Clothing (23)    │  Result 3               │         │
│  │  ☐ Books (12)       │  ...                    │         │
│  │                     │                          │         │
│  │  Brand              │                          │         │
│  │  ☑ Sony (18)        │                          │         │
│  │  ☐ Bose (12)        │                          │         │
│  │  ☐ JBL (8)          │                          │         │
│  │                     │                          │         │
│  │  Price              │                          │         │
│  │  ☐ Under $50 (5)    │                          │         │
│  │  ☑ $50-$100 (12)    │                          │         │
│  │  ☐ $100-$200 (8)    │                          │         │
│  │                     │                          │         │
│  │  Rating             │                          │         │
│  │  ☐ 4+ stars (25)    │                          │         │
│  │  ☐ 3+ stars (35)    │                          │         │
│  └─────────────────────┴──────────────────────────┘         │
│                                                               │
│  KEY RULE: Facet counts MUST reflect the current query       │
│  + all OTHER active filters, NOT the facet's own filter.     │
│                                                               │
│  If user selects "Sony" brand:                               │
│  ├── Category counts update (only Sony products)            │
│  ├── Price counts update (only Sony products)               │
│  ├── Rating counts update (only Sony products)              │
│  └── Brand counts stay UNFILTERED by brand                  │
│       (so user can see other brand options + counts)         │
│                                                               │
│  This is called "disjunctive faceting" or                    │
│  "facets with post-filter"                                   │
└──────────────────────────────────────────────────────────────┘
```

### Disjunctive Faceting Implementation

```typescript
// Disjunctive faceting: facet counts exclude their OWN filter
function buildDisjunctiveFacetQuery(params: SearchParams) {
  const baseFilters = [];

  // Non-faceted filters (always apply)
  if (params.q) {
    baseFilters.push({
      multi_match: { query: params.q, fields: ["name^3", "description"] },
    });
  }
  if (params.in_stock) {
    baseFilters.push({ term: { in_stock: true } });
  }

  // Faceted filters (conditionally applied)
  const categoryFilter = params.category
    ? { term: { category: params.category } }
    : null;
  const brandFilter = params.brands?.length
    ? { terms: { brand: params.brands } }
    : null;
  const priceFilter =
    params.price_min !== undefined || params.price_max !== undefined
      ? { range: { price: { gte: params.price_min, lte: params.price_max } } }
      : null;

  // All filters EXCEPT the facet's own filter
  const filtersExceptCategory = [brandFilter, priceFilter].filter(Boolean);
  const filtersExceptBrand = [categoryFilter, priceFilter].filter(Boolean);
  const filtersExceptPrice = [categoryFilter, brandFilter].filter(Boolean);

  return {
    query: {
      bool: {
        must: baseFilters,
        filter: [categoryFilter, brandFilter, priceFilter].filter(Boolean),
      },
    },
    // post_filter: applies AFTER aggregations but BEFORE results
    // Use when you want facets to show counts for unselected options
    aggs: {
      // Category facet: exclude category filter
      all_categories: {
        global: {},
        aggs: {
          filtered: {
            filter: {
              bool: {
                must: [...baseFilters, ...filtersExceptCategory],
              },
            },
            aggs: {
              categories: { terms: { field: "category", size: 50 } },
            },
          },
        },
      },
      // Brand facet: exclude brand filter
      all_brands: {
        global: {},
        aggs: {
          filtered: {
            filter: {
              bool: {
                must: [...baseFilters, ...filtersExceptBrand],
              },
            },
            aggs: {
              brands: { terms: { field: "brand", size: 100 } },
            },
          },
        },
      },
      // Price facet: exclude price filter
      all_prices: {
        global: {},
        aggs: {
          filtered: {
            filter: {
              bool: {
                must: [...baseFilters, ...filtersExceptPrice],
              },
            },
            aggs: {
              price_ranges: {
                range: {
                  field: "price",
                  ranges: [
                    { key: "under_50", to: 50 },
                    { key: "50_100", from: 50, to: 100 },
                    { key: "100_200", from: 100, to: 200 },
                    { key: "over_200", from: 200 },
                  ],
                },
              },
            },
          },
        },
      },
    },
  };
}
```

---

## 4. Autocomplete & Typeahead

```
┌──────────────────────────────────────────────────────────────┐
│              Autocomplete Architecture                        │
│                                                               │
│  Approach Comparison:                                        │
│                                                               │
│  1. Completion Suggester (Elasticsearch)                     │
│  ├── Fastest (FST data structure — in-memory)               │
│  ├── Prefix-based only (no fuzzy by default)                │
│  ├── Limited to suggest field type                          │
│  └── Best for: exact prefix, high throughput                │
│                                                               │
│  2. Edge N-gram + Search                                     │
│  ├── Flexible (full query DSL available)                    │
│  ├── Supports fuzzy, boosting, filtering                    │
│  ├── Slightly slower than completion suggester              │
│  └── Best for: general autocomplete with filters            │
│                                                               │
│  3. Search-as-you-type field                                │
│  ├── Built-in edge n-gram + shingle subfields              │
│  ├── No custom analyzer needed                              │
│  ├── Good balance of speed and flexibility                  │
│  └── Best for: quick setup, good defaults                   │
│                                                               │
│  4. Client-side (small datasets)                            │
│  ├── Pre-load data, filter in browser                      │
│  ├── Zero latency after initial load                        │
│  └── Best for: < 10K items, static data                    │
│                                                               │
│  RULE: Autocomplete MUST respond in < 100ms                 │
│  RULE: Debounce client input (200-300ms)                    │
│  RULE: Show results after 2+ characters                     │
│  RULE: Highlight matching portion in results                │
└──────────────────────────────────────────────────────────────┘
```

### Autocomplete Implementation

```typescript
// Complete autocomplete endpoint
router.get("/api/autocomplete", async (req: Request, res: Response) => {
  const query = (req.query.q as string || "").trim();
  const category = req.query.category as string;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

  if (query.length < 2) {
    return res.json({ suggestions: [] });
  }

  const suggestions = await getAutocompleteSuggestions(query, category, limit);

  // Aggressive caching for autocomplete
  res.set("Cache-Control", "public, max-age=300"); // 5 min cache
  res.json({ suggestions });
});

async function getAutocompleteSuggestions(
  query: string,
  category?: string,
  limit: number = 10,
): Promise<AutocompleteSuggestion[]> {
  const result = await client.search({
    index: "products",
    body: {
      size: limit,
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  // Highest priority: exact prefix on name
                  {
                    match_phrase_prefix: {
                      name: { query, max_expansions: 10, boost: 10 },
                    },
                  },
                  // Edge n-gram match
                  {
                    match: {
                      "name.autocomplete": { query, boost: 5 },
                    },
                  },
                  // Fuzzy match (handles typos)
                  {
                    match: {
                      name: { query, fuzziness: "AUTO", prefix_length: 2, boost: 1 },
                    },
                  },
                  // SKU exact match
                  {
                    term: {
                      "sku.keyword": { value: query.toUpperCase(), boost: 20 },
                    },
                  },
                ],
                minimum_should_match: 1,
              },
            },
          ],
          filter: [
            { term: { in_stock: true } },
            ...(category ? [{ term: { category } }] : []),
          ],
        },
      },
      _source: ["name", "category", "brand", "price", "image_url"],
      highlight: {
        fields: {
          name: {
            pre_tags: ["<strong>"],
            post_tags: ["</strong>"],
            number_of_fragments: 0,
          },
        },
      },
    },
  });

  return result.body.hits.hits.map((hit: any) => ({
    id: hit._id,
    text: hit._source.name,
    highlighted: hit.highlight?.name?.[0] || hit._source.name,
    category: hit._source.category,
    brand: hit._source.brand,
    price: hit._source.price,
    image_url: hit._source.image_url,
  }));
}

// Popular queries autocomplete (from analytics)
async function getPopularQuerySuggestions(prefix: string, limit: number = 5): Promise<string[]> {
  const result = await client.search({
    index: "search_queries",
    body: {
      size: 0,
      query: {
        bool: {
          must: [
            { prefix: { query: { value: prefix.toLowerCase() } } },
            { range: { timestamp: { gte: "now-7d" } } },
          ],
          filter: [
            { range: { result_count: { gt: 0 } } }, // Only queries with results
          ],
        },
      },
      aggs: {
        popular: {
          terms: {
            field: "query.keyword",
            size: limit,
            order: { _count: "desc" },
          },
        },
      },
    },
  });

  return result.body.aggregations.popular.buckets.map((b: any) => b.key);
}
```

---

## 5. Search Pagination Patterns

```
┌──────────────────────────────────────────────────────────────┐
│              Pagination Comparison                            │
│                                                               │
│  1. Offset-based (from + size)                              │
│  ├── Simple: ?page=3&page_size=20 → from=40, size=20       │
│  ├── Allows jumping to arbitrary page                       │
│  ├── PROBLEM: from+size > 10,000 fails (or very slow)      │
│  ├── PROBLEM: Inconsistent with concurrent writes           │
│  └── Use for: Pages 1-50, total < 10K results              │
│                                                               │
│  2. Cursor-based (search_after)                             │
│  ├── Use sort values of last result as cursor               │
│  ├── Efficient for ANY depth (no 10K limit)                 │
│  ├── Consistent even with concurrent changes                │
│  ├── CANNOT jump to arbitrary page                          │
│  └── Use for: Infinite scroll, deep pagination              │
│                                                               │
│  3. Scroll API (deprecated for search)                      │
│  ├── Creates a snapshot for consistent reads                │
│  ├── Heavy resource usage (keeps search context open)       │
│  ├── Meant for data export, not user-facing search          │
│  └── Use point_in_time + search_after instead               │
│                                                               │
│  RULE: Default to cursor-based pagination                   │
│  RULE: Offer offset-based ONLY for first 500 results       │
│  RULE: NEVER use scroll API for user-facing search          │
└──────────────────────────────────────────────────────────────┘
```

### Cursor-Based Search Pagination

```typescript
// Cursor encoding/decoding
function encodeCursor(hits: any[]): string | null {
  if (hits.length === 0) return null;
  const lastHit = hits[hits.length - 1];
  // Encode the sort values of the last hit
  return Buffer.from(JSON.stringify(lastHit.sort)).toString("base64url");
}

function decodeCursor(cursor: string): any[] {
  return JSON.parse(Buffer.from(cursor, "base64url").toString());
}

// Search with cursor pagination
async function searchWithCursor(params: SearchParams): Promise<PaginatedResult> {
  const searchBody: any = {
    size: params.page_size,
    query: buildQuery(params),
    sort: buildSort(params.sort),
  };

  // Apply cursor (search_after)
  if (params.cursor) {
    searchBody.search_after = decodeCursor(params.cursor);
  }

  const result = await client.search({
    index: "products",
    body: searchBody,
    track_total_hits: true,
  });

  const hits = result.body.hits.hits;

  return {
    results: hits.map(mapHit),
    total: result.body.hits.total.value,
    next_cursor: encodeCursor(hits),
    has_more: hits.length === params.page_size,
  };
}

// Point-in-time for consistent pagination across pages
async function createSearchSession(): Promise<string> {
  const pit = await client.openPointInTime({
    index: "products",
    keep_alive: "5m",
  });
  return pit.body.id;
}

async function searchWithPIT(pitId: string, params: SearchParams): Promise<PaginatedResult> {
  const result = await client.search({
    body: {
      size: params.page_size,
      query: buildQuery(params),
      pit: {
        id: pitId,
        keep_alive: "5m",
      },
      sort: buildSort(params.sort),
      search_after: params.cursor ? decodeCursor(params.cursor) : undefined,
    },
  });

  return {
    results: result.body.hits.hits.map(mapHit),
    total: result.body.hits.total.value,
    next_cursor: encodeCursor(result.body.hits.hits),
    has_more: result.body.hits.hits.length === params.page_size,
    pit_id: result.body.pit_id, // Updated PIT ID
  };
}
```

---

## 6. Spell Correction & "Did You Mean?"

```typescript
// Spell correction using Elasticsearch phrase suggester
async function searchWithSpellCorrection(query: string): Promise<SearchWithSuggestion> {
  const result = await client.search({
    index: "products",
    body: {
      query: {
        multi_match: {
          query,
          fields: ["name^3", "description"],
          fuzziness: "AUTO",
        },
      },
      suggest: {
        // Phrase suggester (context-aware corrections)
        text: query,
        phrase_suggestion: {
          phrase: {
            field: "name.trigram",       // Needs trigram analyzer
            size: 1,
            gram_size: 3,
            direct_generator: [
              {
                field: "name.trigram",
                suggest_mode: "popular",   // Suggest more popular alternatives
                min_word_length: 3,
              },
            ],
            collate: {
              // Only suggest if correction has results
              query: {
                source: {
                  match: {
                    name: "{{suggestion}}",
                  },
                },
              },
              prune: true,
            },
          },
        },
      },
    },
  });

  const hits = result.body.hits;
  const suggestion = result.body.suggest?.phrase_suggestion?.[0]?.options?.[0];

  return {
    results: hits.hits.map(mapHit),
    total: hits.total.value,
    spell_correction: suggestion && hits.total.value < 5
      ? {
          original: query,
          corrected: suggestion.text,
          score: suggestion.score,
        }
      : null,
  };
}
```

---

## 7. Multi-Index Search (Federated Search)

```typescript
// Search across multiple indices with different types
async function federatedSearch(query: string, types?: string[]): Promise<FederatedResult> {
  const indices = types?.length
    ? types.map(t => `${t}`)
    : ["products", "articles", "users"];

  const result = await client.search({
    index: indices.join(","),
    body: {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ["name^3", "title^3", "description^2", "body", "username^2"],
                type: "best_fields",
                fuzziness: "AUTO",
              },
            },
          ],
        },
      },
      // Per-index boosting
      indices_boost: [
        { products: 1.5 },   // Products rank higher
        { articles: 1.2 },
        { users: 1.0 },
      ],
      // Group results by index
      aggs: {
        by_type: {
          terms: {
            field: "_index",
            size: 10,
          },
        },
      },
      size: 20,
      highlight: {
        fields: {
          "*": { number_of_fragments: 1, fragment_size: 150 },
        },
      },
    },
  });

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const hit of result.body.hits.hits) {
    const type = hit._index;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(mapHit(hit));
  }

  return {
    results: result.body.hits.hits.map(mapHit),
    grouped,
    type_counts: result.body.aggregations.by_type.buckets.map((b: any) => ({
      type: b.key,
      count: b.doc_count,
    })),
    total: result.body.hits.total.value,
  };
}
```

---

## 8. Search Analytics & Quality

```typescript
// Search analytics pipeline
class SearchAnalytics {
  constructor(private esClient: Client, private redis: Redis) {}

  async logSearch(event: SearchEvent): Promise<void> {
    // 1. Index search event
    await this.esClient.index({
      index: `search_events_${new Date().toISOString().slice(0, 7)}`, // Monthly indices
      body: {
        ...event,
        timestamp: new Date().toISOString(),
      },
    });

    // 2. Track popular queries (Redis sorted set)
    if (event.query) {
      await this.redis.zincrby("popular_queries:daily", 1, event.query.toLowerCase());
      await this.redis.expire("popular_queries:daily", 86400);
    }

    // 3. Track zero-result queries
    if (event.total_results === 0 && event.query) {
      await this.redis.zincrby("zero_result_queries:daily", 1, event.query.toLowerCase());
    }
  }

  async logClick(event: ClickEvent): Promise<void> {
    await this.esClient.index({
      index: `search_clicks_${new Date().toISOString().slice(0, 7)}`,
      body: {
        query: event.query,
        clicked_id: event.result_id,
        position: event.position,        // Which result was clicked (1-indexed)
        user_id: event.user_id,
        session_id: event.session_id,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Quality reports
  async getSearchQualityMetrics(days: number = 7): Promise<QualityMetrics> {
    const result = await this.esClient.search({
      index: "search_events_*",
      body: {
        size: 0,
        query: {
          range: { timestamp: { gte: `now-${days}d` } },
        },
        aggs: {
          total_searches: { value_count: { field: "query.keyword" } },
          zero_results: {
            filter: { term: { total_results: 0 } },
          },
          avg_latency: { avg: { field: "latency_ms" } },
          p95_latency: { percentiles: { field: "latency_ms", percents: [95] } },
          top_queries: {
            terms: { field: "query.keyword", size: 20 },
          },
          top_zero_result_queries: {
            filter: { term: { total_results: 0 } },
            aggs: {
              queries: {
                terms: { field: "query.keyword", size: 20 },
              },
            },
          },
        },
      },
    });

    const aggs = result.body.aggregations;
    const total = aggs.total_searches.value;

    return {
      total_searches: total,
      zero_result_rate: aggs.zero_results.doc_count / total,
      avg_latency_ms: aggs.avg_latency.value,
      p95_latency_ms: aggs.p95_latency.values["95.0"],
      top_queries: aggs.top_queries.buckets,
      top_zero_result_queries: aggs.top_zero_result_queries.queries.buckets,
    };
  }

  // Calculate MRR from click data
  async calculateMRR(days: number = 7): Promise<number> {
    const result = await this.esClient.search({
      index: "search_clicks_*",
      body: {
        size: 0,
        query: { range: { timestamp: { gte: `now-${days}d` } } },
        aggs: {
          by_query: {
            terms: { field: "query.keyword", size: 10000 },
            aggs: {
              min_position: { min: { field: "position" } },
            },
          },
        },
      },
    });

    const buckets = result.body.aggregations.by_query.buckets;
    if (buckets.length === 0) return 0;

    const reciprocalRanks = buckets.map(
      (b: any) => 1 / b.min_position.value,
    );
    return reciprocalRanks.reduce((a: number, b: number) => a + b, 0) / reciprocalRanks.length;
  }
}
```

---

## 9. Search Result Caching

```typescript
// Cache frequent search queries in Redis
class SearchCache {
  private readonly DEFAULT_TTL = 60; // 1 minute

  constructor(private redis: Redis) {}

  private getCacheKey(params: SearchParams): string {
    // Deterministic cache key from search params
    const normalized = {
      q: params.q?.toLowerCase().trim(),
      category: params.category,
      brands: params.brands?.sort(),
      price_min: params.price_min,
      price_max: params.price_max,
      sort: params.sort,
      page_size: params.page_size,
      cursor: params.cursor,
    };
    const hash = createHash("sha256")
      .update(JSON.stringify(normalized))
      .digest("hex")
      .slice(0, 16);
    return `search:${hash}`;
  }

  async get(params: SearchParams): Promise<SearchResponse | null> {
    const key = this.getCacheKey(params);
    const cached = await this.redis.get(key);
    if (!cached) return null;

    metrics.increment("search_cache.hit");
    return JSON.parse(cached);
  }

  async set(params: SearchParams, response: SearchResponse): Promise<void> {
    const key = this.getCacheKey(params);
    await this.redis.set(key, JSON.stringify(response), "EX", this.DEFAULT_TTL);
    metrics.increment("search_cache.miss");
  }

  // Invalidate on index change
  async invalidateAll(): Promise<void> {
    const keys = await this.redis.keys("search:*");
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

// Usage in search endpoint
async function cachedSearch(params: SearchParams): Promise<SearchResponse> {
  // Don't cache cursor-based requests (too many variations)
  if (!params.cursor) {
    const cached = await searchCache.get(params);
    if (cached) return cached;
  }

  const response = await searchEngine.search(params);

  // Only cache first page and popular queries
  if (!params.cursor) {
    await searchCache.set(params, response);
  }

  return response;
}
```

---

## 10. Search Security

```typescript
// Query sanitization — NEVER allow raw DSL
class SearchQuerySanitizer {
  private static readonly MAX_QUERY_LENGTH = 500;
  private static readonly MAX_TERMS = 20;
  private static readonly FORBIDDEN_PATTERNS = [
    /\bscript\b/i,        // Scripting injection
    /\{\s*"query"/,        // Raw DSL injection
    /\$\{/,                // Template injection
    /__proto__/,           // Prototype pollution
  ];

  static sanitize(query: string): string {
    // 1. Length limit
    let sanitized = query.slice(0, this.MAX_QUERY_LENGTH);

    // 2. Check for injection attempts
    for (const pattern of this.FORBIDDEN_PATTERNS) {
      if (pattern.test(sanitized)) {
        logger.warn("Search injection attempt detected", { query });
        throw new BadRequestError("Invalid search query");
      }
    }

    // 3. Remove special Elasticsearch characters
    sanitized = sanitized.replace(/[+\-=&|><!(){}[\]^"~*?:\\/]/g, " ");

    // 4. Limit number of terms
    const terms = sanitized.split(/\s+/).filter(Boolean);
    if (terms.length > this.MAX_TERMS) {
      sanitized = terms.slice(0, this.MAX_TERMS).join(" ");
    }

    // 5. Collapse whitespace
    return sanitized.replace(/\s+/g, " ").trim();
  }
}

// Multi-tenant search isolation
class TenantSearchService {
  async search(tenantId: string, params: SearchParams): Promise<SearchResponse> {
    // ALWAYS inject tenant filter — cannot be bypassed
    const tenantFilter = { term: { tenant_id: tenantId } };

    const query = buildQuery(params);
    query.query.bool.filter = query.query.bool.filter || [];
    query.query.bool.filter.push(tenantFilter);

    return this.client.search({ index: "products", body: query });
  }
}
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Separate requests for results and facets | Double latency, wasted resources | Return facets alongside results in single response |
| Offset pagination for deep results | OOM errors, degraded performance at page 500+ | Cursor-based pagination with search_after |
| No input sanitization | Elasticsearch DSL injection, cluster abuse | Sanitize query, remove special characters, validate length |
| Facet counts include own filter | Selecting "Sony" shows only "Sony (18)" in brand facet | Disjunctive faceting (exclude own filter from facet aggregation) |
| Autocomplete on every keystroke | Excessive search load, poor UX | Debounce 200-300ms, minimum 2 characters |
| No search analytics | Cannot measure or improve search quality | Log every search + click, track MRR, zero-result rate |
| Returning all fields in results | Wasted bandwidth, slow responses | Use `_source` filtering, return only display fields |
| No caching for popular queries | Same queries hit search cluster repeatedly | Redis cache with 60s TTL for first pages |
| Hardcoded relevance scoring | One-size-fits-all ranking that doesn't fit domain | Tune BM25 params, field boosting, function_score |
| No spell correction | Users with typos get zero results | Phrase suggester, fuzzy matching, "did you mean?" |
| Global search without type filtering | Irrelevant results across unrelated indices | Federated search with per-index boosting and type facets |
| No highlighting in results | Users can't see WHY a result matched | Always return highlighted snippets for text fields |

---

## 12. Enforcement Checklist

- [ ] Search API returns results + facets + pagination in single response
- [ ] Cursor-based pagination implemented (search_after)
- [ ] Query input sanitized (no raw DSL exposure, special chars removed)
- [ ] Autocomplete responds in < 100ms with client-side debounce (200-300ms)
- [ ] Faceted search uses disjunctive faceting (exclude own filter)
- [ ] Highlighted snippets returned for all text match fields
- [ ] Search analytics logging (query, results count, latency, clicks)
- [ ] Zero-result queries tracked and analyzed
- [ ] Spell correction / "did you mean?" for low-result queries
- [ ] Search result caching for popular queries (Redis, 60s TTL)
- [ ] Multi-tenant search isolation enforced at query layer
- [ ] Search quality metrics monitored (MRR, zero-result rate, p95 latency)
- [ ] Sort options include relevance (default), price, date, rating, popularity
- [ ] Source filtering excludes large/unnecessary fields from results
