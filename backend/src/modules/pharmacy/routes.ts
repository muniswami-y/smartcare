import { Router } from 'express';
import { pharmacyController } from './controller';
import { validate } from '../../middleware/validate';
import { DispensePrescriptionSchema, GoodsReceiptSchema, StockAdjustmentSchema } from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const router = Router();

router.use(authenticate);

// Prescription queue arriving at pharmacy counter
router.get(
  '/queue',
  requireRoles(StaffRole.PHARMACIST, StaffRole.ADMIN),
  pharmacyController.getQueue
);

// Dispense prescription
router.post(
  '/dispense',
  apiWriteLimiter,
  requireRoles(StaffRole.PHARMACIST, StaffRole.ADMIN),
  validate({ body: DispensePrescriptionSchema }),
  pharmacyController.dispense
);

// Goods receipt (GRN)
router.post(
  '/goods-receipt',
  apiWriteLimiter,
  requireRoles(StaffRole.PHARMACIST, StaffRole.ADMIN),
  validate({ body: GoodsReceiptSchema }),
  pharmacyController.goodsReceipt
);

// Stock adjustment / Return / Write-off
router.post(
  '/adjust-stock',
  apiWriteLimiter,
  requireRoles(StaffRole.PHARMACIST, StaffRole.ADMIN),
  validate({ body: StockAdjustmentSchema }),
  pharmacyController.adjustStock
);

// Medicine catalog with active stock
router.get(
  '/medicines',
  requireRoles(StaffRole.PHARMACIST, StaffRole.DOCTOR, StaffRole.NURSE, StaffRole.ADMIN),
  pharmacyController.listMedicines
);

// Inventory low stock and expiry alerts
router.get(
  '/alerts',
  requireRoles(StaffRole.PHARMACIST, StaffRole.ADMIN, StaffRole.MANAGER),
  pharmacyController.getAlerts
);

export default router;
