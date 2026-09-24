import { z } from 'zod';
import { SampleType, SampleStatus } from '@caresmart/database';

export const CollectSampleSchema = z.object({
  diagnosticOrderId: z.string(),
  patientId: z.string(),
  testCatalogId: z.string(),
  sampleType: z.nativeEnum(SampleType)
});

export const RejectSampleSchema = z.object({
  rejectionReason: z.string().min(5)
});

export const RecordLabResultItemSchema = z.object({
  parameterId: z.string(),
  value: z.string().min(1),
  unit: z.string().optional(),
  notes: z.string().optional()
});

export const RecordLabResultsSchema = z.object({
  diagnosticOrderId: z.string(),
  sampleId: z.string(),
  results: z.array(RecordLabResultItemSchema).min(1)
});

export const SignLabReportSchema = z.object({
  diagnosticOrderId: z.string(),
  findings: z.string().min(2),
  impression: z.string().optional()
});

export const CreateShareLinkSchema = z.object({
  referenceId: z.string(),
  referenceType: z.enum(['REPORT', 'IMAGING_STUDY']),
  maxViews: z.number().int().min(1).max(50).default(10),
  expiryHours: z.number().int().min(1).max(168).default(48) // Up to 7 days
});
