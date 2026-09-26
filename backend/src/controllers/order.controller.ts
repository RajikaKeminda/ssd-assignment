import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service';
import { ApiResponse } from '../utils/api-response';
import { ApiError } from '../utils/api-error';

export class OrderController {
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();
      const order = await OrderService.createOrder(req.body, String(req.user._id));
      ApiResponse.created(res, order, 'Order created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, paymentStatus, page, limit, sortBy, sortOrder } = req.query;
      const result = await OrderService.getOrders(
        {
          status: status as any,
          paymentStatus: paymentStatus as string,
        },
        {
          page: parseInt(String(page ?? '1')),
          limit: parseInt(String(limit ?? '10')),
          sortBy: String(sortBy ?? 'createdAt'),
          sortOrder: (String(sortOrder ?? 'desc')) as 'asc' | 'desc',
        }
      );
      ApiResponse.success(res, result, 'Orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await OrderService.getOrderById(String(req.params.id));
      ApiResponse.success(res, order, 'Order retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await OrderService.updateOrder(String(req.params.id), req.body);
      ApiResponse.success(res, order, 'Order updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await OrderService.updateOrderStatus(String(req.params.id), req.body);
      ApiResponse.success(res, order, 'Order status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await OrderService.processPayment(String(req.params.id), req.body);
      ApiResponse.success(res, order, 'Payment processed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteOrder(req: Request, res: Response, next: NextFunction) {
    try {
      await OrderService.deleteOrder(String(req.params.id));
      ApiResponse.success(res, null, 'Order deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw ApiError.unauthorized();
      const order = await OrderService.cancelOrder(
        String(req.params.id),
        req.body,
        String(req.user._id),
        req.user.role
      );
      ApiResponse.success(res, order, 'Order cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getUserOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, sortBy, sortOrder } = req.query;
      const result = await OrderService.getUserOrders(String(req.params.userId), {
        page: parseInt(String(page ?? '1')),
        limit: parseInt(String(limit ?? '10')),
        sortBy: String(sortBy ?? 'createdAt'),
        sortOrder: (String(sortOrder ?? 'desc')) as 'asc' | 'desc',
      });
      ApiResponse.success(res, result, 'User orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getPharmacyOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, sortBy, sortOrder } = req.query;
      const result = await OrderService.getPharmacyOrders(String(req.params.pharmacyId), {
        page: parseInt(String(page ?? '1')),
        limit: parseInt(String(limit ?? '10')),
        sortBy: String(sortBy ?? 'createdAt'),
        sortOrder: (String(sortOrder ?? 'desc')) as 'asc' | 'desc',
      });
      ApiResponse.success(res, result, 'Pharmacy orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async assignDeliveryPartner(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await OrderService.assignDeliveryPartner(String(req.params.id), req.body);
      ApiResponse.success(res, order, 'Delivery partner assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getDeliveryTracking(req: Request, res: Response, next: NextFunction) {
    try {
      const tracking = await OrderService.getDeliveryTracking(String(req.params.id));
      ApiResponse.success(res, tracking, 'Tracking info retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async generateInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { buffer, orderNumber } = await OrderService.generateInvoice(String(req.params.id));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${orderNumber}.pdf"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async getDeliveryPartnerOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, sortBy, sortOrder } = req.query;
      const result = await OrderService.getDeliveryPartnerOrders(String(req.params.partnerId), {
        page: parseInt(String(page ?? '1')),
        limit: parseInt(String(limit ?? '10')),
        sortBy: String(sortBy ?? 'createdAt'),
        sortOrder: (String(sortOrder ?? 'desc')) as 'asc' | 'desc',
      });
      ApiResponse.success(res, result, 'Delivery partner orders retrieved successfully');
    } catch (error) {
      next(error);
    }
  }
}
