/**
 * Architecture validation, scaffolding, and rules routes.
 *
 * @module architectRoutes
 */

import type { Router, Request, Response } from "express";
import type { Database } from "bun:sqlite";
import { findProjectByPath } from "../../sqlite/Projects";
import { saveSnapshot } from "../../sqlite/Compliance";
import { validateProject } from "../../validator/ValidatorEngine";
import { countBySeverity, countByRule } from "../../validator/ComplianceScorer";
import { generateFeature } from "../../scaffolder/FeatureGenerator";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join, basename } from "path";
import { getRulesDir } from "../../../utils/paths";
import { parseFrontmatter } from "../../../utils/frontmatter";
import { getEnabledManualRules } from "../../sqlite/Projects";
import { getActiveSession } from "../../sqlite/Socratic";
import { extractContext } from "../../socratic/SocraticBridge";
import type { SocraticContext } from "../../socratic/SocraticTypes";

/**
 * Register architecture-related routes.
 *
 * @param router - Express router
 * @param db - Database instance
 */
export function registerArchitectRoutes(router: Router, db: Database): void {
  // Compliance check
  router.get("/api/check", (req: Request, res: Response) => {
    const projectPath = req.query.project_path as string;
    if (!projectPath || typeof projectPath !== "string") {
      res.status(400).json({ error: "project_path query parameter required" });
      return;
    }

    const categories = req.query.categories
      ? (req.query.categories as string).split(",")
      : undefined;
    const severity = req.query.severity as string | undefined;

    const report = validateProject(projectPath, {
      categories,
      severity: severity as "critical" | "warning" | "info" | undefined,
    });

    // Save snapshot if project is registered
    const project = findProjectByPath(db, projectPath);
    if (project) {
      saveSnapshot(db, {
        projectId: project.id,
        overallScore: report.overallScore,
        scoresByCategory: report.scoresByCategory,
        totalFeatures: report.totalFeatures,
        totalFiles: report.totalFiles,
        totalViolations: report.violations.length,
        violationsBySeverity: countBySeverity(report.violations),
        violationsByRule: countByRule(report.violations),
      });
    }

    res.json(report);
  });

  // Feature scaffolding — uses Socratic context when available
  router.post("/api/scaffold", (req: Request, res: Response) => {
    const { project_path, feature_name, description, with_tests } = req.body;
    if (!project_path || !feature_name) {
      res.status(400).json({ error: "project_path and feature_name are required" });
      return;
    }
    if (typeof project_path !== "string" || typeof feature_name !== "string") {
      res.status(400).json({ error: "project_path and feature_name must be strings" });
      return;
    }

    try {
      // Step 1: Detect project language BEFORE creating any files
      let context: SocraticContext | null = null;
      let detectionSource: "socratic-verified" | "fallback-detection" | "undetected" = "undetected";

      // Check for active Socratic session → use verified context
      const session = getActiveSession(db);
      if (session) {
        context = extractContext(db, session.id);
        detectionSource = "socratic-verified";
      }

      // Fallback: detect language/structure from project files
      const detected = context ?? detectProjectBasics(project_path);
      if (!context && detected.language) {
        detectionSource = "fallback-detection";
      }

      const language = detected?.language ?? null;

      // Step 2: REFUSE to scaffold if language is unknown
      if (!language) {
        res.status(422).json({
          error: "Cannot determine project language. NEVER assume TypeScript.",
          action: "VERIFY the project language before scaffolding:",
          verification_steps: [
            "Read package.json → check for 'typescript' in dependencies/devDependencies",
            "List files: find . -name '*.js' -o -name '*.ts' | head -20",
            "Check tsconfig.json existence",
            "Ask the user what language the project uses",
          ],
          hint: "After verifying, call architect_scaffold again. The scaffold will auto-detect.",
          detectedContext: {
            language: null,
            framework: detected?.framework ?? null,
            projectStructure: detected?.projectStructure ?? null,
            source: detectionSource,
          },
        });
        return;
      }

      // Step 3: Scaffold with verified language
      const result = generateFeature({
        projectPath: project_path,
        featureName: feature_name,
        description: typeof description === "string" ? description : undefined,
        withTests: with_tests !== false,
        language,
      });

      res.status(201).json({
        ...result,
        detectedContext: {
          language,
          framework: detected?.framework ?? null,
          projectStructure: detected?.projectStructure ?? null,
          source: detectionSource,
        },
      });
    } catch (err) {
      res.status(409).json({ error: (err as Error).message });
    }
  });

  // Get architecture rules (project-aware: auto always, manual only if enabled)
  router.get("/api/rules", (req: Request, res: Response) => {
    const filePath = req.query.file_path as string | undefined;
    const category = req.query.category as string | undefined;
    const projectPath = req.query.project_path as string | undefined;
    const rulesDir = getRulesDir();

    if (!existsSync(rulesDir)) {
      res.json({ rules: [], message: "Rules directory not found" });
      return;
    }

    // Resolve enabled manual rules for the project
    let enabledManual: string[] = [];
    if (projectPath) {
      const project = findProjectByPath(db, projectPath);
      if (project) enabledManual = getEnabledManualRules(db, project.id);
    }

    const ruleFiles = readdirSync(rulesDir).filter(f => f.endsWith(".md")).sort();
    const rules: Array<{ id: string; name: string; mode: string; content: string }> = [];

    for (const file of ruleFiles) {
      const ruleId = basename(file, ".md");
      if (category && !ruleId.includes(category)) continue;

      const rawContent = readFileSync(join(rulesDir, file), "utf-8");
      const { metadata, body } = parseFrontmatter(rawContent);

      // Filter manual rules: skip unless enabled for project
      if (metadata.mode === "manual") {
        if (!enabledManual.includes(ruleId)) continue;
      }

      // Filter by file path scope if specified
      if (filePath && metadata.paths.length > 0) {
        const normalizedFilePath = filePath.replace(/\\/g, "/");
        const isRelevant = metadata.paths.some(p => {
          const pattern = p
            .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
            .replace(/\\\*\\\*/g, ".*")
            .replace(/\\\*/g, "[^/]*");
          return new RegExp(`^${pattern}$`).test(normalizedFilePath);
        });
        if (!isRelevant) continue;
      }

      rules.push({
        id: ruleId,
        name: ruleId.replace(/^\d+-/, "").replace(/-/g, " "),
        mode: metadata.mode,
        content: body,
      });
    }

    res.json({ rules });
  });
}

