import { Router } from 'express';
import { patientController } from './controller';
import { validate } from '../../middleware/validate';
import { RegisterPatientSchema, UpdatePatientSchema, AddAllergySchema, MergePatientSchema } from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);

// Search patients
router.get(
  '/search',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.NURSE, StaffRole.ADMIN),
  patientController.search
);

// Register patient
router.post(
  '/',
  apiWriteLimiter,
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.NURSE, StaffRole.ADMIN),
  validate({ body: RegisterPatientSchema }),
  patientController.register
);

// Get patient details by ID
router.get(
  '/:id',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.NURSE, StaffRole.PHARMACIST, StaffRole.LAB_TECH, StaffRole.RADIOLOGIST, StaffRole.ADMIN),
  patientController.getById
);

// Update patient
router.put(
  '/:id',
  apiWriteLimiter,
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.DOCTOR, StaffRole.ADMIN),
  validate({ body: UpdatePatientSchema }),
  patientController.update
);

// Add patient allergy
router.post(
  '/:id/allergies',
  requireRoles(StaffRole.DOCTOR, StaffRole.NURSE, StaffRole.ADMIN),
  validate({ body: AddAllergySchema }),
  patientController.addAllergy
);

// Merge temporary emergency record
router.post(
  '/merge',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  validate({ body: MergePatientSchema }),
  patientController.merge
);

export default router;
