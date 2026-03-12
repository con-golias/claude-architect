# AI Agents & Agentic Systems

| Attribute | Value |
|-----------|-------|
| Domain | AI Integration > LLM Integration |
| Importance | Critical |
| Last Updated | 2026-03-10 |
| Cross-ref | [Prompt Engineering](prompt-engineering.md), [API Integration Patterns](api-integration-patterns.md) |

---

## Agent Fundamentals

### The Reasoning Loop

An AI agent is an LLM that autonomously decides which actions to take to accomplish a goal. Unlike simple prompt-response systems, agents operate in a loop:

```
Observe (read input/tool results)
    --> Think (reason about next step)
        --> Act (call tool or respond)
            --> Observe (read result) --> ...
```

### Agent vs. Chain vs. Pipeline

| Approach | Control Flow | Autonomy | Use Case |
|----------|-------------|----------|----------|
| Pipeline | Fixed sequence | None | Deterministic workflows |
| Chain | Fixed with branching | Low | Conditional logic |
| Agent | Dynamic, LLM-decided | High | Open-ended tasks |
| Multi-agent | Multiple autonomous loops | Very high | Complex collaboration |

---

## Agent Architectures

### ReAct (Reasoning + Acting)

The agent alternates between reasoning traces and actions:

```python
from anthropic import Anthropic

client = Anthropic()
tools = [...]  # Tool definitions with name, description, input_schema

def run_agent(user_message: str) -> str:
    messages = [{"role": "user", "content": user_message}]
    while True:
        response = client.messages.create(
            model="claude-sonnet-4-5-20250514",
            max_tokens=4096,
            system="You are a helpful customer support agent.",
            tools=tools,
            messages=messages,
        )
        if response.stop_reason == "end_turn":
            return response.content[0].text

        # Process tool calls
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })
        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})
```

### Plan-and-Execute

Separate planning from execution for complex multi-step tasks:

```
1. Planner LLM creates a step-by-step plan
2. Executor LLM carries out each step using tools
3. Replanner reviews progress and adjusts remaining steps
```

### Multi-Agent Systems

Multiple specialized agents collaborate through message passing:

```
Orchestrator Agent
    |-- Research Agent (web search, document retrieval)
    |-- Code Agent (code generation, testing)
    |-- Review Agent (quality checks, validation)
```

---

## Tool Design

### Function Calling Schema (Anthropic)

Design tools with clear names, descriptions, and strongly typed schemas:

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const tools: Anthropic.Tool[] = [
  {
    name: "create_ticket",
    description:
      "Create a support ticket. Use when the user reports a problem " +
      "that cannot be resolved immediately.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Brief ticket summary" },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Ticket priority based on impact",
        },
        description: { type: "string", description: "Detailed description" },
      },
      required: ["title", "priority", "description"],
    },
  },
];

// Tool result handling
function formatToolResult(result: unknown): string {
  if (result instanceof Error) {
    return JSON.stringify({ error: result.message, success: false });
  }
  return JSON.stringify({ data: result, success: true });
}
```

### MCP (Model Context Protocol) Integration

MCP provides a standard protocol for agents to discover and use tools:

```typescript
// MCP server exposing tools
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({ name: "database-tools", version: "1.0.0" });

