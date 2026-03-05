import { describe, test, expect } from "bun:test";
import { parseFrontmatter, getRuleMode, getRulePaths } from "./frontmatter";

describe("parseFrontmatter", () => {
  test("parses full frontmatter with mode and paths", () => {
    const content = `---\nmode: auto\npaths:\n  - "src/**/*.ts"\n  - "src/**/*.js"\n---\n## Rule Title\nContent here`;
    const { metadata, body } = parseFrontmatter(content);
    expect(metadata.mode).toBe("auto");
    expect(metadata.paths).toEqual(["src/**/*.ts", "src/**/*.js"]);
    expect(body).toStartWith("## Rule Title");
  });

  test("parses manual mode", () => {
    const content = `---\nmode: manual\n---\n## Manual Rule`;
    const { metadata } = parseFrontmatter(content);
    expect(metadata.mode).toBe("manual");
    expect(metadata.paths).toEqual([]);
  });

  test("defaults to auto when no frontmatter", () => {
    const content = `## Rule Without Frontmatter\nSome content`;
    const { metadata, body } = parseFrontmatter(content);
    expect(metadata.mode).toBe("auto");
    expect(metadata.paths).toEqual([]);
    expect(body).toBe(content);
  });

  test("defaults to auto when mode not specified", () => {
    const content = `---\npaths:\n  - "src/**/*.ts"\n---\n## Rule`;
    const { metadata } = parseFrontmatter(content);
    expect(metadata.mode).toBe("auto");
    expect(metadata.paths).toEqual(["src/**/*.ts"]);
  });

  test("handles paths without quotes", () => {
    const content = `---\npaths:\n  - src/**/*.ts\n---\n## Rule`;
    const { metadata } = parseFrontmatter(content);
    expect(metadata.paths).toEqual(["src/**/*.ts"]);
  });
});

describe("getRuleMode", () => {
  test("returns auto for auto rules", () => {
    expect(getRuleMode("---\nmode: auto\n---\n# Rule")).toBe("auto");
  });

  test("returns manual for manual rules", () => {
    expect(getRuleMode("---\nmode: manual\n---\n# Rule")).toBe("manual");
  });

  test("returns auto when no frontmatter", () => {
    expect(getRuleMode("# Rule without frontmatter")).toBe("auto");
  });
});

describe("getRulePaths", () => {
  test("returns paths array", () => {
    const content = `---\npaths:\n  - "*.ts"\n  - "*.js"\n---\n# Rule`;
    expect(getRulePaths(content)).toEqual(["*.ts", "*.js"]);
  });

  test("returns empty for no paths", () => {
    expect(getRulePaths("---\nmode: auto\n---\n# Rule")).toEqual([]);
  });

  test("returns empty for no frontmatter", () => {
    expect(getRulePaths("# Rule")).toEqual([]);
  });
});
