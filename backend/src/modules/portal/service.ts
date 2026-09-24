import {
  getDatabaseClient,
  ConsentStatus,
  DataRequestStatus,
  AuditAction,
  AlertType,
  AlertSeverity
} from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditEntry } from '../../lib/hash-chain';
import { hashPhone } from '../../lib/crypto';

const prisma = getDatabaseClient();

export class PortalService {
  /**
   * Enforces family group data isolation. A patient session can ONLY read/write
   * data belonging to their verified family group.
   */
  async verifyPatientFamilyAccess(patientAccountId: string, targetPatientId: string) {
    const familyRecord = await prisma.familyGroup.findUnique({
      where: {
        primaryAccountId_patientId: {
          primaryAccountId: patientAccountId,
          patientId: targetPatientId
        }
      },
      include: { patient: true }
    });

    if (!familyRecord) {
      throw new AppError('Forbidden: You do not have permission to access records for this family member.', 403, 'UNAUTHORIZED_FAMILY_ACCESS');
    }

    return familyRecord;
  }

  async getHealthTimeline(patientAccountId: string, patientId: string) {
    await this.verifyPatientFamilyAccess(patientAccountId, patientId);

    // ONLY signed or finalized items, NEVER drafts
    const [consultations, reports, bills, admissions] = await Promise.all([
      prisma.consultation.findMany({
        where: { patientId, status: { in: ['LOCKED', 'AMENDED'] } },
        orderBy: { createdAt: 'desc' },
        include: {
          doctor: { include: { user: { select: { fullName: true } }, department: true } },
          prescriptions: {
            where: { status: { in: ['ACTIVE', 'DISPENSED', 'PARTIALLY_DISPENSED'] } },
            include: { items: { include: { medicine: true } } }
          }
        }
      }),
      prisma.report.findMany({
        where: { patientId, status: { in: ['SIGNED', 'AMENDED'] } },
        orderBy: { signedAt: 'desc' },
        include: {
          diagnosticOrder: { include: { testCatalog: true } }
        }
      }),
      prisma.bill.findMany({
        where: { patientId },
        orderBy: { createdAt: 'desc' },
        include: { items: true, payments: true }
      }),
      prisma.admission.findMany({
        where: { patientId, status: { in: ['ADMITTED', 'DISCHARGED'] } },
        orderBy: { admissionDate: 'desc' },
        include: {
          ward: true,
          bed: true,
          dischargeSummary: true
        }
      })
    ]);

    // Build unified chronological timeline
    const timeline: Array<{
      id: string;
      date: Date;
      type: 'CONSULTATION' | 'LAB_IMAGING' | 'BILL' | 'ADMISSION';
      title: string;
      summary: string;
      doctorOrStaff?: string;
      raw: any;
    }> = [];

    for (const c of consultations) {
      timeline.push({
        id: c.id,
        date: c.lockedAt || c.createdAt,
        type: 'CONSULTATION',
        title: `OPD Consultation: ${c.doctor.department.name}`,
        summary: `Diagnosis: ${c.diagnosis || 'Clinical checkup'}. ${c.prescriptions.length} medication(s) prescribed.`,
        doctorOrStaff: c.doctor.user.fullName,
        raw: c
      });
    }

    for (const r of reports) {
      timeline.push({
        id: r.id,
        date: r.signedAt || r.createdAt,
        type: 'LAB_IMAGING',
        title: `Signed Report: ${r.diagnosticOrder.testCatalog.name}`,
        summary: r.impression || r.findings.slice(0, 100),
        raw: r
      });
    }

    for (const b of bills) {
      timeline.push({
        id: b.id,
        date: b.createdAt,
        type: 'BILL',
        title: `Hospital Bill #${b.billNumber} (${b.status})`,
        summary: `Total: ₹${(b.totalPaise / 100).toFixed(2)} | Paid: ₹${(b.paidPaise / 100).toFixed(2)} | Balance: ₹${(b.balancePaise / 100).toFixed(2)}`,
        raw: b
      });
    }

    for (const a of admissions) {
      timeline.push({
        id: a.id,
        date: a.admissionDate,
        type: 'ADMISSION',
        title: `Hospital Admission (${a.ward.name})`,
        summary: `Admitted for ${a.diagnosis}. Status: ${a.status}.`,
        raw: a
      });
    }

    timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

    return timeline;
  }

  async getAccessAuditLog(patientAccountId: string, patientId: string) {
    await this.verifyPatientFamilyAccess(patientAccountId, patientId);

    const logs = await prisma.auditLog.findMany({
      where: { patientId },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: { user: { select: { fullName: true, roles: true } } }
    });

    // Translate audit records into plain, transparent language
    return logs.map((l) => {
      const actor = l.user ? `${l.user.fullName} (${l.user.roles.map((r) => r.role).join(', ')})` : 'System Automated Service';
      let plainAction = 'accessed your file';
      if (l.action === 'VIEW') plainAction = 'viewed';
      if (l.action === 'CREATE') plainAction = 'created record in';
      if (l.action === 'UPDATE') plainAction = 'updated details in';
      if (l.action === 'BREAK_GLASS') plainAction = 'used EMERGENCY BREAK-GLASS access on';

      return {
        id: l.id,
        timestamp: l.timestamp,
        actor,
        resource: l.resourceType,
        plainDescription: `${actor} ${plainAction} your ${l.resourceType.toLowerCase().replace(/_/g, ' ')} record.`,
        isEmergencyBreakGlass: l.action === 'BREAK_GLASS'
      };
    });
  }