/* ── Fallback project detection (no Socratic session) ──── */

interface BasicDetection {
  language: string | null;
  framework: string | null;
  projectStructure: "flat" | "feature-first" | "clean-arch" | null;
}

/**
 * Minimum viable verification: detect language and structure from project files.
 * Used when no Socratic session is available — NEVER assume TypeScript.
 */
function detectProjectBasics(projectPath: string): BasicDetection {
  let language: string | null = null;
  let framework: string | null = null;
  let projectStructure: BasicDetection["projectStructure"] = null;

  // 1. Read package.json for language + framework
  const pkgPath = join(projectPath, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      language = deps.typescript || deps["ts-node"] ? "TypeScript" : "JavaScript";
      if (deps.react || deps["react-dom"]) framework = "React";
      else if (deps.vue) framework = "Vue";
      else if (deps.angular) framework = "Angular";
      else if (deps.express) framework = "Express";
      else if (deps.fastify) framework = "Fastify";
      else if (deps.next) framework = "Next.js";
    } catch { /* malformed package.json */ }
  }

  // 2. Check for Python
  if (!language && existsSync(join(projectPath, "requirements.txt"))) language = "Python";
  if (!language && existsSync(join(projectPath, "pyproject.toml"))) language = "Python";

  // 3. Detect structure from src/ layout
  const srcPath = join(projectPath, "src");
  if (existsSync(srcPath)) {
    try {
      const dirs = readdirSync(srcPath);
      if (dirs.includes("domain") || dirs.includes("application") || dirs.includes("infrastructure")) {
        projectStructure = "clean-arch";
      } else if (dirs.includes("features") || dirs.includes("modules")) {
        projectStructure = "feature-first";
      } else {
        projectStructure = "flat";
      }
    } catch { /* unreadable */ }
  }

  return { language, framework, projectStructure };
}