server.tool(
  "query_database",
  "Execute a read-only SQL query against the analytics database",
  { query: z.string().describe("SQL SELECT query to execute") },
  async ({ query }) => {
    const result = await db.query(query);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);
```

---

## Agent Frameworks (2026)

| Framework | Approach | Stars | Best For |
|-----------|----------|-------|----------|
| LangGraph | Graph-based state machines | 25k+ | Complex workflows, precise control |
| CrewAI | Role-based agent teams | 44k+ | Multi-agent collaboration |
| Anthropic Agent SDK | Session-managed agents | -- | Claude-native agent building |
| Vercel AI SDK | Streaming-first, React hooks | 15k+ | Full-stack TypeScript apps |
| OpenAI Agents SDK | Handoff-based orchestration | -- | GPT ecosystem |
| Strands Agents (AWS) | Event-driven, AWS-native | -- | AWS-integrated workflows |

### LangGraph Example

```python
from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode

def should_continue(state: MessagesState) -> str:
    last = state["messages"][-1]
    if last.tool_calls:
        return "tools"
    return END

def call_model(state: MessagesState) -> dict:
    response = llm_with_tools.invoke(state["messages"])
    return {"messages": [response]}

graph = StateGraph(MessagesState)
graph.add_node("agent", call_model)
graph.add_node("tools", ToolNode(tools=[search, calculator]))
graph.add_edge(START, "agent")
graph.add_conditional_edges("agent", should_continue, ["tools", END])
graph.add_edge("tools", "agent")

app = graph.compile()
result = app.invoke({"messages": [("user", "Analyze Q4 revenue trends")]})
```

---

## Memory Systems

### Memory Types

| Type | Storage | Lifespan | Purpose |
|------|---------|----------|---------|
| Short-term | Conversation messages | Per session | Immediate context |
| Long-term | Vector store | Persistent | Facts, preferences |
| Episodic | Structured store | Persistent | Past interactions, outcomes |
| Working | State object | Per task | Intermediate results |

```python
# Long-term memory with vector store
class AgentMemory:
    def __init__(self, vector_store, embedding_model):
        self.vector_store = vector_store
        self.embedding_model = embedding_model

    async def remember(self, content: str, metadata: dict) -> None:
        embedding = await self.embedding_model.embed(content)
        await self.vector_store.upsert(
            id=metadata["id"],
            vector=embedding,
            payload={"content": content, **metadata},
        )

    async def recall(self, query: str, limit: int = 5) -> list[str]:
        embedding = await self.embedding_model.embed(query)
        results = await self.vector_store.search(embedding, limit=limit)
        return [r.payload["content"] for r in results]
```

---

## Human-in-the-Loop

### Approval Workflows

Define which actions require human approval based on risk level:

```python
APPROVAL_RULES = {
    "read_database": "auto",        # Low risk: auto-approve
    "send_email": "confirm",        # Medium risk: ask user
    "delete_record": "require",     # High risk: require explicit approval
    "execute_payment": "require",   # High risk: require explicit approval
}

async def execute_with_approval(tool_name: str, args: dict) -> str:
    rule = APPROVAL_RULES.get(tool_name, "confirm")

    if rule == "auto":
        return await execute_tool(tool_name, args)
    elif rule == "confirm":
        approved = await request_user_confirmation(
            f"Agent wants to {tool_name} with {args}. Approve?"
        )
        if approved:
            return await execute_tool(tool_name, args)
        return "Action denied by user."
    elif rule == "require":
        token = await require_explicit_approval(tool_name, args)
        return await execute_tool(tool_name, args, approval_token=token)
```

---

## Safety Guardrails

### Action Limits and Budget Caps

```typescript
interface AgentConstraints {
  maxIterations: number;       // Prevent infinite loops
  maxToolCalls: number;        // Limit total tool invocations
  maxTokenBudget: number;      // Cap spending per session
  timeoutMs: number;           // Hard timeout
  allowedTools: string[];      // Whitelist of permitted tools
  blockedPatterns: RegExp[];   // Patterns to reject in outputs
}

const DEFAULT_CONSTRAINTS: AgentConstraints = {
  maxIterations: 25,
  maxToolCalls: 50,
  maxTokenBudget: 100_000,
  timeoutMs: 300_000, // 5 minutes
  allowedTools: ["search", "read_file", "create_ticket"],
  blockedPatterns: [/rm -rf/, /DROP TABLE/, /DELETE FROM/],
};

function validateToolCall(
  name: string,
  input: Record<string, unknown>,
  constraints: AgentConstraints
): boolean {
  if (!constraints.allowedTools.includes(name)) return false;
  const inputStr = JSON.stringify(input);
  return !constraints.blockedPatterns.some((p) => p.test(inputStr));
}
```

### Output Validation

Validate agent outputs before returning to the user:

```python
async def validate_agent_output(output: str) -> tuple[bool, str]:
    # Check for PII leakage
    if contains_pii(output):
        return False, "Output contains PII. Redacting."

    # Check for harmful content
    moderation = await moderate_content(output)
    if not moderation.safe:
        return False, "Output flagged by moderation."

    # Check factual grounding (for RAG-backed agents)
    if not is_grounded_in_sources(output, retrieved_sources):
        return False, "Output not grounded in retrieved sources."

    return True, output
```

---

## Real-World Agent Patterns

| Pattern | Description | Key Tools |
|---------|-------------|-----------|
| Coding agent | Reads codebase, writes/edits code, runs tests | File I/O, shell, LSP |
| Research agent | Searches web, synthesizes findings, cites sources | Web search, RAG |
| Customer support | Looks up orders, resolves issues, escalates | CRM, ticketing, KB |
| Data analysis | Queries databases, generates charts, explains | SQL, Python, visualization |
| Workflow automation | Triggers actions across systems via API | HTTP, webhooks, queues |

---

## 10 Best Practices

1. **Design tools with clear, specific descriptions.** The LLM selects tools based on descriptions. Vague descriptions cause wrong tool selection. Include when to use and when not to use each tool.
2. **Implement the minimal reasoning loop first.** Start with a simple ReAct loop before adding planning, memory, or multi-agent orchestration. Complexity should be justified by measured failures.
3. **Set hard limits on iterations and token spend.** Every agent loop must have a maximum iteration count, token budget, and wall-clock timeout to prevent runaway costs.
4. **Use structured outputs for tool results.** Return JSON with consistent `{data, error, success}` shapes so the agent can reliably parse results.
5. **Log every tool call and reasoning step.** Full observability is essential for debugging and auditing. Log the complete message history for every session.
6. **Require human approval for high-risk actions.** Classify tools by risk level. Auto-approve reads, confirm writes, require explicit approval for destructive or financial operations.
7. **Validate agent outputs before returning to users.** Check for PII leakage, harmful content, and factual grounding. Never expose raw LLM output without validation.
8. **Use MCP for tool integration.** The Model Context Protocol standardizes tool discovery and invocation. Implement MCP servers instead of bespoke tool integrations.
9. **Keep agent context focused.** Summarize long conversation histories instead of sending full transcripts. Prune irrelevant tool results from context.
10. **Test agents with adversarial scenarios.** Prompt injection, ambiguous instructions, and edge cases must be part of the test suite. Agents that handle tools are attack surfaces.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| No iteration limit on agent loop | Infinite loops, runaway costs | Set maxIterations and token budget caps |
| Overly broad tool descriptions | Agent selects wrong tools | Write specific descriptions with usage conditions |
| Returning full database results to agent | Context overflow, slow responses | Paginate and summarize tool results |
| No human-in-the-loop for writes | Unreviewed destructive actions | Classify tools by risk, require approval for writes |
| Monolithic single-agent for complex tasks | Poor reasoning, context overflow | Split into specialized agents with orchestrator |
| Storing full conversation as memory | Context grows unbounded | Summarize periodically, use vector memory for recall |
| No output validation | PII leaks, harmful content | Add moderation and grounding checks |
| Hardcoding tool integrations | Fragile, non-portable agents | Use MCP for standardized tool interfaces |

---

## Enforcement Checklist

- [ ] Agent loop has hard limits (max iterations, token budget, timeout)
- [ ] All tools have clear descriptions with usage conditions
- [ ] Tool schemas use strong typing with required/optional fields
- [ ] Human-in-the-loop configured for medium and high-risk actions
- [ ] Output validation pipeline (PII, moderation, grounding) active
- [ ] Full logging of reasoning steps and tool calls
- [ ] MCP used for tool integration where available
- [ ] Adversarial testing (prompt injection, ambiguous input) completed
- [ ] Memory management strategy defined (summarization, pruning)
- [ ] Cost monitoring and alerting configured per agent session
- [ ] Error handling returns structured errors to agent (not stack traces)
- [ ] Agent tested with real user scenarios before production deployment
