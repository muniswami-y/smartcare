import {
  getDatabaseClient,
  ConsultationStatus,
  AuditAction,
  AppointmentStatus,
  DiagnosticOrderStatus,
  OrderType,
  EncounterType,
  ChargeStatus
} from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditEntry } from '../../lib/hash-chain';

const prisma = getDatabaseClient();

export class ConsultationService {
  async recordVitals(data: any, staffUserId: string) {
    let isAbnormal = false;
    const abnormalNotes: string[] = [];

    // Clinical abnormal parameter thresholds
    if (data.systolicBp && (data.systolicBp > 140 || data.systolicBp < 90)) {
      isAbnormal = true;
      abnormalNotes.push(`Systolic BP abnormal: ${data.systolicBp} mmHg`);
    }
    if (data.diastolicBp && (data.diastolicBp > 90 || data.diastolicBp < 60)) {
      isAbnormal = true;
      abnormalNotes.push(`Diastolic BP abnormal: ${data.diastolicBp} mmHg`);
    }
    if (data.pulseRate && (data.pulseRate > 100 || data.pulseRate < 50)) {
      isAbnormal = true;
      abnormalNotes.push(`Heart Rate abnormal: ${data.pulseRate} bpm`);
    }
    if (data.temperatureFahrenheit && data.temperatureFahrenheit > 99.5) {
      isAbnormal = true;
      abnormalNotes.push(`Fever: ${data.temperatureFahrenheit}°F`);
    }
    if (data.spo2Percentage && data.spo2Percentage < 95) {
      isAbnormal = true;
      abnormalNotes.push(`Hypoxia SpO2: ${data.spo2Percentage}%`);
    }
    if (data.respiratoryRate && (data.respiratoryRate > 22 || data.respiratoryRate < 12)) {
      isAbnormal = true;
      abnormalNotes.push(`Respiratory Rate abnormal: ${data.respiratoryRate} /min`);
    }

    // BMI calculation if height and weight provided
    let bmi: number | null = null;
    if (data.weightKg && data.heightCm && data.heightCm > 0) {
      const heightM = data.heightCm / 100;
      bmi = parseFloat((data.weightKg / (heightM * heightM)).toFixed(1));
    }

    const vitals = await prisma.vitals.create({
      data: {
        patientId: data.patientId,
        consultationId: data.consultationId,
        ipdAdmissionId: data.ipdAdmissionId,
        recordedById: staffUserId,
        systolicBp: data.systolicBp,
        diastolicBp: data.diastolicBp,
        pulseRate: data.pulseRate,
        temperatureFahrenheit: data.temperatureFahrenheit,
        spo2Percentage: data.spo2Percentage,
        respiratoryRate: data.respiratoryRate,
        weightKg: data.weightKg,
        heightCm: data.heightCm,
        bmi,
        isAbnormal,
        abnormalNotes: abnormalNotes.join('; ')
      }
    });

    return vitals;
  }

