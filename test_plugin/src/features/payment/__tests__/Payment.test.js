const { Payment } = require("../../domain/entities/Payment");
const { PaymentMapper } = require("../../application/mappers/PaymentMapper");

describe("Payment", () => {
  test("creates entity with valid props", () => {
    const entity = new Payment({ id: "test-id" });
    expect(entity.id).toBe("test-id");
    expect(entity.createdAt).toBeInstanceOf(Date);
  });

  test("touch() updates updatedAt", () => {
    const entity = new Payment({ id: "test-id" });
    const before = entity.updatedAt;
    entity.touch();
    expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe("PaymentMapper", () => {
  test("toOutput returns serialized entity", () => {
    const entity = new Payment({ id: "test-id" });
    const output = PaymentMapper.toOutput(entity);
    expect(output.id).toBe("test-id");
    expect(typeof output.createdAt).toBe("string");
  });
});
