const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/ApiResponse');
const employeeService = require('../services/employeeService');

/**
 * Employee Controller
 * Handles HTTP requests for employee CRUD operations
 */

/**
 * GET /api/employees
 * List employees with search, filters, and pagination
 */
const getAllEmployees = asyncHandler(async (req, res) => {
  const result = await employeeService.getAll(req.query);
  sendSuccess(res, result.employees, 'Employees retrieved successfully', 200, result.meta);
});

/**
 * GET /api/employees/:id
 * Get a single employee with their assignments and history
 */
const getEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.getById(req.params.id);
  sendSuccess(res, employee, 'Employee retrieved successfully');
});

/**
 * POST /api/employees
 * Create a new employee
 */
const createEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.create(req.body, req.user.id);
  sendCreated(res, employee, 'Employee created successfully');
});

/**
 * PUT /api/employees/:id
 * Update an employee's details
 */
const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.update(req.params.id, req.body);
  sendSuccess(res, employee, 'Employee updated successfully');
});

/**
 * PATCH /api/employees/:id/archive
 * Soft-archive an employee (releases ID to pool)
 */
const archiveEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.archive(req.params.id);
  sendSuccess(res, employee, 'Employee archived successfully');
});

/**
 * PATCH /api/employees/:id/unarchive
 * Restore an archived employee
 */
const unarchiveEmployee = asyncHandler(async (req, res) => {
  const employee = await employeeService.unarchive(req.params.id);
  sendSuccess(res, employee, 'Employee unarchived successfully');
});

/**
 * GET /api/employees/:id/assignments
 * Get active asset assignments for an employee
 */
const getEmployeeAssignments = asyncHandler(async (req, res) => {
  const assignments = await employeeService.getAssignments(req.params.id);
  sendSuccess(res, assignments, 'Employee assignments retrieved');
});

/**
 * GET /api/employees/:id/history
 * Get full assignment history for an employee
 */
const getEmployeeHistory = asyncHandler(async (req, res) => {
  const history = await employeeService.getHistory(req.params.id);
  sendSuccess(res, history, 'Employee history retrieved');
});

/**
 * DELETE /api/employees/:id
 * Permanently delete an employee (blocked if active assignments exist)
 */
const deleteEmployee = asyncHandler(async (req, res) => {
  await employeeService.deleteEmployee(req.params.id);
  sendSuccess(res, null, 'Employee deleted successfully');
});

/**
 * GET /api/employees/meta/divisions
 * Return distinct non-empty division values (active employees only)
 */
const getDivisions = asyncHandler(async (req, res) => {
  const divisions = await employeeService.getDivisions();
  sendSuccess(res, divisions, 'Divisions retrieved successfully');
});

module.exports = {
  getAllEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  archiveEmployee,
  unarchiveEmployee,
  deleteEmployee,
  getEmployeeAssignments,
  getEmployeeHistory,
  getDivisions,
};
