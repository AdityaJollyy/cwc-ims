const { query } = require('../config/database');

/**
 * Dashboard Repository
 * Aggregation queries for the dashboard overview
 */

// Assets older than this many years are considered to need maintenance.
const MAINTENANCE_AGE_YEARS = 5;

/**
 * Get system-wide statistics in a single efficient query set
 * @returns {Object}
 */
const getStats = async () => {
  const [
    employeeResult,
    assetResult,
    consumableResult,
    lowStockResult,
    maintenanceResult,
  ] = await Promise.all([
    // Total active (non-archived) employees
    query(`SELECT COUNT(*) AS total_employees FROM employees WHERE is_archived = false`),

    // Asset counts broken down by status
    query(`
      SELECT
        COUNT(*) AS total_assets,
        COUNT(*) FILTER (WHERE status = 'available') AS available_assets,
        COUNT(*) FILTER (WHERE status = 'assigned') AS assigned_assets,
        COUNT(*) FILTER (WHERE status = 'under_repair') AS under_repair_assets,
        COUNT(*) FILTER (WHERE status = 'damaged') AS damaged_assets,
        COUNT(*) FILTER (WHERE status = 'retired') AS retired_assets
      FROM assets
    `),

    // Total consumables
    query(`SELECT COUNT(*) AS total_consumables FROM consumables`),

    // Low stock items (available qty < 10)
    query(`
      SELECT COUNT(*) AS low_stock_items
      FROM consumables
      WHERE (current_stock - damaged_quantity) < 10
    `),

    // Assets older than the maintenance threshold (excluding retired).
    // Uses purchase_date when available, falling back to created_at — keeps
    // results consistent with the Assets page age filter.
    query(
      `SELECT COUNT(*) AS needs_maintenance
       FROM assets
       WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(purchase_date, created_at))) >= $1::INT
         AND status <> 'retired'`,
      [MAINTENANCE_AGE_YEARS]
    ),
  ]);

  const assets = assetResult.rows[0];

  return {
    totalEmployees:    parseInt(employeeResult.rows[0].total_employees, 10),
    totalAssets:       parseInt(assets.total_assets, 10),
    availableAssets:   parseInt(assets.available_assets, 10),
    assignedAssets:    parseInt(assets.assigned_assets, 10),
    underRepairAssets: parseInt(assets.under_repair_assets, 10),
    damagedAssets:     parseInt(assets.damaged_assets, 10),
    retiredAssets:     parseInt(assets.retired_assets, 10),
    totalConsumables:  parseInt(consumableResult.rows[0].total_consumables, 10),
    lowStockItems:     parseInt(lowStockResult.rows[0].low_stock_items, 10),
    needsMaintenance:  parseInt(maintenanceResult.rows[0].needs_maintenance, 10),
    maintenanceAgeYears: MAINTENANCE_AGE_YEARS,
  };
};

/**
 * List assets older than the maintenance threshold (>5 years, excluding retired).
 * Used by the dashboard "Needs Maintenance" alert modal.
 * @returns {Object[]}
 */
const getMaintenanceAlertAssets = async () => {
  const result = await query(
    `SELECT
       a.id,
       a.product_name,
       a.model,
       a.serial_number,
       a.asset_number,
       a.status,
       a.purchase_date,
       a.created_at,
       c.name AS category_name,
       emp.name AS assigned_to_name,
       emp.employee_code AS assigned_to_employee_code
     FROM assets a
     LEFT JOIN categories c ON c.id = a.category_id
     LEFT JOIN assignments asg ON asg.asset_id = a.id AND asg.is_active = true
     LEFT JOIN employees emp ON emp.id = asg.employee_id
     WHERE EXTRACT(YEAR FROM AGE(CURRENT_DATE, COALESCE(a.purchase_date, a.created_at))) >= $1::INT
       AND a.status <> 'retired'
     ORDER BY COALESCE(a.purchase_date, a.created_at) ASC`,
    [MAINTENANCE_AGE_YEARS]
  );
  return {
    thresholdYears: MAINTENANCE_AGE_YEARS,
    assets: result.rows,
  };
};

/**
 * Get recent assignment activity (both assignments and returns)
 * @param {number} limit
 * @returns {Object[]}
 */
const getRecentActivity = async (limit = 10) => {
  const result = await query(
    `SELECT
      a.id,
      a.is_active,
      a.assigned_at,
      a.returned_at,
      a.return_condition,
      e.name AS employee_name,
      e.employee_code,
      ast.product_name,
      ast.model,
      ast.serial_number,
      c.name AS category_name,
      CASE WHEN a.is_active = true THEN 'assigned' ELSE 'returned' END AS activity_type
     FROM assignments a
     JOIN employees e ON e.id = a.employee_id
     JOIN assets ast ON ast.id = a.asset_id
     LEFT JOIN categories c ON c.id = ast.category_id
     ORDER BY GREATEST(a.assigned_at, COALESCE(a.returned_at, a.assigned_at)) DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
};

module.exports = { getStats, getRecentActivity, getMaintenanceAlertAssets };
