/**
 * Feature scaffold generator.
 * Creates clean architecture folder structure for new features.
 *
 * @module FeatureGenerator
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { getTemplatesDir } from "../../utils/paths";
import { logger } from "../../utils/logger";

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
    "domain/entities",
    "domain/value-objects",
    "domain/ports",
    "domain/events",
    "domain/services",
    "application/use-cases",
    "application/dtos",
    "application/mappers",
    "infrastructure/controllers",
    "infrastructure/repositories",
    "infrastructure/adapters",
    "infrastructure/config",
  ];

  if (withTests) {
    dirs.push("__tests__/integration", "__tests__/e2e");
  }

  for (const dir of dirs) {
    const fullPath = join(featurePath, dir);
    mkdirSync(fullPath, { recursive: true });
    createdDirs.push(`src/features/${kebabName}/${dir}`);
  }

  // Generate entity file
  const entityContent = generateEntity(pascalName, description);
  writeFile(join(featurePath, "domain", "entities", `${pascalName}.ts`), entityContent);
  createdFiles.push(`src/features/${kebabName}/domain/entities/${pascalName}.ts`);

  // Generate repository port
  const portContent = generateRepositoryPort(pascalName);
  writeFile(join(featurePath, "domain", "ports", `${pascalName}Repository.ts`), portContent);
  createdFiles.push(`src/features/${kebabName}/domain/ports/${pascalName}Repository.ts`);

  // Generate DTO
  const dtoContent = generateDto(pascalName);
  writeFile(join(featurePath, "application", "dtos", `${pascalName}Dto.ts`), dtoContent);
  createdFiles.push(`src/features/${kebabName}/application/dtos/${pascalName}Dto.ts`);

  // Generate use case
  const useCaseContent = generateUseCase(pascalName);
  writeFile(join(featurePath, "application", "use-cases", `Create${pascalName}UseCase.ts`), useCaseContent);
  createdFiles.push(`src/features/${kebabName}/application/use-cases/Create${pascalName}UseCase.ts`);

  // Generate mapper
  const mapperContent = generateMapper(pascalName);
  writeFile(join(featurePath, "application", "mappers", `${pascalName}Mapper.ts`), mapperContent);
  createdFiles.push(`src/features/${kebabName}/application/mappers/${pascalName}Mapper.ts`);

  // Generate controller
  const controllerContent = generateController(pascalName);
  writeFile(join(featurePath, "infrastructure", "controllers", `${pascalName}Controller.ts`), controllerContent);
  createdFiles.push(`src/features/${kebabName}/infrastructure/controllers/${pascalName}Controller.ts`);

  // Generate repository implementation
  const repoImplContent = generateRepositoryImpl(pascalName);
  writeFile(join(featurePath, "infrastructure", "repositories", `${pascalName}RepositoryImpl.ts`), repoImplContent);
  createdFiles.push(`src/features/${kebabName}/infrastructure/repositories/${pascalName}RepositoryImpl.ts`);

  // Generate README
  const readmeContent = generateReadme(kebabName, pascalName, description);
  writeFile(join(featurePath, "README.md"), readmeContent);
  createdFiles.push(`src/features/${kebabName}/README.md`);

  // Generate .gitkeep files for empty directories
  const gitkeepDirs = [
    "domain/value-objects",
    "domain/events",
    "domain/services",
    "infrastructure/adapters",
    "infrastructure/config",
  ];
  if (withTests) {
    gitkeepDirs.push("__tests__/integration", "__tests__/e2e");
  }

  for (const dir of gitkeepDirs) {
    const gitkeepPath = join(featurePath, dir, ".gitkeep");
    if (!existsSync(gitkeepPath)) {
      writeFile(gitkeepPath, "");
    }
  }

  logger.info("Feature scaffold generated", {
    feature: kebabName,
    files: createdFiles.length,
    dirs: createdDirs.length,
  });

  return { createdFiles, createdDirs, featurePath };
}

function writeFile(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
}

function generateEntity(name: string, description: string): string {
  return `/**
 * ${name} entity — ${description}
 *
 * @module ${name}
 */

export interface ${name}Props {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ${name} domain entity.
 * Contains business logic and invariants.
 */
export class ${name} {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ${name}Props) {
    this.id = props.id;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
`;
}

function generateRepositoryPort(name: string): string {
  return `/**
 * ${name} repository port (interface).
 * Implemented in infrastructure layer.
 *
 * @module ${name}Repository
 */

import type { ${name} } from "../entities/${name}";

/**
 * Repository interface for ${name} persistence.
 * Domain defines the contract, infrastructure provides the implementation.
 */
export interface ${name}Repository {
  /** Find a ${name} by its unique ID */
  findById(id: string): Promise<${name} | null>;

  /** Persist a new or updated ${name} */
  save(entity: ${name}): Promise<void>;

