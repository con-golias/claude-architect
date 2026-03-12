# Elasticsearch & OpenSearch

> **AI Plugin Directive — Elasticsearch Cluster Operations, Index Management & Query Patterns**
> You are an AI coding assistant. When generating, reviewing, or refactoring Elasticsearch or
> OpenSearch code, follow EVERY rule in this document. Misconfigured clusters lose data, misconfigured
> indices cause performance nightmares. Treat each section as non-negotiable.

**Core Rule: ALWAYS define explicit mappings (never rely on dynamic mapping in production). ALWAYS use index aliases for zero-downtime operations. ALWAYS configure replicas for data durability. ALWAYS use bulk API for batch operations. NEVER expose Elasticsearch directly to the internet.**

---

## 1. Elasticsearch Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Elasticsearch Cluster Architecture               │
│                                                               │
│  Cluster: "production-search"                                │
│  ├── Node 1 (Master-eligible + Data)                        │
│  │   ├── Index: articles (Primary Shard 0)                  │
│  │   ├── Index: articles (Replica Shard 1)                  │
│  │   └── Index: logs-2024.03 (Primary Shard 2)             │
│  ├── Node 2 (Master-eligible + Data)                        │
│  │   ├── Index: articles (Primary Shard 1)                  │
│  │   ├── Index: articles (Replica Shard 0)                  │
│  │   └── Index: logs-2024.03 (Primary Shard 0)             │
│  └── Node 3 (Data + Ingest)                                │
│      ├── Index: articles (Primary Shard 2)                  │
│      ├── Index: articles (Replica Shard 2)                  │
│      └── Index: logs-2024.03 (Primary Shard 1)             │
│                                                               │
│  Key Concepts:                                               │
│  ├── Cluster: Collection of nodes                           │
│  ├── Node: Single ES instance (JVM process)                │
│  ├── Index: Logical namespace (like a database table)       │
│  ├── Shard: Physical partition of an index (Lucene index)   │
│  │   ├── Primary: Writes go here first                      │
│  │   └── Replica: Copy for redundancy + read throughput     │
│  ├── Document: Single JSON record (like a row)              │
│  └── Segment: Immutable file within a shard (LSM-tree-like) │
│                                                               │
│  Node Roles:                                                 │
│  ├── master: Cluster state, index creation, shard allocation│
│  ├── data: Stores data, executes queries                    │
│  ├── ingest: Pre-process documents (pipelines)              │
│  ├── coordinating: Routes requests (load balancer)          │
│  └── ml: Machine learning (X-Pack)                          │
│                                                               │
│  Shard Sizing Rules:                                         │
│  ├── Target: 10-50 GB per shard                             │
│  ├── Max shards per node: ~1000                             │
│  ├── Primary shards CANNOT be changed after index creation  │
│  └── Formula: total_data / target_shard_size = num_shards   │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Index Configuration & Mappings

