import { Router } from 'express';
import { PharmacyController } from '../controllers/pharmacy.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { UserRole } from '../models/user.model';
import {
  createPharmacySchema,
  updatePharmacySchema,
  pharmacyIdParamSchema,
  nearbyPharmaciesQuerySchema,
  getPharmaciesQuerySchema,
  createReviewSchema,
  getReviewsQuerySchema,
} from '../validators/pharmacy.validator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Pharmacies
 *   description: Pharmacy management and location-based services
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PharmacyLocation:
 *       type: object
 *       properties:
 *         address:
 *           type: string
 *         city:
 *           type: string
 *         province:
 *           type: string
 *         postalCode:
 *           type: string
 *         coordinates:
 *           type: object
 *           properties:
 *             latitude:
 *               type: number
 *             longitude:
 *               type: number
 *     PharmacyContactInfo:
 *       type: object
 *       properties:
 *         phone:
 *           type: string
 *         email:
 *           type: string
 *         website:
 *           type: string
 *         emergencyContact:
 *           type: string
 *     OperatingDay:
 *       type: object
 *       properties:
 *         open:
 *           type: string
 *           example: "09:00"
 *         close:
 *           type: string
 *           example: "17:00"
 *         isClosed:
 *           type: boolean
 *     OperatingHours:
 *       type: object
 *       properties:
 *         monday:
 *           $ref: '#/components/schemas/OperatingDay'
 *         tuesday:
 *           $ref: '#/components/schemas/OperatingDay'
 *         wednesday:
 *           $ref: '#/components/schemas/OperatingDay'
 *         thursday:
 *           $ref: '#/components/schemas/OperatingDay'
 *         friday:
 *           $ref: '#/components/schemas/OperatingDay'
 *         saturday:
 *           $ref: '#/components/schemas/OperatingDay'
 *         sunday:
 *           $ref: '#/components/schemas/OperatingDay'
 *     Pharmacy:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         licenseNumber:
 *           type: string
 *         location:
 *           $ref: '#/components/schemas/PharmacyLocation'
 *         contactInfo:
 *           $ref: '#/components/schemas/PharmacyContactInfo'
 *         operatingHours:
 *           $ref: '#/components/schemas/OperatingHours'
 *         serviceRadius:
 *           type: number
 *           description: Service radius in kilometers
 *         isVerified:
 *           type: boolean
 *         verificationDate:
 *           type: string
 *           format: date-time
 *         rating:
 *           type: number
 *         totalReviews:
 *           type: number
 *         ownerId:
 *           type: string
 *         facilityType:
 *           type: string
 *           enum: [retail, hospital, clinic]
 *         services:
 *           type: array
 *           items:
 *             type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         certifications:
 *           type: array
 *           items:
 *             type: string
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreatePharmacyRequest:
 *       type: object
 *       required:
 *         - name
 *         - licenseNumber
 *         - location
 *         - contactInfo
 *         - operatingHours
 *         - serviceRadius
 *       properties:
 *         name:
 *           type: string
 *         licenseNumber:
 *           type: string
 *         location:
 *           $ref: '#/components/schemas/PharmacyLocation'
 *         contactInfo:
 *           $ref: '#/components/schemas/PharmacyContactInfo'
 *         operatingHours:
 *           $ref: '#/components/schemas/OperatingHours'
 *         serviceRadius:
 *           type: number
 *         facilityType:
 *           type: string
 *           enum: [retail, hospital, clinic]
 *         services:
 *           type: array
 *           items:
 *             type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         certifications:
 *           type: array
 *           items:
 *             type: string
 *     Review:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         pharmacyId:
 *           type: string
 *         userId:
 *           type: string
 *         rating:
 *           type: number
 *         comment:
 *           type: string
 *         serviceQuality:
 *           type: number
 *         deliverySpeed:
 *           type: number
 *         productAvailability:
 *           type: number
 *         isVerifiedPurchase:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *     CreateReviewRequest:
 *       type: object
 *       required:
 *         - rating
 *       properties:
 *         rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         comment:
 *           type: string
 *         serviceQuality:
 *           type: number
 *         deliverySpeed:
 *           type: number
 *         productAvailability:
 *           type: number
 */

