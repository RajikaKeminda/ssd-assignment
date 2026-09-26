export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: { field: string; message: string }[];

  constructor(
    statusCode: number,
    message: string,
    code: string = 'INTERNAL_ERROR',
    details?: { field: string; message: string }[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message: string, details?: { field: string; message: string }[]) {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Forbidden') {
    return new ApiError(403, message, 'FORBIDDEN');
  }

  static notFound(message: string = 'Resource not found') {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static conflict(message: string) {
    return new ApiError(409, message, 'CONFLICT');
  }

  static validationError(details: { field: string; message: string }[]) {
    return new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', details);
  }

  static internal(message: string = 'Internal server error') {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
}
