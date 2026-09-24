import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../../config';
import { logger } from '../logger';

export interface FileMetadata {
  fileKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
}

export interface StorageProvider {
  saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<FileMetadata>;
  getFileStream(fileKey: string): Promise<fs.ReadStream>;
  deleteFile(fileKey: string): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = config.UPLOAD_DIR_ABSOLUTE;
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async saveFile(buffer: Buffer, originalName: string, mimeType: string): Promise<FileMetadata> {
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const safeExt = path.extname(originalName) || '.dat';
    const fileKey = `${Date.now()}-${crypto.randomUUID()}${safeExt}`;
    const targetPath = path.join(this.baseDir, fileKey);

    await fs.promises.writeFile(targetPath, buffer);

    return {
      fileKey,
      originalName,
      mimeType,
      sizeBytes: buffer.length,
      checksumSha256: checksum
    };
  }

  async getFileStream(fileKey: string): Promise<fs.ReadStream> {
    const targetPath = path.join(this.baseDir, fileKey);
    if (!fs.existsSync(targetPath)) {
      throw new Error('File not found in storage');
    }
    return fs.createReadStream(targetPath);
  }

  async deleteFile(fileKey: string): Promise<void> {
    const targetPath = path.join(this.baseDir, fileKey);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  }
}

// DICOM / Orthanc Integration Stub
export class OrthancDicomProviderStub {
  async pushInstanceToOrthanc(dicomBuffer: Buffer): Promise<{ orthancId: string; status: string }> {
    logger.info('Orthanc DICOM PACS Feed Stub: simulated instance transmission.');
    return {
      orthancId: `orthanc-${Date.now()}`,
      status: 'STORED_IN_PACS_ARCHIVE'
    };
  }

  async getDicomWebWadoUrl(studyInstanceUid: string): Promise<string> {
    return `/api/v1/imaging/studies/${studyInstanceUid}/dicomweb`;
  }
}

export const storageProvider: StorageProvider = new LocalStorageProvider();
export const dicomProvider = new OrthancDicomProviderStub();
