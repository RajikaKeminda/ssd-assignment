import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { UserRole } from '../models/user.model';
import {
    createInventorySchema,
    updateInventorySchema,
    inventoryIdParamSchema,
    getInventoryQuerySchema,
    lowStockQuerySchema,
    expiringQuerySchema,
} from '../validators/inventory.validator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Pharmacy Inventory Management — track medications, stock levels, and expiry dates
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     InventoryItem:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d1"
 *         pharmacyId:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d2"
 *         medicationName:
 *           type: string
 *           example: "Amoxicillin"
 *         genericName:
 *           type: string
 *           example: "Amoxicillin"
 *         category:
 *           type: string
 *           enum: [prescription, otc, controlled]
 *           example: "prescription"
 *         dosage:
 *           type: string
 *           example: "500mg"
 *         form:
 *           type: string
 *           enum: [tablet, capsule, syrup, injection]
 *           example: "capsule"
 *         quantity:
 *           type: integer
 *           example: 100
 *         unitPrice:
 *           type: number
 *           example: 12.50
 *         batchNumber:
 *           type: string
 *           example: "BATCH-2024-001"
 *         expiryDate:
 *           type: string
 *           format: date-time
 *           example: "2025-12-31T00:00:00.000Z"
 *         manufacturer:
 *           type: string
 *           example: "PharmaCorp"
 *         requiresPrescription:
 *           type: boolean
 *           example: true
 *         lowStockThreshold:
 *           type: integer
 *           example: 10
 *         storageConditions:
 *           type: string
 *           example: "Store below 25°C"
 *         sideEffects:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Nausea", "Diarrhea"]
 *         contraindications:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Penicillin allergy"]
 *         activeIngredients:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Amoxicillin trihydrate"]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateInventoryRequest:
 *       type: object
 *       required:
 *         - pharmacyId
 *         - medicationName
 *         - quantity
 *         - unitPrice
 *       properties:
 *         pharmacyId:
 *           type: string
 *           example: "64f1a2b3c4d5e6f7a8b9c0d2"
 *         medicationName:
 *           type: string
 *           example: "Amoxicillin"
 *           description: Must be a valid medication name recognized by the RxNorm drug database
 *         genericName:
 *           type: string
 *           example: "Amoxicillin"
 *         category:
 *           type: string
 *           enum: [prescription, otc, controlled]
 *           default: "otc"
 *         dosage:
 *           type: string
 *           example: "500mg"
 *         form:
 *           type: string
 *           enum: [tablet, capsule, syrup, injection]
 *         quantity:
 *           type: integer
 *           minimum: 0
 *           example: 100
 *         unitPrice:
 *           type: number
 *           minimum: 0
 *           example: 12.50
 *         batchNumber:
 *           type: string
 *           example: "BATCH-2024-001"
 *         expiryDate:
 *           type: string
 *           format: date-time
 *           example: "2025-12-31T00:00:00.000Z"
 *         manufacturer:
 *           type: string
 *           example: "PharmaCorp"
 *         requiresPrescription:
 *           type: boolean
 *           default: false
 *         lowStockThreshold:
 *           type: integer
 *           minimum: 0
 *           default: 10
 *         storageConditions:
 *           type: string
 *         sideEffects:
 *           type: array
 *           items:
 *             type: string
 *         contraindications:
 *           type: array
 *           items:
 *             type: string
 *         activeIngredients:
 *           type: array
 *           items:
 *             type: string
 *     UpdateInventoryRequest:
 *       type: object
 *       properties:
 *         medicationName:
 *           type: string
 *         genericName:
 *           type: string
 *         category:
 *           type: string
 *           enum: [prescription, otc, controlled]
 *         dosage:
 *           type: string
 *         form:
 *           type: string
 *           enum: [tablet, capsule, syrup, injection]
 *         quantity:
 *           type: integer
 *           minimum: 0
 *         unitPrice:
 *           type: number
 *           minimum: 0
 *         batchNumber:
 *           type: string
 *         expiryDate:
 *           type: string
 *           format: date-time
 *         manufacturer:
 *           type: string
 *         requiresPrescription:
 *           type: boolean
 *         lowStockThreshold:
 *           type: integer
 *           minimum: 0
 *         storageConditions:
 *           type: string
 *         sideEffects:
 *           type: array
 *           items:
 *             type: string
 *         contraindications:
 *           type: array
 *           items:
 *             type: string
 *         activeIngredients:
 *           type: array
 *           items:
 *             type: string
 *     InventoryListResponse:
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
 *             items:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InventoryItem'
 *             pagination:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *     InventoryResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *         data:
 *           $ref: '#/components/schemas/InventoryItem'
 */

