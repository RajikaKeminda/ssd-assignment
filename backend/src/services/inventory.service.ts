import mongoose from 'mongoose';
import moment from 'moment';
import { Inventory, IInventory } from '../models/inventory.model';
import { DrugValidationService } from './drug-validation.service';
import { ApiError } from '../utils/api-error';
import { logger } from '../utils/logger';
import {
    CreateInventoryInput,
    UpdateInventoryInput,
    GetInventoryQueryInput,
    LowStockQueryInput,
    ExpiringQueryInput,
} from '../validators/inventory.validator';

/**
 * Service layer for Pharmacy Inventory Management.
 * Handles business logic, database operations, and third-party drug validation.
 */
export class InventoryService {
    /**
     * Create a new inventory item after validating the medication name
     * against the RxNorm drug database.
     *
     * @param data - Validated inventory item data
     * @returns The newly created inventory document
     */
    static async create(data: CreateInventoryInput): Promise<IInventory> {
        // Validate medication name via RxNorm / mock drug database
        const drugInfo = await DrugValidationService.validateAndGetDrugInfo(
            data.medicationName
        );
        logger.info(
            `Drug validated via RxNorm — RxCUI: ${drugInfo.rxcui}, Name: ${drugInfo.name}`
        );

        // Check for duplicate medication in the same pharmacy
        const existing = await Inventory.findOne({
            pharmacyId: new mongoose.Types.ObjectId(data.pharmacyId),
            medicationName: { $regex: new RegExp(`^${data.medicationName}$`, 'i') },
        });

        if (existing) {
            throw ApiError.conflict(
                `Medication "${data.medicationName}" already exists in this pharmacy's inventory`
            );
        }

        // If genericName was not provided, use the one from the drug database
        const inventoryData = {
            ...data,
            genericName: data.genericName || drugInfo.fullGenericName,
            pharmacyId: new mongoose.Types.ObjectId(data.pharmacyId),
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        };

        const item = await Inventory.create(inventoryData);
        return item;
    }

    /**
     * Retrieve a paginated, filterable list of inventory items.
     *
     * @param query - Pagination, sort, search, and filter parameters
     * @returns Paginated result with items and metadata
     */
    static async getAll(query: GetInventoryQueryInput) {
        const page = parseInt(query.page, 10);
        const limit = parseInt(query.limit, 10);
        const skip = (page - 1) * limit;
        const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

        const filter: Record<string, unknown> = {};

        if (query.pharmacyId) {
            filter.pharmacyId = new mongoose.Types.ObjectId(query.pharmacyId);
        }
        if (query.category) {
            filter.category = query.category;
        }
        if (query.requiresPrescription !== undefined) {
            filter.requiresPrescription = query.requiresPrescription;
        }
        if (query.search) {
            filter.$or = [
                { medicationName: { $regex: query.search, $options: 'i' } },
                { genericName: { $regex: query.search, $options: 'i' } },
                { manufacturer: { $regex: query.search, $options: 'i' } },
            ];
        }

        const [items, total] = await Promise.all([
            Inventory.find(filter)
                .populate('pharmacyId', 'name')
                .sort({ [query.sortBy]: sortOrder })
                .skip(skip)
                .limit(limit),
            Inventory.countDocuments(filter),
        ]);

        return {
            items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Retrieve a single inventory item by its ID.
     *
     * @param id - Inventory item ObjectId
     * @returns The inventory document
     */
    static async getById(id: string): Promise<IInventory> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw ApiError.badRequest('Invalid inventory item ID');
        }

        const item = await Inventory.findById(id).populate('pharmacyId', 'name');
        if (!item) {
            throw ApiError.notFound('Inventory item not found');
        }

        return item;
    }

    /**
     * Update an existing inventory item. If `medicationName` is being changed,
     * re-validates against the RxNorm drug database.
     *
     * @param id - Inventory item ObjectId
     * @param data - Fields to update
     * @returns The updated inventory document
     */
    static async update(id: string, data: UpdateInventoryInput): Promise<IInventory> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw ApiError.badRequest('Invalid inventory item ID');
        }

        // If medication name is being changed, validate the new name
        if (data.medicationName) {
            const drugInfo = await DrugValidationService.validateAndGetDrugInfo(
                data.medicationName
            );
            logger.info(
                `Updated drug validated — RxCUI: ${drugInfo.rxcui}, Name: ${drugInfo.name}`
            );
        }

        const updateData: Record<string, unknown> = { ...data };
        if (data.expiryDate) {
            updateData.expiryDate = new Date(data.expiryDate);
        }

        const item = await Inventory.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        }).populate('pharmacyId', 'name');

        if (!item) {
            throw ApiError.notFound('Inventory item not found');
        }

        return item;
    }

    /**
     * Delete an inventory item by its ID.
     *
     * @param id - Inventory item ObjectId
     * @returns The deleted inventory document
     */
    static async delete(id: string): Promise<IInventory> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw ApiError.badRequest('Invalid inventory item ID');
        }

        const item = await Inventory.findByIdAndDelete(id);
        if (!item) {
            throw ApiError.notFound('Inventory item not found');
        }

        return item;
    }

    /**
     * Retrieve inventory items that are below their designated
     * low-stock threshold (quantity <= lowStockThreshold).
     *
     * @param query - Optional pharmacyId filter
     * @returns Array of low-stock inventory items
     */
    static async getLowStock(query: LowStockQueryInput) {
        const filter: Record<string, unknown> = {
            $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
        };

        if (query.pharmacyId) {
            filter.pharmacyId = new mongoose.Types.ObjectId(query.pharmacyId);
        }

        const items = await Inventory.find(filter)
            .populate('pharmacyId', 'name')
            .sort({ quantity: 1 });

        return items;
    }

    /**
     * Retrieve inventory items that are expiring within the specified
     * number of days from today.
     *
     * @param query - Number of days and optional pharmacyId filter
     * @returns Array of expiring inventory items
     */
    static async getExpiring(query: ExpiringQueryInput) {
        const now = moment().startOf('day').toDate();
        const futureDate = moment().startOf('day').add(query.days, 'days').toDate();

        const filter: Record<string, unknown> = {
            expiryDate: { $gte: now, $lte: futureDate },
        };

        if (query.pharmacyId) {
            filter.pharmacyId = new mongoose.Types.ObjectId(query.pharmacyId);
        }

        const items = await Inventory.find(filter)
            .populate('pharmacyId', 'name')
            .sort({ expiryDate: 1 });

        return items;
    }
}
