# Full-Text Search Fundamentals

> **AI Plugin Directive — Full-Text Search Architecture, Indexing & Relevance**
> You are an AI coding assistant. When generating, reviewing, or refactoring full-text search
> implementations, follow EVERY rule in this document. Search is the most complex data retrieval
> pattern — naive implementations produce irrelevant results and poor performance. Treat each
> section as non-negotiable.

**Core Rule: ALWAYS use an inverted index for full-text search (never scan raw text). ALWAYS configure analyzers appropriate to the language and domain. ALWAYS implement relevance scoring (BM25 or TF-IDF). ALWAYS separate search indices from primary data stores. NEVER expose raw search engine queries to end users.**

---

## 1. Inverted Index Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Inverted Index Structure                          │
│                                                               │
│  Document 1: "The quick brown fox jumps"                     │
│  Document 2: "The brown dog sleeps"                          │
│  Document 3: "Quick foxes are clever"                        │
│                                                               │
│  Forward Index (what you store):                             │
│  ├── Doc1 → [the, quick, brown, fox, jumps]                 │
│  ├── Doc2 → [the, brown, dog, sleeps]                       │
│  └── Doc3 → [quick, foxes, are, clever]                     │
│                                                               │
│  Inverted Index (what search uses):                          │
│  ├── brown  → [Doc1, Doc2]                                  │
│  ├── quick  → [Doc1, Doc3]                                  │
│  ├── fox    → [Doc1, Doc3]  (after stemming: foxes→fox)     │
│  ├── the    → [Doc1, Doc2]  (removed by stop words)         │
│  ├── jumps  → [Doc1]        (stored as "jump" after stem)   │
│  ├── dog    → [Doc2]                                        │
│  ├── clever → [Doc3]                                        │
│  └── sleep  → [Doc2]        (sleeps→sleep after stem)       │
│                                                               │
│  Each term maps to:                                          │
│  ├── Document IDs (posting list)                             │
│  ├── Term frequency (TF) in each doc                        │
│  ├── Field positions (for phrase queries)                    │
│  └── Field norms (document length normalization)            │
│                                                               │
│  Query "brown fox" →                                         │
│  ├── Lookup "brown" → [Doc1, Doc2]                          │
│  ├── Lookup "fox"   → [Doc1, Doc3]                          │
│  ├── Intersect (AND) → [Doc1]                               │
│  └── Union (OR)      → [Doc1, Doc2, Doc3]                   │
│       scored by relevance                                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Analysis Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│              Text Analysis Pipeline                           │
│                                                               │
│  Raw Text: "The Quick Brown Fox's Jumps!"                   │
│       │                                                      │
│       ▼                                                      │
│  Character Filters (pre-tokenization):                      │
│  ├── HTML stripping: <b>text</b> → text                    │
│  ├── Mapping: & → and, © → (c)                             │
│  └── Pattern replace: [^a-zA-Z0-9] → space                 │
│       │                                                      │
│       ▼                                                      │
│  Tokenizer (split into tokens):                             │
│  ├── Standard: ["The", "Quick", "Brown", "Fox's", "Jumps"] │
│  ├── Whitespace: ["The", "Quick", "Brown", "Fox's", "Jumps!"]│
│  ├── Letter: ["The", "Quick", "Brown", "Fox", "s", "Jumps"]│
│  └── N-gram(3): ["The", "he ", "e Q", " Qu", "Qui", ...]  │
│       │                                                      │
│       ▼                                                      │
│  Token Filters (post-tokenization):                         │
│  ├── Lowercase: [the, quick, brown, fox's, jumps]           │
│  ├── Stop words: [quick, brown, fox's, jumps]               │
│  ├── Stemmer: [quick, brown, fox, jump]                     │
│  ├── Synonyms: [quick/fast, brown, fox, jump/leap]          │
│  └── ASCII folding: café → cafe, über → uber               │
│       │                                                      │
│       ▼                                                      │
│  Indexed Terms: [quick, fast, brown, fox, jump, leap]       │
│                                                               │
│  RULE: ALWAYS apply the SAME analyzer at index time         │
│  and query time. Mismatch = zero results.                   │
└──────────────────────────────────────────────────────────────┘
```

### Custom Analyzer Configuration (Elasticsearch)

```json
{
  "settings": {
    "analysis": {
      "char_filter": {
        "html_strip": { "type": "html_strip" }
      },
      "tokenizer": {
        "standard": { "type": "standard" }
      },
      "filter": {
        "english_stop": {
          "type": "stop",
          "stopwords": "_english_"
        },
        "english_stemmer": {
          "type": "stemmer",
          "language": "english"
        },
        "english_possessive": {
          "type": "stemmer",
          "language": "possessive_english"
        },
        "synonym_filter": {
          "type": "synonym",
          "synonyms": [
            "quick,fast,speedy",
            "big,large,huge"
          ]
        }
      },
      "analyzer": {
        "english_custom": {
          "type": "custom",
          "char_filter": ["html_strip"],
          "tokenizer": "standard",
          "filter": [
            "english_possessive",
            "lowercase",
            "english_stop",
            "english_stemmer",
            "synonym_filter"
          ]
        }
      }
    }
  }
}
```

---

## 3. Relevance Scoring — BM25

```
┌──────────────────────────────────────────────────────────────┐
│              BM25 Scoring Algorithm                           │
│                                                               │
│  BM25(q, d) = Σ IDF(t) × (tf × (k1 + 1)) /                │
│                           (tf + k1 × (1 - b + b × |d|/avgdl))│
│                                                               │
│  Where:                                                      │
│  ├── q = query terms                                         │
│  ├── d = document                                            │
│  ├── tf = term frequency in document                        │
│  ├── IDF(t) = log(1 + (N - df + 0.5) / (df + 0.5))        │
│  │   └── N = total docs, df = docs containing term          │
│  ├── k1 = term frequency saturation (default 1.2)           │
│  │   └── Higher k1 = more weight to term frequency          │
│  ├── b = document length normalization (default 0.75)       │
│  │   └── b=0: no length normalization                       │
│  │   └── b=1: full length normalization                     │
│  └── avgdl = average document length                        │
│                                                               │
│  Key Insights:                                               │
│  ├── Rare terms score higher (IDF)                          │
│  ├── More occurrences = higher score (but saturates)        │
│  ├── Shorter documents score higher (length norm)           │
│  └── BM25 replaced TF-IDF in Elasticsearch 5.0+            │
│                                                               │
│  Tuning:                                                     │
│  ├── Title field: k1=1.2, b=0.3 (less length penalty)      │
│  ├── Body field: k1=1.2, b=0.75 (standard)                 │
│  └── Exact match field: k1=0, b=0 (binary match only)      │
└──────────────────────────────────────────────────────────────┘
```

### Boosting & Multi-Field Scoring

```typescript
// Elasticsearch multi-field query with boosting
const searchQuery = {
  query: {
    bool: {
      must: {
        multi_match: {
          query: userQuery,
          fields: [
            "title^3",         // Title matches 3x more important
            "title.exact^5",   // Exact title match 5x
            "description^2",   // Description 2x
            "body",            // Body 1x (default)
            "tags^2.5",        // Tags 2.5x
          ],
          type: "best_fields",       // Score = best matching field
          tie_breaker: 0.3,          // Other fields contribute 30%
          minimum_should_match: "75%", // At least 75% of terms must match
        },
      },
      should: [
        // Recency boost
        {
          range: {
            created_at: {
              gte: "now-7d",
              boost: 1.5,
            },
          },
        },
        // Popularity boost
        {
          rank_feature: {
            field: "popularity_score",
            boost: 0.5,
          },
        },
      ],
    },
  },
};
```

---

## 4. PostgreSQL Full-Text Search

```typescript
// PostgreSQL tsvector/tsquery — built-in full-text search
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 1. Add tsvector column with GIN index
async function setupFullTextSearch(): Promise<void> {
  await pool.query(`
    -- Add generated tsvector column
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS
      search_vector tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(body, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(tags_text, '')), 'B')
      ) STORED;

    -- GIN index for fast lookups
    CREATE INDEX IF NOT EXISTS idx_articles_search
      ON articles USING GIN (search_vector);

    -- Trigram index for fuzzy matching
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX IF NOT EXISTS idx_articles_title_trgm
      ON articles USING GIN (title gin_trgm_ops);
  `);
}

// 2. Search with ranking
async function searchArticles(query: string, page: number = 1, pageSize: number = 20) {
  const offset = (page - 1) * pageSize;

  const result = await pool.query(`
    SELECT
      id, title, subtitle,
      ts_headline('english', body, websearch_to_tsquery('english', $1),
        'MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>'
      ) AS highlight,
      ts_rank_cd(search_vector, websearch_to_tsquery('english', $1), 32) AS rank,
      similarity(title, $1) AS title_similarity
    FROM articles
    WHERE search_vector @@ websearch_to_tsquery('english', $1)
       OR similarity(title, $1) > 0.3
    ORDER BY
      rank DESC,
      title_similarity DESC
    LIMIT $2 OFFSET $3
  `, [query, pageSize, offset]);

  return result.rows;
}

// 3. Autocomplete with prefix matching
async function autocomplete(prefix: string, limit: number = 10) {
  const result = await pool.query(`
    SELECT DISTINCT title, similarity(title, $1) AS sim
    FROM articles
    WHERE title % $1           -- Trigram similarity
       OR title ILIKE $2       -- Prefix match
    ORDER BY sim DESC
    LIMIT $3
  `, [prefix, `${prefix}%`, limit]);

  return result.rows;
}
```

### Go — PostgreSQL Full-Text Search

```go
func (r *ArticleRepo) Search(ctx context.Context, query string, page, pageSize int) ([]SearchResult, error) {
    offset := (page - 1) * pageSize

    rows, err := r.db.QueryContext(ctx, `
        SELECT id, title,
            ts_headline('english', body, websearch_to_tsquery('english', $1),
                'MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>'
            ) AS highlight,
            ts_rank_cd(search_vector, websearch_to_tsquery('english', $1), 32) AS rank
        FROM articles
        WHERE search_vector @@ websearch_to_tsquery('english', $1)
        ORDER BY rank DESC
        LIMIT $2 OFFSET $3
    `, query, pageSize, offset)
    if err != nil {
        return nil, fmt.Errorf("search query: %w", err)
    }
    defer rows.Close()

    var results []SearchResult
    for rows.Next() {
        var r SearchResult
        if err := rows.Scan(&r.ID, &r.Title, &r.Highlight, &r.Rank); err != nil {
            return nil, fmt.Errorf("scan result: %w", err)
        }
        results = append(results, r)
    }
    return results, rows.Err()
}
```

### Python — PostgreSQL Full-Text Search

```python
from sqlalchemy import func, text
from sqlalchemy.dialects.postgresql import TSVECTOR

class Article(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=False)
    search_vector = Column(
        TSVECTOR,
        Computed(
            "setweight(to_tsvector('english', coalesce(title, '')), 'A') || "
            "setweight(to_tsvector('english', coalesce(body, '')), 'C')",
            persisted=True,
        ),
    )

    __table_args__ = (
        Index("idx_search_vector", search_vector, postgresql_using="gin"),
    )

async def search_articles(session: AsyncSession, query: str, page: int = 1, page_size: int = 20):
    tsquery = func.websearch_to_tsquery("english", query)
    offset = (page - 1) * page_size

    stmt = (
        select(
            Article.id,
            Article.title,
            func.ts_headline(
                "english", Article.body, tsquery,
                "MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>"
            ).label("highlight"),
            func.ts_rank_cd(Article.search_vector, tsquery, 32).label("rank"),
        )
        .where(Article.search_vector.op("@@")(tsquery))
        .order_by(text("rank DESC"))
        .limit(page_size)
        .offset(offset)
    )

    result = await session.execute(stmt)
    return result.all()
```

---

## 5. Tokenization Strategies

| Strategy | How It Works | Best For | Example Input → Tokens |
|----------|-------------|----------|----------------------|
| Standard | Unicode text segmentation | General text | "don't stop" → ["don't", "stop"] |
| Whitespace | Split on whitespace only | Log analysis | "error:404 warn" → ["error:404", "warn"] |
| N-gram | Sliding window (min-max) | Autocomplete, CJK | "search" (2,3) → ["se","sea","ear","arc","rch","ea","ar","rc","ch"] |
| Edge N-gram | N-grams from token start | Prefix autocomplete | "search" (2,4) → ["se","sea","sear"] |
| Keyword | Entire input as one token | Exact match fields | "New York" → ["New York"] |
| Pattern | Regex-based split | Custom delimiters | "a.b-c" (/[\.\-]/) → ["a","b","c"] |
| Path hierarchy | File path tokenization | File/URL paths | "/a/b/c" → ["/a","/a/b","/a/b/c"] |
| UAX URL Email | URL/email-aware | Content with URLs | "user@mail.com" → ["user@mail.com"] |

### Stemming vs Lemmatization

| Aspect | Stemming | Lemmatization |
|--------|----------|---------------|
| Approach | Rule-based suffix stripping | Dictionary/morphological lookup |
| Speed | Fast (algorithmic) | Slower (dictionary lookup) |
| Accuracy | Sometimes incorrect (overstemming) | More accurate (real word forms) |
| Examples | "running" → "run", "better" → "better" | "running" → "run", "better" → "good" |
| Algorithms | Porter, Snowball, Lancaster | WordNet, spaCy |
| Use in Search | Default choice — fast, good enough | Use when precision matters |

---

## 6. Query Types & Matching

```typescript
// Different query types for different search needs

// 1. Match query — analyzed, tokenized (most common)
const matchQuery = {
  query: { match: { title: { query: "quick brown fox", operator: "and" } } }
};

// 2. Term query — exact, NOT analyzed (for keywords, IDs)
const termQuery = {
  query: { term: { status: { value: "published" } } }
};

// 3. Phrase query — exact sequence of tokens
const phraseQuery = {
  query: { match_phrase: { title: { query: "quick brown fox", slop: 1 } } }
  // slop=1: allows one word between terms ("quick [word] brown fox")
};

// 4. Prefix query — for autocomplete
const prefixQuery = {
  query: { prefix: { title: { value: "qui" } } }
};

// 5. Fuzzy query — handles typos
const fuzzyQuery = {
  query: { fuzzy: { title: { value: "quikc", fuzziness: "AUTO" } } }
  // AUTO: 0-2 chars = exact, 3-5 = 1 edit, 6+ = 2 edits
};

// 6. Wildcard query — pattern matching (AVOID in production)
const wildcardQuery = {
  query: { wildcard: { title: { value: "qu*ck" } } }
  // WARNING: Leading wildcards ("*ick") are extremely slow
};

// 7. Bool query — combine multiple conditions
const boolQuery = {
  query: {
    bool: {
      must: [{ match: { body: "search engine" } }],           // Required
      should: [{ match: { title: "search engine" } }],         // Optional (boosts score)
      filter: [{ term: { status: "published" } }],             // Required, no scoring
      must_not: [{ term: { category: "archived" } }],          // Excluded
      minimum_should_match: 1,                                  // At least 1 should clause
    },
  },
};

// 8. Function score — custom relevance tuning
const functionScoreQuery = {
  query: {
    function_score: {
      query: { match: { title: "search" } },
      functions: [
        {
          filter: { range: { created_at: { gte: "now-7d" } } },
          weight: 2,
        },
        {
          field_value_factor: {
            field: "view_count",
            modifier: "log1p",    // log(1 + view_count)
            factor: 0.5,
          },
        },
        {
          gauss: {
            created_at: {
              origin: "now",
              scale: "30d",
              decay: 0.5,
            },
          },
        },
      ],
      score_mode: "sum",
      boost_mode: "multiply",
    },
  },
};
```

---

## 7. Index Design Principles

```
┌──────────────────────────────────────────────────────────────┐
│              Index Design Decision Tree                       │
│                                                               │
│  Field Type Decision:                                        │
│  ├── Need full-text search?                                 │
│  │   └── YES → "text" type with analyzer                    │
│  ├── Need exact match / filtering?                          │
│  │   └── YES → "keyword" type (not analyzed)                │
│  ├── Need both search AND filtering?                        │
│  │   └── YES → Multi-field mapping (text + keyword)         │
│  ├── Numeric range queries?                                  │
│  │   └── YES → integer/long/float/double                    │
│  ├── Date range queries?                                     │
│  │   └── YES → "date" type                                  │
│  └── Boolean filter?                                         │
│      └── YES → "boolean" type                               │
│                                                               │
│  RULE: NEVER use "text" for fields that need exact match    │
│  RULE: NEVER use "keyword" for fields that need search      │
│  RULE: ALWAYS use multi-field for ambiguous fields           │
└──────────────────────────────────────────────────────────────┘
```

### Multi-Field Mapping Example

```json
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "english_custom",
        "fields": {
          "keyword": { "type": "keyword" },
          "exact": {
            "type": "text",
            "analyzer": "keyword"
          },
          "autocomplete": {
            "type": "text",
            "analyzer": "autocomplete_analyzer",
            "search_analyzer": "standard"
          }
        }
      },
      "category": {
        "type": "keyword"
      },
      "price": {
        "type": "scaled_float",
        "scaling_factor": 100
      },
      "created_at": {
        "type": "date",
        "format": "strict_date_optional_time||epoch_millis"
      },
      "location": {
        "type": "geo_point"
      },
      "metadata": {
        "type": "object",
        "enabled": false
      }
    }
  }
}
```

---

## 8. Search Quality Metrics

| Metric | Formula | What It Measures | Target |
|--------|---------|-----------------|--------|
| Precision@K | Relevant in top K / K | Are results relevant? | > 0.8 |
| Recall@K | Relevant in top K / Total relevant | Do we find all relevant? | > 0.7 |
| F1@K | 2 × (P × R) / (P + R) | Balance of P and R | > 0.75 |
| MRR | 1 / rank of first relevant | How high is first good result? | > 0.8 |
| NDCG@K | DCG@K / IDCG@K | Quality of ranking order | > 0.75 |
| Click-through rate | Clicks / Impressions | User engagement | > 0.3 |
| Zero-result rate | Queries with 0 results / Total | Coverage gaps | < 0.05 |
| Time to first result | Latency p95 | Performance | < 200ms |

### Measuring Search Quality

```typescript
// Track search metrics
interface SearchMetrics {
  query: string;
  totalResults: number;
  latencyMs: number;
  clickedPosition: number | null; // Which result user clicked
}

