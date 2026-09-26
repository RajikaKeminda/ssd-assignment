import { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

export class ApiResponse {
  static success<T>(res: Response, data: T, message: string = 'Success', statusCode: number = 200) {
    const response: SuccessResponse<T> = {
      success: true,
      message,
      data,
    };
    return res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T, message: string = 'Created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  static error(
    res: Response,
    statusCode: number,
    message: string,
    code: string = 'INTERNAL_ERROR',
    details?: { field: string; message: string }[]
  ) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    };
    return res.status(statusCode).json(response);
  }
}
