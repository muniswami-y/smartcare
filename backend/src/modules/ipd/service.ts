import {
  getDatabaseClient,
  AdmissionStatus,
  BedStatus,
  DischargeType,
  AuditAction,
  EncounterType,
  ChargeStatus,
  AlertType,
  AlertSeverity
} from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditEntry } from '../../lib/hash-chain';
import { generatePrintableHtml } from '../../lib/pdf';

const prisma = getDatabaseClient();

export class IpdService {
  async getLiveBedBoard() {
    return prisma.ward.findMany({
      where: { active: true },
      orderBy: { floor: 'asc' },
      include: {
        beds: {
          orderBy: { bedNumber: 'asc' },
          include: {
            admissions: {
              where: { status: AdmissionStatus.ADMITTED },
              include: {
                patient: { select: { id: true, patientCode: true, fullName: true, gender: true, ageYears: true } },
                primaryDoctor: { include: { user: { select: { fullName: true } } } }
              }
            }
          }
        }
      }
    });
  }

  async admitPatient(data: any, staffUserId: string) {
    return prisma.$transaction(async (tx) => {
      // 1. Check patient is not already admitted
      const existingAdmission = await tx.admission.findFirst({
        where: {
          patientId: data.patientId,
          status: { in: [AdmissionStatus.ADMITTED, AdmissionStatus.DISCHARGE_REQUESTED] }
        }
      });

      if (existingAdmission) {
        throw new AppError('This patient is currently already admitted in an inpatient ward.', 400, 'PATIENT_ALREADY_ADMITTED');
      }

      // 2. Concurrency lock on Bed availability
      const targetBed = await tx.bed.findUnique({
        where: { id: data.bedId },
        include: { ward: true }
      });

      if (!targetBed || !targetBed.active) {
        throw new AppError('Selected bed does not exist or is inactive.', 404, 'BED_NOT_FOUND');
      }

      if (targetBed.status !== BedStatus.AVAILABLE) {
        throw new AppError(`Bed ${targetBed.bedNumber} is not available (current status: ${targetBed.status}).`, 409, 'BED_NOT_AVAILABLE');
      }

      // 3. Mark bed OCCUPIED
      await tx.bed.update({
        where: { id: targetBed.id },
        data: { status: BedStatus.OCCUPIED }
      });

      const count = await tx.admission.count();
      const admissionCode = `ADM-${new Date().getFullYear().toString().slice(-2)}-${(count + 1001).toString()}`;

      // 4. Create Admission record
      const admission = await tx.admission.create({
        data: {
          admissionCode,
          patientId: data.patientId,
          primaryDoctorId: data.primaryDoctorId,
          admittingDoctorId: data.admittingDoctorId,
          wardId: targetBed.wardId,
          bedId: targetBed.id,
          admissionDate: new Date(),
          admissionType: data.admissionType,
          diagnosis: data.diagnosis,
          mlcDetails: data.mlcDetails,
          status: AdmissionStatus.ADMITTED
        },
        include: { patient: true, ward: true, bed: true }
      });

      // 5. Create initial BedAssignment history
      await tx.bedAssignment.create({
        data: {
          admissionId: admission.id,
          bedId: targetBed.id,
          assignedAt: new Date()
        }
      });

      // 6. Initialize DischargeChecklist
      await tx.dischargeChecklist.create({
        data: {
          admissionId: admission.id
        }
      });

      // 7. Initial deposit if provided
      if (data.initialDepositPaise && data.initialDepositPaise > 0) {
        const depCount = await tx.deposit.count();
        const depositNumber = `DEP-${new Date().getFullYear()}-${(depCount + 1001).toString()}`;
        await tx.deposit.create({
          data: {
            depositNumber,
            patientId: data.patientId,
            ipdAdmissionId: admission.id,
            amountPaise: data.initialDepositPaise,
            paymentMethod: 'CASH',
            status: 'AVAILABLE',
            receivedById: staffUserId
          }
        });
      }

      await recordAuditEntry({
        userId: staffUserId,
        patientId: data.patientId,
        action: AuditAction.CREATE,
        resourceType: 'IPD_ADMISSION',
        resourceId: admission.id,
        metadata: { admissionCode, bedNumber: targetBed.bedNumber, ward: targetBed.ward.name }
      });

      return admission;
    });
  }

