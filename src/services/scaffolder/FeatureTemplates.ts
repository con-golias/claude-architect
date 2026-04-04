/**
 * Template content generators for feature scaffolding.
 * Produces file content for each clean architecture component.
 * Language-aware: generates TypeScript or JavaScript based on `lang` parameter.
 *
 * @module FeatureTemplates
 */

/** Generate domain entity file content. */
export function generateEntity(name: string, description: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `/**
 * ${name} entity — ${description}
 *
 * @module ${name}
 */

/**
 * ${name} domain entity.
 * Contains business logic and invariants.
 */
export class ${name} {
  /**
   * @param {Object} props
   * @param {string} props.id
   * @param {Date} props.createdAt
   * @param {Date} props.updatedAt
   */
  constructor(props) {
    this.id = props.id;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
`;
  }

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

/** Generate repository port (interface) file content. */
export function generateRepositoryPort(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `/**
 * ${name} repository port (interface).
 * Implemented in infrastructure layer.
 *
 * @module ${name}Repository
 *
 * @typedef {Object} ${name}Repository
 * @property {function(string): Promise<${name}|null>} findById
 * @property {function(${name}): Promise<void>} save
 * @property {function(string): Promise<void>} delete
 */

// JavaScript doesn't have interfaces — this file documents the contract.
// Infrastructure implementations must follow the typedef above.
// See: infrastructure/repositories/${name}RepositoryImpl.js
`;
  }

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

/** Generate DTO file content. */
export function generateDto(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `/**
 * ${name} Data Transfer Objects.
 * Used for input/output at application layer boundaries.
 *
 * @module ${name}Dto
 */

/**
 * @typedef {Object} Create${name}Input
 * TODO: Define input fields
 */

/**
 * @typedef {Object} ${name}Output
 * @property {string} id
 * @property {string} createdAt
 * @property {string} updatedAt
 */
`;
  }

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

/** Generate use case file content. */
export function generateUseCase(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `/**
 * Create${name} use case.
 * Orchestrates domain objects to create a new ${name}.
 *
 * @module Create${name}UseCase
 */

import { ${name} } from "../../domain/entities/${name}.js";
import { ${name}Mapper } from "../mappers/${name}Mapper.js";

/**
 * Use case: Create a new ${name}.
 *
 * @param {Object} input - Creation input data
 * @param {Object} repository - ${name} repository (injected)
 * @returns {Promise<Object>} Created ${name} output DTO
 */
export async function create${name}(input, repository) {
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

/** Generate mapper file content. */
export function generateMapper(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `/**
 * ${name} mapper — converts between domain entities and DTOs.
 *
 * @module ${name}Mapper
 */

/**
 * Maps ${name} entities to/from DTOs.
 */
export class ${name}Mapper {
  /**
   * Convert domain entity to output DTO.
   *
   * @param {Object} entity - Domain entity
   * @returns {Object} Output DTO
   */
  static toOutput(entity) {
    return {
      id: entity.id,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
`;
  }

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

/** Generate controller file content. */
export function generateController(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
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
}
`;
  }

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
}
`;
}

/** Generate repository implementation file content. */
export function generateRepositoryImpl(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `/**
 * ${name} repository implementation.
 * Implements the domain port using actual database operations.
 *
 * @module ${name}RepositoryImpl
 */

/**
 * Database implementation of ${name} repository.
 */
export class ${name}RepositoryImpl {
  /** @param {string} id */
  async findById(id) {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  /** @param {Object} entity */
  async save(entity) {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  /** @param {string} id */
  async delete(id) {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }
}
`;
  }

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
  async findById(id: string): Promise<${name} | null> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  async save(entity: ${name}): Promise<void> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  async delete(id: string): Promise<void> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }
}
`;
}

/** Generate feature README file content. */
export function generateReadme(
  kebabName: string, pascalName: string, description: string,
): string {
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
bun test -- --filter=${kebabName}
\`\`\`
`;
}
