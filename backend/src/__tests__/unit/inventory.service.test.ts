import mongoose from 'mongoose';
import { InventoryService } from '../../services/inventory.service';
import { Inventory, MedicationCategory, MedicationForm } from '../../models/inventory.model';
import { DrugValidationService } from '../../services/drug-validation.service';
import { ApiError } from '../../utils/api-error';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db.helper';
import { testIds, createTestInventory } from '../helpers/test-data.helper';

// Register the Pharmacy model schema so .populate('pharmacyId') works
import '../../models/pharmacy.model';

// Set environment to mock mode so DrugValidationService uses mock DB
process.env.RXNORM_API_BASE_URL = 'mock';

beforeAll(async () => {
    await connectTestDB();
});

afterAll(async () => {
    await disconnectTestDB();
});

afterEach(async () => {
    await clearTestDB();
    jest.restoreAllMocks();
});

// ─── CREATE ────────────────────────────────────────────────────────────────────

describe('InventoryService.create', () => {
    const validInput = {
        pharmacyId: testIds.pharmacyId.toString(),
        medicationName: 'Amoxicillin',
        quantity: 50,
        unitPrice: 12.5,
        category: MedicationCategory.PRESCRIPTION,
        dosage: '500mg',
        form: MedicationForm.CAPSULE,
        batchNumber: 'BATCH-2024-001',
        expiryDate: '2025-12-31T00:00:00.000Z',
        manufacturer: 'PharmaCorp',
        requiresPrescription: true,
        lowStockThreshold: 10,
    };

    it('should create an inventory item with valid data', async () => {
        const item = await InventoryService.create(validInput as any);

        expect(item).toBeDefined();
        expect(item.medicationName).toBe('Amoxicillin');
        expect(item.quantity).toBe(50);
        expect(item.unitPrice).toBe(12.5);
        expect(item.category).toBe(MedicationCategory.PRESCRIPTION);
        expect(item.requiresPrescription).toBe(true);
        expect(item.pharmacyId.toString()).toBe(testIds.pharmacyId.toString());
    });

    it('should auto-fill genericName from drug database when not provided', async () => {
        const input = { ...validInput };
        delete (input as any).genericName;

        const item = await InventoryService.create(input as any);

        expect(item.genericName).toBe('Amoxicillin'); // from mock DB fullGenericName
    });

    it('should use provided genericName when supplied', async () => {
        const item = await InventoryService.create({
            ...validInput,
            genericName: 'Custom Generic Name',
        } as any);

        expect(item.genericName).toBe('Custom Generic Name');
    });

    it('should validate medication name via DrugValidationService', async () => {
        const spy = jest.spyOn(DrugValidationService, 'validateAndGetDrugInfo');

        await InventoryService.create(validInput as any);

        expect(spy).toHaveBeenCalledWith('Amoxicillin');
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should throw conflict error for duplicate medication in same pharmacy', async () => {
        await InventoryService.create(validInput as any);

        await expect(InventoryService.create(validInput as any)).rejects.toThrow(
            /already exists in this pharmacy/
        );
    });

    it('should allow same medication name in different pharmacies', async () => {
        await InventoryService.create(validInput as any);

        const differentPharmacy = {
            ...validInput,
            pharmacyId: new mongoose.Types.ObjectId().toString(),
        };

        const item = await InventoryService.create(differentPharmacy as any);
        expect(item).toBeDefined();
        expect(item.medicationName).toBe('Amoxicillin');
    });

    it('should throw bad request for unrecognized medication name', async () => {
        const input = { ...validInput, medicationName: 'FakeDrugXYZ123' };

        await expect(InventoryService.create(input as any)).rejects.toThrow(
            /not found in the drug database/
        );
    });

    it('should convert expiryDate string to Date object', async () => {
        const item = await InventoryService.create(validInput as any);

        expect(item.expiryDate).toBeInstanceOf(Date);
        expect(item.expiryDate!.toISOString()).toBe('2025-12-31T00:00:00.000Z');
    });

    it('should handle creation without optional fields', async () => {
        const minInput = {
            pharmacyId: testIds.pharmacyId.toString(),
            medicationName: 'Ibuprofen',
            quantity: 10,
            unitPrice: 3.99,
        };

        const item = await InventoryService.create(minInput as any);

        expect(item).toBeDefined();
        expect(item.medicationName).toBe('Ibuprofen');
        expect(item.category).toBe(MedicationCategory.OTC); // default
        expect(item.lowStockThreshold).toBe(10); // default
        expect(item.requiresPrescription).toBe(false); // default
    });
});

