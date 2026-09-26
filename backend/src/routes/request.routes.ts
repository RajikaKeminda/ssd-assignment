import { Router } from 'express';
import { RequestController } from '../controllers/request.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { UserRole } from '../models/user.model';
import {
    createRequestSchema,
    updateRequestSchema,
    updateRequestStatusSchema,
    listRequestsQuerySchema,
    requestParamSchema,
    userParamSchema,
    pharmacyParamSchema,
} from '../validators/request.validator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Medication Requests
 *   description: Lifecycle management for customer medication requests
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     MedicationRequest:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 60d5ec49f1b2c72b1c8d4567
 *         userId:
 *           type: string
 *         pharmacyId:
 *           type: string
 *         medicationName:
 *           type: string
 *           example: Amoxicillin
 *         quantity:
 *           type: integer
 *           example: 30
 *         urgencyLevel:
 *           type: string
 *           enum: [urgent, normal, low]
 *           example: normal
 *         status:
 *           type: string
 *           enum: [pending, processing, available, unavailable, fulfilled, cancelled]
 *           example: pending
 *         prescriptionRequired:
 *           type: boolean
 *           example: false
 *         prescriptionImage:
 *           type: string
 *           format: uri
 *         notes:
 *           type: string
 *         requestDate:
 *           type: string
 *           format: date-time
 *         responseDate:
 *           type: string
 *           format: date-time
 *         estimatedAvailability:
 *           type: string
 *           format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateRequestBody:
 *       type: object
 *       required:
 *         - pharmacyId
 *         - medicationName
 *         - quantity
 *       properties:
 *         pharmacyId:
 *           type: string
 *           example: 60d5ec49f1b2c72b1c8d1234
 *         medicationName:
 *           type: string
 *           example: Amoxicillin 500mg
 *         quantity:
 *           type: integer
 *           minimum: 1
 *           example: 30
 *         urgencyLevel:
 *           type: string
 *           enum: [urgent, normal, low]
 *           default: normal
 *         prescriptionRequired:
 *           type: boolean
 *           default: false
 *         prescriptionImage:
 *           type: string
 *           format: uri
 *         notes:
 *           type: string
 *           maxLength: 1000
 *         estimatedAvailability:
 *           type: string
 *           format: date-time
 *     UpdateStatusBody:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, processing, available, unavailable, fulfilled, cancelled]
 *         responseDate:
 *           type: string
 *           format: date-time
 *         estimatedAvailability:
 *           type: string
 *           format: date-time
 *         notes:
 *           type: string
 *     PaginatedRequests:
 *       type: object
 *       properties:
 *         requests:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MedicationRequest'
 *         total:
 *           type: integer
 *         page:
 *           type: integer
 *         pages:
 *           type: integer
 */

// ─── POST /api/requests ───────────────────────────────────────────────────────
/**
 * @swagger
 * /requests:
 *   post:
 *     summary: Create a new medication request
 *     tags: [Medication Requests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRequestBody'
 *     responses:
 *       201:
 *         description: Request created and patient notified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MedicationRequest'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
    '/',
    authenticate,
    authorize(UserRole.PATIENT),
    validate(createRequestSchema),
    RequestController.createRequest
);

// ─── GET /api/requests ────────────────────────────────────────────────────────
/**
 * @swagger
 * /requests:
 *   get:
 *     summary: Get all requests with optional filters
 *     tags: [Medication Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, available, unavailable, fulfilled, cancelled]
 *       - in: query
 *         name: urgencyLevel
 *         schema:
 *           type: string
 *           enum: [urgent, normal, low]
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, urgencyLevel, requestDate, status]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Paginated list of requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedRequests'
 */
router.get(
    '/',
    authenticate,
    authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
    validate(listRequestsQuerySchema),
    RequestController.getRequests
);

// ─── GET /api/requests/urgent ─────────────────────────────────────────────────
/**
 * @swagger
 * /requests/urgent:
 *   get:
 *     summary: Get all urgent-priority requests
 *     tags: [Medication Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated list of urgent requests
 */
router.get(
    '/urgent',
    authenticate,
    authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
    validate(listRequestsQuerySchema),
    RequestController.getUrgentRequests
);

