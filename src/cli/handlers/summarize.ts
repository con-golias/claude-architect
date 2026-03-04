/**
 * Stop hook handler.
 * Summarizes session and updates compliance score.
 *
 * @module summarize
 */

import { getDatabase } from "../../services/sqlite/Database";
import { findProjectByPath } from "../../services/sqlite/Projects";
import { completeSession } from "../../services/sqlite/Sessions";
import { getViolationCounts, getOpenViolations } from "../../services/sqlite/Violations";
import { validateProject } from "../../services/validator/ValidatorEngine";
import { saveSnapshot } from "../../services/sqlite/Compliance";
import { countBySeverity, countByRule } from "../../services/validator/ComplianceScorer";
import { logger } from "../../utils/logger";

/**
 * Handle session end — summarize and update compliance.
 */
export default async function handleSummarize(): Promise<void> {
  const projectPath = process.cwd();
  const db = getDatabase();
  const project = findProjectByPath(db, projectPath);

  if (!project) {
    process.stdout.write("Success");
    return;
  }

  const sessionId = process.env.CLAUDE_SESSION_ID;

  // Run final compliance check
  try {
    const report = validateProject(projectPath, { severity: "warning" });

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

    // Complete session
    if (sessionId) {
      const violationCounts = getViolationCounts(db, project.id);
      completeSession(db, sessionId, {
        complianceScoreAfter: report.overallScore,
        violationsFound: violationCounts.critical + violationCounts.warning + violationCounts.info,
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
