import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;

  constructor(message: string, statusCode = 400, errorCode = 'BAD_REQUEST', details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = req.id || 'UNKNOWN';

  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    logger.warn({ requestId, issues: err.issues }, 'Schema validation failed');
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters or payload.',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message
        }))
      },
      requestId
    });
  }

  // 2. Custom Application Errors
  if (err instanceof AppError) {
    logger.warn({ requestId, code: err.errorCode, message: err.message }, 'Application operational error');
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        details: err.details
      },
      requestId
    });
  }

  // 3. Prisma or Database unique constraint errors
  if (err.code === 'P2002') {
    logger.warn({ requestId, target: err.meta?.target }, 'Database unique constraint violation');
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A record with these unique details already exists.'
      },
      requestId
    });
  }

  // 4. Fallback: Unexpected Internal Server Error
  logger.error({ requestId, err }, 'Unhandled server exception');
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred. Please contact hospital support with this Request ID.'
    },
    requestId
  });
}
