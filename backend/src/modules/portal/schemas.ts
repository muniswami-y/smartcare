import { z } from 'zod';
import { ConsentRecordType, DataRequestType } from '@caresmart/database';

export const SwitchFamilyMemberSchema = z.object({
  patientId: z.string()
});

export const GrantConsentSchema = z.object({
  patientId: z.string(),
  doctorId: z.string().optional(),
  departmentId: z.string().optional(),
  recordType: z.nativeEnum(ConsentRecordType).default(ConsentRecordType.ALL),
  purpose: z.string().min(3),
  validDays: z.number().int().min(1).max(365).default(30)
});

export const SetRestrictedRecordSchema = z.object({
  patientId: z.string(),
  recordType: z.string(),
  recordId: z.string(),
  isRestricted: z.boolean(),
  reason: z.string().optional()
});

export const BreakGlassAccessSchema = z.object({
  patientId: z.string(),
  recordType: z.string(),
  recordId: z.string(),
  justificationReason: z.string().min(10)
});

export const SubmitDataRequestSchema = z.object({
  patientId: z.string(),
  requestType: z.nativeEnum(DataRequestType),
  details: z.string().min(5)
});

export const ChangePhoneRequestSchema = z.object({
  oldPhone: z.string().min(10),
  newPhone: z.string().min(10)
});

export const VerifyChangePhoneSchema = z.object({
  oldPhoneOtp: z.string().length(6),
  newPhoneOtp: z.string().length(6),
  newPhone: z.string().min(10)
});