```typescript
import { Client } from "@elastic/elasticsearch";

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  auth: {
    username: process.env.ES_USER || "elastic",
    password: process.env.ES_PASSWORD!,
  },
  maxRetries: 3,
  requestTimeout: 30000,
  sniffOnStart: true,         // Discover other nodes
  sniffOnConnectionFault: true,
});

// Production index creation with explicit mappings
async function createProductIndex(): Promise<void> {
  await client.indices.create({
    index: "products_v1",
    body: {
      settings: {
        number_of_shards: 3,
        number_of_replicas: 1,
        refresh_interval: "1s",          // Near real-time (default)
        "index.max_result_window": 10000, // Max from+size
        analysis: {
          analyzer: {
            product_analyzer: {
              type: "custom",
              tokenizer: "standard",
              filter: [
                "lowercase",
                "english_stop",
                "english_stemmer",
                "asciifolding",
              ],
            },
            autocomplete_analyzer: {
              type: "custom",
              tokenizer: "standard",
              filter: ["lowercase", "edge_ngram_filter"],
            },
            sku_analyzer: {
              type: "custom",
              tokenizer: "keyword",
              filter: ["lowercase", "trim"],
            },
          },
          filter: {
            english_stop: { type: "stop", stopwords: "_english_" },
            english_stemmer: { type: "stemmer", language: "english" },
            edge_ngram_filter: {
              type: "edge_ngram",
              min_gram: 2,
              max_gram: 15,
            },
          },
        },
      },
      mappings: {
        dynamic: "strict",   // REJECT unknown fields (never use "true" in production)
        properties: {
          id: { type: "keyword" },
          name: {
            type: "text",
            analyzer: "product_analyzer",
            fields: {
              keyword: { type: "keyword", ignore_above: 256 },
              autocomplete: {
                type: "text",
                analyzer: "autocomplete_analyzer",
                search_analyzer: "standard",  // DIFFERENT search analyzer for autocomplete
              },
            },
          },
          description: {
            type: "text",
            analyzer: "product_analyzer",
          },
          sku: {
            type: "text",
            analyzer: "sku_analyzer",
            fields: {
              keyword: { type: "keyword" },
            },
          },
          category: { type: "keyword" },
          brand: { type: "keyword" },
          tags: { type: "keyword" },
          price: { type: "scaled_float", scaling_factor: 100 },
          currency: { type: "keyword" },
          in_stock: { type: "boolean" },
          stock_count: { type: "integer" },
          rating: { type: "half_float" },
          review_count: { type: "integer" },
          created_at: {
            type: "date",
            format: "strict_date_optional_time||epoch_millis",
          },
          updated_at: { type: "date" },
          location: { type: "geo_point" },
          attributes: {
            type: "nested",  // For filtered aggregations on key-value pairs
            properties: {
              key: { type: "keyword" },
              value: { type: "keyword" },
            },
          },
          suggest: {
            type: "completion",  // For completion suggester
            analyzer: "simple",
            contexts: [
              { name: "category", type: "category", path: "category" },
            ],
          },
        },
      },
    },
  });

  // Create alias pointing to versioned index
  await client.indices.putAlias({
    index: "products_v1",
    name: "products",
  });
}
```

### Go — Index Setup

```go
func CreateProductIndex(ctx context.Context, client *elasticsearch.Client) error {
    mapping := `{
        "settings": {
            "number_of_shards": 3,
            "number_of_replicas": 1,
            "analysis": {
                "analyzer": {
                    "product_analyzer": {
                        "type": "custom",
                        "tokenizer": "standard",
                        "filter": ["lowercase", "english_stemmer", "asciifolding"]
                    }
                },
                "filter": {
                    "english_stemmer": { "type": "stemmer", "language": "english" }
                }
            }
        },
        "mappings": {
            "dynamic": "strict",
            "properties": {
                "id":          { "type": "keyword" },
                "name":        { "type": "text", "analyzer": "product_analyzer",
                                 "fields": { "keyword": { "type": "keyword" } } },
                "description": { "type": "text", "analyzer": "product_analyzer" },
                "category":    { "type": "keyword" },
                "price":       { "type": "scaled_float", "scaling_factor": 100 },
                "in_stock":    { "type": "boolean" },
                "created_at":  { "type": "date" }
            }
        }
    }`

    res, err := client.Indices.Create(
        "products_v1",
        client.Indices.Create.WithBody(strings.NewReader(mapping)),
        client.Indices.Create.WithContext(ctx),
    )
    if err != nil {
        return fmt.Errorf("create index: %w", err)
    }
    defer res.Body.Close()

    if res.IsError() {
        return fmt.Errorf("create index error: %s", res.String())
    }

    // Create alias
    aliasBody := `{ "actions": [{ "add": { "index": "products_v1", "alias": "products" } }] }`
    res, err = client.Indices.UpdateAliases(strings.NewReader(aliasBody))
    if err != nil {
        return fmt.Errorf("create alias: %w", err)
    }
    defer res.Body.Close()

    return nil
}
```

---

## 3. CRUD Operations & Bulk API