// ─── GET ALL ───────────────────────────────────────────────────────────────────

describe('InventoryService.getAll', () => {
    const pharmacyId2 = new mongoose.Types.ObjectId();

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
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            pharmacyId: pharmacyId2,
            medicationName: 'Ibuprofen 200mg',
            category: MedicationCategory.OTC,
            quantity: 200,
            manufacturer: 'GenericPharma',
        });
    });

    it('should return paginated results', async () => {
        const result = await InventoryService.getAll({
            page: '1',
            limit: '10',
            sortBy: 'createdAt',
            sortOrder: 'desc',
        } as any);

        expect(result.items).toHaveLength(3);
        expect(result.pagination.total).toBe(3);
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.totalPages).toBe(1);
    });

    it('should respect pagination limits', async () => {
        const result = await InventoryService.getAll({
            page: '1',
            limit: '2',
            sortBy: 'createdAt',
            sortOrder: 'desc',
        } as any);

        expect(result.items).toHaveLength(2);
        expect(result.pagination.total).toBe(3);
        expect(result.pagination.totalPages).toBe(2);
    });

    it('should filter by pharmacyId', async () => {
        const result = await InventoryService.getAll({
            pharmacyId: testIds.pharmacyId.toString(),
            page: '1',
            limit: '10',
            sortBy: 'createdAt',
            sortOrder: 'desc',
        } as any);

        expect(result.items).toHaveLength(2);
    });

    it('should filter by category', async () => {
        const result = await InventoryService.getAll({
            category: MedicationCategory.PRESCRIPTION,
            page: '1',
            limit: '10',
            sortBy: 'createdAt',
            sortOrder: 'desc',
        } as any);

        expect(result.items).toHaveLength(1);
        expect(result.items[0].medicationName).toBe('Amoxicillin 250mg');
    });

    it('should filter by requiresPrescription', async () => {
        const result = await InventoryService.getAll({
            requiresPrescription: true,
            page: '1',
            limit: '10',
            sortBy: 'createdAt',
            sortOrder: 'desc',
        } as any);

        expect(result.items).toHaveLength(1);
        expect(result.items[0].requiresPrescription).toBe(true);
    });

    it('should search by medication name', async () => {
        const result = await InventoryService.getAll({
            search: 'Amoxicillin',
            page: '1',
            limit: '10',
            sortBy: 'createdAt',
            sortOrder: 'desc',
        } as any);

        expect(result.items).toHaveLength(1);
        expect(result.items[0].medicationName).toBe('Amoxicillin 250mg');
    });

    it('should search by manufacturer', async () => {
        const result = await InventoryService.getAll({
            search: 'MediLabs',
            page: '1',
            limit: '10',
            sortBy: 'createdAt',
            sortOrder: 'desc',
        } as any);

        expect(result.items).toHaveLength(1);
        expect(result.items[0].manufacturer).toBe('MediLabs');
    });

    it('should sort by quantity ascending', async () => {
        const result = await InventoryService.getAll({
            page: '1',
            limit: '10',
            sortBy: 'quantity',
            sortOrder: 'asc',
        } as any);

        expect(result.items[0].quantity).toBe(30);
        expect(result.items[2].quantity).toBe(200);
    });

    it('should return empty array for page beyond available data', async () => {
        const result = await InventoryService.getAll({
            page: '10',
            limit: '10',
            sortBy: 'createdAt',
            sortOrder: 'desc',
        } as any);

        expect(result.items).toHaveLength(0);
        expect(result.pagination.total).toBe(3);
    });
});

// ─── GET BY ID ─────────────────────────────────────────────────────────────────

