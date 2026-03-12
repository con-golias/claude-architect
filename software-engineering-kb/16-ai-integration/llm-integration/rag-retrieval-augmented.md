# Retrieval-Augmented Generation (RAG)

| Attribute | Value |
|-----------|-------|
| Domain | AI Integration > LLM Integration |
| Importance | Critical |
| Last Updated | 2026-03-10 |
| Cross-ref | [RAG Security](../../08-security/ai-security/rag-security.md), [API Integration Patterns](api-integration-patterns.md) |

---

## RAG Architecture Overview

### The Core Pipeline

RAG augments LLM generation with external knowledge retrieved at query time, eliminating hallucinations on domain-specific data without fine-tuning.

```
Documents --> Chunking --> Embedding --> Vector Store    (Indexing Phase)
                                            |
Query --> Embedding --> Similarity Search ---+           (Retrieval Phase)
                              |
                    Retrieved Chunks --> LLM Prompt --> Response  (Generation Phase)
```

### When to Use RAG

| Scenario | RAG Fit | Alternative |
|----------|---------|-------------|
| Domain-specific Q&A | Excellent | Fine-tuning for style only |
| Knowledge that changes frequently | Excellent | Re-training is impractical |
| Multi-source aggregation | Excellent | Single-source summarization |
| Creative writing | Poor | Prompt engineering |
| Simple classification | Poor | Fine-tuning or few-shot |

---

## Document Processing & Chunking

### Chunking Strategies

```python
# Fixed-size chunking with overlap
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=512,
    chunk_overlap=64,
    separators=["\n\n", "\n", ". ", " ", ""],
    length_function=len,
)
chunks = splitter.split_documents(documents)
```

| Strategy | Chunk Size | Best For | Trade-off |
|----------|-----------|----------|-----------|
| Fixed-size | 256-1024 tokens | General purpose | May split mid-sentence |
| Recursive | 256-1024 tokens | Structured text | Better boundaries, slower |
| Semantic | Variable | Research, legal docs | Expensive (requires embedding) |
| Parent-child | Parent: 2048, child: 256 | Complex docs | Retrieve child, return parent |
| Markdown/HTML-aware | Variable | Technical docs | Preserves structure |

### Metadata Extraction

Attach metadata to every chunk for filtered retrieval:

```python
from datetime import datetime

chunk_metadata = {
    "source": "docs/architecture.md",
    "page": 3,
    "section": "Database Design",
    "created_at": datetime(2026, 1, 15).isoformat(),
    "doc_type": "technical",
    "version": "2.1",
}
```

---

## Embedding Models

### Model Comparison (2026)

| Model | Dimensions | Context | Cost/1M tokens | Notes |
|-------|-----------|---------|----------------|-------|
| OpenAI text-embedding-3-large | 3072 | 8191 | $0.13 | Best commercial option |
| OpenAI text-embedding-3-small | 1536 | 8191 | $0.02 | Budget-friendly |
| Cohere embed-v4 | 1024 | 512 | $0.10 | Strong multilingual |
| Voyage AI voyage-3-large | 1024 | 32000 | $0.18 | Long-context specialist |
| nomic-embed-text-v2 | 768 | 8192 | Free (self-hosted) | Best open-source |
| sentence-transformers/all-MiniLM | 384 | 512 | Free (self-hosted) | Lightweight |

```typescript
import OpenAI from "openai";

const openai = new OpenAI();

async function embedTexts(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: texts,
    dimensions: 1024, // Matryoshka: reduce dims without re-embedding
  });
  return response.data.map((d) => d.embedding);
}
```

---

## Vector Databases

### Selection Guide

| Database | Type | Scaling | Filtering | Managed | Best For |
|----------|------|---------|-----------|---------|----------|
| Pinecone | Cloud-native | Serverless | Rich metadata | Yes | Production SaaS |
| Weaviate | Hybrid | Horizontal | GraphQL + filters | Both | Multi-modal search |
| Qdrant | Dedicated | Horizontal | Payload filtering | Both | High-performance |
| Chroma | Embedded | Single-node | Basic | No | Prototyping, local dev |
| pgvector | Extension | PostgreSQL | Full SQL | Both | Existing Postgres stack |
| Milvus | Distributed | Horizontal | Attribute filters | Both | Billion-scale datasets |

