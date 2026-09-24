import { Router } from 'express';
import { queueController } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';

const router = Router();

router.use(authenticate);

// Doctor and reception queue monitoring (polling friendly)
router.get(
  '/doctor/:doctorId',
  requireRoles(StaffRole.DOCTOR, StaffRole.RECEPTIONIST, StaffRole.NURSE, StaffRole.ADMIN),
  queueController.getDoctorQueue
);

// Patient specific queue status
router.get(
  '/patient-status/:appointmentId',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.NURSE, StaffRole.ADMIN, 'PATIENT'),
  queueController.getPatientQueueStatus
);

// Call next patient (Doctor only)
router.post(
  '/doctor/:doctorId/call-next',
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  queueController.callNext
);

// Mark no-show
router.post(
  '/appointments/:appointmentId/no-show',
  requireRoles(StaffRole.DOCTOR, StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  queueController.markNoShow
);

export default router;