  async grantConsent(patientAccountId: string, data: any) {
    await this.verifyPatientFamilyAccess(patientAccountId, data.patientId);

    const validUntil = new Date(Date.now() + data.validDays * 24 * 3600 * 1000);

    const consent = await prisma.consentRecord.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        departmentId: data.departmentId,
        recordType: data.recordType,
        purpose: data.purpose,
        validUntil,
        status: ConsentStatus.GRANTED
      }
    });

    return consent;
  }

  async revokeConsent(patientAccountId: string, consentId: string) {
    const consent = await prisma.consentRecord.findUnique({ where: { id: consentId } });
    if (!consent) throw new AppError('Consent record not found.', 404, 'NOT_FOUND');

    await this.verifyPatientFamilyAccess(patientAccountId, consent.patientId);

    return prisma.consentRecord.update({
      where: { id: consentId },
      data: {
        status: ConsentStatus.REVOKED,
        revokedAt: new Date()
      }
    });
  }

  async setRestrictedRecord(patientAccountId: string, data: any) {
    await this.verifyPatientFamilyAccess(patientAccountId, data.patientId);

    return prisma.restrictedRecordSetting.upsert({
      where: {
        patientId_recordType_recordId: {
          patientId: data.patientId,
          recordType: data.recordType,
          recordId: data.recordId
        }
      },
      update: {
        isRestricted: data.isRestricted,
        reason: data.reason
      },
      create: {
        patientId: data.patientId,
        recordType: data.recordType,
        recordId: data.recordId,
        isRestricted: data.isRestricted,
        reason: data.reason
      }
    });
  }

  async emergencyBreakGlass(doctorUserId: string, data: any) {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { userId: doctorUserId },
      include: { user: true }
    });

    if (!doctor) throw new AppError('Only verified doctors can invoke emergency break-glass.', 403, 'FORBIDDEN');

    // 1. Audit log break-glass
    await recordAuditEntry({
      userId: doctorUserId,
      patientId: data.patientId,
      action: AuditAction.BREAK_GLASS,
      resourceType: data.recordType,
      resourceId: data.recordId,
      metadata: { justificationReason: data.justificationReason }
    });

    // 2. High severity Admin alert
    await prisma.adminAlert.create({
      data: {
        alertType: AlertType.BREAK_GLASS,
        severity: AlertSeverity.CRITICAL,
        message: `EMERGENCY BREAK-GLASS: Dr. ${doctor.user.fullName} accessed restricted ${data.recordType} for Patient ${data.patientId}. Reason: ${data.justificationReason}`,
        metadataJson: JSON.stringify(data)
      }
    });

    // 3. In-App notification to patient
    await prisma.inAppNotification.create({
      data: {
        recipientPatientId: data.patientId,
        title: 'Emergency Break-Glass Record Access',
        message: `Dr. ${doctor.user.fullName} accessed your restricted clinical record under emergency protocol. Justification: "${data.justificationReason}".`,
        category: 'ALERT'
      }
    });

    return {
      success: true,
      message: 'Emergency break-glass access granted. Logged and notified.'
    };
  }

  async submitDataRequest(patientAccountId: string, data: any) {
    await this.verifyPatientFamilyAccess(patientAccountId, data.patientId);

    const count = await prisma.dataRequest.count();
    const requestNumber = `DPR-${new Date().getFullYear()}-${(count + 1001).toString()}`;

    const req = await prisma.dataRequest.create({
      data: {
        requestNumber,
        patientId: data.patientId,
        requestType: data.requestType,
        details: data.details,
        status: DataRequestStatus.SUBMITTED
      }
    });

    return req;
  }

  async generateDataExport(patientAccountId: string, patientId: string) {
    await this.verifyPatientFamilyAccess(patientAccountId, patientId);

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        allergies: true,
        appointments: true,
        consultations: { include: { prescriptions: { include: { items: { include: { medicine: true } } } } } },
        diagnosticOrders: { include: { testCatalog: true, reports: true } },
        bills: { include: { items: true, payments: true } },
        admissions: { include: { ward: true, bed: true, dischargeSummary: true } }
      }
    });

    return {
      exportMetadata: {
        patientCode: patient?.patientCode,
        generatedAt: new Date().toISOString(),
        dpdpCompliance: 'India Digital Personal Data Protection Act 2023 - Right to Data Portability',
        validity: 'Expiring download link'
      },
      patientData: patient
    };
  }
}

export const portalService = new PortalService();