/**
 * @swagger
 * /pharmacies:
 *   post:
 *     summary: Register a new pharmacy
 *     tags: [Pharmacies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePharmacyRequest'
 *     responses:
 *       201:
 *         description: Pharmacy registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Pharmacy'
 *       400:
 *         description: Validation error
 *       409:
 *         description: Pharmacy with license already exists
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(createPharmacySchema),
  PharmacyController.createPharmacy
);

/**
 * @swagger
 * /pharmacies:
 *   get:
 *     summary: Get all pharmacies with optional filters
 *     tags: [Pharmacies]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: isVerified
 *         schema:
 *           type: string
 *           enum: [true, false]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
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
 *         description: Pharmacies retrieved successfully
 */
router.get('/', validate(getPharmaciesQuerySchema), PharmacyController.getPharmacies);

/**
 * @swagger
 * /pharmacies/nearby:
 *   get:
 *     summary: Find verified pharmacies near a given location
 *     tags: [Pharmacies]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radiusKm
 *         schema:
 *           type: number
 *           default: 5
 *     responses:
 *       200:
 *         description: Nearby pharmacies retrieved successfully
 */
router.get(
  '/nearby',
  validate(nearbyPharmaciesQuerySchema),
  PharmacyController.getNearbyPharmacies
);

/**
 * @swagger
 * /pharmacies/{id}:
 *   get:
 *     summary: Get specific pharmacy details
 *     tags: [Pharmacies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pharmacy retrieved successfully
 *       404:
 *         description: Pharmacy not found
 */
router.get(
  '/:id',
  validate(pharmacyIdParamSchema),
  PharmacyController.getPharmacyById
);

/**
 * @swagger
 * /pharmacies/{id}:
 *   put:
 *     summary: Update pharmacy details
 *     tags: [Pharmacies]
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
 *             $ref: '#/components/schemas/CreatePharmacyRequest'
 *     responses:
 *       200:
 *         description: Pharmacy updated successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Pharmacy not found
 */
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(updatePharmacySchema),
  PharmacyController.updatePharmacy
);

/**
 * @swagger
 * /pharmacies/{id}:
 *   delete:
 *     summary: Deactivate a pharmacy
 *     tags: [Pharmacies]
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
 *         description: Pharmacy deactivated successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Pharmacy not found
 */
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(pharmacyIdParamSchema),
  PharmacyController.deactivatePharmacy
);

/**
 * @swagger
 * /pharmacies/{id}/verify:
 *   patch:
 *     summary: Verify a pharmacy (admin only)
 *     tags: [Pharmacies]
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
 *         description: Pharmacy verified successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Pharmacy not found
 */
router.patch(
  '/:id/verify',
  authenticate,
  authorize(UserRole.SYSTEM_ADMIN),
  validate(pharmacyIdParamSchema),
  PharmacyController.verifyPharmacy
);

/**
 * @swagger
 * /pharmacies/{id}/reviews:
 *   post:
 *     summary: Add a review for a pharmacy
 *     tags: [Pharmacies]
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
 *             $ref: '#/components/schemas/CreateReviewRequest'
 *     responses:
 *       201:
 *         description: Review added successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Pharmacy not found
 */
router.post(
  '/:id/reviews',
  authenticate,
  authorize(UserRole.PATIENT),
  validate(createReviewSchema),
  PharmacyController.addReview
);

/**
 * @swagger
 * /pharmacies/{id}/reviews:
 *   get:
 *     summary: Get reviews for a pharmacy
 *     tags: [Pharmacies]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get(
  '/:id/reviews',
  validate(getReviewsQuerySchema.merge(pharmacyIdParamSchema)),
  PharmacyController.getReviews
);

export default router;

