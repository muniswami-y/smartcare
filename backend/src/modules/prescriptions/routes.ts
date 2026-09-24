import { Router } from 'express';
import { prescriptionController } from './controller';
import { validate } from '../../middleware/validate';
import { CreatePrescriptionSchema, CancelPrescriptionSchema } from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);

// Pre-flight safety check
router.post(
  '/check-safety',
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  prescriptionController.checkSafety
);

// Create e-prescription
router.post(
  '/',
  apiWriteLimiter,
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: CreatePrescriptionSchema }),
  prescriptionController.create
);

// Copy previous prescription
router.get(
  '/patient/:patientId/previous',
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  prescriptionController.copyPrevious
);

// Cancel prescription
router.post(
  '/:id/cancel',
  apiWriteLimiter,
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: CancelPrescriptionSchema }),
  prescriptionController.cancel
);

// Print / View prescription (Doctor, Pharmacist, Nurse, Admin, Patient)
router.get(
  '/:id/print',
  requireRoles(StaffRole.DOCTOR, StaffRole.PHARMACIST, StaffRole.NURSE, StaffRole.ADMIN, 'PATIENT'),
  prescriptionController.print
);

export default router;
