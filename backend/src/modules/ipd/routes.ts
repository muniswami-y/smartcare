import { Router } from 'express';
import { ipdController } from './controller';
import { validate } from '../../middleware/validate';
import {
  AdmitPatientSchema,
  TransferBedSchema,
  AddProgressNoteSchema,
  RecordIpdVitalsSchema,
  RecordMedicationAdministrationSchema,
  SignDischargeSummarySchema,
  UpdateDischargeChecklistSchema
} from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);

// Live bed board (accessible across clinical roles and reception)
router.get(
  '/bed-board',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.NURSE, StaffRole.DOCTOR, StaffRole.ADMIN),
  ipdController.getBedBoard
);

// Inpatient Admission
router.post(
  '/admissions',
  apiWriteLimiter,
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: AdmitPatientSchema }),
  ipdController.admit
);

// Bed Transfer
router.post(
  '/admissions/:id/transfer',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.NURSE, StaffRole.ADMIN),
  validate({ body: TransferBedSchema }),
  ipdController.transfer
);

// Add progress notes (Doctor only)
router.post(
  '/admissions/:id/progress-notes',
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: AddProgressNoteSchema }),
  ipdController.addProgressNote
);

// Inpatient Nursing Vitals
router.post(
  '/admissions/:id/vitals',
  requireRoles(StaffRole.NURSE, StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: RecordIpdVitalsSchema }),
  ipdController.recordVitals
);

// Medication Administration
router.post(
  '/medications/administer',
  requireRoles(StaffRole.NURSE, StaffRole.ADMIN),
  validate({ body: RecordMedicationAdministrationSchema }),
  ipdController.recordMedAdmin
);

// Update discharge checklist
router.put(
  '/admissions/:id/checklist',
  requireRoles(StaffRole.NURSE, StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  validate({ body: UpdateDischargeChecklistSchema }),
  ipdController.updateChecklist
);

// Sign discharge summary (Doctor only)
router.post(
  '/admissions/:id/discharge-summary',
  apiWriteLimiter,
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: SignDischargeSummarySchema }),
  ipdController.signDischargeSummary
);

// Complete discharge
router.post(
  '/admissions/:id/complete-discharge',
  apiWriteLimiter,
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  ipdController.completeDischarge
);

export default router;
