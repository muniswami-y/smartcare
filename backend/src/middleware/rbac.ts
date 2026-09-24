import { Request, Response, NextFunction } from 'express';
import { StaffRole, AuditAction } from '@caresmart/database';
import { AppError } from './errorHandler';
import { recordAuditEntry } from '../lib/hash-chain';

export type AllowedRole = StaffRole | 'PATIENT';

export function requireRoles(...allowedRoles: AllowedRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Check patient authentication
    if (allowedRoles.includes('PATIENT') && req.patient) {
      return next();
    }

    // 2. Check staff authentication
    if (!req.user) {
      await recordAuditEntry({
        userId: null,
        action: AuditAction.DENIED,
        resourceType: req.baseUrl + req.path,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: { reason: 'Unauthenticated access attempt' }
      });
      return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    }

    // Admin has superuser access to all staff-facing endpoints
    if (req.user.roles.includes(StaffRole.ADMIN)) {
      return next();
    }

    // Check if user has at least one of the allowed roles
    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));

    if (!hasRole) {
      // Record denied audit event
      await recordAuditEntry({
        userId: req.user.id,
        action: AuditAction.DENIED,
        resourceType: req.baseUrl + req.path,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        metadata: {
          userRoles: req.user.roles,
          requiredRoles: allowedRoles,
          method: req.method
        }
      });

      return next(
        new AppError(
          'Access forbidden. You do not possess the required clinical or administrative role permissions.',
          403,
          'FORBIDDEN_INSUFFICIENT_ROLE'
        )
      );
    }

    // Prevent MANAGER role from accessing patient-level endpoints
    if (
      req.user.roles.length === 1 &&
      req.user.roles[0] === StaffRole.MANAGER &&
      (req.path.includes('/patient/') || req.params.patientId)
    ) {
      return next(
        new AppError('Manager role is restricted to aggregate operational analytics only.', 403, 'FORBIDDEN_MANAGER_PHI_RESTRICTION')
      );
    }

    return next();
  };
}
