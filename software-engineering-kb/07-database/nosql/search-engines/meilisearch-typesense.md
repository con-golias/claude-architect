# Meilisearch & Typesense

> **Domain:** Database > NoSQL > Search Engines
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Meilisearch and Typesense are modern, lightweight search engines designed as developer-friendly alternatives to Elasticsearch. While Elasticsearch excels at log analytics and complex aggregations at massive scale, Meilisearch and Typesense focus on instant search experiences — sub-50ms typo-tolerant search with zero configuration. They are ideal for product catalogs, documentation search, and autocomplete. No JVM, no cluster management, no mapping configuration — just index data and search.

---

## How It Works

### Meilisearch vs Typesense vs Elasticsearch

| Feature | Meilisearch | Typesense | Elasticsearch |
|---------|-------------|-----------|---------------|
| **Language** | Rust | C++ | Java (Lucene) |
| **Setup** | Single binary | Single binary | JVM + config |
| **Typo tolerance** | Built-in | Built-in | Manual config |
| **Latency** | < 50ms | < 50ms | 50-200ms |
| **Relevance** | Automatic ranking | Automatic ranking | Manual tuning |
| **Faceted search** | Built-in | Built-in | Aggregations |
| **Geo search** | Built-in | Built-in | Built-in |
| **Scale** | Single node (< 100M docs) | Cluster (billions) | Cluster (billions) |
| **Analytics** | No | Basic | Full (Kibana) |
| **Learning curve** | Minutes | Minutes | Days/weeks |
| **Best for** | Product search, docs | Product search, docs | Logs, analytics, complex |

---

### Meilisearch

```bash
# Start (single binary, no config)
meilisearch --master-key="your-master-key"

# Or Docker
docker run -p 7700:7700 getmeili/meilisearch:latest \
  --master-key="your-master-key"
```

```typescript
// TypeScript — Meilisearch SDK
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: 'http://localhost:7700',
  apiKey: 'your-master-key',
});

// Create index and add documents
const index = client.index('products');
await index.addDocuments([
  { id: 1, name: 'MacBook Pro', category: 'Laptops', price: 1999, brand: 'Apple' },
  { id: 2, name: 'ThinkPad X1', category: 'Laptops', price: 1299, brand: 'Lenovo' },
  { id: 3, name: 'iPhone 15', category: 'Phones', price: 999, brand: 'Apple' },
]);

// Configure searchable/filterable attributes
await index.updateSettings({
  searchableAttributes: ['name', 'brand', 'category'],
  filterableAttributes: ['category', 'brand', 'price'],
  sortableAttributes: ['price', 'name'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
});

// Search with typo tolerance (automatic)
const results = await index.search('macbok pro', {  // typo: "macbok"
  filter: 'category = "Laptops" AND price < 2000',
  sort: ['price:asc'],
  limit: 10,
  attributesToHighlight: ['name'],
});
// Returns MacBook Pro despite typo
```

---

### Typesense

```bash
# Start
typesense-server --data-dir=/data --api-key=your-api-key

# Docker
docker run -p 8108:8108 typesense/typesense:latest \
  --data-dir /data --api-key=your-api-key
```

```typescript
// TypeScript — Typesense SDK
import Typesense from 'typesense';

const client = new Typesense.Client({
  nodes: [{ host: 'localhost', port: 8108, protocol: 'http' }],
  apiKey: 'your-api-key',
});

// Create collection with schema (required — not schemaless)
await client.collections().create({
  name: 'products',
  fields: [
    { name: 'name', type: 'string' },
    { name: 'category', type: 'string', facet: true },
    { name: 'brand', type: 'string', facet: true },
    { name: 'price', type: 'float', facet: true },
    { name: 'rating', type: 'float', optional: true },
    { name: 'location', type: 'geopoint', optional: true },
  ],
  default_sorting_field: 'rating',
});

// Index documents
await client.collections('products').documents().import(documents);

// Search
const results = await client.collections('products')
  .documents()
  .search({
    q: 'macbok',                    // typo-tolerant
    query_by: 'name,brand',
    filter_by: 'category:=Laptops && price:<2000',
    sort_by: 'price:asc',
    facet_by: 'category,brand',
    per_page: 10,
    highlight_full_fields: 'name',
  });
```

**Typesense unique features:**
- **Clustering** — built-in Raft-based replication (Meilisearch is single-node)
- **Conversational search** — built-in RAG with LLM integration
- **Embedding generation** — automatic vector search from text
- **Scoped API keys** — per-user search with built-in filtering
- **Analytics** — search analytics dashboard

---

### When to Choose Each

```
Need search for < 10M documents?
├── Simple product/docs search → Meilisearch (easiest setup)
├── Need clustering/HA → Typesense
├── Need analytics on search → Typesense
└── Complex aggregations, logs → Elasticsearch

Need search for > 100M documents?
├── Log analytics → Elasticsearch
├── Product search → Typesense (clustered)
└── Complex search + analytics → Elasticsearch
```

---

## Best Practices

1. **ALWAYS use Meilisearch or Typesense for product/docs search** — 10x easier than Elasticsearch
2. **ALWAYS configure filterableAttributes/facets** — not all fields should be filterable
3. **ALWAYS use Typesense for production HA** — built-in clustering (Meilisearch is single-node)
4. **ALWAYS use scoped API keys** — never expose master key to clients
5. **ALWAYS batch document imports** — single requests for bulk indexing
6. **NEVER use Meilisearch/Typesense for log analytics** — use Elasticsearch or Loki
7. **NEVER expose search engines directly to public internet** — use API gateway
8. **ALWAYS sync from primary database** — search engine is a secondary read store

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Elasticsearch for simple product search | Over-engineered, complex setup | Use Meilisearch or Typesense |
| Exposing master API key | Anyone can modify index | Use scoped search-only keys |
| Not configuring filterable attributes | Filter queries fail | Define filterable fields explicitly |
| Using search engine as primary DB | Data loss, no ACID | Sync from PostgreSQL/MongoDB |
| Single-node Meilisearch in production | No HA, single point of failure | Use Typesense cluster or add redundancy |

---

## Real-world Examples

### Meilisearch
- Louis Vuitton product search (luxury e-commerce)
- Laravel Scout integration (default search backend)
- Documentation search for open-source projects

### Typesense
- E-commerce product search (thousands of merchants)
- Recipe search (millions of recipes, faceted by ingredients)
- SaaS documentation search with multi-tenant scoping

---

## Enforcement Checklist

- [ ] Meilisearch/Typesense chosen for product/docs search (not Elasticsearch)
- [ ] Filterable and sortable attributes configured
- [ ] Scoped API keys used for client-side search
- [ ] Data synced from primary database (not used as primary store)
- [ ] Typesense used for production HA requirements
- [ ] Batch imports used for bulk indexing
- [ ] Search engine not exposed directly to public internet
