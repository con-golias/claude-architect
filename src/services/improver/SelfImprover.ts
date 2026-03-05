/**
 * Self-improvement engine for claude-architect.
 * Analyzes violation patterns and suggests rule modifications.
 *
 * @module SelfImprover
 */

import type { Database } from "bun:sqlite";
import type { RuleMetricRecord, ImprovementSuggestionRecord } from "../../types/database";
import { getRuleMetrics, createSuggestion, getPendingSuggestions } from "../sqlite/Improvements";
import { countSessions } from "../sqlite/Sessions";
import { logger } from "../../utils/logger";

interface ImprovementAnalysis {
  suggestions: Array<{
    ruleId: string;
    type: string;
    title: string;
    reasoning: string;
    evidence: Record<string, unknown>;
  }>;
  analysisMetadata: {
    totalRules: number;
    totalSessions: number;
    analyzedAt: number;
  };
}

/**
 * Analyze violation patterns and generate improvement suggestions.
 * Requires minimum number of sessions for meaningful data.
 *
 * @param db - Database instance
 * @param projectId - Project ID (null for global analysis)
 * @param minSessions - Minimum sessions required (default 5)
 * @returns Analysis with suggestions
 */
export function analyzeAndSuggest(
  db: Database,
  projectId: string | null,
  minSessions: number = 5
): ImprovementAnalysis {
  const sessionCount = projectId ? countSessions(db, projectId) : 0;

  if (projectId && sessionCount < minSessions) {
    return {
      suggestions: [],
      analysisMetadata: {
        totalRules: 0,
        totalSessions: sessionCount,
        analyzedAt: Date.now(),
      },
    };
  }

  const metrics = getRuleMetrics(db, projectId);
  const suggestions: ImprovementAnalysis["suggestions"] = [];

  for (const metric of metrics) {
    // Pattern 1: High violation rate — rule might be too strict
    if (metric.total_violations > 10) {
      const ignoreRate =
        metric.ignored_violations / metric.total_violations;

      if (ignoreRate > 0.5) {
        suggestions.push({
          ruleId: metric.rule_id,
          type: "relax",
          title: `Rule "${metric.rule_id}" is frequently ignored`,
          reasoning: `${Math.round(ignoreRate * 100)}% of violations for this rule are ignored (${metric.ignored_violations}/${metric.total_violations}). The rule may be too strict or irrelevant for this project.`,
          evidence: {
            totalViolations: metric.total_violations,
            resolvedViolations: metric.resolved_violations,
            ignoredViolations: metric.ignored_violations,
            ignoreRate: Math.round(ignoreRate * 100),
          },
        });
      }
    }

    // Pattern 2: Fast resolution — consider auto-fix
    if (
      metric.avg_resolution_time_ms !== null &&
      metric.avg_resolution_time_ms < 300000 && // < 5 minutes
      metric.resolved_violations > 5
    ) {
      suggestions.push({
        ruleId: metric.rule_id,
        type: "add",
        title: `Auto-fix candidate: "${metric.rule_id}"`,
        reasoning: `Violations for this rule are resolved quickly (avg ${Math.round(metric.avg_resolution_time_ms / 1000)}s). Consider adding auto-fix support.`,
        evidence: {
          avgResolutionTimeSec: Math.round(
            metric.avg_resolution_time_ms / 1000
          ),
          resolvedCount: metric.resolved_violations,
        },
      });
    }

    // Pattern 3: High violation rate per session
    if (projectId && sessionCount > 0) {
      const violationsPerSession =
        metric.total_violations / sessionCount;
      if (violationsPerSession > 3) {
        suggestions.push({
          ruleId: metric.rule_id,
          type: "split",
          title: `Rule "${metric.rule_id}" triggers too frequently`,
          reasoning: `This rule triggers ${violationsPerSession.toFixed(1)} times per session on average. Consider splitting into more specific sub-rules or adding examples.`,
          evidence: {
            violationsPerSession: violationsPerSession.toFixed(1),
            totalSessions: sessionCount,
            totalViolations: metric.total_violations,
          },
        });
      }
    }
  }

  // Pattern 4: Zero-violation rules
  const activeRuleIds = new Set(metrics.map((m) => m.rule_id));
  const allRuleIds = [
    "00-constitution",
    "01-architecture",
    "02-security",
    "03-testing",
    "04-api-design",
    "05-database",
    "06-documentation",
    "07-performance",
    "08-error-handling",
    "09-git-workflow",
    "10-frontend",
    "11-auth-patterns",
    "12-monitoring",
    "13-environment",
    "14-dependency-management",
    "15-code-style",
    "16-ci-cd",
    "17-owasp-top-ten",
    "18-data-privacy",
    "19-resilience-patterns",
    "20-concurrency",
    "22-accessibility",
    "26-advanced-code-quality",
    "28-advanced-api-patterns",
    "29-configuration-hygiene",
    "30-supply-chain-security",
  ];

  if (sessionCount >= minSessions) {
    for (const ruleId of allRuleIds) {
      if (!activeRuleIds.has(ruleId)) {
        suggestions.push({
          ruleId,
          type: "remove",
          title: `Rule "${ruleId}" never triggered`,
          reasoning: `This rule has never produced a violation across ${sessionCount} sessions. It may be too obvious or not applicable to this project — consider removing to save tokens.`,
          evidence: {
            totalSessions: sessionCount,
            totalViolations: 0,
          },
        });
      }
    }
  }

  // Store new suggestions in database
  const existingSuggestions = getPendingSuggestions(db, projectId);
  const existingTitles = new Set(existingSuggestions.map((s) => s.title));

  for (const s of suggestions) {
    if (!existingTitles.has(s.title)) {
      createSuggestion(db, {
        projectId: projectId ?? undefined,
        ruleId: s.ruleId,
        suggestionType: s.type as ImprovementSuggestionRecord["suggestion_type"],
        title: s.title,
        reasoning: s.reasoning,
        evidence: s.evidence,
      });
    }
  }

  logger.info("Self-improvement analysis complete", {
    projectId,
    suggestionsGenerated: suggestions.length,
    sessionCount,
  });

  return {
    suggestions,
    analysisMetadata: {
      totalRules: metrics.length,
      totalSessions: sessionCount,
      analyzedAt: Date.now(),
    },
  };
}
