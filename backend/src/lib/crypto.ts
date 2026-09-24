import crypto from 'crypto';
import argon2 from 'argon2';
import { authenticator } from 'otplib';
import { config } from '../config';

// Keyed HMAC-SHA256 for searchable phone numbers
export function hashPhone(phone: string): string {
  const normalized = phone.replace(/[\s\-\(\)]/g, '');
  return crypto.createHmac('sha256', Buffer.from(config.PHONE_HASH_KEY, 'hex')).update(normalized).digest('hex');
}

// SHA-256 hash helper
export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// AES-256-GCM Field Encryption
export function encryptSensitiveField(plainText: string): string {
  if (!plainText) return plainText;
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(config.FIELD_ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptSensitiveField(cipherText: string): string {
  if (!cipherText || !cipherText.includes(':')) return cipherText;
  try {
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) return cipherText;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(config.FIELD_ENCRYPTION_KEY, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, return placeholder or safely handle
    return '[ENCRYPTION_DECODE_ERROR]';
  }
}

// Argon2 Password Hashing
export async function hashPassword(plainText: string): Promise<string> {
  return argon2.hash(plainText, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1
  });
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainText);
  } catch {
    return false;
  }
}

// TOTP 2FA Helpers
export function generateTotpSecret(email: string): { secret: string; otpauthUrl: string } {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, 'CareSmart Hospital', secret);
  return { secret, otpauthUrl };
}

export function verifyTotpToken(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}
