/**
 * Configuration loader for claude-architect.
 * Reads environment variables and provides typed config.
 *
 * @module config
 */

export interface ArchitectConfig {
  /** Port for the Worker HTTP API server */
  workerPort: number;
  /** Log level: debug | info | warn | error */
  logLevel: string;
  /** SQLite database path */
  databasePath: string;
  /** Plugin root directory */
  pluginRoot: string;
  /** Minimum sessions before self-improvement triggers */
  improvementMinSessions: number;
}

/**
 * Load configuration from environment variables with defaults.
 *
 * @returns Resolved configuration object
 */
export function loadConfig(): ArchitectConfig {
  return {
    workerPort: parseInt(process.env.ARCHITECT_PORT || "37778", 10),
    logLevel: process.env.ARCHITECT_LOG_LEVEL || "info",
    databasePath:
      process.env.ARCHITECT_DB_PATH || "",
    pluginRoot: process.env.CLAUDE_PLUGIN_ROOT || process.cwd(),
    improvementMinSessions: parseInt(
      process.env.ARCHITECT_IMPROVEMENT_MIN_SESSIONS || "5",
      10
    ),
  };
}
