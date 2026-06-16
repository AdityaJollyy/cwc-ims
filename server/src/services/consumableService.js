const consumableRepository = require('../repositories/consumableRepository');
const employeeRepository = require('../repositories/employeeRepository');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');
const { TRANSACTION_TYPES, RETURN_CONDITIONS } = require('../constants');

/**
 * Consumable (Bulk Inventory) Service
 * Business logic for stock + per-employee issuance.
 *
 * Returnable vs consumed-on-issue is decided PER issuance, so the
 * same item (e.g. a mouse) can be issued either way.
 */

const getAll = async (queryParams) => {
  const { page, limit, offset } = parsePagination(queryParams);
  const { search } = queryParams;

  const { rows, total } = await consumableRepository.findAll({ search, limit, offset });

  return {
    consumables: rows,
    meta: buildPaginationMeta(total, page, limit),
  };
};

const getById = async (id) => {
  const consumable = await consumableRepository.findById(id);
  if (!consumable) {
    throw ApiError.notFound(`Item with ID ${id} not found`);
  }
  return consumable;
};

const create = async (data, userId) => {
  return consumableRepository.create({ ...data, created_by: userId });
};

const update = async (id, data) => {
  const existing = await consumableRepository.findById(id);
  if (!existing) {
    throw ApiError.notFound(`Item with ID ${id} not found`);
  }
  return consumableRepository.update(id, data);
};

const deleteConsumable = async (id) => {
  const existing = await consumableRepository.findById(id);
  if (!existing) {
    throw ApiError.notFound(`Item with ID ${id} not found`);
  }

  const activeCount = await consumableRepository.getActiveAssignmentCount(id);
  if (activeCount > 0) {
    throw ApiError.conflict(
      `Cannot delete this item — it is currently issued to ${activeCount} employee(s) as returnable. Process all returns first.`
    );
  }

  // Cascade delete: assignment history + transactions are removed via FK ON DELETE CASCADE
  await consumableRepository.deleteAssignmentsByConsumableId(id);
  await consumableRepository.deleteConsumable(id);
  return existing;
};

const stockIn = async (id, { quantity, reference, remarks }, userId) => {
  const existing = await consumableRepository.findById(id);
  if (!existing) {
    throw ApiError.notFound(`Item with ID ${id} not found`);
  }

  const [consumable, transaction] = await Promise.all([
    consumableRepository.addStock(id, quantity),
    consumableRepository.createTransaction({
      consumable_id: id,
      transaction_type: TRANSACTION_TYPES.STOCK_IN,
      quantity,
      reference,
      remarks,
      performed_by: userId,
    }),
  ]);

  return { consumable, transaction };
};

const stockOut = async (id, { quantity, reference, remarks }, userId) => {
  const existing = await consumableRepository.findById(id);
  if (!existing) {
    throw ApiError.notFound(`Item with ID ${id} not found`);
  }

  const availableQty = parseInt(existing.available_quantity, 10);
  if (quantity > availableQty) {
    throw ApiError.conflict(
      `Insufficient stock. Requested: ${quantity}, Available: ${availableQty}`
    );
  }

  const [consumable, transaction] = await Promise.all([
    consumableRepository.removeStock(id, quantity),
    consumableRepository.createTransaction({
      consumable_id: id,
      transaction_type: TRANSACTION_TYPES.STOCK_OUT,
      quantity,
      reference,
      remarks,
      performed_by: userId,
    }),
  ]);

  return { consumable, transaction };
};

const markDamaged = async (id, { quantity, reference, remarks }, userId) => {
  const existing = await consumableRepository.findById(id);
  if (!existing) {
    throw ApiError.notFound(`Item with ID ${id} not found`);
  }

  const availableQty = parseInt(existing.available_quantity, 10);
  if (quantity > availableQty) {
    throw ApiError.conflict(
      `Cannot mark ${quantity} units as damaged. Only ${availableQty} available units exist.`
    );
  }

  const [consumable, transaction] = await Promise.all([
    consumableRepository.markDamaged(id, quantity),
    consumableRepository.createTransaction({
      consumable_id: id,
      transaction_type: TRANSACTION_TYPES.DAMAGED,
      quantity,
      reference,
      remarks,
      performed_by: userId,
    }),
  ]);

  return { consumable, transaction };
};

const getTransactions = async (id, queryParams) => {
  const { page, limit, offset } = parsePagination(queryParams);

  const existing = await consumableRepository.findById(id);
  if (!existing) {
    throw ApiError.notFound(`Item with ID ${id} not found`);
  }

  const { rows, total } = await consumableRepository.getTransactions(id, { limit, offset });

  return {
    transactions: rows,
    meta: buildPaginationMeta(total, page, limit),
  };
};

// ─── Issue / Return ────────────────────────────────────────────

