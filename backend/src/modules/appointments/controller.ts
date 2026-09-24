import { Request, Response, NextFunction } from 'express';
import { appointmentService } from './service';

export class AppointmentController {
  async getSlots(req: Request, res: Response, next: NextFunction) {
    try {
      const { doctorId, date } = req.query as { doctorId: string; date: string };
      const slots = await appointmentService.getDoctorAvailableSlots(doctorId, date);
      return res.json({ success: true, data: slots });
    } catch (err) {
      return next(err);
    }
  }

  async book(req: Request, res: Response, next: NextFunction) {
    try {
      const appt = await appointmentService.bookAppointment(req.body, req.user?.id);
      return res.status(201).json({ success: true, data: appt });
    } catch (err) {
      return next(err);
    }
  }

  async walkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const appt = await appointmentService.bookWalkIn(req.body, req.user?.id);
      return res.status(201).json({ success: true, data: appt });
    } catch (err) {
      return next(err);
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const appt = await appointmentService.checkInAppointment(req.params.id, req.user!.id);
      return res.json({ success: true, data: appt });
    } catch (err) {
      return next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const appt = await appointmentService.cancelAppointment(req.params.id, req.body.reason, req.user?.id);
      return res.json({ success: true, data: appt });
    } catch (err) {
      return next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { doctorId, date, patientId, status } = req.query as any;
      const appts = await appointmentService.listAppointments({ doctorId, date, patientId, status });
      return res.json({ success: true, data: appts });
    } catch (err) {
      return next(err);
    }
  }
}

export const appointmentController = new AppointmentController();
