const { query } = require('../config/database');

/**
 * Asset Repository
 * All database operations for assets.
 * asset_id is a TEXT field, unique, admin-entered.
 */

const findAll = async ({ search, category_id, status, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
    conditions.push(
      `(a.asset_id ILIKE $${params.length - 3} OR a.product_name ILIKE $${params.length - 2} OR a.serial_number ILIKE $${params.length - 1} OR a.asset_number ILIKE $${params.length})`
    );
  }

  if (category_id) {
    params.push(category_id);
    conditions.push(`a.category_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`a.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const sql = `
    SELECT
      a.*,
      c.name AS category_name,
      emp.name AS assigned_to_name,
      emp.employee_id AS assigned_to_employee_id,
      COUNT(*) OVER() AS total_count
    FROM assets a
    LEFT JOIN categories c ON c.id = a.category_id
    LEFT JOIN assignments asg ON asg.asset_id = a.id AND asg.is_active = true
    LEFT JOIN employees emp ON emp.id = asg.employee_id
    ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const result = await query(sql, params);
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  const rows = result.rows.map(({ total_count, ...row }) => row);

  return { rows, total };
};

const findById = async (id) => {
  const result = await query(
    `SELECT
      a.*,
      c.name AS category_name,
      asg.id AS assignment_id,
      asg.assigned_at,
      emp.id AS assigned_employee_id,
      emp.name AS assigned_to_name,
      emp.employee_id AS assigned_to_employee_id,
      emp.designation AS assigned_to_designation
     FROM assets a
     LEFT JOIN categories c ON c.id = a.category_id
     LEFT JOIN assignments asg ON asg.asset_id = a.id AND asg.is_active = true
     LEFT JOIN employees emp ON emp.id = asg.employee_id
     WHERE a.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const findByAssetId = async (asset_id) => {
  const result = await query('SELECT * FROM assets WHERE asset_id = $1', [asset_id]);
  return result.rows[0] || null;
};

const create = async ({
  asset_id,
  category_id,
  product_name,
  model,
  serial_number,
  asset_number,
  purchase_date,
  warranty_expiry,
  remarks,
  custom_fields,
  created_by,
}) => {
  const result = await query(
    `INSERT INTO assets
       (asset_id, category_id, product_name, model, serial_number, asset_number,
        purchase_date, warranty_expiry, remarks, custom_fields, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      asset_id,
      category_id,
      product_name || null,
      model || null,
      serial_number || null,
      asset_number || null,
      purchase_date || null,
      warranty_expiry || null,
      remarks || null,
      custom_fields ? JSON.stringify(custom_fields) : null,
      created_by,
    ]
  );
  return result.rows[0];
};

const update = async (id, fields) => {
  const allowedFields = [
    'category_id', 'product_name', 'model', 'serial_number', 'asset_number',
    'purchase_date', 'warranty_expiry', 'remarks', 'custom_fields',
  ];
  const setClauses = [];
  const params = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(fields, field)) {
      let value = fields[field];
      if (field === 'custom_fields' && value && typeof value === 'object') {
        value = JSON.stringify(value);
      }
      params.push(value);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) return findById(id);

  params.push(new Date(), id);
  setClauses.push(`updated_at = $${params.length - 1}`);

  const result = await query(
    `UPDATE assets SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return result.rows[0] || null;
};

const updateStatus = async (id, status) => {
  const result = await query(
    `UPDATE assets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0] || null;
};

/**
 * Delete all assignment records for an asset (cascade helper — no ON DELETE CASCADE in schema)
 * @param {string} assetId - UUID
 */
const deleteAssignmentsByAssetId = async (assetId) => {
  await query(`DELETE FROM assignments WHERE asset_id = $1`, [assetId]);
};

/**
 * Permanently delete an asset
 * @param {string} id - UUID
 * @returns {boolean}
 */
const deleteAsset = async (id) => {
  const result = await query(
    `DELETE FROM assets WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rows.length > 0;
};

module.exports = { findAll, findById, findByAssetId, create, update, updateStatus, deleteAssignmentsByAssetId, deleteAsset };

