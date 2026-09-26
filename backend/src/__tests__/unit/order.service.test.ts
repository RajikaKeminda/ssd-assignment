import mongoose from 'mongoose';
import { OrderService } from '../../services/order.service';
import { Order, OrderStatus, PaymentStatus, PaymentMethod } from '../../models/order.model';
import { MedicationRequest, RequestStatus } from '../../models/request.model';
import { Inventory } from '../../models/inventory.model';
import '../../models/pharmacy.model'; // Register Pharmacy schema for populate()
import { StripeService } from '../../services/stripe.service';
import { ApiError } from '../../utils/api-error';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/db.helper';
import {
  testIds,
  createTestUser,
  createTestInventory,
  createTestRequest,
  createTestOrder,
  validCreateOrderData,
} from '../helpers/test-data.helper';

beforeAll(async () => {
  await connectTestDB();
});

afterAll(async () => {
  await disconnectTestDB();
});

afterEach(async () => {
  await clearTestDB();
});

// ─── CREATE ORDER ──────────────────────────────────────────────────────────────

describe('OrderService.createOrder', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
  });

  it('should create an order from an approved medication request', async () => {
    const order = await OrderService.createOrder(
      validCreateOrderData as any,
      testIds.userId.toString()
    );

    expect(order).toBeDefined();
    expect(order.orderNumber).toMatch(/^ORD-\d{4}-\d{6}$/);
    expect(order.status).toBe(OrderStatus.CONFIRMED);
    expect(order.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(order.items).toHaveLength(1);
    expect(order.items[0].name).toBe('Paracetamol 500mg');
    expect(order.items[0].quantity).toBe(2);
    expect(order.subtotal).toBe(11.98);
    expect(order.tax).toBeCloseTo(0.6, 1);
    expect(order.trackingUpdates).toHaveLength(1);
    expect(order.trackingUpdates[0].status).toBe(OrderStatus.CONFIRMED);
  });

  it('should decrement inventory stock after order creation', async () => {
    await OrderService.createOrder(
      validCreateOrderData as any,
      testIds.userId.toString()
    );

    const inventory = await Inventory.findById(testIds.inventoryId);
    expect(inventory!.quantity).toBe(98); // was 100, ordered 2
  });

  it('should mark the medication request as fulfilled', async () => {
    await OrderService.createOrder(
      validCreateOrderData as any,
      testIds.userId.toString()
    );

    const request = await MedicationRequest.findById(testIds.requestId);
    expect(request!.status).toBe(RequestStatus.FULFILLED);
  });

  it('should throw NOT_FOUND if medication request does not exist', async () => {
    const fakeRequestId = new mongoose.Types.ObjectId().toString();
    const data = { ...validCreateOrderData, requestId: fakeRequestId };

    await expect(
      OrderService.createOrder(data as any, testIds.userId.toString())
    ).rejects.toThrow('Medication request not found');
  });

  it('should throw BAD_REQUEST if request is not in available status', async () => {
    await MedicationRequest.findByIdAndUpdate(testIds.requestId, {
      status: RequestStatus.PENDING,
    });

    await expect(
      OrderService.createOrder(validCreateOrderData as any, testIds.userId.toString())
    ).rejects.toThrow(/must be in 'available' status/);
  });

  it('should throw FORBIDDEN if user tries to create order for another user\'s request', async () => {
    const otherUserId = new mongoose.Types.ObjectId().toString();

    await expect(
      OrderService.createOrder(validCreateOrderData as any, otherUserId)
    ).rejects.toThrow('You can only create orders for your own requests');
  });

  it('should throw BAD_REQUEST for insufficient stock', async () => {
    await Inventory.findByIdAndUpdate(testIds.inventoryId, { quantity: 1 });

    await expect(
      OrderService.createOrder(validCreateOrderData as any, testIds.userId.toString())
    ).rejects.toThrow(/Insufficient stock/);
  });

  it('should throw NOT_FOUND if medication is not in inventory', async () => {
    const fakeInventoryId = new mongoose.Types.ObjectId().toString();
    const data = {
      ...validCreateOrderData,
      items: [
        {
          medicationId: fakeInventoryId,
          name: 'Unknown Drug',
          quantity: 1,
          unitPrice: 10,
        },
      ],
    };

    await expect(
      OrderService.createOrder(data as any, testIds.userId.toString())
    ).rejects.toThrow(/not found in inventory/);
  });

  it('should rollback inventory on transaction failure', async () => {
    // Force a failure by making the request already fulfilled (after inventory check)
    jest.spyOn(Order, 'create').mockImplementationOnce(() => {
      throw new Error('Simulated DB write failure');
    });

    await expect(
      OrderService.createOrder(validCreateOrderData as any, testIds.userId.toString())
    ).rejects.toThrow();

    const inventory = await Inventory.findById(testIds.inventoryId);
    expect(inventory!.quantity).toBe(100); // should remain unchanged
    jest.restoreAllMocks();
  });

  it('should calculate tax at 5% of subtotal', async () => {
    const order = await OrderService.createOrder(
      validCreateOrderData as any,
      testIds.userId.toString()
    );

    const expectedTax = parseFloat((order.subtotal * 0.05).toFixed(2));
    expect(order.tax).toBeCloseTo(expectedTax, 2);
  });

  it('should calculate totalAmount as subtotal + deliveryFee + tax', async () => {
    const order = await OrderService.createOrder(
      validCreateOrderData as any,
      testIds.userId.toString()
    );

    const expectedTotal = parseFloat(
      (order.subtotal + order.deliveryFee + order.tax).toFixed(2)
    );
    expect(order.totalAmount).toBeCloseTo(expectedTotal, 2);
  });

  it('should generate sequential order numbers', async () => {
    const order1 = await OrderService.createOrder(
      validCreateOrderData as any,
      testIds.userId.toString()
    );

    // Reset for second order
    const newRequestId = new mongoose.Types.ObjectId();
    const newInventoryId = new mongoose.Types.ObjectId();
    await createTestRequest({ _id: newRequestId, status: RequestStatus.AVAILABLE });
    await createTestInventory({ _id: newInventoryId, quantity: 50 });

    const data2 = {
      ...validCreateOrderData,
      requestId: newRequestId.toString(),
      items: [
        {
          medicationId: newInventoryId.toString(),
          name: 'Ibuprofen 200mg',
          quantity: 1,
          unitPrice: 3.5,
        },
      ],
    };

    const order2 = await OrderService.createOrder(
      data2 as any,
      testIds.userId.toString()
    );

    const seq1 = parseInt(order1.orderNumber.split('-')[2], 10);
    const seq2 = parseInt(order2.orderNumber.split('-')[2], 10);
    expect(seq2).toBe(seq1 + 1);
  });
});

