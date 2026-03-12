/**
 * UserPromptSubmit hook handler.
 * Injects KB reminder, dashboard link, and active violations on every prompt.
 *
 * @module context
 */

import { getDatabase } from "../../services/sqlite/Database";
import { findProjectByPath } from "../../services/sqlite/Projects";
import { getOpenViolations } from "../../services/sqlite/Violations";
import { getProjectPath } from "../../utils/paths";
import { loadConfig } from "../../utils/config";

/**
 * Handle user prompt submission.
 * Always outputs KB reminder and dashboard link.
 * Adds open violations when they exist.
 */
export default async function handleContext(): Promise<void> {
  const dashboardUrl = `http://localhost:${loadConfig().workerPort}`;

  const parts: string[] = [];
  parts.push(`# [claude-architect] context`);
  parts.push(`Dashboard: ${dashboardUrl}`);
  parts.push(`Workflow: 1) Thorough analysis — find ALL issues (bugs, security, format errors, unused code). 2) \`kb_lookup\` for issues found. 3) Report everything — [KB] for KB-guided fixes.`);
  parts.push(`NEVER say "code is clean" without checking every line. End response with dashboard link.`);

  try {
    const projectPath = getProjectPath();
    const db = getDatabase();
    const project = findProjectByPath(db, projectPath);

    if (project) {
      const violations = getOpenViolations(db, project.id, { limit: 5 });

      if (violations.length > 0) {
        parts.push(`\nActive warnings:`);
        for (const v of violations) {
          parts.push(
            `- [${v.severity}] ${v.description}${v.file_path ? ` (${v.file_path})` : ""}`,
          );
        }
      }
    }
  } catch {
    // Non-critical — KB reminder still goes out
  }

  process.stdout.write(parts.join("\n"));
}
