/**
 * Tests for FeatureGenerator — feature scaffold creation.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateFeature } from "./FeatureGenerator";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "scaffold-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("generateFeature", () => {
  test("creates full directory structure", () => {
    const result = generateFeature({
      projectPath: tempDir,
      featureName: "user-profile",
    });

    expect(result.featurePath).toBe(join(tempDir, "src", "features", "user-profile"));
    expect(existsSync(join(result.featurePath, "domain", "entities"))).toBe(true);
    expect(existsSync(join(result.featurePath, "domain", "ports"))).toBe(true);
    expect(existsSync(join(result.featurePath, "application", "use-cases"))).toBe(true);
    expect(existsSync(join(result.featurePath, "application", "dtos"))).toBe(true);
    expect(existsSync(join(result.featurePath, "infrastructure", "controllers"))).toBe(true);
    expect(existsSync(join(result.featurePath, "infrastructure", "repositories"))).toBe(true);
  });

  test("generates correct source files", () => {
    const result = generateFeature({
      projectPath: tempDir,
      featureName: "order",
      description: "Order management",
    });

    expect(result.createdFiles).toContainEqual("src/features/order/domain/entities/Order.ts");
    expect(result.createdFiles).toContainEqual("src/features/order/domain/ports/OrderRepository.ts");
    expect(result.createdFiles).toContainEqual("src/features/order/application/dtos/OrderDto.ts");
    expect(result.createdFiles).toContainEqual("src/features/order/application/use-cases/CreateOrderUseCase.ts");
    expect(result.createdFiles).toContainEqual("src/features/order/README.md");
  });

  test("converts camelCase to kebab-case for directory name", () => {
    const result = generateFeature({
      projectPath: tempDir,
      featureName: "userProfile",
    });

    expect(result.featurePath).toContain("user-profile");
    expect(existsSync(result.featurePath)).toBe(true);
  });

  test("converts PascalCase to PascalCase for file names", () => {
    const result = generateFeature({
      projectPath: tempDir,
      featureName: "shopping-cart",
    });

    const entityPath = join(result.featurePath, "domain", "entities", "ShoppingCart.ts");
    expect(existsSync(entityPath)).toBe(true);

    const content = readFileSync(entityPath, "utf-8");
    expect(content).toContain("class ShoppingCart");
    expect(content).toContain("ShoppingCartProps");
  });

  test("throws on duplicate feature directory", () => {
    generateFeature({ projectPath: tempDir, featureName: "auth" });

    expect(() => {
      generateFeature({ projectPath: tempDir, featureName: "auth" });
    }).toThrow("already exists");
  });

  test("creates test directories when withTests is true", () => {
    const result = generateFeature({
      projectPath: tempDir,
      featureName: "payment",
      withTests: true,
    });

    expect(existsSync(join(result.featurePath, "__tests__", "integration"))).toBe(true);
    expect(existsSync(join(result.featurePath, "__tests__", "e2e"))).toBe(true);
  });

  test("skips test directories when withTests is false", () => {
    const result = generateFeature({
      projectPath: tempDir,
      featureName: "notification",
      withTests: false,
    });

    expect(existsSync(join(result.featurePath, "__tests__"))).toBe(false);
  });

  test("README includes feature description", () => {
    const result = generateFeature({
      projectPath: tempDir,
      featureName: "inventory",
      description: "Manages product stock levels",
    });

    const readme = readFileSync(join(result.featurePath, "README.md"), "utf-8");
    expect(readme).toContain("Manages product stock levels");
    expect(readme).toContain("Inventory");
  });

  test("creates .gitkeep in empty directories", () => {
    generateFeature({ projectPath: tempDir, featureName: "catalog" });

    const featurePath = join(tempDir, "src", "features", "catalog");
    expect(existsSync(join(featurePath, "domain", "value-objects", ".gitkeep"))).toBe(true);
    expect(existsSync(join(featurePath, "domain", "events", ".gitkeep"))).toBe(true);
    expect(existsSync(join(featurePath, "infrastructure", "adapters", ".gitkeep"))).toBe(true);
  });

  test("entity file has correct structure", () => {
    generateFeature({ projectPath: tempDir, featureName: "product" });

    const entityPath = join(tempDir, "src", "features", "product", "domain", "entities", "Product.ts");
    const content = readFileSync(entityPath, "utf-8");
    expect(content).toContain("interface ProductProps");
    expect(content).toContain("class Product");
    expect(content).toContain("readonly id: string");
    expect(content).toContain("constructor(props: ProductProps)");
  });

  test("repository port references entity correctly", () => {
    generateFeature({ projectPath: tempDir, featureName: "product" });

    const portPath = join(tempDir, "src", "features", "product", "domain", "ports", "ProductRepository.ts");
    const content = readFileSync(portPath, "utf-8");
    expect(content).toContain('import type { Product } from "../entities/Product"');
    expect(content).toContain("interface ProductRepository");
    expect(content).toContain("findById(id: string): Promise<Product | null>");
  });
});
