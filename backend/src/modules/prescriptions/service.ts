import {
  getDatabaseClient,
  PrescriptionStatus,
  AuditAction
} from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditEntry } from '../../lib/hash-chain';
import interactionsList from './interactions.json';
import { generatePrintableHtml } from '../../lib/pdf';

const prisma = getDatabaseClient();

export interface SafetyWarning {
  type: 'ALLERGY' | 'DUPLICATE' | 'STILL_ACTIVE' | 'DRUG_INTERACTION';
  severity: 'WARNING' | 'CRITICAL';
  medicineName: string;
  message: string;
}

export class PrescriptionService {
  async checkSafety(patientId: string, items: Array<{ medicineId: string }>): Promise<SafetyWarning[]> {
    const warnings: SafetyWarning[] = [];
    const medicineIds = items.map((i) => i.medicineId);

    // 1. Fetch medicine entities
    const medicines = await prisma.medicine.findMany({
      where: { id: { in: medicineIds } }
    });
    const medMap = new Map(medicines.map((m) => [m.id, m]));

    // 2. Duplicate Check within current order
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.medicineId)) {
        const med = medMap.get(item.medicineId);
        warnings.push({
          type: 'DUPLICATE',
          severity: 'WARNING',
          medicineName: med ? med.brandName : 'Unknown',
          message: `Medicine '${med?.brandName}' has been added more than once to this prescription.`
        });
      }
      seen.add(item.medicineId);
    }

    // 3. Patient Allergy Check
    const allergies = await prisma.patientAllergy.findMany({
      where: { patientId, active: true }
    });

    for (const med of medicines) {
      for (const al of allergies) {
        const allergenLower = al.allergen.toLowerCase();
        const genLower = med.genericName.toLowerCase();
        const brandLower = med.brandName.toLowerCase();

        if (genLower.includes(allergenLower) || brandLower.includes(allergenLower) || allergenLower.includes(genLower)) {
          warnings.push({
            type: 'ALLERGY',
            severity: 'CRITICAL',
            medicineName: med.brandName,
            message: `CRITICAL ALLERGY ALERT: Patient has a recorded allergy to '${al.allergen}'. Prescribing '${med.brandName}' (${med.genericName}) is contraindicated.`
          });
        }
      }
    }

    // 4. Still-Active earlier prescription check
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const recentPrescriptions = await prisma.prescription.findMany({
      where: {
        patientId,
        status: { in: [PrescriptionStatus.ACTIVE, PrescriptionStatus.DISPENSED] },
        createdAt: { gte: fourteenDaysAgo }
      },
      include: { items: { include: { medicine: true } } }
    });

    for (const rx of recentPrescriptions) {
      for (const rxItem of rx.items) {
        if (medicineIds.includes(rxItem.medicineId)) {
          warnings.push({
            type: 'STILL_ACTIVE',
            severity: 'WARNING',
            medicineName: rxItem.medicine.brandName,
            message: `Patient was recently prescribed '${rxItem.medicine.brandName}' on ${rx.createdAt.toISOString().split('T')[0]} (Prescription #${rx.prescriptionCode}).`
          });
        }
      }
    }

    // 5. Drug-to-Drug Interactions
    for (const medA of medicines) {
      for (const medB of medicines) {
        if (medA.id === medB.id) continue;

        for (const inter of interactionsList) {
          const matchA = medA.genericName.toLowerCase().includes(inter.drug1.toLowerCase()) || medA.brandName.toLowerCase().includes(inter.drug1.toLowerCase());
          const matchB = medB.genericName.toLowerCase().includes(inter.drug2.toLowerCase()) || medB.brandName.toLowerCase().includes(inter.drug2.toLowerCase());

          if (matchA && matchB) {
            warnings.push({
              type: 'DRUG_INTERACTION',
              severity: inter.severity === 'MAJOR' ? 'CRITICAL' : 'WARNING',
              medicineName: `${medA.brandName} + ${medB.brandName}`,
              message: `Interaction: ${inter.description}`
            });
          }
        }
      }
    }

    return warnings;
  }

  async createPrescription(data: any, doctorUserId: string) {
    const warnings = await this.checkSafety(data.patientId, data.items);

    if (warnings.length > 0 && !data.safetyOverrideReason) {
      return {
        requiresOverride: true,
        warnings,
        message: 'Safety warnings detected. A clinical override justification is mandatory to proceed.'
      };
    }

    const count = await prisma.prescription.count();
    const prescriptionCode = `RX-${Date.now().toString().slice(-6)}-${(count + 1).toString().padStart(4, '0')}`;

    const prescription = await prisma.prescription.create({
      data: {
        prescriptionCode,
        consultationId: data.consultationId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        status: PrescriptionStatus.ACTIVE,
        version: 1,
        safetyOverrideReason: data.safetyOverrideReason,
        items: {
          create: data.items.map((i: any) => ({
            medicineId: i.medicineId,
            dosage: i.dosage,
            frequency: i.frequency,
            durationDays: i.durationDays,
            route: i.route || 'Oral',
            instructions: i.instructions,
            quantity: i.quantity,
            dispensedQuantity: 0
          }))
        }
      },
      include: {
        items: { include: { medicine: true } },
        doctor: { include: { user: true, department: true } }
      }
    });

    await recordAuditEntry({
      userId: doctorUserId,
      patientId: data.patientId,
      action: AuditAction.CREATE,
      resourceType: 'PRESCRIPTION',
      resourceId: prescription.id,
      metadata: { prescriptionCode, itemCount: data.items.length, override: !!data.safetyOverrideReason }
    });

    return {
      success: true,
      prescription,
      warnings
    };
  }

  async cancelPrescription(id: string, reason: string, doctorUserId: string) {
    const rx = await prisma.prescription.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!rx) throw new AppError('Prescription not found.', 404, 'NOT_FOUND');

    const alreadyDispensed = rx.items.some((i) => i.dispensedQuantity > 0);
    if (alreadyDispensed) {
      throw new AppError('Cannot cancel prescription. One or more medicines have already been dispensed by pharmacy.', 400, 'ALREADY_DISPENSED');
    }

    const updated = await prisma.prescription.update({
      where: { id },
      data: {
        status: PrescriptionStatus.CANCELLED,
        cancelReason: reason
      }
    });

    await recordAuditEntry({
      userId: doctorUserId,
      patientId: rx.patientId,
      action: AuditAction.UPDATE,
      resourceType: 'PRESCRIPTION_CANCEL',
      resourceId: id,
      metadata: { cancelReason: reason }
    });

    return updated;
  }

  async getPrintablePrescription(id: string) {
    const rx = await prisma.prescription.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { include: { user: true, department: true } },
        consultation: true,
        items: { include: { medicine: true } }
      }
    });

    if (!rx) throw new AppError('Prescription not found.', 404, 'NOT_FOUND');

    const html = generatePrintableHtml({
      hospitalName: 'CareSmart Multispeciality Hospital',
      documentTitle: `E-Prescription (#${rx.prescriptionCode})`,
      patientName: rx.patient.fullName,
      patientCode: rx.patient.patientCode,
      date: rx.createdAt.toISOString().split('T')[0],
      doctorName: rx.doctor.user.fullName,
      doctorRegNo: rx.doctor.registrationNumber,
      items: [
        { label: 'Gender / Age', value: `${rx.patient.gender} / ${rx.patient.ageYears || 'N/A'} yrs` },
        { label: 'Department', value: rx.doctor.department.name },
        { label: 'Diagnosis', value: rx.consultation.diagnosis || 'Clinical evaluation' },
        { label: 'Status', value: rx.status }
      ],
      tables: [
        {
          headers: ['#', 'Medicine (Brand / Generic)', 'Dosage', 'Frequency', 'Duration', 'Instructions', 'Qty'],
          rows: rx.items.map((item, index) => [
            (index + 1).toString(),
            `${item.medicine.brandName} (${item.medicine.genericName} ${item.medicine.strength})`,
            item.dosage,
            item.frequency,
            `${item.durationDays} days`,
            item.instructions || '-',
            item.quantity.toString()
          ])
        }
      ],
      notes: rx.safetyOverrideReason ? `* Clinical safety override recorded: ${rx.safetyOverrideReason}` : undefined
    });

    return { html, prescriptionCode: rx.prescriptionCode };
  }

  async copyPreviousPrescription(patientId: string) {
    const latest = await prisma.prescription.findFirst({
      where: { patientId, status: { in: [PrescriptionStatus.ACTIVE, PrescriptionStatus.DISPENSED] } },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { medicine: true } } }
    });

    if (!latest) {
      throw new AppError('No prior active or dispensed prescription found for this patient.', 404, 'NO_PREVIOUS_PRESCRIPTION');
    }

    return latest;
  }
}

export const prescriptionService = new PrescriptionService();
