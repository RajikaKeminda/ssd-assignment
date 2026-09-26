import { z } from 'zod';
import { MedicationCategory, MedicationForm } from '../models/inventory.model';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectId = z.string().regex(objectIdRegex, 'Invalid ObjectId format');

export const createInventorySchema = z.object({
    body: z.object({
        pharmacyId: objectId.describe('Pharmacy ObjectId'),
        medicationName: z
            .string({ required_error: 'Medication name is required' })
            .min(1, 'Medication name cannot be empty')
            .max(200)
            .trim(),
        genericName: z.string().max(200).trim().optional(),
        category: z
            .nativeEnum(MedicationCategory, {
                errorMap: () => ({
                    message: `Category must be one of: ${Object.values(MedicationCategory).join(', ')}`,
                }),
            })
            .optional()
            .default(MedicationCategory.OTC),
        dosage: z.string().max(100).trim().optional(),
        form: z
            .nativeEnum(MedicationForm, {
                errorMap: () => ({
                    message: `Form must be one of: ${Object.values(MedicationForm).join(', ')}`,
                }),
            })
            .optional(),
        quantity: z
            .number({ required_error: 'Quantity is required' })
            .int('Quantity must be an integer')
            .min(0, 'Quantity cannot be negative'),
        unitPrice: z
            .number({ required_error: 'Unit price is required' })
            .min(0, 'Unit price cannot be negative'),
        batchNumber: z.string().max(100).trim().optional(),
        expiryDate: z
            .string()
            .datetime({ message: 'Expiry date must be a valid ISO date string' })
            .optional(),
        manufacturer: z.string().max(200).trim().optional(),
        requiresPrescription: z.boolean().optional().default(false),
        lowStockThreshold: z
            .number()
            .int('Low stock threshold must be an integer')
            .min(0, 'Threshold cannot be negative')
            .optional()
            .default(10),
        storageConditions: z.string().max(500).trim().optional(),
        sideEffects: z.array(z.string().trim()).optional(),
        contraindications: z.array(z.string().trim()).optional(),
        activeIngredients: z.array(z.string().trim()).optional(),
    }),
});

export const updateInventorySchema = z.object({
    params: z.object({
        id: objectId,
    }),
    body: z
        .object({
            medicationName: z.string().min(1).max(200).trim().optional(),
            genericName: z.string().max(200).trim().optional(),
            category: z.nativeEnum(MedicationCategory).optional(),
            dosage: z.string().max(100).trim().optional(),
            form: z.nativeEnum(MedicationForm).optional(),
            quantity: z.number().int().min(0).optional(),
            unitPrice: z.number().min(0).optional(),
            batchNumber: z.string().max(100).trim().optional(),
            expiryDate: z.string().datetime().optional(),
            manufacturer: z.string().max(200).trim().optional(),
            requiresPrescription: z.boolean().optional(),
            lowStockThreshold: z.number().int().min(0).optional(),
            storageConditions: z.string().max(500).trim().optional(),
            sideEffects: z.array(z.string().trim()).optional(),
            contraindications: z.array(z.string().trim()).optional(),
            activeIngredients: z.array(z.string().trim()).optional(),
        })
        .refine(
            (body) => Object.keys(body).length > 0,
            { message: 'At least one field must be provided for update' }
        ),
});

export const inventoryIdParamSchema = z.object({
    params: z.object({
        id: objectId,
    }),
});

export const getInventoryQuerySchema = z.object({
    query: z.object({
        pharmacyId: z.string().regex(objectIdRegex).optional(),
        category: z.nativeEnum(MedicationCategory).optional(),
        search: z.string().trim().optional(),
        requiresPrescription: z
            .string()
            .optional()
            .transform((v) => (v === undefined ? undefined : v === 'true')),
        page: z.string().regex(/^\d+$/).optional().default('1'),
        limit: z.string().regex(/^\d+$/).optional().default('10'),
        sortBy: z.string().optional().default('createdAt'),
        sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
    }),
});

export const lowStockQuerySchema = z.object({
    query: z.object({
        pharmacyId: z.string().regex(objectIdRegex).optional(),
    }),
});

export const expiringQuerySchema = z.object({
    query: z.object({
        days: z
            .string()
            .regex(/^\d+$/, 'Days must be a positive integer')
            .optional()
            .default('30')
            .transform((v) => parseInt(v, 10)),
        pharmacyId: z.string().regex(objectIdRegex).optional(),
    }),
});

export type CreateInventoryInput = z.infer<typeof createInventorySchema>['body'];
export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>['body'];
export type GetInventoryQueryInput = z.infer<typeof getInventoryQuerySchema>['query'];
export type LowStockQueryInput = z.infer<typeof lowStockQuerySchema>['query'];
export type ExpiringQueryInput = z.infer<typeof expiringQuerySchema>['query'];
