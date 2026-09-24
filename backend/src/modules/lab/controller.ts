import { Request, Response, NextFunction } from 'express';
import { labService } from './service';

export class LabController {
  async getWorklist(req: Request, res: Response, next: NextFunction) {
    try {
      const list = await labService.getWorklist();
      return res.json({ success: true, data: list });
    } catch (err) {
      return next(err);
    }
  }

  async collectSample(req: Request, res: Response, next: NextFunction) {
    try {
      const sample = await labService.collectSample(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: sample });
    } catch (err) {
      return next(err);
    }
  }

  async rejectSample(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await labService.rejectSample(req.params.sampleId, req.body.rejectionReason, req.user!.id);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async recordResults(req: Request, res: Response, next: NextFunction) {
    try {
      const results = await labService.recordResults(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: results });
    } catch (err) {
      return next(err);
    }
  }

  async signReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await labService.signReport(req.body, req.user!.id);
      return res.json({ success: true, data: report });
    } catch (err) {
      return next(err);
    }
  }

  async printReport(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await labService.getPrintableReport(req.params.id);
      res.setHeader('Content-Type', 'text/html');
      return res.send(result.html);
    } catch (err) {
      return next(err);
    }
  }

  async createShare(req: Request, res: Response, next: NextFunction) {
    try {
      const link = await labService.createShareLink(req.body, req.user?.id);
      return res.status(201).json({ success: true, data: link });
    } catch (err) {
      return next(err);
    }
  }

  async accessShare(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await labService.accessShareLink(req.params.token, req.ip, req.get('user-agent'));
      if ('html' in result) {
        res.setHeader('Content-Type', 'text/html');
        return res.send(result.html);
      }
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }
}

export const labController = new LabController();
