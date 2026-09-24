import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export enum UserRole {
  PATIENT = 'Patient',
  PHARMACY_STAFF = 'Pharmacy Staff',
  DELIVERY_PARTNER = 'Delivery Partner',
  SYSTEM_ADMIN = 'System Admin',
}

/**
 * New feature: Sign in with Google (OAuth 2.0 / OpenID Connect Authorization
 * Code grant — see SECURITY.md "New Feature" and services/oauth.service.ts).
 * `authProvider` distinguishes password-based accounts from
 * federated-identity accounts; `googleId` stores Google's stable subject
 * (`sub`) claim so a returning Google user is matched to the same account
 * even if they change their Google email.
 */
export type AuthProvider = 'local' | 'google';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  authProvider: AuthProvider;
  googleId?: string;
  role: UserRole;
  phone?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  profileImage?: string;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLogin?: Date;
  pharmacyId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      // A Google-authenticated account has no local password — Google is
      // the identity provider, so we never store or check one for them.
      required: [
        function (this: IUser) {
          return this.authProvider !== 'google';
        },
        'Password is required',
      ],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // allows many docs with no googleId (local accounts)
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.PATIENT,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    profileImage: String,
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: Date,
    pharmacyId: {
      type: Schema.Types.ObjectId,
      ref: 'Pharmacy',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc: any, ret: Record<string, unknown>) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.index({ role: 1 });

userSchema.pre('save', async function (next: () => void) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  // A Google-only account has no local password to compare against.
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', userSchema);
