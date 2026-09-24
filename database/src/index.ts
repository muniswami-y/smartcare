import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Attempt loading from current or parent .env files
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export * from '@prisma/client';
export { PrismaClient };

// Shared global instance factory or singleton
let prismaInstance: PrismaClient | null = null;

const DEFAULT_DB_URL = 'postgresql://postgres:password@localhost:5432/caresmart?schema=public';

export function getDatabaseClient(connectionUrl?: string): PrismaClient {
  if (!prismaInstance) {
    const url = connectionUrl || process.env.DATABASE_URL || DEFAULT_DB_URL;
    prismaInstance = new PrismaClient({
      datasources: { db: { url } },
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
    });
  }
  return prismaInstance;
}
