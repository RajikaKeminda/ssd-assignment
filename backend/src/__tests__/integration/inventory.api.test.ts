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
    createPharmacyStaff,
    createSystemAdmin,
} from '../helpers/test-data.helper';
import { MedicationCategory } from '../../models/inventory.model';
import { Inventory } from '../../models/inventory.model';

let app: Express;
let patientToken: string;
let staffToken: string;
let adminToken: string;
let staffUser: any;
let adminUser: any;

const validCreateData = {
    pharmacyId: testIds.pharmacyId.toString(),
    medicationName: 'Amoxicillin',
    quantity: 50,
    unitPrice: 12.5,
    category: 'prescription',
    dosage: '500mg',
    form: 'capsule',
    batchNumber: 'BATCH-2024-001',
    expiryDate: '2025-12-31T00:00:00.000Z',
    manufacturer: 'PharmaCorp',
    requiresPrescription: true,
    lowStockThreshold: 10,
};

beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-jwt-secret-key';
    process.env.NODE_ENV = 'test';
    process.env.RXNORM_API_BASE_URL = 'mock';
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
});

// ─── POST /api/inventory — CREATE INVENTORY ITEM ──────────────────────────────

describe('POST /api/inventory', () => {
    it('should create an inventory item with valid data and staff token (201)', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send(validCreateData);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.medicationName).toBe('Amoxicillin');
        expect(res.body.data.quantity).toBe(50);
        expect(res.body.data.unitPrice).toBe(12.5);
        expect(res.body.message).toBe('Inventory item created successfully');
    });

    it('should create an inventory item with admin token (201)', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${adminToken}`)
            .send(validCreateData);

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    it('should return 401 without auth token', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .send(validCreateData);

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('should return 403 for Patient role', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${patientToken}`)
            .send(validCreateData);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 with missing required fields', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 with missing pharmacyId', async () => {
        const { pharmacyId, ...noPharmacy } = validCreateData;
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send(noPharmacy);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 with invalid pharmacyId format', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ ...validCreateData, pharmacyId: 'not-valid-id' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 with negative quantity', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ ...validCreateData, quantity: -5 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 with negative unit price', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ ...validCreateData, unitPrice: -1 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 for unrecognized medication name', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ ...validCreateData, medicationName: 'FakeDrugXYZ123' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 409 for duplicate medication in same pharmacy', async () => {
        // Create first
        await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send(validCreateData);

        // Attempt duplicate
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send(validCreateData);

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 with invalid category enum', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ ...validCreateData, category: 'invalid_category' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 with invalid form enum', async () => {
        const res = await request(app)
            .post('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ ...validCreateData, form: 'invalid_form' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});

// ─── GET /api/inventory — LIST ALL INVENTORY ITEMS ────────────────────────────

describe('GET /api/inventory', () => {
    beforeEach(async () => {
        await createTestInventory({
            medicationName: 'Paracetamol 500mg',
            category: MedicationCategory.OTC,
            quantity: 100,
            manufacturer: 'PharmaCorp',
        });
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            medicationName: 'Amoxicillin 250mg',
            category: MedicationCategory.PRESCRIPTION,
            quantity: 30,
            requiresPrescription: true,
            manufacturer: 'MediLabs',
        });
    });

    it('should return inventory items for authenticated user (200)', async () => {
        const res = await request(app)
            .get('/api/inventory')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.items).toHaveLength(2);
        expect(res.body.data.pagination).toBeDefined();
        expect(res.body.data.pagination.total).toBe(2);
    });

    it('should return 401 without auth token', async () => {
        const res = await request(app).get('/api/inventory');

        expect(res.status).toBe(401);
    });

    it('should filter by category', async () => {
        const res = await request(app)
            .get('/api/inventory?category=prescription')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0].category).toBe('prescription');
    });

    it('should filter by pharmacyId', async () => {
        const res = await request(app)
            .get(`/api/inventory?pharmacyId=${testIds.pharmacyId}`)
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(2);
    });

    it('should search by medication name', async () => {
        const res = await request(app)
            .get('/api/inventory?search=Amoxicillin')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0].medicationName).toBe('Amoxicillin 250mg');
    });

    it('should respect pagination query params', async () => {
        const res = await request(app)
            .get('/api/inventory?page=1&limit=1')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.pagination.totalPages).toBe(2);
    });

    it('should filter by requiresPrescription', async () => {
        const res = await request(app)
            .get('/api/inventory?requiresPrescription=true')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
    });
});

