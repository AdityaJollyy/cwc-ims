const { query } = require('../config/database');

/**
 * Report Repository
 * Complex aggregation queries for management reports
 */

/**
 * Get all employees with their currently assigned assets
 * @returns {Object[]}
 */
const getEmployeeAssets = async () => {
  const result = await query(`
    SELECT
      e.id AS employee_uuid,
      e.employee_code,
      e.name AS employee_name,
      e.division,
      e.designation,
      e.mobile,
      e.email,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'assignment_id', a.id,
            'asset_uuid', ast.id,
            'product_name', ast.product_name,
            'model', ast.model,
            'serial_number', ast.serial_number,
            'asset_number', ast.asset_number,
            'category_name', c.name,
            'assigned_at', a.assigned_at
          ) ORDER BY a.assigned_at DESC
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'
      ) AS assigned_assets
    FROM employees e
    LEFT JOIN assignments a ON a.employee_id = e.id AND a.is_active = true
    LEFT JOIN assets ast ON ast.id = a.asset_id
    LEFT JOIN categories c ON c.id = ast.category_id
    WHERE e.is_archived = false
    GROUP BY e.id
    ORDER BY e.name ASC
  `);
  return result.rows;
};

/**
 * Get each category with asset counts broken down by status
 * @returns {Object[]}
 */
const getCategoryAssets = async () => {
  const result = await query(`
    SELECT
      c.id,
      c.name AS category_name,
      c.description,
      COUNT(a.id) AS total_assets,
      COUNT(a.id) FILTER (WHERE a.status = 'available') AS available,
      COUNT(a.id) FILTER (WHERE a.status = 'assigned') AS assigned,
      COUNT(a.id) FILTER (WHERE a.status = 'under_repair') AS under_repair,
      COUNT(a.id) FILTER (WHERE a.status = 'damaged') AS damaged,
      COUNT(a.id) FILTER (WHERE a.status = 'retired') AS retired
    FROM categories c
    LEFT JOIN assets a ON a.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `);
  return result.rows;
};

/**
 * Get filtered list of assets with their status
 * @param {Object} params
 * @param {string} [params.category_id]
 * @param {string} [params.status]
 * @returns {Object[]}
 */
const getAssetStatusReport = async ({ category_id, status } = {}) => {
  const conditions = [];
  const params = [];

  if (category_id) {
    params.push(category_id);
    conditions.push(`a.category_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
      a.*,
      c.name AS category_name,
      emp.name AS assigned_to_name,
      emp.employee_code AS assigned_to_employee_code
     FROM assets a
     LEFT JOIN categories c ON c.id = a.category_id
     LEFT JOIN assignments asg ON asg.asset_id = a.id AND asg.is_active = true
     LEFT JOIN employees emp ON emp.id = asg.employee_id
     ${whereClause}
     ORDER BY c.name ASC, a.product_name ASC`,
    params
  );
  return result.rows;
};

/**
 * Get assignment history with optional date/employee filters
 * @param {Object} params
 * @param {string} [params.from_date]
 * @param {string} [params.to_date]
 * @param {string} [params.employee_id]
 * @returns {Object[]}
 */
const getAssignmentHistory = async ({ from_date, to_date, employee_id } = {}) => {
  const conditions = [];
  const params = [];

  if (from_date) {
    params.push(from_date);
    conditions.push(`a.assigned_at >= $${params.length}`);
  }

  if (to_date) {
    params.push(to_date);
    conditions.push(`a.assigned_at <= $${params.length}`);
  }

  if (employee_id) {
    params.push(employee_id);
    conditions.push(`a.employee_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT
      a.id AS assignment_id,
      a.assigned_at,
      a.returned_at,
      a.is_active,
      a.return_condition,
      a.remarks,
      a.return_remarks,
      e.name AS employee_name,
      e.employee_code,
      e.division,
      e.designation,
      ast.product_name,
      ast.model,
      ast.serial_number,
      ast.asset_number,
      c.name AS category_name
     FROM assignments a
     JOIN employees e ON e.id = a.employee_id
     JOIN assets ast ON ast.id = a.asset_id
     LEFT JOIN categories c ON c.id = ast.category_id
     ${whereClause}
     ORDER BY a.assigned_at DESC`,
    params
  );
  return result.rows;
};

/**
 * Get all consumables with full stock details
 * @returns {Object[]}
 */
const getConsumableStock = async () => {
  const result = await query(`
    SELECT
      c.*,
      (c.current_stock - c.damaged_quantity) AS available_quantity,
      CASE
        WHEN (c.current_stock - c.damaged_quantity) < 10 THEN true
        ELSE false
      END AS is_low_stock
    FROM consumables c
    ORDER BY c.name ASC
  `);
  return result.rows;
};

/**
 * Get all assets with status 'damaged'
 * @returns {Object[]}
 */
const getDamagedAssets = async () => {
  const result = await query(`
    SELECT
      a.*,
      c.name AS category_name,
      asg.returned_at AS damaged_reported_at,
      emp.name AS last_assigned_to
     FROM assets a
     LEFT JOIN categories c ON c.id = a.category_id
     LEFT JOIN assignments asg ON asg.asset_id = a.id AND asg.return_condition = 'damaged'
     LEFT JOIN employees emp ON emp.id = asg.employee_id
     WHERE a.status = 'damaged'
     ORDER BY a.updated_at DESC
  `);
  return result.rows;
};

module.exports = {
  getEmployeeAssets,
  getCategoryAssets,
  getAssetStatusReport,
  getAssignmentHistory,
  getConsumableStock,
  getDamagedAssets,
};