  /** Remove a ${name} by ID */
  delete(id: string): Promise<void>;
}
`;
}

function generateDto(name: string): string {
  return `/**
 * ${name} Data Transfer Objects.
 * Used for input/output at application layer boundaries.
 *
 * @module ${name}Dto
 */

/** Input DTO for creating a ${name} */
export interface Create${name}Input {
  // TODO: Define input fields
}

/** Output DTO for ${name} responses */
export interface ${name}Output {
  id: string;
  createdAt: string;
  updatedAt: string;
}
`;
}

function generateUseCase(name: string): string {
  return `/**
 * Create${name} use case.
 * Orchestrates domain objects to create a new ${name}.
 *
 * @module Create${name}UseCase
 */

import type { ${name}Repository } from "../../domain/ports/${name}Repository";
import type { Create${name}Input, ${name}Output } from "../dtos/${name}Dto";
import { ${name} } from "../../domain/entities/${name}";
import { ${name}Mapper } from "../mappers/${name}Mapper";

/**
 * Use case: Create a new ${name}.
 *
 * @param input - Creation input data
 * @param repository - ${name} repository (injected)
 * @returns Created ${name} output DTO
 */
export async function create${name}(
  input: Create${name}Input,
  repository: ${name}Repository
): Promise<${name}Output> {
  const entity = new ${name}({
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await repository.save(entity);

  return ${name}Mapper.toOutput(entity);
}
`;
}

function generateMapper(name: string): string {
  return `/**
 * ${name} mapper — converts between domain entities and DTOs.
 *
 * @module ${name}Mapper
 */

import type { ${name} } from "../../domain/entities/${name}";
import type { ${name}Output } from "../dtos/${name}Dto";

/**
 * Maps ${name} entities to/from DTOs.
 */
export class ${name}Mapper {
  /**
   * Convert domain entity to output DTO.
   *
   * @param entity - Domain entity
   * @returns Output DTO
   */
  static toOutput(entity: ${name}): ${name}Output {
    return {
      id: entity.id,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
`;
}

function generateController(name: string): string {
  return `/**
 * ${name} HTTP controller.
 * Thin translation layer — delegates to use cases.
 *
 * @module ${name}Controller
 */

// TODO: Import framework-specific types (Express, Fastify, etc.)
// TODO: Import use cases from application layer
// TODO: Import repository implementation for dependency injection

/**
 * ${name} controller handles HTTP requests.
 * Controllers do ONLY: parse request → call use case → format response.
 */
export class ${name}Controller {
  // TODO: Implement HTTP handlers
  // constructor(private repository: ${name}Repository) {}
  //
  // async create(req: Request, res: Response): Promise<void> {
  //   const input = req.body;
  //   const result = await create${name}(input, this.repository);
  //   res.status(201).json({ data: result });
  // }
}
`;
}

function generateRepositoryImpl(name: string): string {
  return `/**
 * ${name} repository implementation.
 * Implements the domain port using actual database operations.
 *
 * @module ${name}RepositoryImpl
 */

import type { ${name} } from "../../domain/entities/${name}";
import type { ${name}Repository } from "../../domain/ports/${name}Repository";

/**
 * Database implementation of ${name}Repository port.
 */
export class ${name}RepositoryImpl implements ${name}Repository {
  /**
   * Find ${name} by ID.
   *
   * @param id - Entity ID
   * @returns Entity or null if not found
   */
  async findById(id: string): Promise<${name} | null> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  /**
   * Save ${name} to database.
   *
   * @param entity - Entity to persist
   */
  async save(entity: ${name}): Promise<void> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  /**
   * Delete ${name} by ID.
   *
   * @param id - Entity ID to delete
   */
  async delete(id: string): Promise<void> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }
}
`;
}

function generateReadme(kebabName: string, pascalName: string, description: string): string {
  return `# Feature: ${pascalName}

## Purpose
${description}

## Public API

### Exports
| Export | Type | Description |
|--------|------|-------------|
| \`${pascalName}\` | class | ${pascalName} domain entity |
| \`Create${pascalName}UseCase\` | function | Creates a new ${pascalName} |
| \`${pascalName}Output\` | interface | Output DTO |

### API Endpoints (if applicable)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/${kebabName} | Create new ${pascalName} |
| GET | /api/v1/${kebabName}/:id | Get ${pascalName} by ID |

## Dependencies

### Internal
- None (new feature)

### External
- None yet

### Forbidden Dependencies
- NEVER import from other features' internal code directly

## Data Flow
\`\`\`
Controller → Validate Input → Use Case → Domain Entity → Repository Port → Database
\`\`\`

## Testing
\`\`\`bash
# Unit tests
bun test -- --filter=${kebabName}

# Integration tests
bun run test:integration -- --filter=${kebabName}
\`\`\`
`;
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}