describe('InventoryService.getById', () => {
    beforeEach(async () => {
        await createTestInventory();
    });

    it('should return an inventory item by valid ID', async () => {
        const item = await InventoryService.getById(testIds.inventoryId.toString());

        expect(item).toBeDefined();
        expect(item._id.toString()).toBe(testIds.inventoryId.toString());
        expect(item.medicationName).toBe('Paracetamol 500mg');
    });

    it('should throw NOT_FOUND for non-existent ID', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();

        await expect(InventoryService.getById(fakeId)).rejects.toThrow(
            'Inventory item not found'
        );
    });

    it('should throw BAD_REQUEST for invalid ObjectId format', async () => {
        await expect(InventoryService.getById('invalid-id')).rejects.toThrow(
            'Invalid inventory item ID'
        );
    });
});

// ─── UPDATE ────────────────────────────────────────────────────────────────────

describe('InventoryService.update', () => {
    beforeEach(async () => {
        await createTestInventory();
    });

    it('should update inventory item fields', async () => {
        const updated = await InventoryService.update(testIds.inventoryId.toString(), {
            quantity: 200,
            unitPrice: 8.99,
        } as any);

        expect(updated.quantity).toBe(200);
        expect(updated.unitPrice).toBe(8.99);
    });

    it('should re-validate drug name when medicationName is changed', async () => {
        const spy = jest.spyOn(DrugValidationService, 'validateAndGetDrugInfo');

        await InventoryService.update(testIds.inventoryId.toString(), {
            medicationName: 'Ibuprofen',
        } as any);

        expect(spy).toHaveBeenCalledWith('Ibuprofen');
    });

    it('should not re-validate drug name when medicationName is not changed', async () => {
        const spy = jest.spyOn(DrugValidationService, 'validateAndGetDrugInfo');

        await InventoryService.update(testIds.inventoryId.toString(), {
            quantity: 50,
        } as any);

        expect(spy).not.toHaveBeenCalled();
    });

    it('should convert expiryDate string to Date on update', async () => {
        const updated = await InventoryService.update(testIds.inventoryId.toString(), {
            expiryDate: '2026-06-30T00:00:00.000Z',
        } as any);

        expect(updated.expiryDate).toBeInstanceOf(Date);
    });

    it('should throw NOT_FOUND for non-existent item', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();

        await expect(
            InventoryService.update(fakeId, { quantity: 10 } as any)
        ).rejects.toThrow('Inventory item not found');
    });

    it('should throw BAD_REQUEST for invalid ObjectId', async () => {
        await expect(
            InventoryService.update('invalid-id', { quantity: 10 } as any)
        ).rejects.toThrow('Invalid inventory item ID');
    });

    it('should reject update if new medication name is not recognized', async () => {
        await expect(
            InventoryService.update(testIds.inventoryId.toString(), {
                medicationName: 'FakeUnknownDrug',
            } as any)
        ).rejects.toThrow(/not found in the drug database/);
    });
});

// ─── DELETE ────────────────────────────────────────────────────────────────────

describe('InventoryService.delete', () => {
    beforeEach(async () => {
        await createTestInventory();
    });

    it('should delete an inventory item and return it', async () => {
        const deleted = await InventoryService.delete(testIds.inventoryId.toString());

        expect(deleted).toBeDefined();
        expect(deleted._id.toString()).toBe(testIds.inventoryId.toString());

        // Verify it's actually gone
        const found = await Inventory.findById(testIds.inventoryId);
        expect(found).toBeNull();
    });

    it('should throw NOT_FOUND for non-existent item', async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();

        await expect(InventoryService.delete(fakeId)).rejects.toThrow(
            'Inventory item not found'
        );
    });

    it('should throw BAD_REQUEST for invalid ObjectId', async () => {
        await expect(InventoryService.delete('invalid-id')).rejects.toThrow(
            'Invalid inventory item ID'
        );
    });
});

// ─── GET LOW STOCK ─────────────────────────────────────────────────────────────

