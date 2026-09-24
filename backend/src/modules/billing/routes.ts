import { Router } from 'express';
import { billingController } from './controller';
import { validate } from '../../middleware/validate';
import {
  GenerateBillFromChargesSchema,
  RequestDiscountSchema,
  RecordPaymentSchema,
  CreateCreditNoteSchema,
  StartCashierShiftSchema,
  CloseCashierShiftSchema
} from './schemas';
import { authenticate } from '../../middleware/auth';
import { requireRoles } from '../../middleware/rbac';
import { StaffRole } from '@caresmart/database';
import { apiWriteLimiter } from '../../middleware/rateLimit';

const router = Router();

// Public Price List (Open to public for price transparency)
router.get('/public-prices', billingController.getPublicPrices);

router.use(authenticate);

// Pending charges
router.get(
  '/pending-charges/:patientId',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN, 'PATIENT'),
  billingController.getPendingCharges
);

// Generate Bill
router.post(
  '/generate',
  apiWriteLimiter,
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  validate({ body: GenerateBillFromChargesSchema }),
  billingController.generateBill
);

// Apply Discount
router.post(
  '/discounts',
  apiWriteLimiter,
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  validate({ body: RequestDiscountSchema }),
  billingController.applyDiscount
);

// Counter Payment Recording (Cashier/Reception)
router.post(
  '/payments',
  apiWriteLimiter,
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  validate({ body: RecordPaymentSchema }),
  billingController.recordPayment
);

// Razorpay Order Creation (for Patient Portal or Counter online checkout)
router.post(
  '/razorpay/create-order',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN, 'PATIENT'),
  billingController.createRazorpayOrder
);

// Verify Razorpay Payment
router.post(
  '/razorpay/verify',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN, 'PATIENT'),
  billingController.verifyRazorpayPayment
);

// Finalize bill
router.post(
  '/:id/finalize',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  billingController.finalizeBill
);

// Credit note creation
router.post(
  '/credit-notes',
  apiWriteLimiter,
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  validate({ body: CreateCreditNoteSchema }),
  billingController.createCreditNote
);

// Cashier Shifts
router.post(
  '/shifts/start',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  validate({ body: StartCashierShiftSchema }),
  billingController.startShift
);

router.post(
  '/shifts/:id/close',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN),
  validate({ body: CloseCashierShiftSchema }),
  billingController.closeShift
);

// Print bill & receipt
router.get(
  '/:id/print',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN, 'PATIENT'),
  billingController.printBill
);

router.get(
  '/receipts/:id/print',
  requireRoles(StaffRole.RECEPTIONIST, StaffRole.ADMIN, 'PATIENT'),
  billingController.printReceipt
);

export default router;
