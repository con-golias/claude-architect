import { describe, test, expect } from "bun:test";
import { handleToolCall } from "./mcpHandlers";

describe("handleToolCall", () => {
  test("__IMPORTANT returns instructions", async () => {
    const result = await handleToolCall("__IMPORTANT", {});
    expect(result).toContain("architect");
  });

  test("unknown tool returns error", async () => {
    const result = await handleToolCall("nonexistent_tool", {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("Unknown tool");
  });

  test("architect_check without project_path returns error", async () => {
    const result = await handleToolCall("architect_check", {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("project_path");
  });

  test("architect_get_status without project_path returns error", async () => {
    const result = await handleToolCall("architect_get_status", {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("project_path");
  });

  test("architect_check with project_path includes dashboard URL", async () => {
    const result = await handleToolCall("architect_check", {
      project_path: "/test",
    });
    // Response always includes dashboard URL footer
    expect(result).toContain("[Live dashboard with full details:");
    expect(result).toContain("localhost:");
    // JSON part should be parseable
    const jsonPart = result.split("\n\n[Live dashboard")[0];
    expect(() => JSON.parse(jsonPart)).not.toThrow();
  });

  test("architect_configure_rules without project_path returns error", async () => {
    const result = await handleToolCall("architect_configure_rules", {});
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain("project_path");
  });
});
