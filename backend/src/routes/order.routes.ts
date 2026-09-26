import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validate.middleware';
import { UserRole } from '../models/user.model';
import {
  createOrderSchema,
  updateOrderSchema,
  updateOrderStatusSchema,
  processPaymentSchema,
  assignDeliverySchema,
  cancelOrderSchema,
  orderIdParamSchema,
  userIdParamSchema,
  pharmacyIdParamSchema,
  partnerIdParamSchema,
} from '../validators/order.validator';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order & delivery management endpoints
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       properties:
 *         medicationId:
 *           type: string
 *         name:
 *           type: string
 *         quantity:
 *           type: number
 *         unitPrice:
 *           type: number
 *         totalPrice:
 *           type: number
 *     DeliveryAddress:
 *       type: object
 *       required:
 *         - street
 *         - city
 *         - postalCode
 *         - phoneNumber
 *       properties:
 *         street:
 *           type: string
 *         city:
 *           type: string
 *         postalCode:
 *           type: string
 *         phoneNumber:
 *           type: string
 *         coordinates:
 *           type: object
 *           properties:
 *             latitude:
 *               type: number
 *             longitude:
 *               type: number
 *     TrackingUpdate:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *         location:
 *           type: string
 *         notes:
 *           type: string
 *     Order:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         orderNumber:
 *           type: string
 *           example: "ORD-2026-000001"
 *         requestId:
 *           type: string
 *         userId:
 *           type: string
 *         pharmacyId:
 *           type: string
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/OrderItem'
 *         subtotal:
 *           type: number
 *         deliveryFee:
 *           type: number
 *         tax:
 *           type: number
 *         totalAmount:
 *           type: number
 *         deliveryAddress:
 *           $ref: '#/components/schemas/DeliveryAddress'
 *         status:
 *           type: string
 *           enum: [confirmed, packed, out_for_delivery, delivered, cancelled]
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed, refunded]
 *         paymentMethod:
 *           type: string
 *           enum: [card, cash, online]
 *         paymentIntentId:
 *           type: string
 *         trackingUpdates:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TrackingUpdate'
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     CreateOrderRequest:
 *       type: object
 *       required:
 *         - requestId
 *         - items
 *         - deliveryAddress
 *       properties:
 *         requestId:
 *           type: string
 *           example: "60d5ecb54b24a90015c0b1a2"
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             required:
 *               - medicationId
 *               - name
 *               - quantity
 *               - unitPrice
 *             properties:
 *               medicationId:
 *                 type: string
 *               name:
 *                 type: string
 *                 example: "Paracetamol 500mg"
 *               quantity:
 *                 type: number
 *                 example: 2
 *               unitPrice:
 *                 type: number
 *                 example: 5.99
 *         deliveryAddress:
 *           $ref: '#/components/schemas/DeliveryAddress'
 *         deliveryFee:
 *           type: number
 *           default: 0
 *         paymentMethod:
 *           type: string
 *           enum: [card, cash, online]
 */

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create order from approved request
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateOrderRequest'
 *     responses:
 *       201:
 *         description: Order created successfully
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
 *                   $ref: '#/components/schemas/Order'
 *       400:
 *         description: Validation error or insufficient stock
 *       404:
 *         description: Request not found
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.PATIENT),
  validate(createOrderSchema),
  OrderController.createOrder
);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders with filters
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [confirmed, packed, out_for_delivery, delivered, cancelled]
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [pending, paid, failed, refunded]
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
 *         description: Orders retrieved successfully
 */
router.get(
  '/',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  OrderController.getOrders
);

/**
 * @swagger
 * /orders/user/{userId}:
 *   get:
 *     summary: Get order history for a specific user
 *     tags: [Orders]
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
 *         description: User orders retrieved successfully
 */
router.get(
  '/user/:userId',
  authenticate,
  authorize(UserRole.PATIENT, UserRole.SYSTEM_ADMIN),
  validate(userIdParamSchema),
  OrderController.getUserOrders
);

/**
 * @swagger
 * /orders/pharmacy/{pharmacyId}:
 *   get:
 *     summary: Get orders for a specific pharmacy
 *     tags: [Orders]
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
 *         description: Pharmacy orders retrieved successfully
 */
