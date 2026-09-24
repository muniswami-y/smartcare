import { Router } from 'express';
import { adminController } from './controller';
import { validate } from '../../middleware/validate';
import {
  CreateStaffUserSchema,
  UpdateStaffRolesSchema,
  DeactivateStaffSchema,
  ResolveAlertSchema,
  LogExportSchema
} from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);

// Staff management
router.get(
  '/staff',
  requireRoles(StaffRole.ADMIN, StaffRole.MANAGER),
  adminController.listStaff
);

router.post(
  '/staff',
  apiWriteLimiter,
  requireRoles(StaffRole.ADMIN),
  validate({ body: CreateStaffUserSchema }),
  adminController.createStaff
);

router.put(
  '/staff/:id/roles',
  requireRoles(StaffRole.ADMIN),
  validate({ body: UpdateStaffRolesSchema }),
  adminController.updateRoles
);

router.post(
  '/staff/:id/deactivate',
  requireRoles(StaffRole.ADMIN),
  validate({ body: DeactivateStaffSchema }),
  adminController.deactivateStaff
);

// Audit viewer and cryptographic chain verification
router.get(
  '/audit-logs',
  requireRoles(StaffRole.ADMIN),
  adminController.getAuditLogs
);

router.get(
  '/audit-logs/verify-chain',
  requireRoles(StaffRole.ADMIN),
  adminController.verifyAuditChain
);

// System Alerts
router.get(
  '/alerts',
  requireRoles(StaffRole.ADMIN, StaffRole.MANAGER),
  adminController.listAlerts
);

router.post(
  '/alerts/:id/resolve',
  requireRoles(StaffRole.ADMIN),
  validate({ body: ResolveAlertSchema }),
  adminController.resolveAlert
);

// System Settings
router.get(
  '/settings',
  requireRoles(StaffRole.ADMIN),
  adminController.getSettings
);

router.put(
  '/settings/:key',
  requireRoles(StaffRole.ADMIN),
  adminController.updateSetting
);

// Log data exports
router.post(
  '/exports/log',
  requireRoles(StaffRole.ADMIN),
  validate({ body: LogExportSchema }),
  adminController.logExport
);

export default router;
