import { getDatabaseClient, AuditAction } from '@caresmart/database';
import { sha256 } from './crypto';

const prisma = getDatabaseClient();

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface AuditPayload {
  userId?: string | null;
  patientId?: string | null;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any> | null;
}

// In-process serialized lock to ensure strictly sequential hash-chaining under concurrent requests
let chainLock: Promise<void> = Promise.resolve();

export async function recordAuditEntry(payload: AuditPayload) {
  let releaseLock: () => void = () => {};
  const currentLock = chainLock;
  chainLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await currentLock;

  try {
    const lastEntry = await prisma.auditLog.findFirst({
      orderBy: { timestamp: 'desc' }
    });

    const previousHash = lastEntry ? lastEntry.recordHash : GENESIS_HASH;
    const timestamp = new Date();
    const metadataStr = payload.metadata ? JSON.stringify(payload.metadata) : null;

    // Strict deterministic format for cryptographic hashing
    const chainContent = [
      previousHash,
      payload.userId || 'ANONYMOUS',
      payload.patientId || 'NONE',
      payload.action,
      payload.resourceType,
      payload.resourceId || 'NONE',
      timestamp.toISOString(),
      metadataStr || ''
    ].join('|');

    const recordHash = sha256(chainContent);

    return await prisma.auditLog.create({
      data: {
        previousHash,
        recordHash,
        timestamp,
        userId: payload.userId,
        patientId: payload.patientId,
        action: payload.action,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
        metadataJson: metadataStr
      }
    });
  } catch (err) {
    console.error('CRITICAL: Audit logging write error:', err);
    return null;
  } finally {
    releaseLock();
  }
}

export async function verifyAuditChain(): Promise<{
  valid: boolean;
  totalRecords: number;
  brokenIndex?: number;
  brokenRecordId?: string;
  expectedHash?: string;
  actualHash?: string;
}> {
  const records = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'asc' }
  });

  if (records.length === 0) {
    return { valid: true, totalRecords: 0 };
  }

  let previousHash = GENESIS_HASH;

  for (let i = 0; i < records.length; i++) {
    const entry = records[i];

    if (entry.previousHash !== previousHash) {
      return {
        valid: false,
        totalRecords: records.length,
        brokenIndex: i,
        brokenRecordId: entry.id,
        expectedHash: previousHash,
        actualHash: entry.previousHash || undefined
      };
    }

    const chainContent = [
      entry.previousHash || GENESIS_HASH,
      entry.userId || 'ANONYMOUS',
      entry.patientId || 'NONE',
      entry.action,
      entry.resourceType,
      entry.resourceId || 'NONE',
      entry.timestamp.toISOString(),
      entry.metadataJson || ''
    ].join('|');

    const calculatedHash = sha256(chainContent);
    if (calculatedHash !== entry.recordHash) {
      return {
        valid: false,
        totalRecords: records.length,
        brokenIndex: i,
        brokenRecordId: entry.id,
        expectedHash: calculatedHash,
        actualHash: entry.recordHash
      };
    }

    previousHash = entry.recordHash;
  }

  return { valid: true, totalRecords: records.length };
}
