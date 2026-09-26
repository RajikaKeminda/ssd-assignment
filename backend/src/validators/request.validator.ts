import { z } from 'zod';
import { UrgencyLevel, RequestStatus } from '../models/request.model';
import mongoose from 'mongoose';

// ─── Reusable helpers ────────────────────────────────────────────────────────

const objectIdSchema = z
    .string({ required_error: 'A valid MongoDB ObjectId is required' })
    .refine((v) => mongoose.Types.ObjectId.isValid(v), {
        message: 'Must be a valid MongoDB ObjectId',
    });

// ─── Create Request ──────────────────────────────────────────────────────────

export const createRequestSchema = z.object({
    body: z.object({
        pharmacyId: objectIdSchema,
        medicationName: z
            .string({ required_error: 'Medication name is required' })
            .min(2, 'Medication name must be at least 2 characters')
            .max(200, 'Medication name cannot exceed 200 characters')
            .trim(),
        quantity: z
            .number({ required_error: 'Quantity is required' })
            .int('Quantity must be a whole number')
            .min(1, 'Quantity must be at least 1')
            .max(10000, 'Quantity cannot exceed 10,000'),
        urgencyLevel: z
            .nativeEnum(UrgencyLevel, {
                errorMap: () => ({
                    message: `Urgency level must be one of: ${Object.values(UrgencyLevel).join(', ')}`,
                }),
            })
            .optional()
            .default(UrgencyLevel.NORMAL),
        prescriptionRequired: z.boolean().optional().default(false),
        prescriptionImage: z.string().url('Prescription image must be a valid URL').optional(),
        notes: z
            .string()
            .max(1000, 'Notes cannot exceed 1,000 characters')
            .trim()
            .optional(),
        estimatedAvailability: z
            .string()
            .datetime({ message: 'Must be a valid ISO 8601 datetime' })
            .optional(),
    }),
});

// ─── Update Request (patient edits their own pending request) ────────────────

export const updateRequestSchema = z.object({
    params: z.object({ id: objectIdSchema }),
    body: z
        .object({
            quantity: z
                .number()
                .int('Quantity must be a whole number')
                .min(1, 'Quantity must be at least 1')
                .max(10000, 'Quantity cannot exceed 10,000')
                .optional(),
            urgencyLevel: z
                .nativeEnum(UrgencyLevel, {
                    errorMap: () => ({
                        message: `Urgency level must be one of: ${Object.values(UrgencyLevel).join(', ')}`,
                    }),
                })
                .optional(),
            notes: z.string().max(1000).trim().optional(),
            prescriptionImage: z.string().url('Must be a valid URL').optional(),
        })
        .refine((data) => Object.keys(data).length > 0, {
            message: 'At least one field must be provided for update',
        }),
});

// ─── Update Status (pharmacy staff only) ─────────────────────────────────────

export const updateRequestStatusSchema = z.object({
    params: z.object({ id: objectIdSchema }),
    body: z.object({
        status: z.nativeEnum(RequestStatus, {
            errorMap: () => ({
                message: `Status must be one of: ${Object.values(RequestStatus).join(', ')}`,
            }),
        }),
        responseDate: z
            .string()
            .datetime({ message: 'Must be a valid ISO 8601 datetime' })
            .optional(),
        estimatedAvailability: z
            .string()
            .datetime({ message: 'Must be a valid ISO 8601 datetime' })
            .optional(),
        notes: z.string().max(1000).trim().optional(),
    }),
});

// ─── Query filters (GET /api/requests) ───────────────────────────────────────

export const listRequestsQuerySchema = z.object({
    query: z.object({
        status: z.nativeEnum(RequestStatus).optional(),
        urgencyLevel: z.nativeEnum(UrgencyLevel).optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        page: z
            .string()
            .regex(/^\d+$/, 'Page must be a positive integer')
            .optional()
            .transform((v) => (v ? parseInt(v, 10) : 1)),
        limit: z
            .string()
            .regex(/^\d+$/, 'Limit must be a positive integer')
            .optional()
            .transform((v) => (v ? Math.min(parseInt(v, 10), 100) : 20)),
        sortBy: z.enum(['createdAt', 'urgencyLevel', 'requestDate', 'status']).optional().default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    }),
});

// ─── Param-only schemas ───────────────────────────────────────────────────────

export const requestParamSchema = z.object({
    params: z.object({ id: objectIdSchema }),
});

export const userParamSchema = z.object({
    params: z.object({ userId: objectIdSchema }),
});

export const pharmacyParamSchema = z.object({
    params: z.object({ pharmacyId: objectIdSchema }),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateRequestInput = z.infer<typeof createRequestSchema>['body'];
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>['body'];
export type UpdateRequestStatusInput = z.infer<typeof updateRequestStatusSchema>['body'];
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>['query'];
