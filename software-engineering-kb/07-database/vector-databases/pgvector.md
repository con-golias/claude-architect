# pgvector — Vector Search in PostgreSQL

> **Domain:** Database > Vector Databases > pgvector
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

pgvector is a PostgreSQL extension that adds vector similarity search capabilities directly to PostgreSQL. Instead of deploying and maintaining a separate vector database (Pinecone, Weaviate, Qdrant), you store vectors alongside your relational data in the same database you already operate. This eliminates data synchronization complexity, reduces infrastructure costs, and lets you combine vector similarity with SQL filtering, JOINs, and transactions in a single query. For most applications with fewer than 10 million vectors, pgvector delivers sufficient performance without the operational overhead of a dedicated vector database.

---

## How It Works

### Architecture

```
pgvector in PostgreSQL:
┌──────────────────────────────────────────────────────┐
│  PostgreSQL                                           │
│                                                        │
│  ┌─────────────────────────────────────────┐          │
│  │  Regular Table                           │          │
│  │                                          │          │
│  │  id | title      | category | embedding  │          │
│  │  ---|------------|----------|----------  │          │
│  │  1  | "MacBook"  | laptops  | [0.1, ...]│          │
│  │  2  | "ThinkPad" | laptops  | [0.2, ...]│          │
│  │  3  | "iPhone"   | phones   | [0.5, ...]│          │
│  │                                          │          │
│  │  Vectors stored as native column type    │          │
│  │  Indexed with HNSW or IVFFlat            │          │
│  │  Queryable with <=> (cosine), <-> (L2)   │          │
│  └─────────────────────────────────────────┘          │
│                                                        │
│  Benefits:                                             │
│  • No separate database to manage                     │
│  • SQL JOINs between vectors and relational data      │
│  • ACID transactions include vector operations         │
│  • All PostgreSQL tooling works (pg_dump, replication) │
│  • Existing connection pooling, monitoring, backups   │
└──────────────────────────────────────────────────────┘
```

### Setup & Basic Operations

```sql
-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create table with vector column
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    embedding vector(1536)  -- OpenAI text-embedding-3-small
);

-- Insert with vector
INSERT INTO documents (title, content, category, embedding)
VALUES (
    'PostgreSQL Tutorial',
    'PostgreSQL is an advanced open-source...',
    'database',
    '[0.12, -0.45, 0.78, ...]'::vector  -- 1536 floats
);

-- Bulk insert from application
-- Use COPY or multi-row INSERT for performance
COPY documents (title, content, category, embedding)
FROM '/path/to/data.csv' WITH (FORMAT csv);
```

### Distance Operators

```sql
-- pgvector distance operators:

-- <-> : L2 (Euclidean) distance
-- <=> : Cosine distance (1 - cosine_similarity)
-- <#> : Negative inner product (for max inner product search)

-- Cosine similarity search (most common for text)
SELECT id, title, 1 - (embedding <=> query_embedding) AS similarity
FROM documents
ORDER BY embedding <=> query_embedding
LIMIT 10;

-- L2 distance search
SELECT id, title, embedding <-> query_embedding AS distance
FROM documents
ORDER BY embedding <-> query_embedding
LIMIT 10;

-- Inner product search (for normalized vectors)
SELECT id, title, (embedding <#> query_embedding) * -1 AS similarity
FROM documents
ORDER BY embedding <#> query_embedding
LIMIT 10;
```

### Indexing

```sql
-- HNSW index (recommended — best recall/speed tradeoff)
CREATE INDEX idx_documents_embedding_hnsw ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- HNSW distance operator classes:
-- vector_cosine_ops  → <=> operator (cosine)
-- vector_l2_ops      → <-> operator (L2)
-- vector_ip_ops      → <#> operator (inner product)

-- IVFFlat index (faster to build, lower recall)
CREATE INDEX idx_documents_embedding_ivf ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
-- lists = sqrt(num_rows) to 4*sqrt(num_rows)

-- Tune HNSW search quality at query time
SET hnsw.ef_search = 100;  -- default 40, higher = better recall
-- Increase for better accuracy, decrease for speed

-- Tune IVFFlat search quality
SET ivfflat.probes = 10;  -- default 1, search more lists
```

#### HNSW vs IVFFlat

| Feature | HNSW | IVFFlat |
|---------|------|---------|
| **Recall** | Excellent (>99%) | Good (~95%) |
| **Query speed** | Excellent | Good |
| **Build time** | Slow | Fast |
| **Memory** | High (graph in memory) | Lower |
| **Updates** | Good (no rebuild) | Poor (rebuild needed) |
| **Best for** | Production, < 5M vectors | Quick prototyping |
| **Recommendation** | **Use this** | Only if build time critical |

---

### Production Queries

