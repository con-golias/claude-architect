/**
 * Feature scaffold generator.
 * Creates clean architecture folder structure for new features.
 * Language-aware: generates JS or TS based on detected project language.
 *
 * @module FeatureGenerator
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "../../utils/logger";
import { toKebabCase, toPascalCase } from "../../utils/casing";
import {
  generateEntity,
  generateRepositoryPort,
  generateDto,
  generateUseCase,
  generateMapper,
  generateController,
  generateRepositoryImpl,
  generateReadme,
  generateTestSkeleton,
} from "./FeatureTemplates";

export interface ScaffoldOptions {
  projectPath: string;
  featureName: string;
  description?: string;
  withTests?: boolean;
  /** Detected language — "TypeScript" | "JavaScript" | null. Defaults to TypeScript. */
  language?: string | null;
}

export interface ScaffoldResult {
  createdFiles: string[];
  createdDirs: string[];
  featurePath: string;
}

/**
 * Generate a complete feature scaffold with clean architecture structure.
 * Uses detected language for file extensions and template content.
 *
 * @param options - Scaffold configuration
 * @returns List of created files and directories
 * @throws Error if feature directory already exists
 */
export function generateFeature(options: ScaffoldOptions): ScaffoldResult {
  const {
    projectPath,
    featureName,
    description = "TODO: Describe this feature",
    withTests = true,
    language = "TypeScript",
  } = options;

  const kebabName = toKebabCase(featureName);
  const pascalName = toPascalCase(featureName);
  const featurePath = join(projectPath, "src", "features", kebabName);
  const ext = language === "JavaScript" ? "js" : "ts";
  const lang: "ts" | "js" = ext as "ts" | "js";

  if (existsSync(featurePath)) {
    throw new Error(`Feature directory already exists: ${featurePath}`);
  }

  const createdDirs: string[] = [];
  const createdFiles: string[] = [];

  // Create directory structure
  const dirs = [
    "domain/entities", "domain/value-objects", "domain/ports",
    "domain/events", "domain/services",
    "application/use-cases", "application/dtos", "application/mappers",
    "infrastructure/controllers", "infrastructure/repositories",
    "infrastructure/adapters", "infrastructure/config",
  ];
  if (withTests) {
    dirs.push("__tests__/integration", "__tests__/e2e");
  }

  for (const dir of dirs) {
    mkdirSync(join(featurePath, dir), { recursive: true });
    createdDirs.push(`src/features/${kebabName}/${dir}`);
  }

  // Generate source files with correct extension and language
  const files: Array<[string, string]> = [
    [`domain/entities/${pascalName}.${ext}`, generateEntity(pascalName, description, lang)],
    [`domain/ports/${pascalName}Repository.${ext}`, generateRepositoryPort(pascalName, lang)],
    [`application/dtos/${pascalName}Dto.${ext}`, generateDto(pascalName, lang)],
    [`application/use-cases/Create${pascalName}UseCase.${ext}`, generateUseCase(pascalName, lang)],
    [`application/mappers/${pascalName}Mapper.${ext}`, generateMapper(pascalName, lang)],
    [`infrastructure/controllers/${pascalName}Controller.${ext}`, generateController(pascalName, lang)],
    [`infrastructure/repositories/${pascalName}RepositoryImpl.${ext}`, generateRepositoryImpl(pascalName, lang)],
    ["README.md", generateReadme(kebabName, pascalName, description)],
  ];

  if (withTests) {
    files.push([`__tests__/${pascalName}.test.${ext}`, generateTestSkeleton(pascalName, lang)]);
  }

  for (const [relativePath, content] of files) {
    writeFileSync(join(featurePath, relativePath), content, "utf-8");
    createdFiles.push(`src/features/${kebabName}/${relativePath}`);
  }

  // Generate .gitkeep files for empty directories
  const gitkeepDirs = [
    "domain/value-objects", "domain/events", "domain/services",
    "infrastructure/adapters", "infrastructure/config",
  ];
  if (withTests) {
    gitkeepDirs.push("__tests__/integration", "__tests__/e2e");
  }

  for (const dir of gitkeepDirs) {
    const gitkeepPath = join(featurePath, dir, ".gitkeep");
    if (!existsSync(gitkeepPath)) {
      writeFileSync(gitkeepPath, "", "utf-8");
    }
  }

  logger.info("Feature scaffold generated", {
    feature: kebabName,
    files: createdFiles.length,
    dirs: createdDirs.length,
    language: lang,
  });

  return { createdFiles, createdDirs, featurePath };
}
