import { Request, Response, NextFunction } from 'express';
import { DeliveryPartnerService } from '../services/delivery-partner.service';
import { ApiResponse } from '../utils/api-response';

export class DeliveryPartnerController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const partner = await DeliveryPartnerService.create(req.body);
      ApiResponse.created(res, partner, 'Delivery partner created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const partner = await DeliveryPartnerService.getById(String(req.params.id));
      ApiResponse.success(res, partner, 'Delivery partner retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive, page, limit, sortBy, sortOrder } = req.query;
      const filter: { isActive?: boolean } = {};
      if (isActive === 'true') filter.isActive = true;
      if (isActive === 'false') filter.isActive = false;

      const result = await DeliveryPartnerService.list(filter, {
        page: parseInt(String(page ?? '1')),
        limit: parseInt(String(limit ?? '10')),
        sortBy: String(sortBy ?? 'createdAt'),
        sortOrder: (String(sortOrder ?? 'desc')) as 'asc' | 'desc',
      });
      ApiResponse.success(res, result, 'Delivery partners retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const partner = await DeliveryPartnerService.update(String(req.params.id), req.body);
      ApiResponse.success(res, partner, 'Delivery partner updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await DeliveryPartnerService.delete(String(req.params.id));
      ApiResponse.success(res, null, 'Delivery partner deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}
