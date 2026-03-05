/**
 * MCP tool call handlers for claude-architect.
 * Routes tool calls to the Worker HTTP API.
 *
 * @module mcpHandlers
 */

import { logger } from "../utils/logger";
import { loadConfig } from "../utils/config";

const config = loadConfig();
const WORKER_BASE = `http://localhost:${config.workerPort}`;

/** Make HTTP requests to the Worker API */
export async function workerFetch(
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
      return "Use the architect tools to validate, search, and manage project architecture. Start with architect_check or architect_get_status.";

    case "architect_check": {
      const params = new URLSearchParams();
      params.set("project_path", args.project_path as string);
      if (args.categories) params.set("categories", (args.categories as string[]).join(","));
      if (args.severity) params.set("severity", args.severity as string);
      return JSON.stringify(await workerFetch(`/api/check?${params}`), null, 2);
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
      const params = new URLSearchParams();
      params.set("project_path", args.project_path as string);
      return JSON.stringify(await workerFetch(`/api/status?${params}`), null, 2);
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
  const projectPath = args.project_path as string;
  const projectRes = await workerFetch("/api/projects") as Array<{ id: string; path: string }>;
  const normalizedPath = projectPath.replace(/\\/g, "/");
  const project = Array.isArray(projectRes) ? projectRes.find(p => p.path === normalizedPath) : null;

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
