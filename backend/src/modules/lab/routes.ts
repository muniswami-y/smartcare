import { Router } from 'express';
import { labController } from './controller';
import { validate } from '../../middleware/validate';
import {
  CollectSampleSchema,
  RejectSampleSchema,
  RecordLabResultsSchema,
  SignLabReportSchema,
  CreateShareLinkSchema
} from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const router = Router();

// Public share link access (consent token authenticated)
router.get('/share/:token', labController.accessShare);

router.use(authenticate);

// Lab worklist
router.get(
  '/worklist',
  requireRoles(StaffRole.LAB_TECH, StaffRole.RADIOLOGIST, StaffRole.ADMIN),
  labController.getWorklist
);

// Collect sample
router.post(
  '/samples/collect',
  apiWriteLimiter,
  requireRoles(StaffRole.LAB_TECH, StaffRole.NURSE, StaffRole.ADMIN),
  validate({ body: CollectSampleSchema }),
  labController.collectSample
);

// Reject sample
router.post(
  '/samples/:sampleId/reject',
  requireRoles(StaffRole.LAB_TECH, StaffRole.ADMIN),
  validate({ body: RejectSampleSchema }),
  labController.rejectSample
);

// Record results
router.post(
  '/results',
  apiWriteLimiter,
  requireRoles(StaffRole.LAB_TECH, StaffRole.ADMIN),
  validate({ body: RecordLabResultsSchema }),
  labController.recordResults
);

// Sign & lock lab report (Radiologist / Pathologist / Admin)
router.post(
  '/reports/sign',
  apiWriteLimiter,
  requireRoles(StaffRole.RADIOLOGIST, StaffRole.ADMIN),
  validate({ body: SignLabReportSchema }),
  labController.signReport
);

// Print report
router.get(
  '/reports/:id/print',
  requireRoles(StaffRole.LAB_TECH, StaffRole.RADIOLOGIST, StaffRole.DOCTOR, StaffRole.ADMIN, 'PATIENT'),
  labController.printReport
);

// Create consent-based share link
router.post(
  '/share',
  apiWriteLimiter,
  requireRoles(StaffRole.LAB_TECH, StaffRole.RADIOLOGIST, StaffRole.ADMIN, 'PATIENT'),
  validate({ body: CreateShareLinkSchema }),
  labController.createShare
);

export default router;
