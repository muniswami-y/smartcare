import { Router } from 'express';
import { consultationController } from './controller';
import { validate } from '../../middleware/validate';
import {
  RecordVitalsSchema,
  SaveDraftConsultationSchema,
  CreateOrSaveConsultationSchema,
  LockConsultationSchema,
  AmendConsultationSchema,
  CreateDiagnosticOrderSchema
} from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);

// Create or save consultation / triage vitals (Doctor, Nurse, Admin)
router.post(
  '/',
  requireRoles(StaffRole.DOCTOR, StaffRole.NURSE, StaffRole.ADMIN),
  validate({ body: CreateOrSaveConsultationSchema }),
  consultationController.createOrSave
);

// Nurse and Doctor vitals recording
router.post(
  '/vitals',
  requireRoles(StaffRole.NURSE, StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: RecordVitalsSchema }),
  consultationController.recordVitals
);

// Save consultation draft (Doctor only)
router.post(
  '/draft',
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: SaveDraftConsultationSchema }),
  consultationController.saveDraft
);

// Lock & finalize consultation (Doctor only)
router.post(
  '/:id/lock',
  apiWriteLimiter,
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: LockConsultationSchema }),
  consultationController.lock
);

// Amend finalized consultation (Doctor only with justification)
router.post(
  '/:id/amend',
  apiWriteLimiter,
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: AmendConsultationSchema }),
  consultationController.amend
);

// Order diagnostic test (Doctor only)
router.post(
  '/orders/diagnostic',
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: CreateDiagnosticOrderSchema }),
  consultationController.orderDiagnostic
);

// View consultation
router.get(
  '/:id',
  requireRoles(StaffRole.DOCTOR, StaffRole.NURSE, StaffRole.RECEPTIONIST, StaffRole.ADMIN, 'PATIENT'),
  consultationController.getById
);

export default router;
