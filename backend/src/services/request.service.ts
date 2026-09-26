import mongoose from 'mongoose';
import { MedicationRequest, IRequest, RequestStatus } from '../models/request.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/api-error';
import { logger } from '../utils/logger';
import { NotificationService } from './notification.service';
import {
    CreateRequestInput,
    UpdateRequestInput,
    UpdateRequestStatusInput,
    ListRequestsQuery,
} from '../validators/request.validator';

// ─── Internal types ───────────────────────────────────────────────────────────

interface PaginatedRequests {
    requests: IRequest[];
    total: number;
    page: number;
    pages: number;
}

// Status transitions allowed for pharmacy staff
const VALID_STATUS_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
    [RequestStatus.PENDING]: [RequestStatus.PROCESSING, RequestStatus.UNAVAILABLE, RequestStatus.CANCELLED],
    [RequestStatus.PROCESSING]: [RequestStatus.AVAILABLE, RequestStatus.UNAVAILABLE, RequestStatus.CANCELLED],
    [RequestStatus.AVAILABLE]: [RequestStatus.FULFILLED, RequestStatus.CANCELLED],
    [RequestStatus.UNAVAILABLE]: [RequestStatus.CANCELLED],
    [RequestStatus.FULFILLED]: [],
    [RequestStatus.CANCELLED]: [],
};

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Fetch the patient associated with a request and fire notifications.
 * Errors in notification sending are non-fatal — they are logged and swallowed.
 */
async function dispatchNotification(
    request: IRequest,
    type: 'created' | 'status_changed' | 'cancelled'
): Promise<void> {
    try {
        const patient = await User.findById(request.userId).select('name email phone');
        if (!patient) return;

        const opts = {
            email: patient.email,
            phone: patient.phone,
            patientName: patient.name,
            medicationName: request.medicationName,
            requestId: String(request._id),
        };

        if (type === 'created') {
            await NotificationService.notifyRequestCreated(opts);
        } else if (type === 'cancelled') {
            await NotificationService.notifyRequestCancelled(opts);
        } else {
            await NotificationService.notifyStatusChanged({
                ...opts,
                newStatus: request.status,
            });
        }
    } catch (err) {
        logger.error(`Notification dispatch failed for request ${request._id}:`, err);
    }
}

// ─── Service class ────────────────────────────────────────────────────────────

export class RequestService {
    /**
     * Create a new medication request owned by the authenticated patient.
     */
    static async createRequest(
        data: CreateRequestInput,
        userId: string
    ): Promise<IRequest> {
        const request = await MedicationRequest.create({
            userId: new mongoose.Types.ObjectId(userId),
            pharmacyId: new mongoose.Types.ObjectId(data.pharmacyId),
            medicationName: data.medicationName,
            quantity: data.quantity,
            urgencyLevel: data.urgencyLevel,
            prescriptionRequired: data.prescriptionRequired,
            prescriptionImage: data.prescriptionImage,
            notes: data.notes,
            estimatedAvailability: data.estimatedAvailability
                ? new Date(data.estimatedAvailability)
                : undefined,
            requestDate: new Date(),
        });

        logger.info(`Medication request ${request._id} created by user ${userId}`);

        // Fire-and-forget notification
        dispatchNotification(request, 'created');

        return request.populate([
            { path: 'userId', select: 'name email phone' },
            { path: 'pharmacyId', select: 'name location contactInfo' },
        ]);
    }