// ─── GET /api/inventory/low-stock — LOW STOCK ITEMS ───────────────────────────

describe('GET /api/inventory/low-stock', () => {
    beforeEach(async () => {
        // Low stock item
        await createTestInventory({
            medicationName: 'Low Stock Med',
            quantity: 5,
            lowStockThreshold: 10,
        });
        // Well stocked item
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            medicationName: 'Well Stocked Med',
            quantity: 100,
            lowStockThreshold: 10,
        });
    });

    it('should return low-stock items (200)', async () => {
        const res = await request(app)
            .get('/api/inventory/low-stock')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].medicationName).toBe('Low Stock Med');
    });

    it('should filter low-stock items by pharmacyId', async () => {
        const otherPharmacyId = new mongoose.Types.ObjectId();
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            pharmacyId: otherPharmacyId,
            medicationName: 'Other Low Stock',
            quantity: 1,
            lowStockThreshold: 20,
        });

        const res = await request(app)
            .get(`/api/inventory/low-stock?pharmacyId=${otherPharmacyId}`)
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].medicationName).toBe('Other Low Stock');
    });

    it('should return 401 without auth token', async () => {
        const res = await request(app).get('/api/inventory/low-stock');

        expect(res.status).toBe(401);
    });
});

// ─── GET /api/inventory/expiring — EXPIRING ITEMS ─────────────────────────────

describe('GET /api/inventory/expiring', () => {
    beforeEach(async () => {
        const now = new Date();

        const in10Days = new Date();
        in10Days.setDate(now.getDate() + 10);
        await createTestInventory({
            medicationName: 'Expiring Soon',
            expiryDate: in10Days,
        });

        const in60Days = new Date();
        in60Days.setDate(now.getDate() + 60);
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            medicationName: 'Not Expiring Soon',
            expiryDate: in60Days,
        });
    });

    it('should return expiring items sorted by expiry date (200)', async () => {
        const res = await request(app)
            .get('/api/inventory/expiring?days=30')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        // Items should be sorted by expiryDate ascending
        if (res.body.data.length > 1) {
            const dates = res.body.data.map((item: any) => new Date(item.expiryDate).getTime());
            for (let i = 1; i < dates.length; i++) {
                expect(dates[i - 1]).toBeLessThanOrEqual(dates[i]);
            }
        }
    });

    it('should respect custom days parameter', async () => {
        const res = await request(app)
            .get('/api/inventory/expiring?days=90')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(2);
    });

    it('should filter by pharmacyId', async () => {
        const otherPharmacyId = new mongoose.Types.ObjectId();
        const in5Days = new Date();
        in5Days.setDate(new Date().getDate() + 5);
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            pharmacyId: otherPharmacyId,
            medicationName: 'Other Expiring',
            expiryDate: in5Days,
        });

        const res = await request(app)
            .get(`/api/inventory/expiring?days=30&pharmacyId=${otherPharmacyId}`)
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].medicationName).toBe('Other Expiring');
    });

    it('should return 401 without auth token', async () => {
        const res = await request(app).get('/api/inventory/expiring');

        expect(res.status).toBe(401);
    });
});

// ─── GET /api/inventory/:id — GET BY ID ───────────────────────────────────────

