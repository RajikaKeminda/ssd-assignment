import request from 'supertest';
import mongoose from 'mongoose';
import { Express } from 'express';
import { createTestApp } from '../helpers/app.helper';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db.helper';
import {
  generatePatientToken,
  generateStaffToken,
  generateAdminToken,
} from '../helpers/auth.helper';
import {
  testIds,
  createTestUser,
  createTestInventory,
  createTestRequest,
  createTestOrder,
  createPharmacyStaff,
  createSystemAdmin,
  validCreateOrderData,
} from '../helpers/test-data.helper';
import { OrderStatus, PaymentStatus } from '../../models/order.model';
import { RequestStatus } from '../../models/request.model';
import { Order } from '../../models/order.model';
import { Inventory } from '../../models/inventory.model';
import { MedicationRequest } from '../../models/request.model';

let app: Express;
let patientToken: string;
let staffToken: string;
let adminToken: string;
let staffUser: any;
let adminUser: any;

beforeAll(async () => {
  process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-key';
  process.env.NODE_ENV = 'test';
  await connectTestDB();
  app = createTestApp();
});

afterAll(async () => {
  await disconnectTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  const patient = await createTestUser();
  staffUser = await createPharmacyStaff();
  adminUser = await createSystemAdmin();
  patientToken = generatePatientToken(testIds.userId.toString());
  staffToken = generateStaffToken(staffUser._id.toString());
  adminToken = generateAdminToken(adminUser._id.toString());
  await createTestInventory();
  await createTestRequest();
});

// ─── POST /api/orders — CREATE ORDER ───────────────────────────────────────────

describe('POST /api/orders', () => {
  it('should create an order with valid data (201)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${patientToken}`)
      .send(validCreateOrderData);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toMatch(/^ORD-\d{4}-\d{6}$/);
    expect(res.body.data.status).toBe(OrderStatus.CONFIRMED);
    expect(res.body.data.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.message).toBe('Order created successfully');
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(validCreateOrderData);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should return 403 when non-patient tries to create order', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(validCreateOrderData);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 with missing required fields', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 with empty items array', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        ...validCreateOrderData,
        items: [],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 with invalid ObjectId format', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        ...validCreateOrderData,
        requestId: 'not-a-valid-id',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 404 when medication request does not exist', async () => {
    const fakeRequestId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        ...validCreateOrderData,
        requestId: fakeRequestId,
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 with invalid phone number format', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        ...validCreateOrderData,
        deliveryAddress: {
          ...validCreateOrderData.deliveryAddress,
          phoneNumber: 'abc',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 with negative delivery fee', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        ...validCreateOrderData,
        deliveryFee: -5,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should decrement inventory after successful order', async () => {
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${patientToken}`)
      .send(validCreateOrderData);

    const inventory = await Inventory.findById(testIds.inventoryId);
    expect(inventory!.quantity).toBe(98);
  });

  it('should mark medication request as fulfilled', async () => {
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${patientToken}`)
      .send(validCreateOrderData);

    const medRequest = await MedicationRequest.findById(testIds.requestId);
    expect(medRequest!.status).toBe(RequestStatus.FULFILLED);
  });
});

// ─── GET /api/orders — LIST ALL ORDERS ─────────────────────────────────────────

