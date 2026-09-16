import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { UserRole } from '../models/user.model';
import {
  registerSchema,
  registerStaffSchema,
  loginSchema,
  refreshTokenSchema,
} from '../validators/auth.validator';

const router = Router();

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
router.post('/register', validate(registerSchema), AuthController.register);

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
router.post('/login', validate(loginSchema), AuthController.login);

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

export default router;
