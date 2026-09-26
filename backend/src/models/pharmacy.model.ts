import mongoose, { Document, Schema } from 'mongoose';

export interface IOperatingDay {
  open: string;
  close: string;
  isClosed: boolean;
}

export interface IOperatingHours {
  monday: IOperatingDay;
  tuesday: IOperatingDay;
  wednesday: IOperatingDay;
  thursday: IOperatingDay;
  friday: IOperatingDay;
  saturday: IOperatingDay;
  sunday: IOperatingDay;
}

export interface ILocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface ILocation {
  address: string;
  city: string;
  province: string;
  postalCode: string;
  coordinates: ILocationCoordinates;
}

export interface IContactInfo {
  phone: string;
  email: string;
  website?: string;
  emergencyContact?: string;
}

export type FacilityType = 'retail' | 'hospital' | 'clinic';

export interface IPharmacy extends Document {
  name: string;
  licenseNumber: string;
  location: ILocation;
  contactInfo: IContactInfo;
  operatingHours: IOperatingHours;
  serviceRadius: number;
  isVerified: boolean;
  verificationDate?: Date;
  rating: number;
  totalReviews: number;
  ownerId: mongoose.Types.ObjectId;
  facilityType: FacilityType;
  services: string[];
  images: string[];
  certifications: string[];
  isActive: boolean;
  geoLocation: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  createdAt: Date;
  updatedAt: Date;
}

const operatingDaySchema = new Schema<IOperatingDay>(
  {
    open: { type: String, default: '09:00' },
    close: { type: String, default: '17:00' },
    isClosed: { type: Boolean, default: false },
  },
  { _id: false }
);

const operatingHoursSchema = new Schema<IOperatingHours>(
  {
    monday: { type: operatingDaySchema, required: true },
    tuesday: { type: operatingDaySchema, required: true },
    wednesday: { type: operatingDaySchema, required: true },
    thursday: { type: operatingDaySchema, required: true },
    friday: { type: operatingDaySchema, required: true },
    saturday: { type: operatingDaySchema, required: true },
    sunday: { type: operatingDaySchema, required: true },
  },
  { _id: false }
);

const pharmacySchema = new Schema<IPharmacy>(
  {
    name: {
      type: String,
      required: [true, 'Pharmacy name is required'],
      trim: true,
      minlength: [2, 'Pharmacy name must be at least 2 characters'],
      maxlength: [150, 'Pharmacy name cannot exceed 150 characters'],
    },
    licenseNumber: {
      type: String,
      required: [true, 'License number is required'],
      unique: true,
      trim: true,
    },
    location: {
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      province: { type: String, required: true, trim: true },
      postalCode: { type: String, required: true, trim: true },
      coordinates: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
      },
    },
    contactInfo: {
      phone: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      website: { type: String, trim: true },
      emergencyContact: { type: String, trim: true },
    },
    operatingHours: {
      type: operatingHoursSchema,
      required: true,
    },
    serviceRadius: {
      type: Number,
      required: true,
      min: [0, 'Service radius cannot be negative'],
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    verificationDate: {
      type: Date,
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, 'Rating cannot be negative'],
      max: [5, 'Rating cannot exceed 5'],
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: [0, 'Total reviews cannot be negative'],
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    facilityType: {
      type: String,
      enum: ['retail', 'hospital', 'clinic'],
      default: 'retail',
    },
    services: {
      type: [String],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    certifications: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    geoLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
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

pharmacySchema.index({ geoLocation: '2dsphere' });
pharmacySchema.index({ name: 'text', 'location.city': 1, 'location.province': 1 });

export const Pharmacy = mongoose.model<IPharmacy>('Pharmacy', pharmacySchema);

