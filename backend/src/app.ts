import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { requestIdMiddleware } from './middleware/requestId';
import { errorHandler } from './middleware/errorHandler';
import { getDatabaseClient } from '@caresmart/database';

// Import route modules
import authRoutes from './modules/auth/routes';
import patientRoutes from './modules/patients/routes';
import appointmentRoutes from './modules/appointments/routes';
import queueRoutes from './modules/queue/routes';
import consultationRoutes from './modules/consultations/routes';
import prescriptionRoutes from './modules/prescriptions/routes';
import pharmacyRoutes from './modules/pharmacy/routes';
import labRoutes from './modules/lab/routes';
import imagingRoutes from './modules/imaging/routes';
import billingRoutes from './modules/billing/routes';
import ipdRoutes from './modules/ipd/routes';
import portalRoutes from './modules/portal/routes';
import adminRoutes from './modules/admin/routes';
import analyticsRoutes from './modules/analytics/routes';

export function createApp() {
  const app = express();

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'https://api.razorpay.com']
        }
      }
    })
  );

  // CORS Configuration
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    })
  );

  // Request parsing with size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Tracing and Request IDs
  app.use(requestIdMiddleware);

  // Health and Readiness probes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'HEALTHY',
      service: 'CareSmart Backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime()
    });
  });

  app.get('/api/ready', async (req, res) => {
    try {
      const prisma = getDatabaseClient();
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        ready: true,
        database: 'CONNECTED',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(503).json({
        ready: false,
        database: 'DISCONNECTED',
        error: err.message
      });
    }
  });

  // Mount API v1 modules
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/patients', patientRoutes);
  app.use('/api/v1/appointments', appointmentRoutes);
  app.use('/api/v1/queue', queueRoutes);
  app.use('/api/v1/consultations', consultationRoutes);
  app.use('/api/v1/prescriptions', prescriptionRoutes);
  app.use('/api/v1/pharmacy', pharmacyRoutes);
  app.use('/api/v1/lab', labRoutes);
  app.use('/api/v1/imaging', imagingRoutes);
  app.use('/api/v1/billing', billingRoutes);
  app.use('/api/v1/ipd', ipdRoutes);
  app.use('/api/v1/portal', portalRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Endpoint '${req.method} ${req.originalUrl}' does not exist.`
      },
      requestId: req.id
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
