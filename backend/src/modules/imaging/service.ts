import {
  getDatabaseClient,
  OrderType,
  DiagnosticOrderStatus,
  ReportStatus,
  AuditAction
} from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';
import { storageProvider, dicomProvider } from '../../lib/storage/storageProvider';
import { recordAuditEntry } from '../../lib/hash-chain';

const prisma = getDatabaseClient();

export class ImagingService {
  async getWorklist() {
    return prisma.diagnosticOrder.findMany({
      where: {
        orderType: OrderType.IMAGING,
        status: { in: [DiagnosticOrderStatus.ORDERED, DiagnosticOrderStatus.IN_PROGRESS] }
      },
      orderBy: [{ urgency: 'desc' }, { createdAt: 'asc' }],
      include: {
        patient: { select: { id: true, patientCode: true, fullName: true, gender: true, ageYears: true } },
        testCatalog: true,
        imagingStudies: { include: { mediaFiles: true } },
        reports: true
      }
    });
  }

  async createStudy(data: any, staffUserId: string) {
    const study = await prisma.imagingStudy.create({
      data: {
        diagnosticOrderId: data.diagnosticOrderId,
        patientId: data.patientId,
        testCatalogId: data.testCatalogId,
        modality: data.modality,
        source: data.source,
        notes: data.notes,
        conductedById: staffUserId
      },
      include: { mediaFiles: true }
    });

    await prisma.diagnosticOrder.update({
      where: { id: data.diagnosticOrderId },
      data: { status: DiagnosticOrderStatus.IN_PROGRESS }
    });

    return study;
  }

  async uploadStudyFile(studyId: string, file: Express.Multer.File, staffUserId: string) {
    const study = await prisma.imagingStudy.findUnique({ where: { id: studyId } });
    if (!study) throw new AppError('Imaging study not found.', 404, 'NOT_FOUND');

    // Save to secured storage
    const savedMeta = await storageProvider.saveFile(file.buffer, file.originalname, file.mimetype);

    // If file is DICOM (.dcm), also notify PACS stub
    if (file.originalname.toLowerCase().endsWith('.dcm') || file.mimetype === 'application/dicom') {
      await dicomProvider.pushInstanceToOrthanc(file.buffer);
    }

    const mediaFile = await prisma.mediaFile.create({
      data: {
        referenceType: 'IMAGING_STUDY',
        referenceId: study.id,
        imagingStudyId: study.id,
        fileKey: savedMeta.fileKey,
        originalName: savedMeta.originalName,
        mimeType: savedMeta.mimeType,
        sizeBytes: savedMeta.sizeBytes,
        checksumSha256: savedMeta.checksumSha256,
        storageProvider: 'LOCAL',
        uploadedById: staffUserId
      }
    });

    await recordAuditEntry({
      userId: staffUserId,
      patientId: study.patientId,
      action: AuditAction.CREATE,
      resourceType: 'IMAGING_MEDIA_UPLOAD',
      resourceId: mediaFile.id,
      metadata: { originalName: savedMeta.originalName, sizeBytes: savedMeta.sizeBytes }
    });

    return mediaFile;
  }

  async getFileStream(mediaFileId: string, staffUserId?: string) {
    const media = await prisma.mediaFile.findUnique({ where: { id: mediaFileId } });
    if (!media) throw new AppError('Media file not found.', 404, 'NOT_FOUND');

    await recordAuditEntry({
      userId: staffUserId,
      action: AuditAction.VIEW,
      resourceType: 'SECURE_MEDIA_FILE',
      resourceId: media.id,
      metadata: { originalName: media.originalName }
    });

    const stream = await storageProvider.getFileStream(media.fileKey);
    return { stream, media };
  }

  async signRadiologyReport(data: any, radiologistUserId: string) {
    const order = await prisma.diagnosticOrder.findUnique({
      where: { id: data.diagnosticOrderId },
      include: { reports: true }
    });

    if (!order) throw new AppError('Diagnostic order not found.', 404, 'NOT_FOUND');

    const existingReport = order.reports.find((r) => r.status === ReportStatus.SIGNED);
    const version = existingReport ? existingReport.version + 1 : 1;
    const count = await prisma.report.count();
    const reportCode = `RAD-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;

    return prisma.$transaction(async (tx) => {
      const report = await tx.report.create({
        data: {
          reportCode,
          diagnosticOrderId: data.diagnosticOrderId,
          patientId: order.patientId,
          signingStaffId: radiologistUserId,
          reportType: OrderType.IMAGING,
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
        userId: radiologistUserId,
        patientId: order.patientId,
        action: AuditAction.CREATE,
        resourceType: 'RADIOLOGY_REPORT_SIGN',
        resourceId: report.id,
        metadata: { reportCode, version }
      });

      return report;
    });
  }
}

export const imagingService = new ImagingService();
