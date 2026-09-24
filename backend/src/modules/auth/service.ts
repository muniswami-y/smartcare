import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDatabaseClient, UserStatus, AuditAction, AlertType, AlertSeverity } from '@caresmart/database';
import { config } from '../../config';
import { AppError } from '../../middleware/errorHandler';
import { hashPassword, verifyPassword, hashPhone, sha256, verifyTotpToken } from '../../lib/crypto';
import { recordAuditEntry } from '../../lib/hash-chain';
import { smsProvider } from '../../lib/notify/smsProvider';

const prisma = getDatabaseClient();

export class AuthService {
  async staffLogin(email: string, password: string, totpToken?: string, ipAddress?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        roles: { where: { revokedAt: null } },
        doctorProfile: true
      }
    });

    if (!user) {
      await recordAuditEntry({
        action: AuditAction.LOGIN_FAILED,
        resourceType: 'AUTH',
        ipAddress,
        userAgent,
        metadata: { email, reason: 'User not found' }
      });
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000));
      throw new AppError(`Account is temporarily locked. Please try again in ${waitMinutes} minutes.`, 403, 'ACCOUNT_LOCKED');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError('Account is inactive or disabled. Contact administrator.', 403, 'ACCOUNT_INACTIVE');
    }

    // Verify password with Argon2
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      const newAttempts = user.failedLoginAttempts + 1;
      const willLock = newAttempts >= 5;
      const lockedUntil = willLock ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newAttempts,
          lockedUntil
        }
      });

      if (willLock) {
        await prisma.adminAlert.create({
          data: {
            alertType: AlertType.FAILED_LOGINS,
            severity: AlertSeverity.HIGH,
            message: `Account ${user.email} locked after 5 consecutive failed login attempts.`,
            metadataJson: JSON.stringify({ userId: user.id, ipAddress })
          }
        });
      }

      await recordAuditEntry({
        userId: user.id,
        action: AuditAction.LOGIN_FAILED,
        resourceType: 'AUTH',
        ipAddress,
        userAgent,
        metadata: { attempts: newAttempts, locked: willLock }
      });

      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Check TOTP 2FA if enabled
    if (user.totpEnabled) {
      if (!totpToken) {
        return {
          requiresTotp: true,
          userId: user.id
        };
      }
      if (!user.totpSecret || !verifyTotpToken(totpToken, user.totpSecret)) {
        throw new AppError('Invalid Two-Factor Authentication token.', 401, 'INVALID_TOTP');
      }
    }

    // Reset failed login count
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null }
      });
    }

    // Issue JWTs
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        roles: user.roles.map((r) => r.role),
        type: 'STAFF'
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'STAFF', nonce: crypto.randomUUID() },
      config.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Save session in DB
    const tokenHash = sha256(refreshToken);
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
      }
    });

    await recordAuditEntry({
      userId: user.id,
      action: AuditAction.LOGIN,
      resourceType: 'AUTH',
      ipAddress,
      userAgent
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles.map((r) => r.role),
        doctorProfileId: user.doctorProfile?.id,
        mustChangePassword: user.mustChangePassword,
        totpEnabled: user.totpEnabled
      }
    };
  }

  async patientRequestOtp(phone: string, ipAddress?: string) {
    const phoneH = hashPhone(phone);
    // Generate 6 digit numeric OTP
    const rawOtp = process.env.NODE_ENV === 'test' ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = sha256(rawOtp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.otpChallenge.create({
      data: {
        phone: phone,
        phoneHash: phoneH,
        otpHash,
        expiresAt
      }
    });

    // Send SMS via provider
    await smsProvider.sendSms({
      to: phone,
      templateCode: 'OTP_LOGIN',
      variables: { otp: rawOtp },
      messageText: `Your CareSmart login OTP is ${rawOtp}. Valid for 5 minutes. Do not share with anyone.`
    });

    return {
      message: 'If this phone number is valid, an OTP has been dispatched to it.',
      expiresInSeconds: 300
    };
  }

  async patientVerifyOtp(phone: string, otp: string, isSharedDevice: boolean, ipAddress?: string, userAgent?: string) {
    const phoneH = hashPhone(phone);
    const now = new Date();

    const challenge = await prisma.otpChallenge.findFirst({
      where: {
        phoneHash: phoneH,
        expiresAt: { gt: now },
        verifiedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!challenge) {
      throw new AppError('OTP expired or invalid. Please request a new one.', 400, 'INVALID_OTP');
    }

    if (challenge.attempts >= 5) {
      throw new AppError('Maximum attempts exceeded for this OTP. Please request a new code.', 400, 'OTP_ATTEMPTS_EXCEEDED');
    }

    const providedHash = sha256(otp);
    if (providedHash !== challenge.otpHash) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: challenge.attempts + 1 }
      });
      throw new AppError('Incorrect OTP entered.', 400, 'INCORRECT_OTP');
    }

    // Mark challenge verified (single use)
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { verifiedAt: now }
    });

    // Find or create patient account
    let account = await prisma.patientAccount.findUnique({
      where: { phoneHash: phoneH },
      include: {
        familyGroups: {
          include: { patient: true }
        }
      }
    });

    if (!account) {
      account = await prisma.patientAccount.create({
        data: {
          phone,
          phoneHash: phoneH
        },
        include: {
          familyGroups: {
            include: { patient: true }
          }
        }
      });
    }

    // Default active patient is the primary or first family member
    const activeMember = account.familyGroups[0]?.patient;

    const accessToken = jwt.sign(
      {
        patientAccountId: account.id,
        phone: account.phone,
        activeFamilyMemberId: activeMember?.id,
        type: 'PATIENT'
      },
      config.JWT_ACCESS_SECRET,
      { expiresIn: isSharedDevice ? '30m' : '2h' }
    );

    const refreshToken = jwt.sign(
      { patientAccountId: account.id, type: 'PATIENT', nonce: crypto.randomUUID() },
      config.JWT_REFRESH_SECRET,
      { expiresIn: isSharedDevice ? '1d' : '30d' }
    );

    const tokenHash = sha256(refreshToken);
    await prisma.patientSession.create({
      data: {
        patientAccountId: account.id,
        activeFamilyMemberId: activeMember?.id,
        tokenHash,
        isSharedDevice,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + (isSharedDevice ? 24 : 30 * 24) * 3600 * 1000)
      }
    });

    await recordAuditEntry({
      patientId: activeMember?.id,
      action: AuditAction.LOGIN,
      resourceType: 'PATIENT_PORTAL',
      ipAddress,
      userAgent
    });

    return {
      accessToken,
      refreshToken,
      account: {
        id: account.id,
        phone: account.phone,
        activeFamilyMember: activeMember ? { id: activeMember.id, name: activeMember.fullName, code: activeMember.patientCode } : null,
        familyMembers: account.familyGroups.map((fg) => ({
          patientId: fg.patient.id,
          name: fg.patient.fullName,
          code: fg.patient.patientCode,
          relationship: fg.relationship,
          isGuardian: fg.isGuardian
        }))
      }
    };
  }

  async listStaffSessions(userId: string) {
    return prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async revokeStaffSession(userId: string, sessionId: string) {
    return prisma.session.updateMany({
      where: { id: sessionId, userId },
      data: { revokedAt: new Date() }
    });
  }
}

export const authService = new AuthService();