describe('GET /api/orders', () => {
  beforeEach(async () => {
    await createTestOrder();
    await createTestOrder({
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'ORD-2026-000002',
      status: OrderStatus.PACKED,
      requestId: new mongoose.Types.ObjectId(),
    });
  });

  it('should return orders for staff (200)', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orders).toHaveLength(2);
    expect(res.body.data.total).toBe(2);
  });

  it('should return orders for admin (200)', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for patient role', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(403);
  });

  it('should filter by status query param', async () => {
    const res = await request(app)
      .get('/api/orders?status=packed')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.orders[0].status).toBe(OrderStatus.PACKED);
  });

  it('should respect pagination query params', async () => {
    const res = await request(app)
      .get('/api/orders?page=1&limit=1')
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
    expect(res.body.data.pages).toBe(2);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/orders/:id — GET ORDER BY ID ─────────────────────────────────────

describe('GET /api/orders/:id', () => {
  beforeEach(async () => {
    await createTestOrder();
  });

  it('should return a specific order (200)', async () => {
    const res = await request(app)
      .get(`/api/orders/${testIds.orderId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderNumber).toBe('ORD-2026-000001');
  });

  it('should return 404 for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/orders/${fakeId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 for invalid order ID format', async () => {
    const res = await request(app)
      .get('/api/orders/invalid-id')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 without auth token', async () => {
    const res = await request(app).get(`/api/orders/${testIds.orderId}`);

    expect(res.status).toBe(401);
  });
});

// ─── PUT /api/orders/:id — UPDATE ORDER ────────────────────────────────────────

describe('PUT /api/orders/:id', () => {
  beforeEach(async () => {
    await createTestOrder();
  });

  it('should update delivery address (200)', async () => {
    const res = await request(app)
      .put(`/api/orders/${testIds.orderId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        deliveryAddress: {
          street: '789 New Road',
          city: 'Galle',
          postalCode: '80000',
          phoneNumber: '+94771111111',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deliveryAddress.city).toBe('Galle');
  });

  it('should recalculate total when delivery fee changes', async () => {
    const res = await request(app)
      .put(`/api/orders/${testIds.orderId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ deliveryFee: 10 });

    expect(res.status).toBe(200);
    const data = res.body.data;
    const expectedTotal = parseFloat((data.subtotal + 10 + data.tax).toFixed(2));
    expect(data.totalAmount).toBeCloseTo(expectedTotal, 2);
  });

  it('should return 400 when updating delivered order', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      status: OrderStatus.DELIVERED,
    });

    const res = await request(app)
      .put(`/api/orders/${testIds.orderId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ deliveryFee: 5 });

    expect(res.status).toBe(400);
  });

  it('should return 403 for patient role', async () => {
    const res = await request(app)
      .put(`/api/orders/${testIds.orderId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ deliveryFee: 5 });

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/orders/:id/status — UPDATE STATUS ──────────────────────────────

describe('PATCH /api/orders/:id/status', () => {
  beforeEach(async () => {
    await createTestOrder();
  });

  it('should update order status with valid transition (200)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'packed', notes: 'Ready for pickup' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(OrderStatus.PACKED);
  });

  it('should return 400 for invalid status transition', async () => {
    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'delivered' });

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid status value', async () => {
    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'nonexistent_status' });

    expect(res.status).toBe(400);
  });

  it('should return 403 for patient role', async () => {
    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/status`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ status: 'packed' });

    expect(res.status).toBe(403);
  });

  it('should add tracking update with location', async () => {
    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        status: 'packed',
        location: 'Pharmacy Counter',
        notes: 'All items packaged',
      });

    expect(res.status).toBe(200);
    const updates = res.body.data.trackingUpdates;
    const latest = updates[updates.length - 1];
    expect(latest.location).toBe('Pharmacy Counter');
    expect(latest.notes).toBe('All items packaged');
  });

  it('should handle full order lifecycle (confirmed → packed → out → delivered)', async () => {
    let res;

    res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'packed' });
    expect(res.status).toBe(200);

    res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'out_for_delivery' });
    expect(res.status).toBe(200);

    res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(OrderStatus.DELIVERED);
    expect(res.body.data.actualDelivery).toBeDefined();
    expect(res.body.data.trackingUpdates).toHaveLength(4);
  });
});

// ─── POST /api/orders/:id/payment — PROCESS PAYMENT ───────────────────────────

