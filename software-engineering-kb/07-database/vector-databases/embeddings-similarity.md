# Vector Embeddings & Similarity Search

> **Domain:** Database > Vector Databases > Embeddings & Similarity
> **Difficulty:** Intermediate
> **Last Updated:** —

## Why It Matters

Vector embeddings are the bridge between human-understandable content (text, images, audio) and machine-processable numerical representations. Every modern AI application — semantic search, recommendation engines, RAG (Retrieval-Augmented Generation), anomaly detection, deduplication — relies on vector similarity search. Traditional databases search by exact match or keyword. Vector databases search by meaning: "find documents similar to this one" rather than "find documents containing this keyword." Understanding how embeddings work, which distance metrics to use, and how approximate nearest neighbor (ANN) algorithms trade accuracy for speed is essential for building any AI-powered feature.

---

## How It Works

### What Are Vector Embeddings?

```
Embedding: a dense numerical representation of data
in a high-dimensional space where similar items are
close together.

Text → Embedding Model → Vector (float array)
"The cat sat on the mat" → [0.12, -0.45, 0.78, ..., 0.33]  (1536 dimensions)
"A kitten rested on the rug" → [0.11, -0.43, 0.77, ..., 0.31]  (similar!)
"Stock prices fell sharply" → [-0.88, 0.21, -0.15, ..., 0.67]  (very different)

Image → Embedding Model → Vector
🐱 photo → [0.55, 0.12, -0.34, ..., 0.89]
🐱 different photo → [0.53, 0.14, -0.32, ..., 0.87]  (similar!)
🚗 photo → [-0.22, 0.88, 0.41, ..., -0.15]  (very different)

Key Properties:
• Semantic similarity → vector proximity
• Fixed dimensionality (512, 768, 1024, 1536, 3072)
• Dense (no zeros, unlike sparse TF-IDF vectors)
• Model-dependent (different models = different vector spaces)
```

### Embedding Models

| Model | Dimensions | Context | Best For |
|-------|-----------|---------|----------|
| **OpenAI text-embedding-3-small** | 1536 | 8191 tokens | General purpose, cost-effective |
| **OpenAI text-embedding-3-large** | 3072 | 8191 tokens | Highest quality text |
| **Cohere embed-v3** | 1024 | 512 tokens | Multilingual, search vs classify |
| **Voyage AI voyage-3** | 1024 | 16000 tokens | Code + text, long context |
| **Google text-embedding-004** | 768 | 2048 tokens | Google ecosystem |
| **BAAI/bge-large-en-v1.5** | 1024 | 512 tokens | Open-source, self-hosted |
| **sentence-transformers/all-MiniLM-L6-v2** | 384 | 256 tokens | Lightweight, fast, open-source |
| **CLIP (ViT-B/32)** | 512 | N/A | Image + text (multimodal) |
| **Nomic nomic-embed-text-v1.5** | 768 | 8192 tokens | Open-source, long context |

```typescript
// TypeScript — Generate embeddings with OpenAI
import OpenAI from 'openai';

const openai = new OpenAI();

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding; // float[1536]
}

// Batch embedding (more efficient)
async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts, // up to 2048 inputs per request
  });
  return response.data.map(d => d.embedding);
}
```

```python
# Python — Generate embeddings with sentence-transformers (self-hosted)
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

# Single text
embedding = model.encode("The cat sat on the mat")
# numpy array, shape (384,)

# Batch (GPU-accelerated)
texts = ["First document", "Second document", "Third document"]
embeddings = model.encode(texts, batch_size=32, show_progress_bar=True)
# numpy array, shape (3, 384)

# Normalize for cosine similarity
embeddings = model.encode(texts, normalize_embeddings=True)
```

---

### Distance Metrics