// ─── GET ORDERS ────────────────────────────────────────────────────────────────

describe('OrderService.getOrders', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder();
    await createTestOrder({
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'ORD-2026-000002',
      status: OrderStatus.PACKED,
      paymentStatus: PaymentStatus.PAID,
      requestId: new mongoose.Types.ObjectId(),
    });
  });

  it('should return paginated orders', async () => {
    const result = await OrderService.getOrders(
      {},
      { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
    );

    expect(result.orders).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pages).toBe(1);
  });

  it('should filter orders by status', async () => {
    const result = await OrderService.getOrders(
      { status: OrderStatus.PACKED },
      { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
    );

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].status).toBe(OrderStatus.PACKED);
  });

  it('should filter orders by payment status', async () => {
    const result = await OrderService.getOrders(
      { paymentStatus: PaymentStatus.PAID },
      { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
    );

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('should respect pagination limits', async () => {
    const result = await OrderService.getOrders(
      {},
      { page: 1, limit: 1, sortBy: 'createdAt', sortOrder: 'desc' }
    );

    expect(result.orders).toHaveLength(1);
    expect(result.total).toBe(2);
    expect(result.pages).toBe(2);
  });

  it('should return empty array for page beyond available data', async () => {
    const result = await OrderService.getOrders(
      {},
      { page: 5, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
    );

    expect(result.orders).toHaveLength(0);
    expect(result.total).toBe(2);
  });
});

// ─── GET ORDER BY ID ───────────────────────────────────────────────────────────

describe('OrderService.getOrderById', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder();
  });

  it('should return a specific order by ID', async () => {
    const order = await OrderService.getOrderById(testIds.orderId.toString());

    expect(order).toBeDefined();
    expect(order.orderNumber).toBe('ORD-2026-000001');
    expect(order._id.toString()).toBe(testIds.orderId.toString());
  });

  it('should throw NOT_FOUND for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(OrderService.getOrderById(fakeId)).rejects.toThrow('Order not found');
  });
});

