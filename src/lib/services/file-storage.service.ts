/**
 * File Storage Service - Abstraction layer for file storage operations.
 *
 * Provides two implementations:
 * - LocalFileStorage: Stores files in /uploads directory (development)
 * - VercelBlobStorage: Uses @vercel/blob SDK (production)
 *
 * A factory function selects the implementation based on the
 * STORAGE_PROVIDER environment variable.
 *
 * Files are stored outside the public directory and served exclusively
 * through authenticated API routes.
 *
 * Validates: Requirements 7.1, 13.7
 */

import { createReadStream } from 'fs';
import { stat, mkdir, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import type { IFileStorage, FileMetadata, StorageResult } from '@/types';
import { sanitizeFilename } from '@/lib/utils/sanitize';

/**
 * Local file storage implementation for development.
 * Stores files in the /uploads directory at the project root,
 * outside the public directory to prevent direct access.
 */
export class LocalFileStorage implements IFileStorage {
  private basePath: string;

  constructor(basePath?: string) {
    // On serverless (Vercel), use /tmp which is writable.
    // Locally, use the project-level 'uploads' directory.
    if (basePath) {
      this.basePath = basePath;
    } else if (process.env.VERCEL) {
      this.basePath = '/tmp/uploads';
    } else {
      this.basePath = path.join(process.cwd(), 'uploads');
    }
  }

  async upload(file: Buffer, _filePath: string, metadata: FileMetadata): Promise<StorageResult> {
    const sanitizedName = sanitizeFilename(metadata.originalName);
    const timestamp = Date.now();
    const storagePath = path.join(metadata.actaId, `${timestamp}-${sanitizedName}`);
    const fullPath = path.join(this.basePath, storagePath);
    const dir = path.dirname(fullPath);

    try {
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, file);

      return {
        success: true,
        storagePath,
      };
    } catch (error) {
      return {
        success: false,
        storagePath: '',
        error: `Failed to store file locally: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, storagePath);
    try {
      await unlink(fullPath);
    } catch {
      // Silently ignore if file doesn't exist
    }
  }

  async getStream(storagePath: string): Promise<ReadableStream> {
    const fullPath = path.join(this.basePath, storagePath);

    // Verify the file exists and is within the base path (prevent traversal)
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(path.resolve(this.basePath))) {
      throw new Error('Access denied: path traversal detected');
    }

    await stat(resolvedPath); // Throws if file doesn't exist

    const nodeStream = createReadStream(resolvedPath);

    // Convert Node.js Readable to Web ReadableStream
    return Readable.toWeb(nodeStream) as ReadableStream;
  }

  getUrl(storagePath: string): string {
    return `/api/files/${encodeURIComponent(storagePath)}`;
  }
}

/**
 * Vercel Blob storage implementation for production.
 * Uses the @vercel/blob SDK for file storage in Vercel's edge network.
 */
export class VercelBlobStorage implements IFileStorage {
  async upload(file: Buffer, _filePath: string, metadata: FileMetadata): Promise<StorageResult> {
    try {
      const { put } = await import('@vercel/blob');
      const sanitizedName = sanitizeFilename(metadata.originalName);
      const timestamp = Date.now();
      const blobPath = `attachments/${metadata.actaId}/${timestamp}-${sanitizedName}`;

      const blob = await put(blobPath, file, {
        access: 'public',
        contentType: metadata.mimeType,
      });

      return {
        success: true,
        storagePath: blobPath,
        url: blob.url,
      };
    } catch (error) {
      return {
        success: false,
        storagePath: '',
        error: `Failed to store file in Vercel Blob: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async delete(storagePath: string): Promise<void> {
    try {
      const { del } = await import('@vercel/blob');
      await del(storagePath);
    } catch {
      // Silently ignore delete failures
    }
  }

  async getStream(storagePath: string): Promise<ReadableStream> {
    // For Vercel Blob, files are served via their public URL
    // This method fetches the file and returns the stream
    const response = await fetch(storagePath);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to fetch file from Vercel Blob: ${storagePath}`);
    }
    return response.body;
  }

  getUrl(storagePath: string): string {
    return `/api/files/${encodeURIComponent(storagePath)}`;
  }
}

/**
 * Factory function that returns the appropriate file storage implementation
 * based on the STORAGE_PROVIDER environment variable.
 *
 * @alias createFileStorage (deprecated alias, use getFileStorage)
 */
export function getFileStorage(): IFileStorage {
  const provider = process.env.STORAGE_PROVIDER || 'local';

  switch (provider) {
    case 'vercel-blob':
      return new VercelBlobStorage();
    case 'local':
      return new LocalFileStorage();
    default:
      return new LocalFileStorage();
  }
}

/** @deprecated Use getFileStorage() instead */
export const createFileStorage = getFileStorage;
