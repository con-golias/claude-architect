class AuthMapper {
  static toOutput(entity) {
    return {
      id: entity.id,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}

module.exports = { AuthMapper };
