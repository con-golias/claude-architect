import { describe, it, expect, beforeEach, afterAll } from "bun:test";
import { writeGaps, readState, recordSearch, shouldBlock, clearState } from "./FileEnforcement";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { getDataDir } from "../../utils/paths";

const STATE_FILE = join(getDataDir(), ".enforcement-state.json");

function cleanup() {
  try { if (existsSync(STATE_FILE)) unlinkSync(STATE_FILE); } catch {}
}

describe("FileEnforcement", () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it("returns null when no state file exists", () => {
    expect(readState()).toBeNull();
  });

  it("returns not-blocked when no state", () => {
    const { blocked } = shouldBlock();
    expect(blocked).toBe(false);
  });

  it("persists gaps and blocks writes", () => {
    writeGaps(["auction", "escrow", "bidding"]);

    const state = readState();
    expect(state).not.toBeNull();
    expect(state!.gaps).toEqual(["auction", "escrow", "bidding"]);
    expect(state!.webSearchCount).toBe(0);

    const { blocked, gaps } = shouldBlock();
    expect(blocked).toBe(true);
    expect(gaps).toEqual(["auction", "escrow", "bidding"]);
  });

  it("unblocks after a web search is recorded", () => {
    writeGaps(["auction", "escrow"]);
    expect(shouldBlock().blocked).toBe(true);

    recordSearch();
    expect(shouldBlock().blocked).toBe(false);

    const state = readState();
    expect(state!.webSearchCount).toBe(1);
  });

  it("clears state completely", () => {
    writeGaps(["test-gap"]);
    expect(readState()).not.toBeNull();

    clearState();
    expect(readState()).toBeNull();
    expect(shouldBlock().blocked).toBe(false);
  });

  it("ignores empty gap list", () => {
    writeGaps([]);
    expect(readState()).toBeNull();
  });

  it("accumulates search count across multiple searches", () => {
    writeGaps(["gap"]);
    recordSearch();
    recordSearch();
    recordSearch();

    const state = readState();
    expect(state!.webSearchCount).toBe(3);
  });

  it("resets search count when new gaps are written", () => {
    writeGaps(["old-gap"]);
    recordSearch();
    expect(readState()!.webSearchCount).toBe(1);

    writeGaps(["new-gap"]);
    expect(readState()!.webSearchCount).toBe(0);
    expect(shouldBlock().blocked).toBe(true);
  });
});
