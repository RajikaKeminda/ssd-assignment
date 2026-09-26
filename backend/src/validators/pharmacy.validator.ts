import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM 24h format');

const operatingDaySchema = z.object({
  open: timeString,
  close: timeString,
  isClosed: z.boolean().default(false),
});

const operatingHoursSchema = z.object({
  monday: operatingDaySchema,
  tuesday: operatingDaySchema,
  wednesday: operatingDaySchema,
  thursday: operatingDaySchema,
  friday: operatingDaySchema,
  saturday: operatingDaySchema,
  sunday: operatingDaySchema,
});

const locationSchema = z.object({
  address: z.string().min(1, 'Address is required').trim(),
  city: z.string().min(1, 'City is required').trim(),
  province: z.string().min(1, 'Province is required').trim(),
  postalCode: z.string().min(1, 'Postal code is required').trim(),
});

const contactInfoSchema = z.object({
  phone: z
    .string()
    .regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone number format')
    .min(7)
    .max(20),
  email: z.string().email('Invalid email address'),
  website: z
    .string()
    .url('Invalid website URL')
    .optional()
    .or(z.literal('')),
  emergencyContact: z
    .string()
    .regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid emergency contact number')
    .optional(),
});

export const createPharmacySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Pharmacy name must be at least 2 characters').max(150).trim(),
    licenseNumber: z
      .string()
      .min(3, 'License number must be at least 3 characters')
      .max(100)
      .trim(),
    location: locationSchema,
    contactInfo: contactInfoSchema,
    operatingHours: operatingHoursSchema,
    serviceRadius: z.number().min(0, 'Service radius cannot be negative'),
    facilityType: z
      .enum(['retail', 'hospital', 'clinic'], {
        errorMap: () => ({
          message: 'Facility type must be one of: retail, hospital, clinic',
        }),
      })
      .default('retail'),
    services: z.array(z.string().trim()).optional().default([]),
    images: z.array(z.string().url('Invalid image URL')).optional().default([]),
    certifications: z.array(z.string().trim()).optional().default([]),
    isActive: z.boolean().optional().default(true),
  }),
});

export const updatePharmacySchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z
    .object({
      name: z.string().min(2).max(150).trim().optional(),
      location: locationSchema.partial().optional(),
      contactInfo: contactInfoSchema.partial().optional(),
      operatingHours: operatingHoursSchema.partial().optional(),
      serviceRadius: z.number().min(0).optional(),
      facilityType: z.enum(['retail', 'hospital', 'clinic']).optional(),
      services: z.array(z.string().trim()).optional(),
      images: z.array(z.string().url('Invalid image URL')).optional(),
      certifications: z.array(z.string().trim()).optional(),
      isActive: z.boolean().optional(),
    })
    .refine(
      (body) =>
        body.name !== undefined ||
        body.location !== undefined ||
        body.contactInfo !== undefined ||
        body.operatingHours !== undefined ||
        body.serviceRadius !== undefined ||
        body.facilityType !== undefined ||
        body.services !== undefined ||
        body.images !== undefined ||
        body.certifications !== undefined ||
        body.isActive !== undefined,
      {
        message: 'At least one field must be provided for update',
        path: ['body'],
      }
    ),
});

export const pharmacyIdParamSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

export const nearbyPharmaciesQuerySchema = z.object({
  query: z.object({
    latitude: z
      .string()
      .transform((v) => Number(v))
      .pipe(z.number().min(-90).max(90)),
    longitude: z
      .string()
      .transform((v) => Number(v))
      .pipe(z.number().min(-180).max(180)),
    radiusKm: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? 5 : Number(v)))
      .pipe(z.number().min(0.1).max(100)),
  }),
});

export const getPharmaciesQuerySchema = z.object({
  query: z.object({
    city: z.string().trim().optional(),
    isVerified: z
      .string()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    search: z.string().trim().optional(),
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('10'),
    sortBy: z.string().optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export const createReviewSchema = z.object({
  params: z.object({
    id: objectId,
  }),
  body: z.object({
    rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
    comment: z.string().trim().max(1000).optional(),
    serviceQuality: z.number().int().min(1).max(5).optional(),
    deliverySpeed: z.number().int().min(1).max(5).optional(),
    productAvailability: z.number().int().min(1).max(5).optional(),
  }),
});

export const getReviewsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('10'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),
});

export type CreatePharmacyInput = z.infer<typeof createPharmacySchema>['body'];
export type UpdatePharmacyInput = z.infer<typeof updatePharmacySchema>['body'];
export type NearbyPharmaciesQueryInput = z.infer<
  typeof nearbyPharmaciesQuerySchema
>['query'];
export type GetPharmaciesQueryInput = z.infer<typeof getPharmaciesQuerySchema>['query'];
export type CreateReviewInput = z.infer<typeof createReviewSchema>['body'];
export type GetReviewsQueryInput = z.infer<typeof getReviewsQuerySchema>['query'];

