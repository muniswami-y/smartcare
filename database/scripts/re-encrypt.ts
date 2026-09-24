/**
 * CareSmart Field Re-encryption Script
 * Rotates encrypted fields (Patient phone, address, ABHA ID, clinical notes)
 * from OLD_FIELD_ENCRYPTION_KEY to NEW_FIELD_ENCRYPTION_KEY.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function decryptField(cipherTextWithIv: string, keyHex: string): string {
  const [ivHex, authTagHex, encryptedHex] = cipherTextWithIv.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) return cipherTextWithIv; // return as is if not matching format

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(keyHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptField(plainText: string, keyHex: string): string {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(keyHex, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function main() {
  const oldKey = process.env.OLD_FIELD_ENCRYPTION_KEY;
  const newKey = process.env.NEW_FIELD_ENCRYPTION_KEY;

  if (!oldKey || !newKey) {
    console.error('Usage: OLD_FIELD_ENCRYPTION_KEY and NEW_FIELD_ENCRYPTION_KEY must be set.');
    process.exit(1);
  }

  console.log('Beginning field re-encryption...');
  const patients = await prisma.patient.findMany();
  let count = 0;

  for (const patient of patients) {
    const rawAddress = patient.address ? decryptField(patient.address, oldKey) : null;
    const reEncryptedAddress = rawAddress ? encryptField(rawAddress, newKey) : null;

    await prisma.patient.update({
      where: { id: patient.id },
      data: {
        address: reEncryptedAddress
      }
    });
    count++;
  }

  console.log(`Successfully re-encrypted records for ${count} patients.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
