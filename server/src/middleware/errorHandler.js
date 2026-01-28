// Global error handler middleware
function errorHandler(err, req, res, next) {
  // Log error for debugging
  console.error('Error:', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Prisma errors
  if (err.code) {
    switch (err.code) {
      case 'P2002':
        // Unique constraint violation
        return res.status(409).json({
          error: 'A record with this data already exists',
          field: err.meta?.target
        });
      case 'P2025':
        // Record not found
        return res.status(404).json({
          error: 'Record not found'
        });
      case 'P2003':
        // Foreign key constraint failed
        return res.status(400).json({
          error: 'Invalid reference to related record'
        });
      default:
        // Other Prisma errors
        if (err.code.startsWith('P')) {
          return res.status(400).json({
            error: 'Database error',
            code: err.code
          });
        }
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message
    });
  }

  // Syntax errors (malformed JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON in request body'
    });
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}

module.exports = errorHandler;
