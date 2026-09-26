import mongoose from 'mongoose';
import { User, IUser, UserRole } from '../models/user.model';
import { Order } from '../models/order.model';
import { ApiError } from '../utils/api-error';
import {
  CreateDeliveryPartnerInput,
  UpdateDeliveryPartnerInput,
} from '../validators/delivery-partner.validator';

interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export class DeliveryPartnerService {
  static async create(data: CreateDeliveryPartnerInput): Promise<IUser> {
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      throw ApiError.conflict('A delivery partner with this email already exists');
    }

    const partner = await User.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: UserRole.DELIVERY_PARTNER,
      phone: data.phone,
      address: data.address,
    });

    return partner;
  }

  static async getById(id: string): Promise<IUser> {
    const partner = await User.findOne({
      _id: id,
      role: UserRole.DELIVERY_PARTNER,
    });

    if (!partner) {
      throw ApiError.notFound('Delivery partner not found');
    }

    return partner;
  }

  static async list(
    filter: { isActive?: boolean },
    pagination: PaginationOptions
  ): Promise<{ partners: IUser[]; total: number; page: number; pages: number }> {
    const query: Record<string, unknown> = { role: UserRole.DELIVERY_PARTNER };
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive;
    }

    const { page, limit, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * limit;

    const [partners, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    return {
      partners,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  static async update(id: string, data: UpdateDeliveryPartnerInput): Promise<IUser> {
    const partner = await User.findOne({
      _id: id,
      role: UserRole.DELIVERY_PARTNER,
    });

    if (!partner) {
      throw ApiError.notFound('Delivery partner not found');
    }

    if (data.name !== undefined) partner.name = data.name;
    if (data.phone !== undefined) partner.phone = data.phone;
    if (data.address !== undefined) {
      const existing = partner.address;
      partner.address = {
        street: data.address.street ?? existing?.street ?? '',
        city: data.address.city ?? existing?.city ?? '',
        postalCode: data.address.postalCode ?? existing?.postalCode ?? '',
        coordinates: data.address.coordinates ?? existing?.coordinates,
      };
    }
    if (data.isActive !== undefined) partner.isActive = data.isActive;

    await partner.save();
    return partner;
  }

  static async delete(id: string): Promise<void> {
    const partner = await User.findOne({
      _id: id,
      role: UserRole.DELIVERY_PARTNER,
    });

    if (!partner) {
      throw ApiError.notFound('Delivery partner not found');
    }

    // Unassign from all orders before deleting
    await Order.updateMany(
      { deliveryPartnerId: new mongoose.Types.ObjectId(id) },
      { $unset: { deliveryPartnerId: 1 } }
    );

    await User.findByIdAndDelete(id);
  }
}