```sql
-- Semantic search with metadata filtering
SELECT
    d.id,
    d.title,
    d.category,
    1 - (d.embedding <=> $1::vector) AS similarity
FROM documents d
WHERE d.category = 'database'
  AND d.created_at > now() - interval '30 days'
ORDER BY d.embedding <=> $1::vector
LIMIT 10;

-- Hybrid search: combine vector + full-text
SELECT
    d.id,
    d.title,
    1 - (d.embedding <=> $1::vector) AS vector_score,
    ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $2)) AS text_score,
    -- Combined score (weight vector similarity higher)
    0.7 * (1 - (d.embedding <=> $1::vector)) +
    0.3 * ts_rank(to_tsvector('english', d.content), plainto_tsquery('english', $2)) AS combined_score
FROM documents d
WHERE to_tsvector('english', d.content) @@ plainto_tsquery('english', $2)
ORDER BY combined_score DESC
LIMIT 10;

-- Find similar documents to a given document
SELECT
    b.id,
    b.title,
    1 - (a.embedding <=> b.embedding) AS similarity
FROM documents a
JOIN documents b ON a.id != b.id
WHERE a.id = 123
ORDER BY a.embedding <=> b.embedding
LIMIT 5;

-- RAG: retrieve context for LLM
WITH relevant_chunks AS (
    SELECT content, 1 - (embedding <=> $1::vector) AS similarity
    FROM document_chunks
    WHERE embedding <=> $1::vector < 0.5  -- cosine distance threshold
    ORDER BY embedding <=> $1::vector
    LIMIT 5
)
SELECT string_agg(content, E'\n\n') AS context
FROM relevant_chunks;
```

---

### Application Integration

```typescript
// TypeScript — pgvector with Drizzle ORM
import { pgTable, serial, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Note: as of writing, use raw SQL for vector operations
// Most ORMs don't have native vector support yet

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function semanticSearch(queryEmbedding: number[], limit = 10) {
  const vectorStr = `[${queryEmbedding.join(',')}]`;
  const result = await pool.query(
    `SELECT id, title, content, 1 - (embedding <=> $1::vector) AS similarity
     FROM documents
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [vectorStr, limit]
  );
  return result.rows;
}

async function indexDocument(doc: {
  title: string;
  content: string;
  category: string;
  embedding: number[];
}) {
  const vectorStr = `[${doc.embedding.join(',')}]`;
  await pool.query(
    `INSERT INTO documents (title, content, category, embedding)
     VALUES ($1, $2, $3, $4::vector)`,
    [doc.title, doc.content, doc.category, vectorStr]
  );
}

