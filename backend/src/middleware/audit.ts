import { Request, Response, NextFunction } from 'express';
import { AuditAction } from '@caresmart/database';
import { recordAuditEntry } from '../lib/hash-chain';

export function auditAction(action: AuditAction, resourceType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Capture user or patient details
    const userId = req.user?.id || null;
    const patientId = req.patient?.activeFamilyMemberId || (req.params.patientId as string) || null;

    // After response finishes, record the audit entry asynchronously
    res.on('finish', () => {
      if (res.statusCode < 400) {
        recordAuditEntry({
          userId,
          patientId,
          action,
          resourceType,
          resourceId: req.params.id || null,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          metadata: {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode
          }
        });
      }
    });

    next();
  };
}
