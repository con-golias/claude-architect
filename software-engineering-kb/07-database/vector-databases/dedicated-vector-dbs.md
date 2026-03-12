# Dedicated Vector Databases

> **Domain:** Database > Vector Databases > Dedicated Solutions
> **Difficulty:** Advanced
> **Last Updated:** —

## Why It Matters

When vector search is the primary access pattern and scale exceeds what pgvector can handle (10M+ vectors, sub-10ms latency at scale, billion-vector datasets), dedicated vector databases provide purpose-built infrastructure. Pinecone, Qdrant, Weaviate, Milvus, and Chroma each optimize differently for the vector search workload — from fully managed serverless (Pinecone) to self-hosted with full control (Qdrant, Milvus). Understanding their architectures, API patterns, and tradeoffs determines whether your AI application can scale from prototype to production.

---

## How It Works

### Architecture Comparison

```
Dedicated Vector DB Architecture:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Application                                           │
│  ┌──────────┐                                         │
│  │ API Call  │ embed("query") → [0.1, 0.2, ...]      │
│  └─────┬────┘                                         │
│        │                                               │
│        ▼                                               │
│  ┌──────────────────┐                                 │
│  │  Vector Database  │                                 │
│  │                    │                                 │
│  │  ┌──────────────┐ │                                 │
│  │  │ Index Layer  │ │ HNSW, IVF, DiskANN             │
│  │  │              │ │ Quantization (PQ, SQ)           │
│  │  └──────┬───────┘ │                                 │
│  │         │          │                                 │
│  │  ┌──────▼───────┐ │                                 │
│  │  │ Storage Layer│ │ Vectors + Metadata               │
│  │  │              │ │ Sharded across nodes             │
│  │  └──────┬───────┘ │                                 │
│  │         │          │                                 │
│  │  ┌──────▼───────┐ │                                 │
│  │  │ Filter Layer │ │ Pre/post filtering on metadata  │
│  │  │              │ │ Tag-based, range, geo            │
│  │  └──────────────┘ │                                 │
│  └──────────────────┘                                 │
│                                                        │
│  vs pgvector:                                          │
│  • Purpose-built = optimized memory layout, SIMD ops  │
│  • Horizontal scaling across nodes                    │
│  • Billions of vectors                                │
│  • Sub-10ms at any scale                              │
│  • No SQL JOINs (tradeoff)                            │
└──────────────────────────────────────────────────────┘
```

---

### Pinecone

```
Pinecone: Fully managed, serverless vector database
No infrastructure to manage, auto-scales, pay per query

Architecture:
  • Serverless or pod-based deployment
  • Indexes: one per use case (e.g., "products", "docs")
  • Namespaces: logical partitions within an index
  • Metadata filtering: built-in, indexed
```

```typescript
// TypeScript — Pinecone
import { Pinecone } from '@pinecone-database/pinecone';

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index('products');

// Upsert vectors
await index.namespace('electronics').upsert([
  {
    id: 'prod-001',
    values: [0.12, -0.45, 0.78, /* ... 1536 floats */],
    metadata: {
      title: 'MacBook Pro',
      category: 'laptops',
      price: 1999,
      inStock: true,
    },
  },
  {
    id: 'prod-002',
    values: [0.15, -0.42, 0.75, /* ... */],
    metadata: {
      title: 'ThinkPad X1',
      category: 'laptops',
      price: 1299,
      inStock: true,
    },
  },
]);

// Query with metadata filter
const results = await index.namespace('electronics').query({
  vector: queryEmbedding,
  topK: 10,
  filter: {
    category: { $eq: 'laptops' },
    price: { $lt: 2000 },
    inStock: { $eq: true },
  },
  includeMetadata: true,
});

// Results
for (const match of results.matches!) {
  console.log(`${match.id}: ${match.metadata?.title} (score: ${match.score})`);
}

// Delete vectors
await index.namespace('electronics').deleteMany(['prod-001', 'prod-002']);

// Delete by metadata filter
await index.namespace('electronics').deleteMany({
  filter: { category: { $eq: 'discontinued' } },
});
```

---

### Qdrant

```
Qdrant: Open-source, high-performance vector database (Rust)
Self-hosted or Qdrant Cloud, gRPC + REST API

Features:
  • Rust-native (fast, low memory)
  • Payload (metadata) indexing with complex filters
  • Quantization (scalar, product, binary)
  • Distributed mode with sharding
  • Snapshot backups
  • Multi-vector support (sparse + dense)
```

