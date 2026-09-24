import { Request, Response, NextFunction } from 'express';
import { pharmacyService } from './service';

export class PharmacyController {
  async getQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const queue = await pharmacyService.getPrescriptionQueue();
      return res.json({ success: true, data: queue });
    } catch (err) {
      return next(err);
    }
  }

  async dispense(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pharmacyService.dispense(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async goodsReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pharmacyService.recordGoodsReceipt(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await pharmacyService.adjustStock(req.body, req.user!.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async listMedicines(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, controlledOnly } = req.query as { search?: string; controlledOnly?: string };
      const medicines = await pharmacyService.listMedicines({
        search,
        controlledOnly: controlledOnly === 'true'
      });
      return res.json({ success: true, data: medicines });
    } catch (err) {
      return next(err);
    }
  }

  async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const alerts = await pharmacyService.getInventoryAlerts();
      return res.json({ success: true, data: alerts });
    } catch (err) {
      return next(err);
    }
  }
}

export const pharmacyController = new PharmacyController();
