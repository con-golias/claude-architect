const { Order } = require("../../domain/entities/Order");
const { OrderMapper } = require("../../application/mappers/OrderMapper");

describe("Order", () => {
  test("creates entity with valid props", () => {
    const entity = new Order({ id: "test-id" });
    expect(entity.id).toBe("test-id");
    expect(entity.createdAt).toBeInstanceOf(Date);
  });

  test("touch() updates updatedAt", () => {
    const entity = new Order({ id: "test-id" });
    const before = entity.updatedAt;
    entity.touch();
    expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe("OrderMapper", () => {
  test("toOutput returns serialized entity", () => {
    const entity = new Order({ id: "test-id" });
    const output = OrderMapper.toOutput(entity);
    expect(output.id).toBe("test-id");
    expect(typeof output.createdAt).toBe("string");
  });
});
