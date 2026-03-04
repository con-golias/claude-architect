/**
 * Path utilities for claude-architect.
 * Resolves data directory and plugin paths cross-platform.
 *
 * @module paths
 */

import { homedir } from "os";
import { join, resolve, normalize } from "path";
import { existsSync, mkdirSync } from "fs";

const DATA_DIR_NAME = ".claude-architect";

/**
 * Get the plugin root directory.
 *
 * @returns Absolute path to the plugin installation directory
 */
export function getPluginRoot(): string {
  return process.env.CLAUDE_PLUGIN_ROOT || resolve(__dirname, "..", "..");
}

/**
 * Get the persistent data directory (~/.claude-architect/).
 * Creates the directory if it doesn't exist.
 *
 * @returns Absolute path to the data directory
 */
export function getDataDir(): string {
  const dataDir = join(homedir(), DATA_DIR_NAME);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

/**
 * Get the SQLite database file path.
 *
 * @returns Absolute path to architect.sqlite
 */
export function getDatabasePath(): string {
  return join(getDataDir(), "architect.sqlite");
}

/**
 * Get the rules directory path within the plugin.
 *
 * @returns Absolute path to the rules/ directory
 */
export function getRulesDir(): string {
  return join(getPluginRoot(), "rules");
}

/**
 * Get the templates directory path within the plugin.
 *
 * @returns Absolute path to the templates/ directory
 */
export function getTemplatesDir(): string {
  return join(getPluginRoot(), "templates");
}

/**
 * Normalize a file path for consistent cross-platform comparison.
 *
 * @param filePath - Path to normalize
 * @returns Normalized path with forward slashes
 */
export function normalizePath(filePath: string): string {
  return normalize(filePath).replace(/\\/g, "/");
}

/**
 * Check if a path is inside a given directory.
 *
 * @param filePath - Path to check
 * @param dirPath - Directory to check against
 * @returns True if filePath is inside dirPath
 */
export function isInsideDir(filePath: string, dirPath: string): boolean {
  const normalizedFile = normalizePath(resolve(filePath));
  const normalizedDir = normalizePath(resolve(dirPath));
  return normalizedFile.startsWith(normalizedDir + "/");
}

/**
 * Synchronously find files matching a glob pattern within a directory.
 * Uses Bun.Glob with scanSync for correct Bun API usage.
 *
 * @param pattern - Glob pattern (e.g., "**\/*.{ts,tsx}")
 * @param cwd - Directory to search in
 * @returns Array of matching file paths relative to cwd
 */
export function globSync(pattern: string, cwd: string): string[] {
  const glob = new Bun.Glob(pattern);
  return Array.from(glob.scanSync({ cwd, dot: false }));
}
