import { describe, test, expect } from "bun:test";

describe("hook handlers export default async functions", () => {
  test("session-init exports default async function", async () => {
    const mod = await import("./session-init");
    expect(typeof mod.default).toBe("function");
  });

  test("context exports default async function", async () => {
    const mod = await import("./context");
    expect(typeof mod.default).toBe("function");
  });

  test("post-change exports default async function", async () => {
    const mod = await import("./post-change");
    expect(typeof mod.default).toBe("function");
  });

  test("summarize exports default async function", async () => {
    const mod = await import("./summarize");
    expect(typeof mod.default).toBe("function");
  });

  test("session-complete exports default async function", async () => {
    const mod = await import("./session-complete");
    expect(typeof mod.default).toBe("function");
  });
});