```typescript
// TypeScript — Qdrant
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({ url: 'http://localhost:6333' });

// Create collection
await client.createCollection('products', {
  vectors: {
    size: 1536,
    distance: 'Cosine',
  },
  optimizers_config: {
    indexing_threshold: 20000, // build HNSW after this many points
  },
  quantization_config: {
    scalar: {
      type: 'int8',       // 4x memory reduction
      quantile: 0.99,
      always_ram: true,
    },
  },
});

// Create payload index for filtering
await client.createPayloadIndex('products', {
  field_name: 'category',
  field_schema: 'keyword',
});
await client.createPayloadIndex('products', {
  field_name: 'price',
  field_schema: 'float',
});

// Upsert points
await client.upsert('products', {
  wait: true,
  points: [
    {
      id: 'prod-001',
      vector: [0.12, -0.45, 0.78 /* ... */],
      payload: {
        title: 'MacBook Pro',
        category: 'laptops',
        price: 1999,
        tags: ['apple', 'premium'],
      },
    },
  ],
});

// Search with filters
const results = await client.search('products', {
  vector: queryEmbedding,
  limit: 10,
  filter: {
    must: [
      { key: 'category', match: { value: 'laptops' } },
      { key: 'price', range: { lt: 2000 } },
    ],
  },
  with_payload: true,
  score_threshold: 0.7, // minimum similarity
});

// Recommendation: find similar to given points
const recs = await client.recommend('products', {
  positive: ['prod-001', 'prod-003'],  // like these
  negative: ['prod-005'],               // not like this
  limit: 10,
  filter: { must: [{ key: 'category', match: { value: 'laptops' } }] },
});
```

```python
# Python — Qdrant
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    Filter, FieldCondition, MatchValue, Range,
)

client = QdrantClient(url="http://localhost:6333")

# Create collection
client.create_collection(
    collection_name="products",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

# Upsert
client.upsert(
    collection_name="products",
    points=[
        PointStruct(
            id="prod-001",
            vector=[0.12, -0.45, 0.78],  # truncated
            payload={"title": "MacBook Pro", "category": "laptops", "price": 1999},
        ),
    ],
)

# Search with filter
results = client.search(
    collection_name="products",
    query_vector=query_embedding,
    limit=10,
    query_filter=Filter(
        must=[
            FieldCondition(key="category", match=MatchValue(value="laptops")),
            FieldCondition(key="price", range=Range(lt=2000)),
        ]
    ),
)
```

---

### Weaviate

```
Weaviate: Open-source, AI-native vector database (Go)
Built-in vectorization (auto-embed with OpenAI, Cohere, etc.)

Unique features:
  • Module system: text2vec-openai, generative-openai, etc.
  • GraphQL API
  • Hybrid search (BM25 + vector, combined scoring)
  • Multi-tenancy built-in
  • Built-in reranking
```

```typescript
// TypeScript — Weaviate v3
import weaviate, { WeaviateClient } from 'weaviate-client';

const client: WeaviateClient = await weaviate.connectToLocal();

// Create collection with built-in vectorizer
const collection = await client.collections.create({
  name: 'Product',
  vectorizers: weaviate.configure.vectorizer.text2VecOpenAI({
    model: 'text-embedding-3-small',
  }),
  properties: [
    { name: 'title', dataType: 'text' },
    { name: 'description', dataType: 'text' },
    { name: 'category', dataType: 'text' },
    { name: 'price', dataType: 'number' },
  ],
});

// Insert (Weaviate auto-generates embeddings!)
const products = client.collections.get('Product');

await products.data.insertMany([
  {
    properties: {
      title: 'MacBook Pro',
      description: 'Powerful laptop for professionals',
      category: 'laptops',
      price: 1999,
    },
    // No embedding needed — Weaviate calls OpenAI automatically
  },
]);

// Semantic search (nearText — auto-embeds the query)
const results = await products.query.nearText('powerful laptop for coding', {
  limit: 10,
  filters: products.filter.byProperty('category').equal('laptops'),
  returnProperties: ['title', 'description', 'price'],
  returnMetadata: ['distance'],
});

// Hybrid search (BM25 + vector, combined)
const hybridResults = await products.query.hybrid('MacBook laptop', {
  limit: 10,
  alpha: 0.75,  // 0 = pure BM25, 1 = pure vector
  returnProperties: ['title', 'description', 'price'],
});

// Generative search (RAG built-in)
const ragResults = await products.generate.nearText(
  'budget laptop for students',
  {
    groupedTask: 'Summarize these products and recommend the best one for a student.',
  },
  { limit: 5, returnProperties: ['title', 'description', 'price'] }
);
console.log(ragResults.generated); // LLM-generated summary
```

