import { Router } from 'express';
import { portalController } from './controller';
import { validate } from '../../middleware/validate';
import {
  GrantConsentSchema,
  SetRestrictedRecordSchema,
  BreakGlassAccessSchema,
  SubmitDataRequestSchema
} from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);

// Patient health timeline (only finalized items)
router.get(
  '/timeline/:patientId',
  requireRoles('PATIENT'),
  portalController.getTimeline
);

// "Who accessed my data" transparent plain-language audit log
router.get(
  '/access-log/:patientId',
  requireRoles('PATIENT'),
  portalController.getAccessAudit
);

// Consent: Grant access to doctor/department
router.post(
  '/consent',
  requireRoles('PATIENT'),
  validate({ body: GrantConsentSchema }),
  portalController.grantConsent
);

// Consent: Revoke access
router.delete(
  '/consent/:id',
  requireRoles('PATIENT'),
  portalController.revokeConsent
);

// Restricted record setting (Locking sensitive notes/reports)
router.post(
  '/restricted-records',
  requireRoles('PATIENT'),
  validate({ body: SetRestrictedRecordSchema }),
  portalController.setRestricted
);

// Emergency Break-Glass access (Doctor only with mandatory clinical reason)
router.post(
  '/break-glass',
  apiWriteLimiter,
  requireRoles(StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: BreakGlassAccessSchema }),
  portalController.breakGlass
);

// DPDP 2023: Submit privacy right request (Correction, Erasure, Grievance)
router.post(
  '/privacy-requests',
  requireRoles('PATIENT'),
  validate({ body: SubmitDataRequestSchema }),
  portalController.submitDataRequest
);

// DPDP 2023: Export all patient health data (ZIP/JSON)
router.get(
  '/export/:patientId',
  requireRoles('PATIENT'),
  portalController.exportData
);

export default router;