/**
 * @swagger
 * /inventory:
 *   post:
 *     summary: Create a new inventory item
 *     description: >
 *       Adds a new medication to the pharmacy inventory. The medication name is
 *       validated against the RxNorm drug database (or mock database) before being
 *       added. Only users with the 'Pharmacy Staff' role can create inventory items.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInventoryRequest'
 *     responses:
 *       201:
 *         description: Inventory item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryResponse'
 *       400:
 *         description: Validation error or medication not found in drug database
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized — missing or invalid access token
 *       403:
 *         description: Forbidden — user does not have Pharmacy Staff role
 *       409:
 *         description: Conflict — medication already exists in this pharmacy
 */
router.post(
    '/',
    authenticate,
    authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
    validate(createInventorySchema),
    InventoryController.create
);

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Get all inventory items
 *     description: >
 *       Retrieve a paginated list of inventory items. Supports filtering by
 *       pharmacy, category, prescription requirement, and text search across
 *       medication name, generic name, and manufacturer.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pharmacyId
 *         schema:
 *           type: string
 *         description: Filter by pharmacy ObjectId
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [prescription, otc, controlled]
 *         description: Filter by medication category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search medication name, generic name, or manufacturer
 *       - in: query
 *         name: requiresPrescription
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: Filter by prescription requirement
 *       - in: query
 *         name: page
 *         schema:
 *           type: string
 *           default: "1"
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: string
 *           default: "10"
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: "createdAt"
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: "desc"
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Inventory items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryListResponse'
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/',
    authenticate,
    validate(getInventoryQuerySchema),
    InventoryController.getAll
);

/**
 * @swagger
 * /inventory/low-stock:
 *   get:
 *     summary: Get low-stock inventory items
 *     description: >
 *       Retrieve medications that fall below their designated low-stock threshold
 *       (quantity <= lowStockThreshold). Optionally filter by pharmacy.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pharmacyId
 *         schema:
 *           type: string
 *         description: Filter by pharmacy ObjectId
 *     responses:
 *       200:
 *         description: Low stock items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InventoryItem'
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/low-stock',
    authenticate,
    validate(lowStockQuerySchema),
    InventoryController.getLowStock
);

/**
 * @swagger
 * /inventory/expiring:
 *   get:
 *     summary: Get expiring inventory items
 *     description: >
 *       Retrieve medications that are expiring within the specified number of days.
 *       Defaults to 30 days if not specified. Optionally filter by pharmacy.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: string
 *           default: "30"
 *         description: Number of days to look ahead for expiring medications
 *       - in: query
 *         name: pharmacyId
 *         schema:
 *           type: string
 *         description: Filter by pharmacy ObjectId
 *     responses:
 *       200:
 *         description: Expiring items retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InventoryItem'
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/expiring',
    authenticate,
    validate(expiringQuerySchema),
    InventoryController.getExpiring
);

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Get an inventory item by ID
 *     description: Retrieve a single inventory item by its ObjectId.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ObjectId
 *     responses:
 *       200:
 *         description: Inventory item retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Inventory item not found
 */
router.get(
    '/:id',
    authenticate,
    validate(inventoryIdParamSchema),
    InventoryController.getById
);

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Update an inventory item
 *     description: >
 *       Update an existing inventory item by its ObjectId. If the medication name
 *       is changed, it will be re-validated against the RxNorm drug database.
 *       Only users with the 'Pharmacy Staff' role can update inventory items.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateInventoryRequest'
 *     responses:
 *       200:
 *         description: Inventory item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — user does not have Pharmacy Staff role
 *       404:
 *         description: Inventory item not found
 */
router.put(
    '/:id',
    authenticate,
    authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
    validate(updateInventorySchema),
    InventoryController.update
);

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Delete an inventory item
 *     description: >
 *       Permanently delete an inventory item by its ObjectId.
 *       Only users with the 'Pharmacy Staff' role can delete inventory items.
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ObjectId
 *     responses:
 *       200:
 *         description: Inventory item deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InventoryResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — user does not have Pharmacy Staff role
 *       404:
 *         description: Inventory item not found
 */
router.delete(
    '/:id',
    authenticate,
    authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
    validate(inventoryIdParamSchema),
    InventoryController.delete
);

export default router;