```
Three Distance Metrics for Vector Similarity:

1. Cosine Similarity (most common for text)
   sim(A, B) = (A · B) / (||A|| × ||B||)
   Range: -1 to 1 (1 = identical, 0 = orthogonal, -1 = opposite)
   Use when: magnitude doesn't matter, only direction
   Best for: text embeddings, semantic similarity

2. Euclidean Distance (L2)
   dist(A, B) = √(Σ(Ai - Bi)²)
   Range: 0 to ∞ (0 = identical)
   Use when: absolute position in space matters
   Best for: image embeddings, spatial data

3. Inner Product (Dot Product)
   sim(A, B) = Σ(Ai × Bi)
   Range: -∞ to ∞ (higher = more similar)
   Use when: vectors are normalized (then = cosine)
   Best for: normalized embeddings (faster than cosine)

       Cosine Similarity        Euclidean Distance
       (angle-based)            (position-based)
            B                        B
           /                        •
          / θ                      / |
         /                        /  | d
        ────── A                 /   |
                                •────•
       Same angle = similar     A  Close = similar

Choosing the Right Metric:
┌────────────────────────┬──────────────────────┐
│ Use Cosine When        │ Use L2 When           │
├────────────────────────┼──────────────────────┤
│ Text similarity        │ Image feature vectors │
│ Document search        │ Face recognition      │
│ Varying-length docs    │ Clustering (k-means)  │
│ Pre-normalized vectors │ Geographic proximity  │
└────────────────────────┴──────────────────────┘
```

```go
// Go — Distance metric implementations
package vectordb

import "math"

// CosineSimilarity returns similarity between -1 and 1
func CosineSimilarity(a, b []float32) float32 {
    var dot, normA, normB float32
    for i := range a {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    if normA == 0 || normB == 0 {
        return 0
    }
    return dot / (float32(math.Sqrt(float64(normA))) * float32(math.Sqrt(float64(normB))))
}

// EuclideanDistance returns distance >= 0
func EuclideanDistance(a, b []float32) float32 {
    var sum float32
    for i := range a {
        diff := a[i] - b[i]
        sum += diff * diff
    }
    return float32(math.Sqrt(float64(sum)))
}

// DotProduct returns inner product (for normalized vectors = cosine)
func DotProduct(a, b []float32) float32 {
    var dot float32
    for i := range a {
        dot += a[i] * b[i]
    }
    return dot
}
```

---

### Approximate Nearest Neighbor (ANN) Algorithms

```
Exact KNN vs Approximate KNN:

Exact KNN:
  Compare query vector against ALL vectors in database
  O(n × d) where n = vectors, d = dimensions
  1M vectors × 1536 dims = 1.5 billion float comparisons
  TOO SLOW for production

ANN (Approximate):
  Trade small accuracy loss for 100-1000x speed
  Recall@10 of 95-99% (miss 1-5 out of 100 true neighbors)
  O(log n) or O(1) query time
```

#### HNSW (Hierarchical Navigable Small World)

```
HNSW: Most popular ANN algorithm
Used by: pgvector, Pinecone, Weaviate, Qdrant, Milvus

Structure: Multi-layer graph where each layer is a
navigable small-world graph with decreasing density

Layer 2 (sparse):    A ──────── D
                     │          │
Layer 1 (medium):    A ── B ── D ── E
                     │    │    │    │
Layer 0 (dense):     A-B-C-D-E-F-G-H-I-J

Search:
1. Start at top layer (sparse), greedy search
2. Find closest node, move to next layer
3. Repeat until bottom layer (most connections)
4. Return k nearest neighbors

Parameters:
  M (connections per node): 16-64 (higher = better recall, more memory)
  efConstruction (build quality): 64-512 (higher = better index, slower build)
  efSearch (search quality): 50-500 (higher = better recall, slower search)

Tradeoffs:
  ✅ High recall (>99% achievable)
  ✅ Fast search (sub-millisecond)
  ✅ Good for updates (can add/delete)
  ❌ High memory usage (graph in RAM)
  ❌ Slower build time than IVF
```

#### IVF (Inverted File Index)

