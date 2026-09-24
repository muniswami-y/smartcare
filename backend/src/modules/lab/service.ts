import crypto from 'crypto';
import {
  getDatabaseClient,
  SampleStatus,
  DiagnosticOrderStatus,
  ReportStatus,
  OrderType,
  AuditAction,
  AlertType,
  AlertSeverity
} from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';
import { recordAuditEntry } from '../../lib/hash-chain';
import { sha256 } from '../../lib/crypto';
import { generatePrintableHtml } from '../../lib/pdf';

const prisma = getDatabaseClient();

export class LabService {
  async getWorklist() {
    return prisma.diagnosticOrder.findMany({
      where: {
        orderType: OrderType.LAB,
        status: { in: [DiagnosticOrderStatus.ORDERED, DiagnosticOrderStatus.SAMPLE_COLLECTED, DiagnosticOrderStatus.IN_PROGRESS] }
      },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'asc' }],
      include: {
        patient: { select: { id: true, patientCode: true, fullName: true, gender: true, ageYears: true } },
        testCatalog: { include: { parameters: { orderBy: { orderIndex: 'asc' } } } },
        samples: true,
        labResults: true
      }
    });
  }

  async collectSample(data: any, staffUserId: string) {
    const order = await prisma.diagnosticOrder.findUnique({ where: { id: data.diagnosticOrderId } });
    if (!order) throw new AppError('Diagnostic order not found.', 404, 'NOT_FOUND');

    const count = await prisma.sample.count();
    const barcode = `SMP-${new Date().getFullYear().toString().slice(-2)}-${(count + 1001).toString()}`;

    return prisma.$transaction(async (tx) => {
      const sample = await tx.sample.create({
        data: {
          sampleBarcode: barcode,
          diagnosticOrderId: data.diagnosticOrderId,
          patientId: data.patientId,
          testCatalogId: data.testCatalogId,
          sampleType: data.sampleType,
          collectedById: staffUserId,
          status: SampleStatus.COLLECTED
        }
      });

      await tx.diagnosticOrder.update({
        where: { id: data.diagnosticOrderId },
        data: { status: DiagnosticOrderStatus.SAMPLE_COLLECTED }
      });

      await recordAuditEntry({
        userId: staffUserId,
        patientId: data.patientId,
        action: AuditAction.CREATE,
        resourceType: 'LAB_SAMPLE',
        resourceId: sample.id,
        metadata: { barcode, sampleType: data.sampleType }
      });

      return sample;
    });
  }

  async rejectSample(sampleId: string, reason: string, staffUserId: string) {
    const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
    if (!sample) throw new AppError('Sample not found.', 404, 'NOT_FOUND');

    const updated = await prisma.sample.update({
      where: { id: sampleId },
      data: {
        status: SampleStatus.REJECTED,
        rejectionReason: reason,
        rejectedById: staffUserId
      }
    });

    await recordAuditEntry({
      userId: staffUserId,
      patientId: sample.patientId,
      action: AuditAction.UPDATE,
      resourceType: 'SAMPLE_REJECT',
      resourceId: sampleId,
      metadata: { rejectionReason: reason }
    });

    return updated;
  }

  async recordResults(data: any, staffUserId: string) {
    const order = await prisma.diagnosticOrder.findUnique({
      where: { id: data.diagnosticOrderId },
      include: {
        patient: true,
        testCatalog: { include: { parameters: true } }
      }
    });

    if (!order) throw new AppError('Diagnostic order not found.', 404, 'NOT_FOUND');

    const paramMap = new Map(order.testCatalog.parameters.map((p) => [p.id, p]));
    const recordedList: any[] = [];
    const criticalAlerts: any[] = [];

    return prisma.$transaction(async (tx) => {
      for (const res of data.results) {
        const param = paramMap.get(res.parameterId);
        if (!param) continue;

        let isAbnormal = false;
        let isCritical = false;
        const numVal = parseFloat(res.value);

        if (!isNaN(numVal)) {
          // Check critical range
          if ((param.criticalLow !== null && numVal <= param.criticalLow) || (param.criticalHigh !== null && numVal >= param.criticalHigh)) {
            isCritical = true;
            isAbnormal = true;
            criticalAlerts.push({
              paramName: param.name,
              value: res.value,
              unit: param.unit,
              criticalThreshold: `${param.criticalLow ?? '-'} to ${param.criticalHigh ?? '-'}`
            });
          } else {
            // Check reference range according to patient gender
            const min = order.patient.gender === 'FEMALE' ? param.femaleMin ?? param.maleMin : param.maleMin;
            const max = order.patient.gender === 'FEMALE' ? param.femaleMax ?? param.maleMax : param.maleMax;

            if ((min !== null && numVal < min) || (max !== null && numVal > max)) {
              isAbnormal = true;
            }
          }
        }

        const saved = await tx.labResult.create({
          data: {
            diagnosticOrderId: data.diagnosticOrderId,
            sampleId: data.sampleId,
            parameterId: res.parameterId,
            value: res.value,
            unit: res.unit || param.unit,
            isAbnormal,
            isCritical,
            notes: res.notes,
            recordedById: staffUserId
          }
        });

        recordedList.push(saved);
      }

      await tx.diagnosticOrder.update({
        where: { id: data.diagnosticOrderId },
        data: { status: DiagnosticOrderStatus.IN_PROGRESS }
      });

      // Post critical alerts if any
      for (const alert of criticalAlerts) {
        await tx.adminAlert.create({
          data: {
            alertType: AlertType.CRITICAL_LAB_VALUE,
            severity: AlertSeverity.CRITICAL,
            message: `CRITICAL LAB VALUE ALERT for Patient ${order.patient.fullName} (${order.patient.patientCode}): ${alert.paramName} = ${alert.value} ${alert.unit || ''} (Critical limit: ${alert.criticalThreshold}).`,
            metadataJson: JSON.stringify({
              orderId: order.id,
              patientId: order.patientId,
              parameter: alert.paramName,
              value: alert.value
            })
          }
        });
      }

      return recordedList;
    });
  }

  async signReport(data: any, signingStaffUserId: string) {
    const order = await prisma.diagnosticOrder.findUnique({
      where: { id: data.diagnosticOrderId },
      include: { reports: true }
    });

    if (!order) throw new AppError('Diagnostic order not found.', 404, 'NOT_FOUND');

    const existingReport = order.reports.find((r) => r.status === ReportStatus.SIGNED);
    const version = existingReport ? existingReport.version + 1 : 1;
    const count = await prisma.report.count();
    const reportCode = `REP-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;

    return prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          reportCode,
          diagnosticOrderId: data.diagnosticOrderId,
          patientId: order.patientId,
          signingStaffId: signingStaffUserId,
          reportType: OrderType.LAB,
          status: ReportStatus.SIGNED,
          findings: data.findings,
          impression: data.impression,
          signedAt: new Date(),
          version,
          previousReportId: existingReport?.id
        }
      });

      await tx.diagnosticOrder.update({
        where: { id: data.diagnosticOrderId },
        data: { status: DiagnosticOrderStatus.COMPLETED }
      });

      await recordAuditEntry({
        userId: signingStaffUserId,
        patientId: order.patientId,
        action: AuditAction.CREATE,
        resourceType: 'LAB_REPORT_SIGN',
        resourceId: report.id,
        metadata: { reportCode, version }
      });

      return report;
    });
  }

  async getPrintableReport(reportId: string) {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        patient: true,
        diagnosticOrder: {
          include: {
            testCatalog: true,
            labResults: { include: { parameter: true } }
          }
        }
      }
    });

    if (!report) throw new AppError('Report not found.', 404, 'NOT_FOUND');

    const staffSigner = await prisma.user.findUnique({ where: { id: report.signingStaffId } });

    const html = generatePrintableHtml({
      hospitalName: 'CareSmart Multispeciality Hospital - Department of Laboratory Medicine',
      documentTitle: `Signed Diagnostic Report (#${report.reportCode})`,
      patientName: report.patient.fullName,
      patientCode: report.patient.patientCode,
      date: report.signedAt ? report.signedAt.toISOString().split('T')[0] : 'N/A',
      doctorName: staffSigner?.fullName || 'Chief Pathologist / Radiologist',
      items: [
        { label: 'Gender / Age', value: `${report.patient.gender} / ${report.patient.ageYears || 'N/A'} yrs` },
        { label: 'Investigation', value: report.diagnosticOrder.testCatalog.name },
        { label: 'Status', value: report.status },
        { label: 'Version', value: `v${report.version}` }
      ],
      tables: [
        {
          headers: ['Parameter', 'Result Value', 'Reference Range', 'Flag'],
          rows: report.diagnosticOrder.labResults.map((r) => [
            r.parameter.name,
            `${r.value} ${r.unit || ''}`,
            `${r.parameter.maleMin ?? '-'} - ${r.parameter.maleMax ?? '-'} ${r.parameter.unit || ''}`,
            r.isCritical ? 'CRITICAL' : r.isAbnormal ? 'ABNORMAL' : 'NORMAL'
          ])
        }
      ],
      notes: `Findings:\n${report.findings}\n\nImpression:\n${report.impression || 'Clinically correlated.'}`
    });

    return { html, reportCode: report.reportCode };
  }

  async createShareLink(data: any, staffUserId?: string) {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = sha256(rawToken);
    const expiresAt = new Date(Date.now() + data.expiryHours * 3600 * 1000);

    const share = await prisma.shareLink.create({
      data: {
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        patientId: data.patientId,
        tokenHash,
        maxViews: data.maxViews,
        expiresAt,
        createdById: staffUserId
      }
    });

    return {
      shareId: share.id,
      token: rawToken,
      expiresAt: share.expiresAt,
      shareUrl: `/api/v1/lab/share/${rawToken}`
    };
  }

  async accessShareLink(rawToken: string, ipAddress?: string, userAgent?: string) {
    const tokenHash = sha256(rawToken);
    const link = await prisma.shareLink.findUnique({ where: { tokenHash } });

    if (!link || link.revokedAt || link.expiresAt < new Date()) {
      throw new AppError('Share link is expired, invalid or revoked.', 404, 'SHARE_LINK_INVALID');
    }

    if (link.viewCount >= link.maxViews) {
      throw new AppError('Maximum view quota exceeded for this share link.', 403, 'SHARE_QUOTA_EXCEEDED');
    }

    await prisma.shareLink.update({
      where: { id: link.id },
      data: { viewCount: link.viewCount + 1 }
    });

    await recordAuditEntry({
      patientId: link.patientId,
      action: AuditAction.VIEW,
      resourceType: 'CONSENT_SHARE_LINK',
      resourceId: link.referenceId,
      ipAddress,
      userAgent,
      metadata: { currentViews: link.viewCount + 1, maxViews: link.maxViews }
    });

    if (link.referenceType === 'REPORT') {
      return this.getPrintableReport(link.referenceId);
    }

    return { referenceType: link.referenceType, referenceId: link.referenceId };
  }
}

export const labService = new LabService();
