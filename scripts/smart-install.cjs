#!/usr/bin/env node

/**
 * Cross-platform installer for claude-architect plugin.
 * Installs Bun runtime if not available, then installs dependencies.
 *
 * @description Ensures Bun runtime and npm dependencies are ready.
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PLUGIN_ROOT =
  process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..");

function log(message) {
  process.stderr.write(`[claude-architect] ${message}\n`);
}

function isBunInstalled() {
  try {
    const result = spawnSync("bun", ["--version"], {
      stdio: "pipe",
      timeout: 10000,
      shell: true,
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function installBun() {
  const platform = os.platform();
  log("Bun not found. Installing...");

  try {
    if (platform === "win32") {
      execSync("powershell -c \"irm bun.sh/install.ps1 | iex\"", {
        stdio: "pipe",
        timeout: 120000,
      });
    } else {
      execSync("curl -fsSL https://bun.sh/install | bash", {
        stdio: "pipe",
        timeout: 120000,
      });
    }
    log("Bun installed successfully.");
  } catch (err) {
    log(`Warning: Could not install Bun automatically: ${err.message}`);
    log("Please install Bun manually: https://bun.sh/docs/installation");
    return false;
  }
  return true;
}

function installDependencies() {
  const packageJsonPath = path.join(PLUGIN_ROOT, "package.json");
  const nodeModulesPath = path.join(PLUGIN_ROOT, "node_modules");

  if (!fs.existsSync(packageJsonPath)) {
    log("No package.json found, skipping dependency installation.");
    return true;
  }

  if (fs.existsSync(nodeModulesPath)) {
    log("Dependencies already installed.");
    return true;
  }

  log("Installing dependencies...");
  try {
    const result = spawnSync("bun", ["install", "--frozen-lockfile"], {
      cwd: PLUGIN_ROOT,
      stdio: "pipe",
      timeout: 120000,
      shell: true,
    });

    if (result.status !== 0) {
      spawnSync("bun", ["install"], {
        cwd: PLUGIN_ROOT,
        stdio: "pipe",
        timeout: 120000,
        shell: true,
      });
    }

    log("Dependencies installed.");
    return true;
  } catch (err) {
    log(`Warning: Could not install dependencies: ${err.message}`);
    return false;
  }
}

function ensureDataDir() {
  const dataDir = path.join(os.homedir(), ".claude-architect");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    log(`Created data directory: ${dataDir}`);
  }
  return dataDir;
}

function main() {
  log("Setting up claude-architect plugin...");

  if (!isBunInstalled()) {
    if (!installBun()) {
      log("Setup completed with warnings (Bun not available).");
      process.stdout.write("Success");
      return;
    }
  }

  installDependencies();
  ensureDataDir();

  log("Setup complete.");
  process.stdout.write("Success");
}

main();