```
IVF: Partition-based ANN
Used by: FAISS, Milvus, pgvector (ivfflat)

Structure: Cluster vectors into partitions (Voronoi cells)
using k-means, then search only nearby partitions

┌──────────────────────────────────────┐
│         Vector Space                  │
│    ┌────┐  ┌────┐  ┌────┐           │
│    │ C1 │  │ C2 │  │ C3 │           │
│    │••••│  │••••│  │••••│           │
│    │•Q••│  │••••│  │••••│           │
│    └────┘  └────┘  └────┘           │
│    ┌────┐  ┌────┐  ┌────┐           │
│    │ C4 │  │ C5 │  │ C6 │           │
│    │••••│  │••••│  │••••│           │
│    └────┘  └────┘  └────┘           │
│                                      │
│  Q is in C1 → search C1 and         │
│  nearby clusters (nprobe = 3-10)    │
└──────────────────────────────────────┘

Parameters:
  nlist (clusters): sqrt(n) to 4*sqrt(n)
  nprobe (clusters to search): 1-20% of nlist

Tradeoffs:
  ✅ Lower memory than HNSW
  ✅ Fast build time
  ✅ Works well with PQ compression
  ❌ Lower recall than HNSW at same speed
  ❌ Requires training (k-means on dataset)
  ❌ Bad for frequent updates (re-cluster)
```

#### Algorithm Comparison

| Algorithm | Search Speed | Recall | Memory | Updates | Build Time |
|-----------|-------------|--------|--------|---------|-----------|
| **HNSW** | Excellent | Excellent | High | Good | Slow |
| **IVF-Flat** | Good | Good | Medium | Poor | Fast |
| **IVF-PQ** | Excellent | Medium | Low | Poor | Fast |
| **ScaNN** | Excellent | Excellent | Medium | Poor | Fast |
| **DiskANN** | Good | Excellent | Low (disk) | Medium | Slow |
| **Flat (brute force)** | Slow | Perfect | Low | Excellent | None |

---

### RAG (Retrieval-Augmented Generation) Pattern

```
RAG Architecture:
┌──────────────────────────────────────────────────────┐
│                                                        │
│  Indexing Phase (offline):                             │
│  ┌──────┐    ┌──────────┐    ┌──────────────┐        │
│  │ Docs │───►│ Chunker  │───►│ Embedding    │        │
│  │      │    │ (split   │    │ Model        │        │
│  │      │    │  text)   │    │ (vectorize)  │        │
│  └──────┘    └──────────┘    └──────┬───────┘        │
│                                      │                 │
│                                      ▼                 │
│                              ┌──────────────┐         │
│                              │ Vector DB    │         │
│                              │ (store +     │         │
│                              │  index)      │         │
│                              └──────────────┘         │
│                                                        │
│  Query Phase (online):                                 │
│  ┌──────┐    ┌──────────┐    ┌──────────────┐        │
│  │Query │───►│ Embedding│───►│ Vector DB    │        │
│  │      │    │ Model    │    │ (similarity  │        │
│  └──────┘    └──────────┘    │  search)     │        │
│                              └──────┬───────┘        │
│                                      │                 │
│              Top-K results           │                 │
│                                      ▼                 │
│  ┌──────────────────────────────────────────┐         │
│  │ LLM Prompt:                               │         │
│  │ "Given this context: [retrieved chunks]   │         │
│  │  Answer: [user question]"                 │         │
│  └──────────────────────────────────────────┘         │
└──────────────────────────────────────────────────────┘
```

```typescript
// TypeScript — Complete RAG pipeline
import OpenAI from 'openai';

const openai = new OpenAI();

// Step 1: Chunk documents
function chunkText(text: string, chunkSize = 500, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

// Step 2: Embed and store (pseudo-code for vector DB)
async function indexDocument(docId: string, text: string) {
  const chunks = chunkText(text);
  const embeddings = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks,
  });

  for (let i = 0; i < chunks.length; i++) {
    await vectorDB.upsert({
      id: `${docId}_chunk_${i}`,
      vector: embeddings.data[i].embedding,
      metadata: { docId, chunkIndex: i, text: chunks[i] },
    });
  }
}

// Step 3: Query with RAG
async function ragQuery(question: string): Promise<string> {
  // Embed the question
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
  });

  // Search vector DB
  const results = await vectorDB.search({
    vector: queryEmbedding.data[0].embedding,
    topK: 5,
  });

  // Build context from retrieved chunks
  const context = results.matches
    .map(m => m.metadata.text)
    .join('\n\n');

  // Generate answer with LLM
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Answer based on the following context. If the context doesn't contain the answer, say so.\n\nContext:\n${context}`,
      },
      { role: 'user', content: question },
    ],
  });

  return completion.choices[0].message.content!;
}
```

---

### Chunking Strategies

| Strategy | Description | Best For |
|----------|------------|----------|
| **Fixed-size** | Split at character/token count with overlap | General purpose, simple |
| **Sentence-based** | Split at sentence boundaries | Preserves complete thoughts |
| **Paragraph-based** | Split at paragraph breaks | Structured documents |
| **Recursive character** | Try splitting by paragraph, then sentence, then word | LangChain default, good general |
| **Semantic chunking** | Use embedding similarity to find natural break points | Highest quality, most expensive |
| **Document structure** | Split by headings, sections, chapters | Technical docs, books |

```python
# Python — Chunking strategies
from langchain.text_splitter import (
    RecursiveCharacterTextSplitter,
    TokenTextSplitter,
)

