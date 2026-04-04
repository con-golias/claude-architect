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
 * Get the current project path that the plugin is operating on.
 * Uses CLAUDE_PROJECT_PATH env var (set by bun-runner), falls back to cwd.
 *
 * @returns Absolute path to the project being analyzed
 */
export function getProjectPath(): string {
  return process.env.CLAUDE_PROJECT_PATH || process.cwd();
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
 * Get the software-engineering-kb directory path within the plugin.
 *
 * @returns Absolute path to the software-engineering-kb/ directory
 */
export function getKbDir(): string {
  return join(getPluginRoot(), "software-engineering-kb");
}

/**
 * Get the KB index file path in the data directory.
 *
 * @returns Absolute path to kb-index.json
 */
export function getKbIndexPath(): string {
  return join(getDataDir(), "kb-index.json");
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
 * Normalize MSYS/Git-Bash paths to Windows format.
 * Converts /c/Users/... → C:/Users/... for Bun compatibility on Windows.
 * Passes through non-MSYS paths unchanged.
 *
 * @param inputPath - Path that may be MSYS format
 * @returns Windows-compatible path
 */
export function normalizePlatformPath(inputPath: string): string {
  if (!inputPath) return inputPath;
  // MSYS pattern: /c/Users/... or /d/Projects/...
  const msysMatch = inputPath.match(/^\/([a-zA-Z])\/(.*)/);
  if (msysMatch) {
    return `${msysMatch[1].toUpperCase()}:/${msysMatch[2]}`;
  }
  return inputPath;
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
 * Check if a position in a line is inside a string literal.
 * Used to avoid false positives in pattern matching.
 *
 * @param line - The source line to check
 * @param matchStart - The character offset of the match within the line
 * @returns True if the position is inside a string literal
 */
export function isInsideStringLiteral(line: string, matchStart: number): boolean {
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  for (let i = 0; i < matchStart && i < line.length; i++) {
    if (i > 0 && line[i - 1] === "\\") continue;
    const ch = line[i];
    if (ch === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
    else if (ch === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
    else if (ch === "`" && !inDouble && !inSingle) inBacktick = !inBacktick;
  }
  return inSingle || inDouble || inBacktick;
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
