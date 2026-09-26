import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/api-error';
import { ApiResponse } from '../utils/api-response';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(err);

  if (err instanceof ApiError) {
    return ApiResponse.error(res, err.statusCode, err.message, err.code, err.details);
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return ApiResponse.error(res, 400, 'Validation failed', 'VALIDATION_ERROR', details);
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiResponse.error(res, 400, `Invalid ${err.path}: ${err.value}`, 'CAST_ERROR');
  }

  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue)[0];
    return ApiResponse.error(
      res,
      409,
      `Duplicate value for field: ${field}`,
      'DUPLICATE_ERROR',
      [{ field, message: `${field} already exists` }]
    );
  }

  return ApiResponse.error(
    res,
    500,
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    'INTERNAL_ERROR'
  );
};

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Route ${req.originalUrl} not found`));
};
