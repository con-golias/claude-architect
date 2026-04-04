/**
 * UserRepositoryImpl — infrastructure implementation of domain repository.
 * Correctly implements the domain interface.
 */
const { UserRepository } = require('../../domain/repositories/UserRepository');
const { User } = require('../../domain/entities/User');
const { getDatabase } = require('./connection');

class UserRepositoryImpl extends UserRepository {
  constructor() {
    super();
    this.db = getDatabase();
  }

  async findById(id) {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return null;
    return new User(row.id, row.name, row.email, row.role);
  }

  async findByEmail(email) {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!row) return null;
    return new User(row.id, row.name, row.email, row.role);
  }

  async save(user) {
    this.db.prepare(
      'INSERT OR REPLACE INTO users (id, name, email, role) VALUES (?, ?, ?, ?)'
    ).run(user.id, user.name, user.email, user.role);
  }

  async delete(id) {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  async findAll() {
    const rows = this.db.prepare('SELECT * FROM users').all();
    return rows.map(r => new User(r.id, r.name, r.email, r.role));
  }
}

module.exports = { UserRepositoryImpl };
