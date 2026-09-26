import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import { Order, IOrder, OrderStatus, PaymentStatus, PaymentMethod } from '../models/order.model';
import { MedicationRequest, RequestStatus } from '../models/request.model';
import { Inventory } from '../models/inventory.model';
import { StripeService } from './stripe.service';
import { ApiError } from '../utils/api-error';
import { logger } from '../utils/logger';
import {
  CreateOrderInput,
  UpdateOrderInput,
  UpdateOrderStatusInput,
  ProcessPaymentInput,
  AssignDeliveryInput,
  CancelOrderInput,
} from '../validators/order.validator';

interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface OrderFilter {
  status?: OrderStatus;
  paymentStatus?: string;
}

const TAX_RATE = 0.05;

export class OrderService {
  /**
   * Generate a unique order number in the format ORD-YYYY-XXXXXX
   */
  private static async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const latestOrder = await Order.findOne(
      { orderNumber: new RegExp(`^ORD-${year}-`) },
      { orderNumber: 1 },
      { sort: { orderNumber: -1 } }
    );

    let sequence = 1;
    if (latestOrder?.orderNumber) {
      const parts = latestOrder.orderNumber.split('-');
      sequence = parseInt(parts[2], 10) + 1;
    }

    return `ORD-${year}-${String(sequence).padStart(6, '0')}`;
  }

  /**
   * Create an order from an approved medication request.
   * Uses a MongoDB transaction to atomically:
   *   1. Validate the request is in 'available' status
   *   2. Verify inventory availability and decrement stock
   *   3. Create the order
   *   4. Mark the request as 'fulfilled'
   */
  static async createOrder(data: CreateOrderInput, userId: string): Promise<IOrder> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await MedicationRequest.findById(data.requestId).session(session);
      if (!request) {
        throw ApiError.notFound('Medication request not found');
      }

      if (request.status !== RequestStatus.AVAILABLE) {
        throw ApiError.badRequest(
          `Request must be in '${RequestStatus.AVAILABLE}' status to create an order. Current: '${request.status}'`
        );
      }

      if (request.userId.toString() !== userId) {
        throw ApiError.forbidden('You can only create orders for your own requests');
      }

      for (const item of data.items) {
        const inventoryItem = await Inventory.findById(item.medicationId).session(session);
        if (!inventoryItem) {
          throw ApiError.notFound(`Medication '${item.name}' not found in inventory`);
        }
        if (inventoryItem.quantity < item.quantity) {
          throw ApiError.badRequest(
            `Insufficient stock for '${item.name}'. Available: ${inventoryItem.quantity}, Requested: ${item.quantity}`
          );
        }

        inventoryItem.quantity -= item.quantity;
        await inventoryItem.save({ session });
      }

      const items = data.items.map((item) => ({
        medicationId: new mongoose.Types.ObjectId(item.medicationId),
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
      }));

      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const deliveryFee = data.deliveryFee ?? 0;
      const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
      const totalAmount = parseFloat((subtotal + deliveryFee + tax).toFixed(2));

      const orderNumber = await this.generateOrderNumber();

      const [order] = await Order.create(
        [
          {
            orderNumber,
            requestId: new mongoose.Types.ObjectId(data.requestId),
            userId: new mongoose.Types.ObjectId(userId),
            pharmacyId: request.pharmacyId,
            items,
            subtotal,
            deliveryFee,
            tax,
            totalAmount,
            deliveryAddress: data.deliveryAddress,
            status: OrderStatus.CONFIRMED,
            paymentStatus: PaymentStatus.PENDING,
            paymentMethod: data.paymentMethod,
            trackingUpdates: [
              {
                status: OrderStatus.CONFIRMED,
                timestamp: new Date(),
                notes: 'Order created from approved medication request',
              },
            ],
          },
        ],
        { session }
      );

      request.status = RequestStatus.FULFILLED;
      request.responseDate = new Date();
      await request.save({ session });

      await session.commitTransaction();
      logger.info(`Order ${orderNumber} created successfully for user ${userId}`);

      return order.populate([
        { path: 'userId', select: 'name email phone' },
        { path: 'pharmacyId', select: 'name location contactInfo' },
      ]);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async getOrders(
    filter: OrderFilter,
    pagination: PaginationOptions
  ): Promise<{ orders: IOrder[]; total: number; page: number; pages: number }> {
    const query: Record<string, unknown> = {};
    if (filter.status) query.status = filter.status;
    if (filter.paymentStatus) query.paymentStatus = filter.paymentStatus;

    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('userId', 'name email phone')
        .populate('pharmacyId', 'name location')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query),
    ]);

    return {
      orders,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  static async getOrderById(orderId: string): Promise<IOrder> {
    const order = await Order.findById(orderId)
      .populate('userId', 'name email phone')
      .populate('pharmacyId', 'name location contactInfo')
      .populate('deliveryPartnerId', 'name email phone');

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    return order;
  }

  static async updateOrder(orderId: string, data: UpdateOrderInput): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if ([OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(order.status)) {
      throw ApiError.badRequest(`Cannot update an order with status '${order.status}'`);
    }

    if (data.deliveryAddress) order.deliveryAddress = data.deliveryAddress;
    if (data.deliveryFee !== undefined) {
      order.deliveryFee = data.deliveryFee;
      order.totalAmount = parseFloat(
        (order.subtotal + data.deliveryFee + order.tax).toFixed(2)
      );
    }
    if (data.estimatedDelivery) {
      order.estimatedDelivery = new Date(data.estimatedDelivery);
    }

    await order.save();
    return order;
  }

  static async updateOrderStatus(
    orderId: string,
    data: UpdateOrderStatusInput
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw ApiError.badRequest('Cannot update status of a cancelled order');
    }
    if (order.status === OrderStatus.DELIVERED) {
      throw ApiError.badRequest('Order has already been delivered');
    }

    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.CONFIRMED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
      [OrderStatus.PACKED]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
      [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    if (!validTransitions[order.status]?.includes(data.status)) {
      throw ApiError.badRequest(
        `Invalid status transition from '${order.status}' to '${data.status}'`
      );
    }

    order.status = data.status;
    order.trackingUpdates.push({
      status: data.status,
      timestamp: new Date(),
      location: data.location,
      notes: data.notes,
    });

    if (data.status === OrderStatus.DELIVERED) {
      order.actualDelivery = new Date();
    }

    await order.save();
    return order;
  }

  /**
   * Process payment through the Stripe gateway.
   * Creates a payment intent, confirms it, and updates the order's payment status.
   */
  static async processPayment(
    orderId: string,
    data: ProcessPaymentInput
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw ApiError.badRequest('Order has already been paid');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw ApiError.badRequest('Cannot process payment for a cancelled order');
    }

    try {
      const paymentIntent = await StripeService.createPaymentIntent(
        order.totalAmount,
        'usd',
        { orderId: orderId, orderNumber: order.orderNumber }
      );

      const confirmedIntent = await StripeService.confirmPaymentIntent(paymentIntent.id);

      order.paymentStatus = PaymentStatus.PAID;
      order.paymentMethod = data.paymentMethod;
      order.paymentIntentId = confirmedIntent.id;

      await order.save();
      logger.info(`Payment processed for order ${order.orderNumber}: ${confirmedIntent.id}`);
      return order;
    } catch (error) {
      order.paymentStatus = PaymentStatus.FAILED;
      await order.save();

      logger.error(`Payment failed for order ${order.orderNumber}:`, error);
      throw ApiError.badRequest('Payment processing failed. Please try again.');
    }
  }

  /**
   * Cancel an order and refund if payment was made.
   * Uses a transaction to restore inventory quantities atomically.
   */
  static async cancelOrder(
    orderId: string,
    data: CancelOrderInput,
    userId: string,
    userRole: string
  ): Promise<IOrder> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw ApiError.notFound('Order not found');
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw ApiError.badRequest('Order is already cancelled');
      }
      if (order.status === OrderStatus.DELIVERED) {
        throw ApiError.badRequest('Cannot cancel a delivered order');
      }

      const isOwner = order.userId.toString() === userId;
      const isStaffOrAdmin = ['Pharmacy Staff', 'System Admin'].includes(userRole);
      if (!isOwner && !isStaffOrAdmin) {
        throw ApiError.forbidden('You do not have permission to cancel this order');
      }

      for (const item of order.items) {
        await Inventory.findByIdAndUpdate(
          item.medicationId,
          { $inc: { quantity: item.quantity } },
          { session }
        );
      }

      if (order.paymentStatus === PaymentStatus.PAID && order.paymentIntentId) {
        await StripeService.createRefund(order.paymentIntentId);
        order.paymentStatus = PaymentStatus.REFUNDED;
      }

      order.status = OrderStatus.CANCELLED;
      order.trackingUpdates.push({
        status: OrderStatus.CANCELLED,
        timestamp: new Date(),
        notes: data.reason || 'Order cancelled',
      });

      await order.save({ session });

      await MedicationRequest.findByIdAndUpdate(
        order.requestId,
        { status: RequestStatus.AVAILABLE },
        { session }
      );

      await session.commitTransaction();
      logger.info(`Order ${order.orderNumber} cancelled by user ${userId}`);
      return order;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  static async getUserOrders(userId: string, pagination: PaginationOptions) {
    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ userId })
        .populate('pharmacyId', 'name location')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ userId }),
    ]);

    return { orders, total, page, pages: Math.ceil(total / limit) };
  }

  static async getPharmacyOrders(pharmacyId: string, pagination: PaginationOptions) {
    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ pharmacyId })
        .populate('userId', 'name email phone')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ pharmacyId }),
    ]);

    return { orders, total, page, pages: Math.ceil(total / limit) };
  }

  static async assignDeliveryPartner(
    orderId: string,
    data: AssignDeliveryInput
  ): Promise<IOrder> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.DELIVERED) {
      throw ApiError.badRequest(`Cannot assign delivery partner to a '${order.status}' order`);
    }

    order.deliveryPartnerId = new mongoose.Types.ObjectId(data.deliveryPartnerId);
    order.trackingUpdates.push({
      status: 'delivery_partner_assigned',
      timestamp: new Date(),
      notes: `Delivery partner ${data.deliveryPartnerId} assigned`,
    });

    await order.save();
    return order.populate('deliveryPartnerId', 'name email phone');
  }

  static async getDeliveryTracking(orderId: string): Promise<{
    order: IOrder;
    trackingUpdates: IOrder['trackingUpdates'];
  }> {
    const order = await Order.findById(orderId)
      .populate('userId', 'name phone')
      .populate('pharmacyId', 'name location')
      .populate('deliveryPartnerId', 'name phone');

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    return { order, trackingUpdates: order.trackingUpdates };
  }

  static async generateInvoice(orderId: string): Promise<{ buffer: Buffer; orderNumber: string }> {
    const order = await Order.findById(orderId)
      .populate<{ userId: { name: string; email: string; phone?: string } }>('userId', 'name email phone')
      .populate<{ pharmacyId: { name: string; contactInfo?: { email?: string; phone?: string } } }>('pharmacyId', 'name contactInfo');

    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const W = doc.page.width - 100; // usable width
      const grey = '#6b7280';
      const dark = '#111827';
      const emerald = '#059669';

      // ── Header bar ──────────────────────────────────────────
      doc.rect(50, 45, W, 70).fill(emerald);

      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(26)
        .text('INVOICE', 65, 65);

      const pharmacyName =
        typeof order.pharmacyId === 'object' && order.pharmacyId?.name
          ? order.pharmacyId.name
          : 'MediTrack Pharmacy';

      doc.fontSize(10).font('Helvetica')
        .text(pharmacyName, 65, 97, { align: 'right', width: W - 15 });

      doc.fillColor(dark);

      // ── Invoice meta ─────────────────────────────────────────
      const metaY = 135;
      const col2 = 50 + W / 2 + 10;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(grey)
        .text('INVOICE NUMBER', 50, metaY)
        .text('ORDER NUMBER',   col2, metaY);

      doc.font('Helvetica').fontSize(10).fillColor(dark)
        .text(order.orderNumber, 50, metaY + 13)
        .text(order.orderNumber, col2, metaY + 13);

      doc.font('Helvetica-Bold').fontSize(9).fillColor(grey)
        .text('DATE ISSUED',    50, metaY + 35)
        .text('PAYMENT STATUS', col2, metaY + 35);

      const issued = new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
      });

      doc.font('Helvetica').fontSize(10).fillColor(dark)
        .text(issued, 50, metaY + 48)
        .text(order.paymentStatus.toUpperCase(), col2, metaY + 48);

      // ── Divider ───────────────────────────────────────────────
      const divY = metaY + 75;
      doc.moveTo(50, divY).lineTo(50 + W, divY).strokeColor('#e5e7eb').stroke();

      // ── Bill To / From ────────────────────────────────────────
      const billY = divY + 15;
      const customer = typeof order.userId === 'object' ? order.userId : null;

      doc.font('Helvetica-Bold').fontSize(9).fillColor(grey)
        .text('BILL TO', 50, billY)
        .text('FROM',    col2, billY);

      doc.font('Helvetica-Bold').fontSize(11).fillColor(dark)
        .text(customer?.name ?? '—', 50, billY + 14)
        .text(pharmacyName,          col2, billY + 14);

      doc.font('Helvetica').fontSize(9).fillColor(grey);
      if (customer?.email) doc.text(customer.email, 50, billY + 28);
      if (customer?.phone) doc.text(customer.phone, 50, billY + 40);

      const addr = order.deliveryAddress;
      if (addr) {
        doc.text(`${addr.street}`, 50, billY + 52)
           .text(`${addr.city} ${addr.postalCode}`, 50, billY + 64);
      }

      // ── Line items table ──────────────────────────────────────
      const tableY = billY + 100;
      const colWidths = { item: W * 0.45, qty: W * 0.12, unit: W * 0.2, total: W * 0.23 };
      const col = {
        item:  50,
        qty:   50 + colWidths.item,
        unit:  50 + colWidths.item + colWidths.qty,
        total: 50 + colWidths.item + colWidths.qty + colWidths.unit,
      };

      // Table header
      doc.rect(50, tableY, W, 22).fill('#f3f4f6');
      doc.font('Helvetica-Bold').fontSize(9).fillColor(grey);
      doc.text('ITEM',       col.item  + 4, tableY + 7)
         .text('QTY',        col.qty   + 4, tableY + 7)
         .text('UNIT PRICE', col.unit  + 4, tableY + 7)
         .text('TOTAL',      col.total + 4, tableY + 7);

      let rowY = tableY + 22;
      const rowH = 22;

      for (const [i, item] of (order.items ?? []).entries()) {
        if (i % 2 === 1) {
          doc.rect(50, rowY, W, rowH).fill('#f9fafb');
        }
        doc.font('Helvetica').fontSize(9).fillColor(dark);
        doc.text(item.name,                                    col.item  + 4, rowY + 7, { width: colWidths.item - 8, ellipsis: true })
           .text(String(item.quantity),                        col.qty   + 4, rowY + 7)
           .text(`$${item.unitPrice.toFixed(2)}`,              col.unit  + 4, rowY + 7)
           .text(`$${item.totalPrice.toFixed(2)}`,             col.total + 4, rowY + 7);
        rowY += rowH;
      }

      // ── Totals ────────────────────────────────────────────────
      const totalsX = col.unit;
      const totalsW = W - (col.unit - 50);
      let totY = rowY + 15;

      doc.moveTo(50, rowY + 5).lineTo(50 + W, rowY + 5).strokeColor('#e5e7eb').stroke();

      const totRow = (label: string, value: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
           .fillColor(bold ? dark : grey)
           .text(label, totalsX, totY)
           .text(value,  col.total + 4, totY);
        totY += 16;
      };

      totRow('Subtotal',     `$${order.subtotal.toFixed(2)}`);
      totRow('Delivery fee', `$${order.deliveryFee.toFixed(2)}`);
      totRow('Tax',          `$${order.tax.toFixed(2)}`);

      doc.moveTo(totalsX, totY - 2).lineTo(50 + W, totY - 2).strokeColor('#e5e7eb').stroke();
      totY += 4;
      totRow('TOTAL',        `$${order.totalAmount.toFixed(2)}`, true);

      // ── Payment method ────────────────────────────────────────
      if (order.paymentMethod) {
        totY += 8;
        doc.font('Helvetica').fontSize(8).fillColor(grey)
           .text(`Paid via ${order.paymentMethod}`, totalsX, totY);
      }

      // ── Footer ────────────────────────────────────────────────
      const footY = doc.page.height - 60;
      doc.moveTo(50, footY).lineTo(50 + W, footY).strokeColor('#e5e7eb').stroke();
      doc.font('Helvetica').fontSize(8).fillColor(grey)
         .text('Thank you for using MediTrack. For support, contact your pharmacy.', 50, footY + 10, { align: 'center', width: W });

      doc.end();
    });

    // Persist the reference
    order.invoiceUrl = `/invoices/${order.orderNumber}.pdf`;
    await order.save();

    return { buffer, orderNumber: order.orderNumber };
  }

  /**
   * Permanently delete an order. Only cancelled orders can be deleted.
   */
  static async deleteOrder(orderId: string): Promise<void> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    if (order.status !== OrderStatus.CANCELLED) {
      throw ApiError.badRequest(
        'Only cancelled orders can be deleted. Cancel the order first.'
      );
    }

    await Order.findByIdAndDelete(orderId);
    logger.info(`Order ${order.orderNumber} deleted permanently`);
  }

  static async getDeliveryPartnerOrders(
    partnerId: string,
    pagination: PaginationOptions
  ) {
    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ deliveryPartnerId: partnerId })
        .populate('userId', 'name phone address')
        .populate('pharmacyId', 'name location')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ deliveryPartnerId: partnerId }),
    ]);

    return { orders, total, page, pages: Math.ceil(total / limit) };
  }
}
