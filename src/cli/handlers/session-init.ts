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

    // Proactive tool usage instructions
    parts.push(`\n## YOU MUST USE claude-architect tools`);
    parts.push(`The claude-architect plugin is PROACTIVELY helping you. It works in two ways:`);
    parts.push(`1. **Proactive hooks** — Before every prompt, the plugin analyzes your task and injects relevant KB guidance. When you see "[claude-architect] PROACTIVE DETECTION" — that IS the plugin working for you.`);
    parts.push(`2. **On-demand tools** — You MUST also call these tools yourself:`);
    parts.push(`   - **architect_check(project_path)** — Run FIRST to understand project health. Run AGAIN after changes.`);
    parts.push(`   - **architect_scaffold(project_path, feature_name)** — ALWAYS use for new features. NEVER create architecture folders manually.`);
    parts.push(`   - **kb_lookup(query)** — Consult BEFORE writing code. 1009 articles of best practices.`);
    parts.push(`   - **architect_get_rules** — Check rules before suggesting changes.`);
    parts.push(`When the user asks "did you use the plugin?", the answer is YES if you received proactive guidance OR called any tool.`);
    parts.push(`If you complete a task without calling these tools, you did it WRONG.`);

    // KB behavioral instructions — correct workflow order
    parts.push(`\n## KB System Active (1009 articles indexed)`);
    parts.push(`**MANDATORY WORKFLOW — follow this order in EVERY code task:**`);
    parts.push(`Step 1 — THOROUGH ANALYSIS: Examine every file carefully. Check for ALL issues: bugs, security vulnerabilities (XSS, injection), invalid formats (malformed UUIDs, wrong versions), unused code, missing references, structural problems. Do NOT rush this step. List every issue you find.`);
    parts.push(`Step 2 — KB CONSULTATION: Call \`kb_lookup\` with the specific issues you found in Step 1. Check if KB has guidance.`);
    parts.push(`Step 3 — REPORT ALL ISSUES: Present every issue from Step 1. Mark KB-guided fixes with [KB]. Fix the rest with your own expertise.`);
    parts.push(`Step 4 — END with: "Dashboard: ${dashboardUrl}"`);
    parts.push(`CRITICAL: Never skip issues. Never say "code is clean" unless you checked EVERY line.`);

    // Socratic Pre-Action Protocol — MANDATORY for ALL tasks
    parts.push(`\n## Socratic Pre-Action Protocol (MANDATORY — NO EXCEPTIONS)`);
    parts.push(`Before ANY code change — including small fixes:`);
    parts.push(`1. Call \`socratic_analyze\` with action details → generates 7-77 questions`);
    parts.push(`2. Answer ALL questions — for each: ΞΕΡΩ (verified) / ΥΠΟΘΕΤΩ (assumption) / ΔΕΝ ΞΕΡΩ`);
    parts.push(`3. If ΥΠΟΘΕΤΩ → STOP writing code. Verify: Read/Grep for code facts, web search for tech, ask user for decisions`);
    parts.push(`4. Call \`socratic_verify\` with verified answers`);
    parts.push(`5. Only when status = VALIDATED → proceed with code`);
    parts.push(`There is NO bypass. There is NO skip. EVERY task goes through Socratic analysis.`);
    parts.push(`**ABSOLUTE RULE: No assumptions. If you don't KNOW, don't code it — FIND it first.**`);

    process.stdout.write(parts.join("\n"));
  } catch (err) {
    // Always output at least the dashboard URL even on failure
    logger.error("session-init failed", { error: (err as Error).message });
    process.stdout.write(
      `# [claude-architect] Dashboard: ${dashboardUrl}\nSession init encountered an error — dashboard and tools still available.`
    );
  }
}