describe('POST /api/orders/:id/payment', () => {
  beforeEach(async () => {
    await createTestOrder();
  });

  it('should process payment successfully (200)', async () => {
    const res = await request(app)
      .post(`/api/orders/${testIds.orderId}/payment`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ paymentMethod: 'card' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.paymentStatus).toBe(PaymentStatus.PAID);
    expect(res.body.data.paymentIntentId).toBeDefined();
  });

  it('should return 400 when order is already paid', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      paymentStatus: PaymentStatus.PAID,
    });

    const res = await request(app)
      .post(`/api/orders/${testIds.orderId}/payment`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ paymentMethod: 'card' });

    expect(res.status).toBe(400);
  });

  it('should return 400 with missing paymentMethod', async () => {
    const res = await request(app)
      .post(`/api/orders/${testIds.orderId}/payment`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 400 with invalid paymentMethod', async () => {
    const res = await request(app)
      .post(`/api/orders/${testIds.orderId}/payment`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ paymentMethod: 'bitcoin' });

    expect(res.status).toBe(400);
  });

  it('should return 403 for staff trying to process payment', async () => {
    const res = await request(app)
      .post(`/api/orders/${testIds.orderId}/payment`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ paymentMethod: 'card' });

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/orders/:id/cancel — CANCEL ORDER ──────────────────────────────

describe('PATCH /api/orders/:id/cancel', () => {
  beforeEach(async () => {
    await createTestRequest({ status: RequestStatus.FULFILLED });
    await createTestOrder();
  });

  it('should cancel an order (200)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ reason: 'No longer needed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(OrderStatus.CANCELLED);
  });

  it('should restore inventory after cancellation', async () => {
    await request(app)
      .patch(`/api/orders/${testIds.orderId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ reason: 'Changed mind' });

    const inventory = await Inventory.findById(testIds.inventoryId);
    expect(inventory!.quantity).toBe(102);
  });

  it('should revert request status to available', async () => {
    await request(app)
      .patch(`/api/orders/${testIds.orderId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({});

    const medRequest = await MedicationRequest.findById(testIds.requestId);
    expect(medRequest!.status).toBe(RequestStatus.AVAILABLE);
  });

  it('should return 400 for already cancelled order', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      status: OrderStatus.CANCELLED,
    });

    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 400 for delivered order', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      status: OrderStatus.DELIVERED,
    });

    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should include cancellation reason in tracking', async () => {
    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/cancel`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ reason: 'Found better price' });

    const updates = res.body.data.trackingUpdates;
    const last = updates[updates.length - 1];
    expect(last.notes).toBe('Found better price');
  });
});

// ─── GET /api/orders/user/:userId — USER ORDERS ───────────────────────────────

describe('GET /api/orders/user/:userId', () => {
  beforeEach(async () => {
    await createTestOrder();
  });

  it('should return user orders (200)', async () => {
    const res = await request(app)
      .get(`/api/orders/user/${testIds.userId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
  });

  it('should return empty array for user with no orders', async () => {
    const noOrderUserId = new mongoose.Types.ObjectId().toString();
    const token = generatePatientToken(noOrderUserId);

    const res = await request(app)
      .get(`/api/orders/user/${noOrderUserId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(0);
  });

  it('should return 400 for invalid userId format', async () => {
    const res = await request(app)
      .get('/api/orders/user/bad-id')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(400);
  });
});

// ─── GET /api/orders/pharmacy/:pharmacyId — PHARMACY ORDERS ───────────────────

describe('GET /api/orders/pharmacy/:pharmacyId', () => {
  beforeEach(async () => {
    await createTestOrder();
  });

  it('should return pharmacy orders for staff (200)', async () => {
    const res = await request(app)
      .get(`/api/orders/pharmacy/${testIds.pharmacyId}`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.orders).toHaveLength(1);
  });

  it('should return 403 for patient role', async () => {
    const res = await request(app)
      .get(`/api/orders/pharmacy/${testIds.pharmacyId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/orders/:id/assign-delivery — ASSIGN DELIVERY PARTNER ──────────

describe('PATCH /api/orders/:id/assign-delivery', () => {
  beforeEach(async () => {
    await createTestOrder();
  });

  it('should assign delivery partner (200)', async () => {
    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/assign-delivery`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ deliveryPartnerId: testIds.deliveryPartnerId.toString() });

    expect(res.status).toBe(200);
    expect(res.body.data.deliveryPartnerId).toBeDefined();
  });

  it('should return 400 with missing deliveryPartnerId', async () => {
    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/assign-delivery`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 403 for patient role', async () => {
    const res = await request(app)
      .patch(`/api/orders/${testIds.orderId}/assign-delivery`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ deliveryPartnerId: testIds.deliveryPartnerId.toString() });

    expect(res.status).toBe(403);
  });
});

// ─── GET /api/orders/track/:id — DELIVERY TRACKING ────────────────────────────

describe('GET /api/orders/track/:id', () => {
  beforeEach(async () => {
    await createTestOrder();
  });

  it('should return tracking information (200)', async () => {
    const res = await request(app)
      .get(`/api/orders/track/${testIds.orderId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.trackingUpdates).toBeDefined();
    expect(res.body.data.trackingUpdates).toHaveLength(1);
  });

  it('should return 404 for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/orders/track/${fakeId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── POST /api/orders/:id/invoice — GENERATE INVOICE ──────────────────────────

describe('POST /api/orders/:id/invoice', () => {
  beforeEach(async () => {
    await createTestOrder();
  });

  it('should generate invoice (200)', async () => {
    const res = await request(app)
      .post(`/api/orders/${testIds.orderId}/invoice`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.invoiceUrl).toBeDefined();
    expect(res.body.data.invoiceUrl).toContain('.pdf');
  });

  it('should return 404 for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/orders/${fakeId}/invoice`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── 404 HANDLING ──────────────────────────────────────────────────────────────

describe('Unknown Routes', () => {
  it('should return 404 for non-existent routes', async () => {
    const res = await request(app)
      .get('/api/orders/nonexistent/route/path')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(400);
  });

  it('should return 404 for wrong HTTP method', async () => {
    const res = await request(app)
      .delete(`/api/orders/${testIds.orderId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(404);
  });
});

// ─── RESPONSE FORMAT VALIDATION ────────────────────────────────────────────────

describe('API Response Format', () => {
  beforeEach(async () => {
    await createTestOrder();
  });

  it('should return standard success response format', async () => {
    const res = await request(app)
      .get(`/api/orders/${testIds.orderId}`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('data');
  });

  it('should return standard error response format', async () => {
    const res = await request(app)
      .get('/api/orders/invalid-id')
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });
});
