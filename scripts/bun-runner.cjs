#!/usr/bin/env node

/**
 * Bun runtime helper for claude-architect plugin.
 * Routes script execution through Bun with proper path resolution.
 *
 * @description Executes plugin scripts via Bun runtime.
 * Usage: node bun-runner.js <script-name> [args...]
 */

const { spawnSync } = require("child_process");
const path = require("path");
const os = require("os");

const PLUGIN_ROOT =
  process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..");

function findBun() {
  const platform = os.platform();
  const candidates =
    platform === "win32"
      ? [
          "bun",
          path.join(os.homedir(), ".bun", "bin", "bun.exe"),
          path.join(
            process.env.LOCALAPPDATA || "",
            "bun",
            "bin",
            "bun.exe"
          ),
        ]
      : [
          "bun",
          path.join(os.homedir(), ".bun", "bin", "bun"),
          "/usr/local/bin/bun",
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

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write("[claude-architect] No script specified.\n");
    process.exit(1);
  }

  const scriptName = args[0];
  const scriptArgs = args.slice(1);
  const scriptPath = path.join(PLUGIN_ROOT, "scripts", scriptName);

  // Capture the original working directory before changing cwd to PLUGIN_ROOT.
  // Handlers use this to know which project they're operating on.
  const originalCwd = process.cwd();

  const bunPath = findBun();
  if (!bunPath) {
    process.stderr.write(
      "[claude-architect] Bun not found. Falling back to Node.js.\n"
    );
    const result = spawnSync("node", [scriptPath, ...scriptArgs], {
      cwd: PLUGIN_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 300000,
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, CLAUDE_PROJECT_PATH: originalCwd },
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
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, CLAUDE_PROJECT_PATH: originalCwd },
    shell: process.platform === "win32",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status || 0);
}

main();