  async transferBed(admissionId: string, data: any, staffUserId: string) {
    return prisma.$transaction(async (tx) => {
      const admission = await tx.admission.findUnique({
        where: { id: admissionId },
        include: { bed: true }
      });

      if (!admission || admission.status !== AdmissionStatus.ADMITTED) {
        throw new AppError('Active inpatient admission not found.', 404, 'NOT_FOUND');
      }

      const newBed = await tx.bed.findUnique({
        where: { id: data.newBedId },
        include: { ward: true }
      });

      if (!newBed || newBed.status !== BedStatus.AVAILABLE) {
        throw new AppError('Target bed is not available for transfer.', 409, 'BED_NOT_AVAILABLE');
      }

      // Close current bed assignment
      await tx.bedAssignment.updateMany({
        where: { admissionId: admission.id, vacatedAt: null },
        data: {
          vacatedAt: new Date(),
          transferredById: staffUserId,
          transferReason: data.transferReason
        }
      });

      // Set old bed to CLEANING
      await tx.bed.update({
        where: { id: admission.bedId },
        data: { status: BedStatus.CLEANING }
      });

      // Set new bed to OCCUPIED
      await tx.bed.update({
        where: { id: newBed.id },
        data: { status: BedStatus.OCCUPIED }
      });

      // Update admission
      await tx.admission.update({
        where: { id: admission.id },
        data: {
          wardId: newBed.wardId,
          bedId: newBed.id
        }
      });

      // Create new BedAssignment
      await tx.bedAssignment.create({
        data: {
          admissionId: admission.id,
          bedId: newBed.id,
          assignedAt: new Date()
        }
      });

      await recordAuditEntry({
        userId: staffUserId,
        patientId: admission.patientId,
        action: AuditAction.UPDATE,
        resourceType: 'BED_TRANSFER',
        resourceId: admission.id,
        metadata: { fromBed: admission.bed.bedNumber, toBed: newBed.bedNumber, reason: data.transferReason }
      });

      return { success: true, message: `Patient transferred to Bed ${newBed.bedNumber}.` };
    });
  }

  async addProgressNote(admissionId: string, data: any, doctorUserId: string) {
    const admission = await prisma.admission.findUnique({ where: { id: admissionId } });
    if (!admission) throw new AppError('Admission not found.', 404, 'NOT_FOUND');

    const note = await prisma.progressNote.create({
      data: {
        admissionId,
        doctorId: data.doctorId,
        note: data.note,
        noteTime: new Date()
      }
    });

    return note;
  }

  async recordIpdVitals(admissionId: string, data: any, nurseUserId: string) {
    const admission = await prisma.admission.findUnique({ where: { id: admissionId } });
    if (!admission) throw new AppError('Admission not found.', 404, 'NOT_FOUND');

    const vitals = await prisma.ipdVitals.create({
      data: {
        admissionId,
        recordedById: nurseUserId,
        systolicBp: data.systolicBp,
        diastolicBp: data.diastolicBp,
        pulseRate: data.pulseRate,
        temperatureFahrenheit: data.temperatureFahrenheit,
        spo2Percentage: data.spo2Percentage,
        respiratoryRate: data.respiratoryRate,
        urineOutputMl: data.urineOutputMl,
        bloodSugar: data.bloodSugar,
        notes: data.notes
      }
    });

    return vitals;
  }

  async createMedicationAdministration(data: any, nurseUserId: string) {
    const schedule = await prisma.medicationSchedule.findUnique({
      where: { id: data.scheduleId },
      include: { admission: true, medicine: true }
    });

    if (!schedule) throw new AppError('Medication schedule not found.', 404, 'NOT_FOUND');

    const admin = await prisma.medicationAdministration.create({
      data: {
        scheduleId: data.scheduleId,
        admissionId: schedule.admissionId,
        administeredById: nurseUserId,
        scheduledTime: new Date(),
        administeredTime: data.status === 'GIVEN' ? new Date() : null,
        status: data.status,
        reasonMissed: data.reasonMissed
      }
    });

    // Alert if missed or refused
    if (data.status !== 'GIVEN') {
      await prisma.adminAlert.create({
        data: {
          alertType: AlertType.UNUSUAL_ACCESS,
          severity: AlertSeverity.MEDIUM,
          message: `Inpatient medication missed: '${schedule.medicine.brandName}' was ${data.status} for Admission #${schedule.admission.admissionCode}. Reason: ${data.reasonMissed || 'Not provided'}`
        }
      });
    }

    return admin;
  }

  async updateDischargeChecklist(admissionId: string, data: any, staffUserId: string) {
    const checklist = await prisma.dischargeChecklist.findUnique({ where: { admissionId } });
    if (!checklist) throw new AppError('Checklist not found.', 404, 'NOT_FOUND');

    const updated = await prisma.dischargeChecklist.update({
      where: { admissionId },
      data: {
        pharmacyCleared: data.pharmacyCleared ?? checklist.pharmacyCleared,
        labCleared: data.labCleared ?? checklist.labCleared,
        nursingSummaryComplete: data.nursingSummaryComplete ?? checklist.nursingSummaryComplete,
        billSettled: data.billSettled ?? checklist.billSettled,
        dischargeSummarySigned: data.dischargeSummarySigned ?? checklist.dischargeSummarySigned
      }
    });

    const isAllCleared =
      updated.pharmacyCleared &&
      updated.labCleared &&
      updated.nursingSummaryComplete &&
      updated.billSettled &&
      updated.dischargeSummarySigned;

    if (isAllCleared && !checklist.allItemsClearedAt) {
      await prisma.dischargeChecklist.update({
        where: { admissionId },
        data: {
          allItemsClearedAt: new Date(),
          clearedById: staffUserId
        }
      });
    }

    return updated;
  }

