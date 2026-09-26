import { Router } from 'express';
import { DeliveryPartnerController } from '../controllers/delivery-partner.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { UserRole } from '../models/user.model';
import {
  createDeliveryPartnerSchema,
  updateDeliveryPartnerSchema,
  deliveryPartnerIdParamSchema,
  listDeliveryPartnersQuerySchema,
} from '../validators/delivery-partner.validator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Delivery Partners
 *   description: Delivery partner management (CRUD)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DeliveryPartner:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         email:
 *           type: string
 *         phone:
 *           type: string
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *             city:
 *               type: string
 *             postalCode:
 *               type: string
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /delivery-partners:
 *   post:
 *     summary: Create a new delivery partner
 *     tags: [Delivery Partners]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               phone:
 *                 type: string
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   postalCode:
 *                     type: string
 *     responses:
 *       201:
 *         description: Delivery partner created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(createDeliveryPartnerSchema),
  DeliveryPartnerController.create
);

/**
 * @swagger
 * /delivery-partners:
 *   get:
 *     summary: List all delivery partners
 *     tags: [Delivery Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Delivery partners retrieved successfully
 */
router.get(
  '/',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(listDeliveryPartnersQuerySchema),
  DeliveryPartnerController.list
);

/**
 * @swagger
 * /delivery-partners/{id}:
 *   get:
 *     summary: Get delivery partner by ID
 *     tags: [Delivery Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Delivery partner retrieved successfully
 *       404:
 *         description: Delivery partner not found
 */
router.get(
  '/:id',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(deliveryPartnerIdParamSchema),
  DeliveryPartnerController.getById
);

/**
 * @swagger
 * /delivery-partners/{id}:
 *   put:
 *     summary: Update delivery partner
 *     tags: [Delivery Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Delivery partner updated successfully
 *       404:
 *         description: Delivery partner not found
 */
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(updateDeliveryPartnerSchema),
  DeliveryPartnerController.update
);

/**
 * @swagger
 * /delivery-partners/{id}:
 *   delete:
 *     summary: Delete delivery partner
 *     tags: [Delivery Partners]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Delivery partner deleted successfully
 *       404:
 *         description: Delivery partner not found
 */
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(deliveryPartnerIdParamSchema),
  DeliveryPartnerController.delete
);

export default router;
