import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser, UserRole } from '../models/user.model';
import { RefreshToken } from '../models/refresh-token.model';
import { env } from '../config/env';
import { ApiError } from '../utils/api-error';
import { RegisterInput, LoginInput } from '../validators/auth.validator';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JwtPayload {
  userId: string;
  role: UserRole;
}

export class AuthService {
  static generateAccessToken(userId: string, role: UserRole): string {
    return jwt.sign({ userId, role } as JwtPayload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRATION as string & { __brand: 'StringValue' },
    } as jwt.SignOptions);
  }

  static async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(40).toString('hex');

    const expiresAt = new Date();
    const daysMatch = env.JWT_REFRESH_EXPIRATION.match(/(\d+)d/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    await RefreshToken.create({
      token,
      userId,
      expiresAt,
    });

    return token;
  }

  static async generateTokenPair(userId: string, role: UserRole): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(userId, role);
    const refreshToken = await this.generateRefreshToken(userId);
    return { accessToken, refreshToken };
  }

  static async register(data: RegisterInput): Promise<{ user: IUser; tokens: TokenPair }> {
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw ApiError.conflict('A user with this email already exists');
    }

    const user = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role || UserRole.PATIENT,
      phone: data.phone,
    });

    const tokens = await this.generateTokenPair(String(user._id), user.role);

    return { user, tokens };
  }

  static async login(data: LoginInput): Promise<{ user: IUser; tokens: TokenPair }> {
    const user = await User.findOne({ email: data.email }).select('+password');
    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      throw ApiError.forbidden('Account has been deactivated. Contact support.');
    }

    const isPasswordValid = await user.comparePassword(data.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    user.lastLogin = new Date();
    await user.save();

    const tokens = await this.generateTokenPair(String(user._id), user.role);

    user.password = undefined as any;

    return { user, tokens };
  }

  static async logout(refreshToken: string): Promise<void> {
    const token = await RefreshToken.findOne({ token: refreshToken });
    if (token) {
      token.isRevoked = true;
      await token.save();
    }
  }

  static async refreshAccessToken(oldRefreshToken: string): Promise<TokenPair> {
    const storedToken = await RefreshToken.findOne({ token: oldRefreshToken });

    if (!storedToken) {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    if (storedToken.isRevoked) {
      // Possible token reuse detected — revoke all tokens for user
      await RefreshToken.updateMany(
        { userId: storedToken.userId },
        { isRevoked: true }
      );
      throw ApiError.unauthorized('Refresh token has been revoked. Please login again.');
    }

    if (storedToken.expiresAt < new Date()) {
      throw ApiError.unauthorized('Refresh token has expired');
    }

    const user = await User.findById(storedToken.userId);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or deactivated');
    }

    // Rotate: revoke old token and issue new pair
    storedToken.isRevoked = true;
    const newTokens = await this.generateTokenPair(String(user._id), user.role);
    storedToken.replacedByToken = newTokens.refreshToken;
    await storedToken.save();

    return newTokens;
  }

  static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
    } catch {
      throw ApiError.unauthorized('Invalid or expired access token');
    }
  }
}
