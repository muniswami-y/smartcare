import { getDatabaseClient, AppointmentStatus } from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';

const prisma = getDatabaseClient();

export class QueueService {
  async getDoctorQueue(doctorId: string, dateStr?: string) {
    const todayStr = dateStr || new Date().toISOString().split('T')[0];

    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: {
          gte: new Date(`${todayStr}T00:00:00.000Z`),
          lte: new Date(`${todayStr}T23:59:59.999Z`)
        },
        status: {
          in: [
            AppointmentStatus.BOOKED,
            AppointmentStatus.CHECKED_IN,
            AppointmentStatus.IN_CONSULT,
            AppointmentStatus.COMPLETED,
            AppointmentStatus.NO_SHOW
          ]
        }
      },
      orderBy: { tokenNumber: 'asc' },
      include: {
        patient: {
          select: {
            id: true,
            patientCode: true,
            fullName: true,
            gender: true,
            ageYears: true
          }
        },
        consultation: {
          select: { id: true, status: true }
        }
      }
    });

    const currentPatient = appointments.find((a) => a.status === AppointmentStatus.IN_CONSULT) || null;
    const waitingQueue = appointments.filter((a) => a.status === AppointmentStatus.CHECKED_IN);
    const bookedUpcoming = appointments.filter((a) => a.status === AppointmentStatus.BOOKED);
    const completedList = appointments.filter((a) => a.status === AppointmentStatus.COMPLETED);

    return {
      date: todayStr,
      doctorId,
      currentPatient,
      waitingCount: waitingQueue.length,
      waitingQueue,
      bookedUpcoming,
      completedCount: completedList.length,
      estimatedWaitPerPatientMinutes: 15
    };
  }

  async getPatientQueueStatus(appointmentId: string) {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: { include: { user: true } } }
    });

    if (!appt) {
      throw new AppError('Appointment not found.', 404, 'APPOINTMENT_NOT_FOUND');
    }

    const todayStr = appt.appointmentDate.toISOString().split('T')[0];

    // Count how many patients checked in ahead of this token
    const aheadCount = await prisma.appointment.count({
      where: {
        doctorId: appt.doctorId,
        appointmentDate: {
          gte: new Date(`${todayStr}T00:00:00.000Z`),
          lte: new Date(`${todayStr}T23:59:59.999Z`)
        },
        tokenNumber: { lt: appt.tokenNumber },
        status: { in: [AppointmentStatus.CHECKED_IN, AppointmentStatus.IN_CONSULT] }
      }
    });

    const isCurrent = appt.status === AppointmentStatus.IN_CONSULT;

    return {
      appointmentId: appt.id,
      tokenNumber: appt.tokenNumber,
      status: appt.status,
      doctorName: appt.doctor.user.fullName,
      patientsAhead: isCurrent ? 0 : aheadCount,
      estimatedWaitMinutes: isCurrent ? 0 : aheadCount * 15
    };
  }

  async callNextPatient(doctorId: string) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Find the first checked in patient for today
    const nextPatient = await prisma.appointment.findFirst({
      where: {
        doctorId,
        appointmentDate: {
          gte: new Date(`${todayStr}T00:00:00.000Z`),
          lte: new Date(`${todayStr}T23:59:59.999Z`)
        },
        status: AppointmentStatus.CHECKED_IN
      },
      orderBy: { tokenNumber: 'asc' }
    });

    if (!nextPatient) {
      return { message: 'No waiting patients in queue.', appointment: null };
    }

    const updated = await prisma.appointment.update({
      where: { id: nextPatient.id },
      data: {
        status: AppointmentStatus.IN_CONSULT,
        consultStartedAt: new Date()
      },
      include: { patient: true }
    });

    return { message: `Called Token #${updated.tokenNumber}: ${updated.patient.fullName}`, appointment: updated };
  }

  async markNoShow(appointmentId: string) {
    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.NO_SHOW }
    });
    return updated;
  }
}

export const queueService = new QueueService();
