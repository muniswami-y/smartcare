import { Request, Response, NextFunction } from 'express';
import { adminService } from './service';

export class AdminController {
  async listStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const staff = await adminService.listStaff();
      return res.json({ success: true, data: staff });
    } catch (err) {
      return next(err);
    }
  }

  async createStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await adminService.createStaff(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: user });
    } catch (err) {
      return next(err);
    }
  }

  async updateRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.updateStaffRoles(req.params.id, req.body.roles, req.user!.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async deactivateStaff(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.deactivateStaff(req.params.id, req.body.reason, req.user!.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async getAuditLogs(req: Request, res: Response, next: NextFunction) {
    try {
      const { action, resourceType, page, limit } = req.query as any;
      const result = await adminService.getAuditLogs({
        action,
        resourceType,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined
      });
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async verifyAuditChain(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await adminService.verifyAuditLogIntegrity();
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async listAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as any;
      const alerts = await adminService.listAlerts(status);
      return res.json({ success: true, data: alerts });
    } catch (err) {
      return next(err);
    }
  }

  async resolveAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const resolved = await adminService.resolveAlert(req.params.id, req.body.resolutionNotes, req.user!.id);
      return res.json({ success: true, data: resolved });
    } catch (err) {
      return next(err);
    }
  }

  async getSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const settings = await adminService.getSettings();
      return res.json({ success: true, data: settings });
    } catch (err) {
      return next(err);
    }
  }

  async updateSetting(req: Request, res: Response, next: NextFunction) {
    try {
      const setting = await adminService.updateSetting(req.params.key, req.body.value, req.user!.id);
      return res.json({ success: true, data: setting });
    } catch (err) {
      return next(err);
    }
  }

  async logExport(req: Request, res: Response, next: NextFunction) {
    try {
      const { exportType, reason, filterJson } = req.body;
      const log = await adminService.logExport(exportType, reason, filterJson, req.user!.id);
      return res.status(201).json({ success: true, data: log });
    } catch (err) {
      return next(err);
    }
  }
}

export const adminController = new AdminController();
