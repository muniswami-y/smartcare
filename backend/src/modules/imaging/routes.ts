import { Router } from 'express';
import multer from 'multer';
import { imagingController } from './controller';
import { validate } from '../../middleware/validate';
import { CreateStudySchema, SignRadiologyReportSchema } from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

const router = Router();

router.use(authenticate);

// Imaging worklist
router.get(
  '/worklist',
  requireRoles(StaffRole.RADIOLOGIST, StaffRole.LAB_TECH, StaffRole.ADMIN),
  imagingController.getWorklist
);

// Create study metadata
router.post(
  '/studies',
  apiWriteLimiter,
  requireRoles(StaffRole.RADIOLOGIST, StaffRole.LAB_TECH, StaffRole.ADMIN),
  validate({ body: CreateStudySchema }),
  imagingController.createStudy
);

// Upload study image / film / scan / DICOM
router.post(
  '/studies/:studyId/upload',
  requireRoles(StaffRole.RADIOLOGIST, StaffRole.LAB_TECH, StaffRole.ADMIN),
  upload.single('file'),
  imagingController.uploadFile
);

// Secure streaming view of media file
router.get(
  '/media/:mediaId',
  requireRoles(StaffRole.RADIOLOGIST, StaffRole.DOCTOR, StaffRole.ADMIN, 'PATIENT'),
  imagingController.downloadFile
);

// Sign radiology report
router.post(
  '/reports/sign',
  apiWriteLimiter,
  requireRoles(StaffRole.RADIOLOGIST, StaffRole.ADMIN),
  validate({ body: SignRadiologyReportSchema }),
  imagingController.signReport
);

export default router;
