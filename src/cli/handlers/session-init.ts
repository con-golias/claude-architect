/**
 * SessionStart hook handler.
 * Detects project, registers in DB, loads recent context.
 *
 * @module session-init
 */

import { getDatabase } from "../../services/sqlite/Database";
import { findProjectByPath, upsertProject } from "../../services/sqlite/Projects";
import { getRecentDecisions } from "../../services/sqlite/Decisions";
import { getOpenViolations, getViolationCounts } from "../../services/sqlite/Violations";
import { getLatestSnapshot, getComplianceTrend } from "../../services/sqlite/Compliance";
import { startSession } from "../../services/sqlite/Sessions";
import { logger } from "../../utils/logger";
import { getProjectPath } from "../../utils/paths";
import { loadConfig } from "../../utils/config";
import { basename } from "path";

/**
 * Handle session initialization.
 * Outputs context string for Claude to use.
 * Wrapped in try/catch — always outputs at minimum the dashboard URL.
 */
export default async function handleSessionInit(): Promise<void> {
  const dashboardUrl = `http://localhost:${loadConfig().workerPort}`;

  try {
    const projectPath = getProjectPath();
    const db = getDatabase();

    // Register or update project
    let project = findProjectByPath(db, projectPath);
    if (!project) {
      const projectName = basename(projectPath);
      project = upsertProject(db, {
        id: crypto.randomUUID(),
        name: projectName,
        path: projectPath,
      });
      logger.info("New project registered", { name: projectName, path: projectPath });
    }

    // Start session
    const sessionId = process.env.CLAUDE_SESSION_ID || crypto.randomUUID();
    const latestSnapshot = getLatestSnapshot(db, project.id);
    startSession(db, sessionId, project.id, latestSnapshot?.overall_score);

    // Build context summary
    const violations = getViolationCounts(db, project.id);
    const trend = getComplianceTrend(db, project.id);
    const recentDecisions = getRecentDecisions(db, project.id, 3);

    const parts: string[] = [];
    parts.push(`# [claude-architect] project context`);
    parts.push(`Project: ${project.name} (${project.path})`);
    parts.push(`Dashboard: ${dashboardUrl}`);

    if (latestSnapshot) {
      parts.push(`Compliance Score: ${latestSnapshot.overall_score}/100 (${trend})`);
    }

    if (violations.critical > 0 || violations.warning > 0) {
      parts.push(
        `Open Violations: ${violations.critical} critical, ${violations.warning} warning, ${violations.info} info`
      );
    }

    if (recentDecisions.length > 0) {
      parts.push(`\nRecent Decisions:`);
      for (const d of recentDecisions) {
        parts.push(`- [${d.status}] ${d.title}`);
      }
    }

    // KB behavioral instructions — correct workflow order
    parts.push(`\n## KB System Active (1009 articles indexed)`);
    parts.push(`**MANDATORY WORKFLOW — follow this order in EVERY code task:**`);
    parts.push(`Step 1 — THOROUGH ANALYSIS: Examine every file carefully. Check for ALL issues: bugs, security vulnerabilities (XSS, injection), invalid formats (malformed UUIDs, wrong versions), unused code, missing references, structural problems. Do NOT rush this step. List every issue you find.`);
    parts.push(`Step 2 — KB CONSULTATION: Call \`kb_lookup\` with the specific issues you found in Step 1. Check if KB has guidance.`);
    parts.push(`Step 3 — REPORT ALL ISSUES: Present every issue from Step 1. Mark KB-guided fixes with [KB]. Fix the rest with your own expertise.`);
    parts.push(`Step 4 — END with: "Dashboard: ${dashboardUrl}"`);
    parts.push(`CRITICAL: Never skip issues. Never say "code is clean" unless you checked EVERY line.`);

    process.stdout.write(parts.join("\n"));
  } catch (err) {
    // Always output at least the dashboard URL even on failure
    logger.error("session-init failed", { error: (err as Error).message });
    process.stdout.write(
      `# [claude-architect] Dashboard: ${dashboardUrl}\nSession init encountered an error — dashboard and tools still available.`
    );
  }
}