router.get(
  '/pharmacy/:pharmacyId',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(pharmacyIdParamSchema),
  OrderController.getPharmacyOrders
);

/**
 * @swagger
 * /orders/delivery-partner/{partnerId}:
 *   get:
 *     summary: Get assigned deliveries for a delivery partner
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: partnerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Delivery partner orders retrieved successfully
 */
router.get(
  '/delivery-partner/:partnerId',
  authenticate,
  validate(partnerIdParamSchema),
  OrderController.getDeliveryPartnerOrders
);

/**
 * @swagger
 * /orders/track/{id}:
 *   get:
 *     summary: Get real-time delivery tracking for an order
 *     tags: [Orders]
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
 *         description: Tracking info retrieved
 *       404:
 *         description: Order not found
 */
router.get(
  '/track/:id',
  authenticate,
  validate(orderIdParamSchema),
  OrderController.getDeliveryTracking
);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get specific order details
 *     tags: [Orders]
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
 *         description: Order details retrieved
 *       404:
 *         description: Order not found
 */
router.get(
  '/:id',
  authenticate,
  validate(orderIdParamSchema),
  OrderController.getOrderById
);

/**
 * @swagger
 * /orders/{id}:
 *   put:
 *     summary: Update order details (delivery address, fee, estimated delivery)
 *     tags: [Orders]
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
 *               deliveryAddress:
 *                 $ref: '#/components/schemas/DeliveryAddress'
 *               deliveryFee:
 *                 type: number
 *               estimatedDelivery:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Order updated successfully
 *       400:
 *         description: Cannot update delivered/cancelled order
 */
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(updateOrderSchema),
  OrderController.updateOrder
);

/**
 * @swagger
 * /orders/{id}:
 *   delete:
 *     summary: Permanently delete a cancelled order
 *     tags: [Orders]
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
 *         description: Order deleted successfully
 *       400:
 *         description: Only cancelled orders can be deleted
 *       404:
 *         description: Order not found
 */
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(orderIdParamSchema),
  OrderController.deleteOrder
);

/**
 * @swagger
 * /orders/{id}/status:
 *   patch:
 *     summary: Update order status
 *     tags: [Orders]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [confirmed, packed, out_for_delivery, delivered, cancelled]
 *               location:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid status transition
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(updateOrderStatusSchema),
  OrderController.updateOrderStatus
);

/**
 * @swagger
 * /orders/{id}/payment:
 *   post:
 *     summary: Process payment for an order via Stripe
 *     tags: [Orders]
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
 *             required:
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [card, cash, online]
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *       400:
 *         description: Payment failed or order already paid
 */
router.post(
  '/:id/payment',
  authenticate,
  authorize(UserRole.PATIENT),
  validate(processPaymentSchema),
  OrderController.processPayment
);

/**
 * @swagger
 * /orders/{id}/invoice:
 *   get:
 *     summary: Generate and download order invoice as PDF
 *     tags: [Orders]
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
 *         description: Invoice generated successfully
 *       404:
 *         description: Order not found
 */
router.get(
  '/:id/invoice',
  authenticate,
  validate(orderIdParamSchema),
  OrderController.generateInvoice
);

/**
 * @swagger
 * /orders/{id}/assign-delivery:
 *   patch:
 *     summary: Assign a delivery partner to an order
 *     tags: [Orders]
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
 *             required:
 *               - deliveryPartnerId
 *             properties:
 *               deliveryPartnerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Delivery partner assigned
 *       404:
 *         description: Order not found
 */
router.patch(
  '/:id/assign-delivery',
  authenticate,
  authorize(UserRole.PHARMACY_STAFF, UserRole.SYSTEM_ADMIN),
  validate(assignDeliverySchema),
  OrderController.assignDeliveryPartner
);

/**
 * @swagger
 * /orders/{id}/cancel:
 *   patch:
 *     summary: Cancel order with optional refund
 *     tags: [Orders]
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
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order cancelled and refund processed if applicable
 *       400:
 *         description: Cannot cancel delivered order
 */
router.patch(
  '/:id/cancel',
  authenticate,
  validate(cancelOrderSchema),
  OrderController.cancelOrder
);

export default router;
