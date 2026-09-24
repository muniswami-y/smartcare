import { z } from 'zod';
import { StaffRole } from '@caresmart/database';

export const CreateStaffUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  phone: z.string().min(10).optional(),
  temporaryPassword: z.string().min(8),
  roles: z.array(z.nativeEnum(StaffRole)).min(1),
  // Optional doctor profile details
  departmentId: z.string().optional(),
  registrationNumber: z.string().optional(),
  consultationFeePaise: z.number().int().optional(),
  qualifications: z.string().optional()
});

export const UpdateStaffRolesSchema = z.object({
  roles: z.array(z.nativeEnum(StaffRole)).min(1)
});

export const DeactivateStaffSchema = z.object({
  reason: z.string().min(5)
});

export const UpdateSystemSettingSchema = z.object({
  value: z.string(),
  description: z.string().optional()
});

export const ResolveAlertSchema = z.object({
  resolutionNotes: z.string().min(3)
});

export const LogExportSchema = z.object({
  exportType: z.string(),
  reason: z.string().min(5),
  filterJson: z.string().optional()
});
