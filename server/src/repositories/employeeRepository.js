const { query } = require('../config/database');
const { buildSearchClause } = require('../utils/pagination');

/**
 * Employee Repository
 * All database operations for employees
 */

/**
 * Find all employees with optional filtering and pagination
 * Returns total count via COUNT(*) OVER() window function
 * @param {Object} params
 * @param {string} [params.search]
 * @param {string} [params.division]
 * @param {string} [params.designation]
 * @param {boolean} [params.is_archived]
 * @param {number} params.limit
 * @param {number} params.offset
 * @returns {{ rows: Object[], total: number }}
 */
const findAll = async ({ search, division, designation, is_archived, limit, offset }) => {
  const conditions = [];
  const params = [];

  // Filter by archive status only when explicitly provided (undefined = show all)
  if (is_archived !== undefined) {
    params.push(is_archived);
    conditions.push(`e.is_archived = $${params.length}`);
  }

  // Full-text search across multiple columns
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
    conditions.push(
      `(e.name ILIKE $${params.length - 3} OR e.employee_id ILIKE $${params.length - 2} OR e.division ILIKE $${params.length - 1} OR e.designation ILIKE $${params.length})`
    );
  }

  if (division) {
    params.push(division);
    conditions.push(`e.division = $${params.length}`);
  }

  if (designation) {
    params.push(designation);
    conditions.push(`e.designation = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);

  const sql = `
    SELECT
      e.*,
      COUNT(a.id) FILTER (WHERE a.is_active = true) AS assigned_count,
      COUNT(*) OVER() AS total_count
    FROM employees e
    LEFT JOIN assignments a ON a.employee_id = e.id
    ${whereClause}
    GROUP BY e.id
    ORDER BY e.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const result = await query(sql, params);

  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  const rows = result.rows.map(({ total_count, ...row }) => row);

  return { rows, total };
};

/**
 * Find a single employee by internal UUID with assignment count
 * @param {string} id - UUID primary key
 * @returns {Object|null}
 */
const findById = async (id) => {
  const result = await query(
    `SELECT
      e.*,
      COUNT(a.id) FILTER (WHERE a.is_active = true) AS assigned_count
     FROM employees e
     LEFT JOIN assignments a ON a.employee_id = e.id
     WHERE e.id = $1
     GROUP BY e.id`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Find employee by their string employee_id (e.g. "EMP0001")
 * @param {string} employee_id
 * @returns {Object|null}
 */
const findByEmployeeId = async (employee_id) => {
  const result = await query(
    'SELECT * FROM employees WHERE employee_id = $1',
    [employee_id]
  );
  return result.rows[0] || null;
};

/**
 * Create a new employee record
 * @param {Object} data
 * @returns {Object}
 */
const create = async ({ employee_id, name, division, designation, mobile, email, remarks, created_by }) => {
  const result = await query(
    `INSERT INTO employees (employee_id, name, division, designation, mobile, email, remarks, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [employee_id, name, division || null, designation || null, mobile || null, email || null, remarks || null, created_by]
  );
  return result.rows[0];
};

/**
 * Update employee fields dynamically
 * Only updates provided fields
 * @param {string} id
 * @param {Object} fields
 * @returns {Object}
 */
const update = async (id, fields) => {
  const allowedFields = ['name', 'division', 'designation', 'mobile', 'email', 'remarks'];
  const setClauses = [];
  const params = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(fields, field)) {
      params.push(fields[field]);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) {
    throw new Error('No valid fields provided for update');
  }

  params.push(new Date(), id);
  setClauses.push(`updated_at = $${params.length - 1}`);

  const result = await query(
    `UPDATE employees
     SET ${setClauses.join(', ')}
     WHERE id = $${params.length}
     RETURNING *`,
    params
  );
  return result.rows[0] || null;
};

/**
 * Set an employee's archived status
 * @param {string} id
 * @param {boolean} is_archived
 * @returns {Object}
 */
const archive = async (id, is_archived) => {
  const result = await query(
    `UPDATE employees
     SET is_archived = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [is_archived, id]
  );
  return result.rows[0] || null;
};

/**
 * Delete all assignment records for an employee (cascade helper — no ON DELETE CASCADE in schema)
 * @param {string} employeeId - UUID
 */
const deleteAssignmentsByEmployeeId = async (employeeId) => {
  await query(`DELETE FROM assignments WHERE employee_id = $1`, [employeeId]);
};

/**
 * Permanently delete an employee record
 * Cascade deletes will handle assignment history (via FK ON DELETE CASCADE
 * on the assignments table is not set, so we check manually)
 * @param {string} id - UUID
 * @returns {boolean}
 */
const deleteEmployee = async (id) => {
  const result = await query(
    `DELETE FROM employees WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rows.length > 0;
};


/**
 * Get all active assignments for an employee (with asset details)
 * @param {string} employeeId - UUID
 * @returns {Object[]}
 */
const getAssignments = async (employeeId) => {
  const result = await query(
    `SELECT
      a.*,
      ast.asset_id AS asset_code,
      ast.product_name,
      ast.model,
      ast.serial_number,
      ast.asset_number,
      c.name AS category_name
     FROM assignments a
     JOIN assets ast ON ast.id = a.asset_id
     LEFT JOIN categories c ON c.id = ast.category_id
     WHERE a.employee_id = $1 AND a.is_active = true
     ORDER BY a.assigned_at DESC`,
    [employeeId]
  );
  return result.rows;
};

/**
 * Get full assignment history for an employee
 * @param {string} employeeId - UUID
 * @returns {Object[]}
 */
const getHistory = async (employeeId) => {
  const result = await query(
    `SELECT
      a.*,
      ast.asset_id AS asset_code,
      ast.product_name,
      ast.model,
      ast.serial_number,
      ast.asset_number,
      c.name AS category_name
     FROM assignments a
     JOIN assets ast ON ast.id = a.asset_id
     LEFT JOIN categories c ON c.id = ast.category_id
     WHERE a.employee_id = $1
     ORDER BY a.assigned_at DESC`,
    [employeeId]
  );
  return result.rows;
};

/**
 * Get distinct division values (for filter dropdowns)
 * @returns {string[]}
 */
const getDivisions = async () => {
  const result = await query(
    `SELECT DISTINCT division
     FROM employees
     WHERE division IS NOT NULL AND division <> '' AND is_archived = false
     ORDER BY division ASC`
  );
  return result.rows.map((r) => r.division);
};

/**
 * Get distinct designation values (for filter dropdowns)
 * @returns {string[]}
 */
const getDesignations = async () => {
  const result = await query(
    `SELECT DISTINCT designation
     FROM employees
     WHERE designation IS NOT NULL AND designation <> '' AND is_archived = false
     ORDER BY designation ASC`
  );
  return result.rows.map((r) => r.designation);
};

module.exports = {
  findAll,
  findById,
  findByEmployeeId,
  create,
  update,
  archive,
  deleteAssignmentsByEmployeeId,
  deleteEmployee,
  getAssignments,
  getHistory,
  getDivisions,
  getDesignations,
};

