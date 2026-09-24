import { Router } from 'express';
import { authController } from './controller';
import { validate } from '../../middleware/validate';
import { StaffLoginSchema, PatientRequestOtpSchema, PatientVerifyOtpSchema } from './schemas';
import { authRateLimiter, otpRateLimiter } from '../../middleware/rateLimit';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Staff Login
router.post('/staff/login', authRateLimiter, validate({ body: StaffLoginSchema }), authController.staffLogin);

// Patient Mobile OTP Login
router.post('/patient/otp/request', otpRateLimiter, validate({ body: PatientRequestOtpSchema }), authController.patientRequestOtp);
router.post('/patient/otp/verify', otpRateLimiter, validate({ body: PatientVerifyOtpSchema }), authController.patientVerifyOtp);

// Authenticated Session Endpoints
router.get('/me', authenticate, authController.me);
router.get('/sessions', authenticate, authController.listSessions);
router.delete('/sessions/:sessionId', authenticate, authController.revokeSession);
router.post('/logout', authController.logout);

export default router;
