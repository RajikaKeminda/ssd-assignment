import mongoose, { Document, Schema } from 'mongoose';

export interface IReview extends Document {
  pharmacyId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  serviceQuality?: number;
  deliverySpeed?: number;
  productAvailability?: number;
  isVerifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    pharmacyId: {
      type: Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: [true, 'Pharmacy ID is required'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    serviceQuality: {
      type: Number,
      min: [1, 'Service quality must be at least 1'],
      max: [5, 'Service quality cannot exceed 5'],
    },
    deliverySpeed: {
      type: Number,
      min: [1, 'Delivery speed must be at least 1'],
      max: [5, 'Delivery speed cannot exceed 5'],
    },
    productAvailability: {
      type: Number,
      min: [1, 'Product availability must be at least 1'],
      max: [5, 'Product availability cannot exceed 5'],
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transform(_doc: any, ret: Record<string, unknown>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

reviewSchema.index({ pharmacyId: 1, userId: 1 }, { unique: true });

export const Review = mongoose.model<IReview>('Review', reviewSchema);

