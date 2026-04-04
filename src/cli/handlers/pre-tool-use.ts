/**
 * PreToolUse hook handler.
 * Fires before Write/Edit/NotebookEdit — injects KB guidance.
 * Also fires before WebSearch — tracks search count for enforcement.
 *
 * @module pre-tool-use
 */

import { lookup, loadIndex } from "../../services/kb/KbLookup";
import { getKbIndexPath } from "../../utils/paths";
import { logger } from "../../utils/logger";
import { getDatabase } from "../../services/sqlite/Database";
import { getActiveSession } from "../../services/sqlite/Socratic";
import { isWebSearchRequired, recordWebSearch } from "../../services/sqlite/Enforcement";
import type { KbLookupResult } from "../../services/kb/KbTypes";

const MAX_OUTPUT_CHARS = 2500;
const MAX_RESULTS = 3;

export default async function handlePreToolUse(): Promise<void> {
  try {
    const toolName = process.env.TOOL_NAME || "";

    // WebSearch tool → record search and pass through
    if (/WebSearch|web_search/i.test(toolName)) {
      trackWebSearch();
      process.stdout.write("Success");
      return;
    }

    // For Write/Edit: enforce web search requirement
    const blockMessage = checkWebSearchEnforcement();
    if (blockMessage) {
      process.stdout.write(blockMessage);
      return;
    }

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

    // Socratic enforcement — warn if no validated session
    warnIfNoSocratic();

    const filePath = (parsed.file_path as string) || (parsed.notebook_path as string) || "";
    if (!filePath) {
      process.stdout.write("Success");
      return;
    }

    const indexPath = getKbIndexPath();
    const index = loadIndex(indexPath);
    if (!index) {
      process.stdout.write("Success");
      return;
    }

    const content = extractContentSnippet(parsed);
    const results = lookup(filePath, content, undefined, { indexPath, limit: MAX_RESULTS });

    if (results.length === 0) {
      process.stdout.write("Success");
      return;
    }

    process.stdout.write(formatGuidance(filePath, results));
  } catch (err) {
    logger.error("pre-tool-use failed", { error: (err as Error).message });
    process.stdout.write("Success");
  }
}

/** Record that a web search was performed in this session. */
function trackWebSearch(): void {
  try {
    const sessionId = process.env.CLAUDE_SESSION_ID;
    if (!sessionId) return;
    const db = getDatabase();
    recordWebSearch(db, sessionId);
  } catch {
    // Non-critical — don't block the search
  }
}

/** Block Write/Edit if KB gaps exist but no web search was done. */
function checkWebSearchEnforcement(): string | null {
  try {
    const sessionId = process.env.CLAUDE_SESSION_ID;
    if (!sessionId) return null;
    const db = getDatabase();
    const { required, concepts } = isWebSearchRequired(db, sessionId);
    if (!required) return null;

    return (
      `# [claude-architect] BLOCKED: Web search required before writing code\n\n` +
      `The plugin detected KB gaps for: **${concepts.join(", ")}**\n` +
      `You MUST call WebSearch for these topics BEFORE writing any code.\n\n` +
      `## Required actions:\n` +
      concepts.map((c) => `- WebSearch: "${c} best practices"\n`).join("") +
      `\nAfter searching, you may proceed with Write/Edit. This block will auto-clear.\n` +
      `This is a MANDATORY plugin requirement — not a suggestion.`
    );
  } catch {
    return null;
  }
}

/** Warn if writing code without Socratic validation. */
function warnIfNoSocratic(): void {
  try {
    const db = getDatabase();
    const activeSession = getActiveSession(db);
    if (!activeSession || activeSession.status !== "VALIDATED") {
      process.stdout.write(
        `# [claude-architect] WARNING: No validated Socratic session\n` +
        `You are about to write/edit code without Socratic validation.\n` +
        `RECOMMENDED: Run socratic_analyze first to validate your approach.\n\n`,
      );
    }
  } catch {
    // DB unavailable — non-critical
  }
}

function extractContentSnippet(parsed: Record<string, unknown>): string | undefined {
  const content = parsed.content as string | undefined;
  if (content) return content.slice(0, 2000);
  const newString = parsed.new_string as string | undefined;
  if (newString) return newString.slice(0, 2000);
  const newSource = parsed.new_source as string | undefined;
  if (newSource) return newSource.slice(0, 2000);
  return undefined;
}

function formatGuidance(filePath: string, results: KbLookupResult[]): string {
  const fileName = filePath.split(/[/\\]/).pop() || filePath;
  const parts: string[] = [];

  parts.push(`# [claude-architect] KB guidance for ${fileName}\n`);

  for (const r of results) {
    parts.push(`## ${r.title} (${r.domain})`);
    if (r.directive) parts.push(`**DIRECTIVE:** ${r.directive}`);
    if (r.imperatives.length > 0) {
      for (const imp of r.imperatives.slice(0, 3)) parts.push(`- ${imp}`);
    }
    if (r.bestPractices && r.bestPractices.length > 0) {
      for (const bp of r.bestPractices.slice(0, 2)) parts.push(`- ${bp}`);
    }
    parts.push(`[Full: kb_read("${r.id}")]\n`);
  }

  let output = parts.join("\n");
  if (output.length > MAX_OUTPUT_CHARS) {
    output = output.slice(0, MAX_OUTPUT_CHARS) + "\n...(truncated)";
  }
  return output;
}