// ─── UPDATE ORDER ──────────────────────────────────────────────────────────────

describe('OrderService.updateOrder', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder();
  });

  it('should update the delivery address', async () => {
    const newAddress = {
      street: '456 Updated Street',
      city: 'Kandy',
      postalCode: '20000',
      phoneNumber: '+94779999999',
    };

    const updated = await OrderService.updateOrder(testIds.orderId.toString(), {
      deliveryAddress: newAddress,
    });

    expect(updated.deliveryAddress.street).toBe('456 Updated Street');
    expect(updated.deliveryAddress.city).toBe('Kandy');
  });

  it('should recalculate totalAmount when delivery fee changes', async () => {
    const updated = await OrderService.updateOrder(testIds.orderId.toString(), {
      deliveryFee: 5.0,
    });

    const expectedTotal = parseFloat((updated.subtotal + 5.0 + updated.tax).toFixed(2));
    expect(updated.totalAmount).toBeCloseTo(expectedTotal, 2);
  });

  it('should update the estimated delivery date', async () => {
    const futureDate = new Date('2026-04-01T10:00:00Z').toISOString();

    const updated = await OrderService.updateOrder(testIds.orderId.toString(), {
      estimatedDelivery: futureDate,
    });

    expect(updated.estimatedDelivery).toBeDefined();
  });

  it('should throw NOT_FOUND for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      OrderService.updateOrder(fakeId, { deliveryFee: 5 })
    ).rejects.toThrow('Order not found');
  });

  it('should throw BAD_REQUEST when updating a delivered order', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, { status: OrderStatus.DELIVERED });

    await expect(
      OrderService.updateOrder(testIds.orderId.toString(), { deliveryFee: 5 })
    ).rejects.toThrow(/Cannot update an order with status/);
  });

  it('should throw BAD_REQUEST when updating a cancelled order', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, { status: OrderStatus.CANCELLED });

    await expect(
      OrderService.updateOrder(testIds.orderId.toString(), { deliveryFee: 5 })
    ).rejects.toThrow(/Cannot update an order with status/);
  });
});

// ─── UPDATE ORDER STATUS ───────────────────────────────────────────────────────

describe('OrderService.updateOrderStatus', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder();
  });

  it('should transition from confirmed to packed', async () => {
    const updated = await OrderService.updateOrderStatus(testIds.orderId.toString(), {
      status: OrderStatus.PACKED,
      notes: 'Order packed and ready',
    });

    expect(updated.status).toBe(OrderStatus.PACKED);
    expect(updated.trackingUpdates).toHaveLength(2);
  });

  it('should transition from packed to out_for_delivery', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, { status: OrderStatus.PACKED });

    const updated = await OrderService.updateOrderStatus(testIds.orderId.toString(), {
      status: OrderStatus.OUT_FOR_DELIVERY,
      location: 'Warehouse A',
    });

    expect(updated.status).toBe(OrderStatus.OUT_FOR_DELIVERY);
  });

  it('should set actualDelivery date when delivered', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      status: OrderStatus.OUT_FOR_DELIVERY,
    });

    const updated = await OrderService.updateOrderStatus(testIds.orderId.toString(), {
      status: OrderStatus.DELIVERED,
    });

    expect(updated.status).toBe(OrderStatus.DELIVERED);
    expect(updated.actualDelivery).toBeDefined();
  });

  it('should reject invalid status transitions', async () => {
    // confirmed -> delivered is not allowed (must go through packed and out_for_delivery)
    await expect(
      OrderService.updateOrderStatus(testIds.orderId.toString(), {
        status: OrderStatus.DELIVERED,
      })
    ).rejects.toThrow(/Invalid status transition/);
  });

  it('should reject status update on a cancelled order', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, { status: OrderStatus.CANCELLED });

    await expect(
      OrderService.updateOrderStatus(testIds.orderId.toString(), {
        status: OrderStatus.PACKED,
      })
    ).rejects.toThrow('Cannot update status of a cancelled order');
  });

  it('should reject status update on a delivered order', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, { status: OrderStatus.DELIVERED });

    await expect(
      OrderService.updateOrderStatus(testIds.orderId.toString(), {
        status: OrderStatus.CANCELLED,
      })
    ).rejects.toThrow('Order has already been delivered');
  });

  it('should add tracking update with location and notes', async () => {
    const updated = await OrderService.updateOrderStatus(testIds.orderId.toString(), {
      status: OrderStatus.PACKED,
      location: 'Pharmacy Counter B',
      notes: 'All items verified',
    });

    const lastTracking = updated.trackingUpdates[updated.trackingUpdates.length - 1];
    expect(lastTracking.location).toBe('Pharmacy Counter B');
    expect(lastTracking.notes).toBe('All items verified');
  });

  it('should throw NOT_FOUND for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      OrderService.updateOrderStatus(fakeId, { status: OrderStatus.PACKED })
    ).rejects.toThrow('Order not found');
  });
});

