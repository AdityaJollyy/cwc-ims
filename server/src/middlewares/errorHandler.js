const ApiError = require('../utils/ApiError');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    error = ApiError.badRequest('Validation failed', errors);
  }

  // Handle pg (PostgreSQL) errors
  if (err.code === '23505') {
    // Unique constraint violation
    error = ApiError.conflict('A record with this value already exists');
  } else if (err.code === '23503') {
    // Foreign key violation
    error = ApiError.conflict('Cannot delete — this record is referenced by related data');
  } else if (err.code === '23502') {
    // Not null violation
    error = ApiError.badRequest('Required field is missing');
  } else if (err.code === '22P02') {
    // Invalid text representation (e.g., bad UUID format)
    error = ApiError.badRequest('Invalid ID format');
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Invalid token');
  } else if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized('Token has expired');
  }

  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Internal server error';

  // Log every error for diagnostics
  console.error(`❌ [${statusCode}] ${message}`, error.errors?.length ? error.errors : '', err.code || '', err.stack || '');


  res.status(statusCode).json({
    success: false,
    message,
    errors: error.errors || [],
    ...(process.env.NODE_ENV === 'development' && !error.isOperational && { stack: err.stack }),
  });
};

module.exports = errorHandler;
