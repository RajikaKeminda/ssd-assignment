import mongoose, { Document, Schema } from 'mongoose';

export enum OrderStatus {
  CONFIRMED = 'confirmed',
  PACKED = 'packed',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CARD = 'card',
  CASH = 'cash',
  ONLINE = 'online',
}

export interface IOrderItem {
  medicationId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface IDeliveryAddress {
  street: string;
  city: string;
  postalCode: string;
  phoneNumber: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ITrackingUpdate {
  status: string;
  timestamp: Date;
  location?: string;
  notes?: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  requestId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  pharmacyId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  totalAmount: number;
  deliveryAddress: IDeliveryAddress;
  status: OrderStatus;
  deliveryPartnerId?: mongoose.Types.ObjectId;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentIntentId?: string;
  trackingUpdates: ITrackingUpdate[];
  invoiceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    medicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Inventory',
      required: true,
    },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    totalPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const trackingUpdateSchema = new Schema<ITrackingUpdate>(
  {
    status: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    location: String,
    notes: String,
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'Request',
      required: [true, 'Request ID is required'],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    pharmacyId: {
      type: Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: [true, 'Pharmacy ID is required'],
      index: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [(v: IOrderItem[]) => v.length > 0, 'At least one item is required'],
    },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    tax: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    deliveryAddress: {
      street: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
      phoneNumber: { type: String, required: true, trim: true },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.CONFIRMED,
    },
    deliveryPartnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    estimatedDelivery: Date,
    actualDelivery: Date,
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
    },
    paymentIntentId: String,
    trackingUpdates: [trackingUpdateSchema],
    invoiceUrl: String,
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ deliveryPartnerId: 1 });
orderSchema.index({ createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
