import { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services/report.service';

function sendPdf(res: Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
}

export class ReportController {
  static async downloadInventoryReport(req: Request, res: Response, next: NextFunction) {
    try {
      const pharmacyId = req.query.pharmacyId as string | undefined;
      const buffer = await ReportService.generateInventoryReport(pharmacyId);
      const date = new Date().toISOString().slice(0, 10);
      sendPdf(res, buffer, `inventory-report-${date}.pdf`);
    } catch (error) {
      next(error);
    }
  }

  static async downloadOrdersReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { pharmacyId, from, to } = req.query as Record<string, string | undefined>;
      const buffer = await ReportService.generateOrdersReport(pharmacyId, from, to);
      const date = new Date().toISOString().slice(0, 10);
      sendPdf(res, buffer, `orders-report-${date}.pdf`);
    } catch (error) {
      next(error);
    }
  }

  static async downloadUsersReport(_req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await ReportService.generateUsersReport();
      const date = new Date().toISOString().slice(0, 10);
      sendPdf(res, buffer, `users-report-${date}.pdf`);
    } catch (error) {
      next(error);
    }
  }

  static async downloadRequestsReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { pharmacyId, from, to } = req.query as Record<string, string | undefined>;
      const buffer = await ReportService.generateRequestsReport(pharmacyId, from, to);
      const date = new Date().toISOString().slice(0, 10);
      sendPdf(res, buffer, `requests-report-${date}.pdf`);
    } catch (error) {
      next(error);
    }
  }
}
