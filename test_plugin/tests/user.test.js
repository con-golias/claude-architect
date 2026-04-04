/**
 * Basic tests for User entity.
 */
const { User } = require('../src/domain/entities/User');

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  PASS: ${message}`);
}

console.log('User Entity Tests');
console.log('─────────────────');

// Test: Create user
const user = new User('1', 'John', 'john@example.com', 'user');
assert(user.id === '1', 'User has correct id');
assert(user.name === 'John', 'User has correct name');
assert(user.email === 'john@example.com', 'User has correct email');
assert(user.role === 'user', 'User has correct default role');

// Test: isAdmin
assert(!user.isAdmin(), 'Regular user is not admin');
const admin = new User('2', 'Admin', 'admin@example.com', 'admin');
assert(admin.isAdmin(), 'Admin user is admin');

// Test: updateEmail
user.updateEmail('newemail@example.com');
assert(user.email === 'newemail@example.com', 'Email updated successfully');

// Test: invalid email
try {
  user.updateEmail('invalid');
  assert(false, 'Should throw on invalid email');
} catch (e) {
  assert(e.message === 'Invalid email address', 'Throws on invalid email');
}

// Test: toJSON
const json = user.toJSON();
assert(json.id === '1', 'toJSON includes id');
assert(json.name === 'John', 'toJSON includes name');
assert(!json.password, 'toJSON does not include sensitive data');

console.log('\nAll tests passed!');