```typescript
class ProductSearchService {
  constructor(private client: Client) {}

  // Single document index
  async indexProduct(product: Product): Promise<void> {
    await this.client.index({
      index: "products",   // Uses alias
      id: product.id,
      body: this.toSearchDocument(product),
      refresh: false,       // NEVER use refresh=true in production (use refresh_interval)
    });
  }

  // Bulk indexing — ALWAYS use for batch operations
  async bulkIndex(products: Product[]): Promise<{ errors: number; indexed: number }> {
    const body = products.flatMap((product) => [
      { index: { _index: "products", _id: product.id } },
      this.toSearchDocument(product),
    ]);

    const result = await this.client.bulk({
      body,
      refresh: false,
      pipeline: "product_enrichment", // Optional ingest pipeline
    });

    // ALWAYS check for individual item errors
    let errors = 0;
    if (result.body.errors) {
      for (const item of result.body.items) {
        if (item.index?.error) {
          logger.error("Bulk index error", {
            id: item.index._id,
            error: item.index.error,
          });
          errors++;
        }
      }
    }

    return { errors, indexed: products.length - errors };
  }

  // Partial update
  async updateProduct(id: string, fields: Partial<Product>): Promise<void> {
    await this.client.update({
      index: "products",
      id,
      body: {
        doc: fields,
        doc_as_upsert: false,  // Don't create if missing
      },
      retry_on_conflict: 3,    // Handle concurrent updates
    });
  }

  // Update by query (batch update)
  async markCategoryOutOfStock(category: string): Promise<void> {
    await this.client.updateByQuery({
      index: "products",
      body: {
        query: { term: { category } },
        script: {
          source: "ctx._source.in_stock = false; ctx._source.updated_at = params.now",
          params: { now: new Date().toISOString() },
        },
      },
      conflicts: "proceed",     // Skip conflicting documents
      refresh: true,             // OK for batch operations
    });
  }

  // Delete
  async deleteProduct(id: string): Promise<void> {
    await this.client.delete({
      index: "products",
      id,
      refresh: false,
    });
  }

  private toSearchDocument(product: Product) {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      category: product.category,
      brand: product.brand,
      tags: product.tags,
      price: product.price,
      currency: product.currency,
      in_stock: product.inStock,
      stock_count: product.stockCount,
      rating: product.rating,
      review_count: product.reviewCount,
      created_at: product.createdAt.toISOString(),
      updated_at: product.updatedAt.toISOString(),
      suggest: {
        input: [product.name, product.brand, product.sku].filter(Boolean),
        contexts: { category: [product.category] },
      },
    };
  }
}
```

---

## 4. Search Queries — Production Patterns