    /**
     * List all requests with optional filters. Admins/pharmacy staff see all;
     * the caller's role filtering is enforced at the controller level.
     */
    static async getRequests(query: ListRequestsQuery): Promise<PaginatedRequests> {
        const filter: Record<string, unknown> = {};

        if (query.status) filter.status = query.status;
        if (query.urgencyLevel) filter.urgencyLevel = query.urgencyLevel;
        if (query.dateFrom || query.dateTo) {
            filter.requestDate = {
                ...(query.dateFrom ? { $gte: new Date(query.dateFrom) } : {}),
                ...(query.dateTo ? { $lte: new Date(query.dateTo) } : {}),
            };
        }

        const { page, limit, sortBy, sortOrder } = query;
        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            MedicationRequest.find(filter)
                .populate('userId', 'name email phone')
                .populate('pharmacyId', 'name location')
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit),
            MedicationRequest.countDocuments(filter),
        ]);

        return { requests, total, page, pages: Math.ceil(total / limit) };
    }

    /** Retrieve a single request by ID. */
    static async getRequestById(requestId: string): Promise<IRequest> {
        const request = await MedicationRequest.findById(requestId)
            .populate('userId', 'name email phone')
            .populate('pharmacyId', 'name location contactInfo');

        if (!request) throw ApiError.notFound('Medication request not found');
        return request;
    }

    /**
     * Retrieve all requests belonging to a specific patient.
     * The route guard ensures a Patient can only call this for their own userId.
     */
    static async getRequestsByUser(
        userId: string,
        query: ListRequestsQuery
    ): Promise<PaginatedRequests> {
        const filter: Record<string, unknown> = { userId };
        if (query.status) filter.status = query.status;
        if (query.urgencyLevel) filter.urgencyLevel = query.urgencyLevel;

        const { page, limit, sortBy, sortOrder } = query;
        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            MedicationRequest.find(filter)
                .populate('pharmacyId', 'name location')
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit),
            MedicationRequest.countDocuments(filter),
        ]);

        return { requests, total, page, pages: Math.ceil(total / limit) };
    }

    /** Retrieve all requests assigned to a specific pharmacy. */
    static async getRequestsByPharmacy(
        pharmacyId: string,
        query: ListRequestsQuery
    ): Promise<PaginatedRequests> {
        const filter: Record<string, unknown> = { pharmacyId };
        if (query.status) filter.status = query.status;
        if (query.urgencyLevel) filter.urgencyLevel = query.urgencyLevel;

        const { page, limit, sortBy, sortOrder } = query;
        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            MedicationRequest.find(filter)
                .populate('userId', 'name email phone')
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit),
            MedicationRequest.countDocuments(filter),
        ]);

        return { requests, total, page, pages: Math.ceil(total / limit) };
    }

    /** Get all requests with urgency level = "urgent". */
    static async getUrgentRequests(query: ListRequestsQuery): Promise<PaginatedRequests> {
        const { page, limit, sortBy, sortOrder } = query;
        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
            MedicationRequest.find({ urgencyLevel: 'urgent' })
                .populate('userId', 'name email phone')
                .populate('pharmacyId', 'name location')
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit),
            MedicationRequest.countDocuments({ urgencyLevel: 'urgent' }),
        ]);

        return { requests, total, page, pages: Math.ceil(total / limit) };
    }

    /**
     * Update editable fields of a PENDING request.
     * Only the owning patient may perform this action (enforced at controller level).
     */
    static async updateRequest(
        requestId: string,
        data: UpdateRequestInput,
        userId: string
    ): Promise<IRequest> {
        const request = await MedicationRequest.findById(requestId);
        if (!request) throw ApiError.notFound('Medication request not found');

        if (request.userId.toString() !== userId) {
            throw ApiError.forbidden('You can only update your own requests');
        }

        if (request.status !== RequestStatus.PENDING) {
            throw ApiError.badRequest(
                `Only pending requests can be edited. Current status: '${request.status}'`
            );
        }

        if (data.quantity !== undefined) request.quantity = data.quantity;
        if (data.urgencyLevel !== undefined) request.urgencyLevel = data.urgencyLevel;
        if (data.notes !== undefined) request.notes = data.notes;
        if (data.prescriptionImage !== undefined) request.prescriptionImage = data.prescriptionImage;

        await request.save();
        logger.info(`Request ${requestId} updated by user ${userId}`);
        return request;
    }

    /**
     * Update the status of a request (pharmacy staff only).
     * Enforces valid status state-machine transitions.
     */
    static async updateRequestStatus(
        requestId: string,
        data: UpdateRequestStatusInput,
        pharmacyId?: string
    ): Promise<IRequest> {
        const request = await MedicationRequest.findById(requestId);
        if (!request) throw ApiError.notFound('Medication request not found');

        // Pharmacy staff can only change status on requests assigned to their pharmacy
        if (pharmacyId && request.pharmacyId.toString() !== pharmacyId) {
            throw ApiError.forbidden('This request does not belong to your pharmacy');
        }

        const validNext = VALID_STATUS_TRANSITIONS[request.status];
        if (!validNext.includes(data.status)) {
            throw ApiError.badRequest(
                `Invalid status transition from '${request.status}' to '${data.status}'. ` +
                `Allowed: ${validNext.length ? validNext.join(', ') : 'none'}`
            );
        }

        request.status = data.status;
        if (data.responseDate) request.responseDate = new Date(data.responseDate);
        if (data.estimatedAvailability)
            request.estimatedAvailability = new Date(data.estimatedAvailability);
        if (data.notes) request.notes = data.notes;

        await request.save();
        logger.info(`Request ${requestId} status → ${data.status}`);

        // Notify patient of status change
        dispatchNotification(request, 'status_changed');

        return request.populate([
            { path: 'userId', select: 'name email phone' },
            { path: 'pharmacyId', select: 'name location' },
        ]);
    }

    /**
     * Cancel a pending request.
     * Patients can only cancel their own requests; pharmacy staff/admins can cancel any.
     */
    static async cancelRequest(
        requestId: string,
        userId: string,
        userRole: string
    ): Promise<IRequest> {
        const request = await MedicationRequest.findById(requestId);
        if (!request) throw ApiError.notFound('Medication request not found');

        const isOwner = request.userId.toString() === userId;
        const isStaffOrAdmin = ['Pharmacy Staff', 'System Admin'].includes(userRole);

        if (!isOwner && !isStaffOrAdmin) {
            throw ApiError.forbidden('You do not have permission to cancel this request');
        }

        if (
            request.status === RequestStatus.CANCELLED ||
            request.status === RequestStatus.FULFILLED
        ) {
            throw ApiError.badRequest(
                `Cannot cancel a request with status '${request.status}'`
            );
        }

        request.status = RequestStatus.CANCELLED;
        request.responseDate = new Date();
        await request.save();

        logger.info(`Request ${requestId} cancelled by user ${userId}`);
        dispatchNotification(request, 'cancelled');

        return request;
    }
}
