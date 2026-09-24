import { z } from 'zod';

export const StaffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  totpToken: z.string().optional()
});

export const PatientRequestOtpSchema = z.object({
  phone: z.string().min(10).max(15)
});

export const PatientVerifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6),
  isSharedDevice: z.boolean().default(false)
});

export const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(6),
  newPassword: z.string().min(8)
});

export const SetupTotpVerifySchema = z.object({
  secret: z.string(),
  token: z.string().length(6)
});
