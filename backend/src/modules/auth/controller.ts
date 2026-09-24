import { Request, Response, NextFunction } from 'express';
import { authService } from './service';
import { config } from '../../config';

export class AuthController {
  async staffLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, totpToken } = req.body;
      const result = await authService.staffLogin(email, password, totpToken, req.ip, req.get('user-agent'));

      if ('requiresTotp' in result) {
        return res.json({ success: true, requiresTotp: true, userId: result.userId });
      }

      // Set HttpOnly refresh token cookie
      res.cookie('cs_refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: 'lax',
        domain: config.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 3600 * 1000
      });

      return res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  async patientRequestOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone } = req.body;
      const result = await authService.patientRequestOtp(phone, req.ip);
      return res.json({ success: true, data: result });
    } catch (err) {
      return next(err);
    }
  }

  async patientVerifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone, otp, isSharedDevice } = req.body;
      const result = await authService.patientVerifyOtp(phone, otp, isSharedDevice, req.ip, req.get('user-agent'));

      res.cookie('cs_patient_refresh', result.refreshToken, {
        httpOnly: true,
        secure: config.COOKIE_SECURE,
        sameSite: 'lax',
        domain: config.COOKIE_DOMAIN,
        maxAge: (isSharedDevice ? 1 : 30) * 24 * 3600 * 1000
      });

      return res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          account: result.account
        }
      });
    } catch (err) {
      return next(err);
    }
  }

  async listSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const sessions = await authService.listStaffSessions(req.user!.id);
      return res.json({ success: true, data: sessions });
    } catch (err) {
      return next(err);
    }
  }

  async revokeSession(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.revokeStaffSession(req.user!.id, req.params.sessionId);
      return res.json({ success: true, message: 'Session revoked successfully.' });
    } catch (err) {
      return next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    res.clearCookie('cs_refresh_token');
    res.clearCookie('cs_patient_refresh');
    return res.json({ success: true, message: 'Logged out successfully.' });
  }

  async me(req: Request, res: Response, next: NextFunction) {
    if (req.user) {
      return res.json({ success: true, data: { user: req.user, type: 'STAFF' } });
    } else if (req.patient) {
      return res.json({ success: true, data: { patient: req.patient, type: 'PATIENT' } });
    }
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
}

export const authController = new AuthController();
