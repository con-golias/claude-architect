/**
 * File-based enforcement state for web search compliance.
 * Replaces DB+session_id approach which broke when CLAUDE_SESSION_ID
 * wasn't available in hook processes.
 *
 * State file: ~/.claude-architect/.enforcement-state.json
 *
 * Flow: context.ts writes gaps → pre-tool-use.ts reads & blocks →
 *       WebSearch clears the block → next Write/Edit proceeds.
 *
 * @module FileEnforcement
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { getDataDir } from "../../utils/paths";

const STATE_FILE = ".enforcement-state.json";
const STALE_MS = 4 * 60 * 60 * 1000;

interface EnforcementState {
  gaps: string[];
  webSearchCount: number;
  timestamp: number;
}

function statePath(): string {
  return join(getDataDir(), STATE_FILE);
}

/** Read enforcement state, returning null if missing or stale. */
export function readState(): EnforcementState | null {
  const path = statePath();
  if (!existsSync(path)) return null;

  try {
    const state = JSON.parse(readFileSync(path, "utf-8")) as EnforcementState;
    if (Date.now() - state.timestamp > STALE_MS) {
      clearState();
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

/** Persist KB gaps detected by context.ts. Resets search count. */
export function writeGaps(gaps: string[]): void {
  if (gaps.length === 0) return;
  const state: EnforcementState = { gaps, webSearchCount: 0, timestamp: Date.now() };
  try {
    writeFileSync(statePath(), JSON.stringify(state), "utf-8");
  } catch { /* non-critical — enforcement degrades gracefully */ }
}

/** Record a web search, incrementing the counter to lift the block. */
export function recordSearch(): void {
  const state = readState() || { gaps: [], webSearchCount: 0, timestamp: Date.now() };
  state.webSearchCount += 1;
  state.timestamp = Date.now();
  try {
    writeFileSync(statePath(), JSON.stringify(state), "utf-8");
  } catch { /* non-critical */ }
}

/** Check if Write/Edit should be blocked (gaps exist, no searches done). */
export function shouldBlock(): { blocked: boolean; gaps: string[] } {
  const state = readState();
  if (!state || state.gaps.length === 0) return { blocked: false, gaps: [] };
  if (state.webSearchCount > 0) return { blocked: false, gaps: [] };
  return { blocked: true, gaps: state.gaps };
}

/** Clear state — called on session start to prevent stale enforcement. */
export function clearState(): void {
  try {
    const path = statePath();
    if (existsSync(path)) unlinkSync(path);
  } catch { /* non-critical */ }
}
