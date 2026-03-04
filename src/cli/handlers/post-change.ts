/**
 * PostToolUse hook handler.
 * Runs lightweight validation after file writes.
 *
 * @module post-change
 */

import { getDatabase } from "../../services/sqlite/Database";
import { findProjectByPath } from "../../services/sqlite/Projects";
import { createViolation } from "../../services/sqlite/Violations";
import { trackViolation } from "../../services/sqlite/Improvements";
import { quickValidate } from "../../services/validator/ValidatorEngine";
import { logger } from "../../utils/logger";
import { getProjectPath } from "../../utils/paths";

/**
 * Handle post-change validation.
 * Runs quick checks on changed files and stores violations.
 */
export default async function handlePostChange(): Promise<void> {
  const projectPath = getProjectPath();
  const db = getDatabase();
  const project = findProjectByPath(db, projectPath);

  if (!project) {
    process.stdout.write("Success");
    return;
  }

  // Get changed file from environment (set by Claude Code hook system)
  const changedFile = process.env.TOOL_INPUT_FILE_PATH || "";

  if (!changedFile) {
    process.stdout.write("Success");
    return;
  }

  const violations = quickValidate(projectPath, changedFile);

  if (violations.length === 0) {
    process.stdout.write("Success");
    return;
  }

  // Store violations in database
  const sessionId = process.env.CLAUDE_SESSION_ID;
  for (const v of violations) {
    createViolation(db, {
      projectId: project.id,
      sessionId,
      ruleId: v.ruleId,
      ruleName: v.ruleName,
      severity: v.severity,
      category: v.category,
      filePath: v.filePath,
      lineNumber: v.lineNumber,
      description: v.description,
      suggestion: v.suggestion,
    });
    trackViolation(db, v.ruleId, project.id);
  }

  // Output warnings
  const parts: string[] = [];
  parts.push(`# [claude-architect] violations detected`);
  for (const v of violations) {
    parts.push(`- [${v.severity}] ${v.description}${v.suggestion ? ` → ${v.suggestion}` : ""}`);
  }

  process.stdout.write(parts.join("\n"));
}
