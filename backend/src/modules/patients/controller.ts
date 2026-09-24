import { Request, Response, NextFunction } from 'express';
import { patientService } from './service';

export class PatientController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await patientService.registerPatient(req.body, req.user?.id);
      return res.status(201).json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, phone, code } = req.query as { q?: string; phone?: string; code?: string };
      const patients = await patientService.searchPatients({ q, phone, code });
      return res.json({ success: true, data: patients });
    } catch (err) {
      return next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const patient = await patientService.getPatientById(req.params.id, req.user?.id);
      return res.json({ success: true, data: patient });
    } catch (err) {
      return next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await patientService.updatePatient(req.params.id, req.body, req.user!.id);
      return res.json({ success: true, data: updated });
    } catch (err) {
      return next(err);
    }
  }

  async addAllergy(req: Request, res: Response, next: NextFunction) {
    try {
      const allergy = await patientService.addAllergy(req.params.id, req.body, req.user!.id);
      return res.status(201).json({ success: true, data: allergy });
    } catch (err) {
      return next(err);
    }
  }

  async merge(req: Request, res: Response, next: NextFunction) {
    try {
      const { temporaryPatientId, targetPatientId, mergeReason } = req.body;
      const result = await patientService.mergePatients(temporaryPatientId, targetPatientId, mergeReason, req.user!.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }
}

export const patientController = new PatientController();
