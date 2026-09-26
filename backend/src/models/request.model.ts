import mongoose, { Document, Schema } from 'mongoose';

export enum RequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
}

export enum UrgencyLevel {
  URGENT = 'urgent',
  NORMAL = 'normal',
  LOW = 'low',
}

export interface IRequest extends Document {
  userId: mongoose.Types.ObjectId;
  pharmacyId: mongoose.Types.ObjectId;
  medicationName: string;
  quantity: number;
  urgencyLevel: UrgencyLevel;
  status: RequestStatus;
  prescriptionRequired: boolean;
  prescriptionImage?: string;
  notes?: string;
  requestDate: Date;
  responseDate?: Date;
  estimatedAvailability?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const requestSchema = new Schema<IRequest>(
  {
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
    medicationName: {
      type: String,
      required: [true, 'Medication name is required'],
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    urgencyLevel: {
      type: String,
      enum: Object.values(UrgencyLevel),
      default: UrgencyLevel.NORMAL,
    },
    status: {
      type: String,
      enum: Object.values(RequestStatus),
      default: RequestStatus.PENDING,
    },
    prescriptionRequired: {
      type: Boolean,
      default: false,
    },
    prescriptionImage: String,
    notes: { type: String, trim: true },
    requestDate: { type: Date, default: Date.now },
    responseDate: Date,
    estimatedAvailability: Date,
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

requestSchema.index({ status: 1 });
requestSchema.index({ urgencyLevel: 1 });

export const MedicationRequest = mongoose.model<IRequest>('Request', requestSchema);
