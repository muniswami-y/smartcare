import { Request, Response, NextFunction } from 'express';
import { portalService } from './service';

export class PortalController {
  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const patientAccountId = req.patient!.patientAccountId;
      const patientId = req.params.patientId || req.patient!.activeFamilyMemberId;
      const timeline = await portalService.getHealthTimeline(patientAccountId, patientId!);
      return res.json({ success: true, data: timeline });
    } catch (err) {
      return next(err);
    }
  }

  async getAccessAudit(req: Request, res: Response, next: NextFunction) {
    try {
      const patientAccountId = req.patient!.patientAccountId;
      const patientId = req.params.patientId || req.patient!.activeFamilyMemberId;
      const audit = await portalService.getAccessAuditLog(patientAccountId, patientId!);
      return res.json({ success: true, data: audit });
    } catch (err) {
      return next(err);
    }
  }

  async grantConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const patientAccountId = req.patient!.patientAccountId;
      const consent = await portalService.grantConsent(patientAccountId, req.body);
      return res.status(201).json({ success: true, data: consent });
    } catch (err) {
      return next(err);
    }
  }

  async revokeConsent(req: Request, res: Response, next: NextFunction) {
    try {
      const patientAccountId = req.patient!.patientAccountId;
      const result = await portalService.revokeConsent(patientAccountId, req.params.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async setRestricted(req: Request, res: Response, next: NextFunction) {
    try {
      const patientAccountId = req.patient!.patientAccountId;
      const result = await portalService.setRestrictedRecord(patientAccountId, req.body);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async breakGlass(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await portalService.emergencyBreakGlass(req.user!.id, req.body);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async submitDataRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const patientAccountId = req.patient!.patientAccountId;
      const request = await portalService.submitDataRequest(patientAccountId, req.body);
      return res.status(201).json({ success: true, data: request });
    } catch (err) {
      return next(err);
    }
  }

  async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const patientAccountId = req.patient!.patientAccountId;
      const patientId = req.params.patientId || req.patient!.activeFamilyMemberId;
      const data = await portalService.generateDataExport(patientAccountId, patientId!);
      return res.json({ success: true, data });
    } catch (err) {
      return next(err);
    }
  }
}

export const portalController = new PortalController();
