const asyncHandler = require('../utils/asyncHandler');
const { createExcelWorkbook, setExcelHeaders } = require('../utils/excelExporter');
const reportService = require('../services/reportService');

/**
 * Export Controller
 * Fetches all data (no pagination) and streams Excel buffer to response
 */

/**
 * GET /api/export/employees
 * Export all active employees with assigned asset count
 */
const exportEmployees = asyncHandler(async (req, res) => {
  const employees = await reportService.getEmployeeAssets();

  const columns = [
    { header: 'Employee ID', key: 'employee_id', width: 15 },
    { header: 'Name', key: 'employee_name', width: 30 },
    { header: 'Division', key: 'division', width: 20 },
    { header: 'Designation', key: 'designation', width: 25 },
    { header: 'Mobile', key: 'mobile', width: 18 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Assigned Assets Count', key: 'assigned_assets_count', width: 22 },
  ];

  const rows = employees.map((emp) => {
    const assignedAssets = Array.isArray(emp.assigned_assets) ? emp.assigned_assets : [];
    return {
      employee_id: emp.employee_id || '',
      employee_name: emp.employee_name || '',
      division: emp.division || '',
      designation: emp.designation || '',
      mobile: emp.mobile || '',
      email: emp.email || '',
      assigned_assets_count: assignedAssets.length,
    };
  });

  const buffer = await createExcelWorkbook('Employees', columns, rows);
  setExcelHeaders(res, 'employees');
  res.send(buffer);
});

/**
 * GET /api/export/assets
 * Export all assets with category, status, and current assignment info
 */
const exportAssets = asyncHandler(async (req, res) => {
  const assets = await reportService.getAssetStatusReport({});

  const columns = [
    { header: 'Category', key: 'category_name', width: 20 },
    { header: 'Product Name', key: 'product_name', width: 30 },
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Serial Number', key: 'serial_number', width: 25 },
    { header: 'Asset Number', key: 'asset_number', width: 20 },
    { header: 'Status', key: 'status', width: 15 },
    { header: 'Assigned To', key: 'assigned_to_name', width: 25 },
    { header: 'Employee ID', key: 'assigned_to_employee_id', width: 15 },
    { header: 'Purchase Date', key: 'purchase_date', width: 15 },
    { header: 'Warranty Expiry', key: 'warranty_expiry', width: 15 },
    { header: 'Remarks', key: 'remarks', width: 30 },
  ];

  const rows = assets.map((asset) => ({
    category_name: asset.category_name || '',
    product_name: asset.product_name || '',
    model: asset.model || '',
    serial_number: asset.serial_number || '',
    asset_number: asset.asset_number || '',
    status: asset.status || '',
    assigned_to_name: asset.assigned_to_name || '',
    assigned_to_employee_id: asset.assigned_to_employee_id || '',
    purchase_date: asset.purchase_date
      ? new Date(asset.purchase_date).toLocaleDateString('en-IN')
      : '',
    warranty_expiry: asset.warranty_expiry
      ? new Date(asset.warranty_expiry).toLocaleDateString('en-IN')
      : '',
    remarks: asset.remarks || '',
  }));

  const buffer = await createExcelWorkbook('Assets', columns, rows);
  setExcelHeaders(res, 'assets');
  res.send(buffer);
});

/**
 * GET /api/export/assignments
 * Export all assignment history with employee and asset info
 */
const exportAssignments = asyncHandler(async (req, res) => {
  const assignments = await reportService.getAssignmentHistory({});

  const columns = [
    { header: 'Employee Name', key: 'employee_name', width: 30 },
    { header: 'Employee ID', key: 'employee_code', width: 15 },
    { header: 'Division', key: 'division', width: 20 },
    { header: 'Designation', key: 'designation', width: 25 },
    { header: 'Product Name', key: 'product_name', width: 30 },
    { header: 'Category', key: 'category_name', width: 20 },
    { header: 'Serial Number', key: 'serial_number', width: 22 },
    { header: 'Asset Number', key: 'asset_number', width: 18 },
    { header: 'Assigned At', key: 'assigned_at', width: 20 },
    { header: 'Returned At', key: 'returned_at', width: 20 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Return Condition', key: 'return_condition', width: 18 },
    { header: 'Remarks', key: 'remarks', width: 30 },
  ];

  const rows = assignments.map((a) => ({
    employee_name: a.employee_name || '',
    employee_code: a.employee_code || '',
    division: a.division || '',
    designation: a.designation || '',
    product_name: a.product_name || '',
    category_name: a.category_name || '',
    serial_number: a.serial_number || '',
    asset_number: a.asset_number || '',
    assigned_at: a.assigned_at
      ? new Date(a.assigned_at).toLocaleString('en-IN')
      : '',
    returned_at: a.returned_at
      ? new Date(a.returned_at).toLocaleString('en-IN')
      : '',
    status: a.is_active ? 'Active' : 'Returned',
    return_condition: a.return_condition || '',
    remarks: a.remarks || '',
  }));

  const buffer = await createExcelWorkbook('Assignment History', columns, rows);
  setExcelHeaders(res, 'assignments');
  res.send(buffer);
});

/**
 * GET /api/export/stock
 * Export all consumables with full stock details
 */
const exportStock = asyncHandler(async (req, res) => {
  const consumables = await reportService.getConsumableStock();

  const columns = [
    { header: 'Name', key: 'name', width: 30 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'Current Stock', key: 'current_stock', width: 15 },
    { header: 'Damaged Quantity', key: 'damaged_quantity', width: 18 },
    { header: 'Available Quantity', key: 'available_quantity', width: 18 },
    { header: 'Low Stock?', key: 'is_low_stock', width: 12 },
    { header: 'Remarks', key: 'remarks', width: 30 },
  ];

  const rows = consumables.map((c) => ({
    name: c.name || '',
    category: c.category || '',
    unit: c.unit || '',
    current_stock: parseInt(c.current_stock, 10) || 0,
    damaged_quantity: parseInt(c.damaged_quantity, 10) || 0,
    available_quantity: parseInt(c.available_quantity, 10) || 0,
    is_low_stock: c.is_low_stock ? 'YES' : 'No',
    remarks: c.remarks || '',
  }));

  const buffer = await createExcelWorkbook('Consumable Stock', columns, rows);
  setExcelHeaders(res, 'consumable_stock');
  res.send(buffer);
});

module.exports = { exportEmployees, exportAssets, exportAssignments, exportStock };
