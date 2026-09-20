import mongoose from 'mongoose';
import moment from 'moment';
import { Inventory, IInventory } from '../models/inventory.model';
import { DrugValidationService } from './drug-validation.service';
import { ApiError } from '../utils/api-error';
import { logger } from '../utils/logger';
import { escapeRegex } from '../utils/regex';
import {
    CreateInventoryInput,
    UpdateInventoryInput,
    GetInventoryQueryInput,
    LowStockQueryInput,
    ExpiringQueryInput,
} from '../validators/inventory.validator';

/**
 * Identity of the user making the request, used for the cross-tenant
 * object-level access-control checks below (see SECURITY.md #7).
 */
export interface RequestingUser {
    userId: string;
    role: string;
    pharmacyId?: string;
}

/**
 * Service layer for Pharmacy Inventory Management.
 * Handles business logic, database operations, and third-party drug validation.
 */
export class InventoryService {
    /**
     * SECURITY FIX (Cross-Tenant Broken Object-Level Authorization — see
     * SECURITY.md #7): write operations (create/update/delete) used to trust
     * whatever `pharmacyId` the client sent (create) or skip the check
     * entirely (update/delete), so any account with the "Pharmacy Staff"
     * role — a role anyone could hold once they have *a* staff account —
     * could create, edit, or delete inventory belonging to a *different*
     * pharmacy. System Admins are exempt (they legitimately manage all
     * pharmacies); Pharmacy Staff are confined to their own `pharmacyId`.
     */
    private static assertOwnsPharmacy(pharmacyId: string, requester: RequestingUser): void {
        if (requester.role === 'System Admin') return;

        if (requester.role !== 'Pharmacy Staff') {
            throw ApiError.forbidden('Only pharmacy staff or an admin may manage inventory');
        }

        if (!requester.pharmacyId) {
            throw ApiError.forbidden('Your account is not linked to a pharmacy');
        }

        if (requester.pharmacyId !== pharmacyId) {
            throw ApiError.forbidden('You can only manage inventory for your own pharmacy');
        }
    }
    /**
     * Create a new inventory item after validating the medication name
     * against the RxNorm drug database.
     *
     * @param data - Validated inventory item data
     * @returns The newly created inventory document
     */
    static async create(data: CreateInventoryInput, requester: RequestingUser): Promise<IInventory> {
        // SECURITY FIX (Cross-Tenant BOLA — see SECURITY.md #7): validate
        // that this requester is allowed to write to `data.pharmacyId`
        // *before* touching the database.
        this.assertOwnsPharmacy(data.pharmacyId, requester);

        // Validate medication name via RxNorm / mock drug database
        const drugInfo = await DrugValidationService.validateAndGetDrugInfo(
            data.medicationName
        );
        logger.info(
            `Drug validated via RxNorm — RxCUI: ${drugInfo.rxcui}, Name: ${drugInfo.name}`
        );

        // Check for duplicate medication in the same pharmacy
        // SECURITY FIX (ReDoS — see SECURITY.md #4): escape the user-supplied
        // medication name before embedding it in a RegExp.
        const existing = await Inventory.findOne({
            pharmacyId: new mongoose.Types.ObjectId(data.pharmacyId),
            medicationName: { $regex: new RegExp(`^${escapeRegex(data.medicationName)}$`, 'i') },
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
            // SECURITY FIX (ReDoS via Unsanitized Regex — see SECURITY.md #4):
            // `query.search` used to be interpolated into $regex unescaped, so
            // a crafted pattern (catastrophic backtracking) could hang the
            // event loop for every request hitting this endpoint. Escaping it
            // makes the search always literal, which is also the behavior a
            // "search" box should have in the first place.
            const safeSearch = escapeRegex(query.search);
            filter.$or = [
                { medicationName: { $regex: safeSearch, $options: 'i' } },
                { genericName: { $regex: safeSearch, $options: 'i' } },
                { manufacturer: { $regex: safeSearch, $options: 'i' } },
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
    static async update(
        id: string,
        data: UpdateInventoryInput,
        requester: RequestingUser
    ): Promise<IInventory> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw ApiError.badRequest('Invalid inventory item ID');
        }

        // SECURITY FIX (Cross-Tenant BOLA — see SECURITY.md #7): this method
        // used to update ANY inventory item by id with no ownership check at
        // all, so any Pharmacy Staff account could silently edit a
        // competitor pharmacy's stock levels, prices, or prescription flags.
        const existingItem = await Inventory.findById(id);
        if (!existingItem) {
            throw ApiError.notFound('Inventory item not found');
        }
        this.assertOwnsPharmacy(String(existingItem.pharmacyId), requester);

        // If medication name is being changed, validate the new name
        if (data.medicationName) {
            const drugInfo = await DrugValidationService.validateAndGetDrugInfo(
                data.medicationName
            );
            logger.info(
                `Updated drug validated — RxCUI: ${drugInfo.rxcui}, Name: ${drugInfo.name}`
            );
        }

        // Note: updateInventorySchema (validators/inventory.validator.ts)
        // never accepts `pharmacyId` in the body — moving an item to a
        // different pharmacy is not a supported edit, which prevents staff
        // from re-parenting inventory across tenants via this endpoint.
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
    static async delete(id: string, requester: RequestingUser): Promise<IInventory> {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw ApiError.badRequest('Invalid inventory item ID');
        }

        // SECURITY FIX (Cross-Tenant BOLA — see SECURITY.md #7): previously
        // any Pharmacy Staff account could delete any pharmacy's stock item.
        const existingItem = await Inventory.findById(id);
        if (!existingItem) {
            throw ApiError.notFound('Inventory item not found');
        }
        this.assertOwnsPharmacy(String(existingItem.pharmacyId), requester);

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