// ─── PROCESS PAYMENT ───────────────────────────────────────────────────────────

describe('OrderService.processPayment', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder();
  });

  it('should process payment successfully via Stripe', async () => {
    const order = await OrderService.processPayment(testIds.orderId.toString(), {
      paymentMethod: PaymentMethod.CARD,
    });

    expect(order.paymentStatus).toBe(PaymentStatus.PAID);
    expect(order.paymentMethod).toBe(PaymentMethod.CARD);
    expect(order.paymentIntentId).toBeDefined();
    expect(order.paymentIntentId).toMatch(/^pi_/);
  });

  it('should throw BAD_REQUEST if order is already paid', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      paymentStatus: PaymentStatus.PAID,
    });

    await expect(
      OrderService.processPayment(testIds.orderId.toString(), {
        paymentMethod: PaymentMethod.CARD,
      })
    ).rejects.toThrow('Order has already been paid');
  });

  it('should throw BAD_REQUEST for cancelled order payment', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      status: OrderStatus.CANCELLED,
    });

    await expect(
      OrderService.processPayment(testIds.orderId.toString(), {
        paymentMethod: PaymentMethod.CARD,
      })
    ).rejects.toThrow('Cannot process payment for a cancelled order');
  });

  it('should throw NOT_FOUND for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      OrderService.processPayment(fakeId, { paymentMethod: PaymentMethod.CARD })
    ).rejects.toThrow('Order not found');
  });

  it('should set payment status to FAILED if Stripe fails', async () => {
    jest
      .spyOn(StripeService, 'createPaymentIntent')
      .mockRejectedValueOnce(new Error('Stripe unavailable'));

    await expect(
      OrderService.processPayment(testIds.orderId.toString(), {
        paymentMethod: PaymentMethod.CARD,
      })
    ).rejects.toThrow('Payment processing failed');

    const order = await Order.findById(testIds.orderId);
    expect(order!.paymentStatus).toBe(PaymentStatus.FAILED);
    jest.restoreAllMocks();
  });
});

// ─── CANCEL ORDER ──────────────────────────────────────────────────────────────

