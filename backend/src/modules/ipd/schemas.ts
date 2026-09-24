import { z } from 'zod';
import { AdmissionType, DischargeType, InpatientOrderType, MedicationAdminStatus } from '@caresmart/database';

export const AdmitPatientSchema = z.object({
  patientId: z.string(),
  primaryDoctorId: z.string(),
  admittingDoctorId: z.string(),
  wardId: z.string(),
  bedId: z.string(),
  admissionType: z.nativeEnum(AdmissionType).default(AdmissionType.PLANNED),
  diagnosis: z.string().min(2),
  mlcDetails: z.string().optional(),
  initialDepositPaise: z.number().int().min(0).default(0)
});

export const TransferBedSchema = z.object({
  newWardId: z.string(),
  newBedId: z.string(),
  transferReason: z.string().min(3)
});

export const AddProgressNoteSchema = z.object({
  doctorId: z.string(),
  note: z.string().min(3)
});

export const RecordIpdVitalsSchema = z.object({
  systolicBp: z.number().int().optional(),
  diastolicBp: z.number().int().optional(),
  pulseRate: z.number().int().optional(),
  temperatureFahrenheit: z.number().optional(),
  spo2Percentage: z.number().optional(),
  respiratoryRate: z.number().int().optional(),
  urineOutputMl: z.number().int().optional(),
  bloodSugar: z.number().optional(),
  notes: z.string().optional()
});

export const CreateInpatientOrderSchema = z.object({
  doctorId: z.string(),
  orderType: z.nativeEnum(InpatientOrderType),
  details: z.string().min(3)
});

export const CreateMedicationScheduleSchema = z.object({
  medicineId: z.string(),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  route: z.string().default('Oral'),
  specialInstructions: z.string().optional()
});

export const RecordMedicationAdministrationSchema = z.object({
  scheduleId: z.string(),
  status: z.nativeEnum(MedicationAdminStatus),
  reasonMissed: z.string().optional()
});

export const SignDischargeSummarySchema = z.object({
  dischargeType: z.nativeEnum(DischargeType),
  finalDiagnosis: z.string().min(2),
  hospitalCourse: z.string().min(5),
  proceduresDone: z.string().optional(),
  conditionAtDischarge: z.string().min(2),
  dischargeMedications: z.array(z.any()),
  followUpInstructions: z.string().optional()
});

export const UpdateDischargeChecklistSchema = z.object({
  pharmacyCleared: z.boolean().optional(),
  labCleared: z.boolean().optional(),
  nursingSummaryComplete: z.boolean().optional(),
  billSettled: z.boolean().optional(),
  dischargeSummarySigned: z.boolean().optional()
});
