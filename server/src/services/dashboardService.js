const dashboardRepository = require('../repositories/dashboardRepository');

/**
 * Dashboard Service
 */

/**
 * Get all dashboard statistics
 * @returns {Object}
 */
const getStats = async () => {
  return dashboardRepository.getStats();
};

/**
 * Get recent activity feed
 * @param {number} limit
 * @returns {Object[]}
 */
const getRecentActivity = async (limit = 10) => {
  return dashboardRepository.getRecentActivity(limit);
};

/**
 * Get assets that need maintenance (older than 5 years, excluding retired)
 * @returns {{ thresholdYears: number, assets: Object[] }}
 */
const getMaintenanceAlerts = async () => {
  return dashboardRepository.getMaintenanceAlertAssets();
};

module.exports = { getStats, getRecentActivity, getMaintenanceAlerts };
