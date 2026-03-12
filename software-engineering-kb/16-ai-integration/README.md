# 16 — AI Integration

> Build with AI — coding tools, LLM integration patterns, RAG systems, agents, evaluation, and production ML infrastructure.

## Structure (3 folders, 12 files)

### ai-coding-tools/ (2 files)
- [ai-assisted-development.md](ai-coding-tools/ai-assisted-development.md) — Copilot/Cursor/Claude Code/Cline/Aider landscape, FIM/RAG architecture, CLAUDE.md/.cursorrules config, SPACE metrics, team adoption
- [code-generation.md](ai-coding-tools/code-generation.md) — Template/AST/LLM-based generation, schema-driven (OpenAPI/GraphQL codegen/sqlc/Prisma/protobuf), AI failure modes, CI/CD pipelines

### llm-integration/ (6 files)
- [prompt-engineering.md](llm-integration/prompt-engineering.md) — Zero/few-shot, chain-of-thought, tool use/function calling, SE-specific prompts, prompt versioning, injection defense
- [api-integration-patterns.md](llm-integration/api-integration-patterns.md) — Anthropic/OpenAI/Vercel AI SDK, streaming (SSE), error handling, caching (prompt caching 90% savings), multi-provider abstraction, batch APIs
- [rag-retrieval-augmented.md](llm-integration/rag-retrieval-augmented.md) — Chunking strategies, embeddings, vector DBs (Pinecone/Qdrant/pgvector), hybrid search, re-ranking, HyDE, RAGAS evaluation
- [ai-agents.md](llm-integration/ai-agents.md) — ReAct/Plan-and-Execute, tool design (Anthropic/MCP), LangGraph/CrewAI/Agent SDK, memory systems, human-in-the-loop, safety guardrails
- [evaluation.md](llm-integration/evaluation.md) — LLM-as-judge, BERTScore, eval datasets, Braintrust/Promptfoo/LangSmith, CI/CD eval pipelines, A/B testing LLM features
- [cost-optimization.md](llm-integration/cost-optimization.md) — Token pricing comparison, prompt compression, caching strategies, model routing/cascading, batch APIs (50% savings), fine-tuning ROI, cost monitoring

### ml-in-production/ (4 files)
- [model-serving.md](ml-in-production/model-serving.md) — Online/batch/streaming inference, vLLM/Triton/Ollama, GPU acceleration, quantization (GPTQ/AWQ/GGUF), KV-cache, SageMaker/Vertex AI
- [monitoring.md](ml-in-production/monitoring.md) — Data/concept/prediction drift, statistical tests (KS/PSI), Evidently/Arize/WhyLabs, LLM-specific monitoring, feedback loops, model rollback
- [feature-stores.md](ml-in-production/feature-stores.md) — Feature engineering, Feast/Tecton/Hopsworks, point-in-time correctness, training-serving skew prevention, batch/streaming/on-demand pipelines
- [mlops.md](ml-in-production/mlops.md) — Maturity levels (0-2), MLflow/W&B experiment tracking, model registry, ML pipelines (ZenML/Kubeflow), DVC data versioning, LLMOps differences

## Cross-References

| Topic | This Section | Related Section |
|-------|-------------|----------------|
| AI best practices for coding | — (removed, fully covered) | [13-code-quality/ai-code-quality/writing-quality-code-with-ai.md](../13-code-quality/ai-code-quality/writing-quality-code-with-ai.md) |
| AI-assisted code review | — (cross-ref) | [13-code-quality/ai-code-quality/ai-assisted-review.md](../13-code-quality/ai-code-quality/ai-assisted-review.md) |
| RAG security | llm-integration/rag-retrieval-augmented.md | [08-security/ai-security/rag.md](../08-security/ai-security/rag.md) |
| LLM app security | llm-integration/prompt-engineering.md | [08-security/ai-security/](../08-security/ai-security/) |
| ML model security | ml-in-production/ | [08-security/ai-security/ml-models.md](../08-security/ai-security/ml-models.md) |
| A/B testing | llm-integration/evaluation.md | [15-product-engineering/analytics-telemetry/ab-testing.md](../15-product-engineering/analytics-telemetry/ab-testing.md) |
| Feature flags for rollout | llm-integration/api-integration-patterns.md | [12-devops/ci-cd/feature-flags.md](../12-devops-infrastructure/ci-cd/feature-flags.md) |
| Observability | ml-in-production/monitoring.md | [12-devops/monitoring-observability/](../12-devops-infrastructure/monitoring-observability/) |

## Perspective Differentiation

| Section | Focus |
|---------|-------|
| 08-security/ai-security | Security vulnerabilities in AI systems (injection, data leakage, model attacks) |
| 13-code-quality/ai-code-quality | Using AI to enforce and improve code quality (review, prompting for quality) |
| **16-ai-integration** | **Building AI-powered software — tools, APIs, RAG, agents, serving, MLOps** |
