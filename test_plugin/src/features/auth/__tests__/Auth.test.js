const { Auth } = require("../../domain/entities/Auth");
const { AuthMapper } = require("../../application/mappers/AuthMapper");

describe("Auth", () => {
  test("creates entity with valid props", () => {
    const entity = new Auth({ id: "test-id" });
    expect(entity.id).toBe("test-id");
    expect(entity.createdAt).toBeInstanceOf(Date);
  });

  test("touch() updates updatedAt", () => {
    const entity = new Auth({ id: "test-id" });
    const before = entity.updatedAt;
    entity.touch();
    expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});

describe("AuthMapper", () => {
  test("toOutput returns serialized entity", () => {
    const entity = new Auth({ id: "test-id" });
    const output = AuthMapper.toOutput(entity);
    expect(output.id).toBe("test-id");
    expect(typeof output.createdAt).toBe("string");
  });
});