# Recursive character splitting (recommended default)
splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,       # characters per chunk
    chunk_overlap=100,    # overlap between chunks
    separators=["\n\n", "\n", ". ", " ", ""],  # try in order
)
chunks = splitter.split_text(document_text)

# Token-based splitting (model-aware)
token_splitter = TokenTextSplitter(
    chunk_size=256,       # tokens per chunk
    chunk_overlap=50,     # token overlap
    model_name="gpt-4o",
)
chunks = token_splitter.split_text(document_text)
```

---

## Best Practices

1. **ALWAYS normalize vectors** before storing if using cosine similarity — many DBs optimize for inner product on normalized vectors
2. **ALWAYS use the same embedding model** for indexing and querying — different models produce incompatible vector spaces
3. **ALWAYS chunk documents** before embedding — embedding models have context limits, shorter chunks = better retrieval
4. **ALWAYS include metadata** with vectors — store source document, chunk index, timestamp for filtering
5. **ALWAYS tune ANN parameters** (efSearch, nprobe) based on recall/latency requirements
6. **ALWAYS use HNSW** for most use cases — best recall/speed tradeoff
7. **NEVER mix embeddings from different models** in the same index — incompatible vector spaces
8. **NEVER embed entire documents** without chunking — loses granularity, exceeds model context
9. **NEVER use exact KNN** for > 100K vectors — O(n) is too slow for production
10. **NEVER ignore dimensionality** — higher dimensions = more storage, slower search; use dimensionality reduction if possible

---

## Anti-patterns / Common Mistakes

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Mixing embedding models in one index | Poor search quality, inconsistent results | One model per index |
| No chunking (embed full documents) | Poor retrieval, context limit exceeded | Chunk to 256-512 tokens |
| Brute-force search at scale | Queries take seconds | Use ANN index (HNSW, IVF) |
| Wrong distance metric | Relevant results ranked low | Cosine for text, L2 for images |
| Chunks too small | Missing context, bad answers | 256-512 tokens with overlap |
| Chunks too large | Low retrieval precision | Reduce chunk size, add overlap |
| No metadata filtering | Cannot filter by date, category, user | Store metadata, use pre-filtering |
| Not evaluating recall | Don't know if search is working | Measure recall@k with test queries |
| Embedding at query time without caching | Redundant API calls, high cost | Cache embeddings for repeated queries |
| Using old/small embedding models | Poor semantic understanding | Use latest models (text-embedding-3-small+) |

---

## Real-world Examples

### OpenAI ChatGPT (RAG)
- Retrieval-augmented generation for knowledge-grounded answers
- Vector search over knowledge base, inject context into prompt

### Spotify
- Song recommendation via audio embedding similarity
- "Songs like this" feature based on audio vector proximity

### Google Search
- Query and document embeddings for semantic matching
- Complements keyword search with meaning-based retrieval

### Pinterest
- Visual search: upload image, find similar pins
- CLIP-based multimodal embeddings (image + text)

---

## Enforcement Checklist

- [ ] Embedding model selected and documented (same for index and query)
- [ ] Distance metric chosen (cosine for text, L2 for images)
- [ ] Chunking strategy defined (size, overlap, method)
- [ ] ANN algorithm selected (HNSW for most cases)
- [ ] ANN parameters tuned (recall vs latency tradeoff measured)
- [ ] Metadata stored alongside vectors (source, chunk index, timestamp)
- [ ] Recall@k evaluated with test queries
- [ ] Embedding API costs estimated and budgeted
- [ ] Vector index fits in available memory (or use disk-based ANN)
- [ ] Vectors normalized if using cosine similarity