```typescript
// pgvector with Drizzle ORM
import { pgTable, vector, text, serial } from "drizzle-orm/pg-core";

const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }),
  source: text("source"),
});

// Similarity search with cosine distance
const results = await db.execute(sql`
  SELECT content, source,
    1 - (embedding <=> ${queryEmbedding}::vector) as similarity
  FROM documents
  WHERE source = ${sourceFilter}
  ORDER BY embedding <=> ${queryEmbedding}::vector
  LIMIT 5
`);
```

---

## Retrieval Strategies

### Dense, Sparse, and Hybrid Retrieval

```python
# Hybrid search with Qdrant (dense + sparse)
from qdrant_client import QdrantClient, models

client = QdrantClient(url="http://localhost:6333")

results = client.query_points(
    collection_name="documents",
    prefetch=[
        # Dense retrieval (semantic similarity)
        models.Prefetch(
            query=dense_embedding,
            using="dense",
            limit=20,
        ),
        # Sparse retrieval (BM25-like keyword matching)
        models.Prefetch(
            query=sparse_embedding,
            using="sparse",
            limit=20,
        ),
    ],
    # Reciprocal Rank Fusion combines both result sets
    query=models.FusionQuery(fusion=models.Fusion.RRF),
    limit=10,
)
```

### Re-Ranking

Re-ranking reorders initial retrieval results using a cross-encoder for higher precision:

```python
from cohere import Client

co = Client(api_key="...")

reranked = co.rerank(
    model="rerank-v3.5",
    query=user_query,
    documents=[r.text for r in initial_results],
    top_n=5,
    return_documents=True,
)
# Re-ranked results have significantly higher relevance
final_docs = [r.document.text for r in reranked.results]
```

---

## Advanced RAG Patterns

### Query Decomposition

Break complex queries into sub-queries, retrieve for each, then synthesize:

```python
from langchain.prompts import ChatPromptTemplate

decompose_prompt = ChatPromptTemplate.from_template("""
Break this question into 2-4 simpler sub-questions for retrieval:
Question: {question}
Return as a JSON array of strings.
""")

# Retrieve for each sub-query, merge results, then generate final answer
```

### HyDE (Hypothetical Document Embeddings)

Generate a hypothetical answer first, then use its embedding for retrieval:

```python
async def hyde_retrieve(query: str, retriever, llm) -> list[str]:
    # Step 1: Generate hypothetical answer
    hypothetical = await llm.invoke(
        f"Write a short paragraph answering: {query}"
    )
    # Step 2: Embed the hypothetical answer (not the query)
    hyde_embedding = embed(hypothetical.content)
    # Step 3: Retrieve using hypothetical embedding
    return retriever.similarity_search_by_vector(hyde_embedding, k=5)
```

### Parent-Child Chunking

Index small chunks for precision, return parent chunks for context:

```python
from langchain.retrievers import ParentDocumentRetriever
from langchain.storage import InMemoryStore

parent_splitter = RecursiveCharacterTextSplitter(chunk_size=2000)
child_splitter = RecursiveCharacterTextSplitter(chunk_size=400)

retriever = ParentDocumentRetriever(
    vectorstore=vectorstore,
    docstore=InMemoryStore(),
    child_splitter=child_splitter,
    parent_splitter=parent_splitter,
)
```

---

## RAG Evaluation

### Retrieval Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Precision@k | Relevant in top-k / k | > 0.7 |
| Recall@k | Relevant in top-k / total relevant | > 0.8 |
| MRR | 1 / rank of first relevant | > 0.6 |
| NDCG@k | Normalized discounted cumulative gain | > 0.7 |

### Generation Quality (RAGAS Framework)

```python
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy, context_precision

result = evaluate(
    dataset=eval_dataset,
    metrics=[faithfulness, answer_relevancy, context_precision],
)
# faithfulness: Is the answer grounded in retrieved context?
# answer_relevancy: Does the answer address the question?
# context_precision: Are retrieved chunks relevant?
```

---

## Production Considerations

### Index Refresh Strategies

| Strategy | Latency | Cost | Use Case |
|----------|---------|------|----------|
| Full rebuild | High | High | Weekly/monthly for small corpora |
| Incremental upsert | Low | Low | Real-time document updates |
| Delta indexing | Medium | Medium | Daily batch with change tracking |
| Streaming | Very low | Medium | Event-driven (new docs trigger index) |

