const router = require('express').Router();

const dashboardController = require('../controllers/dashboardController');
const { authenticateJWT } = require('../middlewares/auth');

/**
 * Dashboard Routes
 * Base path: /api/dashboard
 */

// GET /api/dashboard/stats — system-wide statistics
router.get('/stats', authenticateJWT, dashboardController.getStats);

// GET /api/dashboard/activity — recent assignment activity
router.get('/activity', authenticateJWT, dashboardController.getRecentActivity);

// GET /api/dashboard/maintenance-alerts — assets older than 5 years that need maintenance
router.get('/maintenance-alerts', authenticateJWT, dashboardController.getMaintenanceAlerts);

module.exports = router;
