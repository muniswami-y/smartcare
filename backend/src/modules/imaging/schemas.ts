import { z } from 'zod';
import { ImagingModality, ImagingSource } from '@caresmart/database';

export const CreateStudySchema = z.object({
  diagnosticOrderId: z.string(),
  patientId: z.string(),
  testCatalogId: z.string(),
  modality: z.nativeEnum(ImagingModality),
  source: z.nativeEnum(ImagingSource).default(ImagingSource.DIGITAL_MACHINE),
  notes: z.string().optional()
});

export const SignRadiologyReportSchema = z.object({
  diagnosticOrderId: z.string(),
  findings: z.string().min(5),
  impression: z.string().min(2)
});