### Multi-Tenancy

Isolate tenant data in vector stores using namespace separation or metadata filtering:

```typescript
// Tenant-isolated retrieval
const results = await vectorStore.similaritySearch(query, 5, {
  filter: { tenant_id: currentTenant.id },
});
```

### Production RAG Pipeline (LlamaIndex)

```python
from llama_index.core import VectorStoreIndex, Settings
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.anthropic import Anthropic

Settings.embed_model = OpenAIEmbedding(model="text-embedding-3-large")
Settings.llm = Anthropic(model="claude-sonnet-4-5-20250514")

vector_store = QdrantVectorStore(
    collection_name="production_docs",
    url="https://qdrant.example.com",
)
index = VectorStoreIndex.from_vector_store(vector_store)

query_engine = index.as_query_engine(
    similarity_top_k=10,
    response_mode="tree_summarize",
    node_postprocessors=[reranker],
)
response = query_engine.query("How does the billing system handle refunds?")
```

---

## 10 Best Practices

1. **Chunk with overlap.** Use 10-15% overlap between chunks to preserve context at boundaries. Recursive character splitting with sentence-aware separators prevents mid-thought breaks.
2. **Use hybrid retrieval.** Combine dense (semantic) and sparse (BM25) retrieval with reciprocal rank fusion. Hybrid consistently outperforms either method alone.
3. **Add a re-ranking stage.** Cross-encoder re-ranking after initial retrieval improves precision@5 by 15-30%. Use Cohere Rerank or a cross-encoder model.
4. **Attach rich metadata.** Store source, date, section, document type, and version with every chunk. Enable filtered retrieval by metadata to reduce noise.
5. **Evaluate retrieval and generation separately.** Track precision@k and recall@k for retrieval; faithfulness and relevance for generation. Identify which stage degrades quality.
6. **Use parent-child chunking for complex documents.** Index small chunks (256-512 tokens) for retrieval precision but return larger parent chunks (1024-2048 tokens) to the LLM for sufficient context.
7. **Implement incremental index updates.** Avoid full re-indexing on every change. Use upsert operations with document hashes to update only changed content.
8. **Isolate tenant data.** Use namespace separation or metadata filters in multi-tenant systems. Never allow cross-tenant retrieval -- see [RAG Security](../../08-security/ai-security/rag-security.md).
9. **Set similarity thresholds.** Discard retrieved chunks below a relevance threshold (e.g., cosine similarity < 0.7) rather than forcing low-quality context into the prompt.
10. **Monitor retrieval quality in production.** Log queries, retrieved chunks, and user feedback. Track retrieval drift as source documents evolve.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Embedding entire documents without chunking | Poor retrieval precision, token waste | Chunk to 256-1024 tokens with overlap |
| Using only dense retrieval | Misses keyword-specific queries | Add sparse retrieval with hybrid fusion |
| No re-ranking step | Low-relevance chunks dilute context | Add cross-encoder or Cohere re-ranker |
| Ignoring metadata in retrieval | Retrieves outdated or irrelevant docs | Filter by date, source, document type |
| Fixed chunk size for all content | Tables and code break mid-structure | Use content-aware splitting |
| Stuffing all retrieved chunks into prompt | Exceeds context window, raises cost | Limit to top-5, use map-reduce for large sets |
| No evaluation pipeline | Cannot detect quality regressions | Implement RAGAS or custom eval suite |
| Rebuilding entire index on every update | Slow, expensive, causes downtime | Use incremental upsert with change detection |

---

## Enforcement Checklist

- [ ] Chunking strategy defined and tested (size, overlap, separators)
- [ ] Embedding model selected with dimension/cost trade-off documented
- [ ] Vector database deployed with backup and monitoring
- [ ] Hybrid retrieval (dense + sparse) implemented
- [ ] Re-ranking stage added to retrieval pipeline
- [ ] Metadata attached to all chunks (source, date, version)
- [ ] Multi-tenancy isolation verified with cross-tenant test
- [ ] Similarity threshold configured to filter low-relevance results
- [ ] Evaluation pipeline running (retrieval + generation metrics)
- [ ] Index refresh strategy implemented (incremental preferred)
- [ ] Production monitoring: query logs, retrieval quality, latency
- [ ] Security review completed per [RAG Security](../../08-security/ai-security/rag-security.md)
