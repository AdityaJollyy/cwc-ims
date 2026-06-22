const router = require('express').Router();

const employeeController = require('../controllers/employeeController');
const { authenticateJWT } = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/roles');
const { validateBody } = require('../middlewares/validate');
const { createEmployeeSchema, updateEmployeeSchema } = require('../validators/employeeValidator');

/**
 * Employee Routes
 * Base path: /api/employees
 */

// GET /api/employees — list all employees (with search + filter)
router.get('/', authenticateJWT, employeeController.getAllEmployees);

// GET /api/employees/meta/divisions — get distinct division names (for dropdown)
router.get('/meta/divisions', authenticateJWT, employeeController.getDivisions);

// POST /api/employees — create a new employee
router.post(
  '/',
  authenticateJWT,
  requireAdmin,
  validateBody(createEmployeeSchema),
  employeeController.createEmployee
);

// GET /api/employees/:id — get single employee profile
router.get('/:id', authenticateJWT, employeeController.getEmployee);

// PUT /api/employees/:id — update employee details
router.put(
  '/:id',
  authenticateJWT,
  requireAdmin,
  validateBody(updateEmployeeSchema),
  employeeController.updateEmployee
);

// PATCH /api/employees/:id/archive — soft-archive employee
router.patch('/:id/archive', authenticateJWT, requireAdmin, employeeController.archiveEmployee);

// PATCH /api/employees/:id/unarchive — restore archived employee
router.patch('/:id/unarchive', authenticateJWT, requireAdmin, employeeController.unarchiveEmployee);

// DELETE /api/employees/:id — permanently delete (blocked if active assignments)
router.delete('/:id', authenticateJWT, requireAdmin, employeeController.deleteEmployee);

// GET /api/employees/:id/assignments — active assignments for employee
router.get('/:id/assignments', authenticateJWT, employeeController.getEmployeeAssignments);

// GET /api/employees/:id/history — full assignment history for employee
router.get('/:id/history', authenticateJWT, employeeController.getEmployeeHistory);

module.exports = router;
