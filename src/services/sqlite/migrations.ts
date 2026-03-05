/**
 * Database schema migrations for claude-architect.
 * Each migration is idempotent and runs in order.
 *
 * @module migrations
 */

import type { Database } from "bun:sqlite";

interface Migration {
  version: number;
  description: string;
  up: (db: Database) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Core schema — projects, decisions, violations, sessions",
    up: (db: Database) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          tech_stack TEXT,
          architecture_pattern TEXT DEFAULT 'clean',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS decisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'accepted',
          context TEXT,
          decision TEXT NOT NULL,
          alternatives TEXT,
          consequences_positive TEXT,
          consequences_negative TEXT,
          superseded_by INTEGER,
          tags TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS violations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          rule_id TEXT NOT NULL,
          rule_name TEXT NOT NULL,
          severity TEXT NOT NULL,
          category TEXT NOT NULL,
          file_path TEXT,
          line_number INTEGER,
          description TEXT NOT NULL,
          suggestion TEXT,
          resolved INTEGER NOT NULL DEFAULT 0,
          resolved_at INTEGER,
          resolved_by TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          summary TEXT,
          features_added TEXT,
          files_changed TEXT,
          decisions_made INTEGER NOT NULL DEFAULT 0,
          violations_found INTEGER NOT NULL DEFAULT 0,
          violations_resolved INTEGER NOT NULL DEFAULT 0,
          compliance_score_before REAL,
          compliance_score_after REAL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS structural_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          change_type TEXT NOT NULL,
          entity_name TEXT NOT NULL,
          description TEXT NOT NULL,
          details TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS rule_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT,
          rule_id TEXT NOT NULL,
          total_violations INTEGER NOT NULL DEFAULT 0,
          resolved_violations INTEGER NOT NULL DEFAULT 0,
          ignored_violations INTEGER NOT NULL DEFAULT 0,
          avg_resolution_time_ms INTEGER,
          last_violation_at INTEGER,
          updated_at INTEGER NOT NULL
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS improvement_suggestions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT,
          rule_id TEXT,
          suggestion_type TEXT NOT NULL,
          title TEXT NOT NULL,
          reasoning TEXT NOT NULL,
          evidence TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          applied_at INTEGER,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS compliance_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          overall_score REAL NOT NULL,
          scores_by_category TEXT NOT NULL,
          total_features INTEGER,
          total_files INTEGER,
          total_violations INTEGER,
          violations_by_severity TEXT,
          violations_by_rule TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `);
    },
  },
  {
    version: 2,
    description: "Performance indexes",
    up: (db: Database) => {
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id, created_at DESC)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_violations_project ON violations(project_id, created_at DESC)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_violations_resolved ON violations(resolved)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_violations_rule ON violations(rule_id)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, started_at DESC)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_changes_project ON structural_changes(project_id, created_at DESC)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_snapshots_project ON compliance_snapshots(project_id, created_at DESC)`
      );
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_rule_metrics_rule ON rule_metrics(rule_id)`
      );
    },
  },
  {
    version: 3,
    description: "Per-project manual rule configuration",
    up: (db: Database) => {
      const columns = db
        .query<{ name: string }, []>("PRAGMA table_info(projects)")
        .all()
        .map((c) => c.name);
      if (!columns.includes("enabled_manual_rules")) {
        db.run(
          `ALTER TABLE projects ADD COLUMN enabled_manual_rules TEXT DEFAULT '[]'`
        );
      }
    },
  },
];

/**
 * Run all pending migrations on the database.
 *
 * @param db - SQLite database instance
 * @throws Error if a migration fails
 */
export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);

  const applied = db
    .query<{ version: number }, []>(
      "SELECT version FROM schema_migrations ORDER BY version"
    )
    .all()
    .map((row) => row.version);

  for (const migration of MIGRATIONS) {
    if (applied.includes(migration.version)) continue;

    db.run("BEGIN TRANSACTION");
    try {
      migration.up(db);
      db.query(
        "INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)"
      ).run(migration.version, migration.description, Date.now());
      db.run("COMMIT");
    } catch (err) {
      db.run("ROLLBACK");
      throw new Error(
        `Migration ${migration.version} failed: ${(err as Error).message}`
      );
    }
  }
}
