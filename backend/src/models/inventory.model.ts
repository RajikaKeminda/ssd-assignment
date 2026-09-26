import mongoose, { Document, Schema } from 'mongoose';

export enum MedicationCategory {
  PRESCRIPTION = 'prescription',
  OTC = 'otc',
  CONTROLLED = 'controlled',
}

export enum MedicationForm {
  TABLET = 'tablet',
  CAPSULE = 'capsule',
  SYRUP = 'syrup',
  INJECTION = 'injection',
}

export interface IInventory extends Document {
  pharmacyId: mongoose.Types.ObjectId;
  medicationName: string;
  genericName?: string;
  category: MedicationCategory;
  dosage?: string;
  form?: MedicationForm;
  quantity: number;
  unitPrice: number;
  batchNumber?: string;
  expiryDate?: Date;
  manufacturer?: string;
  requiresPrescription: boolean;
  lowStockThreshold: number;
  storageConditions?: string;
  sideEffects?: string[];
  contraindications?: string[];
  activeIngredients?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const inventorySchema = new Schema<IInventory>(
  {
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
    genericName: { type: String, trim: true },
    category: {
      type: String,
      enum: Object.values(MedicationCategory),
      default: MedicationCategory.OTC,
    },
    dosage: String,
    form: {
      type: String,
      enum: Object.values(MedicationForm),
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, 'Quantity cannot be negative'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative'],
    },
    batchNumber: String,
    expiryDate: Date,
    manufacturer: String,
    requiresPrescription: { type: Boolean, default: false },
    lowStockThreshold: { type: Number, default: 10 },
    storageConditions: String,
    sideEffects: [String],
    contraindications: [String],
    activeIngredients: [String],
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

inventorySchema.index({ medicationName: 1, pharmacyId: 1 });

export const Inventory = mongoose.model<IInventory>('Inventory', inventorySchema);