class SearchQualityTracker {
  async trackSearch(metrics: SearchMetrics): Promise<void> {
    // Zero-result tracking
    if (metrics.totalResults === 0) {
      await this.recordZeroResult(metrics.query);
    }

    // Latency tracking
    histogram.observe({ type: "search_latency" }, metrics.latencyMs);

    // Click-through position (MRR source)
    if (metrics.clickedPosition !== null) {
      await this.recordClick(metrics.query, metrics.clickedPosition);
    }
  }

  async calculateMRR(period: string): Promise<number> {
    const clicks = await this.getClicks(period);
    const reciprocalRanks = clicks.map(c => 1 / c.position);
    return reciprocalRanks.reduce((a, b) => a + b, 0) / clicks.length;
  }
}
```

---

## 9. Search Infrastructure Patterns

```
┌──────────────────────────────────────────────────────────────┐
│              Search Infrastructure                            │
│                                                               │
│  Pattern 1: Synchronized Index (CQRS-lite)                  │
│                                                               │
│  App DB (PostgreSQL) ──► CDC/Events ──► Search Index (ES)   │
│       │                                        │             │
│       ▼                                        ▼             │
│  Writes go here                          Reads go here      │
│                                                               │
│  Sync options:                                               │
│  ├── Dual write: Write to DB + search (risk: inconsistency)│
│  ├── CDC (Debezium): Stream DB changes to search            │
│  ├── Application events: Publish on write, index on consume │
│  └── Periodic reindex: Batch sync on schedule               │
│                                                               │
│  Pattern 2: Database as Search (small scale)                │
│                                                               │
│  App ──► PostgreSQL (tsvector + GIN index)                  │
│  ├── Works for < 1M documents                               │
│  ├── No sync needed                                          │
│  ├── ACID transactions include search updates               │
│  └── Limited: no facets, poor relevance tuning              │
│                                                               │
│  Pattern 3: Search-First (search IS the primary store)      │
│                                                               │
│  App ──► Elasticsearch (source of truth for search data)    │
│  ├── Logs, metrics, event data                              │
│  ├── Never for transactional data                           │
│  └── Accept eventual consistency                             │
│                                                               │
│  Decision Guide:                                             │
│  ├── < 100K docs, simple queries → PostgreSQL FTS           │
│  ├── 100K-10M docs, relevance matters → Elasticsearch       │
│  ├── > 10M docs, complex queries → Elasticsearch cluster    │
│  └── Log/event search → Elasticsearch (search-first)        │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. Index Synchronization