```typescript
class ProductSearchEngine {
  constructor(private client: Client) {}

  async search(params: SearchParams): Promise<SearchResponse> {
    const query = this.buildQuery(params);

    const result = await this.client.search({
      index: "products",
      body: query,
      // Track total hits exactly (default: cap at 10000)
      track_total_hits: true,
    });

    return {
      hits: result.body.hits.hits.map(this.mapHit),
      total: result.body.hits.total.value,
      aggregations: this.mapAggregations(result.body.aggregations),
      took: result.body.took,
    };
  }

  private buildQuery(params: SearchParams) {
    const must: any[] = [];
    const filter: any[] = [];
    const should: any[] = [];

    // Text search with multi-field matching
    if (params.query) {
      must.push({
        multi_match: {
          query: params.query,
          fields: [
            "name^3",
            "name.autocomplete^1",
            "description^1.5",
            "sku^2",
            "brand^2",
            "tags^1.5",
          ],
          type: "best_fields",
          tie_breaker: 0.3,
          fuzziness: "AUTO",
          prefix_length: 2,       // First 2 chars must match exactly (performance)
          minimum_should_match: "75%",
        },
      });
    }

    // Category filter (exact match — use filter context, no scoring)
    if (params.category) {
      filter.push({ term: { category: params.category } });
    }

    // Brand filter (multiple values)
    if (params.brands?.length) {
      filter.push({ terms: { brand: params.brands } });
    }

    // Price range
    if (params.minPrice !== undefined || params.maxPrice !== undefined) {
      const range: Record<string, number> = {};
      if (params.minPrice !== undefined) range.gte = params.minPrice;
      if (params.maxPrice !== undefined) range.lte = params.maxPrice;
      filter.push({ range: { price: range } });
    }

    // In-stock filter
    if (params.inStockOnly) {
      filter.push({ term: { in_stock: true } });
    }

    // Rating filter
    if (params.minRating) {
      filter.push({ range: { rating: { gte: params.minRating } } });
    }

    // Nested attribute filters
    if (params.attributes) {
      for (const [key, values] of Object.entries(params.attributes)) {
        filter.push({
          nested: {
            path: "attributes",
            query: {
              bool: {
                must: [
                  { term: { "attributes.key": key } },
                  { terms: { "attributes.value": values } },
                ],
              },
            },
          },
        });
      }
    }

    // Geo distance filter
    if (params.location) {
      filter.push({
        geo_distance: {
          distance: params.location.radius || "50km",
          location: {
            lat: params.location.lat,
            lon: params.location.lon,
          },
        },
      });
    }

    // Recency boost (should — optional, boosts score)
    should.push({
      range: {
        created_at: { gte: "now-30d", boost: 1.2 },
      },
    });

    // Sort
    const sort = this.buildSort(params.sort);

    // Pagination (use search_after for deep pagination)
    const pagination = params.searchAfter
      ? { search_after: params.searchAfter, size: params.pageSize || 20 }
      : { from: ((params.page || 1) - 1) * (params.pageSize || 20), size: params.pageSize || 20 };

    return {
      query: {
        bool: {
          must: must.length ? must : [{ match_all: {} }],
          filter,
          should,
        },
      },
      sort,
      ...pagination,
      // Highlighting
      highlight: {
        fields: {
          name: { number_of_fragments: 0 },  // Full field highlight
          description: {
            fragment_size: 150,
            number_of_fragments: 3,
            pre_tags: ["<mark>"],
            post_tags: ["</mark>"],
          },
        },
      },
      // Aggregations for faceted search
      aggs: this.buildAggregations(params),
      // Source filtering — don't return large fields
      _source: {
        excludes: ["suggest", "description"],
      },
    };
  }

  private buildSort(sort?: string) {
    switch (sort) {
      case "price_asc": return [{ price: "asc" }, "_score"];
      case "price_desc": return [{ price: "desc" }, "_score"];
      case "newest": return [{ created_at: "desc" }, "_score"];
      case "rating": return [{ rating: "desc" }, { review_count: "desc" }, "_score"];
      case "relevance":
      default: return ["_score", { created_at: "desc" }];
    }
  }

  private buildAggregations(params: SearchParams) {
    return {
      categories: {
        terms: { field: "category", size: 50 },
      },
      brands: {
        terms: { field: "brand", size: 100 },
      },
      price_ranges: {
        range: {
          field: "price",
          ranges: [
            { key: "under_25", to: 25 },
            { key: "25_50", from: 25, to: 50 },
            { key: "50_100", from: 50, to: 100 },
            { key: "100_200", from: 100, to: 200 },
            { key: "over_200", from: 200 },
          ],
        },
      },
      avg_price: { avg: { field: "price" } },
      rating_histogram: {
        histogram: { field: "rating", interval: 1 },
      },
      in_stock_count: {
        filter: { term: { in_stock: true } },
      },
    };
  }

  private mapHit(hit: any) {
    return {
      id: hit._id,
      score: hit._score,
      source: hit._source,
      highlight: hit.highlight,
      sort: hit.sort,  // For search_after pagination
    };
  }

  private mapAggregations(aggs: any) {
    if (!aggs) return {};
    return {
      categories: aggs.categories?.buckets?.map((b: any) => ({
        key: b.key, count: b.doc_count,
      })),
      brands: aggs.brands?.buckets?.map((b: any) => ({
        key: b.key, count: b.doc_count,
      })),
      priceRanges: aggs.price_ranges?.buckets?.map((b: any) => ({
        key: b.key, count: b.doc_count,
      })),
      avgPrice: aggs.avg_price?.value,
      inStockCount: aggs.in_stock_count?.doc_count,
    };
  }
}
```

---

## 5. Aggregations Deep Dive

