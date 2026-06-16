const { query } = require('../config/database');

/**
 * Consumable Repository
 * All database operations for bulk-inventory items, stock transactions,
 * and per-employee issuances (consumable_assignments).
 *
 * "Returnable vs consumed-on-issue" is a per-issuance decision (stored
 * on consumable_assignments.is_returnable), not a per-item property.
 */

const findAll = async ({ search, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    params.push(term, term);
    conditions.push(
      `(c.name ILIKE $${params.length - 1} OR c.category ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);

  const sql = `
    SELECT
      c.*,
      (c.current_stock - c.damaged_quantity) AS available_quantity,
      COALESCE((
        SELECT SUM(quantity - COALESCE(returned_quantity, 0))
        FROM consumable_assignments
        WHERE consumable_id = c.id AND is_active = true
      ), 0) AS issued_quantity,
      COUNT(*) OVER() AS total_count
    FROM consumables c
    ${whereClause}
    ORDER BY c.name ASC
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
      c.*,
      (c.current_stock - c.damaged_quantity) AS available_quantity,
      COALESCE((
        SELECT SUM(quantity - COALESCE(returned_quantity, 0))
        FROM consumable_assignments
        WHERE consumable_id = c.id AND is_active = true
      ), 0) AS issued_quantity
     FROM consumables c
     WHERE c.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const create = async ({ name, category, unit, remarks, created_by }) => {
  const result = await query(
    `INSERT INTO consumables (name, category, unit, remarks, created_by, current_stock, damaged_quantity)
     VALUES ($1, $2, $3, $4, $5, 0, 0)
     RETURNING *, (current_stock - damaged_quantity) AS available_quantity`,
    [name, category || null, unit || null, remarks || null, created_by]
  );
  return result.rows[0];
};

const update = async (id, data) => {
  const allowedFields = ['name', 'category', 'unit', 'remarks'];
  const setClauses = [];
  const params = [];

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      params.push(data[field]);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) return findById(id);

  params.push(new Date(), id);
  setClauses.push(`updated_at = $${params.length - 1}`);

  const result = await query(
    `UPDATE consumables SET ${setClauses.join(', ')} WHERE id = $${params.length}
     RETURNING *, (current_stock - damaged_quantity) AS available_quantity`,
    params
  );
  return result.rows[0] || null;
};

const deleteConsumable = async (id) => {
  await query('DELETE FROM consumables WHERE id = $1', [id]);
};

const addStock = async (id, quantity) => {
  const result = await query(
    `UPDATE consumables
     SET current_stock = current_stock + $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *, (current_stock - damaged_quantity) AS available_quantity`,
    [quantity, id]
  );
  return result.rows[0] || null;
};

const removeStock = async (id, quantity) => {
  const result = await query(
    `UPDATE consumables
     SET current_stock = current_stock - $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *, (current_stock - damaged_quantity) AS available_quantity`,
    [quantity, id]
  );
  return result.rows[0] || null;
};

const markDamaged = async (id, quantity) => {
  const result = await query(
    `UPDATE consumables
     SET damaged_quantity = damaged_quantity + $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *, (current_stock - damaged_quantity) AS available_quantity`,
    [quantity, id]
  );
  return result.rows[0] || null;
};

const getTransactions = async (consumableId, { limit, offset }) => {
  const result = await query(
    `SELECT
      st.*,
      u.full_name AS performed_by_name,
      e.name AS employee_name,
      e.employee_code,
      COUNT(*) OVER() AS total_count
     FROM stock_transactions st
     LEFT JOIN users u ON u.id = st.performed_by
     LEFT JOIN employees e ON e.id = st.employee_id
     WHERE st.consumable_id = $1
     ORDER BY st.created_at DESC
     LIMIT $2 OFFSET $3`,
    [consumableId, limit, offset]
  );

  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  const rows = result.rows.map(({ total_count, ...row }) => row);

  return { rows, total };
};

const createTransaction = async ({
  consumable_id,
  transaction_type,
  quantity,
  reference,
  remarks,
  performed_by,
  employee_id,
}) => {
  const result = await query(
    `INSERT INTO stock_transactions
       (consumable_id, transaction_type, quantity, reference, remarks, performed_by, employee_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [consumable_id, transaction_type, quantity, reference || null, remarks || null, performed_by, employee_id || null]
  );
  return result.rows[0];
};

// ─── Consumable Assignments ────────────────────────────────────

const findAllAssignments = async ({ employee_id, consumable_id, is_active, search, limit, offset }) => {
  const conditions = [];
  const params = [];

  if (employee_id !== undefined) {
    params.push(employee_id);
    conditions.push(`ca.employee_id = $${params.length}`);
  }

  if (consumable_id !== undefined) {
    params.push(consumable_id);
    conditions.push(`ca.consumable_id = $${params.length}`);
  }

  if (is_active !== undefined) {
    params.push(is_active);
    conditions.push(`ca.is_active = $${params.length}`);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    params.push(term, term);
    conditions.push(
      `(e.name ILIKE $${params.length - 1} OR c.name ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  const sql = `
    SELECT
      ca.*,
      e.name AS employee_name,
      e.employee_code,
      e.division AS employee_division,
      c.name AS consumable_name,
      c.category AS consumable_category,
      c.unit AS consumable_unit,
      COUNT(*) OVER() AS total_count
    FROM consumable_assignments ca
    JOIN employees e ON e.id = ca.employee_id
    JOIN consumables c ON c.id = ca.consumable_id
    ${whereClause}
    ORDER BY ca.assigned_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const result = await query(sql, params);
  const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
  const rows = result.rows.map(({ total_count, ...row }) => row);

  return { rows, total };
};

const findAssignmentById = async (id) => {
  const result = await query(
    `SELECT
      ca.*,
      e.name AS employee_name,
      e.employee_code,
      c.name AS consumable_name,
      c.unit AS consumable_unit
     FROM consumable_assignments ca
     JOIN employees e ON e.id = ca.employee_id
     JOIN consumables c ON c.id = ca.consumable_id
     WHERE ca.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

const createAssignment = async ({ consumable_id, employee_id, quantity, is_returnable, remarks, assigned_by }) => {
  const result = await query(
    `INSERT INTO consumable_assignments (consumable_id, employee_id, quantity, is_returnable, remarks, assigned_by, is_active, assigned_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
     RETURNING *`,
    [consumable_id, employee_id, quantity, !!is_returnable, remarks || null, assigned_by]
  );
  return result.rows[0];
};

const returnAssignment = async (id, { returned_quantity, return_condition, returned_by, remarks }) => {
  const result = await query(
    `UPDATE consumable_assignments
     SET is_active = false,
         returned_at = NOW(),
         returned_quantity = $1,
         return_condition = $2,
         returned_by = $3,
         return_remarks = $4,
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [returned_quantity, return_condition, returned_by, remarks || null, id]
  );
  return result.rows[0] || null;
};

const deleteAssignmentsByConsumableId = async (consumableId) => {
  await query(`DELETE FROM consumable_assignments WHERE consumable_id = $1`, [consumableId]);
};

const getActiveAssignmentCount = async (consumableId) => {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM consumable_assignments WHERE consumable_id = $1 AND is_active = true`,
    [consumableId]
  );
  return result.rows[0]?.count || 0;
};

module.exports = {
  findAll,
  findById,
  create,
  update,
  deleteConsumable,
  addStock,
  removeStock,
  markDamaged,
  getTransactions,
  createTransaction,
  findAllAssignments,
  findAssignmentById,
  createAssignment,
  returnAssignment,
  deleteAssignmentsByConsumableId,
  getActiveAssignmentCount,
};