describe('OrderService.cancelOrder', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest({ status: RequestStatus.FULFILLED });
    await createTestOrder();
  });

  it('should cancel an order and restore inventory', async () => {
    const cancelled = await OrderService.cancelOrder(
      testIds.orderId.toString(),
      { reason: 'Changed my mind' },
      testIds.userId.toString(),
      'Patient'
    );

    expect(cancelled.status).toBe(OrderStatus.CANCELLED);

    const inventory = await Inventory.findById(testIds.inventoryId);
    expect(inventory!.quantity).toBe(102); // 100 original + 2 restored
  });

  it('should revert medication request to available status', async () => {
    await OrderService.cancelOrder(
      testIds.orderId.toString(),
      { reason: 'No longer needed' },
      testIds.userId.toString(),
      'Patient'
    );

    const request = await MedicationRequest.findById(testIds.requestId);
    expect(request!.status).toBe(RequestStatus.AVAILABLE);
  });

  it('should process refund if payment was made', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      paymentStatus: PaymentStatus.PAID,
      paymentIntentId: 'pi_test_intent_123',
    });

    jest.spyOn(StripeService, 'createRefund').mockResolvedValueOnce({
      id: 're_test_refund',
      paymentIntentId: 'pi_test_intent_123',
      amount: 1558,
      status: 'succeeded',
      createdAt: new Date(),
    });

    const cancelled = await OrderService.cancelOrder(
      testIds.orderId.toString(),
      { reason: 'Refund requested' },
      testIds.userId.toString(),
      'Patient'
    );

    expect(cancelled.paymentStatus).toBe(PaymentStatus.REFUNDED);
    jest.restoreAllMocks();
  });

  it('should throw BAD_REQUEST if order is already cancelled', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      status: OrderStatus.CANCELLED,
    });

    await expect(
      OrderService.cancelOrder(
        testIds.orderId.toString(),
        {},
        testIds.userId.toString(),
        'Patient'
      )
    ).rejects.toThrow('Order is already cancelled');
  });

  it('should throw BAD_REQUEST if order is already delivered', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      status: OrderStatus.DELIVERED,
    });

    await expect(
      OrderService.cancelOrder(
        testIds.orderId.toString(),
        {},
        testIds.userId.toString(),
        'Patient'
      )
    ).rejects.toThrow('Cannot cancel a delivered order');
  });

  it('should throw FORBIDDEN if unauthorized user tries to cancel', async () => {
    const otherUserId = new mongoose.Types.ObjectId().toString();

    await expect(
      OrderService.cancelOrder(
        testIds.orderId.toString(),
        {},
        otherUserId,
        'Patient'
      )
    ).rejects.toThrow('You do not have permission to cancel this order');
  });

  it('should allow Pharmacy Staff to cancel any order', async () => {
    const staffId = new mongoose.Types.ObjectId().toString();

    const cancelled = await OrderService.cancelOrder(
      testIds.orderId.toString(),
      { reason: 'Out of stock' },
      staffId,
      'Pharmacy Staff'
    );

    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
  });

  it('should allow System Admin to cancel any order', async () => {
    const adminId = new mongoose.Types.ObjectId().toString();

    const cancelled = await OrderService.cancelOrder(
      testIds.orderId.toString(),
      { reason: 'Policy violation' },
      adminId,
      'System Admin'
    );

    expect(cancelled.status).toBe(OrderStatus.CANCELLED);
  });

  it('should add cancellation reason to tracking updates', async () => {
    const cancelled = await OrderService.cancelOrder(
      testIds.orderId.toString(),
      { reason: 'Customer request' },
      testIds.userId.toString(),
      'Patient'
    );

    const lastTracking =
      cancelled.trackingUpdates[cancelled.trackingUpdates.length - 1];
    expect(lastTracking.status).toBe(OrderStatus.CANCELLED);
    expect(lastTracking.notes).toBe('Customer request');
  });
});

// ─── GET USER ORDERS ───────────────────────────────────────────────────────────

