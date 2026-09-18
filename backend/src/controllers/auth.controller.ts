import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import { env } from '../config/env';
import { parseDurationToMs } from '../utils/duration';

const REFRESH_COOKIE_NAME = 'refreshToken';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * SECURITY FIX (Sensitive Tokens Stored in localStorage — see SECURITY.md
 * #5): the refresh token used to be returned only in the JSON body, which
 * the frontend then persisted to `localStorage` — readable by ANY script
 * running on the page, so a single XSS bug anywhere in the app (or in a
 * dependency) would let an attacker steal it and mint fresh sessions
 * indefinitely. It is now ALSO set as an httpOnly cookie, which client-side
 * JavaScript cannot read at all, and the frontend no longer persists it to
 * localStorage (see frontend/src/api/client.js).
 *
 * `sameSite` is 'lax' in development (frontend/backend are different ports
 * on localhost, which browsers treat as same-site) and 'none' in production
 * — a real deployment typically has the frontend and API on different
 * domains (e.g. Vercel + Render), which is genuinely cross-site, so the
 * cookie needs SameSite=None; that requires `secure: true`, which is also
 * set whenever NODE_ENV is production.
 */
function setRefreshTokenCookie(res: Response, token: string) {
  const maxAge = parseDurationToMs(env.JWT_REFRESH_EXPIRATION, SEVEN_DAYS_MS);
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/api/auth',
    maxAge,
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
}

/**
 * Resolves the refresh token for logout/refresh requests. The cookie is the
 * primary, secure path (set by login/register/staff/refresh). The request
 * body is still accepted as a fallback for non-browser API clients (e.g. a
 * mobile app) that can't rely on cookies — see refreshTokenSchema, where the
 * body field is now optional rather than required.
 */
function resolveRefreshToken(req: Request): string {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
  if (!token) {
    throw ApiError.unauthorized('Refresh token is required');
  }
  return token;
}

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, tokens } = await AuthService.register(req.body);
      setRefreshTokenCookie(res, tokens.refreshToken);
      ApiResponse.created(res, {
        user,
        accessToken: tokens.accessToken,
      }, 'User registered successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin-only endpoint for creating privileged accounts (Pharmacy Staff,
   * Delivery Partner, System Admin). See SECURITY.md #2 — this replaces the
   * old behaviour where /auth/register accepted an arbitrary `role`.
   */
  static async registerStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, tokens } = await AuthService.registerStaff(req.body);
      setRefreshTokenCookie(res, tokens.refreshToken);
      ApiResponse.created(res, {
        user,
        accessToken: tokens.accessToken,
      }, 'Staff account created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { user, tokens } = await AuthService.login(req.body);
      setRefreshTokenCookie(res, tokens.refreshToken);
      ApiResponse.success(res, {
        user,
        accessToken: tokens.accessToken,
      }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }
      clearRefreshTokenCookie(res);
      ApiResponse.success(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const oldRefreshToken = resolveRefreshToken(req);
      const tokens = await AuthService.refreshAccessToken(oldRefreshToken);
      setRefreshTokenCookie(res, tokens.refreshToken);
      ApiResponse.success(res, {
        accessToken: tokens.accessToken,
      }, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }
}
