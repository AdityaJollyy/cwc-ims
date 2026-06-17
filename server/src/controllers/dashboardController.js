const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const dashboardService = require('../services/dashboardService');

/**
 * Dashboard Controller
 */

/** GET /api/dashboard/stats */
const getStats = asyncHandler(async (req, res) => {
  const stats = await dashboardService.getStats();
  sendSuccess(res, stats, 'Dashboard statistics retrieved');
});

/** GET /api/dashboard/activity */
const getRecentActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const activity = await dashboardService.getRecentActivity(limit);
  sendSuccess(res, activity, 'Recent activity retrieved');
});

/** GET /api/dashboard/maintenance-alerts */
const getMaintenanceAlerts = asyncHandler(async (req, res) => {
  const result = await dashboardService.getMaintenanceAlerts();
  sendSuccess(res, result, 'Maintenance alerts retrieved');
});

module.exports = { getStats, getRecentActivity, getMaintenanceAlerts };
