/**
 * Advanced Error Handling System
 * Provides consistent error responses and logging
 */

import { Request, Response, NextFunction } from "express";
import { TRPCError } from "@trpc/server";
import { createLogger } from "./logger";
import { ENV } from "./env";

const logger = createLogger("ErrorHandler");

/**
 * Custom application errors
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
    public isOperational: boolean = true,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, "VALIDATION_ERROR", true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR", true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(message, 403, "AUTHORIZATION_ERROR", true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(message, 404, "NOT_FOUND", true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, "CONFLICT", true, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "Rate limit exceeded") {
    super(message, 429, "RATE_LIMIT_EXCEEDED", true);
  }
}

export class TelegramError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, "TELEGRAM_ERROR", true, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, "DATABASE_ERROR", false, details);
  }
}

/**
 * Error response interface
 */
interface ErrorResponse {
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: any;
    stack?: string;
  };
}

/**
 * Format error for client response
 */
function formatErrorResponse(error: AppError | Error, includeStack: boolean = false): ErrorResponse {
  if (error instanceof AppError) {
    const response: ErrorResponse = {
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
      },
    };

    if (error.details) {
      response.error.details = error.details;
    }

    if (includeStack && error.stack) {
      response.error.stack = error.stack;
    }

    return response;
  }

  // Generic error
  return {
    error: {
      message: includeStack ? error.message : "An unexpected error occurred",
      code: "INTERNAL_ERROR",
      statusCode: 500,
      ...(includeStack && error.stack ? { stack: error.stack } : {}),
    },
  };
}

/**
 * Express error handler middleware
 */
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  if (error instanceof AppError && error.isOperational) {
    logger.warn(`Operational error: ${error.message}`, {
      code: error.code,
      statusCode: error.statusCode,
      path: req.path,
      method: req.method,
      details: error.details,
    });
  } else {
    logger.error(`Unexpected error: ${error.message}`, error, {
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
    });
  }

  // Send error response
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const includeStack = !ENV.isProduction;
  const response = formatErrorResponse(error, includeStack);

  res.status(statusCode).json(response);
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
}

/**
 * TRPC error transformer
 */
export function transformTRPCError(error: TRPCError): AppError {
  switch (error.code) {
    case "BAD_REQUEST":
      return new ValidationError(error.message);
    case "UNAUTHORIZED":
      return new AuthenticationError(error.message);
    case "FORBIDDEN":
      return new AuthorizationError(error.message);
    case "NOT_FOUND":
      return new NotFoundError(error.message);
    case "CONFLICT":
      return new ConflictError(error.message);
    case "TOO_MANY_REQUESTS":
      return new RateLimitError(error.message);
    default:
      return new AppError(error.message, 500, error.code);
  }
}

/**
 * Handle uncaught exceptions
 */
export function handleUncaughtException(error: Error): void {
  logger.fatal("Uncaught exception", error);

  // Give time to log before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
}

/**
 * Handle unhandled rejections
 */
export function handleUnhandledRejection(reason: any, promise: Promise<any>): void {
  logger.fatal("Unhandled rejection", reason);

  // Give time to log before exiting
  setTimeout(() => {
    process.exit(1);
  }, 1000);
}

/**
 * Setup global error handlers
 */
export function setupGlobalErrorHandlers(): void {
  process.on("uncaughtException", handleUncaughtException);
  process.on("unhandledRejection", handleUnhandledRejection);

  logger.info("Global error handlers registered");
}

/**
 * Telegram-specific error handlers
 */
export function handleTelegramError(error: any): TelegramError {
  const message = error.message || "Telegram operation failed";

  // Check for specific Telegram errors
  if (message.includes("FLOOD_WAIT")) {
    const match = message.match(/FLOOD_WAIT_(\d+)/);
    const waitTime = match ? parseInt(match[1]) : 0;
    return new TelegramError("Rate limit exceeded. Please wait before trying again.", {
      type: "FLOOD_WAIT",
      waitTime,
    });
  }

  if (message.includes("USER_BANNED")) {
    return new TelegramError("Account has been banned", { type: "USER_BANNED" });
  }

  if (message.includes("PHONE_NUMBER_BANNED")) {
    return new TelegramError("Phone number has been banned", { type: "PHONE_NUMBER_BANNED" });
  }

  if (message.includes("AUTH_KEY_UNREGISTERED")) {
    return new TelegramError("Session expired. Please re-authenticate.", {
      type: "AUTH_KEY_UNREGISTERED",
    });
  }

  if (message.includes("PEER_FLOOD")) {
    return new TelegramError("Too many requests. Account is temporarily restricted.", {
      type: "PEER_FLOOD",
    });
  }

  return new TelegramError(message, { originalError: error });
}

/**
 * Database-specific error handlers
 */
export function handleDatabaseError(error: any): DatabaseError {
  const message = error.message || "Database operation failed";

  // Check for specific database errors
  if (error.code === "23505") {
    // Unique constraint violation
    return new DatabaseError("Duplicate entry", {
      type: "UNIQUE_VIOLATION",
      constraint: error.constraint,
    });
  }

  if (error.code === "23503") {
    // Foreign key violation
    return new DatabaseError("Referenced record not found", {
      type: "FOREIGN_KEY_VIOLATION",
      constraint: error.constraint,
    });
  }

  if (error.code === "23502") {
    // Not null violation
    return new DatabaseError("Required field is missing", {
      type: "NOT_NULL_VIOLATION",
      column: error.column,
    });
  }

  return new DatabaseError(message, { originalError: error });
}

/**
 * Safe error message for client
 * Sanitizes error messages to prevent information disclosure
 */
export function getSafeErrorMessage(error: Error | AppError): string {
  if (ENV.isProduction && !(error instanceof AppError)) {
    return "An unexpected error occurred. Please try again later.";
  }

  return error.message;
}