const getAllAssignments = async (queryParams) => {
  const { page, limit, offset } = parsePagination(queryParams);
  const { employee_id, consumable_id, is_active, search } = queryParams;

  let isActiveFilter;
  if (is_active === 'true') isActiveFilter = true;
  else if (is_active === 'false') isActiveFilter = false;

  const { rows, total } = await consumableRepository.findAllAssignments({
    employee_id,
    consumable_id,
    is_active: isActiveFilter,
    search,
    limit,
    offset,
  });

  return {
    assignments: rows,
    meta: buildPaginationMeta(total, page, limit),
  };
};

/**
 * Issue a quantity of a bulk-inventory item to an employee.
 * Caller chooses returnable (tracked, must be returned) or
 * consumed-on-issue (stock simply leaves the store).
 */
const issue = async (id, { employee_id, quantity, is_returnable, remarks }, userId) => {
  const existing = await consumableRepository.findById(id);
  if (!existing) {
    throw ApiError.notFound(`Item with ID ${id} not found`);
  }

  const employee = await employeeRepository.findById(employee_id);
  if (!employee) {
    throw ApiError.notFound(`Employee with ID ${employee_id} not found`);
  }
  if (employee.is_archived) {
    throw ApiError.conflict('Cannot issue items to an archived employee');
  }

  const availableQty = parseInt(existing.available_quantity, 10);
  if (quantity > availableQty) {
    throw ApiError.conflict(
      `Insufficient stock. Requested: ${quantity}, Available: ${availableQty}`
    );
  }

  // Decrement stock — units leave the store either way; if returnable
  // they'll come back via the return flow.
  await consumableRepository.removeStock(id, quantity);

  const employeeLabel = employee.employee_code ? `${employee.name} (${employee.employee_code})` : employee.name;
  const referenceText = `Issued to ${employeeLabel}${is_returnable ? ' — returnable' : ' — consumed on issue'}`;

  if (is_returnable) {
    const [assignment, transaction] = await Promise.all([
      consumableRepository.createAssignment({
        consumable_id: id,
        employee_id,
        quantity,
        is_returnable: true,
        remarks,
        assigned_by: userId,
      }),
      consumableRepository.createTransaction({
        consumable_id: id,
        transaction_type: TRANSACTION_TYPES.ISSUED,
        quantity,
        reference: referenceText,
        remarks,
        performed_by: userId,
        employee_id,
      }),
    ]);

    return { assignment, transaction };
  }

  // Consumed-on-issue: still log a (closed) assignment record so
  // the employee's history shows what they received.
  const [assignment, transaction] = await Promise.all([
    consumableRepository.createAssignment({
      consumable_id: id,
      employee_id,
      quantity,
      is_returnable: false,
      remarks,
      assigned_by: userId,
    }),
    consumableRepository.createTransaction({
      consumable_id: id,
      transaction_type: TRANSACTION_TYPES.ISSUED,
      quantity,
      reference: referenceText,
      remarks,
      performed_by: userId,
      employee_id,
    }),
  ]);

  // Immediately close out non-returnable issuances so they don't
  // show up under "active" / "needs return".
  await consumableRepository.returnAssignment(assignment.id, {
    returned_quantity: 0,
    return_condition: null,
    returned_by: userId,
    remarks: null,
  });

  return { assignment, transaction };
};

/**
 * Return an issued bulk-inventory item from an employee.
 * Restores stock by `returned_quantity`; if condition is "damaged"
 * those units are also added to damaged_quantity.
 */
const returnIssue = async (assignmentId, { returned_quantity, condition, remarks }, userId) => {
  const assignment = await consumableRepository.findAssignmentById(assignmentId);
  if (!assignment) {
    throw ApiError.notFound(`Issuance with ID ${assignmentId} not found`);
  }
  if (!assignment.is_active) {
    throw ApiError.conflict('This issuance has already been processed');
  }
  if (!assignment.is_returnable) {
    throw ApiError.conflict('This issuance was marked as consumed-on-issue and cannot be returned');
  }

  if (returned_quantity > assignment.quantity) {
    throw ApiError.badRequest(
      `Returned quantity (${returned_quantity}) cannot exceed issued quantity (${assignment.quantity})`
    );
  }

  const updated = await consumableRepository.returnAssignment(assignmentId, {
    returned_quantity,
    return_condition: condition,
    returned_by: userId,
    remarks,
  });

  if (returned_quantity > 0) {
    await consumableRepository.addStock(assignment.consumable_id, returned_quantity);

    if (condition === RETURN_CONDITIONS.DAMAGED) {
      await consumableRepository.markDamaged(assignment.consumable_id, returned_quantity);
    }
  }

  await consumableRepository.createTransaction({
    consumable_id: assignment.consumable_id,
    transaction_type: TRANSACTION_TYPES.RETURNED,
    quantity: returned_quantity,
    reference: `Returned by ${assignment.employee_name}${assignment.employee_code ? ` (${assignment.employee_code})` : ''} — ${condition}`,
    remarks,
    performed_by: userId,
    employee_id: assignment.employee_id,
  });

  return updated;
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deleteConsumable,
  stockIn,
  stockOut,
  markDamaged,
  getTransactions,
  getAllAssignments,
  issue,
  returnIssue,
};
