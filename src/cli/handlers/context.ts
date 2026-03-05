/**
 * UserPromptSubmit hook handler.
 * Injects relevant architecture rules context.
 *
 * @module context
 */

import { getDatabase } from "../../services/sqlite/Database";
import { findProjectByPath } from "../../services/sqlite/Projects";
import { getOpenViolations } from "../../services/sqlite/Violations";
import { getProjectPath } from "../../utils/paths";

/**
 * Handle user prompt submission.
 * Returns relevant rules and open violations for context.
 */
export default async function handleContext(): Promise<void> {
  const projectPath = getProjectPath();
  const db = getDatabase();
  const project = findProjectByPath(db, projectPath);

  if (!project) {
    process.stdout.write("Success");
    return;
  }

  // Get open violations (all severities, most critical first)
  const violations = getOpenViolations(db, project.id, {
    limit: 5,
  });

  if (violations.length === 0) {
    process.stdout.write("Success");
    return;
  }

  const parts: string[] = [];
  parts.push(`# [claude-architect] active warnings`);

  for (const v of violations) {
    parts.push(
      `- [${v.severity}] ${v.description}${v.file_path ? ` (${v.file_path})` : ""}`
    );
  }

  process.stdout.write(parts.join("\n"));
}
