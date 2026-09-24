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

  async saveDraftConsultation(data: any, doctorUserId: string) {
    const existing = await prisma.consultation.findUnique({
      where: { appointmentId: data.appointmentId }
    });

    if (existing && existing.status === ConsultationStatus.LOCKED) {
      throw new AppError('This consultation has already been finalized and locked.', 400, 'CONSULTATION_LOCKED');
    }

    const count = await prisma.consultation.count();
    const consultationCode = existing ? existing.consultationCode : `CNS-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;

    const consult = await prisma.consultation.upsert({
      where: { appointmentId: data.appointmentId },
      update: {
        chiefComplaint: data.chiefComplaint,
        historyOfPresentIllness: data.historyOfPresentIllness,
        examinationNotes: data.examinationNotes,
        diagnosis: data.diagnosis,
        icd10Code: data.icd10Code,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null
      },
      create: {
        consultationCode,
        appointmentId: data.appointmentId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        chiefComplaint: data.chiefComplaint,
        historyOfPresentIllness: data.historyOfPresentIllness,
        examinationNotes: data.examinationNotes,
        diagnosis: data.diagnosis,
        icd10Code: data.icd10Code,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        status: ConsultationStatus.DRAFT
      }
    });

    return consult;
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

    const updated = await prisma.$transaction(async (tx) => {
      const locked = await tx.consultation.update({
        where: { id },
        data: {
          chiefComplaint: data.chiefComplaint,
          historyOfPresentIllness: data.historyOfPresentIllness,
          examinationNotes: data.examinationNotes,
          diagnosis: data.diagnosis,
          icd10Code: data.icd10Code,
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
          status: ConsultationStatus.LOCKED,
          lockedAt: new Date()
        }
      });

      // Mark appointment completed
      await tx.appointment.update({
        where: { id: consult.appointmentId },
        data: {
          status: AppointmentStatus.COMPLETED,
          consultCompletedAt: new Date()
        }
      });

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