// Batch upsert with ON CONFLICT
async function upsertDocuments(docs: Array<{
  externalId: string;
  title: string;
  embedding: number[];
}>) {
  const values = docs.map((d, i) => {
    const offset = i * 3;
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}::vector)`;
  }).join(', ');

  const params = docs.flatMap(d => [
    d.externalId,
    d.title,
    `[${d.embedding.join(',')}]`,
  ]);

  await pool.query(
    `INSERT INTO documents (external_id, title, embedding)
     VALUES ${values}
     ON CONFLICT (external_id) DO UPDATE
     SET title = EXCLUDED.title, embedding = EXCLUDED.embedding`,
    params
  );
}
```

```python
# Python — pgvector with SQLAlchemy
from sqlalchemy import create_engine, Column, Integer, String, DateTime, select
from sqlalchemy.orm import declarative_base, Session
from pgvector.sqlalchemy import Vector
import numpy as np

Base = declarative_base()

class Document(Base):
    __tablename__ = 'documents'

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False)
    category = Column(String, nullable=False)
    embedding = Column(Vector(1536))  # pgvector type

engine = create_engine('postgresql://localhost/mydb')

# Semantic search
def search_documents(query_embedding: list[float], limit: int = 10):
    with Session(engine) as session:
        results = session.scalars(
            select(Document)
            .order_by(Document.embedding.cosine_distance(query_embedding))
            .limit(limit)
        ).all()
        return results

# Search with filter
def search_by_category(query_embedding: list[float], category: str, limit: int = 10):
    with Session(engine) as session:
        results = session.scalars(
            select(Document)
            .where(Document.category == category)
            .order_by(Document.embedding.cosine_distance(query_embedding))
            .limit(limit)
        ).all()
        return results
```

```go
// Go — pgvector with pgx
import (
    "context"
    "fmt"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/pgvector/pgvector-go"
)

type Document struct {
    ID         int64
    Title      string
    Content    string
    Similarity float64
}

func SemanticSearch(ctx context.Context, pool *pgxpool.Pool, queryEmbedding []float32, limit int) ([]Document, error) {
    vec := pgvector.NewVector(queryEmbedding)

    rows, err := pool.Query(ctx, `
        SELECT id, title, content, 1 - (embedding <=> $1::vector) AS similarity
        FROM documents
        ORDER BY embedding <=> $1::vector
        LIMIT $2
    `, vec, limit)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var docs []Document
    for rows.Next() {
        var d Document
        if err := rows.Scan(&d.ID, &d.Title, &d.Content, &d.Similarity); err != nil {
            return nil, err
        }
        docs = append(docs, d)
    }
    return docs, nil
}
```

---

### Performance Tuning

```sql
-- Key PostgreSQL settings for pgvector
-- shared_buffers: index must fit in memory for best performance
-- maintenance_work_mem: increase for faster index builds
-- max_parallel_maintenance_workers: parallelize index build

-- Check index size
SELECT pg_size_pretty(pg_relation_size('idx_documents_embedding_hnsw'));

-- Estimate memory for HNSW index
-- ~1KB per vector for HNSW overhead (on top of vector data)
-- 1M vectors × 1536 dims × 4 bytes = ~6 GB vectors
-- + ~1 GB HNSW graph overhead
-- Total: ~7 GB for 1M vectors at 1536 dimensions

-- Reduce dimensions (pgvector 0.7+)
-- Shortening: use first N dimensions of larger embedding
-- OpenAI text-embedding-3 models support this natively
ALTER TABLE documents
ADD COLUMN embedding_short vector(256);

UPDATE documents
SET embedding_short = (embedding::float[])[1:256]::vector(256);

-- Quantization: halfvec for 50% memory reduction (pgvector 0.7+)
ALTER TABLE documents
ADD COLUMN embedding_half halfvec(1536);

-- Partitioning for large datasets
CREATE TABLE documents (
    id BIGSERIAL,
    category TEXT NOT NULL,
    embedding vector(1536),
    PRIMARY KEY (id, category)
) PARTITION BY LIST (category);

CREATE TABLE documents_tech PARTITION OF documents FOR VALUES IN ('technology');
CREATE TABLE documents_science PARTITION OF documents FOR VALUES IN ('science');
-- Each partition gets its own HNSW index
```

---

### pgvector vs Dedicated Vector Databases

| Feature | pgvector | Pinecone / Qdrant / Weaviate |
|---------|----------|------------------------------|
| **Setup** | Add extension to existing PostgreSQL | Separate service |
| **SQL JOINs** | Full PostgreSQL SQL | None |
| **Transactions** | ACID | None |
| **Metadata filtering** | Full SQL WHERE | Limited filter syntax |
| **Scale** | < 10M vectors (practical) | Billions |
| **Managed options** | Supabase, Neon, RDS | Pinecone, Qdrant Cloud |
| **Backup/recovery** | pg_dump, PITR | Vendor-specific |
| **Hybrid search** | tsvector + pgvector in one query | Depends on vendor |
| **Learning curve** | None (if you know PostgreSQL) | New API to learn |
| **Cost** | Part of existing PostgreSQL | Additional service cost |
| **Best for** | < 10M vectors, existing PostgreSQL | > 10M vectors, vector-first apps |

---

## Best Practices

1. **ALWAYS use pgvector first** if you already run PostgreSQL — simplest path to vector search
2. **ALWAYS use HNSW indexes** over IVFFlat — better recall, handles updates
3. **ALWAYS set hnsw.ef_search** appropriately — default (40) is conservative, try 100-200
4. **ALWAYS pre-filter with SQL WHERE** before vector search — reduces comparison set
5. **ALWAYS store vectors in the same table** as related data — enables efficient JOINs
6. **ALWAYS use parameterized queries** for vector values — prevent injection
7. **NEVER store > 10M vectors** without evaluating dedicated vector DB — pgvector has limits
8. **NEVER build HNSW index on empty table** — add data first, then create index
9. **NEVER forget to VACUUM** after large batch inserts — index quality degrades without it
10. **NEVER use IVFFlat for frequently updated data** — requires periodic reindexing

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| No index on vector column | Full table scan, O(n) per query | Create HNSW index |
| IVFFlat with frequent updates | Degrading recall over time | Use HNSW instead |
| Building index on empty table | Poor quality index | Load data first, then CREATE INDEX |
| Default ef_search (40) | Missing relevant results | Increase to 100-200 for production |
| Mixing embedding models | Inconsistent search results | One model per vector column |
| Not filtering before vector search | Slow queries, irrelevant results | Use WHERE clauses to narrow scope |
| Storing huge vectors unnecessarily | Excessive storage, slow queries | Use dimensionality reduction or halfvec |
| No VACUUM after bulk insert | Index quality degrades | Run VACUUM after large inserts |
| Using pgvector as a vector-only DB | Missing the main benefit | Leverage SQL JOINs with relational data |

---

## Real-world Examples

### Supabase
- pgvector as default vector search for all Supabase projects
- Built-in AI integration with Edge Functions for embedding generation

### Neon
- Serverless PostgreSQL with pgvector for AI applications
- Autoscaling vector search workloads

### Retool
- Internal tool builder using pgvector for semantic search over company knowledge
- Combines vector search with existing PostgreSQL business data

---

## Enforcement Checklist

- [ ] pgvector extension installed (`CREATE EXTENSION vector`)
- [ ] Vector column dimension matches embedding model output
- [ ] HNSW index created (not IVFFlat for production)
- [ ] hnsw.ef_search tuned for recall requirements
- [ ] Distance operator matches use case (`<=>` for text, `<->` for images)
- [ ] SQL WHERE pre-filtering used to narrow search scope
- [ ] Bulk inserts followed by VACUUM
- [ ] Index memory usage estimated and fits in shared_buffers
- [ ] Same embedding model used for indexing and querying
- [ ] Recall@k measured with test queries
