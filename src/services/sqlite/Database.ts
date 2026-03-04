/**
 * SQLite database connection manager for claude-architect.
 * Handles connection lifecycle, pragma configuration, and migrations.
 *
 * @module Database
 */

import { Database as BunDatabase } from "bun:sqlite";
import { getDatabasePath } from "../../utils/paths";
import { logger } from "../../utils/logger";
import { runMigrations } from "./migrations";

let instance: BunDatabase | null = null;

/**
 * Configure SQLite pragmas for optimal performance.
 *
 * @param db - SQLite database instance
 */
function configurePragmas(db: BunDatabase): void {
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA synchronous = NORMAL");
  db.run("PRAGMA foreign_keys = ON");
  db.run("PRAGMA temp_store = MEMORY");
  db.run("PRAGMA mmap_size = 268435456");
  db.run("PRAGMA cache_size = 10000");
}

/**
 * Get or create the singleton database connection.
 * Runs migrations on first connection.
 *
 * @param dbPath - Optional custom database path (defaults to ~/.claude-architect/architect.sqlite)
 * @returns Configured SQLite database instance
 */
export function getDatabase(dbPath?: string): BunDatabase {
  if (instance) return instance;

  const resolvedPath = dbPath || getDatabasePath();
  logger.info("Opening database", { path: resolvedPath });

  instance = new BunDatabase(resolvedPath, { create: true });
  configurePragmas(instance);
  runMigrations(instance);

  logger.info("Database ready", { path: resolvedPath });
  return instance;
}

/**
 * Close the database connection and release the singleton.
 */
export function closeDatabase(): void {
  if (instance) {
    instance.close();
    instance = null;
    logger.info("Database closed");
  }
}

/**
 * Execute a function within a database transaction.
 * Rolls back on error, commits on success.
 *
 * @param db - SQLite database instance
 * @param fn - Function to execute within the transaction
 * @returns Result of the function
 * @throws Re-throws any error after rollback
 */
export function withTransaction<T>(db: BunDatabase, fn: () => T): T {
  db.run("BEGIN TRANSACTION");
  try {
    const result = fn();
    db.run("COMMIT");
    return result;
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}