describe('GET /api/inventory/:id', () => {
    beforeEach(async () => {
        await createTestInventory();
    });

    it('should return a specific inventory item (200)', async () => {
        const res = await request(app)
            .get(`/api/inventory/${testIds.inventoryId}`)
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.medicationName).toBe('Paracetamol 500mg');
    });

    it('should return 404 for non-existent item', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .get(`/api/inventory/${fakeId}`)
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid ID format', async () => {
        const res = await request(app)
            .get('/api/inventory/invalid-id')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 401 without auth token', async () => {
        const res = await request(app)
            .get(`/api/inventory/${testIds.inventoryId}`);

        expect(res.status).toBe(401);
    });
});

// ─── PUT /api/inventory/:id — UPDATE INVENTORY ITEM ───────────────────────────

describe('PUT /api/inventory/:id', () => {
    beforeEach(async () => {
        await createTestInventory();
    });

    it('should update an inventory item with staff token (200)', async () => {
        const res = await request(app)
            .put(`/api/inventory/${testIds.inventoryId}`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ quantity: 200, unitPrice: 8.99 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.quantity).toBe(200);
        expect(res.body.data.unitPrice).toBe(8.99);
    });

    it('should update with admin token (200)', async () => {
        const res = await request(app)
            .put(`/api/inventory/${testIds.inventoryId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ quantity: 150 });

        expect(res.status).toBe(200);
        expect(res.body.data.quantity).toBe(150);
    });

    it('should return 403 for Patient role', async () => {
        const res = await request(app)
            .put(`/api/inventory/${testIds.inventoryId}`)
            .set('Authorization', `Bearer ${patientToken}`)
            .send({ quantity: 50 });

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it('should return 401 without auth token', async () => {
        const res = await request(app)
            .put(`/api/inventory/${testIds.inventoryId}`)
            .send({ quantity: 50 });

        expect(res.status).toBe(401);
    });

    it('should return 400 with empty update body', async () => {
        const res = await request(app)
            .put(`/api/inventory/${testIds.inventoryId}`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent item', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .put(`/api/inventory/${fakeId}`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ quantity: 10 });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid ID format', async () => {
        const res = await request(app)
            .put('/api/inventory/invalid-id')
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ quantity: 10 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 with negative quantity', async () => {
        const res = await request(app)
            .put(`/api/inventory/${testIds.inventoryId}`)
            .set('Authorization', `Bearer ${staffToken}`)
            .send({ quantity: -5 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});

// ─── DELETE /api/inventory/:id — DELETE INVENTORY ITEM ────────────────────────

describe('DELETE /api/inventory/:id', () => {
    beforeEach(async () => {
        await createTestInventory();
    });

    it('should delete an inventory item with staff token (200)', async () => {
        const res = await request(app)
            .delete(`/api/inventory/${testIds.inventoryId}`)
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Inventory item deleted successfully');

        // Verify it's gone
        const found = await Inventory.findById(testIds.inventoryId);
        expect(found).toBeNull();
    });

    it('should delete with admin token (200)', async () => {
        const res = await request(app)
            .delete(`/api/inventory/${testIds.inventoryId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
    });

    it('should return 403 for Patient role', async () => {
        const res = await request(app)
            .delete(`/api/inventory/${testIds.inventoryId}`)
            .set('Authorization', `Bearer ${patientToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
    });

    it('should return 401 without auth token', async () => {
        const res = await request(app)
            .delete(`/api/inventory/${testIds.inventoryId}`);

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent item', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
            .delete(`/api/inventory/${fakeId}`)
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid ID format', async () => {
        const res = await request(app)
            .delete('/api/inventory/invalid-id')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });
});

// ─── RESPONSE FORMAT VALIDATION ────────────────────────────────────────────────

describe('API Response Format', () => {
    beforeEach(async () => {
        await createTestInventory();
    });

    it('should return standard success response format', async () => {
        const res = await request(app)
            .get(`/api/inventory/${testIds.inventoryId}`)
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('data');
    });

    it('should return standard error response format', async () => {
        const res = await request(app)
            .get('/api/inventory/invalid-id')
            .set('Authorization', `Bearer ${staffToken}`);

        expect(res.body).toHaveProperty('success', false);
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code');
        expect(res.body.error).toHaveProperty('message');
    });
});
