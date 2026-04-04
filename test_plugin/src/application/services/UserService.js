/**
 * UserService — application layer, orchestrates domain logic.
 * Correctly depends only on domain layer (UserRepository interface).
 */
const { User } = require('../../domain/entities/User');

class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async createUser(name, email, role) {
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new Error('User with this email already exists');
    }
    const id = Date.now().toString(36);
    const user = new User(id, name, email, role);
    await this.userRepository.save(user);
    return user;
  }

  async getUserById(id) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async updateUserEmail(id, newEmail) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    user.updateEmail(newEmail);
    await this.userRepository.save(user);
    return user;
  }

  async deleteUser(id) {
    await this.userRepository.delete(id);
  }

  async listUsers() {
    return this.userRepository.findAll();
  }
}

module.exports = { UserService };
