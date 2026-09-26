import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { User } from '../models/user.model';
import { ApiError } from '../utils/api-error';

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token is required');
    }

    const token = authHeader.split(' ')[1];
    const decoded = AuthService.verifyAccessToken(token);

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or deactivated');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
