import { getDatabaseClient, AppointmentStatus, AppointmentType, AuditAction, EncounterType, ChargeStatus } from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditEntry } from '../../lib/hash-chain';

const prisma = getDatabaseClient();

export class AppointmentService {
  async getDoctorAvailableSlots(doctorId: string, dateStr: string) {
    const targetDate = new Date(dateStr);
    const dayOfWeek = targetDate.getDay(); // 0 = Sunday

    // Check doctor leave
    const onLeave = await prisma.leaveBlock.findFirst({
      where: {
        doctorId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate }
      }
    });

    if (onLeave) {
      return { available: false, reason: 'Doctor is on scheduled leave for this date.', slots: [] };
    }

    // Fetch doctor schedule for this day of week
    const schedule = await prisma.doctorSchedule.findFirst({
      where: { doctorId, dayOfWeek, active: true }
    });

    if (!schedule) {
      return { available: false, reason: 'Doctor does not hold OPD consultations on this day.', slots: [] };
    }

    // Generate slots
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);

    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    const slotCount = Math.floor(totalMinutes / schedule.slotDurationMinutes);

    const existingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: {
          gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          lte: new Date(targetDate.setHours(23, 59, 59, 999))
        },
        status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_CONSULT] }
      },
      select: { slotStartTime: true }
    });

    const bookedSlots = new Set(existingAppointments.map((a) => a.slotStartTime));
    const slots: Array<{ startTime: string; endTime: string; isAvailable: boolean }> = [];

    for (let i = 0; i < slotCount; i++) {
      const curM = startH * 60 + startM + i * schedule.slotDurationMinutes;
      const curEndM = curM + schedule.slotDurationMinutes;

      const sTime = `${Math.floor(curM / 60).toString().padStart(2, '0')}:${(curM % 60).toString().padStart(2, '0')}`;
      const eTime = `${Math.floor(curEndM / 60).toString().padStart(2, '0')}:${(curEndM % 60).toString().padStart(2, '0')}`;

      slots.push({
        startTime: sTime,
        endTime: eTime,
        isAvailable: !bookedSlots.has(sTime)
      });
    }

    return { available: true, slots, doctorSchedule: schedule };
  }

  async bookAppointment(data: any, staffUserId?: string) {
    const apptDate = new Date(data.appointmentDate);
    const dateOnlyStr = apptDate.toISOString().split('T')[0];

    return prisma.$transaction(async (tx) => {
      // 1. Double-booking concurrency lock / check
      const conflicting = await tx.appointment.findFirst({
        where: {
          doctorId: data.doctorId,
          appointmentDate: {
            gte: new Date(`${dateOnlyStr}T00:00:00.000Z`),
            lte: new Date(`${dateOnlyStr}T23:59:59.999Z`)
          },
          slotStartTime: data.slotStartTime,
          status: { in: [AppointmentStatus.BOOKED, AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_CONSULT] }
        }
      });

      if (conflicting) {
        throw new AppError('This consultation time slot has already been booked by another patient.', 409, 'SLOT_ALREADY_BOOKED');
      }

      // 2. Fetch doctor profile for consultation fee
      const doctor = await tx.doctorProfile.findUnique({
        where: { id: data.doctorId }
      });

      if (!doctor) {
        throw new AppError('Doctor profile not found.', 404, 'DOCTOR_NOT_FOUND');
      }

      // 3. Atomically increment DailyTokenCounter
      const counter = await tx.dailyTokenCounter.upsert({
        where: {
          doctorId_date: {
            doctorId: data.doctorId,
            date: dateOnlyStr
          }
        },
        update: {
          lastTokenNumber: { increment: 1 }
        },
        create: {
          doctorId: data.doctorId,
          date: dateOnlyStr,
          lastTokenNumber: 1
        }
      });

      const tokenNumber = counter.lastTokenNumber;
      const countTotal = await tx.appointment.count();
      const appointmentCode = `APT-${Date.now().toString().slice(-6)}-${(countTotal + 1).toString().padStart(4, '0')}`;

      // 4. Create appointment
      const appointment = await tx.appointment.create({
        data: {
          appointmentCode,
          patientId: data.patientId,
          doctorId: data.doctorId,
          departmentId: data.departmentId,
          appointmentDate: apptDate,
          slotStartTime: data.slotStartTime,
          slotEndTime: data.slotEndTime,
          tokenNumber,
          type: data.type || AppointmentType.SCHEDULED,
          status: AppointmentStatus.BOOKED
        },
        include: {
          patient: true,
          doctor: { include: { user: true, department: true } }
        }
      });

      // 5. Automatically create pending consultation charge for billing
      await tx.pendingCharge.create({
        data: {
          patientId: data.patientId,
          encounterType: EncounterType.OPD,
          encounterId: appointment.id,
          description: `OPD Consultation Fee - Dr. ${appointment.doctor.user.fullName} (${appointment.doctor.department.name})`,
          quantity: 1,
          unitPricePaise: doctor.consultationFeePaise,
          totalPaise: doctor.consultationFeePaise,
          status: ChargeStatus.PENDING,
          createdById: staffUserId
        }
      });

      await recordAuditEntry({
        userId: staffUserId,
        patientId: data.patientId,
        action: AuditAction.CREATE,
        resourceType: 'APPOINTMENT',
        resourceId: appointment.id,
        metadata: { appointmentCode, tokenNumber, date: dateOnlyStr, slot: data.slotStartTime }
      });

      return appointment;
    });
  }

  async bookWalkIn(data: any, staffUserId?: string) {
    const today = new Date();
    const dateOnlyStr = today.toISOString().split('T')[0];
    const nowTimeStr = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}`;

    return prisma.$transaction(async (tx) => {
      const doctor = await tx.doctorProfile.findUnique({
        where: { id: data.doctorId },
        include: { user: true, department: true }
      });

      if (!doctor) {
        throw new AppError('Doctor profile not found.', 404, 'DOCTOR_NOT_FOUND');
      }

      const counter = await tx.dailyTokenCounter.upsert({
        where: {
          doctorId_date: {
            doctorId: data.doctorId,
            date: dateOnlyStr
          }
        },
        update: {
          lastTokenNumber: { increment: 1 }
        },
        create: {
          doctorId: data.doctorId,
          date: dateOnlyStr,
          lastTokenNumber: 1
        }
      });

      const tokenNumber = counter.lastTokenNumber;
      const countTotal = await tx.appointment.count();
      const appointmentCode = `WLK-${Date.now().toString().slice(-6)}-${(countTotal + 1).toString().padStart(4, '0')}`;

      const appointment = await tx.appointment.create({
        data: {
          appointmentCode,
          patientId: data.patientId,
          doctorId: data.doctorId,
          departmentId: data.departmentId,
          appointmentDate: today,
          slotStartTime: nowTimeStr,
          slotEndTime: nowTimeStr,
          tokenNumber,
          type: AppointmentType.WALK_IN,
          status: AppointmentStatus.CHECKED_IN,
          checkedInAt: today
        },
        include: {
          patient: true,
          doctor: { include: { user: true, department: true } }
        }
      });

      // Pending charge
      await tx.pendingCharge.create({
        data: {
          patientId: data.patientId,
          encounterType: EncounterType.OPD,
          encounterId: appointment.id,
          description: `Walk-in Consultation Fee - Dr. ${doctor.user.fullName}`,
          quantity: 1,
          unitPricePaise: doctor.consultationFeePaise,
          totalPaise: doctor.consultationFeePaise,
          status: ChargeStatus.PENDING,
          createdById: staffUserId
        }
      });

      return appointment;
    });
  }

  async cancelAppointment(appointmentId: string, reason: string, staffUserId?: string) {
    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appt) {
      throw new AppError('Appointment not found.', 404, 'APPOINTMENT_NOT_FOUND');
    }

    if (appt.status === AppointmentStatus.COMPLETED || appt.status === AppointmentStatus.CANCELLED) {
      throw new AppError(`Cannot cancel appointment with status ${appt.status}.`, 400, 'INVALID_STATUS');
    }

    // Policy: Cancel allowed until 1 hour before scheduled time
    const slotDateTime = new Date(`${appt.appointmentDate.toISOString().split('T')[0]}T${appt.slotStartTime}:00.000Z`);
    const oneHourBefore = new Date(slotDateTime.getTime() - 60 * 60 * 1000);

    if (new Date() > oneHourBefore && !staffUserId) {
      // Patients cannot self-cancel within 1 hour; reception/staff can override with reason
      throw new AppError('Cancellations are only allowed up to 1 hour prior to appointment. Please contact reception.', 400, 'LATE_CANCELLATION');
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CANCELLED,
        cancelReason: reason
      }
    });

    // Cancel pending charge if not billed
    await prisma.pendingCharge.updateMany({
      where: { encounterId: appointmentId, status: ChargeStatus.PENDING },
      data: { status: ChargeStatus.CANCELLED }
    });

    await recordAuditEntry({
      userId: staffUserId,
      patientId: appt.patientId,
      action: AuditAction.UPDATE,
      resourceType: 'APPOINTMENT_CANCEL',
      resourceId: appointmentId,
      metadata: { reason }
    });

    return updated;
  }

  async checkInAppointment(appointmentId: string, staffUserId: string) {
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.CHECKED_IN,
        checkedInAt: new Date()
      }
    });

    return updated;
  }

  async listAppointments(filter: { doctorId?: string; date?: string; patientId?: string; status?: AppointmentStatus }) {
    const where: any = {};
    if (filter.doctorId) where.doctorId = filter.doctorId;
    if (filter.patientId) where.patientId = filter.patientId;
    if (filter.status) where.status = filter.status;
    if (filter.date) {
      const d = filter.date.split('T')[0];
      where.appointmentDate = {
        gte: new Date(`${d}T00:00:00.000Z`),
        lte: new Date(`${d}T23:59:59.999Z`)
      };
    }

    return prisma.appointment.findMany({
      where,
      orderBy: [{ appointmentDate: 'asc' }, { tokenNumber: 'asc' }],
      include: {
        patient: { select: { id: true, patientCode: true, fullName: true, phone: true, gender: true, ageYears: true } },
        doctor: { include: { user: { select: { fullName: true } }, department: true } },
        consultation: { select: { id: true, status: true } }
      }
    });
  }
}

export const appointmentService = new AppointmentService();
