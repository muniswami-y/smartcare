import { z } from 'zod';
import { AppointmentType } from '@caresmart/database';

export const BookAppointmentSchema = z.object({
  patientId: z.string(),
  doctorId: z.string(),
  departmentId: z.string(),
  appointmentDate: z.string(), // YYYY-MM-DD or ISO string
  slotStartTime: z.string(),   // HH:mm
  slotEndTime: z.string(),     // HH:mm
  type: z.nativeEnum(AppointmentType).default(AppointmentType.SCHEDULED)
});

export const WalkInAppointmentSchema = z.object({
  patientId: z.string(),
  doctorId: z.string(),
  departmentId: z.string()
});

export const CancelAppointmentSchema = z.object({
  reason: z.string().min(3)
});

export const RescheduleAppointmentSchema = z.object({
  newDate: z.string(),
  newSlotStartTime: z.string(),
  newSlotEndTime: z.string()
});
