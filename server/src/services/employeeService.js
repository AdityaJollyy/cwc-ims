const employeeRepository = require('../repositories/employeeRepository');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');

/**
 * Employee Service
 * All business logic for employee management.
 *
 * employee_code is OPTIONAL. When provided it must be unique;
 * when blank it is stored as NULL.
 */

const getAll = async (queryParams) => {
  const { page, limit, offset } = parsePagination(queryParams);
  const { search, division, designation, is_archived } = queryParams;

  // Three-state filter: undefined/'' = show all, 'true' = archived only, 'false' = active only
  let isArchivedFilter;
  if (is_archived === 'true') {
    isArchivedFilter = true;
  } else if (is_archived === 'false') {
    isArchivedFilter = false;
  } else {
    isArchivedFilter = undefined; // show all
  }

  const { rows, total } = await employeeRepository.findAll({
    search,
    division,
    designation,
    is_archived: isArchivedFilter,
    limit,
    offset,
  });

  const [divisions, designations] = await Promise.all([
    employeeRepository.getDivisions(),
    employeeRepository.getDesignations(),
  ]);

  return {
    employees: rows,
    meta: buildPaginationMeta(total, page, limit),
    filters: { divisions, designations },
  };
};

const getById = async (id) => {
  const employee = await employeeRepository.findById(id);
  if (!employee) {
    throw ApiError.notFound(`Employee not found`);
  }

  const [assignments, history] = await Promise.all([
    employeeRepository.getAssignments(id),
    employeeRepository.getHistory(id),
  ]);

  return { ...employee, assignments, history };
};

const create = async (data, userId) => {
  const { employee_code } = data;

  // Only validate uniqueness when a code is supplied
  if (employee_code) {
    const existing = await employeeRepository.findByEmployeeCode(employee_code);
    if (existing) {
      throw ApiError.conflict(`Employee code "${employee_code}" is already in use`);
    }
  }

  return employeeRepository.create({ ...data, created_by: userId });
};

const update = async (id, data) => {
  const employee = await employeeRepository.findById(id);
  if (!employee) {
    throw ApiError.notFound(`Employee not found`);
  }

  // If employee_code is being changed to a non-empty value, ensure it's unique
  if (
    Object.prototype.hasOwnProperty.call(data, 'employee_code') &&
    data.employee_code &&
    data.employee_code !== employee.employee_code
  ) {
    const existing = await employeeRepository.findByEmployeeCode(data.employee_code);
    if (existing && existing.id !== id) {
      throw ApiError.conflict(`Employee code "${data.employee_code}" is already in use`);
    }
  }

  return employeeRepository.update(id, data);
};

const archive = async (id) => {
  const employee = await employeeRepository.findById(id);
  if (!employee) {
    throw ApiError.notFound(`Employee not found`);
  }
  if (employee.is_archived) {
    throw ApiError.conflict('Employee is already archived');
  }
  if (parseInt(employee.assigned_count, 10) > 0) {
    throw ApiError.conflict(
      'Cannot archive an employee with active asset assignments. Please return all assets first.'
    );
  }
  return employeeRepository.archive(id, true);
};

const unarchive = async (id) => {
  const employee = await employeeRepository.findById(id);
  if (!employee) {
    throw ApiError.notFound(`Employee not found`);
  }
  if (!employee.is_archived) {
    throw ApiError.conflict('Employee is not archived');
  }
  return employeeRepository.archive(id, false);
};

const getAssignments = async (id) => {
  const employee = await employeeRepository.findById(id);
  if (!employee) throw ApiError.notFound(`Employee not found`);
  return employeeRepository.getAssignments(id);
};

const getHistory = async (id) => {
  const employee = await employeeRepository.findById(id);
  if (!employee) throw ApiError.notFound(`Employee not found`);
  return employeeRepository.getHistory(id);
};

const deleteEmployee = async (id) => {
  const employee = await employeeRepository.findById(id);
  if (!employee) {
    throw ApiError.notFound(`Employee not found`);
  }
  if (parseInt(employee.assigned_count, 10) > 0) {
    throw ApiError.conflict(
      `Cannot delete this employee — they currently have ${employee.assigned_count} asset(s) assigned. Please return all assets first.`
    );
  }
  await employeeRepository.deleteAssignmentsByEmployeeId(id);
  await employeeRepository.deleteEmployee(id);
  return true;
};

module.exports = { getAll, getById, create, update, archive, unarchive, deleteEmployee, getAssignments, getHistory };
