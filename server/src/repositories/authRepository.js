const { query } = require('../config/database');

/**
 * Auth Repository
 * Handles all database operations related to authentication
 */

/**
 * Find a user by email address (includes password_hash for auth)
 * @param {string} email
 * @returns {Object|null}
 */
const getUserByEmail = async (email) => {
  const result = await query(
    `SELECT id, email, full_name, role, is_active, password_hash, last_login_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return result.rows[0] || null;
};

/**
 * Find a user by ID (excludes password_hash for security)
 * @param {string} id
 * @returns {Object|null}
 */
const getUserById = async (id) => {
  const result = await query(
    `SELECT id, email, full_name, role, is_active, last_login_at, created_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Update the last_login_at timestamp for a user
 * @param {string} id
 */
const updateLastLogin = async (id) => {
  await query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [id]
  );
};

/**
 * Count total users in the system (used for setup check)
 * @returns {number}
 */
const countUsers = async () => {
  const result = await query('SELECT COUNT(*) as count FROM users');
  return parseInt(result.rows[0].count, 10);
};

/**
 * Create a new user with a hashed password
 * @param {Object} data
 * @param {string} data.id
 * @param {string} data.email
 * @param {string} data.full_name
 * @param {string} data.role
 * @param {string} data.password_hash
 * @returns {Object}
 */
const createUser = async ({ id, email, full_name, role, password_hash }) => {
  const result = await query(
    `INSERT INTO users (id, email, full_name, role, password_hash, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, email, full_name, role, is_active, created_at`,
    [id, email, full_name, role, password_hash]
  );
  return result.rows[0];
};

module.exports = { getUserByEmail, getUserById, updateLastLogin, countUsers, createUser };