describe('OrderService.getUserOrders', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder();
    await createTestOrder({
      _id: new mongoose.Types.ObjectId(),
      orderNumber: 'ORD-2026-000002',
      requestId: new mongoose.Types.ObjectId(),
    });
  });

  it('should return orders for a specific user', async () => {
    const result = await OrderService.getUserOrders(testIds.userId.toString(), {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.orders).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('should return empty results for a user with no orders', async () => {
    const noOrderUserId = new mongoose.Types.ObjectId().toString();
    const result = await OrderService.getUserOrders(noOrderUserId, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.orders).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── GET PHARMACY ORDERS ───────────────────────────────────────────────────────

describe('OrderService.getPharmacyOrders', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder();
  });

  it('should return orders for a specific pharmacy', async () => {
    const result = await OrderService.getPharmacyOrders(
      testIds.pharmacyId.toString(),
      { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
    );

    expect(result.orders).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should return empty results for pharmacy with no orders', async () => {
    const fakePharmacyId = new mongoose.Types.ObjectId().toString();
    const result = await OrderService.getPharmacyOrders(fakePharmacyId, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.orders).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ─── ASSIGN DELIVERY PARTNER ───────────────────────────────────────────────────

describe('OrderService.assignDeliveryPartner', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder();
  });

  it('should assign a delivery partner to an order', async () => {
    const updated = await OrderService.assignDeliveryPartner(
      testIds.orderId.toString(),
      { deliveryPartnerId: testIds.deliveryPartnerId.toString() }
    );

    expect(updated.deliveryPartnerId!.toString()).toBe(
      testIds.deliveryPartnerId.toString()
    );
  });

  it('should add a tracking update when delivery partner is assigned', async () => {
    const updated = await OrderService.assignDeliveryPartner(
      testIds.orderId.toString(),
      { deliveryPartnerId: testIds.deliveryPartnerId.toString() }
    );

    const lastTracking =
      updated.trackingUpdates[updated.trackingUpdates.length - 1];
    expect(lastTracking.status).toBe('delivery_partner_assigned');
  });

  it('should throw NOT_FOUND for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(
      OrderService.assignDeliveryPartner(fakeId, {
        deliveryPartnerId: testIds.deliveryPartnerId.toString(),
      })
    ).rejects.toThrow('Order not found');
  });

  it('should throw BAD_REQUEST for cancelled orders', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      status: OrderStatus.CANCELLED,
    });

    await expect(
      OrderService.assignDeliveryPartner(testIds.orderId.toString(), {
        deliveryPartnerId: testIds.deliveryPartnerId.toString(),
      })
    ).rejects.toThrow(/Cannot assign delivery partner/);
  });

  it('should throw BAD_REQUEST for delivered orders', async () => {
    await Order.findByIdAndUpdate(testIds.orderId, {
      status: OrderStatus.DELIVERED,
    });

    await expect(
      OrderService.assignDeliveryPartner(testIds.orderId.toString(), {
        deliveryPartnerId: testIds.deliveryPartnerId.toString(),
      })
    ).rejects.toThrow(/Cannot assign delivery partner/);
  });
});

// ─── DELIVERY TRACKING ────────────────────────────────────────────────────────

describe('OrderService.getDeliveryTracking', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder();
  });

  it('should return delivery tracking information', async () => {
    const result = await OrderService.getDeliveryTracking(testIds.orderId.toString());

    expect(result.order).toBeDefined();
    expect(result.trackingUpdates).toHaveLength(1);
    expect(result.trackingUpdates[0].status).toBe(OrderStatus.CONFIRMED);
  });

  it('should throw NOT_FOUND for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(OrderService.getDeliveryTracking(fakeId)).rejects.toThrow(
      'Order not found'
    );
  });
});

// ─── GENERATE INVOICE ──────────────────────────────────────────────────────────

describe('OrderService.generateInvoice', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder();
  });

  it('should generate a PDF buffer and invoice URL for an order', async () => {
    const result = await OrderService.generateInvoice(testIds.orderId.toString());

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.orderNumber).toContain('ORD-2026-000001');
  });

  it('should throw NOT_FOUND for non-existent order', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    await expect(OrderService.generateInvoice(fakeId)).rejects.toThrow(
      'Order not found'
    );
  });
});

// ─── GET DELIVERY PARTNER ORDERS ───────────────────────────────────────────────

describe('OrderService.getDeliveryPartnerOrders', () => {
  beforeEach(async () => {
    await createTestUser();
    await createTestInventory();
    await createTestRequest();
    await createTestOrder({
      deliveryPartnerId: testIds.deliveryPartnerId,
    });
  });

  it('should return orders assigned to a delivery partner', async () => {
    const result = await OrderService.getDeliveryPartnerOrders(
      testIds.deliveryPartnerId.toString(),
      { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }
    );

    expect(result.orders).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should return empty results for partner with no assignments', async () => {
    const fakePartnerId = new mongoose.Types.ObjectId().toString();
    const result = await OrderService.getDeliveryPartnerOrders(fakePartnerId, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(result.orders).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