  async signDischargeSummary(admissionId: string, data: any, doctorUserId: string) {
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      include: { dischargeSummary: true }
    });

    if (!admission) throw new AppError('Admission not found.', 404, 'NOT_FOUND');

    const existing = admission.dischargeSummary;
    const version = existing ? existing.version + 1 : 1;

    // Respectful handling for death discharge
    const finalDiagnosis =
      data.dischargeType === DischargeType.DEATH
        ? `${data.finalDiagnosis} [Deceased]`
        : data.finalDiagnosis;

    const summary = await prisma.dischargeSummary.upsert({
      where: { admissionId },
      update: {
        dischargeType: data.dischargeType,
        finalDiagnosis,
        hospitalCourse: data.hospitalCourse,
        proceduresDone: data.proceduresDone,
        conditionAtDischarge: data.dischargeType === DischargeType.DEATH ? 'Expired with dignity.' : data.conditionAtDischarge,
        dischargeMedicationsJson: JSON.stringify(data.dischargeMedications || []),
        followUpInstructions: data.followUpInstructions,
        signedById: doctorUserId,
        signedAt: new Date(),
        version,
        previousVersionId: existing?.id
      },
      create: {
        admissionId,
        patientId: admission.patientId,
        doctorId: admission.primaryDoctorId,
        admissionDate: admission.admissionDate,
        dischargeDate: new Date(),
        dischargeType: data.dischargeType,
        finalDiagnosis,
        hospitalCourse: data.hospitalCourse,
        proceduresDone: data.proceduresDone,
        conditionAtDischarge: data.dischargeType === DischargeType.DEATH ? 'Expired with dignity.' : data.conditionAtDischarge,
        dischargeMedicationsJson: JSON.stringify(data.dischargeMedications || []),
        followUpInstructions: data.followUpInstructions,
        signedById: doctorUserId,
        signedAt: new Date(),
        version: 1
      }
    });

    // Mark checklist dischargeSummarySigned
    await prisma.dischargeChecklist.update({
      where: { admissionId },
      data: { dischargeSummarySigned: true }
    });

    return summary;
  }

  async completeDischarge(admissionId: string, staffUserId: string) {
    const admission = await prisma.admission.findUnique({
      where: { id: admissionId },
      include: { dischargeChecklist: true }
    });

    if (!admission) throw new AppError('Admission not found.', 404, 'NOT_FOUND');

    const checklist = admission.dischargeChecklist;
    if (
      !checklist ||
      !checklist.pharmacyCleared ||
      !checklist.labCleared ||
      !checklist.nursingSummaryComplete ||
      !checklist.billSettled ||
      !checklist.dischargeSummarySigned
    ) {
      throw new AppError('Cannot finalize discharge. All discharge checklist criteria must be verified.', 400, 'CHECKLIST_INCOMPLETE');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Mark admission discharged
      const discharged = await tx.admission.update({
        where: { id: admission.id },
        data: {
          status: AdmissionStatus.DISCHARGED,
          dischargeDate: new Date()
        }
      });

      // 2. Set Bed to CLEANING
      await tx.bed.update({
        where: { id: admission.bedId },
        data: { status: BedStatus.CLEANING }
      });

      // 3. Close open bed assignment
      await tx.bedAssignment.updateMany({
        where: { admissionId: admission.id, vacatedAt: null },
        data: { vacatedAt: new Date() }
      });

      await recordAuditEntry({
        userId: staffUserId,
        patientId: admission.patientId,
        action: AuditAction.UPDATE,
        resourceType: 'IPD_DISCHARGE',
        resourceId: admission.id
      });

      return discharged;
    });
  }

  async runDailyBedChargesJob() {
    // Calculates daily room charges for all active admissions
    const activeAdmissions = await prisma.admission.findMany({
      where: { status: AdmissionStatus.ADMITTED },
      include: { ward: true }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    let accruedCount = 0;

    for (const adm of activeAdmissions) {
      // Idempotency: verify no bed charge for this admission today
      const alreadyAccrued = await prisma.pendingCharge.findFirst({
        where: {
          encounterType: EncounterType.IPD,
          encounterId: adm.id,
          description: { contains: `Daily Bed Charge - ${todayStr}` }
        }
      });

      if (!alreadyAccrued) {
        await prisma.pendingCharge.create({
          data: {
            patientId: adm.patientId,
            encounterType: EncounterType.IPD,
            encounterId: adm.id,
            description: `Daily Bed Charge - ${todayStr} (${adm.ward.name})`,
            quantity: 1,
            unitPricePaise: adm.ward.dailyRatePaise,
            totalPaise: adm.ward.dailyRatePaise,
            status: ChargeStatus.PENDING
          }
        });
        accruedCount++;
      }
    }

    return { processed: activeAdmissions.length, accruedCharges: accruedCount };
  }
}

export const ipdService = new IpdService();
