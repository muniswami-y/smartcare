import { Request, Response, NextFunction } from 'express';
import { consultationService } from './service';

export class ConsultationController {
  async recordVitals(req: Request, res: Response, next: NextFunction) {
    try {
      const vitals = await consultationService.recordVitals(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: vitals });
    } catch (err) {
      return next(err);
    }
  }

  async saveDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const consult = await consultationService.saveDraftConsultation(req.body, req.user!.id);
      return res.json({ success: true, data: consult });
    } catch (err) {
      return next(err);
    }
  }

  async lock(req: Request, res: Response, next: NextFunction) {
    try {
      const locked = await consultationService.lockConsultation(req.params.id, req.body, req.user!.id);
      return res.json({ success: true, data: locked });
    } catch (err) {
      return next(err);
    }
  }

  async amend(req: Request, res: Response, next: NextFunction) {
    try {
      const amended = await consultationService.amendConsultation(req.params.id, req.body, req.user!.id);
      return res.json({ success: true, data: amended });
    } catch (err) {
      return next(err);
    }
  }

  async orderDiagnostic(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await consultationService.orderDiagnosticTest(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: order });
    } catch (err) {
      return next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const consult = await consultationService.getConsultationById(req.params.id, req.user?.id);
      return res.json({ success: true, data: consult });
    } catch (err) {
      return next(err);
    }
  }
}

export const consultationController = new ConsultationController();
