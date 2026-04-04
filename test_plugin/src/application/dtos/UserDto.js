/**
 * UserDto — Data Transfer Object for API responses.
 */
class UserDto {
  static fromEntity(user) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  static fromEntityList(users) {
    return users.map(UserDto.fromEntity);
  }
}

module.exports = { UserDto };
