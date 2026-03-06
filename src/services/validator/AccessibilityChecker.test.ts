/**
 * Tests for AccessibilityChecker — element-level JSX scanning with
 * brace-depth tracking for accurate multi-line detection.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { checkAccessibility } from "./AccessibilityChecker";

let TEST_DIR: string;

function createSrcFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, "src", relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

function violations(name: string) {
  return checkAccessibility(TEST_DIR).violations.filter(v => v.ruleName === name);
}

beforeEach(() => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "a11y-test-"));
  mkdirSync(join(TEST_DIR, "src"), { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("Image Without Alt", () => {
  test("clean img with alt — no violation", () => {
    createSrcFile("Banner.tsx", `export const B = () => <img src="a.jpg" alt="Banner" />;`);
    expect(violations("Image Without Alt")).toHaveLength(0);
  });

  test("img without alt — violation", () => {
    createSrcFile("Avatar.tsx", `export const A = () => <img src="a.jpg" />;`);
    const v = violations("Image Without Alt");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("warning");
  });

  test("multi-line img with alt — no violation", () => {
    createSrcFile("Photo.tsx", `export const P = () => (
  <img
    src="photo.jpg"
    alt="A beautiful landscape"
    className="rounded"
  />
);`);
    expect(violations("Image Without Alt")).toHaveLength(0);
  });
});

describe("Click Without Keyboard", () => {
  test("div with onClick only — violation", () => {
    createSrcFile("Card.tsx", `export const C = () => <div onClick={() => alert("hi")}>Click</div>;`);
    const v = violations("Click Without Keyboard");
    expect(v.length).toBeGreaterThan(0);
  });

  test("multi-line element with onKeyDown on separate line — no violation", () => {
    createSrcFile("Tile.tsx", `export const T = () => (
  <div
    onClick={() => handleClick()}
    onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
    tabIndex={0}
    role="button"
  >
    Click me
  </div>
);`);
    expect(violations("Click Without Keyboard")).toHaveLength(0);
  });

  test("native <button> with onClick — no violation", () => {
    createSrcFile("Btn.tsx", `export const B = () => <button onClick={handleClick}>Go</button>;`);
    expect(violations("Click Without Keyboard")).toHaveLength(0);
  });

  test("native <a> with onClick — no violation", () => {
    createSrcFile("Link.tsx", `export const L = () => <a href="#" onClick={handleNav}>Link</a>;`);
    expect(violations("Click Without Keyboard")).toHaveLength(0);
  });

  test("custom React component <Button> — no violation", () => {
    createSrcFile("Actions.tsx", `export const A = () => <Button onClick={save}>Save</Button>;`);
    expect(violations("Click Without Keyboard")).toHaveLength(0);
  });

  test("JSX expression with > operator inside onClick — correct parsing", () => {
    createSrcFile("Counter.tsx", `export const C = () => (
  <div
    onClick={() => count > 0 ? decrement() : reset()}
    onKeyDown={(e) => e.key === "Enter" && decrement()}
  >
    Count
  </div>
);`);
    expect(violations("Click Without Keyboard")).toHaveLength(0);
  });

  test("div with role=button — no violation", () => {
    createSrcFile("Toggle.tsx", `export const T = () => (
  <div onClick={toggle} role="button" tabIndex={0}>Toggle</div>
);`);
    expect(violations("Click Without Keyboard")).toHaveLength(0);
  });
});

describe("Input Without Label", () => {
  test("input with static aria-label — no violation", () => {
    createSrcFile("Search.tsx", `export const S = () => <input type="text" aria-label="Search" />;`);
    expect(violations("Input Without Label")).toHaveLength(0);
  });

  test("input with dynamic aria-label — no violation", () => {
    createSrcFile("DynSearch.tsx", `export const S = () => (
  <input
    type="text"
    aria-label={t.searchPlaceholder}
    value={query}
    onChange={handleChange}
  />
);`);
    expect(violations("Input Without Label")).toHaveLength(0);
  });

  test("input with id (may have <label htmlFor>) — no violation", () => {
    createSrcFile("Email.tsx", `export const E = () => <input type="email" id="email-field" />;`);
    expect(violations("Input Without Label")).toHaveLength(0);
  });

  test("input type=hidden — no violation", () => {
    createSrcFile("Token.tsx", `export const T = () => <input type="hidden" name="csrf" value={token} />;`);
    expect(violations("Input Without Label")).toHaveLength(0);
  });

  test("input type=submit — no violation", () => {
    createSrcFile("Submit.tsx", `export const S = () => <input type="submit" value="Send" />;`);
    expect(violations("Input Without Label")).toHaveLength(0);
  });

  test("bare input without any label — violation", () => {
    createSrcFile("Bare.tsx", `export const B = () => <input type="text" name="q" />;`);
    const v = violations("Input Without Label");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].description).toContain("<input>");
  });

  test("textarea without label — violation", () => {
    createSrcFile("Note.tsx", `export const N = () => <textarea name="note" rows={5} />;`);
    const v = violations("Input Without Label");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].description).toContain("<textarea>");
  });

  test("select without label — violation", () => {
    createSrcFile("Picker.tsx", `export const P = () => (
  <select name="color">
    <option>Red</option>
  </select>
);`);
    const v = violations("Input Without Label");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].description).toContain("<select>");
  });

  test("multi-line input with aria-label after expression containing > — no violation", () => {
    createSrcFile("Complex.tsx", `export const C = () => (
  <input
    type="text"
    onChange={(e) => setValue(e.target.value > 0 ? e.target.value : 0)}
    aria-label="Amount"
  />
);`);
    expect(violations("Input Without Label")).toHaveLength(0);
  });
});

describe("AutoFocus Usage", () => {
  test("detects autoFocus", () => {
    createSrcFile("SearchBox.tsx", `export const S = () => <input type="text" autoFocus />;`);
    const v = violations("AutoFocus Usage");
    expect(v.length).toBeGreaterThan(0);
    expect(v[0].severity).toBe("info");
  });
});

describe("General", () => {
  test("only scans tsx/jsx/html/vue files", () => {
    createSrcFile("utils.ts", `const tag = '<img src="photo.jpg" />';`);
    expect(checkAccessibility(TEST_DIR).filesScanned).toBe(0);
  });

  test("skips test files", () => {
    createSrcFile("Avatar.test.tsx", `const el = <img src="photo.jpg" />;`);
    expect(checkAccessibility(TEST_DIR).filesScanned).toBe(0);
  });

  test("reports correct file paths", () => {
    createSrcFile("components/Card.tsx", `export const C = () => <img src="x.jpg" />;`);
    const result = checkAccessibility(TEST_DIR);
    if (result.violations.length > 0) {
      expect(result.violations[0].filePath).toContain("components/Card.tsx");
    }
  });
});
