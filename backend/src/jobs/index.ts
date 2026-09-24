import cron from 'node-cron';
import { getDatabaseClient, JobStatus } from '@caresmart/database';
import { logger } from '../lib/logger';
import { ipdService } from '../modules/ipd/service';
import { analyticsService } from '../modules/analytics/service';
import { pharmacyService } from '../modules/pharmacy/service';
import { verifyAuditChain } from '../lib/hash-chain';

const prisma = getDatabaseClient();

async function runLoggedJob(jobName: string, taskFn: () => Promise<any>) {
  logger.info(`[CRON] Starting job '${jobName}'...`);
  const jobRun = await prisma.jobRun.create({
    data: {
      jobName,
      status: JobStatus.RUNNING
    }
  });

  try {
    const result = await taskFn();
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: JobStatus.SUCCESS,
        completedAt: new Date(),
        recordsProcessed: result?.recordsProcessed || result?.accruedCharges || 0,
        metadataJson: JSON.stringify(result || {})
      }
    });
    logger.info(`[CRON] Job '${jobName}' completed successfully.`);
  } catch (err: any) {
    logger.error({ err }, `[CRON] Job '${jobName}' failed.`);
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        errorMessage: err.message
      }
    });
  }
}

export function initBackgroundJobs() {
  if (process.env.NODE_ENV === 'test') {
    // Skip cron timers in test suite
    return;
  }

  // 1. Daily Bed Charges Job: Midnight 00:05
  cron.schedule('5 0 * * *', () => {
    runLoggedJob('DAILY_BED_CHARGES', () => ipdService.runDailyBedChargesJob());
  });

  // 2. Daily Analytics Snapshot: 23:55
  cron.schedule('55 23 * * *', () => {
    runLoggedJob('DAILY_ANALYTICS_SNAPSHOT', () => analyticsService.runDailySnapshotJob());
  });

  // 3. Cryptographic Audit Log Chain Verification: 02:00
  cron.schedule('0 2 * * *', () => {
    runLoggedJob('AUDIT_CHAIN_VERIFICATION', () => verifyAuditChain());
  });

  // 4. Pharmacy Low-stock & Expiry Monitor: Every 6 hours
  cron.schedule('0 */6 * * *', () => {
    runLoggedJob('PHARMACY_INVENTORY_CHECK', () => pharmacyService.getInventoryAlerts());
  });

  logger.info('CareSmart background cron jobs initialized.');
}
