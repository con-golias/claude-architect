/**
 * UserRepository interface — domain layer contract.
 * Infrastructure must implement this, not the other way around.
 */
class UserRepository {
  async findById(id) {
    throw new Error('Not implemented');
  }

  async findByEmail(email) {
    throw new Error('Not implemented');
  }

  async save(user) {
    throw new Error('Not implemented');
  }

  async delete(id) {
    throw new Error('Not implemented');
  }

  async findAll() {
    throw new Error('Not implemented');
  }
}

module.exports = { UserRepository };
