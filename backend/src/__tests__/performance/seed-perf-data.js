/**
 * Seed script for Artillery performance testing.
 *
 * Usage:
 *   1. Make sure MongoDB is running and MONGODB_URI is set in .env
 *   2. Run: node src/__tests__/performance/seed-perf-data.js
 *   3. Copy the printed env vars and export them before running Artillery
 *
 * This script creates:
 *   - A patient user + JWT
 *   - A pharmacy staff user + JWT
 *   - An inventory item
 *   - A medication request (status: fulfilled)
 *   - An order
 */

require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_ACCESS_SECRET;

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;

  const hashedPassword = await bcrypt.hash('Test@1234', 10);
  const pharmacyId = new mongoose.Types.ObjectId();

  // Create patient
  const patientResult = await db.collection('users').insertOne({
    name: 'Perf Test Patient',
    email: `perf-patient-${Date.now()}@test.com`,
    password: hashedPassword,
    role: 'Patient',
    phone: '+94771234567',
    isActive: true,
    isEmailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const patientId = patientResult.insertedId;

  // Create staff
  const staffResult = await db.collection('users').insertOne({
    name: 'Perf Test Staff',
    email: `perf-staff-${Date.now()}@test.com`,
    password: hashedPassword,
    role: 'Pharmacy Staff',
    phone: '+94779876543',
    isActive: true,
    isEmailVerified: false,
    pharmacyId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const staffId = staffResult.insertedId;

  // Create inventory
  const inventoryResult = await db.collection('inventories').insertOne({
    pharmacyId,
    medicationName: 'Perf Test Medication',
    category: 'otc',
    quantity: 10000,
    unitPrice: 5.99,
    requiresPrescription: false,
    lowStockThreshold: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const inventoryId = inventoryResult.insertedId;

  // Create request
  const requestResult = await db.collection('requests').insertOne({
    userId: patientId,
    pharmacyId,
    medicationName: 'Perf Test Medication',
    quantity: 2,
    urgencyLevel: 'normal',
    status: 'fulfilled',
    prescriptionRequired: false,
    requestDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const requestId = requestResult.insertedId;

  // Create additional request for testing various endpoints
  const pendingRequestResult = await db.collection('requests').insertOne({
    userId: patientId,
    pharmacyId,
    medicationName: 'Perf Test Pending Medication',
    quantity: 1,
    urgencyLevel: 'urgent',
    status: 'pending',
    prescriptionRequired: false,
    requestDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const pendingRequestId = pendingRequestResult.insertedId;

  // Create additional inventory items for performance testing
  // Low stock item
  await db.collection('inventories').insertOne({
    pharmacyId,
    medicationName: 'Perf Low Stock Medication',
    category: 'prescription',
    quantity: 3,
    unitPrice: 15.99,
    requiresPrescription: true,
    lowStockThreshold: 20,
    manufacturer: 'PerfTest Labs',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Near-expiry item
  const nearExpiry = new Date();
  nearExpiry.setDate(nearExpiry.getDate() + 15);
  await db.collection('inventories').insertOne({
    pharmacyId,
    medicationName: 'Perf Expiring Medication',
    category: 'otc',
    quantity: 50,
    unitPrice: 8.50,
    requiresPrescription: false,
    lowStockThreshold: 10,
    expiryDate: nearExpiry,
    manufacturer: 'PerfTest Labs',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Create order
  const orderResult = await db.collection('orders').insertOne({
    orderNumber: `ORD-PERF-${Date.now()}`,
    requestId,
    userId: patientId,
    pharmacyId,
    items: [
      {
        medicationId: inventoryId,
        name: 'Perf Test Medication',
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
      street: '123 Perf Street',
      city: 'Colombo',
      postalCode: '10100',
      phoneNumber: '+94771234567',
    },
    status: 'confirmed',
    paymentStatus: 'pending',
    paymentMethod: 'card',
    trackingUpdates: [
      {
        status: 'confirmed',
        timestamp: new Date(),
        notes: 'Performance test order',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const orderId = orderResult.insertedId;

  // Generate JWTs
  const patientToken = jwt.sign(
    { userId: patientId.toString(), role: 'Patient' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );
  const staffToken = jwt.sign(
    { userId: staffId.toString(), role: 'Pharmacy Staff' },
    JWT_SECRET,
    { expiresIn: '2h' }
  );

  console.log('\n========== PERFORMANCE TEST ENVIRONMENT VARIABLES ==========');
  console.log(`export PERF_PATIENT_TOKEN="${patientToken}"`);
  console.log(`export PERF_STAFF_TOKEN="${staffToken}"`);
  console.log(`export PERF_ORDER_ID="${orderId}"`);
  console.log(`export PERF_REQUEST_ID="${requestId}"`);
  console.log(`export PERF_PENDING_REQUEST_ID="${pendingRequestId}"`);
  console.log(`export PERF_USER_ID="${patientId}"`);
  console.log(`export PERF_PHARMACY_ID="${pharmacyId}"`);
  console.log(`export PERF_INVENTORY_ID="${inventoryId}"`);
  console.log('============================================================\n');

  await mongoose.disconnect();
  console.log('Seed data created successfully. Export variables above, then run:');
  console.log('  npx artillery run src/__tests__/performance/order.perf.yml');
  console.log('  npx artillery run src/__tests__/performance/request.perf.yml\n');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
