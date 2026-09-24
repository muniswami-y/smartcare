import { Router } from 'express';
import { analyticsController } from './controller';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';

const router = Router();

router.use(authenticate);

// Main aggregate dashboard (Accessible to MANAGER and ADMIN)
router.get(
  '/dashboard',
  requireRoles(StaffRole.MANAGER, StaffRole.ADMIN),
  analyticsController.getDashboard
);

// Reports with CSV / JSON export
router.get(
  '/reports/opd',
  requireRoles(StaffRole.MANAGER, StaffRole.ADMIN),
  analyticsController.getOpdReport
);

router.get(
  '/reports/revenue',
  requireRoles(StaffRole.MANAGER, StaffRole.ADMIN),
  analyticsController.getRevenueReport
);

export default router;
