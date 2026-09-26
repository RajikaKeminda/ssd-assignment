import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/inventory.service';
import { ApiResponse } from '../utils/api-response';
import { ApiError } from '../utils/api-error';

/**
 * Controller for Pharmacy Inventory Management endpoints.
 * Follows the thin-controller pattern — delegates all business logic
 * to InventoryService.
 */
export class InventoryController {
    /**
     * Create a new inventory item.
     * Requires Pharmacy Staff role.
     */
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) throw ApiError.unauthorized();
            const item = await InventoryService.create(req.body);
            ApiResponse.created(res, item, 'Inventory item created successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all inventory items with pagination and filtering.
     */
    static async getAll(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await InventoryService.getAll(req.query as any);
            ApiResponse.success(res, result, 'Inventory items retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get a single inventory item by ID.
     */
    static async getById(req: Request, res: Response, next: NextFunction) {
        try {
            const item = await InventoryService.getById(String(req.params.id));
            ApiResponse.success(res, item, 'Inventory item retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update an existing inventory item.
     * Requires Pharmacy Staff role.
     */
    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) throw ApiError.unauthorized();
            const item = await InventoryService.update(String(req.params.id), req.body);
            ApiResponse.success(res, item, 'Inventory item updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete an inventory item.
     * Requires Pharmacy Staff role.
     */
    static async delete(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user) throw ApiError.unauthorized();
            const item = await InventoryService.delete(String(req.params.id));
            ApiResponse.success(res, item, 'Inventory item deleted successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get inventory items that are below their low-stock threshold.
     */
    static async getLowStock(req: Request, res: Response, next: NextFunction) {
        try {
            const items = await InventoryService.getLowStock(req.query as any);
            ApiResponse.success(res, items, 'Low stock items retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get inventory items that are expiring within a specified number of days.
     */
    static async getExpiring(req: Request, res: Response, next: NextFunction) {
        try {
            const items = await InventoryService.getExpiring(req.query as any);
            ApiResponse.success(res, items, 'Expiring items retrieved successfully');
        } catch (error) {
            next(error);
        }
    }
}