```typescript
// Aggregation patterns for analytics and faceted navigation

// 1. Metric aggregations
const metricsQuery = {
  size: 0,  // Don't return documents, only aggregations
  aggs: {
    avg_price: { avg: { field: "price" } },
    max_price: { max: { field: "price" } },
    min_price: { min: { field: "price" } },
    total_revenue: { sum: { field: "revenue" } },
    price_stats: { stats: { field: "price" } },         // All stats at once
    price_percentiles: {
      percentiles: { field: "price", percents: [50, 90, 95, 99] },
    },
    unique_brands: { cardinality: { field: "brand", precision_threshold: 100 } },
  },
};

// 2. Bucket aggregations with sub-aggregations
const facetedQuery = {
  size: 0,
  aggs: {
    by_category: {
      terms: {
        field: "category",
        size: 20,
        order: { _count: "desc" },
      },
      aggs: {
        avg_price: { avg: { field: "price" } },
        top_brands: {
          terms: { field: "brand", size: 5 },
        },
        price_range: {
          stats: { field: "price" },
        },
      },
    },
    price_histogram: {
      histogram: {
        field: "price",
        interval: 10,
        min_doc_count: 1,
      },
    },
    date_histogram: {
      date_histogram: {
        field: "created_at",
        calendar_interval: "month",
        format: "yyyy-MM",
      },
      aggs: {
        avg_rating: { avg: { field: "rating" } },
      },
    },
  },
};

// 3. Nested aggregations (for nested document types)
const nestedAggs = {
  size: 0,
  aggs: {
    attributes: {
      nested: { path: "attributes" },
      aggs: {
        attribute_keys: {
          terms: { field: "attributes.key", size: 50 },
          aggs: {
            attribute_values: {
              terms: { field: "attributes.value", size: 50 },
            },
          },
        },
      },
    },
  },
};

// 4. Filtered aggregations (count for specific filter)
const filteredAggs = {
  size: 0,
  aggs: {
    in_stock_products: {
      filter: { term: { in_stock: true } },
      aggs: {
        avg_price: { avg: { field: "price" } },
      },
    },
    premium_products: {
      filter: { range: { price: { gte: 100 } } },
      aggs: {
        by_brand: { terms: { field: "brand", size: 10 } },
      },
    },
  },
};
```

---

## 6. Completion Suggester & Autocomplete

```typescript
// Autocomplete using completion suggester (fastest option)
async function autocomplete(prefix: string, category?: string): Promise<Suggestion[]> {
  const result = await client.search({
    index: "products",
    body: {
      suggest: {
        product_suggest: {
          prefix,
          completion: {
            field: "suggest",
            size: 10,
            skip_duplicates: true,
            fuzzy: {
              fuzziness: "AUTO",
              prefix_length: 2,
            },
            contexts: category
              ? { category: [{ context: category }] }
              : undefined,
          },
        },
      },
    },
  });

  return result.body.suggest.product_suggest[0].options.map((opt: any) => ({
    text: opt.text,
    score: opt._score,
    source: opt._source,
  }));
}

// Search-as-you-type with edge n-grams (more flexible)
async function searchAsYouType(query: string): Promise<SearchResult[]> {
  const result = await client.search({
    index: "products",
    body: {
      query: {
        bool: {
          should: [
            // Exact prefix match (highest priority)
            {
              match_phrase_prefix: {
                "name": { query, max_expansions: 10, boost: 3 },
              },
            },
            // Edge n-gram match on autocomplete field
            {
              match: {
                "name.autocomplete": { query, boost: 2 },
              },
            },
            // Fuzzy match (handles typos)
            {
              match: {
                "name": { query, fuzziness: "AUTO", boost: 1 },
              },
            },
          ],
        },
      },
      size: 10,
      _source: ["id", "name", "category", "brand"],
    },
  });

  return result.body.hits.hits.map((hit: any) => ({
    id: hit._id,
    name: hit._source.name,
    category: hit._source.category,
    score: hit._score,
  }));
}
```

---

## 7. Index Lifecycle Management (ILM)