```typescript
// Event-driven index synchronization
class SearchIndexer {
  constructor(
    private searchClient: ElasticsearchClient,
    private eventBus: EventBus,
  ) {
    // Subscribe to data change events
    this.eventBus.subscribe("article.created", (e) => this.indexArticle(e.data));
    this.eventBus.subscribe("article.updated", (e) => this.updateArticle(e.data));
    this.eventBus.subscribe("article.deleted", (e) => this.deleteArticle(e.data.id));
  }

  async indexArticle(article: Article): Promise<void> {
    await this.searchClient.index({
      index: "articles",
      id: article.id.toString(),
      body: {
        title: article.title,
        body: article.body,
        category: article.category,
        tags: article.tags,
        author_name: article.author.name,
        created_at: article.createdAt.toISOString(),
        popularity_score: article.viewCount,
      },
    });
  }

  // Full reindex (run periodically or on schema changes)
  async reindex(batchSize: number = 1000): Promise<void> {
    const newIndex = `articles_${Date.now()}`;

    // 1. Create new index with latest mappings
    await this.searchClient.indices.create({
      index: newIndex,
      body: { settings: SETTINGS, mappings: MAPPINGS },
    });

    // 2. Bulk index all documents
    let offset = 0;
    while (true) {
      const articles = await this.db.query(
        `SELECT * FROM articles ORDER BY id LIMIT $1 OFFSET $2`,
        [batchSize, offset],
      );
      if (articles.length === 0) break;

      const body = articles.flatMap((article) => [
        { index: { _index: newIndex, _id: article.id.toString() } },
        this.toSearchDoc(article),
      ]);
      await this.searchClient.bulk({ body });

      offset += batchSize;
    }

    // 3. Atomic alias swap (zero-downtime)
    await this.searchClient.indices.updateAliases({
      body: {
        actions: [
          { remove: { index: "articles_*", alias: "articles" } },
          { add: { index: newIndex, alias: "articles" } },
        ],
      },
    });

    // 4. Delete old indices
    const oldIndices = await this.searchClient.cat.indices({ index: "articles_*", format: "json" });
    for (const idx of oldIndices.body) {
      if (idx.index !== newIndex) {
        await this.searchClient.indices.delete({ index: idx.index });
      }
    }
  }
}
```

