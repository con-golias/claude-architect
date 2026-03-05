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
import { TOOLS } from "./mcpTools";
import { handleToolCall } from "./mcpHandlers";

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
