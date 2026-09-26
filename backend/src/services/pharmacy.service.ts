import mongoose from 'mongoose';
import { Pharmacy, IPharmacy } from '../models/pharmacy.model';
import { Review, IReview } from '../models/review.model';
import { ApiError } from '../utils/api-error';
import {
  CreatePharmacyInput,
  UpdatePharmacyInput,
  NearbyPharmaciesQueryInput,
  GetPharmaciesQueryInput,
  CreateReviewInput,
  GetReviewsQueryInput,
} from '../validators/pharmacy.validator';
import { GeocodingService } from './geocoding.service';

interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export class PharmacyService {
  static async createPharmacy(
    data: CreatePharmacyInput,
    ownerId: string
  ): Promise<IPharmacy> {
    const existingByLicense = await Pharmacy.findOne({
      licenseNumber: data.licenseNumber,
    });
    if (existingByLicense) {
      throw ApiError.conflict('A pharmacy with this license number already exists');
    }

    const existingByOwner = await Pharmacy.findOne({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      isActive: true,
    });
    if (existingByOwner) {
      throw ApiError.conflict('This user already owns an active pharmacy');
    }

    const geo = await GeocodingService.geocodeAddress(
      data.location.address,
      data.location.city,
      data.location.province,
      data.location.postalCode
    );

    const pharmacy = await Pharmacy.create({
      ...data,
      ownerId: new mongoose.Types.ObjectId(ownerId),
      location: {
        ...data.location,
        coordinates: {
          latitude: geo.latitude,
          longitude: geo.longitude,
        },
      },
      geoLocation: {
        type: 'Point',
        coordinates: [geo.longitude, geo.latitude],
      },
      isVerified: false,
      verificationDate: undefined,
      rating: 0,
      totalReviews: 0,
    });

    return pharmacy;
  }

  static async getPharmacies(
    query: GetPharmaciesQueryInput
  ): Promise<PaginationResult<IPharmacy>> {
    const { city, isVerified, search, page, limit, sortBy, sortOrder } = query;

    const mongoQuery: Record<string, unknown> = {
      isActive: true,
    };

    if (typeof isVerified === 'boolean') {
      mongoQuery.isVerified = isVerified;
    }
    if (city) {
      mongoQuery['location.city'] = new RegExp(`^${city}$`, 'i');
    }
    if (search) {
      mongoQuery.$text = { $search: search };
    }

    const pageNum = parseInt(String(page ?? '1'), 10);
    const limitNum = parseInt(String(limit ?? '10'), 10);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Pharmacy.find(mongoQuery)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limitNum),
      Pharmacy.countDocuments(mongoQuery),
    ]);

    return {
      items,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    };
  }

  static async getPharmacyById(id: string): Promise<IPharmacy> {
    const pharmacy = await Pharmacy.findById(id);
    if (!pharmacy || !pharmacy.isActive) {
      throw ApiError.notFound('Pharmacy not found');
    }
    return pharmacy;
  }

  static async updatePharmacy(
    id: string,
    data: UpdatePharmacyInput,
    userId: string,
    userRole: string
  ): Promise<IPharmacy> {
    const pharmacy = await Pharmacy.findById(id);
    if (!pharmacy || !pharmacy.isActive) {
      throw ApiError.notFound('Pharmacy not found');
    }

    const isOwner = pharmacy.ownerId.toString() === userId;
    const isAdmin = userRole === 'System Admin';
    if (!isOwner && !isAdmin) {
      throw ApiError.forbidden('You do not have permission to update this pharmacy');
    }

    if (data.location) {
      const geo = await GeocodingService.geocodeAddress(
        data.location.address ?? pharmacy.location.address,
        data.location.city ?? pharmacy.location.city,
        data.location.province ?? pharmacy.location.province,
        data.location.postalCode ?? pharmacy.location.postalCode
      );

      pharmacy.location = {
        ...pharmacy.location,
        ...data.location,
        coordinates: {
          latitude: geo.latitude,
          longitude: geo.longitude,
        },
      };
      pharmacy.geoLocation = {
        type: 'Point',
        coordinates: [geo.longitude, geo.latitude],
      };
    }

    if (data.name !== undefined) pharmacy.name = data.name;
    if (data.contactInfo) {
      pharmacy.contactInfo = {
        ...pharmacy.contactInfo,
        ...data.contactInfo,
      };
    }
    if (data.operatingHours) {
      pharmacy.operatingHours = {
        ...pharmacy.operatingHours,
        ...data.operatingHours,
      };
    }
    if (data.serviceRadius !== undefined) pharmacy.serviceRadius = data.serviceRadius;
    if (data.facilityType !== undefined) pharmacy.facilityType = data.facilityType;
    if (data.services !== undefined) pharmacy.services = data.services;
    if (data.images !== undefined) pharmacy.images = data.images;
    if (data.certifications !== undefined) pharmacy.certifications = data.certifications;
    if (data.isActive !== undefined) pharmacy.isActive = data.isActive;

    await pharmacy.save();
    return pharmacy;
  }

  static async verifyPharmacy(id: string): Promise<IPharmacy> {
    const pharmacy = await Pharmacy.findById(id);
    if (!pharmacy || !pharmacy.isActive) {
      throw ApiError.notFound('Pharmacy not found');
    }

    if (pharmacy.isVerified) {
      return pharmacy;
    }

    pharmacy.isVerified = true;
    pharmacy.verificationDate = new Date();
    await pharmacy.save();
    return pharmacy;
  }

  static async deactivatePharmacy(
    id: string,
    userId: string,
    userRole: string
  ): Promise<IPharmacy> {
    const pharmacy = await Pharmacy.findById(id);
    if (!pharmacy || !pharmacy.isActive) {
      throw ApiError.notFound('Pharmacy not found');
    }

    const isOwner = pharmacy.ownerId.toString() === userId;
    const isAdmin = userRole === 'System Admin';
    if (!isOwner && !isAdmin) {
      throw ApiError.forbidden('You do not have permission to deactivate this pharmacy');
    }

    pharmacy.isActive = false;
    await pharmacy.save();
    return pharmacy;
  }

  static async findNearbyPharmacies(
    query: NearbyPharmaciesQueryInput
  ): Promise<IPharmacy[]> {
    const { latitude, longitude, radiusKm } = query;

    const maxDistanceMeters = radiusKm * 1000;

    const pharmacies = await Pharmacy.find({
      isActive: true,
      isVerified: true,
      geoLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    });

    return pharmacies;
  }
  

  static async addReview(
    pharmacyId: string,
    userId: string,
    data: CreateReviewInput
  ): Promise<IReview> {
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy || !pharmacy.isActive) {
      throw ApiError.notFound('Pharmacy not found');
    }
    if (!pharmacy.isVerified) {
      throw ApiError.badRequest('Cannot review an unverified pharmacy');
    }

    const existingReview = await Review.findOne({
      pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    if (existingReview) {
      throw ApiError.conflict('You have already reviewed this pharmacy');
    }

    const review = await Review.create({
      pharmacyId: new mongoose.Types.ObjectId(pharmacyId),
      userId: new mongoose.Types.ObjectId(userId),
      rating: data.rating,
      comment: data.comment,
      serviceQuality: data.serviceQuality,
      deliverySpeed: data.deliverySpeed,
      productAvailability: data.productAvailability,
      isVerifiedPurchase: false,
    });

    const totalReviews = pharmacy.totalReviews + 1;
    const totalRating = pharmacy.rating * pharmacy.totalReviews + data.rating;
    pharmacy.totalReviews = totalReviews;
    pharmacy.rating = parseFloat((totalRating / totalReviews).toFixed(2));
    await pharmacy.save();

    return review;
  }

  static async getReviews(
    pharmacyId: string,
    query: GetReviewsQueryInput
  ): Promise<PaginationResult<IReview>> {
    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy || !pharmacy.isActive) {
      throw ApiError.notFound('Pharmacy not found');
    }

    const pageNum = parseInt(String(query.page ?? '1'), 10);
    const limitNum = parseInt(String(query.limit ?? '10'), 10);
    const skip = (pageNum - 1) * limitNum;

    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      Review.find({ pharmacyId })
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'name'),
      Review.countDocuments({ pharmacyId }),
    ]);


    return {
      items,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    };
  }
}

