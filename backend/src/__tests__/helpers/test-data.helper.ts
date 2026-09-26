import mongoose from 'mongoose';
import { User, UserRole } from '../../models/user.model';
import { MedicationRequest, RequestStatus, UrgencyLevel } from '../../models/request.model';
import { Inventory, MedicationCategory } from '../../models/inventory.model';
import { Order, OrderStatus, PaymentStatus, PaymentMethod } from '../../models/order.model';

export const testIds = {
  userId: new mongoose.Types.ObjectId(),
  pharmacyId: new mongoose.Types.ObjectId(),
  inventoryId: new mongoose.Types.ObjectId(),
  requestId: new mongoose.Types.ObjectId(),
  orderId: new mongoose.Types.ObjectId(),
  deliveryPartnerId: new mongoose.Types.ObjectId(),
};

export const createTestUser = async (overrides: Partial<Record<string, any>> = {}) => {
  return User.create({
    _id: testIds.userId,
    name: 'Test Patient',
    email: 'patient@test.com',
    password: 'Test@1234',
    role: UserRole.PATIENT,
    phone: '+94771234567',
    isActive: true,
    ...overrides,
  });
};

export const createPharmacyStaff = async (overrides: Partial<Record<string, any>> = {}) => {
  const id = new mongoose.Types.ObjectId();
  return User.create({
    _id: id,
    name: 'Pharmacy Staff',
    email: 'staff@pharmacy.com',
    password: 'Staff@1234',
    role: UserRole.PHARMACY_STAFF,
    phone: '+94779876543',
    isActive: true,
    ...overrides,
  });
};

export const createSystemAdmin = async (overrides: Partial<Record<string, any>> = {}) => {
  const id = new mongoose.Types.ObjectId();
  return User.create({
    _id: id,
    name: 'System Admin',
    email: 'admin@system.com',
    password: 'Admin@1234',
    role: UserRole.SYSTEM_ADMIN,
    phone: '+94770000000',
    isActive: true,
    ...overrides,
  });
};

export const createTestInventory = async (overrides: Partial<Record<string, any>> = {}) => {
  return Inventory.create({
    _id: testIds.inventoryId,
    pharmacyId: testIds.pharmacyId,
    medicationName: 'Paracetamol 500mg',
    category: MedicationCategory.OTC,
    quantity: 100,
    unitPrice: 5.99,
    requiresPrescription: false,
    lowStockThreshold: 10,
    ...overrides,
  });
};

export const createTestRequest = async (overrides: Partial<Record<string, any>> = {}) => {
  return MedicationRequest.create({
    _id: testIds.requestId,
    userId: testIds.userId,
    pharmacyId: testIds.pharmacyId,
    medicationName: 'Paracetamol 500mg',
    quantity: 2,
    urgencyLevel: UrgencyLevel.NORMAL,
    status: RequestStatus.AVAILABLE,
    prescriptionRequired: false,
    requestDate: new Date(),
    ...overrides,
  });
};

export const createTestOrder = async (overrides: Partial<Record<string, any>> = {}) => {
  return Order.create({
    _id: testIds.orderId,
    orderNumber: 'ORD-2026-000001',
    requestId: testIds.requestId,
    userId: testIds.userId,
    pharmacyId: testIds.pharmacyId,
    items: [
      {
        medicationId: testIds.inventoryId,
        name: 'Paracetamol 500mg',
        quantity: 2,
        unitPrice: 5.99,
        totalPrice: 11.98,
      },
    ],
    subtotal: 11.98,
    deliveryFee: 3.0,
    tax: 0.6,
    totalAmount: 15.58,
    deliveryAddress: {
      street: '123 Main Street',
      city: 'Colombo',
      postalCode: '10100',
      phoneNumber: '+94771234567',
    },
    status: OrderStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PENDING,
    paymentMethod: PaymentMethod.CARD,
    trackingUpdates: [
      {
        status: OrderStatus.CONFIRMED,
        timestamp: new Date(),
        notes: 'Order created from approved medication request',
      },
    ],
    ...overrides,
  });
};

export const validCreateOrderData = {
  requestId: testIds.requestId.toString(),
  items: [
    {
      medicationId: testIds.inventoryId.toString(),
      name: 'Paracetamol 500mg',
      quantity: 2,
      unitPrice: 5.99,
    },
  ],
  deliveryAddress: {
    street: '123 Main Street',
    city: 'Colombo',
    postalCode: '10100',
    phoneNumber: '+94771234567',
  },
  deliveryFee: 3.0,
  paymentMethod: 'card',
};
