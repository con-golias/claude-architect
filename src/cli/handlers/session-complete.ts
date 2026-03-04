/**
 * Stop hook handler — session completion and cleanup.
 * Closes the database connection and triggers self-improvement if enough data.
 *
 * @module session-complete
 */

import { getDatabase, closeDatabase } from "../../services/sqlite/Database";
import { findProjectByPath } from "../../services/sqlite/Projects";
import { countSessions } from "../../services/sqlite/Sessions";
import { analyzeAndSuggest } from "../../services/improver/SelfImprover";
import { logger } from "../../utils/logger";
import { loadConfig } from "../../utils/config";

/**
 * Handle session completion.
 * Runs self-improvement analysis if enough sessions exist, then cleans up.
 */
export default async function handleSessionComplete(): Promise<void> {
  const projectPath = process.cwd();
  const db = getDatabase();
  const project = findProjectByPath(db, projectPath);

  if (project) {
    const config = loadConfig();
    const sessionCount = countSessions(db, project.id);

    if (sessionCount >= config.improvementMinSessions) {
      try {
        analyzeAndSuggest(db, project.id, config.improvementMinSessions);
        logger.info("Self-improvement analysis completed", {
          project: project.name,
          sessions: sessionCount,
        });
      } catch (err) {
        logger.error("Self-improvement analysis failed", {
          error: (err as Error).message,
        });
      }
    }
  }

  closeDatabase();
  process.stdout.write("Success");
}
