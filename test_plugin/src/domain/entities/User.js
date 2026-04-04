/**
 * User domain entity — pure business logic, no infrastructure dependencies.
 */
class User {
  constructor(id, name, email, role = 'user') {
    this.id = id;
    this.name = name;
    this.email = email;
    this.role = role;
    this.createdAt = new Date();
  }

  isAdmin() {
    return this.role === 'admin';
  }

  updateEmail(newEmail) {
    if (!newEmail || !newEmail.includes('@')) {
      throw new Error('Invalid email address');
    }
    this.email = newEmail;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      createdAt: this.createdAt,
    };
  }
}

module.exports = { User };
