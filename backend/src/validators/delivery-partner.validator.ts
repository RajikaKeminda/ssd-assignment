import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

const addressSchema = z.object({
  street: z.string().trim().optional(),
  city: z.string().trim().optional(),
  postalCode: z.string().trim().optional(),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

export const createDeliveryPartnerSchema = z.object({
  body: z.object({
    name: z
      .string({ required_error: 'Name is required' })
      .min(2, 'Name must be at least 2 characters')
      .max(100, 'Name cannot exceed 100 characters')
      .trim(),
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email format')
      .trim()
      .toLowerCase(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/,
        'Password must contain at least one uppercase, one lowercase, one number, and one special character'
      ),
    phone: z
      .string()
      .regex(/^\+?[\d\s\-()]{7,15}$/, 'Invalid phone number format')
      .optional(),
    address: addressSchema.optional(),
  }),
});

export const updateDeliveryPartnerSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().min(2).max(100).trim().optional(),
    phone: z
      .string()
      .regex(/^\+?[\d\s\-()]{7,15}$/, 'Invalid phone number format')
      .optional(),
    address: addressSchema.optional(),
    isActive: z.boolean().optional(),
  }),
});

export const deliveryPartnerIdParamSchema = z.object({
  params: z.object({ id: objectId }),
});

export const listDeliveryPartnersQuerySchema = z.object({
  query: z.object({
    isActive: z.enum(['true', 'false']).optional(),
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('10'),
    sortBy: z.string().optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export type CreateDeliveryPartnerInput = z.infer<typeof createDeliveryPartnerSchema>['body'];
export type UpdateDeliveryPartnerInput = z.infer<typeof updateDeliveryPartnerSchema>['body'];
