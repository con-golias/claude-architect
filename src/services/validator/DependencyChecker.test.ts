/**
 * Tests for DependencyChecker — validates import direction rules.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join, dirname } from "path";
import { checkDependencies } from "./DependencyChecker";

const TEST_DIR = join(import.meta.dir, "__test_fixtures__");

function createFile(relativePath: string, content: string): void {
  const fullPath = join(TEST_DIR, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("checkDependencies", () => {
  test("should return empty for project with no src directory", () => {
    const result = checkDependencies(TEST_DIR);
    expect(result.violations).toEqual([]);
    expect(result.filesScanned).toBe(0);
  });

  test("should detect domain importing from infrastructure", () => {
    createFile(
      "src/features/auth/domain/entities/User.ts",
      `import { db } from "../../infrastructure/repositories/UserRepo";
       export class User { id: string = ""; }`
    );
    createFile(
      "src/features/auth/infrastructure/repositories/UserRepo.ts",
      `export const db = {};`
    );

    const result = checkDependencies(TEST_DIR);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].severity).toBe("critical");
    expect(result.violations[0].category).toBe("dependency");
    expect(result.violations[0].description).toContain("infrastructure");
  });

  test("should detect domain importing from application", () => {
    createFile(
      "src/features/auth/domain/entities/User.ts",
      `import { CreateUserDto } from "../../application/dtos/UserDto";
       export class User { id: string = ""; }`
    );
    createFile(
      "src/features/auth/application/dtos/UserDto.ts",
      `export interface CreateUserDto { name: string; }`
    );

    const result = checkDependencies(TEST_DIR);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].description).toContain("application");
  });

  test("should detect application importing from infrastructure", () => {
    createFile(
      "src/features/auth/application/use-cases/CreateUser.ts",
      `import { pool } from "../../infrastructure/config/database";
       export function createUser() {}`
    );
    createFile(
      "src/features/auth/infrastructure/config/database.ts",
      `export const pool = {};`
    );

    const result = checkDependencies(TEST_DIR);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].severity).toBe("critical");
  });

  test("should allow infrastructure importing from domain", () => {
    createFile(
      "src/features/auth/domain/entities/User.ts",
      `export class User { id: string = ""; }`
    );
    createFile(
      "src/features/auth/infrastructure/repositories/UserRepoImpl.ts",
      `import { User } from "../../domain/entities/User";
       export class UserRepoImpl {}`
    );

    const result = checkDependencies(TEST_DIR);
    const infraViolations = result.violations.filter(
      (v) => v.filePath?.includes("infrastructure")
    );
    expect(infraViolations).toEqual([]);
  });

  test("should detect cross-feature direct imports", () => {
    createFile(
      "src/features/auth/domain/entities/User.ts",
      `export class User { id: string = ""; }`
    );
    // Use a path that contains "/features/" which the checker looks for
    createFile(
      "src/features/billing/application/use-cases/ChargeUser.ts",
      `import { User } from "../../../../features/auth/domain/entities/User";
       export function chargeUser() {}`
    );

    const result = checkDependencies(TEST_DIR);
    const crossFeature = result.violations.filter(
      (v) => v.ruleName === "Cross-Feature Isolation"
    );
    expect(crossFeature.length).toBeGreaterThan(0);
    expect(crossFeature[0].severity).toBe("warning");
  });

  test("should allow valid dependency direction", () => {
    createFile(
      "src/features/auth/domain/ports/UserRepository.ts",
      `export interface UserRepository { findById(id: string): Promise<unknown>; }`
    );
    createFile(
      "src/features/auth/application/use-cases/GetUser.ts",
      `import type { UserRepository } from "../../domain/ports/UserRepository";
       export function getUser(repo: UserRepository) {}`
    );

    const result = checkDependencies(TEST_DIR);
    expect(result.violations).toEqual([]);
  });
});
