import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { UserRole } from '../models/user.model';
import { env } from '../config/env';
import {
  registerSchema,
  registerStaffSchema,
  loginSchema,
  refreshTokenSchema,
} from '../validators/auth.validator';

const router = Router();

// SECURITY FIX (Insufficient Brute-Force Protection — see SECURITY.md #6):
// the only throttling on these routes used to be the app-wide limiter
// (100 requests / 15 min, shared across every API route), which is far too
// loose to slow down password guessing against a single account. This
// dedicated limiter applies a much tighter budget to just the
// authentication routes. It's still IP-based (a real production deployment
// would pair this with per-account lockout/backoff and CAPTCHA on
// repeated failures), but it meaningfully raises the cost of both
// credential-stuffing and registration-spam attacks.
const authRateLimiter = rateLimit({
  windowMs: parseInt(env.AUTH_RATE_LIMIT_WINDOW_MS),
  max: parseInt(env.AUTH_RATE_LIMIT_MAX),
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           example: John Doe
 *         email:
 *           type: string
 *           format: email
 *           example: john@example.com
 *         password:
 *           type: string
 *           minLength: 8
 *           example: StrongP@ss1
 *           description: Must contain uppercase, lowercase, number, and special character
 *         role:
 *           type: string
 *           enum: [Patient, Pharmacy Staff, System Admin]
 *           default: Patient
 *         phone:
 *           type: string
 *           example: "+94771234567"
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: john@example.com
 *         password:
 *           type: string
 *           example: StrongP@ss1
 *     TokenResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                 isActive:
 *                   type: boolean
 *             accessToken:
 *               type: string
 *             refreshToken:
 *               type: string
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email already exists
 */
// SECURITY FIX (Privilege Escalation via Mass Assignment — see SECURITY.md
// #2): this endpoint used to accept a client-supplied `role` field
// (Patient / Pharmacy Staff / Delivery Partner / System Admin) with no
// authorization check at all, so anyone could self-register as System
// Admin. Public registration is now hardcoded to the Patient role — see
// POST /auth/staff below for how privileged accounts get created instead.
router.post('/register', authRateLimiter, validate(registerSchema), AuthController.register);

/**
 * @swagger
 * /auth/staff:
 *   post:
 *     summary: Create a privileged account (Pharmacy Staff, Delivery Partner, or System Admin)
 *     description: >
 *       Restricted to System Admins. Introduced as part of the fix for the
 *       role mass-assignment vulnerability in /auth/register — see SECURITY.md #2.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Staff account created successfully
 *       403:
 *         description: Forbidden — System Admin role required
 */
router.post(
  '/staff',
  authenticate,
  authorize(UserRole.SYSTEM_ADMIN),
  validate(registerStaffSchema),
  AuthController.registerStaff
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TokenResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authRateLimiter, validate(loginSchema), AuthController.login);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user (revoke refresh token)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', AuthController.logout);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token (rotation)
 *     tags: [Authentication]
 *     description: Issues a new access/refresh token pair and invalidates the old refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', validate(refreshTokenSchema), AuthController.refreshToken);

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Sign in / sign up with Google (OAuth 2.0 / OpenID Connect Authorization Code grant)
 *     description: >
 *       New feature — see SECURITY.md "New Feature: Sign in with Google".
 *       The frontend obtains an authorization `code` from Google's consent
 *       screen and posts it here along with the exact `redirectUri` that was
 *       used to request it. The backend exchanges the code for tokens
 *       server-side (using GOOGLE_CLIENT_SECRET, which never reaches the
 *       browser), verifies the OpenID Connect ID token, and finds or
 *       creates the matching local account.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, redirectUri]
 *             properties:
 *               code:
 *                 type: string
 *               redirectUri:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signed in with Google successfully
 *       401:
 *         description: Invalid or expired Google authorization code
 */
router.post('/google', authRateLimiter, AuthController.googleCallback);

export default router;
