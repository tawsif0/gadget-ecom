/**
 * Error handler middleware for Express
 * @param {Error} err - Error object
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
  // Log the error for debugging
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  console.error(err.stack);

  // Set default status code and message
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let errors = err.errors;

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    errors = {};
    Object.keys(err.errors).forEach((key) => {
      errors[key] = err.errors[key].message;
    });
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err.code === 11000) {
    statusCode = 409;
    message = "Duplicate field value entered";
    errors = { [Object.keys(err.keyPattern)[0]]: "This value already exists" };
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  // Determine if we should send the stack trace
  const shouldSendStackTrace = process.env.NODE_ENV === "development";

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    errors,
    stack: shouldSendStackTrace ? err.stack : undefined,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  });
};

module.exports = errorHandler;
