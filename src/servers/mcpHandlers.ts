/**
 * MCP tool call handlers for claude-architect.
 * Routes tool calls to the Worker HTTP API.
 * Auto-starts the worker if it's not running.
 *
 * @module mcpHandlers
 */

import { spawn } from "child_process";
import { dirname, join } from "path";
import { logger } from "../utils/logger";
import { loadConfig } from "../utils/config";

const config = loadConfig();
const WORKER_BASE = `http://localhost:${config.workerPort}`;
const DASHBOARD_URL = `http://localhost:${config.workerPort}`;

/** Scripts directory — derived from process.argv[1] (the running .cjs file) */
const SCRIPTS_DIR = dirname(process.argv[1] || __dirname);

let autoStartAttempted = false;

/** Try to auto-start the worker server if it's not running. */
async function tryAutoStartWorker(): Promise<boolean> {
  if (autoStartAttempted) return false;
  autoStartAttempted = true;
  logger.info("Worker not running — attempting auto-start");
  try {
    const bunRunner = join(SCRIPTS_DIR, "bun-runner.cjs");
    const child = spawn("node", [bunRunner, "worker-service.cjs", "start"], {
      stdio: "ignore",
      detached: true,
      cwd: join(SCRIPTS_DIR, ".."),
    });
    child.unref();
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const res = await fetch(`${WORKER_BASE}/api/health`);
        if (res.ok) { logger.info("Worker auto-started successfully"); return true; }
      } catch { /* polling */ }
    }
  } catch (err) {
    logger.error("Auto-start failed", { error: (err as Error).message });
  }
  return false;
}

/** Make HTTP requests to the Worker API. Auto-starts worker on first failure. */
export async function workerFetch(
  path: string,
  options?: RequestInit
): Promise<unknown> {
  const url = `${WORKER_BASE}${path}`;
  const fetchOpts = {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  };
  try {
    const res = await fetch(url, fetchOpts);
    if (!res.ok) {
      const body = await res.text();
      return { error: `Worker API error (${res.status}): ${body}` };
    }
    return await res.json();
  } catch (err) {
    // Worker unreachable — try auto-start and retry once
    const started = await tryAutoStartWorker();
    if (started) {
      try {
        const res = await fetch(url, fetchOpts);
        if (!res.ok) {
          const body = await res.text();
          return { error: `Worker API error (${res.status}): ${body}` };
        }
        return await res.json();
      } catch (retryErr) {
        logger.error("Worker API retry failed", { path, error: (retryErr as Error).message });
        return { error: `Worker unavailable after auto-start: ${(retryErr as Error).message}` };
      }
    }
    logger.error("Worker API request failed", { path, error: (err as Error).message });
    return { error: `Worker API unavailable: ${(err as Error).message}` };
  }
}

/** Handle tool execution by routing to Worker API */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "__IMPORTANT":
      return `Architecture enforcement plugin active. Tools: architect_check, architect_get_status, architect_scaffold, architect_search, architect_log_decision, architect_get_rules, architect_improve, architect_get_templates, architect_configure_rules.\n\nIMPORTANT: Always tell the user about the live dashboard at ${DASHBOARD_URL} when presenting architecture results.`;

    case "architect_check": {
      if (!args.project_path || typeof args.project_path !== "string") {
        return JSON.stringify({ error: "project_path is required" });
      }
      const params = new URLSearchParams();
      params.set("project_path", args.project_path);
      if (args.categories) params.set("categories", (args.categories as string[]).join(","));
      if (args.severity) params.set("severity", args.severity as string);
      const result = await workerFetch(`/api/check?${params}`);
      return JSON.stringify(result, null, 2) +
        `\n\n[Live dashboard with full details: ${DASHBOARD_URL}]`;
    }

    case "architect_scaffold":
      return JSON.stringify(await workerFetch("/api/scaffold", { method: "POST", body: JSON.stringify(args) }), null, 2);

    case "architect_log_decision":
      return JSON.stringify(await workerFetch("/api/decisions", { method: "POST", body: JSON.stringify(args) }), null, 2);

    case "architect_search":
    case "architect_timeline": {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined && value !== null) params.set(key, String(value));
      }
      const endpoint = name === "architect_search" ? "/api/search" : "/api/timeline";
      return JSON.stringify(await workerFetch(`${endpoint}?${params}`), null, 2);
    }

    case "architect_get_details":
      return JSON.stringify(await workerFetch("/api/details/batch", { method: "POST", body: JSON.stringify(args) }), null, 2);

    case "architect_get_status": {
      if (!args.project_path || typeof args.project_path !== "string") {
        return JSON.stringify({ error: "project_path is required" });
      }
      const params = new URLSearchParams();
      params.set("project_path", args.project_path);
      const statusResult = await workerFetch(`/api/status?${params}`);
      return JSON.stringify(statusResult, null, 2) +
        `\n\n[Live dashboard: ${DASHBOARD_URL}]`;
    }

    case "architect_get_rules": {
      const params = new URLSearchParams();
      if (args.project_path) params.set("project_path", args.project_path as string);
      if (args.file_path) params.set("file_path", args.file_path as string);
      if (args.category) params.set("category", args.category as string);
      return JSON.stringify(await workerFetch(`/api/rules?${params}`), null, 2);
    }

    case "architect_improve": {
      const params = new URLSearchParams();
      if (args.project_path) params.set("project_path", args.project_path as string);
      if (args.min_sessions) params.set("min_sessions", String(args.min_sessions));
      return JSON.stringify(await workerFetch(`/api/improvements?${params}`), null, 2);
    }

    case "architect_get_templates": {
      if (args.name) {
        return JSON.stringify(await workerFetch(`/api/templates/${encodeURIComponent(args.name as string)}`), null, 2);
      }
      return JSON.stringify(await workerFetch("/api/templates"), null, 2);
    }

    case "architect_configure_rules":
      return handleConfigureRules(args);

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

/** Handle rule configuration (enable/disable manual rules) */
async function handleConfigureRules(args: Record<string, unknown>): Promise<string> {
  const projectPath = args.project_path;
  if (!projectPath || typeof projectPath !== "string") {
    return JSON.stringify({ error: "project_path is required" });
  }
  const projectRes = await workerFetch("/api/projects");
  if (!Array.isArray(projectRes)) {
    return JSON.stringify({ error: "Worker API unavailable. Ensure the worker server is running." });
  }
  const normalizedPath = projectPath.replace(/\\/g, "/");
  const project = projectRes.find((p: { id: string; path: string }) => p.path === normalizedPath);

  if (!project) {
    return JSON.stringify({ error: "Project not registered. Run /architect-init first." });
  }

  if (args.list_available) {
    return JSON.stringify(await workerFetch(`/api/projects/${project.id}/rules`), null, 2);
  }

  const configRes = await workerFetch(`/api/projects/${project.id}/rules`) as {
    enabledManualRules: string[];
    manualRules: Array<{ id: string }>;
  };
  const current = new Set(configRes.enabledManualRules ?? []);
  const validManual = new Set((configRes.manualRules ?? []).map(r => r.id));

  if (Array.isArray(args.enable)) {
    for (const id of args.enable as string[]) {
      if (validManual.has(id)) current.add(id);
    }
  }
  if (Array.isArray(args.disable)) {
    for (const id of args.disable as string[]) current.delete(id);
  }

  const result = await workerFetch(`/api/projects/${project.id}/rules`, {
    method: "POST",
    body: JSON.stringify({ enabled: [...current] }),
  });
  return JSON.stringify(result, null, 2);
}
