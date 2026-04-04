/**
 * PreToolUse hook handler.
 * Fires before Write/Edit/NotebookEdit — injects KB guidance into Claude's context.
 *
 * @module pre-tool-use
 */

import { lookup, loadIndex } from "../../services/kb/KbLookup";
import { getKbIndexPath } from "../../utils/paths";
import { logger } from "../../utils/logger";
import { getDatabase } from "../../services/sqlite/Database";
import { getActiveSession } from "../../services/sqlite/Socratic";
import type { KbLookupResult } from "../../services/kb/KbTypes";

/** Max output chars to keep context concise. */
const MAX_OUTPUT_CHARS = 2500;

/** Max results to include. */
const MAX_RESULTS = 3;

/**
 * Handle pre-tool-use KB lookup.
 * Reads TOOL_INPUT env, queries KB index, outputs guidance.
 */
export default async function handlePreToolUse(): Promise<void> {
  try {
    const toolInput = process.env.TOOL_INPUT;
    if (!toolInput) {
      process.stdout.write("Success");
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolInput);
    } catch {
      process.stdout.write("Success");
      return;
    }

    // Socratic enforcement — warn if no validated session for Write/Edit
    try {
      const db = getDatabase();
      const activeSession = getActiveSession(db);
      if (!activeSession || activeSession.status !== "VALIDATED") {
        process.stdout.write(
          `# [claude-architect] WARNING: No validated Socratic session\n` +
          `You are about to write/edit code without Socratic validation.\n` +
          `RECOMMENDED: Run socratic_analyze first to validate your approach.\n\n`
        );
      }
    } catch {
      // DB unavailable — non-critical, continue with KB guidance
    }

    // Extract file path from tool input
    const filePath = (parsed.file_path as string) || (parsed.notebook_path as string) || "";
    if (!filePath) {
      process.stdout.write("Success");
      return;
    }

    // Check if KB index exists
    const indexPath = getKbIndexPath();
    const index = loadIndex(indexPath);
    if (!index) {
      process.stdout.write("Success");
      return;
    }

    // Extract content snippet for deeper analysis
    const content = extractContentSnippet(parsed);

    // Query the KB index
    const results = lookup(filePath, content, undefined, {
      indexPath,
      limit: MAX_RESULTS,
    });

    if (results.length === 0) {
      process.stdout.write("Success");
      return;
    }

    // Format output
    const output = formatGuidance(filePath, results);
    process.stdout.write(output);
  } catch (err) {
    logger.error("pre-tool-use failed", { error: (err as Error).message });
    process.stdout.write("Success");
  }
}

/** Extract a content snippet from tool input for KB matching. */
function extractContentSnippet(parsed: Record<string, unknown>): string | undefined {
  // Write tool: full content
  const content = parsed.content as string | undefined;
  if (content) {
    return content.slice(0, 2000);
  }

  // Edit tool: new_string gives intent
  const newString = parsed.new_string as string | undefined;
  if (newString) {
    return newString.slice(0, 2000);
  }

  // NotebookEdit: new_source
  const newSource = parsed.new_source as string | undefined;
  if (newSource) {
    return newSource.slice(0, 2000);
  }

  return undefined;
}

/** Format KB results into concise guidance for Claude. */
function formatGuidance(filePath: string, results: KbLookupResult[]): string {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const parts: string[] = [];

  parts.push(`# [claude-architect] KB guidance for ${fileName}\n`);

  for (const r of results) {
    parts.push(`## ${r.title} (${r.domain})`);

    if (r.directive) {
      parts.push(`**DIRECTIVE:** ${r.directive}`);
    }

    if (r.imperatives.length > 0) {
      for (const imp of r.imperatives.slice(0, 3)) {
        parts.push(`- ${imp}`);
      }
    }

    if (r.bestPractices && r.bestPractices.length > 0) {
      for (const bp of r.bestPractices.slice(0, 2)) {
        parts.push(`- ${bp}`);
      }
    }

    parts.push(`[Full: kb_read("${r.id}")]\n`);
  }

  // Truncate if too long
  let output = parts.join("\n");
  if (output.length > MAX_OUTPUT_CHARS) {
    output = output.slice(0, MAX_OUTPUT_CHARS) + "\n...(truncated)";
  }

  return output;
}
