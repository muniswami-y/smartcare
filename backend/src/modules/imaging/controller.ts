import { Request, Response, NextFunction } from 'express';
import { imagingService } from './service';
import { AppError } from '../../middleware/errorHandler';

export class ImagingController {
  async getWorklist(req: Request, res: Response, next: NextFunction) {
    try {
      const list = await imagingService.getWorklist();
      return res.json({ success: true, data: list });
    } catch (err) {
      return next(err);
    }
  }

  async createStudy(req: Request, res: Response, next: NextFunction) {
    try {
      const study = await imagingService.createStudy(req.body, req.user!.id);
      return res.status(201).json({ success: true, data: study });
    } catch (err) {
      return next(err);
    }
  }

  async uploadFile(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded.', 400, 'FILE_MISSING');
      }
      const media = await imagingService.uploadStudyFile(req.params.studyId, req.file, req.user!.id);
      return res.status(201).json({ success: true, data: media });
    } catch (err) {
      return next(err);
    }
  }

  async downloadFile(req: Request, res: Response, next: NextFunction) {
    try {
      const { stream, media } = await imagingService.getFileStream(req.params.mediaId, req.user?.id);
      res.setHeader('Content-Type', media.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${media.originalName}"`);
      stream.pipe(res);
    } catch (err) {
      return next(err);
    }
  }

  async signReport(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await imagingService.signRadiologyReport(req.body, req.user!.id);
      return res.json({ success: true, data: report });
    } catch (err) {
      return next(err);
    }
  }
}

export const imagingController = new ImagingController();