// ─── GET /api/requests/user/:userId ───────────────────────────────────────────
/**
 * @swagger
 * /requests/user/{userId}:
 *   get:
 *     summary: Get all requests for a specific user
 *     description: Patients can only retrieve their own requests. Admins can retrieve any user's requests.
 *     tags: [Medication Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of requests for the user
 *       403:
 *         description: Access denied
 */
router.get(
    '/user/:userId',
    authenticate,
    authorize(UserRole.PATIENT, UserRole.SYSTEM_ADMIN),
    validate(userParamSchema),
    validate(listRequestsQuerySchema),
    RequestController.getRequestsByUser
);

// ─── GET /api/requests/pharmacy/:pharmacyId ───────────────────────────────────
/**
 * @swagger
 * /requests/pharmacy/{pharmacyId}:
 *   get:
 *     summary: Get all requests for a specific pharmacy
 *     description: Pharmacy staff can only view requests assigned to their own pharmacy.
 *     tags: [Medication Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pharmacyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of pharmacy requests
 *       403:
 *         description: Access denied
 */
router.get(
    '/pharmacy/:pharmacyId',
    authenticate,
    authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
    validate(pharmacyParamSchema),
    validate(listRequestsQuerySchema),
    RequestController.getRequestsByPharmacy
);

// ─── GET /api/requests/:id ────────────────────────────────────────────────────
/**
 * @swagger
 * /requests/{id}:
 *   get:
 *     summary: Get a specific request by ID
 *     tags: [Medication Requests]
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
 *         description: Request details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MedicationRequest'
 *       404:
 *         description: Request not found
 */
router.get(
    '/:id',
    authenticate,
    authorize(UserRole.PATIENT, UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
    validate(requestParamSchema),
    RequestController.getRequestById
);

// ─── PUT /api/requests/:id ────────────────────────────────────────────────────
/**
 * @swagger
 * /requests/{id}:
 *   put:
 *     summary: Update a pending request (quantity, urgency, notes, prescription image)
 *     description: Only the owning patient can update a request, and only while it is in PENDING status.
 *     tags: [Medication Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               urgencyLevel:
 *                 type: string
 *                 enum: [urgent, normal, low]
 *               notes:
 *                 type: string
 *               prescriptionImage:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Request updated
 *       400:
 *         description: Request is not in PENDING status
 *       403:
 *         description: Access denied
 *       404:
 *         description: Request not found
 */
router.put(
    '/:id',
    authenticate,
    authorize(UserRole.PATIENT),
    validate(updateRequestSchema),
    RequestController.updateRequest
);

// ─── PATCH /api/requests/:id/status ──────────────────────────────────────────
/**
 * @swagger
 * /requests/{id}/status:
 *   patch:
 *     summary: Update request status (pharmacy staff / admin only)
 *     description: |
 *       Valid status transitions:
 *       - pending → processing | unavailable | cancelled
 *       - processing → available | unavailable | cancelled
 *       - available → fulfilled | cancelled
 *       - unavailable → cancelled
 *
 *       Patients are automatically notified via SMS and Email on every status change.
 *     tags: [Medication Requests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateStatusBody'
 *     responses:
 *       200:
 *         description: Status updated and patient notified
 *       400:
 *         description: Invalid status transition
 *       403:
 *         description: Access denied or request not in your pharmacy
 *       404:
 *         description: Request not found
 */
router.patch(
    '/:id/status',
    authenticate,
    authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
    validate(updateRequestStatusSchema),
    RequestController.updateRequestStatus
);

// ─── DELETE /api/requests/:id ─────────────────────────────────────────────────
/**
 * @swagger
 * /requests/{id}:
 *   delete:
 *     summary: Cancel a medication request
 *     description: |
 *       Patients can cancel their own requests. Pharmacy staff and admins can cancel any request.
 *       Cannot cancel fulfilled or already-cancelled requests.
 *       Patient is notified upon cancellation.
 *     tags: [Medication Requests]
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
 *         description: Request cancelled
 *       400:
 *         description: Cannot cancel (already fulfilled or cancelled)
 *       403:
 *         description: Access denied
 *       404:
 *         description: Request not found
 */
router.delete(
    '/:id',
    authenticate,
    authorize(UserRole.PATIENT, UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
    validate(requestParamSchema),
    RequestController.cancelRequest
);

export default router;