```json
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_primary_shard_size": "50gb",
            "max_age": "30d",
            "max_docs": 100000000
          },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "30d",
        "actions": {
          "shrink": { "number_of_shards": 1 },
          "forcemerge": { "max_num_segments": 1 },
          "set_priority": { "priority": 50 },
          "allocate": {
            "require": { "data": "warm" }
          }
        }
      },
      "cold": {
        "min_age": "90d",
        "actions": {
          "allocate": {
            "require": { "data": "cold" }
          },
          "set_priority": { "priority": 0 }
        }
      },
      "delete": {
        "min_age": "365d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

### ILM Application

```typescript
// Apply ILM policy to index template
async function setupILM(): Promise<void> {
  // 1. Create ILM policy
  await client.ilm.putLifecycle({
    policy: "logs_policy",
    body: {
      policy: {
        phases: {
          hot: { actions: { rollover: { max_primary_shard_size: "50gb", max_age: "7d" } } },
          warm: { min_age: "30d", actions: { shrink: { number_of_shards: 1 }, forcemerge: { max_num_segments: 1 } } },
          delete: { min_age: "90d", actions: { delete: {} } },
        },
      },
    },
  });

  // 2. Create index template with ILM
  await client.indices.putIndexTemplate({
    name: "logs_template",
    body: {
      index_patterns: ["logs-*"],
      template: {
        settings: {
          number_of_shards: 3,
          number_of_replicas: 1,
          "index.lifecycle.name": "logs_policy",
          "index.lifecycle.rollover_alias": "logs",
        },
      },
    },
  });

  // 3. Bootstrap first index
  await client.indices.create({
    index: "logs-000001",
    body: { aliases: { logs: { is_write_index: true } } },
  });
}
```

---

## 8. Cluster Operations & Monitoring

```typescript
// Health check
async function getClusterHealth(): Promise<ClusterHealth> {
  const health = await client.cluster.health();
  return {
    status: health.body.status,                    // green/yellow/red
    numberOfNodes: health.body.number_of_nodes,
    activeShards: health.body.active_shards,
    relocatingShards: health.body.relocating_shards,
    initializingShards: health.body.initializing_shards,
    unassignedShards: health.body.unassigned_shards,
    pendingTasks: health.body.number_of_pending_tasks,
  };
}

// Node stats for monitoring
async function getNodeStats(): Promise<NodeStats[]> {
  const stats = await client.nodes.stats({
    metric: ["jvm", "os", "fs", "indices", "thread_pool"],
  });

  return Object.entries(stats.body.nodes).map(([id, node]: [string, any]) => ({
    id,
    name: node.name,
    jvmHeapUsedPercent: node.jvm.mem.heap_used_percent,
    jvmGCOldCount: node.jvm.gc.collectors.old.collection_count,
    diskUsedPercent: 100 - (node.fs.total.available_in_bytes / node.fs.total.total_in_bytes * 100),
    searchQueryTotal: node.indices.search.query_total,
    searchQueryTimeMs: node.indices.search.query_time_in_millis,
    indexingTotal: node.indices.indexing.index_total,
    indexingTimeMs: node.indices.indexing.index_time_in_millis,
  }));
}

