/**
 * Feature scaffold generator.
 * Creates clean architecture folder structure for new features.
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
} from "./FeatureTemplates";

interface ScaffoldOptions {
  projectPath: string;
  featureName: string;
  description?: string;
  withTests?: boolean;
}

interface ScaffoldResult {
  createdFiles: string[];
  createdDirs: string[];
  featurePath: string;
}

/**
 * Generate a complete feature scaffold with clean architecture structure.
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
  } = options;

  const kebabName = toKebabCase(featureName);
  const pascalName = toPascalCase(featureName);
  const featurePath = join(projectPath, "src", "features", kebabName);

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

  // Generate source files
  const files: Array<[string, string, string]> = [
    [`domain/entities/${pascalName}.ts`, generateEntity(pascalName, description), "domain/entities"],
    [`domain/ports/${pascalName}Repository.ts`, generateRepositoryPort(pascalName), "domain/ports"],
    [`application/dtos/${pascalName}Dto.ts`, generateDto(pascalName), "application/dtos"],
    [`application/use-cases/Create${pascalName}UseCase.ts`, generateUseCase(pascalName), "application/use-cases"],
    [`application/mappers/${pascalName}Mapper.ts`, generateMapper(pascalName), "application/mappers"],
    [`infrastructure/controllers/${pascalName}Controller.ts`, generateController(pascalName), "infrastructure/controllers"],
    [`infrastructure/repositories/${pascalName}RepositoryImpl.ts`, generateRepositoryImpl(pascalName), "infrastructure/repositories"],
    ["README.md", generateReadme(kebabName, pascalName, description), ""],
  ];

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
  });

  return { createdFiles, createdDirs, featurePath };
}
