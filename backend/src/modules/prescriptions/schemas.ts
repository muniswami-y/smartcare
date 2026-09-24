import { z } from 'zod';

export const PrescriptionItemInputSchema = z.object({
  medicineId: z.string(),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  durationDays: z.number().int().min(1).max(365),
  route: z.string().default('Oral'),
  instructions: z.string().optional(),
  quantity: z.number().int().min(1)
});

export const CreatePrescriptionSchema = z.object({
  consultationId: z.string(),
  patientId: z.string(),
  doctorId: z.string(),
  items: z.array(PrescriptionItemInputSchema).min(1, 'At least one medicine must be prescribed.'),
  safetyOverrideReason: z.string().optional()
});

export const CancelPrescriptionSchema = z.object({
  cancelReason: z.string().min(5)
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(2),
  departmentId: z.string().optional(),
  items: z.array(PrescriptionItemInputSchema)
});
