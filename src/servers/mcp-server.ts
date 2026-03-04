/**
 * MCP (Model Context Protocol) server for claude-architect.
 * Exposes architecture tools to Claude Code via stdio transport.
 * Thin wrapper that delegates to the Worker HTTP API.
 *
 * @module mcp-server
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../utils/logger";
import { loadConfig } from "../utils/config";

const config = loadConfig();
const WORKER_BASE = `http://localhost:${config.workerPort}`;

/** Make HTTP requests to the Worker API */
async function workerFetch(
  path: string,
  options?: RequestInit
): Promise<unknown> {
  const url = `${WORKER_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    return await res.json();
  } catch (err) {
    logger.error("Worker API request failed", {
      path,
      error: (err as Error).message,
    });
    return { error: `Worker API unavailable: ${(err as Error).message}` };
  }
}

/** Tool definitions for Claude Code */
const TOOLS = [
  {
    name: "__IMPORTANT",
    description:
      "ARCHITECTURE WORKFLOW: 1. architect_check(project_path) → Get compliance report with score. 2. architect_search(query) → Find decisions/violations/history. 3. architect_get_details(ids, type) → Fetch full details. Use architect_scaffold for new features. NEVER fetch details without filtering first.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "architect_check",
    description:
      "Validate project against architecture rules. Returns compliance score (0-100), violations list, and feature map.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_path: {
          type: "string",
          description: "Absolute path to project root",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description:
            'Filter categories: "dependency", "structure", "security", "quality", "docs"',
        },
        severity: {
          type: "string",
          enum: ["critical", "warning", "info"],
          description: "Minimum severity to report",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "architect_scaffold",
    description:
      "Generate a new feature with clean architecture folder structure (domain/application/infrastructure layers, README, tests).",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_path: {
          type: "string",
          description: "Absolute path to project root",
        },
        feature_name: {
          type: "string",
          description: "Feature name in kebab-case",
        },
        description: {
          type: "string",
          description: "What this feature does (for README)",
        },
        with_tests: {
          type: "boolean",
          description: "Generate test stubs (default: true)",
        },
      },
      required: ["project_path", "feature_name"],
    },
  },
  {
    name: "architect_log_decision",
    description:
      "Record an architectural decision (ADR) in the project history database.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_path: {
          type: "string",
          description: "Absolute path to project root",
        },
        title: { type: "string", description: "Decision title" },
        context: {
          type: "string",
          description: "Why this decision is needed",
        },
        decision: { type: "string", description: "What was decided" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              pros: { type: "array", items: { type: "string" } },
              cons: { type: "array", items: { type: "string" } },
            },
          },
          description: "Considered alternatives",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Categorization tags",
        },
      },
      required: ["project_path", "title", "context", "decision"],
    },
  },
  {
    name: "architect_search",
    description:
      "Search project architectural history (decisions, violations, changes). Step 1: returns compact index with IDs (~50 tokens/result). ALWAYS filter before fetching details.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search term" },
        project_path: {
          type: "string",
          description: "Filter by project path",
        },
        type: {
          type: "string",
          enum: ["decisions", "violations", "changes", "sessions"],
          description: "Filter by event type",
        },
        status: { type: "string", description: "Filter by status" },
        dateStart: { type: "string", description: "Start date (YYYY-MM-DD)" },
        dateEnd: { type: "string", description: "End date (YYYY-MM-DD)" },
        limit: {
          type: "number",
          description: "Max results (default 20, max 100)",
        },
      },
    },
  },
  {
    name: "architect_timeline",
    description:
      "Get chronological context around a specific event. Step 2 of search workflow.",
    inputSchema: {
      type: "object" as const,
      properties: {
        anchor: {
          type: "number",
          description: "Event ID to center around",
        },
        query: {
          type: "string",
          description: "Find anchor automatically from query",
        },
        project_path: { type: "string", description: "Project path filter" },
        depth_before: {
          type: "number",
          description: "Items before anchor (default 5)",
        },
        depth_after: {
          type: "number",
          description: "Items after anchor (default 5)",
        },
      },
    },
  },
  {
    name: "architect_get_details",
    description:
      "Fetch full details for specific IDs. Step 3: NEVER call without filtering first (10x token savings).",
    inputSchema: {
      type: "object" as const,
      properties: {
        ids: {
          type: "array",
          items: { type: "number" },
          description: "Event IDs to fetch",
        },
        type: {
          type: "string",
          enum: ["decisions", "violations", "changes"],
          description: "Type of events to fetch",
        },
      },
      required: ["ids", "type"],
    },
  },
  {
    name: "architect_get_status",
    description:
      "Get project health dashboard: compliance score, violation counts, trend, recent decisions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_path: {
          type: "string",
          description: "Absolute path to project root",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "architect_get_rules",
    description:
      "Get architecture rules relevant to a specific file or category. Returns rule content trimmed for token efficiency.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description:
            "File being edited (to match path-scoped rules)",
        },
        category: {
          type: "string",
          description: "Rule category filter (e.g., security, architecture)",
        },
      },
    },
  },
  {
    name: "architect_improve",
    description:
      "Analyze violation patterns and suggest rule improvements (self-improvement engine). Requires 5+ sessions of data.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_path: {
          type: "string",
          description: "Project path (or empty for global analysis)",
        },
        min_sessions: {
          type: "number",
          description: "Minimum sessions needed (default 5)",
        },
      },
    },
  },
];

/** Handle tool execution */
async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "__IMPORTANT":
      return "Use the architect tools to validate, search, and manage project architecture. Start with architect_check or architect_get_status.";

    case "architect_check": {
      const params = new URLSearchParams();
      params.set("project_path", args.project_path as string);
      if (args.categories)
        params.set("categories", (args.categories as string[]).join(","));
      if (args.severity) params.set("severity", args.severity as string);
      const result = await workerFetch(`/api/check?${params}`);
      return JSON.stringify(result, null, 2);
    }

    case "architect_scaffold": {
      const result = await workerFetch("/api/scaffold", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(result, null, 2);
    }

    case "architect_log_decision": {
      const result = await workerFetch("/api/decisions", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(result, null, 2);
    }

    case "architect_search": {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
      const result = await workerFetch(`/api/search?${params}`);
      return JSON.stringify(result, null, 2);
    }

    case "architect_timeline": {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      }
      const result = await workerFetch(`/api/timeline?${params}`);
      return JSON.stringify(result, null, 2);
    }

    case "architect_get_details": {
      const result = await workerFetch("/api/details/batch", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return JSON.stringify(result, null, 2);
    }

    case "architect_get_status": {
      const params = new URLSearchParams();
      params.set("project_path", args.project_path as string);
      const result = await workerFetch(`/api/status?${params}`);
      return JSON.stringify(result, null, 2);
    }

    case "architect_get_rules": {
      const params = new URLSearchParams();
      if (args.file_path) params.set("file_path", args.file_path as string);
      if (args.category) params.set("category", args.category as string);
      const result = await workerFetch(`/api/rules?${params}`);
      return JSON.stringify(result, null, 2);
    }

    case "architect_improve": {
      const params = new URLSearchParams();
      if (args.project_path)
        params.set("project_path", args.project_path as string);
      if (args.min_sessions)
        params.set("min_sessions", String(args.min_sessions));
      const result = await workerFetch(`/api/improvements?${params}`);
      return JSON.stringify(result, null, 2);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

/** Start the MCP server */
async function main(): Promise<void> {
  const server = new Server(
    { name: "claude-architect", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await handleToolCall(name, (args as Record<string, unknown>) || {});
      return {
        content: [{ type: "text" as const, text: result }],
      };
    } catch (err) {
      logger.error("Tool call failed", { name, error: (err as Error).message });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ error: (err as Error).message }),
          },
        ],
        isError: true,
      };
    }
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP server started (stdio)");

  // Parent process heartbeat — exit if parent dies
  const heartbeat = setInterval(() => {
    try {
      process.kill(process.ppid, 0);
    } catch {
      clearInterval(heartbeat);
      process.exit(0);
    }
  }, 5000);
}

main().catch((err) => {
  logger.error("MCP server failed to start", { error: err.message });
  process.exit(1);
});
