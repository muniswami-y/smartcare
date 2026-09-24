import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDatabaseClient, StaffRole } from '@caresmart/database';
import { AppError } from './errorHandler';

const prisma = getDatabaseClient();

export interface AuthStaffUser {
  id: string;
  email: string;
  fullName: string;
  roles: StaffRole[];
  doctorProfileId?: string;
  type: 'STAFF';
}

export interface AuthPatientUser {
  patientAccountId: string;
  phone: string;
  activeFamilyMemberId?: string;
  type: 'PATIENT';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthStaffUser;
      patient?: AuthPatientUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.cs_access_token) {
      token = req.cookies.cs_access_token;
    }

    if (!token) {
      return next(new AppError('Authentication required. Missing token.', 401, 'UNAUTHORIZED'));
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Token has expired.', 401, 'TOKEN_EXPIRED'));
      }
      return next(new AppError('Invalid token.', 401, 'INVALID_TOKEN'));
    }

    if (decoded.type === 'STAFF') {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          roles: { where: { revokedAt: null } },
          doctorProfile: true
        }
      });

      if (!user || user.status !== 'ACTIVE') {
        return next(new AppError('User account is inactive or disabled.', 403, 'ACCOUNT_INACTIVE'));
      }

      req.user = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roles: user.roles.map((r) => r.role),
        doctorProfileId: user.doctorProfile?.id,
        type: 'STAFF'
      };
      return next();
    } else if (decoded.type === 'PATIENT') {
      const account = await prisma.patientAccount.findUnique({
        where: { id: decoded.patientAccountId }
      });

      if (!account) {
        return next(new AppError('Patient account not found.', 401, 'UNAUTHORIZED'));
      }

      req.patient = {
        patientAccountId: account.id,
        phone: account.phone,
        activeFamilyMemberId: decoded.activeFamilyMemberId,
        type: 'PATIENT'
      };
      return next();
    }

    return next(new AppError('Unrecognized token structure.', 401, 'INVALID_TOKEN'));
  } catch (error) {
    return next(error);
  }
}
