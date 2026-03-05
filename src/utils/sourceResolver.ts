/**
 * Smart source directory and file extension resolver.
 * Auto-detects project type and returns appropriate scan paths.
 *
 * @module sourceResolver
 */

import { existsSync } from "fs";
import { join } from "path";

/** Recognized project types. */
export type ProjectType =
  | "node-ts"
  | "node-js"
  | "python"
  | "go"
  | "java"
  | "dotnet"
  | "ruby"
  | "unknown";

/** Result of source path detection for a project. */
export interface SourceResolution {
  /** Detected project type(s). */
  projectTypes: ProjectType[];
  /** Directories to scan for source files (absolute paths). */
  sourceDirs: string[];
  /** File extensions to scan for code files. */
  codeExtensions: string[];
  /** File extensions for frontend/UI checks. */
  frontendExtensions: string[];
  /** Whether this project uses clean architecture (has src/features/). */
  hasCleanArchitecture: boolean;
}

/** Candidate source directories, ordered by specificity. */
const SOURCE_DIR_CANDIDATES = [
  "src", "lib", "app", "server", "api", "backend", "frontend",
  "packages", "apps", "cmd", "internal", "pkg",
];

/** Marker files that indicate project type. */
const PROJECT_MARKERS: Array<[string, ProjectType]> = [
  ["tsconfig.json", "node-ts"],
  ["package.json", "node-js"],
  ["pyproject.toml", "python"],
  ["setup.py", "python"],
  ["requirements.txt", "python"],
  ["Pipfile", "python"],
  ["go.mod", "go"],
  ["pom.xml", "java"],
  ["build.gradle", "java"],
  ["build.gradle.kts", "java"],
  ["Gemfile", "ruby"],
];

/** Map project type to code file extensions. */
const TYPE_EXTENSIONS: Record<ProjectType, string[]> = {
  "node-ts": [".ts", ".tsx", ".js", ".jsx"],
  "node-js": [".js", ".jsx", ".mjs", ".cjs"],
  "python": [".py"],
  "go": [".go"],
  "java": [".java", ".kt"],
  "dotnet": [".cs"],
  "ruby": [".rb"],
  "unknown": [".ts", ".tsx", ".js", ".jsx"],
};

/**
 * Resolve source directories and file extensions for a project.
 *
 * @param projectPath - Absolute path to project root
 * @returns SourceResolution with dirs, extensions, and project metadata
 */
export function resolveSourcePaths(projectPath: string): SourceResolution {
  const projectTypes = detectProjectTypes(projectPath);
  const sourceDirs = detectSourceDirs(projectPath);
  const hasCleanArchitecture = existsSync(join(projectPath, "src", "features"));

  const extSet = new Set<string>();
  for (const pt of projectTypes) {
    for (const ext of TYPE_EXTENSIONS[pt]) extSet.add(ext);
  }
  if (extSet.size === 0) {
    for (const ext of TYPE_EXTENSIONS["unknown"]) extSet.add(ext);
  }

  const frontendExtensions = [".tsx", ".jsx", ".html", ".vue", ".svelte"]
    .filter((ext) => extSet.has(ext) || [".html", ".vue", ".svelte"].includes(ext));

  return {
    projectTypes,
    sourceDirs,
    codeExtensions: [...extSet],
    frontendExtensions,
    hasCleanArchitecture,
  };
}

/**
 * Build a glob pattern string from an array of extensions.
 *
 * @param extensions - Array of extensions with leading dots
 * @returns Glob pattern string like "**\/*.{ts,tsx,js}"
 */
export function buildGlobPattern(extensions: string[]): string {
  const exts = extensions.map((e) => e.replace(".", ""));
  if (exts.length === 1) return `**/*.${exts[0]}`;
  return `**/*.{${exts.join(",")}}`;
}

/** Detect project types by checking for marker files. */
function detectProjectTypes(projectPath: string): ProjectType[] {
  const types = new Set<ProjectType>();

  for (const [marker, type] of PROJECT_MARKERS) {
    if (existsSync(join(projectPath, marker))) types.add(type);
  }

  // Prefer node-ts over node-js when tsconfig exists
  if (types.has("node-ts") && types.has("node-js")) types.delete("node-js");

  return types.size > 0 ? [...types] : ["unknown"];
}

/** Detect which source directories actually exist. Falls back to project root. */
function detectSourceDirs(projectPath: string): string[] {
  const found: string[] = [];

  for (const candidate of SOURCE_DIR_CANDIDATES) {
    const fullPath = join(projectPath, candidate);
    if (existsSync(fullPath)) found.push(fullPath);
  }

  if (found.length === 0) found.push(projectPath);

  return found;
}
