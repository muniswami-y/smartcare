import { z } from 'zod';
import { Gender, AllergySeverity, AllergyType, Relationship } from '@caresmart/database';

export const RegisterPatientSchema = z.object({
  fullName: z.string().min(2),
  gender: z.nativeEnum(Gender),
  dateOfBirth: z.string().optional(),
  ageYears: z.number().int().min(0).max(125).optional(),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bloodGroup: z.string().optional(),
  abhaId: z.string().optional(),
  isTemporaryEmergency: z.boolean().default(false),
  notes: z.string().optional(),
  primaryAccountId: z.string().optional(),
  relationship: z.nativeEnum(Relationship).default(Relationship.SELF)
});

export const UpdatePatientSchema = z.object({
  fullName: z.string().min(2).optional(),
  gender: z.nativeEnum(Gender).optional(),
  ageYears: z.number().int().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bloodGroup: z.string().optional(),
  abhaId: z.string().optional(),
  notes: z.string().optional(),
  reasonForEdit: z.string().min(3) // Audited edit justification
});

export const AddAllergySchema = z.object({
  allergen: z.string().min(2),
  allergenType: z.nativeEnum(AllergyType).default(AllergyType.DRUG),
  severity: z.nativeEnum(AllergySeverity).default(AllergySeverity.MODERATE),
  reactions: z.string().optional()
});

export const MergePatientSchema = z.object({
  temporaryPatientId: z.string(),
  targetPatientId: z.string(),
  mergeReason: z.string().min(5)
});
