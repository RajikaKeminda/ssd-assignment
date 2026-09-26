import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { UserRole } from '../models/user.model';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Downloadable PDF reports for admin and pharmacy staff
 */

/**
 * @swagger
 * /reports/inventory:
 *   get:
 *     summary: Download inventory report as PDF
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pharmacyId
 *         schema:
 *           type: string
 *         description: Filter by pharmacy (optional)
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/inventory',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  ReportController.downloadInventoryReport
);

/**
 * @swagger
 * /reports/orders:
 *   get:
 *     summary: Download orders report as PDF
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pharmacyId
 *         schema:
 *           type: string
 *         description: Filter by pharmacy (optional)
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/orders',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  ReportController.downloadOrdersReport
);

/**
 * @swagger
 * /reports/users:
 *   get:
 *     summary: Download users report as PDF (Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/users',
  authenticate,
  authorize(UserRole.SYSTEM_ADMIN),
  ReportController.downloadUsersReport
);

/**
 * @swagger
 * /reports/requests:
 *   get:
 *     summary: Download medication requests report as PDF
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pharmacyId
 *         schema:
 *           type: string
 *         description: Filter by pharmacy (optional)
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/requests',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  ReportController.downloadRequestsReport
);

export default router;