describe('InventoryService.getLowStock', () => {
    const pharmacyId2 = new mongoose.Types.ObjectId();

    beforeEach(async () => {
        // Low stock: quantity (5) <= lowStockThreshold (10)
        await createTestInventory({
            medicationName: 'Low Stock Med',
            quantity: 5,
            lowStockThreshold: 10,
        });
        // Exactly at threshold: quantity (10) <= lowStockThreshold (10)
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            medicationName: 'Threshold Med',
            quantity: 10,
            lowStockThreshold: 10,
        });
        // Above threshold: quantity (100) > lowStockThreshold (10) — NOT low stock
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            medicationName: 'Well Stocked Med',
            quantity: 100,
            lowStockThreshold: 10,
        });
        // Low stock in different pharmacy
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            pharmacyId: pharmacyId2,
            medicationName: 'Other Pharmacy Low',
            quantity: 2,
            lowStockThreshold: 15,
        });
    });

    it('should return items where quantity is at or below low stock threshold', async () => {
        const items = await InventoryService.getLowStock({});

        expect(items).toHaveLength(3); // 5<=10, 10<=10, 2<=15
    });

    it('should filter low stock items by pharmacyId', async () => {
        const items = await InventoryService.getLowStock({
            pharmacyId: testIds.pharmacyId.toString(),
        });

        expect(items).toHaveLength(2); // Only items from testIds.pharmacyId
    });

    it('should sort results by quantity ascending', async () => {
        const items = await InventoryService.getLowStock({});

        expect(items[0].quantity).toBeLessThanOrEqual(items[1].quantity);
    });

    it('should return empty array when no items are low stock', async () => {
        await clearTestDB();
        await createTestInventory({
            medicationName: 'Fully Stocked',
            quantity: 500,
            lowStockThreshold: 10,
        });

        const items = await InventoryService.getLowStock({});

        expect(items).toHaveLength(0);
    });
});

// ─── GET EXPIRING ──────────────────────────────────────────────────────────────

describe('InventoryService.getExpiring', () => {
    const pharmacyId2 = new mongoose.Types.ObjectId();

    beforeEach(async () => {
        const now = new Date();

        // Expiring in 10 days
        const in10Days = new Date();
        in10Days.setDate(now.getDate() + 10);
        await createTestInventory({
            medicationName: 'Expiring Soon',
            expiryDate: in10Days,
        });

        // Expiring in 25 days
        const in25Days = new Date();
        in25Days.setDate(now.getDate() + 25);
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            medicationName: 'Expiring Later',
            expiryDate: in25Days,
        });

        // Expiring in 60 days — outside default 30-day window
        const in60Days = new Date();
        in60Days.setDate(now.getDate() + 60);
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            medicationName: 'Not Expiring Soon',
            expiryDate: in60Days,
        });

        // Already expired — should NOT appear (expiryDate < now)
        const past = new Date();
        past.setDate(now.getDate() - 5);
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            medicationName: 'Already Expired',
            expiryDate: past,
        });

        // Expiring in 15 days — different pharmacy
        const in15Days = new Date();
        in15Days.setDate(now.getDate() + 15);
        await createTestInventory({
            _id: new mongoose.Types.ObjectId(),
            pharmacyId: pharmacyId2,
            medicationName: 'Other Pharmacy Expiring',
            expiryDate: in15Days,
        });
    });

    it('should return items expiring within default 30 days', async () => {
        const items = await InventoryService.getExpiring({ days: 30 });

        expect(items).toHaveLength(3); // 10d, 25d, 15d
        items.forEach((item: any) => {
            expect(item.medicationName).not.toBe('Not Expiring Soon');
            expect(item.medicationName).not.toBe('Already Expired');
        });
    });

    it('should respect custom days parameter', async () => {
        const items = await InventoryService.getExpiring({ days: 12 });

        expect(items).toHaveLength(1);
        expect(items[0].medicationName).toBe('Expiring Soon');
    });

    it('should filter expiring items by pharmacyId', async () => {
        const items = await InventoryService.getExpiring({
            days: 30,
            pharmacyId: testIds.pharmacyId.toString(),
        });

        expect(items).toHaveLength(2); // Only items from testIds.pharmacyId
    });

    it('should sort results by expiryDate ascending', async () => {
        const items = await InventoryService.getExpiring({ days: 30 });

        for (let i = 1; i < items.length; i++) {
            expect(new Date(items[i - 1].expiryDate!).getTime())
                .toBeLessThanOrEqual(new Date(items[i].expiryDate!).getTime());
        }
    });

    it('should return empty array when no items are expiring within window', async () => {
        const items = await InventoryService.getExpiring({ days: 1 });

        expect(items).toHaveLength(0);
    });
});
