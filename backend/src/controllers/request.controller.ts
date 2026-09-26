import { Request, Response, NextFunction } from 'express';
import { RequestService } from '../services/request.service';
import { ApiResponse } from '../utils/api-response';
import { ApiError } from '../utils/api-error';
import { UserRole } from '../models/user.model';
import {
    CreateRequestInput,
    UpdateRequestInput,
    UpdateRequestStatusInput,
    ListRequestsQuery,
} from '../validators/request.validator';

/** Narrow req.params values safely to string (Express v5 @types uses string | string[]) */
function param(req: Request, key: string): string {
    const v = req.params[key];
    return Array.isArray(v) ? v[0] : v;
}

/** Read pagination/filter query — already validated by Zod middleware */
function getQuery(req: Request): ListRequestsQuery {
    return req.query as unknown as ListRequestsQuery;
}

export class RequestController {
    /** POST /api/requests — Patient creates a new medication request */
    static async createRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = String(req.user!._id);
            const request = await RequestService.createRequest(
                req.body as CreateRequestInput,
                userId
            );
            ApiResponse.created(res, request, 'Medication request created successfully');
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/requests — System admin / pharmacy staff sees all (with filters) */
    static async getRequests(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await RequestService.getRequests(getQuery(req));
            ApiResponse.success(res, result, 'Requests retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/requests/urgent — All urgent-priority requests (admin / pharmacy staff) */
    static async getUrgentRequests(req: Request, res: Response, next: NextFunction) {
        try {
            const result = await RequestService.getUrgentRequests(getQuery(req));
            ApiResponse.success(res, result, 'Urgent requests retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/requests/user/:userId
     * Patients can only access their own; admins can access any user's.
     */
    static async getRequestsByUser(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = param(req, 'userId');
            const currentUser = req.user!;

            if (
                currentUser.role === UserRole.PATIENT &&
                String(currentUser._id) !== userId
            ) {
                return next(ApiError.forbidden('You can only view your own requests'));
            }

            const result = await RequestService.getRequestsByUser(userId, getQuery(req));
            ApiResponse.success(res, result, 'User requests retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/requests/pharmacy/:pharmacyId — Pharmacy staff / admin only */
    static async getRequestsByPharmacy(req: Request, res: Response, next: NextFunction) {
        try {
            const pharmacyId = param(req, 'pharmacyId');
            const currentUser = req.user!;

            if (
                currentUser.role === UserRole.PHARMACY_STAFF &&
                String(currentUser.pharmacyId) !== pharmacyId
            ) {
                return next(
                    ApiError.forbidden('You can only view requests for your own pharmacy')
                );
            }

            const result = await RequestService.getRequestsByPharmacy(pharmacyId, getQuery(req));
            ApiResponse.success(res, result, 'Pharmacy requests retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /** GET /api/requests/:id — Get a single request (owner or staff/admin) */
    static async getRequestById(req: Request, res: Response, next: NextFunction) {
        try {
            const requestId = param(req, 'id');
            const request = await RequestService.getRequestById(requestId);
            const currentUser = req.user!;

            if (
                currentUser.role === UserRole.PATIENT &&
                String(request.userId) !== String(currentUser._id)
            ) {
                return next(ApiError.forbidden('Access denied'));
            }

            ApiResponse.success(res, request, 'Request retrieved successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/requests/:id
     * Patient updates their own PENDING request (quantity, urgencyLevel, notes, prescriptionImage).
     */
    static async updateRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const requestId = param(req, 'id');
            const userId = String(req.user!._id);
            const request = await RequestService.updateRequest(
                requestId,
                req.body as UpdateRequestInput,
                userId
            );
            ApiResponse.success(res, request, 'Request updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * PATCH /api/requests/:id/status
     * Pharmacy staff updates the request status. Triggers patient notification.
     */
    static async updateRequestStatus(req: Request, res: Response, next: NextFunction) {
        try {
            const requestId = param(req, 'id');
            const currentUser = req.user!;
            // System admins bypass pharmacy scoping
            const pharmacyId =
                currentUser.role === UserRole.PHARMACY_STAFF
                    ? String(currentUser.pharmacyId)
                    : undefined;

            const request = await RequestService.updateRequestStatus(
                requestId,
                req.body as UpdateRequestStatusInput,
                pharmacyId
            );
            ApiResponse.success(res, request, 'Request status updated successfully');
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/requests/:id
     * Cancel a request. Patients cancel their own; pharmacy staff/admin can cancel any.
     */
    static async cancelRequest(req: Request, res: Response, next: NextFunction) {
        try {
            const requestId = param(req, 'id');
            const currentUser = req.user!;
            const request = await RequestService.cancelRequest(
                requestId,
                String(currentUser._id),
                currentUser.role as string
            );
            ApiResponse.success(res, request, 'Request cancelled successfully');
        } catch (error) {
            next(error);
        }
    }
}
