import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './service';

export class AnalyticsController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await analyticsService.getDashboardKpis();
      return res.json({ success: true, data });
    } catch (err) {
      return next(err);
    }
  }

  async getOpdReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { startDate, endDate, format } = req.query as { startDate?: string; endDate?: string; format?: string };
      const records = await analyticsService.getOpdReport(startDate, endDate);

      if (format === 'csv') {
        const headers = ['appointmentCode', 'date', 'slot', 'doctor', 'department', 'status', 'type', 'diagnosis'];
        const csvRows = [
          headers.join(','),
          ...records.map((r: any) => headers.map((h) => `"${r[h] ?? ''}"`).join(','))
        ];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="opd_report.csv"');
        return res.send(csvRows.join('\n'));
      }

      return res.json({ success: true, data: records });
    } catch (err) {
      return next(err);
    }
  }

  async getRevenueReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { format } = req.query as { format?: string };
      const records = await analyticsService.getRevenueReport();

      if (format === 'csv') {
        const headers = ['billNumber', 'date', 'encounterType', 'status', 'subtotalRupees', 'discountRupees', 'totalRupees', 'paidRupees', 'balanceRupees', 'paymentCount'];
        const csvRows = [
          headers.join(','),
          ...records.map((r: any) => headers.map((h) => `"${r[h] ?? ''}"`).join(','))
        ];
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="revenue_report.csv"');
        return res.send(csvRows.join('\n'));
      }

      return res.json({ success: true, data: records });
    } catch (err) {
      return next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
