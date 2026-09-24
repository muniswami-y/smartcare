import { getDatabaseClient, AuditAction } from '@caresmart/database';
import { hashPhone, encryptSensitiveField, decryptSensitiveField } from '../../lib/crypto';
import { recordAuditEntry } from '../../lib/hash-chain';
import { AppError } from '../../middleware/errorHandler';

const prisma = getDatabaseClient();

export class PatientService {
  async registerPatient(data: any, staffUserId?: string) {
    const phoneH = hashPhone(data.phone);

    // Duplicate detection check
    const existingMatches = await prisma.patient.findMany({
      where: {
        phoneHash: phoneH,
        fullName: { equals: data.fullName, mode: 'insensitive' }
      }
    });

    const isDuplicateWarning = existingMatches.length > 0;

    // Generate atomic patient code (e.g. CS-000021)
    const count = await prisma.patient.count();
    const patientCode = `CS-${(count + 1).toString().padStart(6, '0')}`;

    const encryptedAddress = data.address ? encryptSensitiveField(data.address) : null;
    const encryptedNotes = data.notes ? encryptSensitiveField(data.notes) : null;
    const encryptedAbha = data.abhaId ? encryptSensitiveField(data.abhaId) : null;

    const patient = await prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({
        data: {
          patientCode,
          fullName: data.fullName,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          ageYears: data.ageYears,
          phone: data.phone,
          phoneHash: phoneH,
          email: data.email,
          address: encryptedAddress,
          emergencyContactName: data.emergencyContactName,
          emergencyContactPhone: data.emergencyContactPhone,
          bloodGroup: data.bloodGroup,
          abhaId: encryptedAbha,
          isTemporaryEmergency: data.isTemporaryEmergency || false,
          notes: encryptedNotes
        }
      });

      // Link or create PatientAccount for OTP portal
      let account = await tx.patientAccount.findUnique({
        where: { phoneHash: phoneH }
      });

      if (!account) {
        account = await tx.patientAccount.create({
          data: {
            phone: data.phone,
            phoneHash: phoneH
          }
        });
      }

      await tx.familyGroup.create({
        data: {
          primaryAccountId: account.id,
          patientId: created.id,
          relationship: data.relationship || 'SELF',
          isGuardian: data.relationship === 'CHILD',
          canManageConsents: true
        }
      });

      return created;
    });

    await recordAuditEntry({
      userId: staffUserId,
      patientId: patient.id,
      action: AuditAction.CREATE,
      resourceType: 'PATIENT',
      resourceId: patient.id,
      metadata: { patientCode, isDuplicateWarning }
    });

    return {
      patient: this.sanitizePatient(patient),
      duplicateWarning: isDuplicateWarning ? 'A patient with similar name and phone number already exists.' : null
    };
  }

  async searchPatients(query: { q?: string; phone?: string; code?: string }) {
    const whereClause: any = { mergedIntoPatientId: null };

    if (query.code) {
      whereClause.patientCode = { contains: query.code.trim().toUpperCase(), mode: 'insensitive' };
    } else if (query.phone) {
      whereClause.phoneHash = hashPhone(query.phone);
    } else if (query.q) {
      const trimmed = query.q.trim();
      whereClause.OR = [
        { fullName: { contains: trimmed, mode: 'insensitive' } },
        { patientCode: { contains: trimmed.toUpperCase(), mode: 'insensitive' } }
      ];
    }

    const patients = await prisma.patient.findMany({
      where: whereClause,
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        allergies: { where: { active: true } }
      }
    });

    return patients.map((p) => this.sanitizePatient(p));
  }

  async getPatientById(id: string, staffUserId?: string) {
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        allergies: { where: { active: true } },
        familyGroups: { include: { primaryAccount: true } },
        appointments: {
          orderBy: { appointmentDate: 'desc' },
          take: 5,
          include: { doctor: { include: { user: true, department: true } } }
        },
        consultations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { doctor: { include: { user: true } } }
        },
        admissions: {
          orderBy: { admissionDate: 'desc' },
          take: 3,
          include: { ward: true, bed: true }
        }
      }
    });

    if (!patient) {
      throw new AppError('Patient not found.', 404, 'PATIENT_NOT_FOUND');
    }

    await recordAuditEntry({
      userId: staffUserId,
      patientId: patient.id,
      action: AuditAction.VIEW,
      resourceType: 'PATIENT',
      resourceId: patient.id
    });

    return this.sanitizePatient(patient);
  }

  async updatePatient(id: string, data: any, staffUserId: string) {
    const patient = await prisma.patient.findUnique({ where: { id } });
    if (!patient) {
      throw new AppError('Patient not found.', 404, 'PATIENT_NOT_FOUND');
    }

    const updateData: any = {};
    if (data.fullName) updateData.fullName = data.fullName;
    if (data.gender) updateData.gender = data.gender;
    if (data.ageYears) updateData.ageYears = data.ageYears;
    if (data.email) updateData.email = data.email;
    if (data.emergencyContactName) updateData.emergencyContactName = data.emergencyContactName;
    if (data.emergencyContactPhone) updateData.emergencyContactPhone = data.emergencyContactPhone;
    if (data.bloodGroup) updateData.bloodGroup = data.bloodGroup;
    if (data.address) updateData.address = encryptSensitiveField(data.address);
    if (data.notes) updateData.notes = encryptSensitiveField(data.notes);
    if (data.abhaId) updateData.abhaId = encryptSensitiveField(data.abhaId);

    const updated = await prisma.patient.update({
      where: { id },
      data: updateData
    });

    await recordAuditEntry({
      userId: staffUserId,
      patientId: id,
      action: AuditAction.UPDATE,
      resourceType: 'PATIENT',
      resourceId: id,
      metadata: { reasonForEdit: data.reasonForEdit, fields: Object.keys(updateData) }
    });

    return this.sanitizePatient(updated);
  }

  async addAllergy(patientId: string, data: any, staffUserId: string) {
    const allergy = await prisma.patientAllergy.create({
      data: {
        patientId,
        allergen: data.allergen,
        allergenType: data.allergenType,
        severity: data.severity,
        reactions: data.reactions,
        recordedById: staffUserId
      }
    });

    await recordAuditEntry({
      userId: staffUserId,
      patientId,
      action: AuditAction.CREATE,
      resourceType: 'PATIENT_ALLERGY',
      resourceId: allergy.id,
      metadata: { allergen: data.allergen, severity: data.severity }
    });

    return allergy;
  }

  async mergePatients(temporaryPatientId: string, targetPatientId: string, reason: string, staffUserId: string) {
    const tempPatient = await prisma.patient.findUnique({ where: { id: temporaryPatientId } });
    const targetPatient = await prisma.patient.findUnique({ where: { id: targetPatientId } });

    if (!tempPatient || !targetPatient) {
      throw new AppError('One or both patients could not be located.', 404, 'PATIENT_NOT_FOUND');
    }

    if (!tempPatient.isTemporaryEmergency) {
      throw new AppError('Only temporary emergency patient records can be merged.', 400, 'INVALID_MERGE_SOURCE');
    }

    await prisma.$transaction(async (tx) => {
      // Re-point clinical appointments, consultations, diagnostic orders, admissions, bills to target patient
      await tx.appointment.updateMany({ where: { patientId: temporaryPatientId }, data: { patientId: targetPatientId } });
      await tx.consultation.updateMany({ where: { patientId: temporaryPatientId }, data: { patientId: targetPatientId } });
      await tx.prescription.updateMany({ where: { patientId: temporaryPatientId }, data: { patientId: targetPatientId } });
      await tx.diagnosticOrder.updateMany({ where: { patientId: temporaryPatientId }, data: { patientId: targetPatientId } });
      await tx.sample.updateMany({ where: { patientId: temporaryPatientId }, data: { patientId: targetPatientId } });
      await tx.imagingStudy.updateMany({ where: { patientId: temporaryPatientId }, data: { patientId: targetPatientId } });
      await tx.report.updateMany({ where: { patientId: temporaryPatientId }, data: { patientId: targetPatientId } });
      await tx.admission.updateMany({ where: { patientId: temporaryPatientId }, data: { patientId: targetPatientId } });
      await tx.bill.updateMany({ where: { patientId: temporaryPatientId }, data: { patientId: targetPatientId } });
      await tx.payment.updateMany({ where: { patientId: temporaryPatientId }, data: { patientId: targetPatientId } });

      // Mark temporary patient merged
      await tx.patient.update({
        where: { id: temporaryPatientId },
        data: {
          mergedIntoPatientId: targetPatientId,
          notes: encryptSensitiveField(`Merged into ${targetPatient.patientCode} on ${new Date().toISOString()}. Reason: ${reason}`)
        }
      });
    });

    await recordAuditEntry({
      userId: staffUserId,
      patientId: targetPatientId,
      action: AuditAction.UPDATE,
      resourceType: 'PATIENT_MERGE',
      resourceId: temporaryPatientId,
      metadata: { fromPatientCode: tempPatient.patientCode, toPatientCode: targetPatient.patientCode, reason }
    });

    return { success: true, message: `Successfully merged ${tempPatient.patientCode} into ${targetPatient.patientCode}.` };
  }

  private sanitizePatient(patient: any) {
    return {
      ...patient,
      address: patient.address ? decryptSensitiveField(patient.address) : null,
      notes: patient.notes ? decryptSensitiveField(patient.notes) : null,
      abhaId: patient.abhaId ? decryptSensitiveField(patient.abhaId) : null
    };
  }
}

export const patientService = new PatientService();
