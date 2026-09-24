import { z } from 'zod';

export const RecordVitalsSchema = z.object({
  patientId: z.string(),
  consultationId: z.string().optional(),
  ipdAdmissionId: z.string().optional(),
  systolicBp: z.number().int().min(40).max(300).optional(),
  diastolicBp: z.number().int().min(20).max(200).optional(),
  pulseRate: z.number().int().min(30).max(250).optional(),
  temperatureFahrenheit: z.number().min(90).max(110).optional(),
  spo2Percentage: z.number().min(50).max(100).optional(),
  respiratoryRate: z.number().int().min(5).max(60).optional(),
  weightKg: z.number().min(0.5).max(350).optional(),
  heightCm: z.number().min(20).max(250).optional()
});

export const SaveDraftConsultationSchema = z.object({
  appointmentId: z.string(),
  patientId: z.string(),
  doctorId: z.string(),
  chiefComplaint: z.string().optional(),
  historyOfPresentIllness: z.string().optional(),
  examinationNotes: z.string().optional(),
  diagnosis: z.string().optional(),
  icd10Code: z.string().optional(),
  followUpDate: z.string().optional()
});

export const LockConsultationSchema = z.object({
  chiefComplaint: z.string().min(2),
  historyOfPresentIllness: z.string().optional(),
  examinationNotes: z.string().min(2),
  diagnosis: z.string().min(2),
  icd10Code: z.string().optional(),
  followUpDate: z.string().optional()
});

export const AmendConsultationSchema = z.object({
  amendmentReason: z.string().min(5),
  chiefComplaint: z.string().optional(),
  historyOfPresentIllness: z.string().optional(),
  examinationNotes: z.string().optional(),
  diagnosis: z.string().optional(),
  icd10Code: z.string().optional()
});

export const CreateDiagnosticOrderSchema = z.object({
  patientId: z.string(),
  consultationId: z.string().optional(),
  ipdAdmissionId: z.string().optional(),
  testCatalogId: z.string(),
  clinicalNotes: z.string().optional(),
  urgency: z.enum(['ROUTINE', 'URGENT', 'STAT']).default('ROUTINE')
});
