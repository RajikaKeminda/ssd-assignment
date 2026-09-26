import request from 'supertest';
import express from 'express';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db.helper';
import { createTestApp } from '../helpers/app.helper';
import { 
  generatePatientToken, 
  generateStaffToken, 
  generateAdminToken 
} from '../helpers/auth.helper';
import { 
  createTestUser, 
  createPharmacyStaff, 
  createSystemAdmin,
  createTestRequest,
  testIds 
} from '../helpers/test-data.helper';
import { RequestStatus, UrgencyLevel } from '../../models/request.model';
import mongoose from 'mongoose';

describe('Request API Integration Tests', () => {
  let app: express.Application;
  let patientToken: string;
  let staffToken: string;
  let adminToken: string;
  let patient: any;
  let staff: any;
  let admin: any;

  beforeAll(async () => {
    await connectTestDB();
    app = createTestApp();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
    
    // Create test users
    patient = await createTestUser();
    staff = await createPharmacyStaff({ pharmacyId: testIds.pharmacyId });
    admin = await createSystemAdmin();

    // Generate tokens
    patientToken = generatePatientToken(patient._id.toString());
    staffToken = generateStaffToken(staff._id.toString());
    adminToken = generateAdminToken(admin._id.toString());
  });

  describe('POST /api/requests', () => {
    const validRequestData = {
      pharmacyId: testIds.pharmacyId.toString(),
      medicationName: 'Amoxicillin 500mg',
      quantity: 30,
      urgencyLevel: UrgencyLevel.NORMAL,
      prescriptionRequired: false,
      notes: 'Test medication request'
    };

    it('should create a new request successfully (201)', async () => {
      // Act
      const response = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(validRequestData)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Medication request created successfully');
      expect(response.body.data).toMatchObject({
        userId: patient._id.toString(),
        pharmacyId: testIds.pharmacyId.toString(),
        medicationName: 'Amoxicillin 500mg',
        quantity: 30,
        urgencyLevel: UrgencyLevel.NORMAL,
        status: RequestStatus.PENDING,
        prescriptionRequired: false,
        notes: 'Test medication request'
      });
      expect(response.body.data.requestDate).toBeDefined();
    });

    it('should require authentication (401)', async () => {
      // Act
      const response = await request(app)
        .post('/api/requests')
        .send(validRequestData)
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should require patient role (403)', async () => {
      // Act
      const response = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(validRequestData)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should validate required fields (400)', async () => {
      // Act
      const response = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          medicationName: 'Test medication'
          // Missing pharmacyId and quantity
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate quantity is positive (400)', async () => {
      // Act
      const response = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          ...validRequestData,
          quantity: -5
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
    });

    it('should validate urgency level (400)', async () => {
      // Act
      const response = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          ...validRequestData,
          urgencyLevel: 'invalid'
        })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
    });

    it('should accept optional fields', async () => {
      // Arrange
      const requestDataWithOptionals = {
        ...validRequestData,
        urgencyLevel: UrgencyLevel.URGENT,
        prescriptionRequired: true,
        prescriptionImage: 'https://example.com/prescription.jpg',
        estimatedAvailability: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      // Act
      const response = await request(app)
        .post('/api/requests')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(requestDataWithOptionals)
        .expect(201);

      // Assert
      expect(response.body.data.urgencyLevel).toBe(UrgencyLevel.URGENT);
      expect(response.body.data.prescriptionRequired).toBe(true);
      expect(response.body.data.prescriptionImage).toBe('https://example.com/prescription.jpg');
      expect(response.body.data.estimatedAvailability).toBeDefined();
    });
  });

  describe('GET /api/requests', () => {
    beforeEach(async () => {
      // Create test requests
      await createTestRequest({ status: RequestStatus.PENDING });
      await createTestRequest({ 
        _id: new mongoose.Types.ObjectId(), 
        status: RequestStatus.PROCESSING,
        urgencyLevel: UrgencyLevel.URGENT 
      });
    });

    it('should return all requests for pharmacy staff (200)', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pages).toBe(1);
    });

    it('should return all requests for system admin (200)', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(2);
    });

    it('should deny access to patients (403)', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should filter by status', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests?status=pending')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Assert
      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.requests[0].status).toBe(RequestStatus.PENDING);
    });

    it('should filter by urgency level', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests?urgencyLevel=urgent')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Assert
      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.requests[0].urgencyLevel).toBe(UrgencyLevel.URGENT);
    });

    it('should paginate results', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests?page=1&limit=1')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Assert
      expect(response.body.data.requests).toHaveLength(1);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.pages).toBe(2);
    });

    it('should require authentication (401)', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests')
        .expect(401);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/requests/urgent', () => {
    beforeEach(async () => {
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

    it('should return only urgent requests for staff (200)', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests/urgent')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(2);
      response.body.data.requests.forEach((req: any) => {
        expect(req.urgencyLevel).toBe(UrgencyLevel.URGENT);
      });
    });

    it('should deny access to patients (403)', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests/urgent')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/requests/user/:userId', () => {
    beforeEach(async () => {
      await createTestRequest({ userId: patient._id });
      await createTestRequest({ 
        _id: new mongoose.Types.ObjectId(), 
        userId: patient._id,
        status: RequestStatus.PROCESSING 
      });
      const otherUser = await createTestUser({ 
        _id: new mongoose.Types.ObjectId(), 
        email: 'other@test.com' 
      });
      await createTestRequest({ userId: otherUser._id });
    });

    it('should return user requests for the user themselves (200)', async () => {
      // Act
      const response = await request(app)
        .get(`/api/requests/user/${patient._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(2);
      response.body.data.requests.forEach((req: any) => {
        expect(req.userId._id).toBe(patient._id.toString());
      });
    });

    it('should return user requests for admin (200)', async () => {
      // Act
      const response = await request(app)
        .get(`/api/requests/user/${patient._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(2);
    });

    it('should deny patient access to other user\'s requests (403)', async () => {
      // Arrange
      const otherUser = await createTestUser({ 
        _id: new mongoose.Types.ObjectId(), 
        email: 'other2@test.com' 
      });

      // Act
      const response = await request(app)
        .get(`/api/requests/user/${otherUser._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('own requests');
    });

    it('should validate userId format (400)', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests/user/invalid-id')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/requests/pharmacy/:pharmacyId', () => {
    beforeEach(async () => {
      await createTestRequest({ pharmacyId: testIds.pharmacyId });
      await createTestRequest({ 
        _id: new mongoose.Types.ObjectId(), 
        pharmacyId: testIds.pharmacyId,
        status: RequestStatus.PROCESSING 
      });
      const otherPharmacyId = new mongoose.Types.ObjectId();
      await createTestRequest({ pharmacyId: otherPharmacyId });
    });

    it('should return pharmacy requests for pharmacy staff (200)', async () => {
      // Act
      const response = await request(app)
        .get(`/api/requests/pharmacy/${testIds.pharmacyId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(2);
      response.body.data.requests.forEach((req: any) => {
        expect(req.pharmacyId._id).toBe(testIds.pharmacyId.toString());
      });
    });

    it('should return pharmacy requests for admin (200)', async () => {
      // Act
      const response = await request(app)
        .get(`/api/requests/pharmacy/${testIds.pharmacyId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.requests).toHaveLength(2);
    });

    it('should deny staff access to other pharmacy requests (403)', async () => {
      // Arrange
      const otherPharmacyId = new mongoose.Types.ObjectId();
      const otherStaff = await createPharmacyStaff({ 
        _id: new mongoose.Types.ObjectId(), 
        email: 'other@staff.com',
        pharmacyId: otherPharmacyId 
      });
      const otherStaffToken = generateStaffToken(otherStaff._id.toString());

      // Act
      const response = await request(app)
        .get(`/api/requests/pharmacy/${testIds.pharmacyId}`)
        .set('Authorization', `Bearer ${otherStaffToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('own pharmacy');
    });

    it('should deny patient access (403)', async () => {
      // Act
      const response = await request(app)
        .get(`/api/requests/pharmacy/${testIds.pharmacyId}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/requests/:id', () => {
    let testRequest: any;

    beforeEach(async () => {
      testRequest = await createTestRequest({ userId: patient._id });
    });

    it('should return request for owner (200)', async () => {
      // Act
      const response = await request(app)
        .get(`/api/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testRequest._id.toString());
    });

    it('should return request for staff (200)', async () => {
      // Act
      const response = await request(app)
        .get(`/api/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testRequest._id.toString());
    });

    it('should return request for admin (200)', async () => {
      // Act
      const response = await request(app)
        .get(`/api/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data._id).toBe(testRequest._id.toString());
    });

    it('should return 404 for non-existent request', async () => {
      // Act
      const response = await request(app)
        .get(`/api/requests/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(404);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should validate request ID format (400)', async () => {
      // Act
      const response = await request(app)
        .get('/api/requests/invalid-id')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/requests/:id', () => {
    let testRequest: any;
    const updateData = {
      quantity: 50,
      urgencyLevel: UrgencyLevel.URGENT,
      notes: 'Updated request'
    };

    beforeEach(async () => {
      testRequest = await createTestRequest({ 
        userId: patient._id, 
        status: RequestStatus.PENDING 
      });
    });

    it('should update request for owner (200)', async () => {
      // Act
      const response = await request(app)
        .put(`/api/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(updateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(50);
      expect(response.body.data.urgencyLevel).toBe(UrgencyLevel.URGENT);
      expect(response.body.data.notes).toBe('Updated request');
    });

    it('should deny update for non-owner (403)', async () => {
      // Arrange
      const otherPatient = await createTestUser({ 
        _id: new mongoose.Types.ObjectId(), 
        email: 'other@test.com' 
      });
      const otherToken = generatePatientToken(otherPatient._id.toString());

      // Act
      const response = await request(app)
        .put(`/api/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send(updateData)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
    });

    it('should deny update for non-pending request (400)', async () => {
      // Arrange
      const processingRequest = await createTestRequest({ 
        userId: patient._id, 
        status: RequestStatus.PROCESSING 
      });

      // Act
      const response = await request(app)
        .put(`/api/requests/${processingRequest._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(updateData)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('pending');
    });

    it('should validate update data (400)', async () => {
      // Act
      const response = await request(app)
        .put(`/api/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ quantity: -5 })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/requests/:id/status', () => {
    let testRequest: any;
    const statusUpdateData = {
      status: RequestStatus.PROCESSING,
      notes: 'Processing your request'
    };

    beforeEach(async () => {
      testRequest = await createTestRequest({ status: RequestStatus.PENDING });
    });

    it('should update status for pharmacy staff (200)', async () => {
      // Act
      const response = await request(app)
        .patch(`/api/requests/${testRequest._id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(statusUpdateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(RequestStatus.PROCESSING);
      expect(response.body.data.notes).toBe('Processing your request');
    });

    it('should update status for admin (200)', async () => {
      // Act
      const response = await request(app)
        .patch(`/api/requests/${testRequest._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(statusUpdateData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(RequestStatus.PROCESSING);
    });

    it('should deny status update for patient (403)', async () => {
      // Act
      const response = await request(app)
        .patch(`/api/requests/${testRequest._id}/status`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send(statusUpdateData)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
    });

    it('should deny staff access to other pharmacy requests (403)', async () => {
      // Arrange
      const otherPharmacyId = new mongoose.Types.ObjectId();
      const otherStaff = await createPharmacyStaff({ 
        _id: new mongoose.Types.ObjectId(), 
        email: 'other@staff.com',
        pharmacyId: otherPharmacyId 
      });
      const otherStaffToken = generateStaffToken(otherStaff._id.toString());

      // Act
      const response = await request(app)
        .patch(`/api/requests/${testRequest._id}/status`)
        .set('Authorization', `Bearer ${otherStaffToken}`)
        .send(statusUpdateData)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
    });

    it('should validate status transition (400)', async () => {
      // Act
      const response = await request(app)
        .patch(`/api/requests/${testRequest._id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: RequestStatus.FULFILLED })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid status transition');
    });

    it('should validate status value (400)', async () => {
      // Act
      const response = await request(app)
        .patch(`/api/requests/${testRequest._id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'invalid' })
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/requests/:id', () => {
    let testRequest: any;

    beforeEach(async () => {
      testRequest = await createTestRequest({ 
        userId: patient._id, 
        status: RequestStatus.PENDING 
      });
    });

    it('should allow patient to cancel their own request (200)', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(RequestStatus.CANCELLED);
    });

    it('should allow staff to cancel any request (200)', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(RequestStatus.CANCELLED);
    });

    it('should allow admin to cancel any request (200)', async () => {
      // Act
      const response = await request(app)
        .delete(`/api/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(RequestStatus.CANCELLED);
    });

    it('should deny patient cancellation of other user\'s request (403)', async () => {
      // Arrange
      const otherPatient = await createTestUser({ 
        _id: new mongoose.Types.ObjectId(), 
        email: 'other@test.com' 
      });
      const otherToken = generatePatientToken(otherPatient._id.toString());

      // Act
      const response = await request(app)
        .delete(`/api/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      // Assert
      expect(response.body.success).toBe(false);
    });

    it('should deny cancellation of fulfilled request (400)', async () => {
      // Arrange
      const fulfilledRequest = await createTestRequest({ 
        userId: patient._id, 
        status: RequestStatus.FULFILLED 
      });

      // Act
      const response = await request(app)
        .delete(`/api/requests/${fulfilledRequest._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('fulfilled');
    });

    it('should deny cancellation of already cancelled request (400)', async () => {
      // Arrange
      const cancelledRequest = await createTestRequest({ 
        userId: patient._id, 
        status: RequestStatus.CANCELLED 
      });

      // Act
      const response = await request(app)
        .delete(`/api/requests/${cancelledRequest._id}`)
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('cancelled');
    });
  });
});
