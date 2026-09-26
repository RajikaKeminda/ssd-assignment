import { Request, Response, NextFunction } from 'express';
import { PharmacyService } from '../services/pharmacy.service';
import { ApiResponse } from '../utils/api-response';
import { ApiError } from '../utils/api-error';

export class PharmacyController {
  static async createPharmacy(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();
      const pharmacy = await PharmacyService.createPharmacy(req.body, String(req.user._id));
      ApiResponse.created(res, pharmacy, 'Pharmacy registered successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getPharmacies(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PharmacyService.getPharmacies(req.query as any);
      ApiResponse.success(res, result, 'Pharmacies retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getPharmacyById(req: Request, res: Response, next: NextFunction) {
    try {
      const pharmacy = await PharmacyService.getPharmacyById(String(req.params.id));
      ApiResponse.success(res, pharmacy, 'Pharmacy retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updatePharmacy(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();
      const pharmacy = await PharmacyService.updatePharmacy(
        String(req.params.id),
        req.body,
        String(req.user._id),
        req.user.role
      );
      ApiResponse.success(res, pharmacy, 'Pharmacy updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async verifyPharmacy(req: Request, res: Response, next: NextFunction) {
    try {
      const pharmacy = await PharmacyService.verifyPharmacy(String(req.params.id));
      ApiResponse.success(res, pharmacy, 'Pharmacy verified successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deactivatePharmacy(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();
      const pharmacy = await PharmacyService.deactivatePharmacy(
        String(req.params.id),
        String(req.user._id),
        req.user.role
      );
      ApiResponse.success(res, pharmacy, 'Pharmacy deactivated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getNearbyPharmacies(req: Request, res: Response, next: NextFunction) {
    try {
      const pharmacies = await PharmacyService.findNearbyPharmacies(req.query as any);
      ApiResponse.success(res, pharmacies, 'Nearby pharmacies retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async addReview(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();
      const review = await PharmacyService.addReview(
        String(req.params.id),
        String(req.user._id),
        req.body
      );
      ApiResponse.created(res, review, 'Review added successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PharmacyService.getReviews(
        String(req.params.id),
        req.query as any
      );
      ApiResponse.success(res, result, 'Reviews retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}

