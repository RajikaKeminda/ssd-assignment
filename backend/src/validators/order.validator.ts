import { z } from 'zod';
import { OrderStatus, PaymentMethod } from '../models/order.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

const orderItemSchema = z.object({
  medicationId: objectId,
  name: z.string().min(1, 'Medication name is required').trim(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
});

const deliveryAddressSchema = z.object({
  street: z.string().min(1, 'Street is required').trim(),
  city: z.string().min(1, 'City is required').trim(),
  postalCode: z.string().min(1, 'Postal code is required').trim(),
  phoneNumber: z
    .string()
    .regex(/^\+?[\d\s\-()]{7,15}$/, 'Invalid phone number format'),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

export const createOrderSchema = z.object({
  body: z.object({
    requestId: objectId,
    items: z.array(orderItemSchema).min(1, 'At least one item is required'),
    deliveryAddress: deliveryAddressSchema,
    deliveryFee: z.number().min(0, 'Delivery fee cannot be negative').default(0),
    paymentMethod: z
      .nativeEnum(PaymentMethod, {
        errorMap: () => ({
          message: `Payment method must be one of: ${Object.values(PaymentMethod).join(', ')}`,
        }),
      })
      .optional(),
  }),
});

export const updateOrderSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    deliveryAddress: deliveryAddressSchema.optional(),
    deliveryFee: z.number().min(0).optional(),
    estimatedDelivery: z.string().datetime().optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.nativeEnum(OrderStatus, {
      errorMap: () => ({
        message: `Status must be one of: ${Object.values(OrderStatus).join(', ')}`,
      }),
    }),
    location: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
});

export const processPaymentSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    paymentMethod: z.nativeEnum(PaymentMethod, {
      errorMap: () => ({
        message: `Payment method must be one of: ${Object.values(PaymentMethod).join(', ')}`,
      }),
    }),
  }),
});

export const assignDeliverySchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    deliveryPartnerId: objectId,
  }),
});

export const cancelOrderSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    reason: z.string().trim().optional(),
  }),
});

export const getOrdersQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(OrderStatus).optional(),
    paymentStatus: z.string().optional(),
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('10'),
    sortBy: z.string().optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const orderIdParamSchema = z.object({
  params: z.object({ id: objectId }),
});

export const userIdParamSchema = z.object({
  params: z.object({ userId: objectId }),
});

export const pharmacyIdParamSchema = z.object({
  params: z.object({ pharmacyId: objectId }),
});

export const partnerIdParamSchema = z.object({
  params: z.object({ partnerId: objectId }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>['body'];
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>['body'];
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>['body'];
export type AssignDeliveryInput = z.infer<typeof assignDeliverySchema>['body'];
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>['body'];
