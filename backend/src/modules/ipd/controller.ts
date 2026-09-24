import { Request, Response, NextFunction } from 'express';
import { ipdService } from './service';

export class IpdController {
  async getBedBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const board = await ipdService.getLiveBedBoard();
      return res.json({ success: true, data: board });
    } catch (err) {
      return next(err);
    }
  }

  async admit(req: Request, res: Response, next: NextFunction) {
    try {
      const admission = await ipdService.admitPatient(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: admission });
    } catch (err) {
      return next(err);
    }
  }

  async transfer(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ipdService.transferBed(req.params.id, req.body, req.user!.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async addProgressNote(req: Request, res: Response, next: NextFunction) {
    try {
      const note = await ipdService.addProgressNote(req.params.id, req.body, req.user!.id);
      return res.status(201).json({ success: true, data: note });
    } catch (err) {
      return next(err);
    }
  }

  async recordVitals(req: Request, res: Response, next: NextFunction) {
    try {
      const vitals = await ipdService.recordIpdVitals(req.params.id, req.body, req.user!.id);
      return res.status(201).json({ success: true, data: vitals });
    } catch (err) {
      return next(err);
    }
  }

  async recordMedAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = await ipdService.createMedicationAdministration(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: admin });
    } catch (err) {
      return next(err);
    }
  }

  async updateChecklist(req: Request, res: Response, next: NextFunction) {
    try {
      const checklist = await ipdService.updateDischargeChecklist(req.params.id, req.body, req.user!.id);
      return res.json({ success: true, data: checklist });
    } catch (err) {
      return next(err);
    }
  }

  async signDischargeSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await ipdService.signDischargeSummary(req.params.id, req.body, req.user!.id);
      return res.json({ success: true, data: summary });
    } catch (err) {
      return next(err);
    }
  }

  async completeDischarge(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ipdService.completeDischarge(req.params.id, req.user!.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }
}

export const ipdController = new IpdController();
