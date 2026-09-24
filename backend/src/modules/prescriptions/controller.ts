import { Request, Response, NextFunction } from 'express';
import { prescriptionService } from './service';

export class PrescriptionController {
  async checkSafety(req: Request, res: Response, next: NextFunction) {
    try {
      const { patientId, items } = req.body;
      const warnings = await prescriptionService.checkSafety(patientId, items);
      return res.json({ success: true, data: { warnings } });
    } catch (err) {
      return next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await prescriptionService.createPrescription(req.body, req.user!.id);
      return res.status(201).json(result);
    } catch (err) {
      return next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await prescriptionService.cancelPrescription(req.params.id, req.body.cancelReason, req.user!.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async copyPrevious(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await prescriptionService.copyPreviousPrescription(req.params.patientId);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async print(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await prescriptionService.getPrintablePrescription(req.params.id);
      res.setHeader('Content-Type', 'text/html');
      return res.send(result.html);
    } catch (err) {
      return next(err);
    }
  }
}

export const prescriptionController = new PrescriptionController();
