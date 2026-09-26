import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../utils/api-response';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, tokens } = await AuthService.register(req.body);
      ApiResponse.created(res, {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }, 'User registered successfully');
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, tokens } = await AuthService.login(req.body);
      ApiResponse.success(res, {
        user,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      await AuthService.logout(refreshToken);
      ApiResponse.success(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const tokens = await AuthService.refreshAccessToken(refreshToken);
      ApiResponse.success(res, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }
}
