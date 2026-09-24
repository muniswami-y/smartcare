import { Router } from 'express';
import { appointmentController } from './controller';
import { validate } from '../../middleware/validate';
import { BookAppointmentSchema, WalkInAppointmentSchema, CancelAppointmentSchema } from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);

// Slot check (accessible by staff & patient)
router.get(
  '/slots',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.NURSE, StaffRole.ADMIN, 'PATIENT'),
  appointmentController.getSlots
);

// List appointments
router.get(
  '/',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.NURSE, StaffRole.ADMIN, 'PATIENT'),
  appointmentController.list
);

// Book appointment
router.post(
  '/',
  apiWriteLimiter,
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.ADMIN, 'PATIENT'),
  validate({ body: BookAppointmentSchema }),
  appointmentController.book
);

// Walk-in booking (Receptionist & Doctor)
router.post(
  '/walk-in',
  apiWriteLimiter,
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: WalkInAppointmentSchema }),
  appointmentController.walkIn
);

// Check-in (Receptionist & Nurse)
router.post(
  '/:id/check-in',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.NURSE, StaffRole.ADMIN),
  appointmentController.checkIn
);

// Cancel appointment
router.post(
  '/:id/cancel',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.ADMIN, 'PATIENT'),
  validate({ body: CancelAppointmentSchema }),
  appointmentController.cancel
);

export default router;
