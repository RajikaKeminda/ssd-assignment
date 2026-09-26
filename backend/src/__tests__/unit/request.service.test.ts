import mongoose from 'mongoose';
import { RequestService } from '../../services/request.service';
import { MedicationRequest, RequestStatus, UrgencyLevel } from '../../models/request.model';
import { User, UserRole } from '../../models/user.model';
import { ApiError } from '../../utils/api-error';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db.helper';
import { 
  createTestUser, 
  createPharmacyStaff, 
  createSystemAdmin,
  createTestRequest,
  testIds 
} from '../helpers/test-data.helper';
import { CreateRequestInput, ListRequestsQuery } from '@validators/request.validator';

describe('RequestService', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('createRequest', () => {
    it('should create a new medication request successfully', async () => {
      // Arrange
      const patient = await createTestUser();
      const createData = {
        pharmacyId: testIds.pharmacyId.toString(),
        medicationName: 'Amoxicillin 500mg',
        quantity: 30,
        urgencyLevel: UrgencyLevel.NORMAL,
        prescriptionRequired: false,
        notes: 'Test medication request'
      };

      // Act
      const result = await RequestService.createRequest(createData, patient._id.toString());

      // Assert
      expect(result).toBeDefined();
      expect(result.userId.toString()).toBe(patient._id.toString());
      expect(result.pharmacyId.toString()).toBe(testIds.pharmacyId.toString());
      expect(result.medicationName).toBe('Amoxicillin 500mg');
      expect(result.quantity).toBe(30);
      expect(result.urgencyLevel).toBe(UrgencyLevel.NORMAL);
      expect(result.status).toBe(RequestStatus.PENDING);
      expect(result.prescriptionRequired).toBe(false);
      expect(result.notes).toBe('Test medication request');
      expect(result.requestDate).toBeInstanceOf(Date);
    });

    it('should create request with default urgency level when not provided', async () => {
      // Arrange
      const patient = await createTestUser();
      const createData = {
        pharmacyId: testIds.pharmacyId.toString(),
        medicationName: 'Ibuprofen 400mg',
        quantity: 20,
        prescriptionRequired: true
      };

      // Act
      const result = await RequestService.createRequest(createData as CreateRequestInput, patient._id.toString());

      // Assert
      expect(result.urgencyLevel).toBe(UrgencyLevel.NORMAL);
    });

    it('should create request with estimated availability when provided', async () => {
      // Arrange
      const patient = await createTestUser();
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + 7);
      
      const createData = {
        pharmacyId: testIds.pharmacyId.toString(),
        medicationName: 'Cetirizine 10mg',
        quantity: 15,
        estimatedAvailability: estimatedDate.toISOString()
      };

      // Act
      const result = await RequestService.createRequest(createData as CreateRequestInput, patient._id.toString());

      // Assert
      expect(result.estimatedAvailability).toBeInstanceOf(Date);
      expect(result.estimatedAvailability!.toISOString()).toBe(estimatedDate.toISOString());
    });
  });

  describe('getRequests', () => {
    beforeEach(async () => {
      // Create test data
      await createTestUser();
      await createTestRequest();
      await createTestRequest({
        _id: new mongoose.Types.ObjectId(),
        status: RequestStatus.PROCESSING,
        urgencyLevel: UrgencyLevel.URGENT
      });
      await createTestRequest({
        _id: new mongoose.Types.ObjectId(),
        status: RequestStatus.AVAILABLE,
        urgencyLevel: UrgencyLevel.LOW
      });
    });

    it('should return paginated requests with default parameters', async () => {
      // Arrange
      const query = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' };

      // Act
      const result = await RequestService.getRequests(query as ListRequestsQuery);

      // Assert
      expect(result.requests).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
    });

    it('should filter requests by status', async () => {
      // Arrange
      const query: ListRequestsQuery = { 
        page: 1, 
        limit: 10, 
        sortBy: 'createdAt', 
        sortOrder: 'desc',
        status: RequestStatus.PENDING 
      };

      // Act
      const result = await RequestService.getRequests(query);

      // Assert
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0].status).toBe(RequestStatus.PENDING);
    });

    it('should filter requests by urgency level', async () => {
      // Arrange
      const query = { 
        page: 1, 
        limit: 10, 
        sortBy: 'createdAt', 
        sortOrder: 'desc',
        urgencyLevel: UrgencyLevel.URGENT 
      };

      // Act
      const result = await RequestService.getRequests(query as ListRequestsQuery);

      // Assert
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0].urgencyLevel).toBe(UrgencyLevel.URGENT);
    });

    it('should filter requests by date range', async () => {
      // Arrange
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const query = { 
        page: 1, 
        limit: 10, 
        sortBy: 'createdAt', 
        sortOrder: 'desc',
        dateFrom: today.toISOString(),
        dateTo: tomorrow.toISOString()
      };

      // Act
      const result = await RequestService.getRequests(query as ListRequestsQuery);

      // Assert
      expect(result.requests.length).toBeGreaterThan(0);
      result.requests.forEach(request => {
        expect(request.requestDate).toBeInstanceOf(Date);
        expect(request.requestDate >= today).toBe(true);
        expect(request.requestDate <= tomorrow).toBe(true);
      });
    });

    it('should handle pagination correctly', async () => {
      // Arrange
      const query = { page: 1, limit: 2, sortBy: 'createdAt', sortOrder: 'desc' };

      // Act
      const result = await RequestService.getRequests(query as ListRequestsQuery);

      // Assert
      expect(result.requests).toHaveLength(2);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(2);
    });
  });

  describe('getRequestById', () => {
    it('should return request by ID', async () => {
      // Arrange
      const request = await createTestRequest();

      // Act
      const result = await RequestService.getRequestById(request._id.toString());

      // Assert
      expect(result._id.toString()).toBe(request._id.toString());
      expect(result.medicationName).toBe(request.medicationName);
    });

    it('should throw ApiError when request not found', async () => {
      // Arrange
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      // Act & Assert
      await expect(RequestService.getRequestById(nonExistentId))
        .rejects
        .toThrow(ApiError);
    });
  });

  describe('getRequestsByUser', () => {
    beforeEach(async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser({ 
        _id: new mongoose.Types.ObjectId(), 
        email: 'user2@test.com' 
      });

      await createTestRequest({ userId: user1._id });
      await createTestRequest({ 
        _id: new mongoose.Types.ObjectId(), 
        userId: user1._id,
        status: RequestStatus.PROCESSING 
      });
      await createTestRequest({ 
        _id: new mongoose.Types.ObjectId(), 
        userId: user2._id 
      });
    });

    it('should return requests for specific user', async () => {
      // Arrange
      const user = await User.findOne({ email: 'patient@test.com' });
      const query = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' };

      // Act
      const result = await RequestService.getRequestsByUser(user!._id.toString(), query as ListRequestsQuery);

      // Assert
      expect(result.requests).toHaveLength(2);
      result.requests.forEach(request => {
        expect(request.userId.toString()).toBe(user!._id.toString());
      });
    });

    it('should return empty result for user with no requests', async () => {
      // Arrange
      const user = await User.findOne({ email: 'user2@test.com' });
      await MedicationRequest.deleteMany({ userId: user!._id });
      const query = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' };

      // Act
      const result = await RequestService.getRequestsByUser(user!._id.toString(), query as ListRequestsQuery);

      // Assert
      expect(result.requests).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getRequestsByPharmacy', () => {
    beforeEach(async () => {
      await createTestUser();
      await createTestRequest({ pharmacyId: testIds.pharmacyId });
      await createTestRequest({ 
        _id: new mongoose.Types.ObjectId(), 
        pharmacyId: testIds.pharmacyId,
        status: RequestStatus.PROCESSING 
      });
      const otherPharmacyId = new mongoose.Types.ObjectId();
      await createTestRequest({ 
        _id: new mongoose.Types.ObjectId(), 
        pharmacyId: otherPharmacyId 
      });
    });

    it('should return requests for specific pharmacy', async () => {
      // Arrange
      const query = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' };

      // Act
      const result = await RequestService.getRequestsByPharmacy(testIds.pharmacyId.toString(), query as ListRequestsQuery);

      // Assert
      expect(result.requests).toHaveLength(2);
      result.requests.forEach(request => {
        expect(request.pharmacyId.toString()).toBe(testIds.pharmacyId.toString());
      });
    });
  });

  describe('getUrgentRequests', () => {
    beforeEach(async () => {
      await createTestUser();
      await createTestRequest({ urgencyLevel: UrgencyLevel.URGENT });
      await createTestRequest({ 
        _id: new mongoose.Types.ObjectId(), 
        urgencyLevel: UrgencyLevel.URGENT,
        status: RequestStatus.PROCESSING 
      });
      await createTestRequest({ 
        _id: new mongoose.Types.ObjectId(), 
        urgencyLevel: UrgencyLevel.NORMAL 
      });
    });

    it('should return only urgent requests', async () => {
      // Arrange
      const query = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' };

      // Act
      const result = await RequestService.getUrgentRequests(query as ListRequestsQuery);

      // Assert
      expect(result.requests).toHaveLength(2);
      result.requests.forEach(request => {
        expect(request.urgencyLevel).toBe(UrgencyLevel.URGENT);
      });
    });
  });

  describe('updateRequest', () => {
    it('should update pending request successfully', async () => {
      // Arrange
      const patient = await createTestUser();
      const request = await createTestRequest({ userId: patient._id });
      const updateData = {
        quantity: 50,
        urgencyLevel: UrgencyLevel.URGENT,
        notes: 'Updated notes'
      };

      // Act
      const result = await RequestService.updateRequest(
        request._id.toString(), 
        updateData, 
        patient._id.toString()
      );

      // Assert
      expect(result.quantity).toBe(50);
      expect(result.urgencyLevel).toBe(UrgencyLevel.URGENT);
      expect(result.notes).toBe('Updated notes');
    });

    it('should throw error when updating non-pending request', async () => {
      // Arrange
      const patient = await createTestUser();
      const request = await createTestRequest({ 
        userId: patient._id, 
        status: RequestStatus.PROCESSING 
      });
      const updateData = { quantity: 50 };

      // Act & Assert
      await expect(RequestService.updateRequest(
        request._id.toString(), 
        updateData, 
        patient._id.toString()
      )).rejects.toThrow(ApiError);
    });

    it('should throw error when user tries to update another user\'s request', async () => {
      // Arrange
      const patient1 = await createTestUser();
      const patient2 = await createTestUser({ 
        _id: new mongoose.Types.ObjectId(), 
        email: 'patient2@test.com' 
      });
      const request = await createTestRequest({ userId: patient1._id });
      const updateData = { quantity: 50 };

      // Act & Assert
      await expect(RequestService.updateRequest(
        request._id.toString(), 
        updateData, 
        patient2._id.toString()
      )).rejects.toThrow(ApiError);
    });

    it('should throw error when request not found', async () => {
      // Arrange
      const patient = await createTestUser();
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const updateData = { quantity: 50 };

      // Act & Assert
      await expect(RequestService.updateRequest(
        nonExistentId, 
        updateData, 
        patient._id.toString()
      )).rejects.toThrow(ApiError);
    });
  });

  describe('updateRequestStatus', () => {
    it('should update request status with valid transition', async () => {
      // Arrange
      const request = await createTestRequest({ status: RequestStatus.PENDING });
      const updateData = { status: RequestStatus.PROCESSING };

      // Act
      const result = await RequestService.updateRequestStatus(
        request._id.toString(), 
        updateData
      );

      // Assert
      expect(result.status).toBe(RequestStatus.PROCESSING);
    });

    it('should throw error for invalid status transition', async () => {
      // Arrange
      const request = await createTestRequest({ status: RequestStatus.FULFILLED });
      const updateData = { status: RequestStatus.PROCESSING };

      // Act & Assert
      await expect(RequestService.updateRequestStatus(
        request._id.toString(), 
        updateData
      )).rejects.toThrow(ApiError);
    });

    it('should throw error when pharmacy staff tries to update request from other pharmacy', async () => {
      // Arrange
      const request = await createTestRequest();
      const otherPharmacyId = new mongoose.Types.ObjectId().toString();
      const updateData = { status: RequestStatus.PROCESSING };

      // Act & Assert
      await expect(RequestService.updateRequestStatus(
        request._id.toString(), 
        updateData, 
        otherPharmacyId
      )).rejects.toThrow(ApiError);
    });

    it('should update response date and estimated availability when provided', async () => {
      // Arrange
      const request = await createTestRequest({ status: RequestStatus.PENDING });
      const responseDate = new Date();
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + 3);
      
      const updateData = { 
        status: RequestStatus.PROCESSING,
        responseDate: responseDate.toISOString(),
        estimatedAvailability: estimatedDate.toISOString(),
        notes: 'Processing your request'
      };

      // Act
      const result = await RequestService.updateRequestStatus(
        request._id.toString(), 
        updateData
      );

      // Assert
      expect(result.responseDate).toBeInstanceOf(Date);
      expect(result.estimatedAvailability).toBeInstanceOf(Date);
      expect(result.notes).toBe('Processing your request');
    });
  });

  describe('cancelRequest', () => {
    it('should allow patient to cancel their own pending request', async () => {
      // Arrange
      const patient = await createTestUser();
      const request = await createTestRequest({ 
        userId: patient._id, 
        status: RequestStatus.PENDING 
      });

      // Act
      const result = await RequestService.cancelRequest(
        request._id.toString(), 
        patient._id.toString(), 
        UserRole.PATIENT
      );

      // Assert
      expect(result.status).toBe(RequestStatus.CANCELLED);
      expect(result.responseDate).toBeInstanceOf(Date);
    });

    it('should allow pharmacy staff to cancel any request', async () => {
      // Arrange
      const request = await createTestRequest({ status: RequestStatus.PROCESSING });

      // Act
      const result = await RequestService.cancelRequest(
        request._id.toString(), 
        'some-user-id', 
        UserRole.PHARMACY_STAFF
      );

      // Assert
      expect(result.status).toBe(RequestStatus.CANCELLED);
    });

    it('should allow system admin to cancel any request', async () => {
      // Arrange
      const request = await createTestRequest({ status: RequestStatus.AVAILABLE });

      // Act
      const result = await RequestService.cancelRequest(
        request._id.toString(), 
        'some-user-id', 
        UserRole.SYSTEM_ADMIN
      );

      // Assert
      expect(result.status).toBe(RequestStatus.CANCELLED);
    });

    it('should throw error when patient tries to cancel another user\'s request', async () => {
      // Arrange
      const patient1 = await createTestUser();
      const patient2 = await createTestUser({ 
        _id: new mongoose.Types.ObjectId(), 
        email: 'patient2@test.com' 
      });
      const request = await createTestRequest({ userId: patient1._id });

      // Act & Assert
      await expect(RequestService.cancelRequest(
        request._id.toString(), 
        patient2._id.toString(), 
        UserRole.PATIENT
      )).rejects.toThrow(ApiError);
    });

    it('should throw error when trying to cancel fulfilled request', async () => {
      // Arrange
      const patient = await createTestUser();
      const request = await createTestRequest({ 
        userId: patient._id, 
        status: RequestStatus.FULFILLED 
      });

      // Act & Assert
      await expect(RequestService.cancelRequest(
        request._id.toString(), 
        patient._id.toString(), 
        UserRole.PATIENT
      )).rejects.toThrow(ApiError);
    });

    it('should throw error when trying to cancel already cancelled request', async () => {
      // Arrange
      const patient = await createTestUser();
      const request = await createTestRequest({ 
        userId: patient._id, 
        status: RequestStatus.CANCELLED 
      });

      // Act & Assert
      await expect(RequestService.cancelRequest(
        request._id.toString(), 
        patient._id.toString(), 
        UserRole.PATIENT
      )).rejects.toThrow(ApiError);
    });

    it('should throw error when request not found', async () => {
      // Arrange
      const patient = await createTestUser();
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      // Act & Assert
      await expect(RequestService.cancelRequest(
        nonExistentId, 
        patient._id.toString(), 
        UserRole.PATIENT
      )).rejects.toThrow(ApiError);
    });
  });
});
