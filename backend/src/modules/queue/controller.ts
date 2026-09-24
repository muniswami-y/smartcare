import { Request, Response, NextFunction } from 'express';
import { queueService } from './service';

export class QueueController {
  async getDoctorQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const doctorId = req.params.doctorId || req.user?.doctorProfileId;
      if (!doctorId) {
        return res.status(400).json({ success: false, message: 'doctorId is required.' });
      }
      const date = req.query.date as string | undefined;
      const queue = await queueService.getDoctorQueue(doctorId, date);
      return res.json({ success: true, data: queue });
    } catch (err) {
      return next(err);
    }
  }

  async getPatientQueueStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = await queueService.getPatientQueueStatus(req.params.appointmentId);
      return res.json({ success: true, data: status });
    } catch (err) {
      return next(err);
    }
  }

  async callNext(req: Request, res: Response, next: NextFunction) {
    try {
      const doctorId = req.params.doctorId || req.user?.doctorProfileId;
      if (!doctorId) {
        return res.status(400).json({ success: false, message: 'doctorId is required.' });
      }
      const result = await queueService.callNextPatient(doctorId);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async markNoShow(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await queueService.markNoShow(req.params.appointmentId);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }
}

export const queueController = new QueueController();
