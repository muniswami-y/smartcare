import {
  getDatabaseClient,
  StaffRole,
  UserStatus,
  AlertStatus,
  AuditAction
} from '@caresmart/database';
import { AppError } from '../../middleware/errorHandler';
import { hashPassword, hashPhone } from '../../lib/crypto';
import { recordAuditEntry, verifyAuditChain } from '../../lib/hash-chain';

const prisma = getDatabaseClient();

export class AdminService {
  async listStaff() {
    return prisma.user.findMany({
      where: {},
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        status: true,
        totpEnabled: true,
        createdAt: true,
        roles: {
          where: { revokedAt: null },
          select: { role: true, assignedAt: true }
        },
        doctorProfile: {
          include: { department: true }
        }
      }
    });
  }

  async createStaff(data: any, adminUserId: string) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('A user account with this email already exists.', 409, 'USER_EXISTS');

    const passwordHash = await hashPassword(data.temporaryPassword);
    const phoneH = data.phone ? hashPhone(data.phone) : null;

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          fullName: data.fullName,
          phone: data.phone,
          phoneHash: phoneH,
          status: UserStatus.ACTIVE,
          mustChangePassword: true,
          roles: {
            create: data.roles.map((r: StaffRole) => ({
              role: r,
              assignedBy: adminUserId
            }))
          }
        },
        include: { roles: true }
      });

      // If DOCTOR role included and doctor fields supplied
      if (data.roles.includes(StaffRole.DOCTOR) && data.departmentId && data.registrationNumber) {
        await tx.doctorProfile.create({
          data: {
            userId: user.id,
            departmentId: data.departmentId,
            registrationNumber: data.registrationNumber,
            consultationFeePaise: data.consultationFeePaise || 50000,
            qualifications: data.qualifications || 'MBBS'
          }
        });
      }

      await recordAuditEntry({
        userId: adminUserId,
        action: AuditAction.CREATE,
        resourceType: 'STAFF_USER',
        resourceId: user.id,
        metadata: { email: user.email, roles: data.roles }
      });

      return user;
    });
  }

  async updateStaffRoles(userId: string, newRoles: StaffRole[], adminUserId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { where: { revokedAt: null } } }
    });

    if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

    // Protect last admin from losing admin role
    const isCurrentlyAdmin = user.roles.some((r) => r.role === StaffRole.ADMIN);
    if (isCurrentlyAdmin && !newRoles.includes(StaffRole.ADMIN)) {
      const totalAdmins = await prisma.staffRoleAssignment.count({
        where: { role: StaffRole.ADMIN, revokedAt: null }
      });
      if (totalAdmins <= 1) {
        throw new AppError('Security violation: Cannot remove ADMIN role from the hospital\'s only active administrator.', 400, 'PROTECTED_LAST_ADMIN');
      }
    }

    return prisma.$transaction(async (tx) => {
      // Revoke existing active roles
      await tx.staffRoleAssignment.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      // Assign new roles
      for (const role of newRoles) {
        await tx.staffRoleAssignment.create({
          data: {
            userId,
            role,
            assignedBy: adminUserId
          }
        });
      }

      await recordAuditEntry({
        userId: adminUserId,
        action: AuditAction.UPDATE,
        resourceType: 'STAFF_ROLES',
        resourceId: userId,
        metadata: { newRoles }
      });

      return { success: true, message: 'Roles updated successfully.' };
    });
  }

  async deactivateStaff(userId: string, reason: string, adminUserId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { where: { revokedAt: null } } }
    });

    if (!user) throw new AppError('User not found.', 404, 'NOT_FOUND');

    // Last admin protection
    const isAdmin = user.roles.some((r) => r.role === StaffRole.ADMIN);
    if (isAdmin) {
      const totalAdmins = await prisma.user.count({
        where: {
          status: UserStatus.ACTIVE,
          roles: { some: { role: StaffRole.ADMIN, revokedAt: null } }
        }
      });
      if (totalAdmins <= 1) {
        throw new AppError('Security violation: Cannot deactivate the sole active system administrator.', 400, 'PROTECTED_LAST_ADMIN');
      }
    }

    return prisma.$transaction(async (tx) => {
      // 1. Mark user inactive
      const deactivated = await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.INACTIVE }
      });

      // 2. Kill all active user sessions immediately
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      await recordAuditEntry({
        userId: adminUserId,
        action: AuditAction.DELETE,
        resourceType: 'STAFF_DEACTIVATE',
        resourceId: userId,
        metadata: { reason }
      });

      return deactivated;
    });
  }

  async getAuditLogs(filter: { action?: AuditAction; resourceType?: string; page?: number; limit?: number }) {
    const page = filter.page || 1;
    const limit = filter.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filter.action) where.action = filter.action;
    if (filter.resourceType) where.resourceType = filter.resourceType;

    const [total, records] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { fullName: true, email: true } } }
      })
    ]);

    return { total, page, limit, records };
  }

  async verifyAuditLogIntegrity() {
    return verifyAuditChain();
  }

  async listAlerts(status?: AlertStatus) {
    return prisma.adminAlert.findMany({
      where: status ? { status } : { status: AlertStatus.OPEN },
      orderBy: { createdAt: 'desc' }
    });
  }

  async resolveAlert(alertId: string, resolutionNotes: string, adminUserId: string) {
    const alert = await prisma.adminAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new AppError('Alert not found.', 404, 'NOT_FOUND');

    return prisma.adminAlert.update({
      where: { id: alertId },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: adminUserId
      }
    });
  }

  async getSettings() {
    return prisma.systemSetting.findMany({
      orderBy: { category: 'asc' }
    });
  }

  async updateSetting(key: string, value: string, adminUserId: string) {
    const updated = await prisma.systemSetting.update({
      where: { key },
      data: {
        value,
        updatedById: adminUserId
      }
    });

    await recordAuditEntry({
      userId: adminUserId,
      action: AuditAction.UPDATE,
      resourceType: 'SYSTEM_SETTING',
      resourceId: key,
      metadata: { key, newValue: value }
    });

    return updated;
  }

  async logExport(exportType: string, reason: string, filterJson: string | undefined, adminUserId: string) {
    const exportRecord = await prisma.exportLog.create({
      data: {
        requestedById: adminUserId,
        exportType,
        reason,
        filterJson
      }
    });

    await recordAuditEntry({
      userId: adminUserId,
      action: AuditAction.VIEW,
      resourceType: 'PATIENT_DATA_EXPORT',
      resourceId: exportRecord.id,
      metadata: { exportType, reason }
    });

    return exportRecord;
  }
}

export const adminService = new AdminService();
