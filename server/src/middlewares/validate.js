const ApiError = require('../utils/ApiError');

/**
 * Middleware factory: validate request body against Zod schema
 */
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = (result.error?.errors || []).map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    console.error('🔴 validateBody FAILED', {
      url: req.originalUrl,
      body: req.body,
      errors,
    });
    return next(ApiError.badRequest('Validation failed', errors));
  }
  req.body = result.data;
  next();
};

/**
 * Middleware factory: validate query params against Zod schema
 */
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const errors = (result.error?.errors || []).map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return next(ApiError.badRequest('Invalid query parameters', errors));
  }
  req.query = result.data;
  next();
};

module.exports = { validateBody, validateQuery };
