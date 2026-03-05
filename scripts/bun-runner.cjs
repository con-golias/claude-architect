#!/usr/bin/env node

/**
 * Bun runtime helper for claude-architect plugin.
 * Routes script execution through Bun with proper path resolution.
 *
 * For the "start" command: spawns Worker server in the background (detached),
 * waits for it to be healthy, then exits. This prevents the hook from blocking.
 *
 * Usage: node bun-runner.js <script-name> [args...]
 */

const { spawnSync, spawn } = require("child_process");
const path = require("path");
const os = require("os");
const http = require("http");

const PLUGIN_ROOT =
  process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..");

const WORKER_PORT = process.env.ARCHITECT_PORT || "37778";

/**
 * Find the absolute path to the Bun executable.
 * Returns the full resolved path, not just "bun".
 */
function findBun() {
  const platform = os.platform();
  const candidates =
    platform === "win32"
      ? [
          path.join(os.homedir(), ".bun", "bin", "bun.exe"),
          path.join(
            process.env.LOCALAPPDATA || "",
            "bun",
            "bin",
            "bun.exe"
          ),
          "bun",
        ]
      : [
          path.join(os.homedir(), ".bun", "bin", "bun"),
          "/usr/local/bin/bun",
          "bun",
        ];

  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ["--version"], {
        stdio: "pipe",
        timeout: 5000,
        shell: platform === "win32",
      });
      if (result.status === 0) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Resolve a short command name to its full absolute path on Windows.
 * This is needed because detached spawn without shell can't resolve PATH.
 */
function resolveCommand(cmd) {
  if (path.isAbsolute(cmd)) return cmd;
  try {
    const result = spawnSync(
      process.platform === "win32" ? "where" : "which",
      [cmd],
      { stdio: "pipe", timeout: 5000, shell: process.platform === "win32" }
    );
    if (result.status === 0) {
      const resolved = result.stdout.toString().trim().split(/\r?\n/)[0];
      if (resolved) return resolved;
    }
  } catch { /* ignore */ }
  return cmd;
}

/** Check if worker is already healthy. */
function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(
      `http://localhost:${WORKER_PORT}/api/health`,
      (res) => resolve(res.statusCode === 200)
    );
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

/** Wait for worker to become healthy, polling every 500ms. */
async function waitForHealth(maxWait) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    if (await checkHealth()) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Start the worker server in the background (detached).
 * If already running, output "Success" immediately.
 */
async function startWorkerBackground(runtime, scriptPath, env) {
  if (await checkHealth()) {
    process.stdout.write("Success");
    return;
  }

  // Resolve to absolute path — detached spawn without shell can't use PATH
  const resolvedRuntime = resolveCommand(runtime);

  const args = runtime === "node"
    ? [scriptPath, "start"]
    : ["run", scriptPath, "start"];

  const child = spawn(resolvedRuntime, args, {
    cwd: PLUGIN_ROOT,
    env,
    stdio: "ignore",
    detached: true,
    windowsHide: true,
    // NO shell: true — prevents path corruption on Windows
  });
  child.unref();

  // Wait up to 10 seconds for the server to be ready
  const healthy = await waitForHealth(10000);
  if (healthy) {
    process.stdout.write("Success");
  } else {
    process.stderr.write(
      "[claude-architect] Worker server failed to start within 10s.\n"
    );
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write("[claude-architect] No script specified.\n");
    process.exit(1);
  }

  const scriptName = args[0];
  const scriptArgs = args.slice(1);
  const scriptPath = path.join(PLUGIN_ROOT, "scripts", scriptName);
  const originalCwd = process.cwd();

  const env = {
    ...process.env,
    CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT,
    CLAUDE_PROJECT_PATH: originalCwd,
  };

  const bunPath = findBun();
  const isStartCommand = scriptArgs[0] === "start";

  // Special handling: "start" spawns detached so server survives hook exit
  if (isStartCommand) {
    const runtime = bunPath || "node";
    await startWorkerBackground(runtime, scriptPath, env);
    return;
  }

  // All other commands: synchronous execution (hooks, etc.)
  if (!bunPath) {
    process.stderr.write(
      "[claude-architect] Bun not found. Falling back to Node.js.\n"
    );
    const result = spawnSync("node", [scriptPath, ...scriptArgs], {
      cwd: PLUGIN_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 300000,
      env,
      shell: true,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 0);
    return;
  }

  const result = spawnSync(bunPath, ["run", scriptPath, ...scriptArgs], {
    cwd: PLUGIN_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 300000,
    env,
    shell: process.platform === "win32",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status || 0);
}

main();
