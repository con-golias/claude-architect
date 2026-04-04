/**
 * Database connection module.
 * SECURITY VIOLATIONS: hardcoded credentials, no encryption.
 */

// SECURITY: Hardcoded database credentials
const DB_HOST = 'production-db.company.internal';
const DB_USER = 'admin';
const DB_PASSWORD = 'super_secret_password_123!';
const DB_NAME = 'myapp_production';
const API_KEY = 'sk-proj-abc123def456ghi789';

let dbInstance = null;

function getDatabase() {
  if (!dbInstance) {
    // In a real app this would connect to the DB
    // For testing purposes, we simulate the connection
    console.log(`Connecting to ${DB_HOST} as ${DB_USER}...`);
    dbInstance = {
      prepare: (sql) => ({
        run: (...args) => ({ changes: 1 }),
        get: (...args) => null,
        all: (...args) => [],
      }),
    };
  }
  return dbInstance;
}

// SECURITY: Exposing connection string with credentials
function getConnectionString() {
  return `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}`;
}

module.exports = { getDatabase, getConnectionString, API_KEY };