// Index stats
async function getIndexStats(index: string): Promise<IndexStats> {
  const stats = await client.indices.stats({ index });
  const primary = stats.body._all.primaries;

  return {
    docsCount: primary.docs.count,
    docsDeleted: primary.docs.deleted,
    storeSizeBytes: primary.store.size_in_bytes,
    searchQueryTotal: primary.search.query_total,
    searchQueryTimeMs: primary.search.query_time_in_millis,
    indexingTotal: primary.indexing.index_total,
    indexingTimeMs: primary.indexing.index_time_in_millis,
    refreshTotal: primary.refresh.total,
    mergeTotal: primary.merges.total,
    segmentCount: primary.segments.count,
  };
}
```

### Cluster Health Status Guide

| Status | Meaning | Action |
|--------|---------|--------|
| **Green** | All primary and replica shards assigned | None — healthy |
| **Yellow** | All primaries OK, some replicas unassigned | Add nodes, check disk space |
| **Red** | Some primary shards unassigned | CRITICAL — investigate immediately |

### Key Monitoring Metrics

| Metric | Warning Threshold | Critical Threshold | Fix |
|--------|-------------------|-------------------|-----|
| JVM heap used | > 75% | > 85% | Increase heap (max 31GB), add nodes |
| Disk used | > 80% | > 90% | Add disk, delete old indices, ILM |
| Search latency p95 | > 500ms | > 2s | Optimize queries, add replicas |
| Index latency p95 | > 200ms | > 1s | Reduce refresh interval, bulk API |
| GC old gen count | > 5/min | > 15/min | Tune JVM, reduce heap pressure |
| Pending tasks | > 10 | > 50 | Increase master nodes, reduce load |
| Unassigned shards | > 0 | > 0 (persistent) | Check disk, node health, allocation rules |

---

## 9. Performance Optimization

```
┌──────────────────────────────────────────────────────────────┐
│              Performance Tuning Checklist                     │
│                                                               │
│  Indexing Performance:                                       │
│  ├── Use bulk API (500-5000 docs per request)               │
│  ├── Increase refresh_interval to 30s during bulk load      │
│  ├── Disable replicas during initial load (set to 0)        │
│  ├── Use multiple indexing threads (3-5 per node)           │
│  ├── Pre-create indices before indexing                     │
│  └── Use _routing for co-located data                       │
│                                                               │
│  Query Performance:                                          │
│  ├── Use filter context for non-scoring queries             │
│  ├── Avoid leading wildcards (*pattern)                     │
│  ├── Limit aggregation size (don't use size: 0)             │
│  ├── Use _source filtering (exclude large fields)           │
│  ├── Enable request cache for aggregations                  │
│  ├── Use search_after instead of from+size for deep pages   │
│  ├── Set prefix_length ≥ 2 for fuzzy queries               │
│  └── Profile slow queries with _profile API                │
│                                                               │
│  Cluster Performance:                                        │
│  ├── Heap: 50% of RAM, max 31 GB (compressed oops)         │
│  ├── Disable swapping (bootstrap.memory_lock: true)         │
│  ├── SSD storage for hot nodes                              │
│  ├── Separate master and data nodes (>= 5 node clusters)   │
│  └── OS file descriptor limit: 65535+                       │
└──────────────────────────────────────────────────────────────┘
```

### Query Profiling

```typescript
// Profile a slow query to find bottlenecks
async function profileQuery(query: any): Promise<void> {
  const result = await client.search({
    index: "products",
    body: {
      ...query,
      profile: true,
    },
  });

  for (const shard of result.body.profile.shards) {
    for (const search of shard.searches) {
      for (const queryProfile of search.query) {
        console.log(`Query type: ${queryProfile.type}`);
        console.log(`Time: ${queryProfile.time_in_nanos / 1e6}ms`);
        if (queryProfile.children) {
          for (const child of queryProfile.children) {
            console.log(`  Child: ${child.type} - ${child.time_in_nanos / 1e6}ms`);
          }
        }
      }
    }
  }
}
```

---

## 10. Security Configuration

```yaml
# elasticsearch.yml — production security settings
xpack.security.enabled: true
xpack.security.transport.ssl.enabled: true
xpack.security.transport.ssl.verification_mode: certificate
xpack.security.transport.ssl.keystore.path: elastic-certificates.p12
xpack.security.transport.ssl.truststore.path: elastic-certificates.p12

xpack.security.http.ssl.enabled: true
xpack.security.http.ssl.keystore.path: http.p12

# Network
network.host: 0.0.0.0
http.port: 9200
discovery.seed_hosts: ["node1:9300", "node2:9300", "node3:9300"]
cluster.initial_master_nodes: ["node1", "node2", "node3"]

# Memory
bootstrap.memory_lock: true

# Disable dynamic scripting (security risk)
script.allowed_types: inline
script.allowed_contexts: search, update, ingest
```

### Role-Based Access Control

```typescript
// Create application-specific roles
async function setupRoles(): Promise<void> {
  // Read-only search role
  await client.security.putRole({
    name: "search_reader",
    body: {
      indices: [
        {
          names: ["products", "articles"],
          privileges: ["read"],
          field_security: {
            grant: ["*"],
            except: ["internal_*"],    // Hide internal fields
          },
        },
      ],
    },
  });

  // Indexer role (write, no delete)
  await client.security.putRole({
    name: "content_indexer",
    body: {
      indices: [
        {
          names: ["products", "articles"],
          privileges: ["index", "create_index", "view_index_metadata"],
        },
      ],
    },
  });

  // Admin role
  await client.security.putRole({
    name: "search_admin",
    body: {
      cluster: ["monitor", "manage_index_templates", "manage_ilm"],
      indices: [
        {
          names: ["*"],
          privileges: ["all"],
        },
      ],
    },
  });
}
```

---

## 11. Elasticsearch vs OpenSearch

| Aspect | Elasticsearch | OpenSearch |
|--------|--------------|-----------|
| License | Elastic License 2.0 (not OSS) | Apache 2.0 (fully open source) |
| Origin | Elastic NV (original) | AWS fork (from ES 7.10.2) |
| Managed service | Elastic Cloud | AWS OpenSearch Service |
| API compatibility | Source of truth | Compatible with ES 7.10 API |
| Security plugin | X-Pack (built-in) | Security plugin (free) |
| Alerting | Watcher (paid) | Alerting plugin (free) |
| ML features | X-Pack ML (paid) | Anomaly detection plugin (free) |
| Query DSL | Identical | Identical (fork-compatible) |
| Client libraries | @elastic/elasticsearch | @opensearch-project/opensearch |
| Version scheme | 8.x | 2.x (independently versioned) |

### When to Choose Each

```
Choose Elasticsearch when:
├── Need latest features (ESQL, vector search improvements)
├── Using Elastic Cloud managed service
├── Need official Elastic support
└── Using ELK stack (Logstash, Kibana)

Choose OpenSearch when:
├── Need true open-source license (Apache 2.0)
├── Running on AWS (native integration)
├── Want free security, alerting, ML features
├── Need to avoid vendor lock-in
└── Community governance matters
```

---

## 12. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Dynamic mapping in production | Schema drift, type conflicts, mapping explosions | Set `dynamic: "strict"`, define all fields explicitly |
| No index aliases | Downtime during reindex, migration difficulties | Always use aliases, swap atomically |
| Using `from` + `size` for deep pagination | OOM errors at page 500+, degraded performance | Use `search_after` cursor for deep pagination |
| Single shard for large index | Hot node, no parallelism for queries | 3-5 primary shards, 10-50GB per shard |
| Too many shards (over-sharding) | High overhead per shard, slow cluster state | Fewer, larger shards; target < 1000 per node |
| Using `refresh: true` per document | Extreme I/O, poor indexing throughput | Use `refresh_interval: "1s"` (default), or batch refresh |
| Not using bulk API for batch ops | N individual requests instead of 1 batch | Always use bulk API for > 1 document |
| Exposing ES directly to internet | Security breach, cluster abuse | Reverse proxy, firewall, application layer |
| No monitoring/alerting | Cluster fails silently, data loss | Monitor heap, disk, search latency, unassigned shards |
| Mapping `text` fields as `keyword` | No full-text search capability | Use multi-field mapping (text + keyword subfield) |
| No ILM for time-series data | Disk fills up, old data never deleted | Configure ILM with hot/warm/cold/delete phases |
| Leading wildcard queries | Full index scan, extreme latency | Edge n-gram tokenizer, prefix queries |
| Not setting `max_result_window` | Users can request from=1000000 | Set to 10000, use search_after for deep pages |

---

## 13. Enforcement Checklist

- [ ] Explicit mappings defined for all production indices (dynamic: strict)
- [ ] Index aliases used for all query and write operations
- [ ] Bulk API used for all batch indexing operations
- [ ] Shard sizing: 10-50GB per primary shard, 3-5 primaries for most indices
- [ ] Replicas configured (minimum 1) for data durability
- [ ] ILM policy configured for time-series indices
- [ ] Deep pagination uses search_after (not from+size beyond 10K)
- [ ] Filter context used for non-scoring conditions (exact match, ranges)
- [ ] Elasticsearch NOT directly exposed to internet (behind proxy/firewall)
- [ ] Cluster monitoring configured (heap, disk, latency, unassigned shards)
- [ ] Security enabled (TLS, RBAC, API keys for applications)
- [ ] Autocomplete uses completion suggester or edge n-gram (not prefix query)
- [ ] Slow query logging enabled and monitored
- [ ] Backup/snapshot configured for critical indices
- [ ] JVM heap set to 50% of RAM, max 31GB (compressed oops)
- [ ] Index templates with settings and mappings for repeating indices
