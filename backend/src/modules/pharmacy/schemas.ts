import { z } from 'zod';
import { MedicineForm, StockMovementType } from '@caresmart/database';

export const DispenseItemRequestSchema = z.object({
  prescriptionItemId: z.string(),
  medicineId: z.string(),
  quantityToDispense: z.number().int().min(1)
});

export const DispensePrescriptionSchema = z.object({
  prescriptionId: z.string(),
  patientId: z.string(),
  items: z.array(DispenseItemRequestSchema).min(1),
  overrideAllergyReason: z.string().optional()
});

export const GoodsReceiptSchema = z.object({
  supplierId: z.string(),
  medicineId: z.string(),
  batchNumber: z.string().min(1),
  purchasePricePaise: z.number().int().min(0),
  mrpPaise: z.number().int().min(0),
  salePricePaise: z.number().int().min(0),
  quantity: z.number().int().min(1),
  expiryDate: z.string(), // ISO or YYYY-MM-DD
  barcode: z.string().optional()
});

export const StockAdjustmentSchema = z.object({
  batchId: z.string(),
  movementType: z.enum(['ADJUSTMENT', 'RETURN', 'WRITE_OFF']),
  quantityChange: z.number().int(), // Positive or negative
  notes: z.string().min(3)
});

export const CreateMedicineSchema = z.object({
  code: z.string().min(2),
  genericName: z.string().min(2),
  brandName: z.string().min(2),
  form: z.nativeEnum(MedicineForm),
  strength: z.string().min(1),
  uom: z.string().min(1),
  isControlled: z.boolean().default(false),
  reorderLevel: z.number().int().default(50)
});