---

### Milvus

```
Milvus: Open-source, cloud-native, highly scalable (Go + C++)
Designed for billion-scale vector search

Architecture:
  • Disaggregated storage and compute
  • Multiple index types: HNSW, IVF, DiskANN, GPU indexes
  • Streaming + batch data paths
  • Managed: Zilliz Cloud
```

```python
# Python — Milvus (pymilvus)
from pymilvus import (
    connections, Collection, FieldSchema, CollectionSchema,
    DataType, utility,
)

# Connect
connections.connect("default", host="localhost", port="19530")

# Define schema
fields = [
    FieldSchema(name="id", dtype=DataType.INT64, is_primary=True, auto_id=True),
    FieldSchema(name="title", dtype=DataType.VARCHAR, max_length=256),
    FieldSchema(name="category", dtype=DataType.VARCHAR, max_length=64),
    FieldSchema(name="embedding", dtype=DataType.FLOAT_VECTOR, dim=1536),
]
schema = CollectionSchema(fields, description="Product vectors")
collection = Collection("products", schema)

# Insert data
import numpy as np

data = [
    ["MacBook Pro", "ThinkPad X1", "iPhone 15"],
    ["laptops", "laptops", "phones"],
    np.random.rand(3, 1536).tolist(),  # embeddings
]
collection.insert(data)

# Create HNSW index
index_params = {
    "metric_type": "COSINE",
    "index_type": "HNSW",
    "params": {"M": 16, "efConstruction": 256},
}
collection.create_index("embedding", index_params)

# Load into memory
collection.load()

# Search
search_params = {"metric_type": "COSINE", "params": {"ef": 128}}
results = collection.search(
    data=[query_embedding],
    anns_field="embedding",
    param=search_params,
    limit=10,
    expr='category == "laptops"',
    output_fields=["title", "category"],
)

for hits in results:
    for hit in hits:
        print(f"{hit.entity.get('title')}: {hit.distance}")
```

---

### Chroma

```
Chroma: Lightweight, developer-friendly vector database
Best for: prototyping, small-scale RAG, local development

Features:
  • In-memory or persistent (SQLite + DuckDB)
  • Built-in embedding functions
  • Python-first API
  • No infrastructure needed (pip install chromadb)
```

```python
# Python — Chroma (simplest vector DB)
import chromadb

# In-memory (for development)
client = chromadb.Client()

# Persistent (for production-like)
client = chromadb.PersistentClient(path="/path/to/chroma/data")

# Create collection (auto-embeds with default model)
collection = client.create_collection(
    name="documents",
    metadata={"hnsw:space": "cosine"},
)

# Add documents (Chroma auto-generates embeddings!)
collection.add(
    ids=["doc1", "doc2", "doc3"],
    documents=[
        "PostgreSQL is an advanced database",
        "MongoDB is a document database",
        "Redis is an in-memory store",
    ],
    metadatas=[
        {"category": "relational"},
        {"category": "nosql"},
        {"category": "cache"},
    ],
)

# Query by text (auto-embeds the query)
results = collection.query(
    query_texts=["which database should I use for transactions?"],
    n_results=5,
    where={"category": "relational"},
)

# Query by embedding
results = collection.query(
    query_embeddings=[query_embedding],
    n_results=5,
)

# Update
collection.update(
    ids=["doc1"],
    documents=["PostgreSQL is the world's most advanced open-source database"],
)

# Delete
collection.delete(ids=["doc3"])
```

---

### Comprehensive Comparison

| Feature | Pinecone | Qdrant | Weaviate | Milvus | Chroma | pgvector |
|---------|----------|--------|----------|--------|--------|----------|
| **Language** | Proprietary | Rust | Go | Go/C++ | Python | C (PG ext) |
| **License** | Proprietary | Apache 2.0 | BSD-3 | Apache 2.0 | Apache 2.0 | PostgreSQL |
| **Hosting** | Managed only | Self/Cloud | Self/Cloud | Self/Zilliz | Self-hosted | PostgreSQL |
| **Max vectors** | Billions | Billions | Billions | Billions | Millions | ~10M |
| **Auto-embed** | No | No | Yes (modules) | No | Yes | No |
| **Hybrid search** | No | Sparse+Dense | BM25+vector | Sparse+Dense | No | tsvector+vector |
| **Filtering** | Metadata | Payload | GraphQL | Expression | Where | SQL WHERE |
| **Multi-tenancy** | Namespaces | Collections | Built-in | Partitions | Collections | Schemas/tables |
| **GPU support** | N/A | No | No | Yes | No | No |
| **SQL JOINs** | No | No | No | No | No | Yes |
| **Best for** | Zero-ops, scale | Self-hosted perf | AI-native, RAG | Billion-scale | Prototyping | Existing PG |

