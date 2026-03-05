/**
 * Stop hook handler.
 * Summarizes session and updates compliance score.
 *
 * @module summarize
 */

import { getDatabase } from "../../services/sqlite/Database";
import { findProjectByPath } from "../../services/sqlite/Projects";
import { completeSession, getSession } from "../../services/sqlite/Sessions";
import { getViolationCounts } from "../../services/sqlite/Violations";
import { searchDecisions } from "../../services/sqlite/Decisions";
import { validateProject } from "../../services/validator/ValidatorEngine";
import { saveSnapshot } from "../../services/sqlite/Compliance";
import { countBySeverity, countByRule } from "../../services/validator/ComplianceScorer";
import { logger } from "../../utils/logger";
import { getProjectPath } from "../../utils/paths";
import { spawnSync } from "child_process";

/**
 * Handle session end — summarize and update compliance.
 */
export default async function handleSummarize(): Promise<void> {
  const projectPath = getProjectPath();
  const db = getDatabase();
  const project = findProjectByPath(db, projectPath);

  if (!project) {
    process.stdout.write("Success");
    return;
  }

  const sessionId = process.env.CLAUDE_SESSION_ID;

  // Run final compliance check
  try {
    const report = validateProject(projectPath);

    // Save compliance snapshot
    saveSnapshot(db, {
      projectId: project.id,
      sessionId: sessionId ?? undefined,
      overallScore: report.overallScore,
      scoresByCategory: report.scoresByCategory,
      totalFeatures: report.totalFeatures,
      totalFiles: report.totalFiles,
      totalViolations: report.violations.length,
      violationsBySeverity: countBySeverity(report.violations),
      violationsByRule: countByRule(report.violations),
    });

    // Gather session data for summary
    if (sessionId) {
      const session = getSession(db, sessionId);
      const violationCounts = getViolationCounts(db, project.id);
      const totalViolations = violationCounts.critical + violationCounts.warning + violationCounts.info;

      // Get files changed via git
      const changedFiles = getChangedFiles(projectPath);

      // Count decisions made during this session
      const decisions = searchDecisions(db, project.id, {
        limit: 100,
      });
      const sessionStart = session?.started_at ?? 0;
      const sessionDecisions = decisions.filter(
        (d) => d.created_at >= sessionStart
      );

      // Generate summary text
      const summary = generateSummary({
        projectName: project.name,
        scoreBefore: session?.compliance_score_before ?? null,
        scoreAfter: report.overallScore,
        violations: report.violations,
        filesChanged: changedFiles,
        decisionsCount: sessionDecisions.length,
        totalViolations,
      });

      completeSession(db, sessionId, {
        summary,
        complianceScoreAfter: report.overallScore,
        filesChanged: changedFiles,
        decisionsMade: sessionDecisions.length,
        violationsFound: totalViolations,
      });
    }

    logger.info("Session summarized", {
      project: project.name,
      score: report.overallScore,
    });
  } catch (err) {
    logger.error("Summarization failed", { error: (err as Error).message });
  }

  process.stdout.write("Success");
}

/**
 * Get list of files changed since last commit (or all tracked files).
 */
function getChangedFiles(projectPath: string): string[] {
  try {
    const result = spawnSync("git", ["status", "--short"], {
      cwd: projectPath,
      encoding: "utf-8",
      timeout: 5000,
    });
    if (!result.stdout) return [];
    return result.stdout
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => l.substring(3).trim());
  } catch {
    return [];
  }
}

/**
 * Generate a human-readable session summary.
 */
function generateSummary(data: {
  projectName: string;
  scoreBefore: number | null;
  scoreAfter: number;
  violations: Array<{ severity: string; category: string; description: string }>;
  filesChanged: string[];
  decisionsCount: number;
  totalViolations: number;
}): string {
  const parts: string[] = [];

  // Score change
  if (data.scoreBefore !== null && data.scoreBefore !== data.scoreAfter) {
    const delta = data.scoreAfter - data.scoreBefore;
    const dir = delta > 0 ? "improved" : "decreased";
    parts.push(
      `Architecture compliance ${dir} from ${data.scoreBefore} to ${data.scoreAfter} (${delta > 0 ? "+" : ""}${delta}).`
    );
  } else {
    parts.push(
      `Architecture compliance score: ${data.scoreAfter}/100.`
    );
  }

  // Files changed
  if (data.filesChanged.length > 0) {
    if (data.filesChanged.length <= 3) {
      parts.push(`Modified: ${data.filesChanged.join(", ")}.`);
    } else {
      parts.push(
        `${data.filesChanged.length} files modified, including ${data.filesChanged.slice(0, 2).join(", ")} and ${data.filesChanged.length - 2} more.`
      );
    }
  }

  // Violations summary
  const critical = data.violations.filter((v) => v.severity === "critical");
  const warnings = data.violations.filter((v) => v.severity === "warning");
  if (critical.length > 0) {
    parts.push(
      `${critical.length} critical issue${critical.length > 1 ? "s" : ""} detected: ${critical.map((v) => v.description).slice(0, 2).join("; ")}.`
    );
  }
  if (warnings.length > 0) {
    parts.push(`${warnings.length} warning${warnings.length > 1 ? "s" : ""} remaining.`);
  }
  if (data.totalViolations === 0) {
    parts.push("No open violations — project is fully compliant.");
  }

  // Decisions
  if (data.decisionsCount > 0) {
    parts.push(
      `${data.decisionsCount} architectural decision${data.decisionsCount > 1 ? "s" : ""} recorded.`
    );
  }

  return parts.join(" ");
}
