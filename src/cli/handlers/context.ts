/**
 * UserPromptSubmit hook handler — KB Brain interceptor.
 * Reads the user prompt, analyzes it, queries the KB by folder names,
 * and injects MANDATORY guidance so Claude follows KB knowledge.
 *
 * @module context
 */

import { readFileSync } from "fs";
import { getDatabase } from "../../services/sqlite/Database";
import { findProjectByPath } from "../../services/sqlite/Projects";
import { getOpenViolations } from "../../services/sqlite/Violations";
import { getProjectPath } from "../../utils/paths";
import { loadConfig } from "../../utils/config";
import { lookupByPrompt } from "../../services/kb/KbLookup";
import type { KbLookupResult, KbGap } from "../../services/kb/KbTypes";

/** Max output size (chars) to stay within token budget. */
const MAX_OUTPUT = 3500;

/** Max KB results to include inline. */
const MAX_INLINE_RESULTS = 3;

/**
 * Handle user prompt submission.
 * Reads prompt from stdin, queries KB, outputs mandatory guidance.
 */
export default async function handleContext(): Promise<void> {
  const dashboardUrl = `http://localhost:${loadConfig().workerPort}`;

  // Step 1: Read user prompt from stdin (Claude Code pipes it as JSON)
  const userPrompt = readPromptFromStdin();

  // Step 2: If no meaningful prompt, fall back to generic output
  if (!userPrompt || userPrompt.length < 10) {
    process.stdout.write(buildGenericOutput(dashboardUrl));
    return;
  }

  // Step 3: Query KB with prompt analysis
  try {
    const { results, gaps } = lookupByPrompt(userPrompt, { limit: 5 });

    // If no relevant results found, fall back to generic + gap info
    if (results.length === 0 && gaps.length === 0) {
      process.stdout.write(buildGenericOutput(dashboardUrl));
      return;
    }

    // Step 4: Build mandatory guidance output
    const output = buildKbGuidance(results, gaps, dashboardUrl);
    process.stdout.write(output);
  } catch {
    // If KB lookup fails, still output something useful
    process.stdout.write(buildGenericOutput(dashboardUrl));
  }
}

/** Read user prompt from stdin (JSON payload from Claude Code). */
function readPromptFromStdin(): string {
  try {
    const raw = readFileSync(0, "utf-8");
    if (!raw || raw.trim().length === 0) return "";

    // Try JSON first (Claude Code sends structured data)
    try {
      const parsed = JSON.parse(raw);
      return (
        parsed.prompt || parsed.message || parsed.content ||
        parsed.query || parsed.input || ""
      );
    } catch {
      // Not JSON — treat as plain text
      return raw.trim();
    }
  } catch {
    return "";
  }
}

/** Build KB-guided mandatory output with results and gaps. */
function buildKbGuidance(
  results: KbLookupResult[],
  gaps: KbGap[],
  dashboardUrl: string,
): string {
  const parts: string[] = [];

  parts.push(`# [claude-architect] KB BRAIN — Active Guidance`);
  parts.push(`Dashboard: ${dashboardUrl}`);

  if (results.length > 0) {
    parts.push(``);
    parts.push(`## MANDATORY: Follow this KB knowledge`);
    parts.push(`REQUIREMENTS:`);
    parts.push(`1. Read each article via kb_read() BEFORE writing code`);
    parts.push(`2. Follow ALL directives and imperatives from these articles`);
    parts.push(`3. If your approach conflicts with KB guidance, follow the KB`);

    const inline = results.slice(0, MAX_INLINE_RESULTS);
    for (const r of inline) {
      parts.push(``);
      parts.push(`### ${r.title} (${r.domain})`);
      if (r.directive) {
        parts.push(`**DIRECTIVE:** ${r.directive}`);
      }
      if (r.imperatives.length > 0) {
        for (const imp of r.imperatives.slice(0, 3)) {
          parts.push(`- ${imp}`);
        }
      }
      parts.push(`[Read full: kb_read("${r.id}")]`);
    }

    // Additional results as references
    if (results.length > MAX_INLINE_RESULTS) {
      const extra = results.slice(MAX_INLINE_RESULTS);
      parts.push(``);
      parts.push(`**Also relevant:** ${extra.map((r) => `kb_read("${r.id}")`).join(", ")}`);
    }
  }

  // Gap detection
  if (gaps.length > 0) {
    parts.push(``);
    parts.push(`## KB GAPS DETECTED`);
    for (const gap of gaps) {
      parts.push(`- **"${gap.concept}"**: ${gap.suggestion}`);
    }
    parts.push(``);
    parts.push(
      `ACTION: Before implementing these topics, ASK the user: ` +
      `"The KB doesn't cover [${gaps.map((g) => g.concept).join(", ")}]. ` +
      `Would you like me to research best practices and create a KB article?" ` +
      `If approved, use kb_create_article() after researching.`,
    );
  }

  // Violations context (non-critical)
  appendViolations(parts);

  // Truncate if needed
  let output = parts.join("\n");
  if (output.length > MAX_OUTPUT) {
    output = output.slice(0, MAX_OUTPUT) + "\n...(truncated — use kb_read for full articles)";
  }

  return output;
}

/** Build generic output when no prompt is available or KB has nothing. */
function buildGenericOutput(dashboardUrl: string): string {
  const parts: string[] = [];
  parts.push(`# [claude-architect] context`);
  parts.push(`Dashboard: ${dashboardUrl}`);
  parts.push(
    `Workflow: 1) Thorough analysis — find ALL issues (bugs, security, format errors, unused code). ` +
    `2) \`kb_lookup\` for issues found. 3) Report everything — [KB] for KB-guided fixes.`,
  );
  parts.push(`NEVER say "code is clean" without checking every line. End response with dashboard link.`);

  appendViolations(parts);

  return parts.join("\n");
}

/** Append open violations if any exist. */
function appendViolations(parts: string[]): void {
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
    // Non-critical
  }
}
