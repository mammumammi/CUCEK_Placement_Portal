/**
 * @fileoverview Storage abstraction and local disk implementation for file assets.
 * @module server/services/storage.service
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Metadata descriptor for a persisted file.
 */
export interface StoredFile {
  key: string;
  url: string;
}

/**
 * File retrieval result containing raw bytes and MIME content-type.
 */
export interface RetrievedFile {
  data: Buffer;
  contentType: string;
}

/**
 * Abstract File Storage Interface.
 * Allows transparent swapping between LocalDiskStorage and Cloudflare R2 / S3.
 */
export interface FileStorage {
  /**
   * Persists a file into the storage backend.
   *
   * @param fileName - Original filename.
   * @param buffer - File contents as a Buffer.
   * @param contentType - Optional MIME type.
   * @returns Metadata including storage key and access URL.
   */
  save(fileName: string, buffer: Buffer, contentType?: string): Promise<StoredFile>;

  /**
   * Retrieves a file by its storage key or URL path.
   *
   * @param keyOrUrl - File identifier or relative URL.
   * @returns Raw file buffer and content-type, or null if not found.
   */
  get(keyOrUrl: string): Promise<RetrievedFile | null>;

  /**
   * Deletes a file from the storage backend.
   *
   * @param keyOrUrl - File identifier or relative URL.
   */
  delete?(keyOrUrl: string): Promise<void>;
}

/**
 * Local disk implementation of FileStorage.
 * Stores uploaded files in a local directory (`uploads/`).
 */
export class LocalDiskStorage implements FileStorage {
  private readonly uploadDir: string;

  constructor(uploadDir?: string) {
    this.uploadDir = uploadDir ?? path.resolve(process.cwd(), 'uploads');
  }

  /**
   * Resolves the storage root directory path.
   */
  public getUploadDir(): string {
    return this.uploadDir;
  }

  public async save(
    fileName: string,
    buffer: Buffer,
    _contentType: string = 'application/octet-stream'
  ): Promise<StoredFile> {
    await fs.promises.mkdir(this.uploadDir, { recursive: true });

    const sanitized = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueKey = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${sanitized}`;
    const targetPath = path.join(this.uploadDir, uniqueKey);

    await fs.promises.writeFile(targetPath, buffer);

    return {
      key: uniqueKey,
      url: `/uploads/${uniqueKey}`,
    };
  }

  public async get(keyOrUrl: string): Promise<RetrievedFile | null> {
    const key = path.basename(keyOrUrl);
    const targetPath = path.join(this.uploadDir, key);

    try {
      const data = await fs.promises.readFile(targetPath);
      const isPdf = key.toLowerCase().endsWith('.pdf');
      return {
        data,
        contentType: isPdf ? 'application/pdf' : 'application/octet-stream',
      };
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  public async delete(keyOrUrl: string): Promise<void> {
    const key = path.basename(keyOrUrl);
    const targetPath = path.join(this.uploadDir, key);
    try {
      await fs.promises.unlink(targetPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }
}

export const defaultStorage = new LocalDiskStorage();

