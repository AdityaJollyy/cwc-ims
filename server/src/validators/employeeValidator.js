const { z } = require('zod');

/**
 * Employee validation schemas
 *
 * employee_code is OPTIONAL — admin-entered display label
 * (letters, numbers, hyphens). Empty strings are normalized to null.
 */

const employeeCodeField = z
  .string()
  .trim()
  .max(64, 'Employee code is too long')
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v))
  .nullable();

const createEmployeeSchema = z.object({
  employee_code: employeeCodeField,
  name: z.string().min(1, 'Employee name is required'),
  division: z.string().optional(),
  designation: z.string().optional(),
  mobile: z.string().optional(),
  email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  remarks: z.string().optional(),
});

const updateEmployeeSchema = z.object({
  employee_code: employeeCodeField,
  name: z.string().min(1, 'Name cannot be empty').optional(),
  division: z.string().optional(),
  designation: z.string().optional(),
  mobile: z.string().optional(),
  email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  remarks: z.string().optional(),
});

module.exports = { createEmployeeSchema, updateEmployeeSchema };
