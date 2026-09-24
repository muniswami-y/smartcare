import { z } from 'zod';
import { EncounterType, PaymentMethod } from '@caresmart/database';

export const GenerateBillFromChargesSchema = z.object({
  patientId: z.string(),
  encounterType: z.nativeEnum(EncounterType),
  encounterId: z.string(),
  pendingChargeIds: z.array(z.string()).min(1)
});

export const RequestDiscountSchema = z.object({
  billId: z.string(),
  amountPaise: z.number().int().min(1),
  reason: z.string().min(5)
});

export const ApproveDiscountSchema = z.object({
  discountId: z.string(),
  approved: z.boolean(),
  notes: z.string().optional()
});

export const RecordPaymentSchema = z.object({
  billId: z.string(),
  patientId: z.string(),
  amountPaise: z.number().int().min(1),
  paymentMethod: z.nativeEnum(PaymentMethod),
  idempotencyKey: z.string().min(6),
  transactionReference: z.string().optional(),
  cashierShiftId: z.string().optional()
});

export const CreateCreditNoteSchema = z.object({
  billId: z.string(),
  amountPaise: z.number().int().min(1),
  reason: z.string().min(5)
});

export const RequestRefundSchema = z.object({
  billId: z.string(),
  paymentId: z.string(),
  amountPaise: z.number().int().min(1),
  reason: z.string().min(5)
});

export const StartCashierShiftSchema = z.object({
  openingCashPaise: z.number().int().min(0)
});

export const CloseCashierShiftSchema = z.object({
  closingCashPaise: z.number().int().min(0),
  notes: z.string().optional()
});

export const CreateInsuranceClaimSchema = z.object({
  billId: z.string(),
  patientId: z.string(),
  providerName: z.string().min(2),
  policyNumber: z.string().min(2),
  claimedAmountPaise: z.number().int().min(1),
  preAuthAmountPaise: z.number().int().default(0),
  notes: z.string().optional()
});