---

## 11. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Scanning raw text instead of index | O(n) search time, unusable at scale | Use inverted index (Elasticsearch, PostgreSQL tsvector) |
| Same analyzer not used at index + query time | Zero results for valid queries | Ensure index analyzer and search analyzer match |
| Using `text` type for exact-match fields | Unexpected partial matches on status/category | Use `keyword` type for exact match, enums, IDs |
| Leading wildcards (`*ick`) | Extremely slow queries, full index scan | Use edge n-gram tokenizer for prefix-like search |
| Not setting field boosts | Title matches score same as body matches | Boost important fields: `title^3, body^1` |
| Dual write without eventual consistency handling | Search index drifts from primary DB | Use CDC (Debezium) or event-driven indexing with retries |
| No zero-result tracking | Users silently get bad results | Track and analyze zero-result queries |
| Exposing raw Elasticsearch DSL to users | Injection attacks, cluster abuse | Build query builder abstraction, validate inputs |
| No search result caching | Repeated queries hit search cluster | Cache frequent queries in Redis (60s TTL) |
| Unbounded result window (from: 10000) | OOM errors, degraded cluster | Use `search_after` for deep pagination, max window 10K |
| Not using `filter` context for non-scoring clauses | Wasted CPU on scoring status/category filters | Use `filter` in bool query for exact-match conditions |
| Reindexing with downtime | Users see empty results during reindex | Use index aliases with atomic swap |

---

## 12. Enforcement Checklist

- [ ] Inverted index used for all full-text search (never raw text scan)
- [ ] Analysis pipeline configured per language (tokenizer + stemmer + stop words)
- [ ] Same analyzer applied at index time and query time
- [ ] Field types correctly chosen (text vs keyword vs multi-field)
- [ ] BM25 relevance scoring with field boosting configured
- [ ] Search index separated from primary data store (CQRS pattern)
- [ ] Index synchronization via CDC or events (not dual write)
- [ ] Zero-downtime reindexing with alias swap
- [ ] Search quality metrics tracked (MRR, zero-result rate, latency)
- [ ] Query input sanitized (no raw DSL exposure)
- [ ] Deep pagination uses `search_after` (not `from/size` beyond 10K)
- [ ] Filter context used for non-scoring conditions
- [ ] Fuzzy matching configured for typo tolerance
- [ ] Autocomplete uses edge n-gram or completion suggester
- [ ] Search result caching for frequent queries
