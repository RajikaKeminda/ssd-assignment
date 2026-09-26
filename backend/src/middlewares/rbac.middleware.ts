import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/user.model';
import { ApiError } from '../utils/api-error';

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return next(
        ApiError.forbidden(
          `Access denied. Required role(s): ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};
