/**
 * Build script for claude-architect plugin.
 * Produces CommonJS bundles for MCP server and Worker service.
 */

import { existsSync, mkdirSync } from "fs";
import path from "path";
import { buildIndex } from "./src/services/kb/KbIndexBuilder";

const SCRIPTS_DIR = path.resolve("scripts");

if (!existsSync(SCRIPTS_DIR)) {
  mkdirSync(SCRIPTS_DIR, { recursive: true });
}

async function buildMcpServer(): Promise<void> {
  const result = await Bun.build({
    entrypoints: ["src/servers/mcp-server.ts"],
    outdir: SCRIPTS_DIR,
    target: "node",
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

function buildKbIndex(): void {
  const kbDir = path.resolve("software-engineering-kb");
  if (!existsSync(kbDir)) {
    console.log("Skipped: KB index (no software-engineering-kb/ directory)");
    return;
  }

  const dataDir = path.join(
    process.env.HOME || process.env.USERPROFILE || "~",
    ".claude-architect",
  );
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  const indexPath = path.join(dataDir, "kb-index.json");

  const stats = buildIndex(kbDir, indexPath);
  console.log(
    `Built: KB index (${stats.totalEntries} entries, ${stats.sizeKB}KB, ${stats.buildTimeMs}ms)`,
  );
}

async function main(): Promise<void> {
  console.log("Building claude-architect plugin...\n");

  await Promise.all([buildMcpServer(), buildWorkerService()]);

  // Build KB index sequentially (after bundles, uses source imports)
  buildKbIndex();

  console.log("\nBuild complete!");
}

main().catch((err) => {
  console.error("Build error:", err);
  process.exit(1);
});