---

### Decision Framework

```
Which vector database?
┌─────────────────────────────────────────────────┐
│                                                   │
│  Already running PostgreSQL?                      │
│  ├── YES, < 10M vectors → pgvector              │
│  └── NO or > 10M vectors                         │
│      │                                             │
│      Need zero infrastructure management?         │
│      ├── YES → Pinecone (serverless)              │
│      └── NO (can self-host)                        │
│          │                                          │
│          Scale: how many vectors?                   │
│          ├── < 1M (prototyping) → Chroma           │
│          ├── 1M-100M → Qdrant or Weaviate          │
│          └── 100M+ → Milvus or Pinecone            │
│              │                                      │
│              Need built-in embeddings?              │
│              ├── YES → Weaviate (auto-vectorize)   │
│              └── NO → Qdrant (best perf/control)   │
└─────────────────────────────────────────────────┘
```

---

## Best Practices

1. **ALWAYS start with pgvector** if you already use PostgreSQL and have < 10M vectors
2. **ALWAYS use Chroma for prototyping** — zero setup, switch to production DB later
3. **ALWAYS use metadata filtering** — pre-filter narrows search space, improves speed and relevance
4. **ALWAYS batch upserts** — single-document inserts are inefficient at scale
5. **ALWAYS implement idempotent upserts** — use stable IDs to prevent duplicates
6. **ALWAYS use namespaces/collections** to separate different data types — never mix in one index
7. **NEVER choose a vector DB based on benchmarks alone** — real workloads differ from synthetic
8. **NEVER store derived data only in vector DB** — keep source data in primary database
9. **NEVER skip metadata indexing** — unindexed metadata filters cause full scans
10. **NEVER use Chroma for production** at scale — designed for development and prototyping

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Using dedicated vector DB for < 1M vectors | Over-engineered, extra infrastructure | Use pgvector |
| Chroma in production at scale | Performance issues, no HA | Migrate to Qdrant, Weaviate, or Pinecone |
| No metadata indexing | Slow filtered queries | Create indexes on filtered fields |
| Storing only vectors (no metadata) | Cannot filter, cannot reconstruct context | Store metadata alongside vectors |
| Single-document inserts at scale | Slow ingestion, high API cost | Batch upserts (100-1000 per call) |
| Using vector DB as primary data store | Data loss risk, no ACID | Source of truth in PostgreSQL/MongoDB |
| Not implementing deletion | Stale/deleted content still returned | Sync deletions from primary DB |
| Ignoring embedding model updates | Old embeddings incompatible with new model | Re-embed all data when changing models |
| No backup strategy | Data loss on failure | Configure snapshots/backups |
| Vendor lock-in without abstraction | Cannot migrate between vector DBs | Abstract vector DB behind interface |

---

## Real-world Examples

### Notion (Pinecone)
- Semantic search across all user documents
- "Find similar" feature using vector similarity

### Shopify (Qdrant)
- Product search and recommendation
- Semantic matching of customer queries to products

### GitHub Copilot (vector search)
- Code completion using vector similarity over code embeddings
- Retrieves relevant code snippets for context

### LangChain / LlamaIndex ecosystem
- Framework integrations with all major vector databases
- Abstraction layer for switching between vector DB backends

---

## Enforcement Checklist

- [ ] Vector database choice justified (pgvector first, dedicated only if needed)
- [ ] Embedding model and dimensions documented
- [ ] Distance metric configured (cosine for text, L2 for images)
- [ ] Metadata schema defined with indexed filterable fields
- [ ] Batch upsert implemented (not single-document inserts)
- [ ] Deletion sync from primary database implemented
- [ ] Backup/snapshot strategy configured
- [ ] Idempotent upserts using stable IDs
- [ ] Recall@k evaluated with representative queries
- [ ] Abstraction layer in place (prevent vendor lock-in)
- [ ] Scaling plan documented (when to upgrade from pgvector)
