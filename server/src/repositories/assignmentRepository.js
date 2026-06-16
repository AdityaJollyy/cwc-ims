const { query } = require('../config/database');

/**
 * Assignment Repository
 * All database operations for asset assignments
 */

/**
 * Find assignments with optional filters and pagination
 * @param {Object} params
 * @param {string} [params.employee_id]
 * @param {string} [params.asset_id]
 * @param {boolean} [params.is_active]
 * @param {number} params.limit
 * @param {number} params.offset
 * @returns {{ rows: Object[], total: number }}
 */
const findAll = async ({ employee_id, asset_id, is_active, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (employee_id !== undefined) {
    params.push(employee_id);
    conditions.push(`a.employee_id = $${params.length}`);
  }

  if (asset_id !== undefined) {
    params.push(asset_id);
    conditions.push(`a.asset_id = $${params.length}`);
  }

  if (is_active !== undefined) {
    params.push(is_active);
    conditions.push(`a.is_active = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);

  const sql = `
    SELECT
      a.*,
      e.name AS employee_name,
      e.employee_id AS employee_code,
      e.division AS employee_division,
      ast.product_name,
      ast.model,
      ast.serial_number,
      ast.asset_number,
      c.name AS category_name,
      COUNT(*) OVER() AS total_count
    FROM assignments a
    JOIN employees e ON e.id = a.employee_id
    JOIN assets ast ON ast.id = a.asset_id
    LEFT JOIN categories c ON c.id = ast.category_id
    ${whereClause}
    ORDER BY a.assigned_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const result = await query(sql, params);
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  const rows = result.rows.map(({ total_count, ...row }) => row);

  return { rows, total };
};

/**
 * Find a single assignment by ID with full details
 * @param {string} id
 * @returns {Object|null}
 */
const findById = async (id) => {
  const result = await query(
    `SELECT
      a.*,
      e.name AS employee_name,
      e.employee_id AS employee_code,
      e.designation AS employee_designation,
      ast.product_name,
      ast.model,
      ast.serial_number,
      ast.asset_number,
      c.name AS category_name
     FROM assignments a
     JOIN employees e ON e.id = a.employee_id
     JOIN assets ast ON ast.id = a.asset_id
     LEFT JOIN categories c ON c.id = ast.category_id
     WHERE a.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

/**
 * Find the active assignment for an asset (if any)
 * @param {string} asset_id - UUID
 * @returns {Object|null}
 */
const findActiveByAssetId = async (asset_id) => {
  const result = await query(
    `SELECT * FROM assignments WHERE asset_id = $1 AND is_active = true LIMIT 1`,
    [asset_id]
  );
  return result.rows[0] || null;
};

/**
 * Create an assignment record
 * @param {Object} data
 * @returns {Object}
 */
const create = async ({ employee_id, asset_id, remarks, assigned_by }) => {
  const result = await query(
    `INSERT INTO assignments (employee_id, asset_id, remarks, assigned_by, is_active, assigned_at)
     VALUES ($1, $2, $3, $4, true, NOW())
     RETURNING *`,
    [employee_id, asset_id, remarks || null, assigned_by]
  );
  return result.rows[0];
};

/**
 * Mark an assignment as returned
 * @param {string} id - assignment UUID
 * @param {Object} returnData
 * @returns {Object}
 */
const returnAssignment = async (id, { returned_at, return_condition, returned_by, remarks }) => {
  const result = await query(
    `UPDATE assignments
     SET is_active = false,
         returned_at = $1,
         return_condition = $2,
         returned_by = $3,
         return_remarks = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [returned_at, return_condition, returned_by, remarks || null, id]
  );
  return result.rows[0] || null;
};

/**
 * Get full assignment history with optional search/filters
 * @param {Object} params
 * @param {string} [params.search]
 * @param {string} [params.employee_id]
 * @param {string} [params.category_id]
 * @param {number} params.limit
 * @param {number} params.offset
 * @returns {{ rows: Object[], total: number }}
 */
const getHistory = async ({ search, employee_id, category_id, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
    conditions.push(
      `(e.name ILIKE $${params.length - 2} OR ast.product_name ILIKE $${params.length - 1} OR ast.serial_number ILIKE $${params.length})`
    );
  }

  if (employee_id) {
    params.push(employee_id);
    conditions.push(`a.employee_id = $${params.length}`);
  }

  if (category_id) {
    params.push(category_id);
    conditions.push(`ast.category_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);

  const sql = `
    SELECT
      a.*,
      e.name AS employee_name,
      e.employee_id AS employee_code,
      ast.product_name,
      ast.model,
      ast.serial_number,
      ast.asset_number,
      c.name AS category_name,
      COUNT(*) OVER() AS total_count
    FROM assignments a
    JOIN employees e ON e.id = a.employee_id
    JOIN assets ast ON ast.id = a.asset_id
    LEFT JOIN categories c ON c.id = ast.category_id
    ${whereClause}
    ORDER BY a.assigned_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const result = await query(sql, params);
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  const rows = result.rows.map(({ total_count, ...row }) => row);

  return { rows, total };
};

module.exports = { findAll, findById, findActiveByAssetId, create, returnAssignment, getHistory };
