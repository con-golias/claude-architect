/**
 * Build script for claude-architect plugin.
 * Produces CommonJS bundles for MCP server and Worker service.
 */

import { existsSync, mkdirSync } from "fs";
import path from "path";

const SCRIPTS_DIR = path.resolve("scripts");

if (!existsSync(SCRIPTS_DIR)) {
  mkdirSync(SCRIPTS_DIR, { recursive: true });
}

async function buildMcpServer(): Promise<void> {
  const result = await Bun.build({
    entrypoints: ["src/servers/mcp-server.ts"],
    outdir: SCRIPTS_DIR,
    target: "bun",
    format: "cjs",
    naming: "mcp-server.cjs",
    minify: true,
    sourcemap: "external",
    external: ["bun:sqlite"],
  });

  if (!result.success) {
    console.error("MCP Server build failed:", result.logs);
    process.exit(1);
  }
  console.log("Built: scripts/mcp-server.cjs");
}

async function buildWorkerService(): Promise<void> {
  const result = await Bun.build({
    entrypoints: ["src/services/worker/WorkerServer.ts"],
    outdir: SCRIPTS_DIR,
    target: "bun",
    format: "cjs",
    naming: "worker-service.cjs",
    minify: true,
    sourcemap: "external",
    external: ["bun:sqlite", "express"],
  });

  if (!result.success) {
    console.error("Worker Service build failed:", result.logs);
    process.exit(1);
  }
  console.log("Built: scripts/worker-service.cjs");
}

async function main(): Promise<void> {
  console.log("Building claude-architect plugin...\n");

  await Promise.all([buildMcpServer(), buildWorkerService()]);

  console.log("\nBuild complete!");
}

main().catch((err) => {
  console.error("Build error:", err);
  process.exit(1);
});
