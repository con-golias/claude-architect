/**
 * Template generators for feature scaffolding.
 * Produces clean architecture file content — TypeScript or JavaScript.
 */

/** Generate domain entity. */
export function generateEntity(name: string, description: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `class ${name} {
  constructor({ id, createdAt = new Date(), updatedAt = new Date() }) {
    this.id = id;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  touch() {
    this.updatedAt = new Date();
  }
}

module.exports = { ${name} };
`;
  }

  return `export interface ${name}Props {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ${name} {
  readonly id: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: ${name}Props) {
    this.id = props.id;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  touch(): void {
    this.updatedAt = new Date();
  }
}
`;
}

/** Generate repository port (domain contract). */
export function generateRepositoryPort(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `/**
 * ${name} repository contract.
 * Infrastructure layer must provide an implementation matching these methods.
 */
class ${name}Repository {
  async findById(id) { throw new Error("Not implemented"); }
  async save(entity) { throw new Error("Not implemented"); }
  async delete(id) { throw new Error("Not implemented"); }
}

module.exports = { ${name}Repository };
`;
  }

  return `import type { ${name} } from "../entities/${name}";

export interface ${name}Repository {
  findById(id: string): Promise<${name} | null>;
  save(entity: ${name}): Promise<void>;
  delete(id: string): Promise<void>;
}
`;
}

/** Generate DTO definitions. */
export function generateDto(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `/**
 * @typedef {Object} Create${name}Input
 * @typedef {{ id: string, createdAt: string, updatedAt: string }} ${name}Output
 */

module.exports = {};
`;
  }

  return `export interface Create${name}Input {
  // Define fields required to create a ${name}
}

export interface ${name}Output {
  id: string;
  createdAt: string;
  updatedAt: string;
}
`;
}

/** Generate use case. */
export function generateUseCase(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `const { ${name} } = require("../../domain/entities/${name}");
const { ${name}Mapper } = require("../mappers/${name}Mapper");

async function create${name}(input, repository) {
  const entity = new ${name}({
    id: crypto.randomUUID(),
  });

  await repository.save(entity);
  return ${name}Mapper.toOutput(entity);
}

module.exports = { create${name} };
`;
  }

  return `import type { ${name}Repository } from "../../domain/ports/${name}Repository";
import type { Create${name}Input, ${name}Output } from "../dtos/${name}Dto";
import { ${name} } from "../../domain/entities/${name}";
import { ${name}Mapper } from "../mappers/${name}Mapper";

export async function create${name}(
  input: Create${name}Input,
  repository: ${name}Repository,
): Promise<${name}Output> {
  const entity = new ${name}({
    id: crypto.randomUUID(),
  });

  await repository.save(entity);
  return ${name}Mapper.toOutput(entity);
}
`;
}

/** Generate entity-DTO mapper. */
export function generateMapper(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `class ${name}Mapper {
  static toOutput(entity) {
    return {
      id: entity.id,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}

module.exports = { ${name}Mapper };
`;
  }

  return `import type { ${name} } from "../../domain/entities/${name}";
import type { ${name}Output } from "../dtos/${name}Dto";

export class ${name}Mapper {
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

/** Generate HTTP controller stub. */
export function generateController(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `const { create${name} } = require("../../application/use-cases/Create${name}UseCase");

class ${name}Controller {
  constructor(repository) {
    this.repository = repository;
  }

  async create(req, res) {
    try {
      const result = await create${name}(req.body, this.repository);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
}

module.exports = { ${name}Controller };
`;
  }

  return `import type { Request, Response } from "express";
import type { ${name}Repository } from "../../domain/ports/${name}Repository";
import { create${name} } from "../../application/use-cases/Create${name}UseCase";

export class ${name}Controller {
  constructor(private readonly repository: ${name}Repository) {}

  async create(req: Request, res: Response): Promise<void> {
    try {
      const result = await create${name}(req.body, this.repository);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  }
}
`;
}

/** Generate repository implementation stub. */
export function generateRepositoryImpl(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `class ${name}RepositoryImpl {
  async findById(id) {
    throw new Error("${name}RepositoryImpl.findById not implemented");
  }

  async save(entity) {
    throw new Error("${name}RepositoryImpl.save not implemented");
  }

  async delete(id) {
    throw new Error("${name}RepositoryImpl.delete not implemented");
  }
}

module.exports = { ${name}RepositoryImpl };
`;
  }

  return `import type { ${name} } from "../../domain/entities/${name}";
import type { ${name}Repository } from "../../domain/ports/${name}Repository";

export class ${name}RepositoryImpl implements ${name}Repository {
  async findById(id: string): Promise<${name} | null> {
    throw new Error("${name}RepositoryImpl.findById not implemented");
  }

  async save(entity: ${name}): Promise<void> {
    throw new Error("${name}RepositoryImpl.save not implemented");
  }

  async delete(id: string): Promise<void> {
    throw new Error("${name}RepositoryImpl.delete not implemented");
  }
}
`;
}

/** Generate test skeleton for entity + mapper. */
export function generateTestSkeleton(name: string, lang: "ts" | "js" = "ts"): string {
  if (lang === "js") {
    return `const { ${name} } = require("../../domain/entities/${name}");
const { ${name}Mapper } = require("../../application/mappers/${name}Mapper");

describe("${name}", () => {
  test("creates entity with valid props", () => {
    const entity = new ${name}({ id: "test-id" });
    expect(entity.id).toBe("test-id");
    expect(entity.createdAt).toBeInstanceOf(Date);
  });

  test("touch() updates updatedAt", () => {
    const entity = new ${name}({ id: "test-id" });
    const before = entity.updatedAt;
    entity.touch();
    expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe("${name}Mapper", () => {
  test("toOutput returns serialized entity", () => {
    const entity = new ${name}({ id: "test-id" });
    const output = ${name}Mapper.toOutput(entity);
    expect(output.id).toBe("test-id");
    expect(typeof output.createdAt).toBe("string");
  });
});
`;
  }

  return `import { ${name} } from "../../domain/entities/${name}";
import { ${name}Mapper } from "../../application/mappers/${name}Mapper";

describe("${name}", () => {
  test("creates entity with valid props", () => {
    const entity = new ${name}({ id: "test-id" });
    expect(entity.id).toBe("test-id");
    expect(entity.createdAt).toBeInstanceOf(Date);
  });

  test("touch() updates updatedAt", () => {
    const entity = new ${name}({ id: "test-id" });
    const before = entity.updatedAt;
    entity.touch();
    expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe("${name}Mapper", () => {
  test("toOutput returns serialized entity", () => {
    const entity = new ${name}({ id: "test-id" });
    const output = ${name}Mapper.toOutput(entity);
    expect(output.id).toBe("test-id");
    expect(typeof output.createdAt).toBe("string");
  });
});
`;
}

/** Generate feature README. */
export function generateReadme(
  kebabName: string, pascalName: string, description: string,
): string {
  return `# ${pascalName}

${description}

## Structure

\`\`\`
${kebabName}/
├── domain/          Business rules and entities
├── application/     Use cases and DTOs
├── infrastructure/  Controllers and repository implementations
└── __tests__/       Integration and e2e tests
\`\`\`

## Data Flow

\`\`\`
Request → Controller → Use Case → Entity → Repository → Database
\`\`\`

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/${kebabName} | Create ${pascalName} |
| GET | /api/${kebabName}/:id | Get by ID |
`;
}
