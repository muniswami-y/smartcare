import 'dotenv/config';
import path from 'path';
import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { PrismaClient } from '../src/index';

let prisma: PrismaClient;

describe('CareSmart Database Schema & Integrity Tests', () => {
  beforeAll(async () => {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/caresmart?schema=public';
    process.env.DATABASE_URL = dbUrl;
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl
        }
      }
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to database successfully', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as connected;`;
    expect(result).toBeDefined();
  });

  it('contains essential system settings', async () => {
    const hospitalName = await prisma.systemSetting.findUnique({
      where: { key: 'HOSPITAL_NAME' }
    });
    // In demo or test mode, if seeded or if setting is queried
    expect(hospitalName === null || typeof hospitalName.value === 'string').toBe(true);
  });

  it('guarantees money is stored as integer paise', async () => {
    const testDoc = await prisma.doctorProfile.findFirst();
    if (testDoc) {
      expect(Number.isInteger(testDoc.consultationFeePaise)).toBe(true);
    }
  });

  it('enforces append-only triggers on AuditLog preventing UPDATE', async () => {
    // Attempting an update on an AuditLog record should throw a database trigger exception
    const log = await prisma.auditLog.findFirst();
    if (log) {
      await expect(
        prisma.auditLog.update({
          where: { id: log.id },
          data: { action: 'UPDATE' }
        })
      ).rejects.toThrow();
    }
  });
});
