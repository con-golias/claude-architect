/**
 * Structured logging utility for claude-architect.
 * Outputs JSON to stderr (stdout reserved for MCP protocol).
 *
 * @module logger
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel =
  (process.env.ARCHITECT_LOG_LEVEL as LogLevel) || "info";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  [key: string]: unknown;
}

/**
 * Write a structured log entry to stderr.
 *
 * @param level - Log severity level
 * @param message - Human-readable message
 * @param context - Additional context fields
 */
function writeLog(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: "claude-architect",
    message,
    ...context,
  };

  process.stderr.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  /** @param message - Debug message (disabled in production) */
  debug: (message: string, context?: Record<string, unknown>) =>
    writeLog("debug", message, context),

  /** @param message - Informational message */
  info: (message: string, context?: Record<string, unknown>) =>
    writeLog("info", message, context),

  /** @param message - Warning message */
  warn: (message: string, context?: Record<string, unknown>) =>
    writeLog("warn", message, context),

  /** @param message - Error message requiring attention */
  error: (message: string, context?: Record<string, unknown>) =>
    writeLog("error", message, context),
};
