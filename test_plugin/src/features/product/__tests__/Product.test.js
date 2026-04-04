const { Product } = require("../../domain/entities/Product");
const { ProductMapper } = require("../../application/mappers/ProductMapper");

describe("Product", () => {
  test("creates entity with valid props", () => {
    const entity = new Product({ id: "test-id" });
    expect(entity.id).toBe("test-id");
    expect(entity.createdAt).toBeInstanceOf(Date);
  });

  test("touch() updates updatedAt", () => {
    const entity = new Product({ id: "test-id" });
    const before = entity.updatedAt;
    entity.touch();
    expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe("ProductMapper", () => {
  test("toOutput returns serialized entity", () => {
    const entity = new Product({ id: "test-id" });
    const output = ProductMapper.toOutput(entity);
    expect(output.id).toBe("test-id");
    expect(typeof output.createdAt).toBe("string");
  });
});