  async createOrSaveConsultation(data: any, staffUserId: string) {
    let appointmentId = data.appointmentId;
    const examNotes = data.examinationNotes || data.physicalExamination;

    // If no appointmentId provided, look for active appointment today
    if (!appointmentId && data.patientId) {
      const activeAppt = await prisma.appointment.findFirst({
        where: {
          patientId: data.patientId,
          status: { in: [AppointmentStatus.CHECKED_IN, AppointmentStatus.CONFIRMED, AppointmentStatus.SCHEDULED] }
        },
        orderBy: { appointmentDate: 'desc' }
      });
      if (activeAppt) {
        appointmentId = activeAppt.id;
      }
    }

    // Resolve doctorId
    let doctorId = data.doctorId;
    if (!doctorId && appointmentId) {
      const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      if (appt?.doctorId) doctorId = appt.doctorId;
    }
    if (!doctorId) {
      const docProfile = await prisma.doctorProfile.findFirst({
        where: { userId: staffUserId }
      });
      if (docProfile) {
        doctorId = docProfile.id;
      } else {
        const firstDoc = await prisma.doctorProfile.findFirst();
        doctorId = firstDoc?.id;
      }
    }

    // If we have an appointmentId and doctorId, save or update the consultation
    if (appointmentId && doctorId) {
      const existing = await prisma.consultation.findUnique({
        where: { appointmentId }
      });

      if (existing && existing.status === ConsultationStatus.LOCKED) {
        throw new AppError('This consultation has already been finalized and locked.', 400, 'CONSULTATION_LOCKED');
      }

      const count = await prisma.consultation.count();
      const consultationCode = existing ? existing.consultationCode : `CNS-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;

      const consult = await prisma.consultation.upsert({
        where: { appointmentId },
        update: {
          chiefComplaint: data.chiefComplaint ?? existing?.chiefComplaint,
          historyOfPresentIllness: data.historyOfPresentIllness ?? existing?.historyOfPresentIllness,
          examinationNotes: examNotes ?? existing?.examinationNotes,
          diagnosis: data.diagnosis ?? existing?.diagnosis,
          icd10Code: data.icd10Code ?? existing?.icd10Code,
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : existing?.followUpDate
        },
        create: {
          consultationCode,
          appointmentId,
          patientId: data.patientId,
          doctorId,
          chiefComplaint: data.chiefComplaint || 'Consultation evaluation',
          historyOfPresentIllness: data.historyOfPresentIllness,
          examinationNotes: examNotes,
          diagnosis: data.diagnosis,
          icd10Code: data.icd10Code,
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
          status: ConsultationStatus.DRAFT
        }
      });

      // Record vitals if provided
      if (data.vitals) {
        await this.recordVitals({
          patientId: data.patientId,
          consultationId: consult.id,
          ...data.vitals
        }, staffUserId).catch((e: any) => console.warn('Could not record vitals alongside consultation:', e?.message));
      }

      return consult;
    }

    // Fallback: if only vitals provided (e.g. from Nurse Vitals page without appointment)
    if (data.vitals && data.patientId) {
      const vitals = await this.recordVitals({
        patientId: data.patientId,
        ...data.vitals
      }, staffUserId);
      return { id: vitals.id, ...vitals };
    }

    throw new AppError('Appointment and Doctor are required to create a consultation.', 400, 'MISSING_DATA');
  }

  async saveDraftConsultation(data: any, doctorUserId: string) {
    return this.createOrSaveConsultation(data, doctorUserId);
  }

  async lockConsultation(id: string, data: any, doctorUserId: string) {
    const consult = await prisma.consultation.findUnique({
      where: { id },
      include: { appointment: true }
    });

    if (!consult) {
      throw new AppError('Consultation not found.', 404, 'NOT_FOUND');
    }

    if (consult.status === ConsultationStatus.LOCKED) {
      throw new AppError('Consultation is already locked.', 400, 'ALREADY_LOCKED');
    }

    const examNotes = data.examinationNotes || data.physicalExamination || consult.examinationNotes;

    const updated = await prisma.$transaction(async (tx) => {
      const locked = await tx.consultation.update({
        where: { id },
        data: {
          chiefComplaint: data.chiefComplaint ?? consult.chiefComplaint,
          historyOfPresentIllness: data.historyOfPresentIllness ?? consult.historyOfPresentIllness,
          examinationNotes: examNotes,
          diagnosis: data.diagnosis ?? consult.diagnosis,
          icd10Code: data.icd10Code ?? consult.icd10Code,
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : consult.followUpDate,
          status: ConsultationStatus.LOCKED,
          lockedAt: new Date()
        }
      });

      // Mark appointment completed
      if (consult.appointmentId) {
        await tx.appointment.update({
          where: { id: consult.appointmentId },
          data: {
            status: AppointmentStatus.COMPLETED,
            consultCompletedAt: new Date()
          }
        });
      }

      return locked;
    });

    await recordAuditEntry({
      userId: doctorUserId,
      patientId: consult.patientId,
      action: AuditAction.UPDATE,
      resourceType: 'CONSULTATION_LOCK',
      resourceId: id
    });

    return updated;
  }

  async amendConsultation(id: string, data: any, doctorUserId: string) {
    const consult = await prisma.consultation.findUnique({ where: { id } });
    if (!consult) throw new AppError('Consultation not found.', 404, 'NOT_FOUND');

    const updated = await prisma.consultation.update({
      where: { id },
      data: {
        status: ConsultationStatus.AMENDED,
        amendmentReason: data.amendmentReason,
        chiefComplaint: data.chiefComplaint || consult.chiefComplaint,
        historyOfPresentIllness: data.historyOfPresentIllness || consult.historyOfPresentIllness,
        examinationNotes: data.examinationNotes || consult.examinationNotes,
        diagnosis: data.diagnosis || consult.diagnosis,
        icd10Code: data.icd10Code || consult.icd10Code
      }
    });

    await recordAuditEntry({
      userId: doctorUserId,
      patientId: consult.patientId,
      action: AuditAction.UPDATE,
      resourceType: 'CONSULTATION_AMEND',
      resourceId: id,
      metadata: { amendmentReason: data.amendmentReason }
    });

    return updated;
  }

  async orderDiagnosticTest(data: any, staffUserId: string) {
    const catalogItem = await prisma.testCatalog.findUnique({
      where: { id: data.testCatalogId }
    });

    if (!catalogItem || !catalogItem.active) {
      throw new AppError('Diagnostic test catalog item not found or inactive.', 404, 'CATALOG_ITEM_NOT_FOUND');
    }

    const count = await prisma.diagnosticOrder.count();
    const orderCode = `ORD-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;

    return prisma.$transaction(async (tx) => {
      // 1. Create order
      const order = await tx.diagnosticOrder.create({
        data: {
          orderCode,
          consultationId: data.consultationId,
          ipdAdmissionId: data.ipdAdmissionId,
          patientId: data.patientId,
          doctorId: data.doctorId || staffUserId,
          orderType: catalogItem.type,
          testCatalogId: catalogItem.id,
          clinicalNotes: data.clinicalNotes,
          urgency: data.urgency || 'ROUTINE',
          status: DiagnosticOrderStatus.ORDERED
        },
        include: { testCatalog: true }
      });

      // 2. Add pending charge for billing
      await tx.pendingCharge.create({
        data: {
          patientId: data.patientId,
          encounterType: data.ipdAdmissionId ? EncounterType.IPD : EncounterType.OPD,
          encounterId: data.ipdAdmissionId || data.consultationId || order.id,
          description: `Diagnostic Test: ${catalogItem.name} (${catalogItem.code})`,
          quantity: 1,
          unitPricePaise: catalogItem.pricePaise,
          totalPaise: catalogItem.pricePaise,
          status: ChargeStatus.PENDING,
          createdById: staffUserId
        }
      });

      await recordAuditEntry({
        userId: staffUserId,
        patientId: data.patientId,
        action: AuditAction.CREATE,
        resourceType: 'DIAGNOSTIC_ORDER',
        resourceId: order.id,
        metadata: { orderCode, testCode: catalogItem.code }
      });

      return order;
    });
  }

  async getConsultationById(id: string, staffUserId?: string) {
    const consult = await prisma.consultation.findUnique({
      where: { id },
      include: {
        patient: { include: { allergies: { where: { active: true } } } },
        doctor: { include: { user: true, department: true } },
        vitals: { orderBy: { recordedAt: 'desc' } },
        prescriptions: { include: { items: { include: { medicine: true } } } },
        diagnosticOrders: { include: { testCatalog: true, reports: true } }
      }
    });

    if (!consult) throw new AppError('Consultation not found.', 404, 'NOT_FOUND');

    await recordAuditEntry({
      userId: staffUserId,
      patientId: consult.patientId,
      action: AuditAction.VIEW,
      resourceType: 'CONSULTATION',
      resourceId: id
    });

    return consult;
  }
}

export const consultationService = new ConsultationService();
